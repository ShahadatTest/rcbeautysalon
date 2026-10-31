"use server"

// ============================================================
// PLATFORM OPERATOR ACTIONS (EPIC #3 E3-5)
// The ONLY mutation surface for the operator console. Every
// action: (1) authorizes via the env allowlist guard, (2) runs
// the pure state machine, (3) writes the tenant state change and
// the append-only audit row in ONE transaction, (4) revalidates
// the affected surfaces. No silent double writes: suspending a
// suspended tenant or reactivating an active one is refused.
// ============================================================

import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin } from "@/lib/platform/guard"
import {
  PLATFORM_AUDIT_ACTIONS,
  suspensionTransition,
  validateSuspensionReason,
} from "@/lib/platform/access"
import { revalidatePath } from "next/cache"

export type PlatformActionResult =
  | { success: true }
  | {
      success: false
      error: string
      errorEn: string
      code:
        | "INVALID_REASON"
        | "INVALID_TRANSITION"
        | "NOT_FOUND"
    }

function revalidatePlatform(orgId: string) {
  revalidatePath("/platform")
  revalidatePath(`/platform/tenants/${orgId}`)
  // Public site + preview serve maintenance pages for SUSPENDED
  // tenants — bust their caches immediately.
  revalidatePath("/", "layout")
}

export async function suspendTenant(
  orgId: string,
  reason: string
): Promise<PlatformActionResult> {
  const session = await requirePlatformAdmin()
  const actorEmail = session.user.email ?? ""

  const reasonCheck = validateSuspensionReason(reason)
  if (!reasonCheck.ok) {
    return {
      success: false,
      code: "INVALID_REASON",
      error: "Razlog je obvezen (vsaj 3 znaki, največ 500).",
      errorEn: "A reason is required (3–500 characters).",
    }
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, status: true },
  })
  if (!org) {
    return {
      success: false,
      code: "NOT_FOUND",
      error: "Najemnik ne obstaja.",
      errorEn: "Tenant not found.",
    }
  }

  const transition = suspensionTransition(org.status, "SUSPEND")
  if (!transition.ok) {
    return {
      success: false,
      code: "INVALID_TRANSITION",
      error: "Najemnik je že ustavljen.",
      errorEn: "The tenant is already suspended.",
    }
  }

  await prisma.$transaction([
    prisma.organization.update({
      where: { id: org.id },
      data: {
        status: transition.next,
        suspendedAt: new Date(),
        suspendedReason: reasonCheck.value,
      },
    }),
    prisma.platformAuditLog.create({
      data: {
        organizationId: org.id,
        actorEmail,
        action: PLATFORM_AUDIT_ACTIONS[0], // TENANT_SUSPENDED
        reason: reasonCheck.value,
      },
    }),
  ])

  revalidatePlatform(org.id)
  return { success: true }
}

export async function reactivateTenant(
  orgId: string,
  reason?: string
): Promise<PlatformActionResult> {
  const session = await requirePlatformAdmin()
  const actorEmail = session.user.email ?? ""

  // Optional but bounded when supplied.
  let storedReason: string | null = null
  if (reason && reason.trim().length > 0) {
    const reasonCheck = validateSuspensionReason(reason)
    if (!reasonCheck.ok) {
      return {
        success: false,
        code: "INVALID_REASON",
        error: "Razlog naj ima med 3 in 500 znakov.",
        errorEn: "The reason should be 3–500 characters.",
      }
    }
    storedReason = reasonCheck.value
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, status: true },
  })
  if (!org) {
    return {
      success: false,
      code: "NOT_FOUND",
      error: "Najemnik ne obstaja.",
      errorEn: "Tenant not found.",
    }
  }

  const transition = suspensionTransition(org.status, "REACTIVATE")
  if (!transition.ok) {
    return {
      success: false,
      code: "INVALID_TRANSITION",
      error: "Najemnik ni ustavljen.",
      errorEn: "The tenant is not suspended.",
    }
  }

  await prisma.$transaction([
    prisma.organization.update({
      where: { id: org.id },
      data: {
        status: transition.next,
        suspendedAt: null,
        suspendedReason: null,
      },
    }),
    prisma.platformAuditLog.create({
      data: {
        organizationId: org.id,
        actorEmail,
        action: PLATFORM_AUDIT_ACTIONS[1], // TENANT_REACTIVATED
        reason: storedReason,
        metadata: { clearedReason: true },
      },
    }),
  ])

  revalidatePlatform(org.id)
  return { success: true }
}
