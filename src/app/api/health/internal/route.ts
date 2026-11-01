// ============================================================
// INTERNAL HEALTH ENDPOINT (EPIC #4 E4-5 — §13)
// GET /api/health/internal
//
// Operator-only (fail-closed via the PLATFORM_ADMIN_EMAILS
// allowlist — the same gate as /platform, re-checked here).
// Reports the REAL state:
//   • DB reachability + ping (SELECT 1, measured);
//   • migration state interpreted from _prisma_migrations;
//   • webhook failure counts (24 h / 7 d + reasons).
//
// Honesty + safety rules:
//   • status is the single pure decision healthStatusFor();
//   • DB error messages are NEVER echoed (they can contain
//     connection strings) — logged server-side, the payload
//     carries only a constant "unreachable";
//   • only counts and names, never payload snippets, emails
//     or tenant data.
// ============================================================

import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requirePlatformAdmin } from "@/lib/platform/guard"
import { UnauthorizedError } from "@/lib/auth/guards"
import {
  healthStatusFor,
  migrationStateFromRows,
  WEBHOOK_FAILURE_ALERT_THRESHOLD,
  type MigrationState,
} from "@/lib/health/health-report"

export const dynamic = "force-dynamic"

const DB_PING_SQL = Prisma.sql`SELECT 1`

export async function GET() {
  try {
    await requirePlatformAdmin()
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Operator access is restricted" }, { status: 403 })
    }
    throw err
  }

  const version = process.env.npm_package_version ?? "unknown"
  const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? null

  // ---- DB ping (measured) --------------------------------
  const dbStartedAt = Date.now()
  let dbReachable = false
  let unfinishedMigrations = 0
  let migrations: MigrationState | { checked: false } = { checked: false }
  let webhookFailures24h = 0
  let webhookFailures7d = 0
  let webhookFailuresByReason7d: { reason: string; count: number }[] = []

  try {
    await prisma.$queryRaw(DB_PING_SQL)
    dbReachable = true
  } catch (err) {
    // NEVER echo the error (connection string risk) — log it, report a constant.
    console.error("[health] db ping failed:", err)
  }

  if (dbReachable) {
    try {
      const rows = await prisma.$queryRaw<
        { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null; started_at: Date }[]
      >(
        Prisma.sql`SELECT "migration_name", "finished_at", "rolled_back_at", "started_at"
          FROM "_prisma_migrations"`
      )
      const state = migrationStateFromRows(rows)
      migrations = state
      unfinishedMigrations = state.unfinished
    } catch (err) {
      console.error("[health] migration state check failed:", err)
    }

    try {
      const now = Date.now()
      const since24 = new Date(now - 24 * 60 * 60 * 1000)
      const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000)
      webhookFailures24h = await prisma.platformWebhookFailure.count({
        where: { createdAt: { gte: since24 } },
      })
      webhookFailures7d = await prisma.platformWebhookFailure.count({
        where: { createdAt: { gte: since7d } },
      })
      const grouped = await prisma.platformWebhookFailure.groupBy({
        by: ["reason"],
        where: { createdAt: { gte: since7d } },
        _count: { _all: true },
      })
      webhookFailuresByReason7d = grouped
        .map((g) => ({ reason: g.reason, count: g._count._all }))
        // Deterministic order: descending count, then reason — never a random order.
        .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
    } catch (err) {
      console.error("[health] webhook failure counts failed:", err)
    }
  }

  const status = healthStatusFor({
    dbReachable,
    unfinishedMigrations,
    webhookFailures24h,
  })

  return NextResponse.json(
    {
      status,
      version,
      commit,
      timestamp: new Date().toISOString(),
      db: { reachable: dbReachable, pingMs: dbReachable ? Date.now() - dbStartedAt : null },
      migrations,
      webhookFailures: {
        last24h: webhookFailures24h,
        last7d: webhookFailures7d,
        byReason7d: webhookFailuresByReason7d,
        alertThreshold24h: WEBHOOK_FAILURE_ALERT_THRESHOLD,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
