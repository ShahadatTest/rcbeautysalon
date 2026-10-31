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
import type { ActivityProfile } from "./types"

/**
 * Effective profile of the current admin session's org
 * (shared profile + owner overrides applied).
 */
export const getSessionEffectiveProfile = cache(async (): Promise<ActivityProfile> => {
  const org = await getSessionOrg()
  return applyOverrides(getProfile(org?.vertical), parseOverrides(org?.profileOverrides))
})

/**
 * Effective profile for an already-loaded org (public pages pass
 * the resolved tenant org here).
 */
export function resolveEffectiveProfile(org: {
  vertical: string | null
  profileOverrides: unknown
} | null | undefined): ActivityProfile {
  return applyOverrides(getProfile(org?.vertical), parseOverrides(org?.profileOverrides))
}
