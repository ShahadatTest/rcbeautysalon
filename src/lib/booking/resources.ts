// ============================================================
// WORKSPACE RESOURCES (EPIC #2 E2-7, G7) — pure logic.
// An optional physical resource (chair / room / station) can be
// attached to an appointment as a "differentiator": the slot must
// be free for BOTH the staff member AND the chosen resource.
// Gate rule: only offered when the org's effective profile enables
// the `workspace-resources` extension AND `appointments` — non-
// booking profiles and resource-less profiles see NO change.
// Client-safe: pure functions, NO server-only imports.
// ============================================================

import type { ActivityProfile } from "@/lib/profiles/types"

export const WORKSPACE_RESOURCES_EXTENSION_ID = "workspace-resources"
export const WORKSPACE_ENTITY_KEY = "workspace"

/**
 * True when the effective profile offers the resource-aware scheduler:
 * the extension must be enabled AND the appointments capability on
 * (booking profiles only). Non-booking profiles never see the change.
 */
export function canUseWorkspaceResources(
  profile: Pick<ActivityProfile, "extensions" | "capabilities">
): boolean {
  return (
    profile.extensions.includes(WORKSPACE_RESOURCES_EXTENSION_ID) &&
    profile.capabilities.appointments !== "disabled"
  )
}

export interface BusyWindow {
  startTime: Date
  endTime: Date
}

/**
 * Strict overlap test for one resource: (startA < endB) && (endA > startB).
 * Touching edges are ALLOWED (a booking ending 10:00 and the next starting
 * 10:00 share the resource without conflict), mirroring the staff slot
 * logic in getAvailableTimeSlots.
 */
export function hasResourceConflict(busy: BusyWindow[], start: Date, end: Date): boolean {
  return busy.some(
    (w) => start < new Date(w.endTime) && end > new Date(w.startTime)
  )
}

/**
 * True when the given slot window collides with any busy window of the
 * resource (same overlap rule as staff conflicts).
 */
export function slotBlockedByResource(
  busy: BusyWindow[],
  slotStart: Date,
  slotEnd: Date
): boolean {
  return hasResourceConflict(busy, slotStart, slotEnd)
}
