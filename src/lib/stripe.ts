import Stripe from "stripe"

/**
 * Stripe is an optional, salon-owned integration. Keys can come from:
 *  1. The Organization row (admin enters them in Settings → Plačila)
 *  2. Environment variables (legacy / platform-wide fallback)
 * The app must BUILD and RUN without them, so we never throw at import time.
 * All user-facing flows check configuration first and degrade gracefully
 * with a friendly message when no key is available.
 */

const STRIPE_API_VERSION = "2025-10-29.clover"

export const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || "sk_test_not_configured",
  {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
  }
)

/** Legacy check — environment key only. */
export const isStripeConfigured = (): boolean =>
  Boolean(process.env.STRIPE_SECRET_KEY)

/** Minimal structural type so callers can pass full Organization rows. */
interface OrganizationLike {
  stripeSecretKey?: string | null
  stripeWebhookSecret?: string | null
}

/**
 * Resolve the Stripe secret key for an organization:
 * org key from the database first, environment variable as fallback.
 */
export const getOrgStripeKey = (
  org: Pick<OrganizationLike, "stripeSecretKey"> | null | undefined
): string | null => org?.stripeSecretKey || process.env.STRIPE_SECRET_KEY || null

/** True when payments can run for this organization (org key or env key). */
export const isOrgStripeConfigured = (
  org: Pick<OrganizationLike, "stripeSecretKey"> | null | undefined
): boolean => Boolean(getOrgStripeKey(org))

/**
 * Stripe client scoped to an organization. Returns null when neither the
 * organization nor the environment provides a key, so callers can degrade
 * gracefully instead of crashing.
 */
export const getStripeForOrg = (
  org: Pick<OrganizationLike, "stripeSecretKey"> | null | undefined
): Stripe | null => {
  const key = getOrgStripeKey(org)
  if (!key) return null
  return new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
  })
}

/** "test" | "live" | "restricted" | "unknown" based on the key prefix. */
export const stripeKeyMode = (key: string): string => {
  if (key.startsWith("sk_test_")) return "test"
  if (key.startsWith("sk_live_")) return "live"
  if (key.startsWith("rk_live_") || key.startsWith("rk_test_"))
    return "restricted"
  return "unknown"
}

/** Mask a secret key for display: prefix + •••• + last 4 characters. */
export const maskSecretKey = (key: string): string => {
  const prefixMatch = key.match(/^(sk|rk)_(test|live)_/)
  const prefix = prefixMatch ? prefixMatch[0] : ""
  const tail = key.slice(-4)
  return `${prefix}${"•".repeat(4)}${tail}`
}

/**
 * Validate a Stripe secret key by hitting the API. A key is considered
 * VALID when the call succeeds OR fails only with a permission error
 * (403) — that still proves authentication works; restricted keys often
 * lack balance read access. Only authentication failures (401) or
 * connection problems mark the key as invalid.
 */
export async function verifyStripeSecretKey(
  key: string
): Promise<{ valid: boolean; mode: string; error?: string }> {
  const mode = stripeKeyMode(key)
  const client = new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
  })

  try {
    await client.balance.retrieve()
    return { valid: true, mode }
  } catch (err) {
    if (err instanceof Stripe.errors.StripePermissionError) {
      // Authenticated successfully, just missing permission — valid key.
      return { valid: true, mode }
    }
    if (err instanceof Stripe.errors.StripeAuthenticationError) {
      return { valid: false, mode, error: "invalid" }
    }
    const message =
      err instanceof Error ? err.message : "Unknown error verifying key"
    return { valid: false, mode, error: message }
  }
}
