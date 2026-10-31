// ============================================================
// EPIC #3 E3-3 — PLAN REGISTRY TESTS
// The registry is zod-validated AT MODULE LOAD: importing it
// alone asserts every plan definition is structurally valid
// (mirrors tests/profiles/registry.test.ts).
// ============================================================

import { describe, it, expect } from "vitest"
import {
  PLANS,
  PLAN_IDS,
  DEFAULT_PLAN_ID,
  getPlan,
  isPlanId,
  listPlans,
  listPlanOptions,
} from "@/lib/plans/registry"

describe("plan registry invariants (E3-3)", () => {
  it("exposes exactly the three known plans", () => {
    expect(Object.keys(PLANS).sort()).toEqual(["free", "pro", "scale"])
    expect(PLAN_IDS).toEqual(["free", "pro", "scale"])
    expect(listPlans()).toHaveLength(3)
  })

  it("every plan carries positive limits, 0 (resource not in plan) or explicit null (unlimited)", () => {
    for (const plan of Object.values(PLANS)) {
      for (const [resource, limit] of Object.entries(plan.limits)) {
        expect(
          limit === null || (typeof limit === "number" && limit >= 0),
          `${plan.id}.${resource} must be null or a non-negative number`
        ).toBe(true)
      }
    }
  })

  it("SCALE is unlimited across all resources", () => {
    expect(PLANS.scale.limits).toEqual({
      services: null,
      products: null,
      staff: null,
      storageMb: null,
      customDomains: null,
      orders: null,
    })
  })

  it("custom domains are a PRO/SCALE entitlement (E3-6: FREE=0, PRO≥1)", () => {
    expect(PLANS.free.limits.customDomains).toBe(0)
    expect(PLANS.pro.limits.customDomains).toBeGreaterThanOrEqual(1)
    expect(PLANS.scale.limits.customDomains).toBeNull()
  })

  it("FREE limits sit ABOVE the largest onboarding catalog seed", () => {
    // seedOrganizationCatalog creates at most 10 services / 6 products /
    // 1 staff (src/lib/verticals.ts presets) — a fresh FREE tenant must
    // never be immediately over-limit.
    expect(PLANS.free.limits.services).toBeGreaterThan(10)
    expect(PLANS.free.limits.products).toBeGreaterThan(6)
    expect(PLANS.free.limits.staff).toBeGreaterThan(1)
  })

  it("plan versions are positive integers and labels unique", () => {
    const labels = new Set<string>()
    for (const plan of Object.values(PLANS)) {
      expect(Number.isInteger(plan.version)).toBe(true)
      expect(plan.version).toBeGreaterThan(0)
      expect(labels.has(plan.label)).toBe(false)
      labels.add(plan.label)
    }
  })

  it("every feature bullet is non-empty in both locales", () => {
    for (const plan of Object.values(PLANS)) {
      expect(plan.features.length).toBeGreaterThan(0)
      for (const f of plan.features) {
        expect(f.sl.trim().length).toBeGreaterThan(0)
        expect(f.en.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it("getPlan falls back to FREE for unknown/missing values (never escalates)", () => {
    expect(getPlan(null).id).toBe(DEFAULT_PLAN_ID)
    expect(getPlan(undefined).id).toBe("free")
    expect(getPlan("").id).toBe("free")
    expect(getPlan("enterprise").id).toBe("free")
    expect(getPlan("SCALE").id).toBe("free") // case-sensitive ids
    expect(getPlan("pro").id).toBe("pro")
  })

  it("isPlanId is a strict type guard", () => {
    expect(isPlanId("free")).toBe(true)
    expect(isPlanId("scale")).toBe(true)
    expect(isPlanId("mega")).toBe(false)
    expect(isPlanId(null)).toBe(false)
    expect(isPlanId(undefined)).toBe(false)
  })

  it("listPlanOptions returns serializable picker options", () => {
    const options = listPlanOptions()
    expect(options).toHaveLength(3)
    for (const opt of options) {
      expect(Object.keys(opt).sort()).toEqual(["id", "label"])
    }
  })
})
