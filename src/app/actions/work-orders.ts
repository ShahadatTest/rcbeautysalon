"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requireAdminOrg } from "@/lib/tenant"
import { makeWorkflowEntityKey, workflowSnapshot } from "@/lib/config-history/logic"
import { recordConfigChange } from "@/lib/config-history/record"

// ============================================================
// WORK ORDERS (EPIC #1 §9 — universal workflow engine, Phase 4)
// A work order is a job tracked through the tenant's configured
// WorkflowDefinition stages (seamstress production pipeline,
// vehicle workshop work order, …). Stage transitions are
// validated server-side (adjacent stages only — skipping stages
// is rejected) and every change is appended to WorkOrderEvent,
// giving a complete audit trail.
// All queries/actions are strictly org-scoped via requireAdminOrg.
// ============================================================

/** Stage keys treated as "waiting on the customer's approval/quote". */
const APPROVAL_STAGE_PATTERN = /(approval|approved|quote)/
/** Stage keys treated as "ready for handover/delivery". */
const DELIVERY_STAGE_PATTERN = /(delivery|handover|ready)/

export interface WorkOrderListItem {
  id: string
  number: number
  title: string
  status: string
  priority: string
  dueDate: string | null
  /** OPEN with dueDate in the past — dashboard highlights it. */
  overdue: boolean
  total: number | null
  notes: string | null
  currentStageKey: string | null
  currentStageName: string | null
  currentStageOrder: number | null
  workflowDefinitionId: string | null
  workflowName: string | null
  customerName: string | null
  customerEmail: string | null
  /** Linked extension record (e.g. the vehicle being serviced). */
  linkedRecord: { id: string; title: string; entityKey: string } | null
  createdAt: string
  lastEventAt: string | null
  lastEventMessage: string | null
}

export interface WorkOrderStats {
  active: number
  dueSoon: number
  pendingApprovals: number
  readyForDelivery: number
  completedThisMonth: number
}

export interface WorkflowStageInfo {
  id: string
  key: string
  name: string
  order: number
  description: string | null
  slaHours: number | null
  isFinal: boolean
}

export interface WorkflowDefinitionInfo {
  id: string
  key: string
  name: string
  entity: string
  stages: WorkflowStageInfo[]
}

export interface WorkOrderEventItem {
  id: string
  type: string
  fromStageKey: string | null
  toStageKey: string | null
  message: string | null
  actorEmail: string | null
  createdAt: string
}

export interface WorkOrdersOverview {
  definitions: WorkflowDefinitionInfo[]
  orders: WorkOrderListItem[]
  stats: WorkOrderStats
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Compute dashboard/board stats from a list of work orders + stage metadata. */
function computeStats(
  orders: {
    status: string
    dueDate: Date | null
    currentStageKey: string | null
    updatedAt: Date
  }[]
): WorkOrderStats {
  const now = Date.now()
  const in7Days = now + 7 * 24 * 60 * 60 * 1000
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  let active = 0
  let dueSoon = 0
  let pendingApprovals = 0
  let readyForDelivery = 0
  let completedThisMonth = 0

  for (const o of orders) {
    if (o.status === "OPEN") {
      active++
      if (o.dueDate && o.dueDate.getTime() <= in7Days) dueSoon++
      const key = o.currentStageKey ?? ""
      if (APPROVAL_STAGE_PATTERN.test(key)) pendingApprovals++
      if (DELIVERY_STAGE_PATTERN.test(key)) readyForDelivery++
    }
    if (
      o.status === "COMPLETED" &&
      o.updatedAt.getTime() >= monthStart.getTime()
    ) {
      completedThisMonth++
    }
  }

  return { active, dueSoon, pendingApprovals, readyForDelivery, completedThisMonth }
}

/** Overview for the work orders page: definitions, orders, stats. */
export async function getWorkOrdersOverview(): Promise<WorkOrdersOverview> {
  const { org } = await requireAdminOrg()

  const [definitions, orders] = await Promise.all([
    prisma.workflowDefinition.findMany({
      where: { organizationId: org.id, isActive: true, entity: "order" },
      include: { stages: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.workOrder.findMany({
      where: { organizationId: org.id },
      include: {
        customer: { select: { name: true, email: true } },
        linkedRecord: { select: { id: true, title: true, entityKey: true } },
        events: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
  ])

  const stats = computeStats(
    orders.map((o) => ({
      status: o.status,
      dueDate: o.dueDate,
      currentStageKey: o.currentStageKey,
      updatedAt: o.updatedAt,
    }))
  )

  const ordersSerialized = orders.map((o) => {
    const ownDef = definitions.find((d) => d.id === o.workflowDefinitionId)
    const ownStage = ownDef?.stages.find((s) => s.key === o.currentStageKey)
    return {
      id: o.id,
      number: o.number,
      title: o.title,
      status: o.status,
      priority: o.priority,
      dueDate: o.dueDate?.toISOString() ?? null,
      overdue:
        o.status === "OPEN" &&
        !!o.dueDate &&
        o.dueDate.getTime() < Date.now(),
      total: toNumber(o.total),
      notes: o.notes,
      currentStageKey: o.currentStageKey,
      currentStageName: ownStage?.name ?? null,
      currentStageOrder: ownStage?.order ?? null,
      workflowDefinitionId: o.workflowDefinitionId,
      workflowName: ownDef?.name ?? null,
      customerName: o.customer?.name ?? null,
      customerEmail: o.customer?.email ?? null,
      linkedRecord: o.linkedRecord
        ? {
            id: o.linkedRecord.id,
            title: o.linkedRecord.title,
            entityKey: o.linkedRecord.entityKey,
          }
        : null,
      createdAt: o.createdAt.toISOString(),
      lastEventAt: o.events[0]?.createdAt.toISOString() ?? null,
      lastEventMessage: o.events[0]?.message ?? null,
    }
  })

  return {
    definitions: definitions.map((d) => ({
      id: d.id,
      key: d.key,
      name: d.name,
      entity: d.entity,
      stages: d.stages.map((s) => ({
        id: s.id,
        key: s.key,
        name: s.name,
        order: s.order,
        description: s.description,
        slaHours: s.slaHours,
        isFinal: s.isFinal,
      })),
    })),
    orders: ordersSerialized,
    stats,
  }
}

export interface WorkOrderDetail {
  id: string
  number: number
  title: string
  status: string
  priority: string
  dueDate: string | null
  total: number | null
  notes: string | null
  createdAt: string
  customer: { id: string; name: string; email: string | null; phone: string | null } | null
  workflow: WorkflowDefinitionInfo | null
  currentStageKey: string | null
  /** Linked extension record with its declared fields (e.g. vehicle data). */
  linkedRecord: {
    id: string
    entityKey: string
    entityName: string
    title: string
    data: Record<string, unknown>
    fields: { key: string; label: string; unit?: string }[]
  } | null
  events: WorkOrderEventItem[]
  sourceSubmissionId: string | null
}

/** Full detail of one work order (org-scoped) with the audit trail. */
export async function getWorkOrderDetail(id: string): Promise<WorkOrderDetail | null> {
  const { org } = await requireAdminOrg()

  const order = await prisma.workOrder.findFirst({
    where: { id, organizationId: org.id },
    include: {
      customer: true,
      workflowDefinition: { include: { stages: { orderBy: { order: "asc" } } } },
      linkedRecord: true,
      events: { orderBy: { createdAt: "asc" } },
    },
  })
  if (!order) return null

  // Entity display name comes from the extension registry (data-driven).
  let linkedRecord: WorkOrderDetail["linkedRecord"] = null
  if (order.linkedRecord) {
    const { getExtension } = await import("@/lib/profiles/extensions")
    const ext = getExtension(order.linkedRecord.extensionId)
    const entity = ext?.entities.find((e) => e.key === order.linkedRecord!.entityKey)
    linkedRecord = {
      id: order.linkedRecord.id,
      entityKey: order.linkedRecord.entityKey,
      entityName: entity?.name ?? order.linkedRecord.entityKey,
      title: order.linkedRecord.title,
      data: (order.linkedRecord.data && typeof order.linkedRecord.data === "object"
        ? order.linkedRecord.data
        : {}) as Record<string, unknown>,
      fields: (entity?.fields ?? []).map((f) => ({
        key: f.key,
        label: f.label,
        ...(f.unit ? { unit: f.unit } : {}),
      })),
    }
  }

  return {
    id: order.id,
    number: order.number,
    title: order.title,
    status: order.status,
    priority: order.priority,
    dueDate: order.dueDate?.toISOString() ?? null,
    total: toNumber(order.total),
    notes: order.notes,
    createdAt: order.createdAt.toISOString(),
    customer: order.customer
      ? {
          id: order.customer.id,
          name: order.customer.name,
          email: order.customer.email,
          phone: order.customer.phone,
        }
      : null,
    workflow: order.workflowDefinition
      ? {
          id: order.workflowDefinition.id,
          key: order.workflowDefinition.key,
          name: order.workflowDefinition.name,
          entity: order.workflowDefinition.entity,
          stages: order.workflowDefinition.stages.map((s) => ({
            id: s.id,
            key: s.key,
            name: s.name,
            order: s.order,
            description: s.description,
            slaHours: s.slaHours,
            isFinal: s.isFinal,
          })),
        }
      : null,
    currentStageKey: order.currentStageKey,
    linkedRecord,
    events: order.events.map((e) => ({
      id: e.id,
      type: e.type,
      fromStageKey: e.fromStageKey,
      toStageKey: e.toStageKey,
      message: e.message,
      actorEmail: e.actorEmail,
      createdAt: e.createdAt.toISOString(),
    })),
    sourceSubmissionId: order.sourceSubmissionId,
  }
}

export interface CreateWorkOrderInput {
  title: string
  customerId?: string | null
  dueDate?: string | null
  priority?: string
  notes?: string | null
  total?: number | null
  workflowDefinitionId?: string | null
  /** Optional extension record link (e.g. vehicle in a workshop). */
  linkedRecordId?: string | null
}

export interface WorkOrderActionResult {
  ok: boolean
  error?: string
  id?: string
}

/**
 * Create a work order in the FIRST stage of the tenant's active
 * "order" workflow. Human-friendly per-tenant number = max+1.
 */
export async function createWorkOrder(
  input: CreateWorkOrderInput
): Promise<WorkOrderActionResult> {
  const { org, session } = await requireAdminOrg()
  const title = input.title?.trim()
  if (!title) return { ok: false, error: "MISSING_TITLE" }

  const definition = await prisma.workflowDefinition.findFirst({
    where: {
      organizationId: org.id,
      isActive: true,
      entity: "order",
      ...(input.workflowDefinitionId ? { id: input.workflowDefinitionId } : {}),
    },
    include: { stages: { orderBy: { order: "asc" } } },
  })
  if (!definition || definition.stages.length === 0) {
    return { ok: false, error: "NO_WORKFLOW" }
  }
  const firstStage = definition.stages[0]

  // Linked extension record must exist in THIS tenant (§3 isolation).
  let linkedRecordId: string | null = null
  if (input.linkedRecordId) {
    const rec = await prisma.extensionRecord.findFirst({
      where: { id: input.linkedRecordId, organizationId: org.id },
      select: { id: true },
    })
    if (rec) linkedRecordId = rec.id
  }

  const created = await prisma.$transaction(async (tx) => {
    const max = await tx.workOrder.aggregate({
      where: { organizationId: org.id },
      _max: { number: true },
    })
    const number = (max._max.number ?? 0) + 1
    return tx.workOrder.create({
      data: {
        organizationId: org.id,
        number,
        title,
        status: "OPEN",
        priority: input.priority ?? "NORMAL",
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        total:
          input.total !== null && input.total !== undefined
            ? input.total
            : null,
        notes: input.notes?.trim() || null,
        customerId: input.customerId || null,
        linkedRecordId,
        workflowDefinitionId: definition.id,
        currentStageKey: firstStage.key,
        events: {
          create: {
            organizationId: org.id,
            type: "CREATED",
            toStageKey: firstStage.key,
            message: title,
            actorEmail: session.user?.email ?? null,
          },
        },
      },
    })
  })

  revalidatePath("/dashboard/work-orders")
  revalidatePath("/dashboard")
  return { ok: true, id: created.id }
}

/**
 * Move a work order to another workflow stage. Server-side
 * validation: only ADJACENT stages are allowed (no skipping), the
 * order must be OPEN, and the target stage must belong to the
 * order's workflow definition. Moving into the final stage
 * completes the order. Every transition is recorded as an event.
 */
export async function advanceWorkOrder(
  id: string,
  toStageKey: string
): Promise<WorkOrderActionResult> {
  const { org, session } = await requireAdminOrg()

  const order = await prisma.workOrder.findFirst({
    where: { id, organizationId: org.id },
    include: {
      workflowDefinition: { include: { stages: { orderBy: { order: "asc" } } } },
    },
  })
  if (!order) return { ok: false, error: "NOT_FOUND" }
  if (order.status !== "OPEN") return { ok: false, error: "NOT_OPEN" }
  if (!order.workflowDefinition) return { ok: false, error: "NO_WORKFLOW" }

  const stages = order.workflowDefinition.stages
  const current = stages.find((s) => s.key === order.currentStageKey)
  const target = stages.find((s) => s.key === toStageKey)
  if (!current) return { ok: false, error: "INVALID_CURRENT" }
  if (!target) return { ok: false, error: "UNKNOWN_STAGE" }
  if (current.isFinal) return { ok: false, error: "ALREADY_FINAL" }
  if (Math.abs(target.order - current.order) !== 1) {
    return { ok: false, error: "INVALID_TRANSITION" }
  }

  const completed = target.isFinal
  await prisma.$transaction([
    prisma.workOrder.update({
      where: { id: order.id },
      data: {
        currentStageKey: target.key,
        status: completed ? "COMPLETED" : "OPEN",
      },
    }),
    prisma.workOrderEvent.create({
      data: {
        organizationId: org.id,
        workOrderId: order.id,
        type: completed ? "STATUS_CHANGED" : "STAGE_CHANGED",
        fromStageKey: current.key,
        toStageKey: target.key,
        message: completed ? `Zaključeno: ${target.name}` : target.name,
        actorEmail: session.user?.email ?? null,
      },
    }),
  ])

  revalidatePath("/dashboard/work-orders")
  revalidatePath(`/dashboard/work-orders/${id}`)
  revalidatePath("/dashboard")
  return { ok: true, id: order.id }
}

/** Cancel an open work order (audit event, history preserved). */
export async function cancelWorkOrder(id: string): Promise<WorkOrderActionResult> {
  const { org, session } = await requireAdminOrg()

  const order = await prisma.workOrder.findFirst({
    where: { id, organizationId: org.id },
  })
  if (!order) return { ok: false, error: "NOT_FOUND" }
  if (order.status !== "OPEN") return { ok: false, error: "NOT_OPEN" }

  await prisma.$transaction([
    prisma.workOrder.update({
      where: { id: order.id },
      data: { status: "CANCELLED" },
    }),
    prisma.workOrderEvent.create({
      data: {
        organizationId: org.id,
        workOrderId: order.id,
        type: "STATUS_CHANGED",
        fromStageKey: order.currentStageKey,
        message: "Naročilo preklicano",
        actorEmail: session.user?.email ?? null,
      },
    }),
  ])

  revalidatePath("/dashboard/work-orders")
  revalidatePath(`/dashboard/work-orders/${id}`)
  revalidatePath("/dashboard")
  return { ok: true, id: order.id }
}

/** Append a free-text note to the audit trail. */
export async function addWorkOrderNote(
  id: string,
  message: string
): Promise<WorkOrderActionResult> {
  const { org, session } = await requireAdminOrg()
  const text = message?.trim()
  if (!text) return { ok: false, error: "EMPTY_NOTE" }

  const order = await prisma.workOrder.findFirst({
    where: { id, organizationId: org.id },
  })
  if (!order) return { ok: false, error: "NOT_FOUND" }

  await prisma.workOrderEvent.create({
    data: {
      organizationId: org.id,
      workOrderId: order.id,
      type: "NOTE",
      message: text,
      actorEmail: session.user?.email ?? null,
    },
  })

  revalidatePath(`/dashboard/work-orders/${id}`)
  return { ok: true, id: order.id }
}

/** Customers for the create dialog (org-scoped, minimal fields). */
export async function listWorkOrderCustomers(): Promise<
  { id: string; name: string; email: string | null }[]
> {
  const { org } = await requireAdminOrg()
  const customers = await prisma.customer.findMany({
    where: { organizationId: org.id },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
    take: 200,
  })
  return customers
}

// ------------------------------------------------------------
// Workflow stage editor (EPIC #1 §9 — Phase 5, owner customization)
// ------------------------------------------------------------

export interface UpdateStagesResult {
  ok: boolean
  error?: string
}

export interface StageInput {
  /** Existing stage id — present = update, absent = create. */
  id?: string
  name: string
  slaHours?: number | null
}

/**
 * Owner edit of the tenant's workflow stages (no code needed):
 * rename, add, remove and reorder stages. Safety rules:
 *   • stages are org-scoped (copy-on-write definition);
 *   • orders standing in a REMOVED stage are moved to the previous
 *     stage in the new list (inside a transaction, with an audit
 *     event per affected order);
 *   • the last stage is always the final one (completes the order);
 *   • the definition version is bumped on every save.
 */
export async function updateWorkflowStages(
  definitionId: string,
  stages: StageInput[]
): Promise<UpdateStagesResult> {
  try {
    const { org, session } = await requireAdminOrg()

    // Basic shape validation.
    const clean = stages
      .map((s) => ({ name: (s.name || "").trim().slice(0, 80), slaHours: s.slaHours ?? null }))
      .filter((s) => s.name.length > 0)
    if (clean.length < 1 || clean.length > 20) return { ok: false, error: "INVALID" }

    const definition = await prisma.workflowDefinition.findFirst({
      where: { id: definitionId, organizationId: org.id },
      include: { stages: { orderBy: { order: "asc" } } },
    })
    if (!definition) return { ok: false, error: "NOT_FOUND" }

    // Existing ids we keep = those sent by the client that exist on this definition.
    const existingIds = new Set(definition.stages.map((s) => s.id))
    const keepIds = stages
      .map((s) => s.id)
      .filter((id): id is string => typeof id === "string" && existingIds.has(id))

    // Removed stages — orders reference stages by KEY, so keys matter here.
    const removedStages = definition.stages.filter((s) => !keepIds.includes(s.id))
    const removedKeys = removedStages.map((s) => s.key)

    // Open orders standing in removed stages (key-based reference).
    const affectedOrders =
      removedKeys.length > 0
        ? await prisma.workOrder.findMany({
            where: {
              organizationId: org.id,
              workflowDefinitionId: definition.id,
              currentStageKey: { in: removedKeys },
              status: "OPEN",
            },
            select: { id: true, currentStageKey: true },
          })
        : []

    // Map each removed stage's old position → fallback stage in the NEW list.
    const newCount = clean.length
    const fallbackKeyByOldKey = new Map<string, string>()
    for (const removed of removedStages) {
      const idx = Math.min(removed.order, newCount - 1)
      if (idx >= 0 && clean[idx]) {
        fallbackKeyByOldKey.set(removed.key, clean[idx].name)
      }
    }

    await prisma.$transaction(async (tx) => {
      // 1. Delete removed stages.
      const deleteIds = removedStages.map((s) => s.id)
      if (deleteIds.length > 0) {
        await tx.workflowStage.deleteMany({ where: { id: { in: deleteIds } } })
      }

      // 2. Update kept + create new stages in the submitted order.
      for (let i = 0; i < stages.length; i++) {
        const input = stages[i]
        const name = (input.name || "").trim().slice(0, 80)
        if (!name) continue
        const sla = input.slaHours ?? null
        const isFinal = i === stages.length - 1
        if (input.id && existingIds.has(input.id)) {
          await tx.workflowStage.update({
            where: { id: input.id },
            data: { name, order: i, slaHours: sla, isFinal },
          })
        } else {
          await tx.workflowStage.create({
            data: {
              definitionId: definition.id,
              key: `stage-${i + 1}-${Math.random().toString(36).slice(2, 8)}`,
              name,
              order: i,
              slaHours: sla,
              isFinal,
            },
          })
        }
      }

      // 3. Move open orders standing in removed stages to the fallback
      //    stage (same position), with an audit event per order.
      if (affectedOrders.length > 0) {
        const remaining = await tx.workflowStage.findMany({
          where: { definitionId: definition.id },
          orderBy: { order: "asc" },
          select: { key: true, name: true },
        })
        for (const order of affectedOrders) {
          if (!order.currentStageKey) continue
          const fallbackName = fallbackKeyByOldKey.get(order.currentStageKey)
          const fallback =
            remaining.find((s) => s.name === fallbackName) ?? remaining[remaining.length - 1]
          if (!fallback) continue
          await tx.workOrder.update({
            where: { id: order.id },
            data: { currentStageKey: fallback.key },
          })
          await tx.workOrderEvent.create({
            data: {
              organizationId: org.id,
              workOrderId: order.id,
              type: "STAGE_MOVED",
              message: `Stopnja je bila odstranjena iz procesa — naročilo je premaknjeno na „${fallback.name}".`,
              actorEmail: "system",
            },
          })
        }
      }

      // 4. Bump the definition version.
      await tx.workflowDefinition.update({
        where: { id: definition.id },
        data: { version: { increment: 1 } },
      })

      // 5. E2-5: append-only config history — previous snapshot (pre-read
      //    definition with stages) + the NEW state read inside the same tx.
      const afterStages = await tx.workflowStage.findMany({
        where: { definitionId: definition.id },
        orderBy: { order: "asc" },
      })
      await recordConfigChange({
        organizationId: org.id,
        actorEmail: session.user.email ?? "",
        entityKey: makeWorkflowEntityKey(definition.key),
        action: "UPDATE",
        previous: workflowSnapshot({ name: definition.name, stages: definition.stages }),
        next: workflowSnapshot({ name: definition.name, stages: afterStages }),
        tx,
      })
    })

    revalidatePath("/dashboard/work-orders")
    revalidatePath("/dashboard")
    return { ok: true }
  } catch (error) {
    console.error("updateWorkflowStages error:", error)
    return { ok: false, error: "GENERIC" }
  }
}
