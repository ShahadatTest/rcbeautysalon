"use server"

// ============================================================
// E4-2b — ANALYTICS INTEGRATION SETTINGS (owner-supplied GA4)
//
// The platform never tracks anyone on the owner's behalf. The only
// thing stored here is the owner's OWN measurement ID; the public
// site layout injects the matching script ONLY for a PUBLISHED site
// (src/lib/analytics/measurement-id.ts · analyticsScriptIdFor).
// ============================================================

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

import { UnauthorizedError, requirePermissionOrg } from "@/lib/auth/guards"
import { parseMeasurementIdInput } from "@/lib/analytics/measurement-id"

export type AnalyticsIntegrationState = {
  ok: boolean
  /** Normalized stored value after a successful save (null = cleared). */
  value: string | null
  error: string | null
}

/** Current stored measurement ID for the session org (admin settings). */
export async function getAnalyticsIntegration(): Promise<{
  ok: boolean
  value: string | null
  error: string | null
}> {
  try {
    const { org } = await requirePermissionOrg("settings.manage")
    const config = await prisma.salonConfig.findUnique({
      where: { organizationId: org.id },
      select: { analyticsMeasurementId: true },
    })
    return { ok: true, value: config?.analyticsMeasurementId ?? null, error: null }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { ok: false, value: null, error: error.message }
    }
    console.error("Error loading analytics integration:", error)
    return { ok: false, value: null, error: "Failed to load." }
  }
}

/**
 * Save / clear the owner's GA4 measurement ID. React 19 `action={}`
 * pathway (F1 pattern): FormData in, plain state out.
 * Validation is strict — invalid input is never stored and never
 * silently dropped (the error comes back to the form).
 */
export async function updateAnalyticsIntegration(
  _prev: AnalyticsIntegrationState | null,
  formData: FormData
): Promise<AnalyticsIntegrationState> {
  try {
    const { org } = await requirePermissionOrg("settings.manage")

    const raw = formData.get("measurementId")
    const parsed = parseMeasurementIdInput(
      typeof raw === "string" ? raw : null
    )
    if (!parsed.ok) {
      return {
        ok: false,
        value: null,
        error: "invalid",
      }
    }

    await prisma.salonConfig.upsert({
      where: { organizationId: org.id },
      update: { analyticsMeasurementId: parsed.value },
      create: {
        organizationId: org.id,
        name: org.name,
        analyticsMeasurementId: parsed.value,
      },
    })

    // The published public site reads this value in its layout —
    // revalidate so the script appears/disappears immediately.
    revalidatePath("/dashboard/settings")
    revalidatePath("/", "layout")

    return { ok: true, value: parsed.value, error: null }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { ok: false, value: null, error: error.message }
    }
    console.error("Error updating analytics integration:", error)
    return { ok: false, value: null, error: "failed" }
  }
}
