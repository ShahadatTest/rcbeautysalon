"use server"

import { prisma } from "@/lib/prisma"
import { requireAdminOrg } from "@/lib/tenant"
import { getProfile } from "@/lib/profiles/registry"
import { EXTENSIONS } from "@/lib/profiles/extensions"
import type { CapabilityState } from "@/lib/profiles/types"

export interface CapabilityInfo {
  key: string
  state: CapabilityState
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
}

/**
 * Reads the resolved activity profile of the admin's org plus the
 * materialized per-tenant definitions (forms, workflows) from the DB.
 */
export async function getOrgProfileOverview(): Promise<OrgProfileOverview | { error: string }> {
  try {
    const { org } = await requireAdminOrg()
    const profile = getProfile(org.vertical)

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
        (key) => ({ key, state: profile.capabilities[key] })
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
    }
  } catch (error) {
    console.error("getOrgProfileOverview error:", error)
    return { error: "Profila ni bilo mogoče naložiti." }
  }
}
