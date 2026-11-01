// ============================================================
// E2-7 — workspace resources in the scheduler (EPIC #2 §3/E2-7, G7)
// Locks the acceptance criteria in place:
//   • the scheduler gains resources ONLY when the profile enables
//     `workspace-resources` AND `appointments` (booking profiles
//     with the extension); non-booking and resource-less profiles
//     see NO change (gate returns false);
//   • resource conflict = strict overlap (touching edges allowed),
//     mirroring the staff slot logic;
//   • one booking per resource at a time is enforced by the
//     conflict predicate (DB path: createAppointment re-check +
//     webhook re-check — same pure predicate everywhere).
// ============================================================

import { describe, it, expect } from "vitest"
import {
  canUseWorkspaceResources,
  hasResourceConflict,
  slotBlockedByResource,
  WORKSPACE_ENTITY_KEY,
  WORKSPACE_RESOURCES_EXTENSION_ID,
} from "@/lib/booking/resources"
import { getProfile, listProfiles } from "@/lib/profiles/registry"

const T = (h: number, m = 0) => new Date(2026, 0, 15, h, m)

describe("E2-7 — capability gate (only booking profiles with resources)", () => {
  it("beauty salon (workspace-resources + appointments) CAN use resources", () => {
    expect(canUseWorkspaceResources(getProfile("beauty"))).toBe(true)
  })

  it("seamstress (work orders, appointments DISABLED) cannot — non-booking profiles unchanged", () => {
    expect(canUseWorkspaceResources(getProfile("seamstress"))).toBe(false)
  })

  it("beekeeping (no workspace-resources extension) cannot", () => {
    expect(canUseWorkspaceResources(getProfile("beekeeping"))).toBe(false)
  })

  it("matrix: every profile that passes the gate really has BOTH gates on", () => {
    for (const profile of listProfiles()) {
      if (canUseWorkspaceResources(profile)) {
        expect(profile.extensions).toContain(WORKSPACE_RESOURCES_EXTENSION_ID)
        expect(profile.capabilities.appointments).not.toBe("disabled")
      }
    }
  })

  it("the extension declares workspace entity with the expected key", () => {
    // The booking resource list reads ExtensionRecords of exactly this key.
    expect(WORKSPACE_RESOURCES_EXTENSION_ID).toBe("workspace-resources")
    expect(WORKSPACE_ENTITY_KEY).toBe("workspace")
  })
})

describe("E2-7 — resource conflict predicate", () => {
  const busy = [
    { startTime: T(10), endTime: T(11) }, // 10:00–11:00 busy
  ]

  it("overlapping window conflicts", () => {
    expect(hasResourceConflict(busy, T(10, 30), T(11, 30))).toBe(true)
    expect(hasResourceConflict(busy, T(9, 30), T(10, 30).getTime() > 0 ? T(10, 1) : T(10, 1))).toBe(true)
    expect(hasResourceConflict(busy, T(10), T(10, 15))).toBe(true) // inside
  })

  it("touching edges are ALLOWED (same rule as staff slots)", () => {
    expect(hasResourceConflict(busy, T(11), T(12))).toBe(false) // starts exactly at busy end
    expect(hasResourceConflict(busy, T(9), T(10))).toBe(false) // ends exactly at busy start
    expect(hasResourceConflict(busy, T(8), T(9))).toBe(false)
  })

  it("empty busy list never conflicts", () => {
    expect(hasResourceConflict([], T(10), T(11))).toBe(false)
  })

  it("slotBlockedByResource mirrors hasResourceConflict", () => {
    expect(slotBlockedByResource(busy, T(10, 30), T(11))).toBe(true)
    expect(slotBlockedByResource(busy, T(11), T(11, 30))).toBe(false)
  })
})
