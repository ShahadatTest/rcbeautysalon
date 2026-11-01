// ============================================================
// EPIC #4 E4-5 — HEALTH ENDPOINT RULES (§13)
// Pure-rule tests: the status decision is honest ("degraded" is
// real, never soft-pedaled), migration rows are interpreted
// (unfinished/rolled-back never counted as applied), the public
// payload is a strict whitelist, and nothing sensitive can slip
// through.
// ============================================================

import { describe, it, expect } from "vitest"

import {
  WEBHOOK_FAILURE_ALERT_THRESHOLD,
  healthStatusFor,
  migrationStateFromRows,
  publicHealthPayload,
  isPublicHealthPayload,
  type RawMigrationRow,
} from "../../src/lib/health/health-report"

describe("healthStatusFor (E4-5 single decision)", () => {
  const base = { dbReachable: true, unfinishedMigrations: 0, webhookFailures24h: 0 }

  it("is ok only when every signal is healthy", () => {
    expect(healthStatusFor(base)).toBe("ok")
    expect(healthStatusFor({ ...base, webhookFailures24h: 5 })).toBe("ok")
  })

  it("unreachable DB is degraded — never soft-pedaled", () => {
    expect(healthStatusFor({ ...base, dbReachable: false })).toBe("degraded")
  })

  it("an unfinished migration is degraded (deploy did not complete)", () => {
    expect(healthStatusFor({ ...base, unfinishedMigrations: 1 })).toBe("degraded")
  })

  it("a webhook failure flood (>= threshold/24h) is degraded", () => {
    expect(healthStatusFor({ ...base, webhookFailures24h: WEBHOOK_FAILURE_ALERT_THRESHOLD })).toBe(
      "degraded"
    )
    expect(
      healthStatusFor({ ...base, webhookFailures24h: WEBHOOK_FAILURE_ALERT_THRESHOLD - 1 })
    ).toBe("ok")
  })

  it("respects a custom threshold (testability)", () => {
    expect(healthStatusFor({ ...base, webhookFailures24h: 5 }, 5)).toBe("degraded")
    expect(healthStatusFor({ ...base, webhookFailures24h: 5 }, 6)).toBe("ok")
  })

  it("degraded wins over ok for ANY single bad signal", () => {
    expect(healthStatusFor({ dbReachable: false, unfinishedMigrations: 3, webhookFailures24h: 99 })).toBe(
      "degraded"
    )
  })
})

describe("migrationStateFromRows (E4-5 honest interpretation)", () => {
  const t1 = new Date("2025-12-01T10:00:00Z")
  const t2 = new Date("2025-12-02T10:00:00Z")
  const t3 = new Date("2025-12-03T10:00:00Z")

  function row(
    name: string,
    started: Date,
    finished: Date | null,
    rolledBack: Date | null = null
  ): RawMigrationRow {
    return { migration_name: name, started_at: started, finished_at: finished, rolled_back_at: rolledBack }
  }

  it("counts only finished, non-rolled-back migrations as applied", () => {
    const state = migrationStateFromRows([
      row("m1", t1, t1),
      row("m2", t2, t2),
      row("m3", t3, t3),
    ])
    expect(state).toEqual({ applied: 3, unfinished: 0, latest: "m3" })
  })

  it("a failed run (finished_at null) is unfinished, not applied", () => {
    const state = migrationStateFromRows([row("m1", t1, t1), row("m2", t2, null)])
    expect(state.applied).toBe(1)
    expect(state.unfinished).toBe(1)
    expect(state.latest).toBe("m2")
  })

  it("a rolled-back run is never applied", () => {
    const state = migrationStateFromRows([
      row("m1", t1, t1),
      row("m2", t2, t2, t2), // finished but rolled back
    ])
    expect(state.applied).toBe(1)
    expect(state.unfinished).toBe(0)
  })

  it("latest follows started_at order, not array order", () => {
    const state = migrationStateFromRows([row("m3", t3, t3), row("m1", t1, t1), row("m2", t2, t2)])
    expect(state.latest).toBe("m3")
  })

  it("an empty table is honestly empty (no fabricated state)", () => {
    expect(migrationStateFromRows([])).toEqual({ applied: 0, unfinished: 0, latest: null })
  })
})

describe("public payload whitelist (E4-5)", () => {
  it("contains exactly status/version/commit/timestamp", () => {
    const payload = publicHealthPayload("0.1.0", "abc123", new Date("2025-12-03T12:00:00Z"))
    expect(Object.keys(payload).sort()).toEqual(["commit", "status", "timestamp", "version"])
    expect(payload.status).toBe("ok")
    expect(payload.version).toBe("0.1.0")
    expect(payload.commit).toBe("abc123")
    expect(payload.timestamp).toBe("2025-12-03T12:00:00.000Z")
  })

  it("an absent commit is null, never an invented value", () => {
    expect(publicHealthPayload("0.1.0", undefined, new Date()).commit).toBeNull()
    expect(publicHealthPayload("0.1.0", "", new Date()).commit).toBeNull()
  })

  it("the validator accepts the real payload and rejects everything else", () => {
    const payload = publicHealthPayload("0.1.0", null, new Date())
    expect(isPublicHealthPayload(payload)).toBe(true)
    expect(isPublicHealthPayload({ status: "degraded", version: "x", commit: null, timestamp: "t" })).toBe(false)
    expect(isPublicHealthPayload({ status: "ok", version: 1, commit: null, timestamp: "t" })).toBe(false)
    expect(isPublicHealthPayload(null)).toBe(false)
    expect(isPublicHealthPayload("ok")).toBe(false)
  })

  it("DB internals can never appear in the public payload shape", () => {
    const payload = publicHealthPayload("0.1.0", null, new Date()) as unknown as Record<string, unknown>
    expect(payload.db).toBeUndefined()
    expect(payload.migrations).toBeUndefined()
    expect(payload.webhookFailures).toBeUndefined()
    expect(payload.session).toBeUndefined()
  })
})
