"use server"

// ============================================================
// PLAN ACTIONS (EPIC #3 E3-3 — no payments; payment layer in E3-4)
// changePlan is REAL: it updates Organization.plan and the new
// entitlements apply immediately. In E3-3 the switch is free — the
// UI states this explicitly (no fake checkout, no fake money).
// When E3-4 lands, this action gains the payment gate.
// ============================================================

import { prisma } from "@/lib/prisma"
import { requireAdminOrg } from "@/lib/tenant"
import { getPlan, isPlanId } from "@/lib/plans/registry"
import { getSessionPlanContext, type PlanContext } from "@/lib/plans/resolve"
import { revalidatePath } from "next/cache"

/** Fresh plan + usage context for the Settings card (client refresh). */
export async function getPlanContext(): Promise<PlanContext | null> {
  return getSessionPlanContext()
}

export type ChangePlanResult =
  | { success: true; planId: string }
  | { success: false; error: string; errorEn: string; code: "INVALID_PLAN" }

/**
 * Switch the tenant plan. Downgrade below current usage is allowed by
 * design (EPIC #3: a downgrade must never delete tenant data): creation
 * stays blocked until usage drops under the limit, existing content
 * keeps working.
 */
export async function changePlan(planId: string): Promise<ChangePlanResult> {
  const { org } = await requireAdminOrg()

  if (!isPlanId(planId)) {
    return {
      success: false,
      error: "Neznan paket.",
      errorEn: "Unknown plan.",
      code: "INVALID_PLAN",
    }
  }

  await prisma.organization.update({
    where: { id: org.id },
    data: { plan: planId },
  })

  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard")

  const plan = getPlan(planId)
  return { success: true, planId: plan.id }
}
