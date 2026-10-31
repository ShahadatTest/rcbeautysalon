// ============================================================
// E2-2 — inventory stock rules (EPIC #2, pure logic).
// computeStockDelta is THE gate both the server action and the
// checkout flow share: positive integer quantities only, IN
// adds, OUT subtracts, negative results are rejected BEFORE any
// write — state and ledger can never disagree about a rejected
// movement.
// ============================================================

import { describe, it, expect } from "vitest"
import { computeStockDelta } from "@/lib/inventory/stock"

describe("E2-2 computeStockDelta — receipts (IN)", () => {
  it("adds to the current stock", () => {
    expect(computeStockDelta(0, "IN", 5)).toEqual({ ok: true, nextStock: 5 })
    expect(computeStockDelta(10, "IN", 1)).toEqual({ ok: true, nextStock: 11 })
  })

  it("allows receipt onto zero stock", () => {
    expect(computeStockDelta(0, "IN", 1)).toEqual({ ok: true, nextStock: 1 })
  })
})

describe("E2-2 computeStockDelta — issues (OUT)", () => {
  it("subtracts from the current stock", () => {
    expect(computeStockDelta(10, "OUT", 4)).toEqual({ ok: true, nextStock: 6 })
  })

  it("allows an issue down to exactly zero", () => {
    expect(computeStockDelta(7, "OUT", 7)).toEqual({ ok: true, nextStock: 0 })
  })

  it("REJECTS an issue below zero (§11 — never sell what isn't there)", () => {
    expect(computeStockDelta(3, "OUT", 4)).toEqual({
      ok: false,
      reason: "NEGATIVE_STOCK",
    })
    expect(computeStockDelta(0, "OUT", 1)).toEqual({
      ok: false,
      reason: "NEGATIVE_STOCK",
    })
  })
})

describe("E2-2 computeStockDelta — quantity validation", () => {
  it("rejects zero, negative and non-integer quantities", () => {
    expect(computeStockDelta(10, "IN", 0).ok).toBe(false)
    expect(computeStockDelta(10, "OUT", 0).ok).toBe(false)
    expect(computeStockDelta(10, "IN", -3).ok).toBe(false)
    expect(computeStockDelta(10, "IN", 2.5).ok).toBe(false)
    expect(computeStockDelta(10, "IN", 0.1).ok).toBe(false)
  })

  it("rejects corrupt current stock values", () => {
    expect(computeStockDelta(-1, "IN", 5).ok).toBe(false)
    expect(computeStockDelta(1.5, "IN", 5).ok).toBe(false)
  })

  it("never mutates its inputs (pure)", () => {
    const current = 5
    computeStockDelta(current, "IN", 3)
    expect(current).toBe(5)
  })
})
