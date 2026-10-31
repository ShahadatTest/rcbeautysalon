// ============================================================
// EPIC #3 E3-5 — PLATFORM AUDIT SCHEMA CONTRACT
// Structural guardrail: the PlatformAuditLog table exists, is
// org-scoped (isolation by construction), carries the actor and
// action fields, is indexed for the console's queries, and the
// Organization root carries the suspension display columns.
// ============================================================

import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const schemaPath = resolve(process.cwd(), "prisma/schema.prisma")
const schema = readFileSync(schemaPath, "utf8")

function modelBlock(name: string): string {
  const block = (schema.match(new RegExp(`model\\s+${name}\\s*\\{[^}]*\\}`, "g")) ?? [])[0]
  if (!block) throw new Error(`model ${name} missing from schema`)
  return block
}

describe("PlatformAuditLog schema contract (E3-5)", () => {
  it("exists and is org-scoped (tenant isolation by construction)", () => {
    const block = modelBlock("PlatformAuditLog")
    expect(block).toContain("organizationId String")
    // FK to Organization with cascade delete
    expect(block).toMatch(/organization\s+Organization\s+@relation\(fields:\s*\[organizationId\]/)
    expect(block).toContain("onDelete: Cascade")
  })

  it("carries the actor, action, reason and metadata fields", () => {
    const block = modelBlock("PlatformAuditLog")
    expect(block).toContain("actorEmail")
    expect(block).toContain("action")
    expect(block).toContain("reason")
    expect(block).toContain("metadata")
  })

  it("indexes the queries the console runs (per-org trail, per-action trail)", () => {
    const block = modelBlock("PlatformAuditLog")
    expect(block).toMatch(/@@index\(\[organizationId,\s*createdAt\]\)/)
    expect(block).toMatch(/@@index\(\[action,\s*createdAt\]\)/)
  })

  it("Organization carries suspension display columns (nullable)", () => {
    const block = modelBlock("Organization")
    expect(block).toContain("suspendedAt     DateTime?")
    expect(block).toContain("suspendedReason String?")
  })
})
