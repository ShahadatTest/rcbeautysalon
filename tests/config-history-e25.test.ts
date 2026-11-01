// ============================================================
// E2-5 — configuration history + rollback tests (EPIC #2 §3/E2-5, G5)
// Locks the acceptance criteria in place (pure logic — the DB write
// path is guarded by the @@unique(organizationId, entityKey, version)
// constraint and the single recordConfigChange gate):
//   • versions are monotonic per (org, entity), starting at 1;
//   • snapshots are JSON-safe and non-mutating;
//   • workflow snapshots KEEP stage keys (open orders reference
//     stages by key — a revert must stay resolvable);
//   • overrides snapshots mirror the tolerant parseOverrides shape;
//   • entityKey namespace round-trips;
//   • revert eligibility: entries without a next snapshot are not
//     revertable (a RESET is not a revert target).
// ============================================================

import { describe, it, expect } from "vitest"
import {
  currentVersionOf,
  describeEntityKey,
  formSnapshot,
  isRevertable,
  makeFormEntityKey,
  makeWorkflowEntityKey,
  nextVersion,
  OVERRIDES_ENTITY_KEY,
  overridesSnapshot,
  workflowSnapshot,
} from "@/lib/config-history/logic"

describe("E2-5 — version monotonicity", () => {
  it("first version is 1, then always +1", () => {
    expect(nextVersion(null)).toBe(1)
    expect(nextVersion(undefined)).toBe(1)
    expect(nextVersion(0)).toBe(1)
    expect(nextVersion(1)).toBe(2)
    expect(nextVersion(7)).toBe(8)
  })

  it("currentVersionOf picks the newest entry (or null when empty)", () => {
    expect(currentVersionOf([])).toBeNull()
    expect(currentVersionOf([{ version: 3 }, { version: 9 }, { version: 5 }])).toBe(9)
  })
})

describe("E2-5 — entityKey namespace", () => {
  it("round-trips form and workflow keys", () => {
    expect(makeFormEntityKey("order-details")).toBe("form:order-details")
    expect(makeWorkflowEntityKey("production-order")).toBe("workflow:production-order")

    expect(describeEntityKey("form:order-details")).toEqual({ kind: "form", key: "order-details" })
    expect(describeEntityKey("workflow:production-order")).toEqual({
      kind: "workflow",
      key: "production-order",
    })
    expect(describeEntityKey(OVERRIDES_ENTITY_KEY)).toEqual({ kind: "overrides", key: null })
    expect(describeEntityKey("nope")).toEqual({ kind: "unknown", key: null })
  })
})

describe("E2-5 — snapshots", () => {
  it("form snapshot captures exactly what the editor can change", () => {
    const def = {
      name: "Naročilo",
      isActive: true,
      fields: [{ key: "garment_type", label: "Vrsta", type: "select", required: true }],
    }
    const snap = formSnapshot(def)
    expect(snap).toEqual({
      name: "Naročilo",
      isActive: true,
      fields: def.fields,
    })
    // Non-array fields degrade to an empty array (JSON-safe).
    expect(formSnapshot({ name: "x", fields: "bad" as unknown, isActive: false })).toEqual({
      name: "x",
      isActive: false,
      fields: [],
    })
  })

  it("workflow snapshot sorts stages and KEEPS keys (orders reference keys)", () => {
    const def = {
      name: "Proizvodni proces",
      stages: [
        { key: "b-stage", name: "Šivanje", order: 1, slaHours: 24, isFinal: false },
        { key: "a-stage", name: "Sprejem", order: 0, slaHours: null, isFinal: false },
        { key: "c-stage", name: "Predaja", order: 2, slaHours: null, isFinal: true },
      ],
    }
    const snap = workflowSnapshot(def)
    expect((snap?.stages as { key: string }[]).map((s) => s.key)).toEqual([
      "a-stage",
      "b-stage",
      "c-stage",
    ])
    // Input is never mutated.
    expect(def.stages[0].order).toBe(1)
  })

  it("overrides snapshot mirrors parseOverrides tolerance", () => {
    expect(
      overridesSnapshot({ v: 1, capabilityStates: { shop: "disabled" }, junk: true })
    ).toEqual({ v: 1, capabilityStates: { shop: "disabled" } })
    expect(overridesSnapshot(null)).toBeNull()
    expect(overridesSnapshot("nope")).toBeNull()
    expect(overridesSnapshot({ noVersion: true })).toBeNull()
    expect(
      overridesSnapshot({ v: 1, dashboardWidgets: ["revenue", "revenue", "customers"] })
    ).toEqual({ v: 1, dashboardWidgets: ["revenue", "revenue", "customers"] })
  })
})

describe("E2-5 — revert eligibility (append-only invariant)", () => {
  it("entries with a next snapshot are revertable; RESET entries (next=null) are not", () => {
    expect(isRevertable({ next: { name: "x" } })).toBe(true)
    expect(isRevertable({ next: [] })).toBe(false)
    expect(isRevertable({ next: null })).toBe(false)
    expect(isRevertable({ next: undefined })).toBe(false)
  })
})
