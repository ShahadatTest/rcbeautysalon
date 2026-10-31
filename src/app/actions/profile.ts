"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { requireAdminOrg } from "@/lib/tenant"
import { getProfile } from "@/lib/profiles/registry"
import { EXTENSIONS } from "@/lib/profiles/extensions"
import {
  applyOverrides,
  OVERRIDES_VERSION,
  parseOverrides,
} from "@/lib/profiles/overrides"
import type {
  CapabilityKey,
  CapabilityState,
  DashboardWidgetKey,
} from "@/lib/profiles/types"

export interface CapabilityInfo {
  key: string
  state: CapabilityState
  /** True when this capability's state comes from an owner override. */
  overridden: boolean
}

export interface FormDefinitionInfo {
  key: string
  name: string
  version: number
  isActive: boolean
  fieldCount: number
}

export interface WorkflowStageInfo {
  key: string
  name: string
  order: number
  slaHours: number | null
  isFinal: boolean
}

export interface WorkflowDefinitionInfo {
  key: string
  name: string
  entity: string
  version: number
  isActive: boolean
  stages: WorkflowStageInfo[]
}

export interface ExtensionInfo {
  id: string
  name: string
  description: string
  entities: string[]
}

export interface OrgProfileOverview {
  profileId: string
  profileLabel: string
  profileDescription: string
  /** Version of the shared profile definition. */
  profileVersion: number
  /** Version string stored on the org when definitions were materialized. */
  materializedVersion: string | null
  capabilities: CapabilityInfo[]
  forms: FormDefinitionInfo[]
  workflows: WorkflowDefinitionInfo[]
  extensions: ExtensionInfo[]
  /** True when owner overrides are active on this org. */
  isOverridden: boolean
  /** Owner-adjustable (optional) capability keys. */
  adjustableCapabilities: string[]
  /** Currently selected dashboard widgets (effective). */
  dashboardWidgets: DashboardWidgetKey[]
}

/**
 * Reads the resolved activity profile of the admin's org plus the
 * materialized per-tenant definitions (forms, workflows) from the DB.
 */
export async function getOrgProfileOverview(): Promise<OrgProfileOverview | { error: string }> {
  try {
    const { org } = await requireAdminOrg()
    const baseProfile = getProfile(org.vertical)
    const overrides = parseOverrides(org.profileOverrides)
    const profile = applyOverrides(baseProfile, overrides)

    const [formDefs, workflowDefs] = await Promise.all([
      prisma.formDefinition.findMany({
        where: { organizationId: org.id },
        orderBy: { createdAt: "asc" },
        select: { key: true, name: true, version: true, isActive: true, fields: true },
      }),
      prisma.workflowDefinition.findMany({
        where: { organizationId: org.id },
        orderBy: { createdAt: "asc" },
        include: {
          stages: { orderBy: { order: "asc" } },
        },
      }),
    ])

    return {
      profileId: profile.id,
      profileLabel: profile.label,
      profileDescription: profile.description,
      profileVersion: profile.version,
      materializedVersion: org.profileVersion ?? null,
      capabilities: (Object.keys(profile.capabilities) as (keyof typeof profile.capabilities)[]).map(
        (key) => ({
          key,
          state: profile.capabilities[key],
          overridden: overrides?.capabilityStates?.[key] !== undefined,
        })
      ),
      forms: formDefs.map((f) => ({
        key: f.key,
        name: f.name,
        version: f.version,
        isActive: f.isActive,
        fieldCount: Array.isArray(f.fields) ? (f.fields as unknown[]).length : 0,
      })),
      workflows: workflowDefs.map((w) => ({
        key: w.key,
        name: w.name,
        entity: w.entity,
        version: w.version,
        isActive: w.isActive,
        stages: w.stages.map((s) => ({
          key: s.key,
          name: s.name,
          order: s.order,
          slaHours: s.slaHours,
          isFinal: s.isFinal,
        })),
      })),
      extensions: profile.extensions
        .map((id) => EXTENSIONS[id])
        .filter((e): e is NonNullable<typeof e> => !!e)
        .map((e) => ({
          id: e.id,
          name: e.name,
          description: e.description,
          entities: e.entities.map((ent) => ent.name),
        })),
      isOverridden: overrides !== null,
      adjustableCapabilities: (
        Object.keys(baseProfile.capabilities) as CapabilityKey[]
      ).filter((k) => baseProfile.capabilities[k] === "optional"),
      dashboardWidgets: profile.dashboardWidgets,
    }
  } catch (error) {
    console.error("getOrgProfileOverview error:", error)
    return { error: "Profila ni bilo mogoče naložiti." }
  }
}

// ------------------------------------------------------------
// Owner overrides (Phase 5) — modules on/off + dashboard widgets
// ------------------------------------------------------------

const updateOverridesSchema = z.object({
  capabilityStates: z
    .record(z.string(), z.enum(["optional", "disabled"]))
    .optional(),
  dashboardWidgets: z.array(z.string()).max(20).optional(),
})

export interface UpdateOverridesResult {
  ok: boolean
  error?: string
}

/**
 * Update the org's owner overrides (Phase 5).
 * Server-side safety rules mirror applyOverrides():
 *   • only OPTIONAL capabilities may be changed (required/disabled are
 *     protected — the client can never disable a required module);
 *   • dashboard widgets must be known widget keys.
 * The overrides document is versioned and never mutates the shared profile.
 */
export async function updateOrgOverrides(
  input: z.input<typeof updateOverridesSchema>
): Promise<UpdateOverridesResult> {
  try {
    const { org } = await requireAdminOrg()
    const parsed = updateOverridesSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: "INVALID" }

    const baseProfile = getProfile(org.vertical)

    // Capability validation against the shared profile.
    const capabilityStates: Partial<Record<CapabilityKey, CapabilityState>> = {}
    if (parsed.data.capabilityStates) {
      for (const [key, state] of Object.entries(parsed.data.capabilityStates)) {
        const cap = key as CapabilityKey
        if (!(cap in baseProfile.capabilities)) return { ok: false, error: "INVALID_CAPABILITY" }
        if (baseProfile.capabilities[cap] !== "optional") {
          return { ok: false, error: "CAPABILITY_NOT_OPTIONAL" }
        }
        capabilityStates[cap] = state
      }
    }

    // Widget validation against the known widget universe.
    let dashboardWidgets: DashboardWidgetKey[] | undefined
    if (parsed.data.dashboardWidgets) {
      const known = new Set<string>([
        "todayAppointments", "revenue", "customers", "topServices",
        "recentOrders", "lowStock", "activeOrders", "deadlines",
        "pendingApprovals", "readyForDelivery",
      ])
      for (const w of parsed.data.dashboardWidgets) {
        if (!known.has(w)) return { ok: false, error: "INVALID_WIDGET" }
      }
      dashboardWidgets = Array.from(new Set(parsed.data.dashboardWidgets)) as DashboardWidgetKey[]
    }

    const nextOverrides = {
      v: OVERRIDES_VERSION,
      ...(Object.keys(capabilityStates).length > 0 ? { capabilityStates } : {}),
      ...(dashboardWidgets ? { dashboardWidgets } : {}),
    }

    await prisma.organization.update({
      where: { id: org.id },
      data: { profileOverrides: nextOverrides },
    })

    revalidatePath("/dashboard", "layout")
    revalidatePath("/dashboard")
    return { ok: true }
  } catch (error) {
    console.error("updateOrgOverrides error:", error)
    return { ok: false, error: "GENERIC" }
  }
}

/** Remove all owner overrides — back to the shared profile defaults. */
export async function resetOrgOverrides(): Promise<UpdateOverridesResult> {
  try {
    const { org } = await requireAdminOrg()
    await prisma.organization.update({
      where: { id: org.id },
      data: { profileOverrides: Prisma.DbNull },
    })
    revalidatePath("/dashboard", "layout")
    revalidatePath("/dashboard")
    return { ok: true }
  } catch (error) {
    console.error("resetOrgOverrides error:", error)
    return { ok: false, error: "GENERIC" }
  }
}
