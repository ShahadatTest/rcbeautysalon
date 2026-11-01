// ============================================================
// EPIC #4 E4-2b — OWNER-SUPPLIED ANALYTICS (GA4 measurement ID)
// Pure-rule tests: strict ID validation at save time, the honest
// empty default (no ID = no script anywhere) and the §15 privacy
// rule that the owner's script exists ONLY inside the PUBLISHED
// tenant site — never in previews, maintenance screens or the
// platform itself.
// ============================================================

import { describe, it, expect } from "vitest"
import {
  normalizeMeasurementId,
  isValidMeasurementId,
  parseMeasurementIdInput,
  analyticsScriptIdFor,
} from "../src/lib/analytics/measurement-id"

describe("normalizeMeasurementId (E4-2b)", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeMeasurementId("  G-ABCDEF1234  ")).toBe("G-ABCDEF1234")
  })

  it("maps empty and absent input to null (= not set)", () => {
    expect(normalizeMeasurementId("")).toBeNull()
    expect(normalizeMeasurementId("   ")).toBeNull()
    expect(normalizeMeasurementId(null)).toBeNull()
    expect(normalizeMeasurementId(undefined)).toBeNull()
  })
})

describe("isValidMeasurementId (E4-2b strict shape)", () => {
  it("accepts GA4-shaped IDs (6–12 alphanumeric after G-)", () => {
    expect(isValidMeasurementId("G-ABCDEF")).toBe(true)
    expect(isValidMeasurementId("G-ABCDEF1234")).toBe(true)
    expect(isValidMeasurementId("G-a1B2c3D4e5F")).toBe(true)
  })

  it("rejects everything that is not G- + 6..12 alphanumerics", () => {
    expect(isValidMeasurementId("G-12345")).toBe(false) // too short
    expect(isValidMeasurementId("G-ABCDEFGHIJKLM")).toBe(false) // 13 chars
    expect(isValidMeasurementId("g-abcdef1234")).toBe(false) // lowercase prefix
    expect(isValidMeasurementId("G-")).toBe(false)
    expect(isValidMeasurementId("G-ABC DEF1")).toBe(false) // space inside
    expect(isValidMeasurementId("G-ABC_DEF1")).toBe(false) // underscore
    expect(isValidMeasurementId("UA-123456")).toBe(false) // legacy UA id
    expect(isValidMeasurementId("")).toBe(false)
    expect(isValidMeasurementId(null)).toBe(false)
    expect(isValidMeasurementId(undefined)).toBe(false)
  })
})

describe("parseMeasurementIdInput (E4-2b form pipeline)", () => {
  it("empty input is a valid clear (null), not an error", () => {
    expect(parseMeasurementIdInput("")).toEqual({ ok: true, value: null })
    expect(parseMeasurementIdInput(null)).toEqual({ ok: true, value: null })
  })

  it("valid input is trimmed and accepted", () => {
    expect(parseMeasurementIdInput(" G-ABCDEF1234 ")).toEqual({
      ok: true,
      value: "G-ABCDEF1234",
    })
  })

  it("invalid input is rejected — never stored, never silently dropped", () => {
    expect(parseMeasurementIdInput("not-an-id")).toEqual({
      ok: false,
      reason: "invalid",
    })
    expect(parseMeasurementIdInput("G-ABC DEF1")).toEqual({
      ok: false,
      reason: "invalid",
    })
  })
})

describe("analyticsScriptIdFor (E4-2b §15 privacy rule)", () => {
  it("injects ONLY for a published site with a valid stored ID", () => {
    expect(
      analyticsScriptIdFor({ gate: "published", measurementId: "G-ABCDEF1234" })
    ).toBe("G-ABCDEF1234")
  })

  it("never injects into owner previews, hidden screens or without an org", () => {
    expect(
      analyticsScriptIdFor({ gate: "owner-preview", measurementId: "G-ABCDEF1234" })
    ).toBeNull()
    expect(
      analyticsScriptIdFor({ gate: "hidden", measurementId: "G-ABCDEF1234" })
    ).toBeNull()
  })

  it("never injects when the owner has not set an ID (honest default)", () => {
    expect(analyticsScriptIdFor({ gate: "published", measurementId: null })).toBeNull()
    expect(analyticsScriptIdFor({ gate: "published", measurementId: undefined })).toBeNull()
    expect(analyticsScriptIdFor({ gate: "published", measurementId: "  " })).toBeNull()
  })

  it("defense in depth: an invalid stored ID is never injected even if present", () => {
    expect(
      analyticsScriptIdFor({ gate: "published", measurementId: "G-TOO LONG!" })
    ).toBeNull()
  })
})
