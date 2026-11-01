// ============================================================
// CONFIG HISTORY (EPIC #2 E2-5, G5) — pure logic.
// Append-only history of tenant configuration edits with JSON
// snapshots. Core invariants (locked by tests):
//   • versions are monotonic per (org, entityKey), starting at 1;
//   • a revert applies a stored snapshot and appends a NEW
//     version entry — history is never rewritten or deleted;
//   • snapshots are plain JSON-safe objects (Json column);
//   • entityKey namespace: "profileOverrides" | "form:{key}" |
//     "workflow:{key}".
// Client-safe: pure functions, NO server-only imports.
// ============================================================

export type ConfigSnapshot = Record<string, unknown> | null

export type ConfigChangeAction = "UPDATE" | "RESET" | "REVERT"

/** The per-org+entity version always moves forward. */
export function nextVersion(lastVersion: number | null | undefined): number {
  return (lastVersion ?? 0) + 1
}

// ---------- entityKey namespace ----------

export const OVERRIDES_ENTITY_KEY = "profileOverrides"

export function makeFormEntityKey(formKey: string): string {
  return `form:${formKey}`
}

export function makeWorkflowEntityKey(workflowKey: string): string {
  return `workflow:${workflowKey}`
}

export type ConfigEntityKind = "overrides" | "form" | "workflow" | "unknown"

export function describeEntityKey(
  entityKey: string
): { kind: ConfigEntityKind; key: string | null } {
  if (entityKey === OVERRIDES_ENTITY_KEY) return { kind: "overrides", key: null }
  if (entityKey.startsWith("form:")) return { kind: "form", key: entityKey.slice(5) }
  if (entityKey.startsWith("workflow:")) {
    return { kind: "workflow", key: entityKey.slice(9) }
  }
  return { kind: "unknown", key: null }
}

// ---------- snapshot builders (plain, JSON-safe) ----------

export interface FormDefLike {
  name: string
  fields: unknown
  isActive: boolean
}

/** Snapshot of a form definition — exactly what the editor can change. */
export function formSnapshot(def: FormDefLike): ConfigSnapshot {
  return {
    name: def.name,
    isActive: def.isActive,
    fields: Array.isArray(def.fields) ? def.fields : [],
  }
}

export interface WorkflowStageLike {
  key: string
  name: string
  order: number
  slaHours: number | null
  isFinal: boolean
}

export interface WorkflowDefLike {
  name: string
  stages: WorkflowStageLike[]
}

/**
 * Snapshot of a workflow definition. Stage KEYS are included: open
 * work orders reference stages by key, so a revert must restore the
 * same keys to keep standing orders resolvable.
 */
export function workflowSnapshot(def: WorkflowDefLike): ConfigSnapshot {
  return {
    name: def.name,
    stages: [...def.stages]
      .sort((a, b) => a.order - b.order)
      .map((s) => ({
        key: s.key,
        name: s.name,
        order: s.order,
        slaHours: s.slaHours,
        isFinal: s.isFinal,
      })),
  }
}

/**
 * Snapshot of the owner overrides JSON (tolerant, mirrors
 * parseOverrides semantics: unknown shapes → null).
 */
export function overridesSnapshot(json: unknown): ConfigSnapshot {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null
  const raw = json as Record<string, unknown>
  if (typeof raw.v !== "number") return null
  const out: Record<string, unknown> = { v: raw.v }
  if (raw.capabilityStates && typeof raw.capabilityStates === "object" && !Array.isArray(raw.capabilityStates)) {
    out.capabilityStates = raw.capabilityStates
  }
  if (Array.isArray(raw.dashboardWidgets)) {
    out.dashboardWidgets = raw.dashboardWidgets
  }
  return out
}

// ---------- revert eligibility ----------

/** A stored entry is revertable iff it has a restored (next) snapshot (a real object). */
export function isRevertable(entry: { next: unknown }): boolean {
  return entry.next != null && typeof entry.next === "object" && !Array.isArray(entry.next)
}

/**
 * Version summary for the history UI: the newest entry wins.
 * Pure helper used by the reader action to merge "current" info.
 */
export function currentVersionOf(
  entries: { version: number }[]
): number | null {
  if (entries.length === 0) return null
  return entries.reduce((max, e) => (e.version > max ? e.version : max), entries[0].version)
}
