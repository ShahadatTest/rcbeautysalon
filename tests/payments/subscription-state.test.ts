// ============================================================
// EPIC #3 E3-4 — SUBSCRIPTION STATE + ENTITLEMENT TESTS
// Pure logic only (no DB, no network): the money-flow rules the
// platform webhook applies are unit-tested in isolation.
// ============================================================

import { describe, it, expect, afterEach } from "vitest"
import {
  entitlementPlanFor,
  isEventAlreadyProcessed,
  isHandledPlatformEventType,
  mapStripeSubscriptionStatus,
  planIdForPlatformPrice,
  platformPriceEnvName,
  platformPriceIdForPlan,
  snapshotFromStripeSubscription,
  subscriptionMetadata,
  subscriptionUpdateFromSnapshot,
} from "@/lib/payments/subscription-state"
import { getPlatformPaymentProvider } from "@/lib/payments/provider"

afterEach(() => {
  delete process.env.PLATFORM_STRIPE_PRICE_PRO
  delete process.env.PLATFORM_STRIPE_PRICE_SCALE
  delete process.env.PLATFORM_STRIPE_SECRET_KEY
})

const ACTIVE_SNAPSHOT = {
  status: "ACTIVE" as const,
  planId: "pro" as const,
  stripeSubscriptionId: "sub_123",
  stripeCustomerId: "cus_123",
  stripePriceId: "price_pro",
  currentPeriodStart: new Date("2025-11-01T00:00:00Z"),
  currentPeriodEnd: new Date("2025-12-01T00:00:00Z"),
  cancelAtPeriodEnd: false,
  canceledAt: null,
}

describe("stripe status mapping (E3-4)", () => {
  it("maps every known stripe status to a normalized local status", () => {
    expect(mapStripeSubscriptionStatus("active")).toBe("ACTIVE")
    expect(mapStripeSubscriptionStatus("trialing")).toBe("TRIALING")
    expect(mapStripeSubscriptionStatus("past_due")).toBe("PAST_DUE")
    expect(mapStripeSubscriptionStatus("canceled")).toBe("CANCELED")
    expect(mapStripeSubscriptionStatus("incomplete_expired")).toBe("CANCELED")
    expect(mapStripeSubscriptionStatus("unpaid")).toBe("UNPAID")
  })

  it("fails closed: unknown and transient statuses never look paid", () => {
    expect(mapStripeSubscriptionStatus("incomplete")).toBe("INCOMPLETE")
    expect(mapStripeSubscriptionStatus("paused")).toBe("INCOMPLETE")
    expect(mapStripeSubscriptionStatus("something_new")).toBe("INCOMPLETE")
    expect(mapStripeSubscriptionStatus(null)).toBe("INCOMPLETE")
    expect(mapStripeSubscriptionStatus(undefined)).toBe("INCOMPLETE")
  })
})

describe("entitlement rule (E3-4 — the heart of the phase)", () => {
  it("ACTIVE and TRIALING grant the subscription's plan", () => {
    expect(entitlementPlanFor({ status: "ACTIVE", planId: "pro" })).toBe("pro")
    expect(entitlementPlanFor({ status: "TRIALING", planId: "scale" })).toBe("scale")
  })

  it("terminal non-paid states always return to FREE", () => {
    expect(entitlementPlanFor({ status: "CANCELED", planId: "pro" })).toBe("free")
    expect(entitlementPlanFor({ status: "UNPAID", planId: "scale" })).toBe("free")
  })

  it("transient and grace states never change entitlements", () => {
    // INCOMPLETE: checkout in progress — must not downgrade mid-flow
    expect(entitlementPlanFor({ status: "INCOMPLETE", planId: "pro" })).toBeNull()
    // PAST_DUE: grace policy (E3-7) — keep working until terminal
    expect(entitlementPlanFor({ status: "PAST_DUE", planId: "pro" })).toBeNull()
  })
})

describe("webhook event handling set (E3-4)", () => {
  it("handles exactly the money-flow event types", () => {
    expect(isHandledPlatformEventType("checkout.session.completed")).toBe(true)
    expect(isHandledPlatformEventType("customer.subscription.created")).toBe(true)
    expect(isHandledPlatformEventType("customer.subscription.updated")).toBe(true)
    expect(isHandledPlatformEventType("customer.subscription.deleted")).toBe(true)
    expect(isHandledPlatformEventType("invoice.paid")).toBe(true)
    expect(isHandledPlatformEventType("invoice.payment_failed")).toBe(true)
  })

  it("ignores everything else (customer payments stay on per-tenant webhooks)", () => {
    expect(isHandledPlatformEventType("charge.succeeded")).toBe(false)
    expect(isHandledPlatformEventType("payment_intent.succeeded")).toBe(false)
    expect(isHandledPlatformEventType("")).toBe(false)
  })
})

describe("idempotency guard (E3-4 acceptance: replay tests)", () => {
  it("an event is processable exactly once", () => {
    const seen = new Set<string>(["evt_1"])
    expect(isEventAlreadyProcessed(seen, "evt_1")).toBe(true)
    expect(isEventAlreadyProcessed(seen, "evt_2")).toBe(false)
  })

  it("guarded snapshot apply is a no-op when nothing changes (replay)", () => {
    const current = {
      status: "ACTIVE",
      plan: "pro",
      currentPeriodStart: ACTIVE_SNAPSHOT.currentPeriodStart,
      currentPeriodEnd: ACTIVE_SNAPSHOT.currentPeriodEnd,
      cancelAtPeriodEnd: false,
    }
    expect(subscriptionUpdateFromSnapshot(current, ACTIVE_SNAPSHOT)).toBeNull()
  })

  it("guarded apply returns the payload only for a real transition", () => {
    const current = {
      status: "INCOMPLETE",
      plan: "free",
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    }
    const update = subscriptionUpdateFromSnapshot(current, ACTIVE_SNAPSHOT)
    expect(update).not.toBeNull()
    expect(update?.status).toBe("ACTIVE")
    expect(update?.plan).toBe("pro")
    expect(update?.canceledAt).toBeNull()
  })
})

describe("snapshot extraction from stripe subscription payloads", () => {
  it("extracts identifiers, period and plan from metadata", () => {
    const snapshot = snapshotFromStripeSubscription({
      id: "sub_abc",
      status: "active",
      customer: "cus_abc",
      cancel_at_period_end: true,
      canceled_at: 1735689600,
      current_period_start: 1733011200,
      current_period_end: 1735689600,
      metadata: { orgId: "org_1", planId: "pro" },
      items: { data: [{ price: { id: "price_pro_env" } }] },
    })

    expect(snapshot.status).toBe("ACTIVE")
    expect(snapshot.planId).toBe("pro")
    expect(snapshot.stripeSubscriptionId).toBe("sub_abc")
    expect(snapshot.stripeCustomerId).toBe("cus_abc")
    expect(snapshot.stripePriceId).toBe("price_pro_env")
    expect(snapshot.cancelAtPeriodEnd).toBe(true)
    expect(snapshot.canceledAt?.toISOString()).toBe("2025-01-01T00:00:00.000Z")
    expect(snapshot.currentPeriodEnd?.toISOString()).toBe("2025-01-01T00:00:00.000Z")
  })

  it("plan resolution falls back metadata → price env → free (fail-closed)", () => {
    process.env.PLATFORM_STRIPE_PRICE_PRO = "price_pro_env"

    // metadata wins
    const fromMeta = snapshotFromStripeSubscription({
      status: "active",
      metadata: { planId: "scale" },
      items: { data: [{ price: { id: "price_pro_env" } }] },
    })
    expect(fromMeta.planId).toBe("scale")

    // price env mapping second
    const fromPrice = snapshotFromStripeSubscription({
      status: "active",
      items: { data: [{ price: { id: "price_pro_env" } }] },
    })
    expect(fromPrice.planId).toBe("pro")

    // unknown price and no metadata → free
    const fromNothing = snapshotFromStripeSubscription({
      status: "active",
      items: { data: [{ price: { id: "price_unknown" } }] },
    })
    expect(fromNothing.planId).toBe("free")
  })

  it("customer object shape and missing items are tolerated", () => {
    const snapshot = snapshotFromStripeSubscription({
      status: "canceled",
      customer: { id: "cus_obj" },
      items: null,
    })
    expect(snapshot.stripeCustomerId).toBe("cus_obj")
    expect(snapshot.stripePriceId).toBeNull()
    expect(snapshot.status).toBe("CANCELED")
    expect(snapshot.planId).toBe("free")
  })

  it("metadata with an unknown plan id degrades to free, never escalates", () => {
    const meta = subscriptionMetadata({ metadata: { orgId: "org_1", planId: "gold" } })
    expect(meta.planId).toBeNull()
    expect(meta.orgId).toBe("org_1")
  })
})

describe("price ↔ plan env mapping", () => {
  it("env names follow the PLATFORM_STRIPE_PRICE_<PLAN> convention", () => {
    expect(platformPriceEnvName("pro")).toBe("PLATFORM_STRIPE_PRICE_PRO")
    expect(platformPriceEnvName("scale")).toBe("PLATFORM_STRIPE_PRICE_SCALE")
  })

  it("free is not purchasable", () => {
    expect(platformPriceIdForPlan("free")).toBeNull()
  })

  it("reverse-maps a configured price id to its plan; unknown → null", () => {
    process.env.PLATFORM_STRIPE_PRICE_SCALE = "price_scale_env"
    expect(planIdForPlatformPrice("price_scale_env")).toBe("scale")
    expect(planIdForPlatformPrice("price_missing")).toBeNull()
  })
})

describe("honest provider selection (E3-4: no fake success)", () => {
  it("without PLATFORM_STRIPE_SECRET_KEY the flow refuses with SETUP_REQUIRED", async () => {
    delete process.env.PLATFORM_STRIPE_SECRET_KEY
    const provider = getPlatformPaymentProvider()
    expect(provider.isConfigured()).toBe(false)

    const result = await provider.createSubscriptionCheckout({
      orgId: "org_1",
      orgSlug: "studio",
      orgName: "Studio",
      planId: "pro",
      successUrl: "https://example.test/success",
      cancelUrl: "https://example.test/cancel",
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe("SETUP_REQUIRED")
      expect(result.message.length).toBeGreaterThan(0)
      expect(result.messageEn.length).toBeGreaterThan(0)
    }
  })

  it("with the key present the stripe provider reports configured", () => {
    process.env.PLATFORM_STRIPE_SECRET_KEY = "sk_test_platform_key"
    const provider = getPlatformPaymentProvider()
    expect(provider.isConfigured()).toBe(true)
    expect(provider.id).toBe("stripe")
  })

  it("cancelSubscription without configuration refuses honestly", async () => {
    delete process.env.PLATFORM_STRIPE_SECRET_KEY
    const provider = getPlatformPaymentProvider()
    const result = await provider.cancelSubscription({ stripeSubscriptionId: "sub_x" })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe("SETUP_REQUIRED")
  })
})
