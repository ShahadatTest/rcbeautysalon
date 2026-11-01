// ============================================================
// EFFECTIVE PROFILE RESOLVER (EPIC #1 — Phase 5, server-only)
// Single source for every surface that needs the tenant's
// effective profile: shared registry profile + owner overrides
// stored on Organization.profileOverrides.
// React cache() keeps one resolution per request.
// ============================================================

import { cache } from "react"
import { getSessionOrg } from "@/lib/tenant"
import { getProfile } from "./registry"
import { applyOverrides, parseOverrides } from "./overrides"
import { applySecondaryProfile } from "./secondary"
import type { ActivityProfile } from "./types"

/**
 * Effective profile of the current admin session's org
 * (shared profile + secondary-activity union + owner overrides).
 *
 * Order matters and is deliberate:
 *   1. shared registry profile of the PRIMARY vertical,
 *   2. secondary-activity capability union (E2-4 — structural,
 *      platform-controlled, only ever widens),
 *   3. owner overrides last (the owner always keeps final control
 *      over optional toggles, including ones enabled via secondary).
 */
export const getSessionEffectiveProfile = cache(async (): Promise<ActivityProfile> => {
  const org = await getSessionOrg()
  const withSecondary = applySecondaryProfile(
    getProfile(org?.vertical),
    org?.secondaryVertical
  )
  return applyOverrides(withSecondary, parseOverrides(org?.profileOverrides))
})

/**
 * Effective profile for an already-loaded org (public pages pass
 * the resolved tenant org here).
 */
export function resolveEffectiveProfile(org: {
  vertical: string | null
  secondaryVertical?: string | null
  profileOverrides: unknown
} | null | undefined): ActivityProfile {
  const withSecondary = applySecondaryProfile(
    getProfile(org?.vertical),
    org?.secondaryVertical
  )
  return applyOverrides(withSecondary, parseOverrides(org?.profileOverrides))
}
