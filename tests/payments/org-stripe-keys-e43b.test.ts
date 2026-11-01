// ============================================================
// EPIC #4 E4-3b — TENANT STRIPE KEYS ARE OWNER-ENTERED ONLY
// Product decision: the platform can NEVER hold a tenant Stripe
// key. These tests pin the rule down — even if an env key exists
// (legacy deploys), it must be ignored for tenant flows.
// Pure logic only (no DB, no network).
// ============================================================

import { describe, it, expect, afterEach, vi } from "vitest"
import { createHmac } from "node:crypto"
import {
  constructWebhookEvent,
  getOrgStripeKey,
  getStripeForOrg,
  isOrgStripeConfigured,
  maskSecretKey,
  stripeKeyMode,
} from "@/lib/stripe"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("getOrgStripeKey — org key only, env is deliberately ignored", () => {
  it("returns the organization's own key when present", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_platformheldkey")
    expect(getOrgStripeKey({ stripeSecretKey: "sk_test_orgkey123" })).toBe(
      "sk_test_orgkey123"
    )
  })

  it("returns null when the org has no key — even if an env key exists", () => {
    // The directive: "stripe ključ uporabnik vstavi sam — ne moremo mi ta
    // ključ imeti". A platform-held env key must never leak into tenants.
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_platformheldkey")
    expect(getOrgStripeKey({ stripeSecretKey: null })).toBeNull()
    expect(getOrgStripeKey({ stripeSecretKey: "" })).toBeNull()
  })

  it("returns null without an organization — even if an env key exists", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_platformheldkey")
    expect(getOrgStripeKey(null)).toBeNull()
    expect(getOrgStripeKey(undefined)).toBeNull()
  })
})

describe("isOrgStripeConfigured / getStripeForOrg — graceful degradation", () => {
  it("is true only with an org key", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_platformheldkey")
    expect(isOrgStripeConfigured({ stripeSecretKey: "sk_live_abc" })).toBe(true)
    expect(isOrgStripeConfigured({ stripeSecretKey: null })).toBe(false)
    expect(isOrgStripeConfigured(null)).toBe(false)
  })

  it("returns a client for the org key and null otherwise (env ignored)", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_platformheldkey")
    const client = getStripeForOrg({ stripeSecretKey: "sk_test_orgkey123" })
    expect(client).not.toBeNull()
    expect(getStripeForOrg({ stripeSecretKey: null })).toBeNull()
    expect(getStripeForOrg(null)).toBeNull()
  })
})

describe("constructWebhookEvent — tenant-secret signature verification", () => {
  const secret = "whsec_testtenantsecret"
  const payload = JSON.stringify({
    id: "evt_test_1",
    object: "event",
    api_version: "2025-10-29.clover",
    created: Math.floor(Date.now() / 1000),
    data: { object: { id: "cs_test_1", object: "checkout.session" } },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: "checkout.session.completed",
  })

  function signedHeader(sec: string): string {
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = createHmac("sha256", sec)
      .update(`${timestamp}.${payload}`)
      .digest("hex")
    return `t=${timestamp},v1=${signature}`
  }

  it("verifies a correctly signed delivery against the tenant secret", () => {
    const event = constructWebhookEvent(payload, signedHeader(secret), secret)
    expect(event.id).toBe("evt_test_1")
    expect(event.type).toBe("checkout.session.completed")
  })

  it("rejects a signature made with a different secret", () => {
    expect(() =>
      constructWebhookEvent(payload, signedHeader("whsec_wrong"), secret)
    ).toThrow()
  })

  it("rejects a tampered payload", () => {
    const header = signedHeader(secret)
    const tampered = payload.replace("cs_test_1", "cs_evil_1")
    expect(() => constructWebhookEvent(tampered, header, secret)).toThrow()
  })
})

describe("key presentation helpers (settings display)", () => {
  it("classifies key mode by prefix", () => {
    expect(stripeKeyMode("sk_test_abc")).toBe("test")
    expect(stripeKeyMode("sk_live_abc")).toBe("live")
    expect(stripeKeyMode("rk_live_abc")).toBe("restricted")
    expect(stripeKeyMode("whsec_abc")).toBe("unknown")
  })

  it("masks the key — never returns the full secret to any UI", () => {
    expect(maskSecretKey("sk_live_abcd1234")).toBe("sk_live_••••1234")
  })
})
