// ============================================================
// EPIC #3 E3-3 — PLAN LIMIT CHECK TESTS
// Pure boundary cases for checkPlanLimit: below/at/over limit,
// unlimited, downgrade tolerance, message quality. This is the
// exact function the create actions gate on — acceptance criterion:
// "a FREE owner cannot exceed limits through the API".
// ============================================================

import { describe, it, expect } from "vitest"
import { checkPlanLimit } from "@/lib/plans/types"
import { PLANS, getPlan } from "@/lib/plans/registry"

describe("checkPlanLimit — FREE plan (E3-3)", () => {
  const plan = PLANS.free

  it("allows creation below the limit", () => {
    expect(checkPlanLimit(plan, "services", 0).ok).toBe(true)
    expect(checkPlanLimit(plan, "services", plan.limits.services! - 1).ok).toBe(true)
    expect(checkPlanLimit(plan, "products", 5).ok).toBe(true)
    expect(checkPlanLimit(plan, "staff", 1).ok).toBe(true)
  })

  it("blocks creation AT the limit (the Nth record is the one over)", () => {
    const check = checkPlanLimit(plan, "services", plan.limits.services!)
    expect(check.ok).toBe(false)
    if (!check.ok) {
      expect(check.code).toBe("LIMIT_REACHED")
      expect(check.limit).toBe(plan.limits.services)
      expect(check.resource).toBe("services")
      expect(check.planId).toBe("free")
    }
  })

  it("blocks creation OVER the limit (downgrade tolerance: usage may exceed)", () => {
    expect(checkPlanLimit(plan, "services", plan.limits.services! + 10).ok).toBe(false)
    expect(checkPlanLimit(plan, "products", 999).ok).toBe(false)
    expect(checkPlanLimit(plan, "staff", 50).ok).toBe(false)
  })

  it("error messages name the plan, the limit and the fix path", () => {
    const check = checkPlanLimit(plan, "staff", 3)
    expect(check.ok).toBe(false)
    if (!check.ok) {
      expect(check.message).toContain("FREE")
      expect(check.message).toContain("3")
      expect(check.message).toContain("Nadgradite paket")
      expect(check.messageEn).toContain("FREE")
      expect(check.messageEn).toContain("Upgrade your plan")
      // sl and en messages must differ
      expect(check.message).not.toBe(check.messageEn)
    }
  })

  it("uses correct resource nouns per locale", () => {
    const services = checkPlanLimit(plan, "services", 15)
    const products = checkPlanLimit(plan, "products", 20)
    const staff = checkPlanLimit(plan, "staff", 3)
    if (!services.ok) expect(services.message).toContain("storitev")
    if (!products.ok) expect(products.message).toContain("izdelkov")
    if (!staff.ok) expect(staff.message).toContain("zaposlenih")
  })
})

describe("checkPlanLimit — SCALE plan (unlimited)", () => {
  const plan = PLANS.scale

  it("never blocks, regardless of usage", () => {
    expect(checkPlanLimit(plan, "services", 100_000).ok).toBe(true)
    expect(checkPlanLimit(plan, "products", 1_000_000).ok).toBe(true)
    expect(checkPlanLimit(plan, "staff", 10_000).ok).toBe(true)
  })
})

describe("checkPlanLimit — PRO plan and fallback", () => {
  it("PRO blocks at its own (higher) limits", () => {
    expect(checkPlanLimit(PLANS.pro, "services", 100).ok).toBe(false)
    expect(checkPlanLimit(PLANS.pro, "services", 99).ok).toBe(true)
    expect(checkPlanLimit(PLANS.pro, "staff", 25).ok).toBe(false)
  })

  it("an unknown plan resolves to FREE and its limits still apply", () => {
    // This is what the actions effectively run for a corrupted plan value.
    const plan = getPlan("corrupted-value")
    expect(plan.id).toBe("free")
    expect(checkPlanLimit(plan, "services", 15).ok).toBe(false)
    expect(checkPlanLimit(plan, "services", 14).ok).toBe(true)
  })
})
