import Link from "next/link"
import { Button } from "@/components/ui/button"
import { getWorkOrderDetail } from "@/app/actions/work-orders"
import { getServerI18n } from "@/lib/i18n/server"
import { WorkOrderDetailClient } from "@/components/admin/work-orders/work-order-detail-client"
import { requirePagePermission } from "@/lib/auth/guards"

// ============================================================
// WORK ORDER DETAIL (EPIC #1 §9 — Phase 4)
// Stage stepper (current highlighted), validated transitions
// (adjacent only, enforced in the server action), full audit
// timeline and internal notes.
// ============================================================

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // Custom roles (E4-6b): server-side page guard
  await requirePagePermission("workorders.manage")
  const { id } = await params
  const [{ t, locale }, order] = await Promise.all([
    getServerI18n(),
    getWorkOrderDetail(id),
  ])
  const w = t.workForms.workOrders

  if (!order) {
    return (
      <div className="space-y-4">
        <Button variant="outline" asChild>
          <Link href="/dashboard/work-orders">← {w.title}</Link>
        </Button>
        <p className="text-muted-foreground py-16 text-center">
          {w.errors.NOT_FOUND}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/work-orders">← {w.title}</Link>
        </Button>
      </div>

      <WorkOrderDetailClient
        order={order}
        labels={{
          stage: w.stage,
          status: w.status,
          priority: w.priority,
          customer: w.customer,
          dueDate: w.dueDate,
          notes: w.notes,
          created: w.created,
          noCustomer: w.noCustomer,
          statusLabels: w.statusLabels,
          priorityLabels: w.priorityLabels,
          workflow: w.detail.workflow,
          history: w.detail.history,
          advance: w.detail.advance,
          back: w.detail.back,
          cancel: w.detail.cancel,
          addNote: w.detail.addNote,
          notePlaceholder: w.detail.notePlaceholder,
          noteAdded: w.detail.noteAdded,
          noHistory: w.detail.noHistory,
          stageOfTemplate: w.detail.stageOfTemplate,
          finalStage: w.detail.finalStage,
        }}
        errorLabels={w.errors}
        locale={locale}
      />
    </div>
  )
}
