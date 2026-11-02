"use server"

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"

// ============================================================
// ACTIVATION CHECKLIST ("vodena namestitev") — owner UI actions.
//
// Only the DISMISS/REOPEN preference is persisted (Organization
// .setupChecklist). Step completion is derived from real business
// data on every dashboard render (src/lib/profiles/setup-checklist
// .ts) — the checklist can never drift out of sync with reality.
// ============================================================

export interface ChecklistUiStateResult {
  success: boolean
  error?: string
}

function parseChecklistUi(value: unknown): { dismissedAt?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const obj = value as Record<string, unknown>
  return typeof obj.dismissedAt === "string" ? { dismissedAt: obj.dismissedAt } : {}
}

/** Hide the persistent checklist card (collapses to the compact activity row). */
export async function dismissSetupChecklist(): Promise<ChecklistUiStateResult> {
  try {
    const { org } = await requirePermissionOrg("settings.manage")
    const ui = parseChecklistUi(org.setupChecklist)
    await prisma.organization.update({
      where: { id: org.id },
      data: { setupChecklist: { ...ui, dismissedAt: new Date().toISOString() } },
    })
    return { success: true }
  } catch (error) {
    console.error("dismissSetupChecklist failed:", error)
    return { success: false, error: "Skritje ni uspelo. Poskusite znova." }
  }
}

/** Bring the persistent checklist card back. */
export async function reopenSetupChecklist(): Promise<ChecklistUiStateResult> {
  try {
    const { org } = await requirePermissionOrg("settings.manage")
    const ui = parseChecklistUi(org.setupChecklist)
    await prisma.organization.update({
      where: { id: org.id },
      data: { setupChecklist: { ...ui, dismissedAt: null } },
    })
    return { success: true }
  } catch (error) {
    console.error("reopenSetupChecklist failed:", error)
    return { success: false, error: "Odpiranje ni uspelo. Poskusite znova." }
  }
}
