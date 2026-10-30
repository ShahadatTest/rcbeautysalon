"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { TrashIcon } from "@/components/icons"
import { SpinnerIcon } from "@/components/icons/spinner-icon"
import { deleteProduct } from "@/app/actions/products"
import { toast } from "sonner"
import { useI18n } from "@/lib/i18n/provider"

interface DeleteProductButtonProps {
  productId: string
  productName: string
}

export function DeleteProductButton({ productId, productName }: DeleteProductButtonProps) {
  const router = useRouter()
  const { t } = useI18n()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    const confirmed = window.confirm(
      t.products.deleteConfirmWithName(productName)
    )

    if (!confirmed) return

    setIsDeleting(true)
    try {
      const result = await deleteProduct(productId)

      if (result.success) {
        toast.success(t.products.deleteSuccess)
        router.refresh()
      } else {
        toast.error(result.error || t.products.deleteFailed)
      }
    } catch (error) {
      console.error("Delete error:", error)
      toast.error(t.products.unexpectedError)
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
