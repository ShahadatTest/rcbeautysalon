"use server"

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { parseSetupChecklistUi } from "@/lib/profiles/setup-checklist"

// ============================================================
// ACTIVATION CHECKLIST ("vodena namestitev") — owner UI actions.
//
// Only UI preferences persist here (Organization.setupChecklist):
//   • dismissedAt  — owner hid the card (compact activity row)
//   • celebratedAt — the completion celebration already fired once
// Step completion is derived from real business data on every
// dashboard render (src/lib/profiles/setup-checklist.ts) — the
// checklist can never drift out of sync with reality.
// ============================================================

export interface ChecklistUiStateResult {
  success: boolean
  error?: string
}

async function updateChecklistUi(
  orgId: string,
  patch: (ui: ReturnType<typeof parseSetupChecklistUi>) => Record<string, unknown>,
): Promise<ChecklistUiStateResult> {
  const { org } = await requirePermissionOrg("settings.manage")
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      setupChecklist: patch(parseSetupChecklistUi(org.setupChecklist)) as Prisma.InputJsonValue,
    },
  })
  return { success: true }
}

function failure(scope: string, error: unknown, message: string): ChecklistUiStateResult {
  console.error(`${scope} failed:`, error)
  return { success: false, error: message }
}

/** Hide the persistent checklist card (collapses to the compact activity row). */
export async function dismissSetupChecklist(): Promise<ChecklistUiStateResult> {
  try {
    const { org } = await requirePermissionOrg("settings.manage")
    await updateChecklistUi(org.id, (ui) => ({ ...ui, dismissedAt: new Date().toISOString() }))
    return { success: true }
  } catch (error) {
    return failure("dismissSetupChecklist", error, "Skritje ni uspelo. Poskusite znova.")
  }
}

/** Bring the persistent checklist card back. */
export async function reopenSetupChecklist(): Promise<ChecklistUiStateResult> {
  try {
    const { org } = await requirePermissionOrg("settings.manage")
    await updateChecklistUi(org.id, (ui) => ({ ...ui, dismissedAt: null }))
    return { success: true }
  } catch (error) {
    return failure("reopenSetupChecklist", error, "Odpiranje ni uspelo. Poskusite znova.")
  }
}

/**
 * Persist that the completion celebration already fired — the confetti
 * greets the owner exactly ONCE, never on every dashboard visit.
 */
export async function markSetupCelebrated(): Promise<ChecklistUiStateResult> {
  try {
    const { org } = await requirePermissionOrg("settings.manage")
    await updateChecklistUi(org.id, (ui) => ({ ...ui, celebratedAt: new Date().toISOString() }))
    return { success: true }
  } catch (error) {
    return failure("markSetupCelebrated", error, "Shranjevanje ni uspelo. Poskusite znova.")
  }
}
