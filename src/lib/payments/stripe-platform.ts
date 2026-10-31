// ============================================================
// STRIPE PLATFORM PROVIDER (EPIC #3 E3-4 — SERVER-ONLY)
// The PLATFORM's own Stripe account (env PLATFORM_STRIPE_*),
// completely separate from per-tenant keys in src/lib/stripe.ts
// (which collect the tenant's OWN customer payments).
//
// env:
//   PLATFORM_STRIPE_SECRET_KEY       — platform account secret key
//   PLATFORM_STRIPE_WEBHOOK_SECRET   — signing secret for the
//                                      /api/webhooks/platform-stripe endpoint
//   PLATFORM_STRIPE_PRICE_PRO        — recurring price id for PRO
//   PLATFORM_STRIPE_PRICE_SCALE      — recurring price id for SCALE
//
// Without the key the provider reports SETUP_REQUIRED — it never
// fakes a successful checkout (PLAN.md §9 honesty rule).
// ============================================================

import Stripe from "stripe"
import type { PlanId } from "@/lib/plans/registry"
import type {
  CancelSubscriptionResult,
  CheckoutSessionResult,
  PaymentProvider,
  SubscriptionCheckoutInput,
} from "./types"
import { platformPriceIdForPlan } from "./subscription-state"

const STRIPE_API_VERSION = "2025-10-29.clover"

export const PLATFORM_STRIPE_SECRET_KEY_ENV = "PLATFORM_STRIPE_SECRET_KEY"
export const PLATFORM_STRIPE_WEBHOOK_SECRET_ENV = "PLATFORM_STRIPE_WEBHOOK_SECRET"

/** Platform Stripe client, or null when the platform account is not configured. */
export function getPlatformStripeClient(): Stripe | null {
  const key = process.env[PLATFORM_STRIPE_SECRET_KEY_ENV]
  if (!key) return null
  return new Stripe(key, { apiVersion: STRIPE_API_VERSION, typescript: true })
}

/** Signing secret for the platform webhook endpoint (null = endpoint refuses to process). */
export function platformWebhookSecret(): string | null {
  return process.env[PLATFORM_STRIPE_WEBHOOK_SECRET_ENV] || null
}

/**
 * Resolve-or-create the platform Stripe customer for a tenant.
 * Resolution order: the id already stored locally (deterministic,
 * no search-index lag) → provider-side metadata search → create.
 */
async function resolvePlatformCustomer(
  stripe: Stripe,
  input: SubscriptionCheckoutInput
): Promise<Stripe.Customer> {
  if (input.existingCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(input.existingCustomerId)
      if (!existing.deleted) return existing as Stripe.Customer
    } catch {
      // Stale local id (e.g. deleted customer) — fall through to search/create.
    }
  }

  const found = await stripe.customers.search({
    query: `metadata['orgId']:'${input.orgId}'`,
    limit: 1,
  })
  if (found.data.length > 0) return found.data[0]

  return stripe.customers.create({
    name: input.orgName,
    email: input.customerEmail || undefined,
    metadata: { orgId: input.orgId, orgSlug: input.orgSlug },
  })
}

const SETUP_REQUIRED = {
  message:
    "Plačilni sloj platforme še ni konfiguriran (manjka PLATFORM_STRIPE_SECRET_KEY). Naročnine trenutno niso na voljo.",
  messageEn:
    "The platform billing layer is not configured yet (missing PLATFORM_STRIPE_SECRET_KEY). Subscriptions are currently unavailable.",
} as const

const PRICE_MISSING = (planId: PlanId) => ({
  message: `Za paket ${planId.toUpperCase()} ni nastavljen Stripe cenik (manjka PLATFORM_STRIPE_PRICE_${planId.toUpperCase()}).`,
  messageEn: `No Stripe price is configured for the ${planId.toUpperCase()} plan (missing PLATFORM_STRIPE_PRICE_${planId.toUpperCase()}).`,
})

export const stripePlatformProvider: PaymentProvider = {
  id: "stripe",

  isConfigured(): boolean {
    return Boolean(process.env[PLATFORM_STRIPE_SECRET_KEY_ENV])
  },

  async createSubscriptionCheckout(input: SubscriptionCheckoutInput): Promise<CheckoutSessionResult> {
    const stripe = getPlatformStripeClient()
    if (!stripe) {
      return { ok: false, code: "SETUP_REQUIRED", ...SETUP_REQUIRED }
    }

    const priceId = platformPriceIdForPlan(input.planId)
    if (!priceId) {
      return { ok: false, code: "SETUP_REQUIRED", ...PRICE_MISSING(input.planId) }
    }

    try {
      const customer = await resolvePlatformCustomer(stripe, input)

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customer.id,
        line_items: [{ price: priceId, quantity: 1 }],
        // Metadata propagates to the subscription so webhook events
        // carry orgId/planId without extra API round-trips.
        metadata: {
          orgId: input.orgId,
          orgSlug: input.orgSlug,
          planId: input.planId,
        },
        subscription_data: {
          metadata: {
            orgId: input.orgId,
            orgSlug: input.orgSlug,
            planId: input.planId,
          },
        },
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
      })

      if (!session.url) {
        return {
          ok: false,
          code: "PROVIDER_ERROR",
          message: "Stripe ni vrnil URL-ja plačilne strani.",
          messageEn: "Stripe did not return a checkout URL.",
        }
      }

      return {
        ok: true,
        checkoutUrl: session.url,
        sessionId: session.id,
        customerId: customer.id,
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown provider error"
      console.error("[platform-billing] checkout session failed:", message)
      return {
        ok: false,
        code: "PROVIDER_ERROR",
        message: `Stripe napaka: ${message}`,
        messageEn: `Stripe error: ${message}`,
      }
    }
  },

  async cancelSubscription(input: { stripeSubscriptionId: string }): Promise<CancelSubscriptionResult> {
    const stripe = getPlatformStripeClient()
    if (!stripe) {
      return { ok: false, code: "SETUP_REQUIRED", ...SETUP_REQUIRED }
    }
    try {
      // Cancel at period end — the tenant keeps what was paid for.
      // All LOCAL state changes follow via webhook events only.
      await stripe.subscriptions.update(input.stripeSubscriptionId, {
        cancel_at_period_end: true,
      })
      return { ok: true }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown provider error"
      console.error("[platform-billing] cancel subscription failed:", message)
      return {
        ok: false,
        code: "PROVIDER_ERROR",
        message: `Stripe napaka: ${message}`,
        messageEn: `Stripe error: ${message}`,
      }
    }
  },
}
