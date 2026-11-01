// ============================================================
// PLATFORM ANALYTICS (EPIC #4 E4-1)
// Derived-only metrics for the operator console (issue #3 §15):
// plan distribution, trial→paid conversion, churn, revenue and
// webhook health. Everything is computed from EXISTING tables —
// no counters are written anywhere (same principle as E3-7:
// no double bookkeeping, derived numbers can never disagree
// with the underlying data).
//
// Client-safe pure module: no server-only imports, no DB. The
// loader (src/lib/platform/overview.ts) fetches the raw rows
// and this function derives the metrics, so every number is
// unit-testable against a fixed fixture (see
// tests/platform/analytics-e41.test.ts).
//
// HONESTY RULES (issue #3 §15: "Clearly label estimates … do not
// fabricate analytics"):
//  - Rates are null (never 0 %) when the denominator is 0 —
//    "no subscriptions yet" is not the same as "0 % conversion".
//  - Revenue sums ONLY `invoice.paid` amounts, grouped by the
//    currency exactly as recorded — no FX conversion, because a
//    made-up exchange rate would be fabricated precision.
//    `checkout.session.completed` is deliberately NOT summed:
//    the first month of a subscription emits BOTH events, so
//    summing both would double-count one payment.
//  - Unknown plan ids are shown as their own row instead of
//    being silently folded into a known bucket.
// ============================================================

import { monthStartUtc } from "@/lib/plans/types"

export interface AnalyticsTenantInput {
  plan: string
  subscriptionStatus: string | null
}

export interface AnalyticsEventInput {
  type: string
  amountCents: number | null
  currency: string | null
  createdAt: Date
}

export interface PlanDistributionRow {
  plan: string
  count: number
}

export interface ConversionMetric {
  /** Tenants that have a platform subscription record at all. */
  tenantsWithSubscription: number
  /** ACTIVE or TRIALING — paying or on a trial of a paid plan. */
  paying: number
  /** paying / tenantsWithSubscription × 100, 1 decimal; null when no subscriptions. */
  ratePercent: number | null
}

export interface ChurnMetric {
  subscriptions: number
  /** CANCELED or UNPAID subscriptions. */
  churned: number
  /** churned / subscriptions × 100, 1 decimal; null when no subscriptions. */
  ratePercent: number | null
}

export interface RevenueByCurrencyRow {
  currency: string
  amountCents: number
  events: number
}

export interface RevenueMetric {
  monthStartUtc: Date
  /** All invoice.paid events in the current month (UTC boundary). */
  paidInvoiceEvents: number
  /** Collected amounts per recorded currency, sorted by currency. */
  byCurrency: RevenueByCurrencyRow[]
  /**
   * Month events of other types (checkout.session.completed, …) that are
   * deliberately not summed — surfaced so nothing disappears silently.
   */
  otherTypeEvents: number
}

export interface WebhookHealthMetric {
  /** Billing events received in the last 7 days (webhook is alive). */
  eventsLast7d: number
  distinctTypes: number
  lastEventAt: Date | null
}

export interface PlatformAnalytics {
  planDistribution: PlanDistributionRow[]
  conversion: ConversionMetric
  churn: ChurnMetric
  revenue: RevenueMetric
  webhookHealth: WebhookHealthMetric
}

/** Known plan ids first (free, pro, scale), unknown ids after, both ascending. */
function planSortKey(plan: string): [number, string] {
  const knownIndex = ["free", "pro", "scale"].indexOf(plan)
  return [knownIndex === -1 ? 3 : knownIndex, plan]
}

function ratePercent(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  return Math.round((numerator / denominator) * 1000) / 10
}

const PAYING_STATUSES = new Set(["ACTIVE", "TRIALING"])
const CHURNED_STATUSES = new Set(["CANCELED", "UNPAID"])
const REVENUE_EVENT_TYPE = "invoice.paid"
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export function computePlatformAnalytics(input: {
  tenants: AnalyticsTenantInput[]
  billingEvents: AnalyticsEventInput[]
  now: Date
}): PlatformAnalytics {
  const { tenants, billingEvents, now } = input

  // --- Plan distribution ------------------------------------------------
  const planCounts = new Map<string, number>()
  for (const tenant of tenants) {
    planCounts.set(tenant.plan, (planCounts.get(tenant.plan) ?? 0) + 1)
  }
  const planDistribution = [...planCounts.entries()]
    .map(([plan, count]) => ({ plan, count }))
    .sort((a, b) => {
      const [ka, na] = planSortKey(a.plan)
      const [kb, nb] = planSortKey(b.plan)
      return ka - kb || na.localeCompare(nb)
    })

  // --- Conversion + churn (over subscription statuses) ------------------
  const statuses = tenants
    .map((t) => t.subscriptionStatus)
    .filter((s): s is string => s !== null)
  const withSubscription = statuses.length
  const paying = statuses.filter((s) => PAYING_STATUSES.has(s)).length
  const churned = statuses.filter((s) => CHURNED_STATUSES.has(s)).length

  const conversion: ConversionMetric = {
    tenantsWithSubscription: withSubscription,
    paying,
    ratePercent: ratePercent(paying, withSubscription),
  }

  const churn: ChurnMetric = {
    subscriptions: withSubscription,
    churned,
    ratePercent: ratePercent(churned, withSubscription),
  }

  // --- Revenue (current month, UTC boundary) -----------------------------
  const monthStart = monthStartUtc(now)
  const sevenDaysAgo = new Date(now.getTime() - SEVEN_DAYS_MS)
  // The loader may fetch a wider window (min of monthStart / 7d ago);
  // the pure function therefore filters each metric to its own window.
  const monthEvents = billingEvents.filter((e) => e.createdAt >= monthStart)

  const currencyTotals = new Map<string, RevenueByCurrencyRow>()
  let paidInvoiceEvents = 0
  let otherTypeEvents = 0
  for (const event of monthEvents) {
    if (event.type !== REVENUE_EVENT_TYPE) {
      otherTypeEvents += 1
      continue
    }
    paidInvoiceEvents += 1
    if (event.amountCents === null || event.currency === null) continue
    const currency = event.currency
    const row = currencyTotals.get(currency) ?? {
      currency,
      amountCents: 0,
      events: 0,
    }
    row.amountCents += event.amountCents
    row.events += 1
    currencyTotals.set(currency, row)
  }

  const revenue: RevenueMetric = {
    monthStartUtc: monthStart,
    paidInvoiceEvents,
    byCurrency: [...currencyTotals.values()].sort((a, b) =>
      a.currency.localeCompare(b.currency)
    ),
    otherTypeEvents,
  }

  // --- Webhook health (last 7 days) --------------------------------------
  const recentEvents = billingEvents.filter((e) => e.createdAt >= sevenDaysAgo)
  let lastEventAt: Date | null = null
  for (const event of billingEvents) {
    if (!lastEventAt || event.createdAt > lastEventAt) lastEventAt = event.createdAt
  }

  const webhookHealth: WebhookHealthMetric = {
    eventsLast7d: recentEvents.length,
    distinctTypes: new Set(recentEvents.map((e) => e.type)).size,
    lastEventAt,
  }

  return { planDistribution, conversion, churn, revenue, webhookHealth }
}
