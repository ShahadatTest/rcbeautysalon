// ============================================================
// HEALTH REPORT RULES (EPIC #4 E4-5 — §13 OPERATIONAL HEALTH)
//
// Pure decision logic for the two health endpoints:
//   • /api/health          — public, minimal (status + version),
//     no DB touch, answers < 200 ms;
//   • /api/health/internal — operator-only (fail-closed via the
//     PLATFORM_ADMIN_EMAILS allowlist), reports the REAL state:
//     DB reachability, migration state, webhook failure counts.
//
// Honesty rules:
//   • "degraded" is a real decision, never a soft-pedaled "ok";
//   • NOTHING sensitive is ever echoed — DB error messages can
//     contain connection strings, so they are logged server-side
//     and replaced by a constant in the payload;
//   • migration rows are interpreted, not forwarded raw.
// ============================================================

/**
 * Webhook failures in the last 24 h at or above this count degrade
 * the internal status — the same signal the /platform analytics
 * tile shows. Deliberately a code constant: the alerting runbook
 * (docs/EPIC-3/ROLLBACK-BACKUP.md) documents it as the threshold.
 */
export const WEBHOOK_FAILURE_ALERT_THRESHOLD = 20

export type HealthStatus = "ok" | "degraded"

export interface HealthSignalInput {
  dbReachable: boolean
  unfinishedMigrations: number
  webhookFailures24h: number
}

/**
 * The single status decision. db unreachable or an unfinished
 * migration is always degraded; a webhook failure flood (≥
 * threshold/24 h) is degraded too (retry storm / broken pipeline).
 */
export function healthStatusFor(
  input: HealthSignalInput,
  threshold: number = WEBHOOK_FAILURE_ALERT_THRESHOLD
): HealthStatus {
  if (!input.dbReachable) return "degraded"
  if (input.unfinishedMigrations > 0) return "degraded"
  if (input.webhookFailures24h >= threshold) return "degraded"
  return "ok"
}

// ------------------------------------------------------------
// Migration state — interpreted from the _prisma_migrations table
// (Prisma marks a failed run with finished_at IS NULL; a rolled
// back run never counts as applied).
// ------------------------------------------------------------

export interface RawMigrationRow {
  migration_name: string
  finished_at: Date | null
  rolled_back_at: Date | null
  started_at: Date
}

export interface MigrationState {
  applied: number
  unfinished: number
  /** Name of the most recently started migration, or null when none. */
  latest: string | null
}

export function migrationStateFromRows(rows: RawMigrationRow[]): MigrationState {
  let applied = 0
  let unfinished = 0
  let latest: string | null = null
  let latestStarted: Date | null = null
  for (const row of rows) {
    if (row.rolled_back_at === null && row.finished_at !== null) applied += 1
    if (row.finished_at === null) unfinished += 1
    if (latestStarted === null || row.started_at > latestStarted) {
      latestStarted = row.started_at
      latest = row.migration_name
    }
  }
  return { applied, unfinished, latest }
}

// ------------------------------------------------------------
// Public payload — a strict whitelist. Nothing about the DB,
// sessions, operators or internals may ever appear here.
// ------------------------------------------------------------

export interface PublicHealthPayload {
  status: "ok"
  version: string
  commit: string | null
  timestamp: string
}

export function publicHealthPayload(
  version: string,
  commit: string | null | undefined,
  now: Date
): PublicHealthPayload {
  return {
    status: "ok",
    version,
    commit: typeof commit === "string" && commit.length > 0 ? commit : null,
    timestamp: now.toISOString(),
  }
}

/**
 * The public endpoint reports "ok" BY CONSTRUCTION: it touches no
 * subsystem, so it can only answer or not answer at all (an absent
 * response is the failure signal for external uptime monitors).
 */
export function isPublicHealthPayload(value: unknown): value is PublicHealthPayload {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return (
    v.status === "ok" &&
    typeof v.version === "string" &&
    (v.commit === null || typeof v.commit === "string") &&
    typeof v.timestamp === "string"
  )
}
