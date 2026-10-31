// ============================================================
// EPIC #1 Phase 7 — owner overrides rules (§4/§5/§12)
// Owner customization must never mutate the shared profile and
// must never allow disabling REQUIRED capabilities (protected
// client- AND server-side — these tests lock the same rules the
// server action re-validates).
// ============================================================

import { describe, it, expect } from "vitest"
import {
  applyOverrides,
  parseOverrides,
  ownerAdjustableCapabilities,
  isOverridesActive,
  type ProfileOverrides,
} from "@/lib/profiles/overrides"
import { getProfile } from "@/lib/profiles/registry"

describe("parseOverrides (tolerant reader)", () => {
  it("returns null for broken/legacy shapes instead of throwing", () => {
    expect(parseOverrides(null)).toBeNull()
    expect(parseOverrides(undefined)).toBeNull()
    expect(parseOverrides("junk")).toBeNull()
    expect(parseOverrides([1, 2, 3])).toBeNull()
    expect(parseOverrides({})).toBeNull() // missing v
    expect(parseOverrides({ v: "1" })).toBeNull() // wrong v type
  })

  it("drops invalid capability values and unknown widget keys", () => {
    const parsed = parseOverrides({
      v: 1,
      capabilityStates: { forms: "disabled", junk: "deleted" },
      dashboardWidgets: ["revenue", "not-a-widget", "revenue"],
    })
    expect(parsed).not.toBeNull()
    expect(parsed!.capabilityStates).toEqual({ forms: "disabled" })
    expect(parsed!.dashboardWidgets).toEqual(["revenue"]) // deduped
  })

  it("isOverridesActive reflects whether any effective override exists", () => {
    expect(isOverridesActive({ v: 1 })).toBe(false)
    expect(isOverridesActive({ v: 1, dashboardWidgets: ["revenue"] })).toBe(true)
  })
})

describe("applyOverrides — capability protection (§12)", () => {
  const beauty = getProfile("beauty") // appointments: required

  it("can NEVER disable a required capability (client can't either)", () => {
    const overrides: ProfileOverrides = {
      v: 1,
      capabilityStates: { appointments: "disabled" },
    }
    const effective = applyOverrides(beauty, overrides)
    expect(effective.capabilities.appointments).toBe("required")
  })

  it("leaves the SHARED profile untouched (overrides are per-tenant)", () => {
    const before = beauty.capabilities.forms
    applyOverrides(beauty, { v: 1, capabilityStates: { forms: "disabled" } })
    expect(beauty.capabilities.forms).toBe(before)
  })

  it("toggles only OPTIONAL capabilities (seamstress: shop optional → disabled)", () => {
    const seamstress = getProfile("seamstress")
    const overridable = ownerAdjustableCapabilities(seamstress).map((c) => c.key)
    expect(overridable).toContain("shop") // optional → owner-adjustable
    expect(overridable).not.toContain("workOrders") // required → not adjustable
    expect(overridable).not.toContain("appointments") // disabled → not adjustable

    const effective = applyOverrides(seamstress, {
      v: 1,
      capabilityStates: { shop: "disabled" },
    })
    expect(effective.capabilities.shop).toBe("disabled")
  })

  it("ignores overrides for unknown capabilities", () => {
    const effective = applyOverrides(beauty, {
      v: 1,
      capabilityStates: { notACapability: "disabled" } as never,
    })
    expect(effective.capabilities).toEqual(beauty.capabilities)
  })
})

describe("applyOverrides — dashboard widgets", () => {
  it("replaces the widget set with the owner's selection (validated)", () => {
    const seamstress = getProfile("seamstress")
    const effective = applyOverrides(seamstress, {
      v: 1,
      dashboardWidgets: ["revenue", "junk" as never, "deadlines"],
    })
    expect(effective.dashboardWidgets).toEqual(["revenue", "deadlines"])
  })

  it("an empty widget list is allowed (= no widgets shown)", () => {
    const beauty = getProfile("beauty")
    const effective = applyOverrides(beauty, { v: 1, dashboardWidgets: [] })
    expect(effective.dashboardWidgets).toEqual([])
  })
})
