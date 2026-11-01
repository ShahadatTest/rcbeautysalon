// ============================================================
// CONFIG HISTORY RECORDER (EPIC #2 E2-5, G5) — server-only.
// Single write-gate for ConfigChangeLog rows: every config edit
// appends exactly ONE row with previous/next snapshots and the
// next monotonic version. Rows are never updated or deleted —
// a revert is itself a new row (audit trail stays intact).
// ============================================================

import "server-only"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  nextVersion,
  type ConfigChangeAction,
  type ConfigSnapshot,
} from "./logic"

export interface RecordConfigChangeParams {
  organizationId: string
  actorEmail: string
  entityKey: string
  action: ConfigChangeAction
  summary?: string
  /** Snapshot before the change (null = first recorded state). */
  previous: ConfigSnapshot
  /** Snapshot after the change — this is what a revert restores. */
  next: ConfigSnapshot
  /** Optional transaction client (append inside the caller's tx). */
  tx?: Prisma.TransactionClient
}

/**
 * Append one ConfigChangeLog row with the next per-org+entity
 * version. Safe inside a transaction (pass tx) so the log row is
 * committed atomically with the change it describes.
 */
export async function recordConfigChange(
  params: RecordConfigChangeParams
): Promise<{ version: number }> {
  const client = params.tx ?? prisma
  const last = await client.configChangeLog.findFirst({
    where: { organizationId: params.organizationId, entityKey: params.entityKey },
    orderBy: { version: "desc" },
    select: { version: true },
  })
  const version = nextVersion(last?.version)
  await client.configChangeLog.create({
    data: {
      organizationId: params.organizationId,
      entityKey: params.entityKey,
      version,
      actorEmail: params.actorEmail,
      action: params.action,
      summary: params.summary ?? null,
      previous: (params.previous ?? undefined) as Prisma.InputJsonValue | undefined,
      next: (params.next ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  })
  return { version }
}
