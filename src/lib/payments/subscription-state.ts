// ============================================================
// SUBSCRIPTION STATE LOGIC (EPIC #3 E3-4 — PURE, no DB, no I/O)
// Everything the platform webhook applies to local state goes
// through these pure functions, so the money-flow rules are
// unit-testable in isolation (tests/payments/subscription-state).
//
// ENTITLEMENT RULE (the heart of E3-4): Organization.plan follows
// the subscription ONLY from provider events —
//   ACTIVE / TRIALING            → the subscription's plan
//   CANCELED / UNPAID            → back to free (terminal states)
//   PAST_DUE                     → NO change (grace; E3-7 policy)
//   INCOMPLETE                   → NO change (transient checkout)
// ============================================================

import { isPlanId, type PlanId } from "@/lib/plans/registry"
import type { SubscriptionStatus } from "./types"

// ------------------------------------------------------------
// Event classification
// ------------------------------------------------------------

/** Provider event types the platform webhook actually handles. */
export type HandledPlatformEventType =
  | "checkout.session.completed"
  | "customer.subscription.created"
  | "customer.subscription.updated"
  | "customer.subscription.deleted"
  | "invoice.paid"
  | "invoice.payment_failed"

const HANDLED_EVENT_TYPES: readonly HandledPlatformEventType[] = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]

export function isHandledPlatformEventType(type: string): type is HandledPlatformEventType {
  return (HANDLED_EVENT_TYPES as readonly string[]).includes(type)
}

// ------------------------------------------------------------
// Idempotency (pure mirror of the DB unique stripeEventId)
// ------------------------------------------------------------

/**
 * Pure replay guard. The webhook route additionally enforces the
 * same rule with a DB unique constraint on PlatformBillingEvent
 * .stripeEventId — this function exists so the decision is
 * unit-testable and stays consistent with the schema.
 */
export function isEventAlreadyProcessed(seenEventIds: ReadonlySet<string>, eventId: string): boolean {
  return seenEventIds.has(eventId)
}

// ------------------------------------------------------------
// Stripe subscription snapshot → local state
// ------------------------------------------------------------

/**
 * Shape of the Stripe subscription object fields we consume
 * (structural — keeps tests independent of the Stripe SDK types).
 */
export interface StripeSubscriptionLike {
  id?: string
  status?: string
  customer?: string | { id?: string } | null
  cancel_at_period_end?: boolean
  canceled_at?: number | null
  current_period_start?: number | null
  current_period_end?: number | null
  metadata?: Record<string, string> | null
  items?: {
    data?: Array<{
      price?: { id?: string | null } | null
    }> | null
  } | null
}

/** Map a Stripe subscription.status to the normalized local status. Unknown → INCOMPLETE (fail-closed). */
export function mapStripeSubscriptionStatus(status: string | null | undefined): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "TRIALING"
    case "active":
      return "ACTIVE"
    case "past_due":
      return "PAST_DUE"
    case "canceled":
    case "incomplete_expired":
      return "CANCELED"
    case "unpaid":
      return "UNPAID"
    // "incomplete", "paused" and anything unknown are transient/unknown —
    // never allowed to look paid.
    default:
      return "INCOMPLETE"
  }
}

/** org/plan metadata attached at checkout creation (subscription_data.metadata). */
export function subscriptionMetadata(sub: StripeSubscriptionLike): {
  orgId: string | null
  planId: PlanId | null
} {
  const orgId = sub.metadata?.orgId || null
  const rawPlan = sub.metadata?.planId || null
  return { orgId, planId: rawPlan && isPlanId(rawPlan) ? rawPlan : null }
}

/** Persisted snapshot of a Stripe subscription payload. */
export interface SubscriptionSnapshot {
  status: SubscriptionStatus
  planId: PlanId
  stripeSubscriptionId: string | null
  stripeCustomerId: string | null
  stripePriceId: string | null
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  canceledAt: Date | null
}

/**
 * Build the persisted snapshot. Plan resolution order (most
 * specific first): subscription metadata.planId → price-id env
 * mapping (PLATFORM_STRIPE_PRICE_<PLAN>) → free (fail-closed).
 */
export function snapshotFromStripeSubscription(
  sub: StripeSubscriptionLike,
  priceEnv: Readonly<Record<string, string | undefined>> = process.env
): SubscriptionSnapshot {
  const { planId: metaPlan } = subscriptionMetadata(sub)
  const priceId = sub.items?.data?.[0]?.price?.id ?? null
  const pricePlan = priceId ? planIdForPlatformPrice(priceId, priceEnv) : null

  return {
    status: mapStripeSubscriptionStatus(sub.status),
    planId: metaPlan ?? pricePlan ?? "free",
    stripeSubscriptionId: sub.id ?? null,
    stripeCustomerId:
      typeof sub.customer === "string" ? sub.customer : (sub.customer?.id ?? null),
    stripePriceId: priceId,
    currentPeriodStart: tsToDate(sub.current_period_start),
    currentPeriodEnd: tsToDate(sub.current_period_end),
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    canceledAt: tsToDate(sub.canceled_at),
  }
}

function tsToDate(ts: number | null | undefined): Date | null {
  return typeof ts === "number" && Number.isFinite(ts) ? new Date(ts * 1000) : null
}

// ------------------------------------------------------------
// Price ↔ plan mapping (env-driven, no hardcoded provider ids)
// ------------------------------------------------------------

const ALL_PLAN_IDS: readonly PlanId[] = ["free", "pro", "scale"]

/** Env var name holding the platform price id for a plan. */
export function platformPriceEnvName(planId: PlanId): string {
  return `PLATFORM_STRIPE_PRICE_${planId.toUpperCase()}`
}

/** Price id configured for a plan (null for free — it is not purchasable). */
export function platformPriceIdForPlan(
  planId: PlanId,
  priceEnv: Readonly<Record<string, string | undefined>> = process.env
): string | null {
  if (planId === "free") return null
  return priceEnv[platformPriceEnvName(planId)] || null
}

/** Reverse mapping: which plan a platform price id belongs to (null = unknown price). */
export function planIdForPlatformPrice(
  priceId: string,
  priceEnv: Readonly<Record<string, string | undefined>> = process.env
): PlanId | null {
  for (const planId of ALL_PLAN_IDS) {
    if (planId === "free") continue
    if (priceEnv[platformPriceEnvName(planId)] === priceId) return planId
  }
  return null
}

// ------------------------------------------------------------
// ENTITLEMENT RULE
// ------------------------------------------------------------

/**
 * Which plan the tenant's entitlements (Organization.plan) should
 * move to for this subscription state. Returns null when the state
 * must NOT change entitlements (transient checkout, past-due grace).
 *
 * Fail-closed by design: money states that are not positively
 * confirmed never escalate entitlements, and terminal non-paid
 * states always return to free.
 */
export function entitlementPlanFor(
  snapshot: Pick<SubscriptionSnapshot, "status" | "planId">
): PlanId | null {
  switch (snapshot.status) {
    case "ACTIVE":
    case "TRIALING":
      return snapshot.planId
    case "CANCELED":
    case "UNPAID":
      return "free"
    // INCOMPLETE: checkout in progress — transient, never downgrade
    // mid-flow. PAST_DUE: grace policy (documented in E3-7) — the
    // tenant keeps working; metering/warnings come later.
    default:
      return null
  }
}

/**
 * Guarded apply: compute the update payload for a local subscription
 * row, or null when nothing would change (natural idempotency — a
 * replayed event produces a no-op). Pure; the route wraps it in DB
 * calls.
 */
export function subscriptionUpdateFromSnapshot(
  current: {
    status: string
    plan: string
    currentPeriodStart: Date | null
    currentPeriodEnd: Date | null
    cancelAtPeriodEnd: boolean
  },
  snapshot: SubscriptionSnapshot
): {
  status: string
  plan: string
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
  canceledAt: Date | null
} | null {
  const unchanged =
    current.status === snapshot.status &&
    current.plan === snapshot.planId &&
    sameDate(current.currentPeriodStart, snapshot.currentPeriodStart) &&
    sameDate(current.currentPeriodEnd, snapshot.currentPeriodEnd) &&
    current.cancelAtPeriodEnd === snapshot.cancelAtPeriodEnd

  if (unchanged) return null
  return {
    status: snapshot.status,
    plan: snapshot.planId,
    currentPeriodStart: snapshot.currentPeriodStart,
    currentPeriodEnd: snapshot.currentPeriodEnd,
    cancelAtPeriodEnd: snapshot.cancelAtPeriodEnd,
    canceledAt: snapshot.canceledAt,
  }
}

function sameDate(a: Date | null, b: Date | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.getTime() === b.getTime()
}
