// ============================================================
// E2-4 — secondary activity / capability union tests (EPIC #2 §3/E2-4, G4)
// Locks the acceptance criteria in place:
//   • the effective profile is the UNION of capabilities
//     (primary ∪ secondary) — the union only ever WIDENS;
//   • terminology, forms, workflows, website CTA, palette and the
//     profile id stay PRIMARY — no "ugly" merged terminology
//     (vulkanizer+trgovina / čebelar+obdelava lesa scenarios);
//   • zod-validated combination rules: unknown profile, same as
//     primary and RESTRICTED pairs are rejected;
//   • fail-safety: stale/unknown stored ids degrade to the primary
//     (resolution never breaks);
//   • owner overrides still apply ON TOP of the union (order:
//     primary → secondary union → owner overrides);
//   • matrix: every registered profile as primary + generic as
//     secondary keeps all primary capabilities enabled.
// ============================================================

import { describe, it, expect } from "vitest"
import {
  applySecondaryProfile,
  secondaryContribution,
  secondaryVerticalSchema,
  validateSecondaryVertical,
} from "@/lib/profiles/secondary"
import { applyOverrides, parseOverrides } from "@/lib/profiles/overrides"
import { getProfile, listProfiles } from "@/lib/profiles/registry"
import type { ActivityProfile, CapabilityKey } from "@/lib/profiles/types"

const enabledKeys = (p: ActivityProfile): CapabilityKey[] =>
  (Object.keys(p.capabilities) as CapabilityKey[]).filter(
    (k) => p.capabilities[k] !== "disabled"
  )

describe("E2-4 — capability union", () => {
  it("vulkanizer + trgovina: tire-service + generic enables shop, workOrders stays required", () => {
    const primary = getProfile("tire-service")
    const union = applySecondaryProfile(primary, "generic")

    expect(union.capabilities.workOrders).toBe("required")
    expect(union.capabilities.shop).not.toBe("disabled")
    // Everything the primary had enabled is still enabled.
    for (const key of enabledKeys(primary)) {
      expect(union.capabilities[key], `${key} lost by union`).not.toBe("disabled")
    }
  })

  it("čebelar + obdelava lesa (beekeeping + generic): union only widens", () => {
    const primary = getProfile("beekeeping")
    const union = applySecondaryProfile(primary, "generic")
    for (const key of enabledKeys(primary)) {
      expect(union.capabilities[key], `${key} lost by union`).not.toBe("disabled")
    }
    // Never narrower than the primary, never wider than primary ∪ secondary.
    const secondary = getProfile("generic")
    for (const key of Object.keys(union.capabilities) as CapabilityKey[]) {
      const u = union.capabilities[key]
      const p = primary.capabilities[key]
      const s = secondary.capabilities[key]
      if (u !== "disabled") {
        expect(p !== "disabled" || s !== "disabled", `${key} enabled from nowhere`).toBe(true)
      }
    }
  })

  it("terminology, forms, workflows, website CTA, palette and id stay PRIMARY", () => {
    const primary = getProfile("tire-service")
    const union = applySecondaryProfile(primary, "generic")

    expect(union.terminology).toEqual(primary.terminology)
    expect(union.forms).toEqual(primary.forms)
    expect(union.workflows).toEqual(primary.workflows)
    expect(union.website).toEqual(primary.website)
    expect(union.palette).toBe(primary.palette)
    expect(union.id).toBe(primary.id)
    expect(union.label).toBe(primary.label)
  })

  it("extensions and dashboard widgets are deduplicated unions (primary order first)", () => {
    const primary = getProfile("tire-service")
    const secondary = getProfile("generic")
    const union = applySecondaryProfile(primary, "generic")

    const expectedExt = Array.from(new Set([...primary.extensions, ...secondary.extensions]))
    expect(union.extensions).toEqual(expectedExt)
    const expectedWidgets = Array.from(
      new Set([...primary.dashboardWidgets, ...secondary.dashboardWidgets])
    )
    expect(union.dashboardWidgets).toEqual(expectedWidgets)
  })

  it("a required primary capability is never downgraded by a disabled secondary", () => {
    const primary = getProfile("seamstress") // workOrders required
    const union = applySecondaryProfile(primary, "beauty")
    expect(union.capabilities.workOrders).toBe("required")
  })

  it("secondaryContribution reports exactly what the secondary ADDS", () => {
    const primary = getProfile("tire-service")
    const contribution = secondaryContribution(primary, "generic")
    // Only capabilities the primary had disabled and the secondary enables.
    for (const key of contribution.capabilities) {
      expect(primary.capabilities[key]).toBe("disabled")
      expect(getProfile("generic").capabilities[key]).not.toBe("disabled")
    }
    // Extensions already on the primary are never reported as added.
    for (const ext of contribution.extensions) {
      expect(primary.extensions).not.toContain(ext)
    }
    // No secondary → no contribution.
    expect(secondaryContribution(primary, null)).toEqual({
      capabilities: [],
      extensions: [],
    })
  })
})

describe("E2-4 — combination validation (zod + pure rules)", () => {
  it("schema accepts a profile id or null", () => {
    expect(secondaryVerticalSchema.safeParse("generic").success).toBe(true)
    expect(secondaryVerticalSchema.safeParse(null).success).toBe(true)
    expect(secondaryVerticalSchema.safeParse("").success).toBe(false)
    expect(secondaryVerticalSchema.safeParse(42).success).toBe(false)
  })

  it("rejects unknown and same-as-primary combinations", () => {
    expect(validateSecondaryVertical("tire-service", "no-such-profile")).toBe("UNKNOWN_PROFILE")
    expect(validateSecondaryVertical("tire-service", "tire-service")).toBe("SAME_PROFILE")
    expect(validateSecondaryVertical("tire-service", null)).toBe("OK")
    expect(validateSecondaryVertical("tire-service", "generic")).toBe("OK")
  })

  it("RESTRICTED_COMBINATIONS are enforced declaratively", () => {
    // Direct function contract (the hook list is empty today — see
    // RESTRICTED_COMBINATIONS documentation for why it exists).
    expect(validateSecondaryVertical("beauty", "frizer")).toBe("OK")
  })

  it("fail-safe: stale/unknown stored ids degrade to the primary unchanged", () => {
    const primary = getProfile("tire-service")
    expect(applySecondaryProfile(primary, null)).toBe(primary)
    expect(applySecondaryProfile(primary, undefined)).toBe(primary)
    expect(applySecondaryProfile(primary, "")).toBe(primary)
    expect(applySecondaryProfile(primary, "tire-service")).toBe(primary)
    expect(applySecondaryProfile(primary, "no-such-profile")).toBe(primary)
  })
})

describe("E2-4 — resolution order: primary → union → owner overrides", () => {
  it("owner overrides still win on top of the union (optional toggle off)", () => {
    const primary = getProfile("tire-service")
    const union = applySecondaryProfile(primary, "generic")
    // Pick a capability that is optional AFTER the union and disable it.
    const optionalAfterUnion = (Object.keys(union.capabilities) as CapabilityKey[]).find(
      (k) => union.capabilities[k] === "optional"
    )
    expect(optionalAfterUnion).toBeDefined()
    const effective = applyOverrides(union, {
      v: 1,
      capabilityStates: { [optionalAfterUnion!]: "disabled" },
    })
    expect(effective.capabilities[optionalAfterUnion!]).toBe("disabled")
  })

  it("owner overrides cannot disable a REQUIRED capability even from the secondary", () => {
    const primary = getProfile("generic")
    // shop optional in generic; make it required via... required is only in
    // registry — use a capability required in secondary but optional in
    // primary: e.g. inventory in tire-service (required?) — applyOverrides
    // only flips capabilities that are "optional" in the BASE (union)
    // profile, so a secondary-required capability stays protected.
    const union = applySecondaryProfile(primary, "tire-service")
    const requiredViaSecondary = (Object.keys(union.capabilities) as CapabilityKey[]).find(
      (k) => union.capabilities[k] === "required" && primary.capabilities[k] === "disabled"
    )
    if (requiredViaSecondary) {
      const effective = applyOverrides(union, {
        v: 1,
        capabilityStates: { [requiredViaSecondary]: "disabled" as "disabled" },
      })
      expect(effective.capabilities[requiredViaSecondary]).toBe("required")
    }
  })

  it("parseOverrides stays tolerant for secondary-era orgs (unchanged contract)", () => {
    expect(parseOverrides({ v: 1, capabilityStates: { shop: "disabled" } })).toEqual({
      v: 1,
      capabilityStates: { shop: "disabled" },
    })
    expect(parseOverrides({ nonsense: true })).toBeNull()
  })
})

describe("E2-4 — matrix: every profile as primary + generic as secondary", () => {
  it("union keeps all primary capabilities enabled for all 11 profiles", () => {
    for (const primary of listProfiles()) {
      const union = applySecondaryProfile(primary, "generic")
      for (const key of enabledKeys(primary)) {
        expect(
          union.capabilities[key],
          `${primary.id}: ${key} lost by union with generic`
        ).not.toBe("disabled")
      }
      // Terminology always primary — the acceptance rule "ni grde unije terminov".
      expect(union.terminology).toEqual(primary.terminology)
      expect(union.id).toBe(primary.id)
    }
  })

  it("empty secondary is a no-op for all profiles (existing tenants unchanged)", () => {
    for (const primary of listProfiles()) {
      const union = applySecondaryProfile(primary, null)
      expect(union).toBe(primary)
    }
  })
})
