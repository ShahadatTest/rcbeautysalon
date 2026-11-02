import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ArrowLeftIcon } from "@/components/icons"
import AdminAppointmentForm from "@/components/appointments/admin-appointment-form"
import {
  getActiveServicesForBooking,
  getAllActiveStaff,
} from "@/app/actions/services"
import { getCustomers } from "@/app/actions/customers"
import { getServerI18n } from "@/lib/i18n/server"
import { requirePagePermission } from "@/lib/auth/guards"

export default async function NewAppointmentPage() {
  // Custom roles (E4-6b): server-side page guard
  await requirePagePermission("appointments.manage")
  const [{ t }, services, staff, customers] = await Promise.all([
    getServerI18n(),
    getActiveServicesForBooking(),
    getAllActiveStaff(),
    getCustomers(),
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/appointments">
          <Button variant="ghost" size="icon">
            <ArrowLeftIcon size={20} />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">
            {t.appointments.new.newAppointment}
          </h1>
          <p className="text-muted-foreground">
            {t.appointments.new.newDescription}
          </p>
        </div>
      </div>

      {/* Form Card */}
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t.appointments.new.formTitle}</CardTitle>
          <CardDescription>
            {t.appointments.new.formDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminAppointmentForm
            services={services}
            staff={staff}
            customers={customers}
          />
        </CardContent>
      </Card>
    </div>
  )
}
