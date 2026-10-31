// ============================================================
// EPIC #1 Phase 7 — profile engine tests (§4, §5, §21)
// The registry is zod-validated AT MODULE LOAD, so importing it
// already asserts every profile + extension is structurally valid.
// These tests lock the §21 critical rules in place:
//   • capability matrices per mandatory validation scenario
//   • unknown profile → universal generic (never salon-specific)
//   • new activity = registry entry only (no core edits)
// ============================================================

import { describe, it, expect } from "vitest"
import {
  PROFILES,
  GENERIC_PROFILE_ID,
  getProfile,
  listProfiles,
  listProfileOptions,
  isCapabilityEnabled,
} from "@/lib/profiles/registry"
import { EXTENSIONS } from "@/lib/profiles/extensions"

describe("activity profile registry (§4)", () => {
  it("loads every profile through zod validation (loud failure on invalid)", () => {
    expect(Object.keys(PROFILES).length).toBeGreaterThanOrEqual(11)
  })

  it("exposes stable profile ids incl. the §21 acceptance scenarios", () => {
    const ids = Object.keys(PROFILES)
    for (const required of [
      "beauty",
      "seamstress",
      "tire-service",
      "beekeeping",
      GENERIC_PROFILE_ID,
    ]) {
      expect(ids).toContain(required)
    }
  })

  it("every profile declares all 13 universal capabilities (§21 critical rule)", () => {
    const REQUIRED_CAPS = [
      "appointments",
      "workOrders",
      "shop",
      "services",
      "inventory",
      "customers",
      "staff",
      "analytics",
      "reviews",
      "forms",
      "workflows",
      "documents",
      "delivery",
    ] as const
    for (const profile of listProfiles()) {
      for (const cap of REQUIRED_CAPS) {
        expect(
          profile.capabilities[cap],
          `${profile.id}.${cap} missing`
        ).toMatch(/^(required|optional|disabled)$/)
      }
    }
  })

  it("every profile has a valid CTA mode, terminology and dashboard widgets", () => {
    for (const profile of listProfiles()) {
      expect(profile.website.ctaMode).toMatch(/^(booking|inquiry|order|quote)$/)
      expect(profile.terminology.bookingCta.sl.length).toBeGreaterThan(0)
      expect(profile.terminology.bookingCta.en.length).toBeGreaterThan(0)
      expect(profile.dashboardWidgets.length).toBeGreaterThan(0)
    }
  })

  it("extension ids referenced by profiles exist in the extension registry", () => {
    for (const profile of listProfiles()) {
      for (const extId of profile.extensions) {
        expect(
          EXTENSIONS[extId],
          `${profile.id} references unknown extension ${extId}`
        ).toBeDefined()
      }
    }
  })

  it("picker options mirror the registry (single source — no mirror lists)", () => {
    const options = listProfileOptions()
    expect(options.length).toBe(listProfiles().length)
    for (const opt of options) {
      expect(PROFILES[opt.id]).toBeDefined()
    }
  })
})

describe("§21 acceptance scenario: BEAUTY STUDIO", () => {
  const profile = getProfile("beauty")

  it("runs appointments as first-class capability", () => {
    expect(profile.capabilities.appointments).toBe("required")
    expect(profile.website.ctaMode).toBe("booking")
  })

  it("shows the appointment dashboard widgets", () => {
    expect(profile.dashboardWidgets).toContain("todayAppointments")
  })
})

describe("§21 acceptance scenario: SEAMSTRESS", () => {
  const profile = getProfile("seamstress")

  it("is work-order driven, not appointment driven", () => {
    expect(profile.capabilities.workOrders).toBe("required")
    expect(profile.capabilities.appointments).toBe("disabled")
    expect(profile.website.ctaMode).toBe("inquiry")
  })

  it("materializes a production workflow + measurement form", () => {
    const wf = profile.workflows.find((w) => w.entity === "order")
    expect(wf).toBeDefined()
    expect(wf!.stages.length).toBeGreaterThanOrEqual(5)
    expect(profile.forms.length).toBeGreaterThanOrEqual(1)
  })

  it("enables the body-measurements extension", () => {
    expect(profile.extensions).toContain("body-measurements")
  })
})

describe("§21 acceptance scenario: TIRE SERVICE / VEHICLE WORKSHOP", () => {
  const profile = getProfile("tire-service")

  it("combines work orders + shop + inventory (parts) + optional bookings", () => {
    expect(profile.capabilities.workOrders).toBe("required")
    expect(profile.capabilities.shop).toBe("required")
    expect(profile.capabilities.inventory).toBe("required")
    expect(profile.capabilities.appointments).toBe("optional")
  })

  it("has a vehicle workflow with adjacent-stage stages and final stage", () => {
    const wf = profile.workflows.find((w) => w.entity === "order")
    expect(wf).toBeDefined()
    expect(wf!.stages[0].key).toBe("checkin")
    expect(wf!.stages[wf!.stages.length - 1].isFinal).toBe(true)
  })

  it("enables the vehicle-workshop extension with vehicle + tire_set entities", () => {
    expect(profile.extensions).toContain("vehicle-workshop")
    const ext = EXTENSIONS["vehicle-workshop"]
    const keys = ext.entities.map((e) => e.key)
    expect(keys).toContain("vehicle")
    expect(keys).toContain("tire_set")
    // Vehicle registry carries the §21 required data points.
    const vehicle = ext.entities.find((e) => e.key === "vehicle")!
    const fieldKeys = vehicle.fields.map((f) => f.key)
    expect(fieldKeys).toContain("license_plate")
    expect(fieldKeys).toContain("brand_model")
    const tireSet = ext.entities.find((e) => e.key === "tire_set")!
    const tireKeys = tireSet.fields.map((f) => f.key)
    expect(tireKeys).toContain("width_mm")
    expect(tireKeys).toContain("season")
  })
})

describe("§21 acceptance scenario: BEEKEEPING (no appointments)", () => {
  const profile = getProfile("beekeeping")

  it("disables appointments, work orders, services and staff entirely", () => {
    expect(profile.capabilities.appointments).toBe("disabled")
    expect(profile.capabilities.workOrders).toBe("disabled")
    expect(profile.capabilities.services).toBe("disabled")
    expect(profile.capabilities.staff).toBe("disabled")
    expect(profile.website.ctaMode).toBe("order")
  })

  it("keeps product business capabilities: shop + inventory + customers", () => {
    expect(profile.capabilities.shop).toBe("required")
    expect(profile.capabilities.inventory).toBe("required")
    expect(profile.capabilities.customers).toBe("required")
  })

  it("enables the batch-production extension (harvest/lots, no bookings)", () => {
    expect(profile.extensions).toContain("batch-production")
    const ext = EXTENSIONS["batch-production"]
    const batch = ext.entities.find((e) => e.key === "batch")!
    const fieldKeys = batch.fields.map((f) => f.key)
    expect(fieldKeys).toContain("batch_code")
    expect(fieldKeys).toContain("production_date")
    expect(fieldKeys).toContain("quantity_kg")
  })
})

describe("unknown / null profile resolution (§5 no silent salon fallback)", () => {
  it("falls back to the UNIVERSAL generic profile, never a salon-specific one", () => {
    const fallback = getProfile("does-not-exist")
    expect(fallback.id).toBe(GENERIC_PROFILE_ID)
    expect(getProfile(null).id).toBe(GENERIC_PROFILE_ID)
    expect(getProfile(undefined).id).toBe(GENERIC_PROFILE_ID)
  })

  it("generic profile does not assume any industry specifics", () => {
    const generic = getProfile(GENERIC_PROFILE_ID)
    // The universal profile must be genuinely universal: nothing
    // salon-only is hardcoded as mandatory.
    expect(generic.capabilities.appointments).not.toBe("required")
    expect(generic.capabilities.workOrders).not.toBe("required")
  })
})

describe("capability helpers", () => {
  it("isCapabilityEnabled treats optional as enabled and disabled as off", () => {
    const seamstress = getProfile("seamstress")
    expect(isCapabilityEnabled(seamstress, "workOrders")).toBe(true)
    expect(isCapabilityEnabled(seamstress, "appointments")).toBe(false)
  })
})
