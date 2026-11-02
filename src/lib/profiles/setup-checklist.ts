// ============================================================
// ACTIVATION CHECKLIST ("vodena namestitev") — the persistent
// setup guide that LIVES on the dashboard after the guided-entry
// wizard (the Shopify/Fresha pattern from the November 2026
// market research: wizard → checklist → next-best-action).
//
// Contract:
//   • Step completion is ALWAYS DERIVED from real business data —
//     nothing to fake and nothing to forget to store. The DB keeps
//     only the owner's UI preference (dismissed) via
//     Organization.setupChecklist.
//   • Profile-aware: steps that make no sense for the tenant's
//     capability matrix never render (a shop without staff
//     capability has no staff step).
//   • The first unfinished step is the NEXT-BEST-ACTION (nextKey)
//     — the dashboard highlights exactly one thing to do.
//   • Pure + client-safe: no server imports, fully unit-tested.
// ============================================================

export type SetupStepKey =
  | "vertical"
  | "catalog"
  | "staff"
  | "customers"
  | "publish"
  | "firstJob"

export interface SetupStep {
  key: SetupStepKey
  done: boolean
  /** Dashboard route the CTA sends the owner to. */
  href: string
}

export interface SetupChecklistInput {
  /** Guided entry confirmed at least once (verticalChosenAt != null). */
  verticalChosen: boolean
  /**
   * Owner touched the catalog AFTER the guided entry (any service or
   * product updated after verticalChosenAt) — the freshly seeded sample
   * catalog predates the confirmation timestamp, so it does not
   * self-complete this step.
   */
  catalogTouched: boolean
  catalogCapable: boolean
  staffCount: number
  staffCapable: boolean
  customerCount: number
  customersCapable: boolean
  appointmentCount: number
  orderCount: number
  appointmentsCapable: boolean
  workOrdersCapable: boolean
  /** Organization.publishState === "PUBLISHED" (new tenants start DRAFT). */
  published: boolean
}

export interface SetupChecklist {
  steps: SetupStep[]
  doneCount: number
  total: number
  allDone: boolean
  /** First unfinished step — the single thing we ask the owner to do next. */
  nextKey: SetupStepKey | null
}

/** Fixed narrative order: who → offer → team → clients → live → first job. */
const STEP_ORDER: SetupStepKey[] = [
  "vertical",
  "catalog",
  "staff",
  "customers",
  "publish",
  "firstJob",
]

export function buildSetupChecklist(input: SetupChecklistInput): SetupChecklist {
  // "firstJob" is the universal activation milestone: the first booking
  // for appointment-capable profiles, otherwise the first work order.
  const firstJobDone =
    input.appointmentsCapable
      ? input.appointmentCount > 0
      : input.workOrdersCapable
        ? input.orderCount > 0
        : true // neither capability → nothing to wait for

  const doneByKey: Record<SetupStepKey, boolean> = {
    vertical: input.verticalChosen,
    catalog: !input.catalogCapable ? true : input.catalogTouched,
    staff: !input.staffCapable ? true : input.staffCount > 1, // 1 = owner seeded by the wizard
    customers: !input.customersCapable ? true : input.customerCount > 0,
    publish: input.published,
    firstJob: firstJobDone,
  }

  const hrefByKey: Record<SetupStepKey, string> = {
    vertical: "/dashboard",
    catalog: "/dashboard/services",
    staff: "/dashboard/staff",
    customers: "/dashboard/users",
    publish: "/dashboard/settings",
    firstJob: input.appointmentsCapable
      ? "/dashboard/appointments/new"
      : "/dashboard/work-orders",
  }

  const steps = STEP_ORDER.map((key) => ({
    key,
    done: doneByKey[key],
    href: hrefByKey[key],
  }))

  const doneCount = steps.filter((s) => s.done).length
  const next = steps.find((s) => !s.done)

  return {
    steps,
    doneCount,
    total: steps.length,
    allDone: doneCount === steps.length,
    nextKey: next?.key ?? null,
  }
}
