// ============================================================
// E2-1 — capability extension registry tests (EPIC #2 §3/E2-1)
// Locks the acceptance criteria in place:
//   • the 5 new capability extensions load through zod
//     (import itself asserts structural validity — fail fast);
//   • dependency declarations reference only REAL universal
//     capability keys (typed dependencies, z.enum at load);
//   • NEW extensions are enabled by NO existing profile —
//     every tenant keeps today's experience (default disabled);
//   • referenced ⊆ defined + unique ids + non-empty entities.
// ============================================================

import { describe, it, expect } from "vitest"
import { EXTENSIONS, CAPABILITY_KEYS } from "@/lib/profiles/extensions"
import { listProfiles } from "@/lib/profiles/registry"
import type { CapabilityMatrix } from "@/lib/profiles/types"

const E21_IDS = [
  "projects",
  "multi-location",
  "memberships",
  "suppliers",
  "delivery-runtime",
] as const

describe("E2-1 — capability extension registry", () => {
  it("registers the 5 new capability extensions (zod-validated at load)", () => {
    for (const id of E21_IDS) {
      expect(EXTENSIONS[id], `missing extension ${id}`).toBeDefined()
    }
  })

  it("extensions without a shipped runtime are enabled by NO existing profile", () => {
    // E2-1 delivered the declarations; runtimes arrive phase by phase.
    // `suppliers` became live in E2-2 (inventory runtime) — the rest
    // must stay dormant until their phase references them.
    const DORMANT = ["projects", "multi-location", "memberships", "delivery-runtime"] as const
    for (const profile of listProfiles()) {
      for (const id of DORMANT) {
        expect(
          profile.extensions,
          `${profile.id} unexpectedly enables "${id}"`
        ).not.toContain(id)
      }
    }
  })

  it("dependency declarations reference only real universal capabilities", () => {
    for (const ext of Object.values(EXTENSIONS)) {
      expect(ext.capabilities.length, `${ext.id} must declare dependencies`).toBeGreaterThan(0)
      for (const cap of ext.capabilities) {
        expect(
          (CAPABILITY_KEYS as readonly string[]).includes(cap),
          `${ext.id} depends on unknown capability "${cap}"`
        ).toBe(true)
      }
    }
  })

  it("profiles reference only defined extensions (referenced ⊆ defined)", () => {
    for (const profile of listProfiles()) {
      for (const extId of profile.extensions) {
        expect(EXTENSIONS[extId], `${profile.id} → unknown ${extId}`).toBeDefined()
      }
    }
  })

  it("extension ids are unique and every entity has non-empty fields", () => {
    const ids = Object.keys(EXTENSIONS)
    expect(new Set(ids).size).toBe(ids.length)
    for (const ext of Object.values(EXTENSIONS)) {
      expect(ext.entities.length, ext.id).toBeGreaterThan(0)
      for (const entity of ext.entities) {
        expect(entity.fields.length, `${ext.id}.${entity.key}`).toBeGreaterThan(0)
      }
    }
  })

  it("entity keys are unique within each new extension", () => {
    for (const id of E21_IDS) {
      const ext = EXTENSIONS[id]!
      const keys = ext.entities.map((e) => e.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it("CAPABILITY_KEYS covers exactly the universal CapabilityMatrix (sync lock)", () => {
    // Compile-time `satisfies readonly CapabilityKey[]` guards soundness;
    // this locks completeness — a 14th capability must be added here too.
    const matrixKeys = Object.keys({
      appointments: 0,
      workOrders: 0,
      shop: 0,
      services: 0,
      inventory: 0,
      customers: 0,
      staff: 0,
      analytics: 0,
      reviews: 0,
      forms: 0,
      workflows: 0,
      documents: 0,
      delivery: 0,
    } satisfies Record<keyof CapabilityMatrix, number>)
    expect([...CAPABILITY_KEYS].sort()).toEqual(matrixKeys.sort())
  })
})

describe("E2-1 — dependency matrix of the new extensions", () => {
  const EXPECTED: Record<(typeof E21_IDS)[number], readonly string[]> = {
    projects: ["workOrders", "customers"],
    "multi-location": ["customers", "appointments"],
    memberships: ["customers", "shop"],
    suppliers: ["inventory"],
    "delivery-runtime": ["shop", "delivery"],
  }

  it("each new extension declares exactly its planned dependencies", () => {
    for (const [id, caps] of Object.entries(EXPECTED)) {
      expect([...EXTENSIONS[id]!.capabilities].sort(), id).toEqual([...caps].sort())
    }
  })
})

describe("E2-2 — suppliers extension runtime enablement", () => {
  // E2-2 ships the inventory runtime and enables `suppliers` on the
  // inventory-REQUIRED profiles — the supplier picker in the stock
  // movement ledger reads exactly these registry entries.
  it("inventory-required profiles enable the suppliers extension", () => {
    for (const id of ["tire-service", "beekeeping"]) {
      const profile = listProfiles().find((p) => p.id === id)!
      expect(profile.capabilities.inventory, id).toBe("required")
      expect(
        profile.extensions,
        `${id} must enable "suppliers" (E2-2)`
      ).toContain("suppliers")
    }
  })

  it("profiles WITHOUT inventory still do not enable suppliers", () => {
    for (const profile of listProfiles()) {
      if (profile.capabilities.inventory === "required") continue
      expect(
        profile.extensions,
        `${profile.id} unexpectedly enables suppliers`
      ).not.toContain("suppliers")
    }
  })
})
