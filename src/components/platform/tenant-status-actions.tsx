"use client"

// Suspend / reactivate actions for a tenant. The reason is REQUIRED
// for suspension (audit trail + owner display), optional on
// reactivation. Server actions enforce everything again — this UI
// is never the security boundary.

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Ban, Play } from "lucide-react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { suspendTenant, reactivateTenant } from "@/app/actions/platform"
import { SUSPENSION_REASON_MAX } from "@/lib/platform/access"
import type { PlatformLabels } from "@/lib/platform/labels"

interface TenantStatusActionsProps {
  orgId: string
  orgName: string
  status: string
  labels: PlatformLabels
  size?: "default" | "sm"
  showLabels?: boolean
}

export function TenantStatusActions({
  orgId,
  orgName,
  status,
  labels,
  size = "sm",
  showLabels = true,
}: TenantStatusActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dialog, setDialog] = useState<"SUSPEND" | "REACTIVATE" | null>(null)
  const [reason, setReason] = useState("")

  const suspended = status === "SUSPENDED"

  function openDialog() {
    setReason("")
    setDialog(suspended ? "REACTIVATE" : "SUSPEND")
  }

  async function submit() {
    const currentDialog = dialog
    if (!currentDialog) return
    const result =
      currentDialog === "SUSPEND"
        ? await suspendTenant(orgId, reason)
        : await reactivateTenant(orgId, reason)

    if (result.success) {
      toast.success(
        currentDialog === "SUSPEND" ? labels.toastSuspended : labels.toastReactivated
      )
      setDialog(null)
      startTransition(() => router.refresh())
      return
    }

    const message =
      result.code === "INVALID_REASON"
        ? labels.errorInvalidReason
        : result.code === "INVALID_TRANSITION"
          ? labels.errorInvalidTransition
          : result.code === "NOT_FOUND"
            ? labels.errorNotFound
            : labels.errorGeneric
    toast.error(message)
  }

  return (
    <>
      <Button
        variant={suspended ? "default" : "outline"}
        size={size}
        onClick={openDialog}
        disabled={isPending}
        className={suspended ? undefined : "text-destructive hover:text-destructive"}
      >
        {suspended ? (
          <Play className={showLabels ? "mr-2 h-4 w-4" : "h-4 w-4"} aria-hidden="true" />
        ) : (
          <Ban className={showLabels ? "mr-2 h-4 w-4" : "h-4 w-4"} aria-hidden="true" />
        )}
        {showLabels ? (suspended ? labels.reactivate : labels.suspend) : <span className="sr-only">{suspended ? labels.reactivate : labels.suspend}</span>}
      </Button>

      <AlertDialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialog === "SUSPEND" ? labels.suspendTitle : labels.reactivateTitle}
              {" — "}
              {orgName}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialog === "SUSPEND"
                ? labels.suspendDescription
                : labels.reactivateDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`reason-${orgId}`}>
              {dialog === "SUSPEND" ? labels.reasonLabel : labels.reasonOptionalLabel}
            </Label>
            <Textarea
              id={`reason-${orgId}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={labels.reasonPlaceholder}
              maxLength={SUSPENSION_REASON_MAX}
              rows={3}
              required={dialog === "SUSPEND"}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{labels.cancel}</AlertDialogCancel>
            <Button
              onClick={submit}
              disabled={isPending || (dialog === "SUSPEND" && reason.trim().length < 3)}
              className={
                dialog === "SUSPEND"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
                }
            >
              {dialog === "SUSPEND" ? labels.confirmSuspend : labels.confirmReactivate}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
