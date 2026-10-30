import Stripe from "stripe"

/**
 * Stripe is an optional integration — the salon owner supplies their own keys.
 * The app must BUILD and RUN without them, so we never throw at import time.
 * All user-facing flows call `isStripeConfigured()` first and degrade
 * gracefully with a friendly message when keys are missing.
 */
export const isStripeConfigured = (): boolean =>
  Boolean(process.env.STRIPE_SECRET_KEY)

export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || "sk_test_not_configured",
  {
    apiVersion: "2025-10-29.clover",
    typescript: true,
  }
)
