"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { TrashIcon } from "@/components/icons"
import { SpinnerIcon } from "@/components/icons/spinner-icon"
import { deleteStaffMember } from "@/app/actions/staff"
import { toast } from "sonner"
import { useI18n } from "@/lib/i18n/provider"

interface DeleteStaffButtonProps {
  staffId: string
  staffName: string
}

export function DeleteStaffButton({ staffId, staffName }: DeleteStaffButtonProps) {
  const { t } = useI18n()
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    const confirmed = window.confirm(t.staff.confirmDelete(staffName))

    if (!confirmed) return

    setIsDeleting(true)
    try {
      const result = await deleteStaffMember(staffId)

      if (result.success) {
        toast.success(t.staff.toasts.deleted)
        router.refresh()
      } else {
        toast.error(result.error || t.staff.toasts.deleteFailed)
      }
    } catch (error) {
      console.error("Delete error:", error)
      toast.error(t.staff.toasts.unexpectedError)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-destructive"
      onClick={handleDelete}
      disabled={isDeleting}
    >
      {isDeleting ? (
        <SpinnerIcon size={16} className="animate-spin" />
      ) : (
        <TrashIcon size={16} />
      )}
    </Button>
  )
}
