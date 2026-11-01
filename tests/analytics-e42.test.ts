// ============================================================
// EPIC #4 E4-2a — TENANT ANALYTICS (enquiries, honest display)
// Pure-function tests: the enquiry change badge must show "no
// data" (never a fabricated 0 %) when neither the current nor
// the previous period has any submissions, while real data —
// including a genuine 0.0 % change (10 → 10) — stays numeric.
// ============================================================

import { describe, it, expect } from "vitest"
import { enquiryChangeDisplay } from "../src/lib/analytics/trends"

describe("enquiryChangeDisplay (E4-2a honesty rule)", () => {
  it("shows no-data when there were no submissions in either period", () => {
    // calculateChange(0, 0) === 0 — must NOT read as "0.0 %"
    expect(enquiryChangeDisplay(0, 0)).toEqual({ kind: "no-data" })
  })

  it("keeps a real 0.0 % change numeric when data exists (10 → 10)", () => {
    expect(enquiryChangeDisplay(0, 10)).toEqual({ kind: "change", value: 0 })
  })

  it("keeps positive and negative changes numeric", () => {
    expect(enquiryChangeDisplay(100, 5)).toEqual({ kind: "change", value: 100 })
    expect(enquiryChangeDisplay(-50, 3)).toEqual({ kind: "change", value: -50 })
  })

  it("shows the numeric -100 % drop when submissions existed but stopped", () => {
    // 5 → 0 submissions: change = -100, total = 0 → data existed, NOT no-data
    expect(enquiryChangeDisplay(-100, 0)).toEqual({ kind: "change", value: -100 })
  })
})
