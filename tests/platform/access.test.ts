// ============================================================
// EPIC #3 E3-5 — PLATFORM OPERATOR ACCESS + SUSPENSION RULES
// Pure-function tests: the env allowlist is the only operator
// identity (fail-closed), tenant owners are NEVER operators, the
// suspension reason is required and bounded, and the suspension
// state machine refuses double writes.
// ============================================================

import { describe, it, expect } from "vitest"
import {
  PLATFORM_AUDIT_ACTIONS,
  isPlatformAdminEmail,
  platformAdminEmails,
  suspensionTransition,
  validateSuspensionReason,
} from "../../src/lib/platform/access"

describe("platform operator allowlist parsing", () => {
  it("returns an empty list for missing/blank env (fail-closed)", () => {
    expect(platformAdminEmails(undefined)).toEqual([])
    expect(platformAdminEmails(null)).toEqual([])
    expect(platformAdminEmails("")).toEqual([])
    expect(platformAdminEmails("   ")).toEqual([])
  })

  it("splits on commas, trims and lowercases entries", () => {
    expect(
      platformAdminEmails("  Ops@Example.Org , second@org.io,,THIRD@ORG.io ")
    ).toEqual(["ops@example.org", "second@org.io", "third@org.io"])
  })

  it("supports a single operator without a comma", () => {
    expect(platformAdminEmails("ops@example.org")).toEqual(["ops@example.org"])
  })
})

describe("platform operator authorization (§10: never exposed to tenant owners)", () => {
  it("denies when the env is missing — even a tenant ADMIN", () => {
    expect(isPlatformAdminEmail("admin@rcbeautysalon.org", undefined)).toBe(false)
    expect(isPlatformAdminEmail("admin@rcbeautysalon.org", "")).toBe(false)
  })

  it("denies unauthenticated / empty emails", () => {
    expect(isPlatformAdminEmail(undefined, "ops@example.org")).toBe(false)
    expect(isPlatformAdminEmail(null, "ops@example.org")).toBe(false)
    expect(isPlatformAdminEmail("", "ops@example.org")).toBe(false)
    expect(isPlatformAdminEmail("   ", "ops@example.org")).toBe(false)
  })

  it("denies a tenant owner whose email is not on the allowlist", () => {
    expect(
      isPlatformAdminEmail("owner@salon.si", "ops@example.org,admin@platform.org")
    ).toBe(false)
  })

  it("accepts a listed operator case-insensitively (both sides)", () => {
    expect(isPlatformAdminEmail("OPS@Example.ORG", "ops@example.org")).toBe(true)
    expect(isPlatformAdminEmail("ops@example.org", "  OPS@Example.ORG ")).toBe(true)
  })

  it("accepts one of several listed operators", () => {
    expect(
      isPlatformAdminEmail("second@org.io", "ops@example.org, second@org.io")
    ).toBe(true)
  })
})

describe("suspension reason validation", () => {
  it("requires a non-empty reason", () => {
    expect(validateSuspensionReason(undefined)).toEqual({ ok: false, code: "MISSING" })
    expect(validateSuspensionReason(null)).toEqual({ ok: false, code: "MISSING" })
    expect(validateSuspensionReason("   ")).toEqual({ ok: false, code: "MISSING" })
  })

  it("requires at least 3 trimmed characters", () => {
    expect(validateSuspensionReason("ab")).toEqual({ ok: false, code: "TOO_SHORT" })
    expect(validateSuspensionReason(" ab ")).toEqual({ ok: false, code: "TOO_SHORT" })
  })

  it("caps the reason at 500 characters", () => {
    const long = "x".repeat(501)
    expect(validateSuspensionReason(long)).toEqual({ ok: false, code: "TOO_LONG" })
  })

  it("accepts a valid reason and returns it trimmed", () => {
    expect(validateSuspensionReason("  neplačan račun  ")).toEqual({
      ok: true,
      value: "neplačan račun",
    })
  })
})

describe("suspension state machine", () => {
  it("ACTIVE + SUSPEND → SUSPENDED", () => {
    expect(suspensionTransition("ACTIVE", "SUSPEND")).toEqual({
      ok: true,
      next: "SUSPENDED",
    })
  })

  it("refuses suspending an already suspended tenant", () => {
    expect(suspensionTransition("SUSPENDED", "SUSPEND")).toEqual({
      ok: false,
      code: "ALREADY_SUSPENDED",
    })
  })

  it("SUSPENDED + REACTIVATE → ACTIVE", () => {
    expect(suspensionTransition("SUSPENDED", "REACTIVATE")).toEqual({
      ok: true,
      next: "ACTIVE",
    })
  })

  it("refuses reactivating an active tenant", () => {
    expect(suspensionTransition("ACTIVE", "REACTIVATE")).toEqual({
      ok: false,
      code: "ALREADY_ACTIVE",
    })
  })
})

describe("audit trail contract", () => {
  it("defines exactly the suspend/reactivate actions", () => {
    expect(PLATFORM_AUDIT_ACTIONS).toEqual(["TENANT_SUSPENDED", "TENANT_REACTIVATED"])
  })
})
