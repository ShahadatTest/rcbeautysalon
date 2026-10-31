// ============================================================
// PAYMENT PROVIDER SELECTION (EPIC #3 E3-4 — SERVER-ONLY)
// The provider is chosen by CONFIGURATION, never hardcoded at
// call sites. When nothing is configured, a Null provider answers
// honestly with SETUP_REQUIRED — no flow ever pretends money
// moved (PLAN.md §9: "no fake success without provider
// confirmation").
// ============================================================

import { stripePlatformProvider } from "./stripe-platform"
import type { PaymentProvider } from "./types"

const NULL_PROVIDER_SETUP_REQUIRED = {
  message:
    "Plačilni sloj platforme še ni konfiguriran. Naročnine na pakete trenutno niso na voljo.",
  messageEn:
    "The platform billing layer is not configured yet. Plan subscriptions are currently unavailable.",
} as const

/**
 * Null provider — every checkout attempt returns SETUP_REQUIRED.
 * Deliberately honest: an unconfigured platform must visibly
 * refuse, not silently succeed.
 */
const nullProvider: PaymentProvider = {
  id: "none",
  isConfigured: () => false,
  async createSubscriptionCheckout() {
    return {
      ok: false,
      code: "SETUP_REQUIRED" as const,
      ...NULL_PROVIDER_SETUP_REQUIRED,
    }
  },
  async cancelSubscription() {
    return {
      ok: false,
      code: "SETUP_REQUIRED" as const,
      ...NULL_PROVIDER_SETUP_REQUIRED,
    }
  },
}

/** The configured platform payment provider (Stripe or honest null). */
export function getPlatformPaymentProvider(): PaymentProvider {
  return stripePlatformProvider.isConfigured() ? stripePlatformProvider : nullProvider
}

/** Convenience flag for UI/server rendering ("setup required" states). */
export function isPlatformBillingConfigured(): boolean {
  return stripePlatformProvider.isConfigured()
}

export { stripePlatformProvider }
export type { PaymentProvider, CheckoutSessionResult, SubscriptionCheckoutInput } from "./types"
export { SUBSCRIPTION_STATUSES } from "./types"
export type { SubscriptionStatus } from "./types"
