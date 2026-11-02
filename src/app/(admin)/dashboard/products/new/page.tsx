import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon } from "@/components/icons"
import { ProductForm } from "@/components/dashboard/product-form"
import { getAllCategories } from "@/app/actions/services"
import { getServerI18n } from "@/lib/i18n/server"
import { requirePagePermission } from "@/lib/auth/guards"

export default async function NewProductPage() {
  // Custom roles (E4-6b): server-side page guard
  await requirePagePermission("products.manage")
  const [categories, { t }] = await Promise.all([
    getAllCategories(),
    getServerI18n(),
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/products">
          <Button variant="ghost" size="icon">
            <ArrowLeftIcon size={20} />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{t.products.newTitle}</h1>
          <p className="text-muted-foreground">
            {t.products.newSubtitle}
          </p>
        </div>
      </div>

      {/* Form */}
      <ProductForm categories={categories} mode="create" />
    </div>
  )
}
