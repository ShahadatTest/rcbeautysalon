// ============================================================
// PLAN RESOLVER (EPIC #3 E3-3 — server-only)
// Resolves the tenant's plan + real usage counts from existing
// tables (derived counters — no double bookkeeping, per PLAN.md
// decision log). React cache() keeps one resolution per request.
//
// SERVER-ONLY: imports prisma. Never import from client code.
// ============================================================

import { cache } from "react"
import { prisma } from "@/lib/prisma"
import { getSessionOrg } from "@/lib/tenant"
import { getPlan } from "./registry"
import {
  checkPlanLimit,
  monthStartUtc,
  type LimitCheck,
  type LimitResource,
  type PlanDefinition,
  type PlanId,
} from "./types"

export interface PlanUsage {
  services: number
  products: number
  staff: number
  /** Connected custom hostnames (E3-6) — derived from CustomDomain rows. */
  customDomains: number
  /** Orders created this UTC month (E3-7) — derived from Order rows. */
  orders: number
  /** Org-scoped media bytes (E3-7) — derived from the Media table. */
  storageBytes: number
}

export interface PlanContext {
  orgId: string
  orgSlug: string
  orgName: string
  planId: PlanId
  plan: PlanDefinition
  usage: PlanUsage
}

const usageCounters = {
  services: (orgId: string) => prisma.service.count({ where: { organizationId: orgId } }),
  products: (orgId: string) => prisma.product.count({ where: { organizationId: orgId } }),
  staff: (orgId: string) => prisma.staff.count({ where: { organizationId: orgId } }),
  customDomains: (orgId: string) => prisma.customDomain.count({ where: { organizationId: orgId } }),
  // Monthly (UTC month) — derived from Order.createdAt, no double bookkeeping.
  orders: (orgId: string) =>
    prisma.order.count({ where: { organizationId: orgId, createdAt: { gte: monthStartUtc() } } }),
  // Org-scoped storage (E3-7): Media rows owned by the tenant. Rows with
  // organizationId null (anonymous avatars, legacy) belong to no tenant.
  storageBytes: async (orgId: string) => {
    const agg = await prisma.media.aggregate({
      where: { organizationId: orgId },
      _sum: { size: true },
    })
    return agg._sum.size ?? 0
  },
} as const

/** Current plan + derived usage for the signed-in admin's org. */
export const getSessionPlanContext = cache(async (): Promise<PlanContext | null> => {
  const org = await getSessionOrg()
  if (!org) return null
  return resolvePlanContext(org.id, org.slug, org.name, org.plan)
})

/** Plan context for an already-loaded org (avoids a second session lookup). */
export async function resolvePlanContext(
  orgId: string,
  orgSlug: string,
  orgName: string,
  planValue: string | null | undefined
): Promise<PlanContext> {
  const plan = getPlan(planValue)
  const [services, products, staff, customDomains, orders, storageBytes] = await Promise.all([
    usageCounters.services(orgId),
    usageCounters.products(orgId),
    usageCounters.staff(orgId),
    usageCounters.customDomains(orgId),
    usageCounters.orders(orgId),
    usageCounters.storageBytes(orgId),
  ])
  return {
    orgId,
    orgSlug,
    orgName,
    planId: plan.id,
    plan,
    usage: { services, products, staff, customDomains, orders, storageBytes },
  }
}

export type PlanLimitEnforcement =
  | { ok: true }
  | { ok: false; code: "LIMIT_REACHED"; message: string; messageEn: string; limit: number }

/**
 * Current org-scoped storage usage in bytes (E3-7). Used by the
 * DB-backed upload route to evaluate checkStorageLimit against the
 * would-be size (existing bytes + incoming file).
 */
export function getOrgStorageBytes(orgId: string): Promise<number> {
  return usageCounters.storageBytes(orgId)
}

/**
 * Server-side enforcement for content-creating actions. Call AFTER
 * requireAdminOrg() and BEFORE the prisma create. Returns a
 * locale-picked, action-oriented error message when the tenant's plan
 * blocks the new record (HTTP-429 semantics; server actions surface it
 * as `{ success: false, error, code: "LIMIT_REACHED" }`).
 *
 * Downgrade tolerance: when usage already exceeds the limit (e.g. after
 * a plan change), creation stays blocked until usage drops below the
 * limit — existing content is never touched.
 */
export async function enforcePlanLimit(
  org: { id: string; plan: string | null | undefined },
  resource: Exclude<LimitResource, "storageMb">,
  locale: "sl" | "en" = "sl"
): Promise<PlanLimitEnforcement> {
  const plan = getPlan(org.plan)
  const current = await usageCounters[resource](org.id)
  const check: LimitCheck = checkPlanLimit(plan, resource, current)
  if (check.ok) return { ok: true }
  return {
    ok: false,
    code: "LIMIT_REACHED",
    limit: check.limit,
    message: locale === "en" ? check.messageEn : check.message,
    messageEn: check.messageEn,
  }
}
