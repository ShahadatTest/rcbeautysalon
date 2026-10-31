// ============================================================
// PROJECTS & TASKS — PURE RULES (EPIC #2 E2-3).
// These are THE gates shared by every surface (actions, UI):
// status transitions, the completion rule (a project can only
// be COMPLETED when every task is DONE), progress computation
// and deadline warnings. Pure functions — no DB, no network —
// so the actions and the tests assert the exact same behavior.
// ============================================================

export const PROJECT_STATUSES = ["PLANNING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const
export type ProjectStatusValue = (typeof PROJECT_STATUSES)[number]

export const PROJECT_TASK_STATUSES = ["OPEN", "IN_PROGRESS", "DONE"] as const
export type ProjectTaskStatusValue = (typeof PROJECT_TASK_STATUSES)[number]

// ------------------------------------------------------------
// Status transitions.
//   Project: PLANNING → IN_PROGRESS → COMPLETED; both live
//     states may be CANCELLED. Terminal states never restart
//     (a cancelled job is archived, not resurrected — audit §11).
//   Task: OPEN → IN_PROGRESS → DONE with both backward moves
//     allowed (reopen) — practical checklists change their mind;
//     the project-level completion rule stays the hard gate.
// ------------------------------------------------------------
const PROJECT_TRANSITIONS: Record<ProjectStatusValue, readonly ProjectStatusValue[]> = {
  PLANNING: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
}

const TASK_TRANSITIONS: Record<ProjectTaskStatusValue, readonly ProjectTaskStatusValue[]> = {
  OPEN: ["IN_PROGRESS", "DONE"],
  IN_PROGRESS: ["OPEN", "DONE"],
  DONE: ["OPEN", "IN_PROGRESS"],
}

export function canTransitionProject(
  from: ProjectStatusValue,
  to: ProjectStatusValue
): boolean {
  return PROJECT_TRANSITIONS[from].includes(to)
}

export function canTransitionTask(
  from: ProjectTaskStatusValue,
  to: ProjectTaskStatusValue
): boolean {
  return TASK_TRANSITIONS[from].includes(to)
}

/** Rejection reasons for the completion rule (UI maps to bilingual text). */
export type CompletionBlockReason = "TASKS_OPEN"

export interface TaskLike {
  status: ProjectTaskStatusValue
}

/**
 * THE completion rule (acceptance: "projekt ustvarjen → naloge
 * → zaključek"): a project may only be COMPLETED when every task
 * is DONE. A project without tasks completes freely (owner chose
 * not to track a checklist).
 */
export function projectCompletionBlock(
  tasks: readonly TaskLike[]
): CompletionBlockReason | null {
  const open = tasks.some((task) => task.status !== "DONE")
  return open ? "TASKS_OPEN" : null
}

// ------------------------------------------------------------
// Progress — derived counts, never stored (no double book-
// keeping: the tasks table is the single source of truth).
// ------------------------------------------------------------
export interface ProjectProgress {
  total: number
  done: number
  inProgress: number
  open: number
  /** 0–100 rounded, 0 when the project has no tasks. */
  pct: number
}

export function computeProgress(tasks: readonly TaskLike[]): ProjectProgress {
  const total = tasks.length
  let done = 0
  let inProgress = 0
  let open = 0
  for (const task of tasks) {
    if (task.status === "DONE") done++
    else if (task.status === "IN_PROGRESS") inProgress++
    else open++
  }
  return {
    total,
    done,
    inProgress,
    open,
    pct: total === 0 ? 0 : Math.round((done / total) * 100),
  }
}

// ------------------------------------------------------------
// Deadline warnings — the dashboard's „deadline" analog for
// multi-day jobs: overdue (past, not finished) and due-soon
// (within 7 days, not finished). Pure date math, UTC-safe.
// ------------------------------------------------------------
export type DeadlineState = "OK" | "DUE_SOON" | "OVERDUE"

const DUE_SOON_DAYS = 7
const MS_PER_DAY = 86_400_000

/** Non-finished statuses that still care about the deadline. */
function deadlineRelevant(status: ProjectStatusValue): boolean {
  return status === "PLANNING" || status === "IN_PROGRESS"
}

export function deadlineState(
  deadline: Date | string | null | undefined,
  status: ProjectStatusValue,
  now: Date = new Date()
): DeadlineState {
  if (!deadline || !deadlineRelevant(status)) return "OK"
  const dl = typeof deadline === "string" ? new Date(deadline) : deadline
  const diffDays = (dl.getTime() - now.getTime()) / MS_PER_DAY
  if (diffDays < 0) return "OVERDUE"
  if (diffDays <= DUE_SOON_DAYS) return "DUE_SOON"
  return "OK"
}

/** Whole days left until the deadline (negative = overdue). */
export function daysUntil(
  deadline: Date | string | null | undefined,
  now: Date = new Date()
): number | null {
  if (!deadline) return null
  const dl = typeof deadline === "string" ? new Date(deadline) : deadline
  return Math.ceil((dl.getTime() - now.getTime()) / MS_PER_DAY)
}
