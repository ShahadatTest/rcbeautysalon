// ============================================================
// PAYMENT PROVIDER INTERFACE (EPIC #3 E3-4)
// The platform billing layer talks ONLY to this interface — the
// provider can be swapped without touching tenant flows (PLAN.md
// decision log: adapter prevents vendor lock-in).
//
// HONESTY RULE: a provider that is not configured must return a
// clear SETUP_REQUIRED result. It must NEVER fake a success —
// no plan is ever marked as paid without provider confirmation
// (webhook events are the ONLY source of entitlement changes).
//
// Client-safe: NO server-only imports.
// ============================================================

import type { PlanId } from "@/lib/plans/registry"

/**
 * Normalized subscription lifecycle states persisted on
 * PlatformSubscription.status (mirrored from the provider).
 */
export const SUBSCRIPTION_STATUSES = [
  "INCOMPLETE",
  "TRIALING",
  "ACTIVE",
  "PAST_DUE",
  "CANCELED",
  "UNPAID",
] as const
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]

/** Input for a hosted subscription checkout (one plan, one tenant). */
export interface SubscriptionCheckoutInput {
  orgId: string
  orgSlug: string
  orgName: string
  planId: PlanId
  /** Optional prefill of the customer e-mail on the hosted page. */
  customerEmail?: string | null
  /**
   * Provider customer id already stored locally (from a previous
   * checkout). Preferred over provider-side lookups — deterministic,
   * no search-index lag.
   */
  existingCustomerId?: string | null
  successUrl: string
  cancelUrl: string
}

export type CheckoutSessionResult =
  | { ok: true; checkoutUrl: string; sessionId: string; customerId: string | null }
  | { ok: false; code: "SETUP_REQUIRED"; message: string; messageEn: string }
  | { ok: false; code: "PROVIDER_ERROR"; message: string; messageEn: string }

/**
 * Provider-neutral payment adapter for PLATFORM subscriptions
 * (tenant → platform money flow). Per-tenant customer payments
 * (orders/deposits) use the tenant's own Stripe keys and are
 * intentionally OUT of this interface's scope.
 */
export interface PaymentProvider {
  readonly id: string
  /**
   * True when the platform account is configured. False → callers
   * must show an honest "setup required" state, never a fake flow.
   */
  isConfigured(): boolean
  /**
   * Create a hosted checkout session for subscribing the tenant to
   * a paid plan. This ONLY creates the session — the plan/entitlement
   * change happens exclusively when the provider's webhook confirms
   * the payment.
   */
  createSubscriptionCheckout(input: SubscriptionCheckoutInput): Promise<CheckoutSessionResult>
  /**
   * Request cancellation of an active subscription (at the end of
   * the current period). The LOCAL state/entitlement change happens
   * exclusively via the provider's webhook events — this only asks
   * the provider.
   */
  cancelSubscription(input: { stripeSubscriptionId: string }): Promise<CancelSubscriptionResult>
}

export type CancelSubscriptionResult =
  | { ok: true }
  | { ok: false; code: "SETUP_REQUIRED"; message: string; messageEn: string }
  | { ok: false; code: "PROVIDER_ERROR"; message: string; messageEn: string }
