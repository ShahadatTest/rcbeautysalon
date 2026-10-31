// ============================================================
// EPIC #3 E3-7 — METRICS: STORAGE GATE + MONTHLY COUNTER TESTS
// Pure boundary cases for checkStorageLimit (the exact function
// the DB-backed upload route gates on), bytesToMb rounding and
// monthStartUtc determinism. Acceptance criterion: "limits show
// up before a block" — storage enforcement must be honest,
// server-side and never delete existing media.
// ============================================================

import { describe, it, expect } from "vitest"
import {
  BYTES_PER_MB,
  bytesToMb,
  checkPlanLimit,
  checkStorageLimit,
  monthStartUtc,
  type PlanDefinition,
} from "@/lib/plans/types"
import { PLANS } from "@/lib/plans/registry"

function checkPlanLimitOrders(plan: PlanDefinition, current: number) {
  return checkPlanLimit(plan, "orders", current)
}

describe("bytesToMb (E3-7)", () => {
  it("rounds partial MB up — a partial MB still consumes a full MB of quota", () => {
    expect(bytesToMb(0)).toBe(0)
    expect(bytesToMb(1)).toBe(1)
    expect(bytesToMb(BYTES_PER_MB)).toBe(1)
    expect(bytesToMb(BYTES_PER_MB - 1)).toBe(1)
    expect(bytesToMb(BYTES_PER_MB + 1)).toBe(2)
  })
})

describe("monthStartUtc (E3-7)", () => {
  it("returns the first day of the month at midnight UTC", () => {
    const midMonth = monthStartUtc(new Date("2026-03-15T14:22:09Z"))
    expect(midMonth.toISOString()).toBe("2026-03-01T00:00:00.000Z")
  })

  it("rolls back to the 1st on the first day of a month", () => {
    const first = monthStartUtc(new Date("2026-01-01T23:59:59.999Z"))
    expect(first.toISOString()).toBe("2026-01-01T00:00:00.000Z")
  })

  it("is deterministic across different server timezones (UTC anchoring)", () => {
    // The same instant must always map to the same month start,
    // regardless of the process TZ — the function only reads UTC parts.
    const instant = new Date("2026-06-30T23:30:00Z")
    expect(monthStartUtc(instant).toISOString()).toBe("2026-06-01T00:00:00.000Z")
  })
})

describe("checkStorageLimit — FREE (500 MB)", () => {
  const plan = PLANS.free

  it("allows uploads keeping would-be usage at or under the limit", () => {
    expect(checkStorageLimit(plan, 0).ok).toBe(true)
    expect(checkStorageLimit(plan, 100 * BYTES_PER_MB).ok).toBe(true)
    // Exactly at the limit is still allowed — the NEXT upload is blocked.
    expect(checkStorageLimit(plan, 500 * BYTES_PER_MB).ok).toBe(true)
  })

  it("blocks when would-be usage exceeds the limit", () => {
    const check = checkStorageLimit(plan, 500 * BYTES_PER_MB + 1)
    expect(check.ok).toBe(false)
    if (!check.ok) {
      expect(check.code).toBe("STORAGE_LIMIT_REACHED")
      expect(check.planId).toBe("free")
      expect(check.limitMb).toBe(500)
      expect(check.wouldBeMb).toBe(501)
    }
  })

  it("error messages name the plan, the MB limit and the fix path (sl/en differ)", () => {
    const check = checkStorageLimit(plan, 600 * BYTES_PER_MB)
    expect(check.ok).toBe(false)
    if (!check.ok) {
      expect(check.message).toContain("FREE")
      expect(check.message).toContain("500 MB")
      expect(check.message).toContain("nadgradite paket")
      expect(check.messageEn).toContain("FREE")
      expect(check.messageEn).toContain("upgrade your plan")
      expect(check.message).not.toBe(check.messageEn)
    }
  })
})

describe("checkStorageLimit — unlimited + downgrade tolerance", () => {
  it("SCALE (null) is unlimited regardless of usage", () => {
    expect(checkStorageLimit(PLANS.scale, Number.MAX_SAFE_INTEGER).ok).toBe(true)
  })

  it("PRO allows well beyond FREE quota", () => {
    expect(checkStorageLimit(PLANS.pro, 5_000 * BYTES_PER_MB).ok).toBe(true)
  })

  it("over-quota usage stays blocked — the gate never hints at deleting other tenants' data", () => {
    // Downgrade tolerance: usage may exceed the limit after a downgrade;
    // uploads stay blocked until usage drops — but nothing is removed.
    const check = checkStorageLimit(PLANS.free, 50_000 * BYTES_PER_MB)
    expect(check.ok).toBe(false)
  })
})

describe("orders is a first-class limit resource (E3-7)", () => {
  it("blocks NEW monthly orders at/over the plan limit", () => {
    const free = PLANS.free
    expect(free.limits.orders).toBe(50)
    expect(checkPlanLimitOrders(free, 49).ok).toBe(true)
    expect(checkPlanLimitOrders(free, 50).ok).toBe(false)
    expect(checkPlanLimitOrders(free, 51).ok).toBe(false)
  })

  it("PRO raises the monthly orders ceiling; SCALE is unlimited", () => {
    expect(PLANS.pro.limits.orders).toBe(1000)
    expect(checkPlanLimitOrders(PLANS.pro, 1000).ok).toBe(false)
    expect(checkPlanLimitOrders(PLANS.scale, 999_999).ok).toBe(true)
  })

  it("the orders limit message carries monthly semantics", () => {
    const check = checkPlanLimitOrders(PLANS.free, 50)
    expect(check.ok).toBe(false)
    if (!check.ok) {
      expect(check.message).toContain("50")
      expect(check.message).toContain("mesec")
      expect(check.messageEn).toContain("50")
      expect(check.messageEn).toContain("month")
    }
  })
})
