// ============================================================
// E2-3 — projects & tasks pure rules (EPIC #2).
// These gates are shared by EVERY surface: the server actions
// refuse what these functions refuse, and the UI only offers
// transitions they allow. Locking them here locks the
// acceptance scenario: "projekt ustvarjen → naloge → zaključek"
// (a project can only complete when every task is DONE) and
// "profili brez zmožnosti ne vidijo modula" (matrix covered in
// extensions-e21.test.ts).
// ============================================================

import { describe, it, expect } from "vitest"
import {
  canTransitionProject,
  canTransitionTask,
  projectCompletionBlock,
  computeProgress,
  deadlineState,
  daysUntil,
} from "@/lib/projects/logic"

describe("E2-3 project status transitions", () => {
  it("allows the planned lifecycle: PLANNING → IN_PROGRESS → COMPLETED", () => {
    expect(canTransitionProject("PLANNING", "IN_PROGRESS")).toBe(true)
    expect(canTransitionProject("IN_PROGRESS", "COMPLETED")).toBe(true)
  })

  it("allows cancelling from both live states", () => {
    expect(canTransitionProject("PLANNING", "CANCELLED")).toBe(true)
    expect(canTransitionProject("IN_PROGRESS", "CANCELLED")).toBe(true)
  })

  it("REJECTS skipping the lifecycle (PLANNING → COMPLETED)", () => {
    expect(canTransitionProject("PLANNING", "COMPLETED")).toBe(false)
  })

  it("treats COMPLETED and CANCELLED as terminal (no resurrection, §11 audit)", () => {
    expect(canTransitionProject("COMPLETED", "IN_PROGRESS")).toBe(false)
    expect(canTransitionProject("COMPLETED", "PLANNING")).toBe(false)
    expect(canTransitionProject("COMPLETED", "CANCELLED")).toBe(false)
    expect(canTransitionProject("CANCELLED", "PLANNING")).toBe(false)
    expect(canTransitionProject("CANCELLED", "IN_PROGRESS")).toBe(false)
  })

  it("rejects no-op self transitions", () => {
    expect(canTransitionProject("PLANNING", "PLANNING")).toBe(false)
    expect(canTransitionProject("IN_PROGRESS", "IN_PROGRESS")).toBe(false)
  })
})

describe("E2-3 task status transitions", () => {
  it("allows OPEN → IN_PROGRESS → DONE", () => {
    expect(canTransitionTask("OPEN", "IN_PROGRESS")).toBe(true)
    expect(canTransitionTask("IN_PROGRESS", "DONE")).toBe(true)
  })

  it("allows skipping ahead OPEN → DONE (quick checklist ticks)", () => {
    expect(canTransitionTask("OPEN", "DONE")).toBe(true)
  })

  it("allows reopening (DONE → OPEN, DONE → IN_PROGRESS)", () => {
    expect(canTransitionTask("DONE", "OPEN")).toBe(true)
    expect(canTransitionTask("DONE", "IN_PROGRESS")).toBe(true)
  })

  it("rejects the same-state no-op", () => {
    expect(canTransitionTask("OPEN", "OPEN")).toBe(false)
    expect(canTransitionTask("DONE", "DONE")).toBe(false)
  })
})

describe("E2-3 project completion rule (THE acceptance gate)", () => {
  it("BLOCKS completion while any task is not DONE", () => {
    expect(projectCompletionBlock([{ status: "DONE" }, { status: "OPEN" }])).toBe("TASKS_OPEN")
    expect(
      projectCompletionBlock([{ status: "DONE" }, { status: "IN_PROGRESS" }])
    ).toBe("TASKS_OPEN")
    expect(projectCompletionBlock([{ status: "OPEN" }])).toBe("TASKS_OPEN")
  })

  it("allows completion when every task is DONE", () => {
    expect(projectCompletionBlock([{ status: "DONE" }, { status: "DONE" }])).toBeNull()
  })

  it("allows completion of a project without tasks (owner chose no checklist)", () => {
    expect(projectCompletionBlock([])).toBeNull()
  })
})

describe("E2-3 progress — derived, never stored (no double book-keeping)", () => {
  it("counts each status and rounds the percentage", () => {
    const p = computeProgress([
      { status: "DONE" },
      { status: "DONE" },
      { status: "IN_PROGRESS" },
      { status: "OPEN" },
    ])
    expect(p).toEqual({ total: 4, done: 2, inProgress: 1, open: 1, pct: 50 })
  })

  it("rounds 1/3 to 33%", () => {
    expect(computeProgress([{ status: "DONE" }, { status: "OPEN" }, { status: "OPEN" }]).pct).toBe(33)
  })

  it("returns 0% (not NaN) for a project without tasks", () => {
    const p = computeProgress([])
    expect(p).toEqual({ total: 0, done: 0, inProgress: 0, open: 0, pct: 0 })
  })

  it("reaches exactly 100% when every task is DONE", () => {
    expect(computeProgress([{ status: "DONE" }, { status: "DONE" }]).pct).toBe(100)
  })
})

describe("E2-3 deadline warnings (pure date math)", () => {
  const now = new Date("2026-01-15T12:00:00.000Z")

  it("flags OVERDUE when the deadline is past and the project is live", () => {
    expect(deadlineState("2026-01-10T00:00:00.000Z", "IN_PROGRESS", now)).toBe("OVERDUE")
    expect(deadlineState("2026-01-14T23:59:59.000Z", "PLANNING", now)).toBe("OVERDUE")
  })

  it("flags DUE_SOON within 7 days (inclusive)", () => {
    expect(deadlineState("2026-01-18T00:00:00.000Z", "IN_PROGRESS", now)).toBe("DUE_SOON")
    expect(deadlineState("2026-01-22T11:00:00.000Z", "IN_PROGRESS", now)).toBe("DUE_SOON")
  })

  it("stays OK beyond 7 days and without a deadline", () => {
    expect(deadlineState("2026-03-01T00:00:00.000Z", "IN_PROGRESS", now)).toBe("OK")
    expect(deadlineState(null, "IN_PROGRESS", now)).toBe("OK")
  })

  it("ignores deadlines of finished projects (COMPLETED/CANCELLED never warn)", () => {
    expect(deadlineState("2026-01-01T00:00:00.000Z", "COMPLETED", now)).toBe("OK")
    expect(deadlineState("2026-01-01T00:00:00.000Z", "CANCELLED", now)).toBe("OK")
  })

  it("daysUntil counts whole days, negative when overdue, null without deadline", () => {
    expect(daysUntil("2026-01-20T00:00:00.000Z", now)).toBe(5)
    expect(daysUntil("2026-01-10T00:00:00.000Z", now)).toBeLessThan(0)
    expect(daysUntil(null, now)).toBeNull()
  })
})
