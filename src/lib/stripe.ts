import Stripe from "stripe"

/**
 * Stripe is an optional, SALON-OWNED integration (product decision, EPIC #4
 * E4-3b): each salon owner pastes their own secret key in Settings → Plačila
 * and it is stored on the Organization row. The platform NEVER holds a
 * tenant Stripe key — there is deliberately NO environment fallback, so a
 * shared/platform key can never silently collect a salon's payments.
 * The app must BUILD and RUN without any key, so we never throw at import
 * time; flows check configuration first and degrade gracefully.
 */

const STRIPE_API_VERSION = "2025-10-29.clover"

/** Minimal structural type so callers can pass full Organization rows. */
interface OrganizationLike {
  stripeSecretKey?: string | null
  stripeWebhookSecret?: string | null
}

/**
 * Resolve the Stripe secret key for an organization: the org's own key ONLY.
 * There is intentionally no env fallback — the platform cannot hold the key.
 */
export const getOrgStripeKey = (
  org: Pick<OrganizationLike, "stripeSecretKey"> | null | undefined
): string | null => org?.stripeSecretKey || null

/** True when payments can run for this organization (org key present). */
export const isOrgStripeConfigured = (
  org: Pick<OrganizationLike, "stripeSecretKey"> | null | undefined
): boolean => Boolean(getOrgStripeKey(org))

/**
 * Stripe client scoped to an organization. Returns null when the organization
 * has no key of its own, so callers can degrade gracefully instead of crashing.
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

/**
 * Signature verification is a LOCAL HMAC check (constructEvent never calls
 * the Stripe API), so a placeholder-key client is sufficient. The secrets
 * tried are the tenants' own webhook secrets — the platform holds none.
 */
const webhookSignatureClient = new Stripe(
  "whsec_verification_only_placeholder_no_api_calls",
  {
    apiVersion: STRIPE_API_VERSION,
    typescript: true,
  }
)

/** Verify a signed webhook delivery against one tenant-provided secret. */
export function constructWebhookEvent(
  body: string,
  signature: string,
  secret: string
): Stripe.Event {
  return webhookSignatureClient.webhooks.constructEvent(body, signature, secret)
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
