/**
 * E4-6b — pure guard-decision rules for admin member management and
 * org-bound admin checks (full permission matrix follow-up).
 *
 * These rules are the SINGLE decision points shared by the server
 * actions (`updateUserRole`, `adminSetUserPassword`,
 * `rescheduleAppointment`). Fixed fictitious data — no DB.
 */
import { describe, it, expect } from "vitest"
import {
  targetBelongsToOrg,
  canAdminManageTarget,
  isAdminForOrg,
  type MemberTargetInfo,
} from "@/lib/permissions/guard-rules"

function member(overrides: Partial<MemberTargetInfo> = {}): MemberTargetInfo {
  return {
    id: "user-1",
    role: "CLIENTE",
    organizationId: "org-a",
    staff: null,
    customer: null,
    ...overrides,
  }
}

describe("targetBelongsToOrg", () => {
  it("matches a direct organizationId", () => {
    expect(targetBelongsToOrg(member({ organizationId: "org-a" }), "org-a")).toBe(true)
    expect(targetBelongsToOrg(member({ organizationId: "org-b" }), "org-a")).toBe(false)
  })

  it("matches via the staff profile link", () => {
    const target = member({ organizationId: null, staff: { organizationId: "org-a" } })
    expect(targetBelongsToOrg(target, "org-a")).toBe(true)
    expect(targetBelongsToOrg(target, "org-b")).toBe(false)
  })

  it("matches via the customer profile link", () => {
    const target = member({ organizationId: null, customer: { organizationId: "org-a" } })
    expect(targetBelongsToOrg(target, "org-a")).toBe(true)
  })

  it("is false for a fully detached user (null org, no profiles)", () => {
    expect(targetBelongsToOrg(member({ organizationId: null }), "org-a")).toBe(false)
  })
})

describe("canAdminManageTarget", () => {
  const actor = { id: "admin-1" }

  it("allows managing a STAFF/CLIENTE member of the same org", () => {
    expect(canAdminManageTarget(actor, member(), "org-a")).toEqual({ ok: true })
    expect(
      canAdminManageTarget(actor, member({ role: "STAFF" }), "org-a")
    ).toEqual({ ok: true })
  })

  it("blocks self-management", () => {
    const decision = canAdminManageTarget(actor, member({ id: "admin-1" }), "org-a")
    expect(decision).toEqual({ ok: false, reason: "self" })
  })

  it("blocks members of another organization (the takeover hole)", () => {
    const decision = canAdminManageTarget(
      actor,
      member({ organizationId: "org-b" }),
      "org-a"
    )
    expect(decision).toEqual({ ok: false, reason: "not-member" })
  })

  it("blocks a platform-wide user with no org membership at all", () => {
    const decision = canAdminManageTarget(
      actor,
      member({ organizationId: null }),
      "org-a"
    )
    expect(decision).toEqual({ ok: false, reason: "not-member" })
  })

  it("blocks other ADMINs even inside the same org", () => {
    const decision = canAdminManageTarget(
      actor,
      member({ role: "ADMIN" }),
      "org-a"
    )
    expect(decision).toEqual({ ok: false, reason: "admin-target" })
  })

  it("checks membership BEFORE the admin-target rule (foreign admin = not-member)", () => {
    const decision = canAdminManageTarget(
      actor,
      member({ role: "ADMIN", organizationId: "org-b" }),
      "org-a"
    )
    expect(decision).toEqual({ ok: false, reason: "not-member" })
  })
})

describe("isAdminForOrg", () => {
  it("is false for non-admin roles regardless of org", () => {
    expect(
      isAdminForOrg({ role: "STAFF", organizationId: "org-a" }, "org-a", "org-a")
    ).toBe(false)
    expect(
      isAdminForOrg({ role: "CLIENTE", organizationId: "org-a" }, "org-a", "org-a")
    ).toBe(false)
  })

  it("accepts an admin whose session organizationId matches the request org", () => {
    expect(
      isAdminForOrg({ role: "ADMIN", organizationId: "org-a" }, "org-a", null)
    ).toBe(true)
  })

  it("REJECTS an admin of another org browsing a foreign tenant site (the reschedule hole)", () => {
    expect(
      isAdminForOrg({ role: "ADMIN", organizationId: "org-b" }, "org-a", "org-b")
    ).toBe(false)
    expect(
      isAdminForOrg({ role: "ADMIN", organizationId: "org-b" }, "org-a", null)
    ).toBe(false)
  })

  it("legacy admin without organizationId keeps access only via the session org", () => {
    expect(
      isAdminForOrg({ role: "ADMIN", organizationId: null }, "org-a", "org-a")
    ).toBe(true)
    expect(
      isAdminForOrg({ role: "ADMIN", organizationId: null }, "org-b", "org-a")
    ).toBe(false)
  })
})
