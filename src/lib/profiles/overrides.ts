// ============================================================
// PROFILE OVERRIDES (EPIC #1 §4/§5 — Phase 5)
// Business-level overrides let the OWNER customize profile
// defaults without code and without mutating the shared profile:
//   • capability states — only "optional" capabilities may be
//     toggled between enabled/disabled ("required" ones are
//     protected server- AND client-side),
//   • dashboard widget set — which widgets the home screen shows.
// Stored as JSON on Organization.profileOverrides, versioned.
// Client-safe: pure functions, NO server-only imports.
// ============================================================

import type {
  ActivityProfile,
  CapabilityKey,
  CapabilityState,
  DashboardWidgetKey,
} from "./types"

export const OVERRIDES_VERSION = 1

/** Shape persisted on Organization.profileOverrides (JSON). */
export interface ProfileOverrides {
  /** Schema version of the overrides document itself. */
  v: number
  /** Capability changes relative to the shared profile. Only optional capabilities may appear. */
  capabilityStates?: Partial<Record<CapabilityKey, CapabilityState>>
  /** Owner-selected dashboard widgets (subset of known widget keys). */
  dashboardWidgets?: DashboardWidgetKey[]
}

/** All dashboard widgets the configurator can offer. */
export const ALL_DASHBOARD_WIDGETS: DashboardWidgetKey[] = [
  "todayAppointments",
  "revenue",
  "customers",
  "topServices",
  "recentOrders",
  "lowStock",
  "activeOrders",
  "deadlines",
  "pendingApprovals",
  "readyForDelivery",
]

/** Bilingual labels for the widget configurator + capability matrix. */
export const DASHBOARD_WIDGET_LABELS: Record<DashboardWidgetKey, { sl: string; en: string }> = {
  todayAppointments: { sl: "Današnji termini", en: "Today's appointments" },
  revenue: { sl: "Prihodek (mesec)", en: "Revenue (month)" },
  customers: { sl: "Nove stranke", en: "New customers" },
  topServices: { sl: "Priljubljene storitve", en: "Popular services" },
  recentOrders: { sl: "Nedavna naročila", en: "Recent orders" },
  lowStock: { sl: "Nizke zaloge", en: "Low stock" },
  activeOrders: { sl: "Aktivna naročila", en: "Active orders" },
  deadlines: { sl: "Roki v 7 dneh", en: "Deadlines within 7 days" },
  pendingApprovals: { sl: "Čaka potrditev stranke", en: "Awaiting approval" },
  readyForDelivery: { sl: "Za predajo/dostavo", en: "Ready for delivery" },
}

const VALID_WIDGETS = new Set<string>(ALL_DASHBOARD_WIDGETS)

/**
 * Tolerant parser for the stored JSON (unknown/legacy shapes → null).
 * The server validates on write; parsing here is defensive for reads.
 */
export function parseOverrides(json: unknown): ProfileOverrides | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null
  const raw = json as Record<string, unknown>
  if (typeof raw.v !== "number") return null

  const overrides: ProfileOverrides = { v: raw.v }

  if (raw.capabilityStates && typeof raw.capabilityStates === "object" && !Array.isArray(raw.capabilityStates)) {
    const states: Partial<Record<CapabilityKey, CapabilityState>> = {}
    for (const [key, value] of Object.entries(raw.capabilityStates as Record<string, unknown>)) {
      if (value === "optional" || value === "disabled") {
        states[key as CapabilityKey] = value
      }
    }
    if (Object.keys(states).length > 0) overrides.capabilityStates = states
  }

  if (Array.isArray(raw.dashboardWidgets)) {
    const widgets = raw.dashboardWidgets.filter(
      (w): w is DashboardWidgetKey => typeof w === "string" && VALID_WIDGETS.has(w)
    )
    // De-duplicate while keeping order.
    overrides.dashboardWidgets = Array.from(new Set(widgets))
  }

  if (!overrides.capabilityStates && !overrides.dashboardWidgets) return null
  return overrides
}

/** True when the org has any active overrides (for "customized" badges). */
export function isOverridesActive(json: unknown): boolean {
  return parseOverrides(json) !== null
}

/**
 * Apply owner overrides to a shared profile, producing the EFFECTIVE
 * profile every surface (nav, dashboard, public CTA) must consume.
 * Rules (mirrored server-side in actions/profile.ts):
 *   • "required" capabilities can never be changed;
 *   • only optional capabilities may be toggled optional↔disabled;
 *   • an empty dashboardWidgets list is allowed (= no widgets).
 */
export function applyOverrides(
  profile: ActivityProfile,
  overrides?: ProfileOverrides | null
): ActivityProfile {
  if (!overrides) return profile

  const capabilities = { ...profile.capabilities }
  if (overrides.capabilityStates) {
    for (const [key, state] of Object.entries(overrides.capabilityStates)) {
      const cap = key as CapabilityKey
      // Never touch required or unknown capabilities.
      if (!(cap in capabilities)) continue
      if (profile.capabilities[cap] !== "optional") continue
      capabilities[cap] = state
    }
  }

  let dashboardWidgets = profile.dashboardWidgets
  if (overrides.dashboardWidgets) {
    dashboardWidgets = overrides.dashboardWidgets.filter((w) => VALID_WIDGETS.has(w))
  }

  return { ...profile, capabilities, dashboardWidgets }
}

/** Which capabilities the owner may toggle (base state must be "optional"). */
export function ownerAdjustableCapabilities(
  profile: ActivityProfile
): { key: CapabilityKey; state: CapabilityState }[] {
  return (Object.keys(profile.capabilities) as CapabilityKey[])
    .filter((k) => profile.capabilities[k] === "optional")
    .map((k) => ({ key: k, state: profile.capabilities[k] }))
}
