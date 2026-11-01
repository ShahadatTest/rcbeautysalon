import "server-only"

// ============================================================
// PLATFORM OVERVIEW READ MODELS (EPIC #3 E3-5; analytics E4-1)
// Server-only read layer behind the operator console: tenant
// roster with subscription/publication/usage snapshots and the
// append-only audit trail. Read-only — mutations live exclusively
// in src/app/actions/platform.ts.
// ============================================================

import { prisma } from "@/lib/prisma"
import { getPlan, isPlanId } from "@/lib/plans/registry"
import type { PlanLimits } from "@/lib/plans/types"
import { monthStartUtc } from "@/lib/plans/types"
import {
  computePlatformAnalytics,
  type AnalyticsEventInput,
  type PlatformAnalytics,
} from "@/lib/platform/analytics"

export interface PlatformTenantRow {
  id: string
  slug: string
  name: string
  vertical: string
  plan: string
  status: string
  publishState: string
  suspendedAt: Date | null
  suspendedReason: string | null
  createdAt: Date
  userCount: number
  serviceCount: number
  productCount: number
  staffCount: number
  subscriptionStatus: string | null
  subscriptionPlan: string | null
  subscriptionPeriodEnd: Date | null
}

export interface PlatformTotals {
  tenants: number
  active: number
  suspended: number
  published: number
  drafts: number
  subscriptionsActive: number
  subscriptionsPastDue: number
}

export interface PlatformAuditRow {
  id: string
  organizationId: string
  organizationName: string
  organizationSlug: string
  actorEmail: string
  action: string
  reason: string | null
  createdAt: Date
}

export interface PlatformOverview {
  billingConfigured: boolean
  totals: PlatformTotals
  /** Derived-only analytics (E4-1) — no counters are written anywhere. */
  analytics: PlatformAnalytics
  tenants: PlatformTenantRow[]
  recentAudit: PlatformAuditRow[]
}

export interface PlatformBillingHistoryRow {
  id: string
  type: string
  amountCents: number | null
  currency: string | null
  plan: string | null
  stripeEventId: string
  createdAt: Date
}

export interface PlatformTenantUserRow {
  id: string
  name: string | null
  email: string
  role: string
  createdAt: Date
}

export interface PlatformTenantDetail {
  tenant: PlatformTenantRow
  suspendedAt: Date | null
  suspendedReason: string | null
  users: PlatformTenantUserRow[]
  planLabel: string
  planLimits: PlanLimits | null
  publishState: string
  publishedAt: Date | null
  contentVersion: number
  publishedContentVersion: number | null
  subscription: {
    status: string
    plan: string
    currentPeriodStart: Date | null
    currentPeriodEnd: Date | null
    cancelAtPeriodEnd: boolean
    pendingPlanId: string | null
    pendingAt: Date | null
    stripeCustomerId: string | null
    stripeSubscriptionId: string | null
  } | null
  billingHistory: PlatformBillingHistoryRow[]
  auditTrail: PlatformAuditRow[]
}

/** Map a plan string to its registry limits (null when unknown). */
function planLimitsFor(plan: string): PlanLimits | null {
  if (!isPlanId(plan)) return null
  return getPlan(plan).limits
}

export async function loadPlatformOverview(
  options: { q?: string; status?: string } = {}
): Promise<PlatformOverview> {
  const where = (() => {
    const q = options.q?.trim()
    const status = options.status?.trim().toUpperCase()
    const conditions: Record<string, unknown>[] = []
    if (q) {
      conditions.push({
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { slug: { contains: q, mode: "insensitive" as const } },
        ],
      })
    }
    if (status === "ACTIVE" || status === "SUSPENDED") {
      conditions.push({ status })
    }
    if (conditions.length === 0) return undefined
    return conditions.length === 1 ? conditions[0] : { AND: conditions }
  })()

  const [orgs, recentAuditRaw, subscriptionCounts, billingEventRaw] = await Promise.all([
    prisma.organization.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { users: true, services: true, products: true, staff: true } },
        platformSubscription: {
          select: { status: true, plan: true, currentPeriodEnd: true },
        },
      },
    }),
    prisma.platformAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { organization: { select: { id: true, name: true, slug: true } } },
    }),
    prisma.platformSubscription.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    // E4-1 analytics raw rows: the pure function filters each metric to
    // its own window, so fetch the union window (earlier of month start
    // / 7 days ago) once.
    prisma.platformBillingEvent.findMany({
      where: {
        createdAt: {
          gte: new Date(
            Math.min(
              monthStartUtc().getTime(),
              Date.now() - 7 * 24 * 60 * 60 * 1000
            )
          ),
        },
      },
      select: { type: true, amountCents: true, currency: true, createdAt: true },
    }),
  ])

  const countByStatus = new Map(subscriptionCounts.map((row) => [row.status, row._count._all]))

  const tenants: PlatformTenantRow[] = orgs.map((org) => ({
    id: org.id,
    slug: org.slug,
    name: org.name,
    vertical: org.vertical,
    plan: org.plan,
    status: org.status,
    publishState: org.publishState,
    suspendedAt: org.suspendedAt,
    suspendedReason: org.suspendedReason,
    createdAt: org.createdAt,
    userCount: org._count.users,
    serviceCount: org._count.services,
    productCount: org._count.products,
    staffCount: org._count.staff,
    subscriptionStatus: org.platformSubscription?.status ?? null,
    subscriptionPlan: org.platformSubscription?.plan ?? null,
    subscriptionPeriodEnd: org.platformSubscription?.currentPeriodEnd ?? null,
  }))

  const totals: PlatformTotals = {
    tenants: tenants.length,
    active: tenants.filter((t) => t.status === "ACTIVE").length,
    suspended: tenants.filter((t) => t.status === "SUSPENDED").length,
    published: tenants.filter((t) => t.publishState === "PUBLISHED").length,
    drafts: tenants.filter((t) => t.publishState !== "PUBLISHED").length,
    subscriptionsActive: (countByStatus.get("ACTIVE") ?? 0) + (countByStatus.get("TRIALING") ?? 0),
    subscriptionsPastDue: countByStatus.get("PAST_DUE") ?? 0,
  }

  const recentAudit: PlatformAuditRow[] = recentAuditRaw.map((row) => ({
    id: row.id,
    organizationId: row.organizationId,
    organizationName: row.organization.name,
    organizationSlug: row.organization.slug,
    actorEmail: row.actorEmail,
    action: row.action,
    reason: row.reason,
    createdAt: row.createdAt,
  }))

  const analyticsEvents: AnalyticsEventInput[] = billingEventRaw.map((row) => ({
    type: row.type,
    amountCents: row.amountCents,
    currency: row.currency,
    createdAt: row.createdAt,
  }))

  const analytics = computePlatformAnalytics({
    tenants,
    billingEvents: analyticsEvents,
    now: new Date(),
  })

  return {
    billingConfigured: Boolean(process.env.PLATFORM_STRIPE_SECRET_KEY),
    totals,
    analytics,
    tenants,
    recentAudit,
  }
}

export async function loadTenantDetail(orgId: string): Promise<PlatformTenantDetail | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      _count: { select: { users: true, services: true, products: true, staff: true } },
      platformSubscription: true,
      salonConfig: { select: { publishedContentVersion: true } },
    },
  })
  if (!org) return null

  const [users, billingEvents, auditRaw] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    }),
    prisma.platformBillingEvent.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        type: true,
        amountCents: true,
        currency: true,
        plan: true,
        stripeEventId: true,
        createdAt: true,
      },
    }),
    prisma.platformAuditLog.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { organization: { select: { id: true, name: true, slug: true } } },
    }),
  ])

  const sub = org.platformSubscription

  return {
    tenant: {
      id: org.id,
      slug: org.slug,
      name: org.name,
      vertical: org.vertical,
      plan: org.plan,
      status: org.status,
      publishState: org.publishState,
      suspendedAt: org.suspendedAt,
      suspendedReason: org.suspendedReason,
      createdAt: org.createdAt,
      userCount: org._count.users,
      serviceCount: org._count.services,
      productCount: org._count.products,
      staffCount: org._count.staff,
      subscriptionStatus: sub?.status ?? null,
      subscriptionPlan: sub?.plan ?? null,
      subscriptionPeriodEnd: sub?.currentPeriodEnd ?? null,
    },
    suspendedAt: org.suspendedAt,
    suspendedReason: org.suspendedReason,
    users: users,
    planLabel: isPlanId(org.plan) ? getPlan(org.plan).label : org.plan,
    planLimits: planLimitsFor(org.plan),
    publishState: org.publishState,
    publishedAt: org.publishedAt,
    contentVersion: org.contentVersion,
    publishedContentVersion: org.salonConfig?.publishedContentVersion ?? null,
    subscription: sub
      ? {
          status: sub.status,
          plan: sub.plan,
          currentPeriodStart: sub.currentPeriodStart,
          currentPeriodEnd: sub.currentPeriodEnd,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          pendingPlanId: sub.pendingPlanId,
          pendingAt: sub.pendingAt,
          stripeCustomerId: sub.stripeCustomerId,
          stripeSubscriptionId: sub.stripeSubscriptionId,
        }
      : null,
    billingHistory: billingEvents,
    auditTrail: auditRaw.map((row) => ({
      id: row.id,
      organizationId: row.organizationId,
      organizationName: row.organization.name,
      organizationSlug: row.organization.slug,
      actorEmail: row.actorEmail,
      action: row.action,
      reason: row.reason,
      createdAt: row.createdAt,
    })),
  }
}
