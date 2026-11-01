// ============================================================
// EPIC #4 E4-1 — PLATFORM ANALYTICS (derived-only, honest)
// Pure-function tests on fixed fixtures: plan distribution,
// trial→paid conversion, churn, revenue (invoice.paid only,
// per recorded currency, no FX), and webhook health. The tests
// lock the honesty rules: rates are null (never 0 %) without
// denominators, checkout events are NOT summed, unknown plans
// are not folded into known buckets, and the month window is
// the UTC month boundary (inclusive).
// ============================================================

import { describe, it, expect } from "vitest"
import { computePlatformAnalytics } from "../../src/lib/platform/analytics"

// Fixed "now" so month windows are deterministic: 2025-11-20T12:00Z
// → monthStartUtc = 2025-11-01T00:00Z, 7d window = 2025-11-13T12:00Z.
const NOW = new Date("2025-11-20T12:00:00.000Z")

function ev(
  type: string,
  createdAt: string,
  amountCents: number | null = null,
  currency: string | null = null
) {
  return { type, createdAt: new Date(createdAt), amountCents, currency }
}

describe("plan distribution", () => {
  it("counts tenants per plan, known plans first, unknowns not folded in", () => {
    const result = computePlatformAnalytics({
      tenants: [
        { plan: "free", subscriptionStatus: null },
        { plan: "free", subscriptionStatus: null },
        { plan: "pro", subscriptionStatus: "ACTIVE" },
        { plan: "scale", subscriptionStatus: "ACTIVE" },
        { plan: "legacy_gold", subscriptionStatus: null }, // unknown id
      ],
      billingEvents: [],
      now: NOW,
    })

    expect(result.planDistribution).toEqual([
      { plan: "free", count: 2 },
      { plan: "pro", count: 1 },
      { plan: "scale", count: 1 },
      { plan: "legacy_gold", count: 1 },
    ])
  })

  it("returns an empty list for zero tenants", () => {
    const result = computePlatformAnalytics({
      tenants: [],
      billingEvents: [],
      now: NOW,
    })
    expect(result.planDistribution).toEqual([])
  })
})

describe("conversion (trial→paid)", () => {
  it("computes paying / tenants with subscription, 1 decimal", () => {
    const result = computePlatformAnalytics({
      tenants: [
        { plan: "free", subscriptionStatus: "ACTIVE" },
        { plan: "pro", subscriptionStatus: "TRIALING" },
        { plan: "pro", subscriptionStatus: "CANCELED" },
        { plan: "free", subscriptionStatus: null }, // no subscription record
      ],
      billingEvents: [],
      now: NOW,
    })

    expect(result.conversion).toEqual({
      tenantsWithSubscription: 3,
      paying: 2,
      ratePercent: 66.7,
    })
  })

  it("is null (never 0 %) when no tenant has a subscription", () => {
    const result = computePlatformAnalytics({
      tenants: [{ plan: "free", subscriptionStatus: null }],
      billingEvents: [],
      now: NOW,
    })
    expect(result.conversion.ratePercent).toBeNull()
    expect(result.conversion.tenantsWithSubscription).toBe(0)
    expect(result.conversion.paying).toBe(0)
  })
})

describe("churn", () => {
  it("counts CANCELED and UNPAID over all subscriptions", () => {
    const result = computePlatformAnalytics({
      tenants: [
        { plan: "pro", subscriptionStatus: "CANCELED" },
        { plan: "pro", subscriptionStatus: "UNPAID" },
        { plan: "pro", subscriptionStatus: "ACTIVE" },
        { plan: "pro", subscriptionStatus: "PAST_DUE" }, // grace is NOT churn
      ],
      billingEvents: [],
      now: NOW,
    })

    expect(result.churn).toEqual({
      subscriptions: 4,
      churned: 2,
      ratePercent: 50,
    })
  })

  it("is null when there are no subscriptions", () => {
    const result = computePlatformAnalytics({
      tenants: [],
      billingEvents: [],
      now: NOW,
    })
    expect(result.churn.ratePercent).toBeNull()
  })
})

describe("revenue (invoice.paid only, per recorded currency)", () => {
  it("sums invoice.paid in the month per currency and skips checkout events", () => {
    const result = computePlatformAnalytics({
      tenants: [],
      billingEvents: [
        ev("invoice.paid", "2025-11-05T10:00:00Z", 4900, "eur"),
        ev("invoice.paid", "2025-11-10T10:00:00Z", 4900, "eur"),
        // checkout for the FIRST month of the same subscription —
        // summing it would double-count one payment:
        ev("checkout.session.completed", "2025-11-05T09:59:00Z", 4900, "eur"),
        // a second currency is kept separate, never converted:
        ev("invoice.paid", "2025-11-12T10:00:00Z", 2000, "usd"),
      ],
      now: NOW,
    })

    expect(result.revenue.paidInvoiceEvents).toBe(3)
    expect(result.revenue.byCurrency).toEqual([
      { currency: "eur", amountCents: 9800, events: 2 },
      { currency: "usd", amountCents: 2000, events: 1 },
    ])
    expect(result.revenue.otherTypeEvents).toBe(1)
  })

  it("excludes events before the UTC month boundary and includes the boundary instant", () => {
    const result = computePlatformAnalytics({
      tenants: [],
      billingEvents: [
        ev("invoice.paid", "2025-10-31T23:59:59Z", 9999, "eur"), // prev month
        ev("invoice.paid", "2025-11-01T00:00:00Z", 1500, "eur"), // boundary instant — in
      ],
      now: NOW,
    })

    expect(result.revenue.paidInvoiceEvents).toBe(1)
    expect(result.revenue.byCurrency).toEqual([
      { currency: "eur", amountCents: 1500, events: 1 },
    ])
    expect(result.revenue.monthStartUtc).toEqual(new Date("2025-11-01T00:00:00.000Z"))
  })

  it("skips invoice.paid rows without amount or currency instead of inventing zeros", () => {
    const result = computePlatformAnalytics({
      tenants: [],
      billingEvents: [
        ev("invoice.paid", "2025-11-08T10:00:00Z", null, "eur"),
        ev("invoice.paid", "2025-11-09T10:00:00Z", 4900, null),
      ],
      now: NOW,
    })

    // counted as paid invoice events, but no summable currency row:
    expect(result.revenue.paidInvoiceEvents).toBe(2)
    expect(result.revenue.byCurrency).toEqual([])
  })

  it("reports no revenue honestly when nothing was paid this month", () => {
    const result = computePlatformAnalytics({
      tenants: [],
      billingEvents: [],
      now: NOW,
    })
    expect(result.revenue.byCurrency).toEqual([])
    expect(result.revenue.paidInvoiceEvents).toBe(0)
  })
})

describe("webhook health (7 days)", () => {
  it("counts events in the last 7 days with distinct types and last timestamp", () => {
    const result = computePlatformAnalytics({
      tenants: [],
      billingEvents: [
        ev("invoice.paid", "2025-11-01T10:00:00Z", 4900, "eur"), // older than 7d
        ev("invoice.paid", "2025-11-19T10:00:00Z", 4900, "eur"),
        ev("customer.subscription.updated", "2025-11-18T10:00:00Z"),
        ev("checkout.session.completed", "2025-11-20T11:00:00Z", 4900, "eur"),
      ],
      now: NOW,
    })

    expect(result.webhookHealth.eventsLast7d).toBe(3)
    expect(result.webhookHealth.distinctTypes).toBe(3)
    expect(result.webhookHealth.lastEventAt).toEqual(new Date("2025-11-20T11:00:00.000Z"))
  })

  it("is silent (zeros + null) when no events exist", () => {
    const result = computePlatformAnalytics({
      tenants: [],
      billingEvents: [],
      now: NOW,
    })
    expect(result.webhookHealth).toEqual({
      eventsLast7d: 0,
      distinctTypes: 0,
      lastEventAt: null,
    })
  })
})
