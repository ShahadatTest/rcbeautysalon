// ============================================================
// SECONDARY ACTIVITY (EPIC #2 E2-4 — G4 „več dejavnosti pod
// enim računom")
// An organization may declare ONE secondary activity profile.
// The effective profile becomes a UNION of capabilities:
//   • capabilities: primary wins; a capability the primary has
//     DISABLED may be ENABLED by the secondary (never the other
//     way around — the union only ever widens);
//   • extensions / dashboard widgets: union, primary first;
//   • terminology, forms, workflows, website CTA, palette and
//     the profile id itself stay PRIMARY — one owner of language
//     and site content, so no "ugly" merged terminology.
// Client-safe: pure functions, NO server-only imports. The same
// rules are re-validated server-side in actions/profile.ts and
// actions/onboarding.ts (mirrors the applyOverrides contract).
// ============================================================

import { z } from "zod"
import { getProfile, listProfiles } from "./registry"
import type {
  ActivityProfile,
  CapabilityKey,
  CapabilityState,
} from "./types"

/** Zod schema for the stored/action input value (null clears). */
export const secondaryVerticalSchema = z
  .string()
  .trim()
  .min(1)
  .nullable()

/** Machine-readable validation outcome (actions map codes → locale text). */
export type SecondaryVerticalCode =
  | "OK"
  | "UNKNOWN_PROFILE"
  | "SAME_PROFILE"
  | "RESTRICTED"

/**
 * Explicitly forbidden (primary → secondary) pairs. Empty today: no
 * currently defined pair is contradictory (the union only widens the
 * primary and terminology stays primary). The hook exists so a future
 * genuinely conflicting combination can be blocked declaratively,
 * without touching call sites.
 */
export const RESTRICTED_COMBINATIONS: ReadonlyArray<readonly [string, string]> = []

/**
 * Validate a (primary, secondary) combination.
 * Pure and sync — reused by onboarding, settings actions and tests.
 */
export function validateSecondaryVertical(
  primaryId: string,
  secondaryId: string | null | undefined
): SecondaryVerticalCode {
  if (secondaryId == null || secondaryId === "") return "OK" // clearing is always valid
  if (!listProfiles().some((p) => p.id === secondaryId)) return "UNKNOWN_PROFILE"
  if (secondaryId === primaryId) return "SAME_PROFILE"
  if (RESTRICTED_COMBINATIONS.some(([p, s]) => p === primaryId && s === secondaryId)) {
    return "RESTRICTED"
  }
  return "OK"
}

/**
 * True when the capability union enables the key
 * ("required" and "optional" are both enabled; only "disabled" is off).
 */
function enabled(state: CapabilityState): boolean {
  return state !== "disabled"
}

/**
 * Build the union profile for an org with a secondary activity.
 * Fail-safe: unknown/self/empty secondary ids return the primary
 * unchanged — a stale id (e.g. a removed profile) can never break
 * resolution, it only silently degrades to the primary activity.
 */
export function applySecondaryProfile(
  primary: ActivityProfile,
  secondaryVertical: string | null | undefined
): ActivityProfile {
  if (!secondaryVertical || secondaryVertical === primary.id) return primary
  if (validateSecondaryVertical(primary.id, secondaryVertical) !== "OK") return primary

  const secondary = getProfile(secondaryVertical)

  // Capabilities: primary wins; secondary may only ADD (disabled → enabled
  // with the secondary's required/optional semantics).
  const capabilities = { ...primary.capabilities } as Record<CapabilityKey, CapabilityState>
  const addedCapabilities: CapabilityKey[] = []
  for (const key of Object.keys(primary.capabilities) as CapabilityKey[]) {
    if (!enabled(primary.capabilities[key]) && enabled(secondary.capabilities[key])) {
      capabilities[key] = secondary.capabilities[key]
      addedCapabilities.push(key)
    }
  }

  // Extensions + widgets: union with de-duplication, primary order first.
  const extensions = Array.from(new Set([...primary.extensions, ...secondary.extensions]))
  const dashboardWidgets = Array.from(
    new Set([...primary.dashboardWidgets, ...secondary.dashboardWidgets])
  )

  return {
    ...primary,
    capabilities,
    extensions,
    dashboardWidgets,
  }
}

/**
 * Which capabilities/Extensions the secondary activity ADDS to the
 * primary — used by the settings UI to explain the union ("+ Spletna
 * trgovina") without leaking the whole profile diff.
 */
export function secondaryContribution(
  primary: ActivityProfile,
  secondaryVertical: string | null | undefined
): { capabilities: CapabilityKey[]; extensions: string[] } {
  if (!secondaryVertical || secondaryVertical === primary.id) {
    return { capabilities: [], extensions: [] }
  }
  if (validateSecondaryVertical(primary.id, secondaryVertical) !== "OK") {
    return { capabilities: [], extensions: [] }
  }
  const secondary = getProfile(secondaryVertical)
  const capabilities = (Object.keys(primary.capabilities) as CapabilityKey[]).filter(
    (k) => !enabled(primary.capabilities[k]) && enabled(secondary.capabilities[k])
  )
  const extensions = secondary.extensions.filter((e) => !primary.extensions.includes(e))
  return { capabilities, extensions }
}
