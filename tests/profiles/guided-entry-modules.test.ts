import { describe, it, expect } from "vitest"
import { modulesForVertical } from "../../src/lib/profiles/modules"
import { getProfile, listProfileOptions } from "../../src/lib/profiles/registry"

// ============================================================
// Vodeni vstop (guided entry) — "kaj je zakupil": the module list
// shown in the wizard MUST match the capability gating that drives
// the sidebar (§21). If these drift, the wizard promises modules
// the workspace does not open.
// ============================================================

describe("modulesForVertical", () => {
  it("beauty opens with the salon core, no work orders", () => {
    const keys = modulesForVertical("beauty").map((m) => m.key)
    expect(keys).toContain("appointments")
    expect(keys).toContain("shop")
    expect(keys).toContain("services")
    expect(keys).not.toContain("workOrders")
    expect(keys).not.toContain("workflows")
    expect(keys).not.toContain("documents")
  })

  it("tire-service (mehanik) opens with work orders, inventory and shop", () => {
    const mods = modulesForVertical("tire-service")
    const keys = mods.map((m) => m.key)
    expect(keys).toContain("workOrders")
    expect(keys).toContain("inventory")
    expect(keys).toContain("shop")
    // optional for workshops: appointments (seasonal tire changes)
    const appointments = mods.find((m) => m.key === "appointments")
    expect(appointments?.state).toBe("optional")
  })

  it("beekeeping has no appointments and no work orders (product business)", () => {
    const keys = modulesForVertical("beekeeping").map((m) => m.key)
    expect(keys).not.toContain("appointments")
    expect(keys).not.toContain("workOrders")
    expect(keys).toContain("shop")
    expect(keys).toContain("inventory")
  })

  it("never lists a disabled capability — wizard and sidebar stay in sync", () => {
    for (const option of listProfileOptions()) {
      const profile = getProfile(option.id)
      const listed = modulesForVertical(option.id)
      for (const [cap, state] of Object.entries(profile.capabilities)) {
        const isListed = listed.some((m) => m.key === cap)
        if (state === "disabled") {
          expect(isListed, `${option.id}: ${cap} is disabled but listed`).toBe(false)
        } else {
          expect(isListed, `${option.id}: ${cap} is ${state} but missing`).toBe(true)
        }
      }
    }
  })

  it("every module carries non-empty SI and EN labels", () => {
    for (const option of listProfileOptions()) {
      for (const m of modulesForVertical(option.id)) {
        expect(m.labelSl.trim().length).toBeGreaterThan(0)
        expect(m.labelEn.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it("marks required capabilities as core, optional as switchable", () => {
    const beauty = modulesForVertical("beauty")
    expect(beauty.find((m) => m.key === "appointments")?.state).toBe("required")
    expect(beauty.find((m) => m.key === "inventory")?.state).toBe("optional")
  })
})
