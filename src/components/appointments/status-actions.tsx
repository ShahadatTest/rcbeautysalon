"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { SpinnerIcon } from "@/components/icons"
import { updateAppointmentStatus } from "@/app/actions/appointments"
import { AppointmentStatus } from "@/lib/types"
import { StatusActionsProps } from "@/lib/interfaces"
import { toast } from "sonner"
import { useI18n } from "@/lib/i18n/provider"

const statusTransitions: Record<
  AppointmentStatus,
  { status: AppointmentStatus; variant?: "default" | "destructive" | "outline" }[]
> = {
  PENDING: [
    { status: "CONFIRMED" },
    { status: "CANCELLED", variant: "destructive" },
  ],
  CONFIRMED: [
    { status: "COMPLETED" },
    { status: "NO_SHOW", variant: "outline" },
    { status: "CANCELLED", variant: "destructive" },
  ],
  COMPLETED: [],
  CANCELLED: [{ status: "PENDING", variant: "outline" }],
  NO_SHOW: [{ status: "PENDING", variant: "outline" }],
}

export function AppointmentStatusActions({
  appointmentId,
  currentStatus,
}: StatusActionsProps) {
  const router = useRouter()
  const { t } = useI18n()
  const [isPending, startTransition] = useTransition()
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)

  const actionLabels: Record<AppointmentStatus, string> = {
    PENDING: t.appointments.statusActions.reopenPending,
    CONFIRMED: t.appointments.statusActions.confirm,
    COMPLETED: t.appointments.statusActions.markComplete,
    CANCELLED: t.common.actions.cancel,
    NO_SHOW: t.appointments.statusActions.noShow,
  }

  const statusLabels: Record<AppointmentStatus, string> = {
    PENDING: t.common.status.PENDING,
    CONFIRMED: t.common.status.CONFIRMED,
    COMPLETED: t.common.status.COMPLETED,
    CANCELLED: t.common.status.CANCELLED,
    NO_SHOW: t.common.status.NO_SHOW,
  }

  const actions = (statusTransitions[currentStatus] || []).map((action) => ({
    ...action,
    label: actionLabels[action.status],
  }))

  const handleStatusChange = (newStatus: AppointmentStatus) => {
    setPendingStatus(newStatus)
    startTransition(async () => {
      try {
        await updateAppointmentStatus(appointmentId, newStatus)
        toast.success(
          t.appointments.statusActions.statusUpdated(statusLabels[newStatus])
        )
        router.refresh()
      } catch (error) {
        console.error("Failed to update status:", error)
        toast.error(t.appointments.statusActions.updateFailed)
      } finally {
        setPendingStatus(null)
      }
    })
  }

  if (actions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t.appointments.statusActions.noActions}
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action.status}
          variant={action.variant || "outline"}
          size="sm"
          disabled={isPending}
          onClick={() => handleStatusChange(action.status)}
        >
          {pendingStatus === action.status ? (
            <SpinnerIcon size={16} className="animate-spin" />
          ) : (
            action.label
          )}
        </Button>
      ))}
    </div>
  )
}
