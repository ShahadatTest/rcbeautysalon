"use server"

// ============================================================
// CONFIG HISTORY ACTIONS (EPIC #2 E2-5, G5)
// Read (entities + entries) and revert for the tenant's
// configuration history. Append-only invariant: a revert applies
// a stored snapshot and appends a NEW version entry — history is
// never rewritten or deleted. All queries are strictly
// org-scoped via requireAdminOrg.
// ============================================================

import { Prisma } from "@prisma/client"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { requireAdminOrg } from "@/lib/tenant"
import { prisma } from "@/lib/prisma"
import {
  describeEntityKey,
  formSnapshot,
  isRevertable,
  overridesSnapshot,
  type ConfigSnapshot,
  workflowSnapshot,
} from "@/lib/config-history/logic"
import { recordConfigChange } from "@/lib/config-history/record"

export interface ConfigEntityInfo {
  entityKey: string
  kind: "overrides" | "form" | "workflow" | "unknown"
  /** Resolved display name (form/workflow name from the DB; null for overrides). */
  label: string | null
  latestVersion: number
  lastChangeAt: Date
}

export interface ConfigHistoryEntry {
  version: number
  action: string
  actorEmail: string
  summary: string | null
  previous: ConfigSnapshot
  next: ConfigSnapshot
  createdAt: Date
  revertable: boolean
}

export type ConfigEntitiesResult =
  | { ok: true; entities: ConfigEntityInfo[] }
  | { ok: false; error: string }

export type ConfigHistoryResult =
  | { ok: true; entries: ConfigHistoryEntry[]; latestVersion: number | null }
  | { ok: false; error: string }

/**
 * Distinct configuration entities with history for this tenant
 * (newest change first) — the entity picker of the history UI.
 */
export async function getConfigEntities(): Promise<ConfigEntitiesResult> {
  try {
    const { org } = await requireAdminOrg()
    // Config edits are rare (small dataset): one plain query, grouped in
    // memory to the latest row per entity.
    const rows = await prisma.configChangeLog.findMany({
      where: { organizationId: org.id },
      orderBy: [{ entityKey: "asc" }, { version: "desc" }],
    })

    const latest = new Map<string, (typeof rows)[number]>()
    for (const row of rows) {
      if (!latest.has(row.entityKey)) latest.set(row.entityKey, row)
    }

    // Resolve display labels for form/workflow entities.
    const labels = new Map<string, string>()
    for (const [entityKey] of latest) {
      const { kind, key } = describeEntityKey(entityKey)
      if (kind === "form" && key) {
        const def = await prisma.formDefinition.findFirst({
          where: { organizationId: org.id, key },
          select: { name: true },
        })
        if (def) labels.set(entityKey, def.name)
      } else if (kind === "workflow" && key) {
        const def = await prisma.workflowDefinition.findFirst({
          where: { organizationId: org.id, key },
          select: { name: true },
        })
        if (def) labels.set(entityKey, def.name)
      }
    }

    const entities: ConfigEntityInfo[] = Array.from(latest.entries())
      .map(([entityKey, row]) => ({
        entityKey,
        kind: describeEntityKey(entityKey).kind,
        label: labels.get(entityKey) ?? null,
        latestVersion: row.version,
        lastChangeAt: row.createdAt,
      }))
      .sort((a, b) => b.lastChangeAt.getTime() - a.lastChangeAt.getTime())

    return { ok: true, entities }
  } catch (error) {
    console.error("getConfigEntities error:", error)
    return { ok: false, error: "GENERIC" }
  }
}

const historySchema = z.object({
  entityKey: z.string().min(1).max(120),
})

/** Full history of one config entity (newest first, capped at 50). */
export async function getConfigHistory(
  input: z.input<typeof historySchema>
): Promise<ConfigHistoryResult> {
  try {
    const { org } = await requireAdminOrg()
    const parsed = historySchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: "INVALID" }

    const rows = await prisma.configChangeLog.findMany({
      where: { organizationId: org.id, entityKey: parsed.data.entityKey },
      orderBy: { version: "desc" },
      take: 50,
    })

    return {
      ok: true,
      latestVersion: rows[0]?.version ?? null,
      entries: rows.map((row) => ({
        version: row.version,
        action: row.action,
        actorEmail: row.actorEmail,
        summary: row.summary,
        previous: (row.previous ?? null) as ConfigSnapshot,
        next: (row.next ?? null) as ConfigSnapshot,
        createdAt: row.createdAt,
        revertable: isRevertable(row),
      })),
    }
  } catch (error) {
    console.error("getConfigHistory error:", error)
    return { ok: false, error: "GENERIC" }
  }
}

const revertSchema = z.object({
  entityKey: z.string().min(1).max(120),
  version: z.number().int().min(1),
})

export type RevertResult = { ok: boolean; error?: string }

/**
 * Revert a config entity to a stored snapshot. The snapshot is
 * applied as a NEW change and a NEW history entry (version+1,
 * action REVERT) is appended — the audit trail is never rewritten
 * and the reverted-to entry stays exactly where it was.
 */
export async function revertConfigChange(
  input: z.input<typeof revertSchema>
): Promise<RevertResult> {
  try {
    const { org, session } = await requireAdminOrg()
    const parsed = revertSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: "INVALID" }

    const entry = await prisma.configChangeLog.findFirst({
      where: {
        organizationId: org.id,
        entityKey: parsed.data.entityKey,
        version: parsed.data.version,
      },
    })
    if (!entry) return { ok: false, error: "NOT_FOUND" }
    if (!isRevertable(entry)) return { ok: false, error: "NOT_REVERTABLE" }

    const snapshot = entry.next as ConfigSnapshot
    const { kind, key } = describeEntityKey(parsed.data.entityKey)
    const actorEmail = session.user.email ?? ""

    if (kind === "overrides") {
      const current = overridesSnapshot(
        (
          await prisma.organization.findUnique({
            where: { id: org.id },
            select: { profileOverrides: true },
          })
        )?.profileOverrides
      )
      await prisma.$transaction(async (tx) => {
        await tx.organization.update({
          where: { id: org.id },
          data: { profileOverrides: (snapshot ?? undefined) as never },
        })
        await recordConfigChange({
          organizationId: org.id,
          actorEmail,
          entityKey: parsed.data.entityKey,
          action: "REVERT",
          previous: current,
          next: snapshot,
          tx,
        })
      })
    } else if (kind === "form" && key) {
      const def = await prisma.formDefinition.findFirst({
        where: { organizationId: org.id, key },
        select: { id: true, name: true, fields: true, isActive: true, version: true },
      })
      if (!def) return { ok: false, error: "ENTITY_GONE" }
      const snapName = typeof snapshot?.name === "string" ? snapshot.name : def.name
      const snapFields = Array.isArray(snapshot?.fields) ? snapshot.fields : []
      const snapActive = typeof snapshot?.isActive === "boolean" ? snapshot.isActive : def.isActive
      const previous = formSnapshot(def)

      await prisma.$transaction(async (tx) => {
        await tx.formDefinition.update({
          where: { id: def.id },
          data: {
            name: snapName,
            fields: snapFields as unknown as Prisma.InputJsonValue,
            isActive: snapActive,
            version: def.version + 1,
          },
        })
        await recordConfigChange({
          organizationId: org.id,
          actorEmail,
          entityKey: parsed.data.entityKey,
          action: "REVERT",
          previous,
          next: snapshot,
          tx,
        })
      })
    } else if (kind === "workflow" && key) {
      const def = await prisma.workflowDefinition.findFirst({
        where: { organizationId: org.id, key },
        include: { stages: { orderBy: { order: "asc" } } },
      })
      if (!def) return { ok: false, error: "ENTITY_GONE" }
      const snapStages = Array.isArray(snapshot?.stages)
        ? (snapshot.stages as {
            key: string
            name: string
            order: number
            slaHours: number | null
            isFinal: boolean
          }[])
        : []
      if (snapStages.length === 0) return { ok: false, error: "INVALID_SNAPSHOT" }
      const previous = workflowSnapshot({ name: def.name, stages: def.stages })

      await prisma.$transaction(async (tx) => {
        // Delete stages that are not in the snapshot; keep stage KEYS so
        // open work orders referencing them stay resolvable after revert.
        const snapKeys = new Set(snapStages.map((s) => s.key))
        const deleteIds = def.stages.filter((s) => !snapKeys.has(s.key)).map((s) => s.id)
        if (deleteIds.length > 0) {
          await tx.workflowStage.deleteMany({ where: { id: { in: deleteIds } } })
        }
        for (const s of snapStages) {
          const existing = def.stages.find((d) => d.key === s.key)
          if (existing) {
            await tx.workflowStage.update({
              where: { id: existing.id },
              data: {
                name: s.name,
                order: s.order,
                slaHours: s.slaHours ?? null,
                isFinal: s.isFinal,
              },
            })
          } else {
            await tx.workflowStage.create({
              data: {
                definitionId: def.id,
                key: s.key,
                name: s.name,
                order: s.order,
                slaHours: s.slaHours ?? null,
                isFinal: s.isFinal,
              },
            })
          }
        }
        await tx.workflowDefinition.update({
          where: { id: def.id },
          data: { version: { increment: 1 } },
        })
        await recordConfigChange({
          organizationId: org.id,
          actorEmail,
          entityKey: parsed.data.entityKey,
          action: "REVERT",
          previous,
          next: snapshot,
          tx,
        })
      })
    } else {
      return { ok: false, error: "INVALID" }
    }

    revalidatePath("/dashboard", "layout")
    revalidatePath("/dashboard/settings")
    revalidatePath("/dashboard/forms")
    revalidatePath("/dashboard/work-orders")
    return { ok: true }
  } catch (error) {
    console.error("revertConfigChange error:", error)
    return { ok: false, error: "GENERIC" }
  }
}

// NOTE: this is a "use server" module — every export must be an async
// function. Entity-key helpers for the UI import directly from
// @/lib/config-history/logic (client-safe).
