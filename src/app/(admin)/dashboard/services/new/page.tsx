import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon } from "@/components/icons"
import { ServiceForm } from "@/components/dashboard/service-form"
import { getAllCategories, getAllActiveStaff } from "@/app/actions/services"
import { getServerI18n } from "@/lib/i18n/server"

export default async function NewServicePage() {
  const [categories, staff, { t }] = await Promise.all([
    getAllCategories(),
    getAllActiveStaff(),
    getServerI18n(),
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/services">
          <Button variant="ghost" size="icon">
            <ArrowLeftIcon size={20} />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{t.services.newTitle}</h1>
          <p className="text-muted-foreground">{t.services.newSubtitle}</p>
        </div>
      </div>

      {/* Form */}
      <ServiceForm categories={categories} staff={staff} />
    </div>
  )
}
