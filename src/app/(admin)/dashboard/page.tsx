import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  CalendarIcon,
  CurrencyDollarIcon,
  ShoppingBagIcon,
  UsersIcon,
  TrendingUpIcon,
  ClockIcon,
} from "@/components/icons"
import Link from "next/link"
import {
  getDashboardStats,
  getTodaysAppointments,
  getRecentActivities,
} from "@/app/actions/dashboard"
import { getWorkOrdersOverview } from "@/app/actions/work-orders"
import { formatDistanceToNow } from "date-fns"
import { formatSalonTime } from "@/lib/booking-time"
import { getSessionSalonTimezone } from "@/lib/tenant"
import { formatCurrency, formatChange } from "@/lib/utils/format"
import { getServerI18n } from "@/lib/i18n/server"
import { getSessionOrg } from "@/lib/tenant"
import { term as profileTerm } from "@/lib/profiles/registry"
import { getSessionEffectiveProfile } from "@/lib/profiles/resolve"

export default async function AdminDashboard() {
  const [{ t, locale, dateFnsLocale }, salonTz] = await Promise.all([
    getServerI18n(),
    getSessionSalonTimezone(),
  ])
  const [stats, todaysAppointments, recentActivities, org] = await Promise.all([
    getDashboardStats(),
    getTodaysAppointments(),
    getRecentActivities(),
    getSessionOrg(),
  ])

  // Capability-gated dashboard (EPIC #1 §21): irrelevant modules never render.
  // Phase 5: the EFFECTIVE profile (shared profile + owner overrides) drives gating.
  const profile = await getSessionEffectiveProfile()
  const showAppointments = profile.capabilities.appointments !== "disabled"
  const workOrdersEnabled = profile.capabilities.workOrders !== "disabled"
  const ordersLabel = workOrdersEnabled
    ? profileTerm(profile, "orderPlural", locale)
    : t.dashboard.shopSales

  // Widget configurator (Phase 5): the owner picks which widgets render.
  const hasWidget = (k: (typeof profile.dashboardWidgets)[number]) =>
    profile.dashboardWidgets.includes(k)
  const statCardsVisible = [
    hasWidget("revenue"),
    showAppointments && hasWidget("todayAppointments"),
    hasWidget("customers"),
    hasWidget("recentOrders"),
  ].filter(Boolean).length as number

  // Widget-driven work-order board data — only fetched for profiles whose
  // dashboardWidgets actually use it (salons skip the extra queries entirely).
  const wantsWorkOrderWidgets =
    workOrdersEnabled &&
    profile.dashboardWidgets.some((k) =>
      ["activeOrders", "deadlines", "pendingApprovals", "readyForDelivery"].includes(k)
    )
  const workOrders = wantsWorkOrderWidgets ? await getWorkOrdersOverview() : null
  const ww = workOrders?.stats

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t.dashboard.title}{" "}
          <span className="from-primary to-accent bg-linear-to-r bg-clip-text text-transparent">
            {t.dashboard.titleAccent}
          </span>
        </h1>
        <p className="text-muted-foreground">{t.dashboard.welcome}</p>
      </div>

      {/* Stats Cards — widget-configurable (Phase 5) */}
      <div className={`grid gap-4 md:grid-cols-2 ${statCardsVisible >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
        {hasWidget("revenue") && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t.dashboard.revenueThisMonth}
            </CardTitle>
            <CurrencyDollarIcon size={16} className="text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.revenue.total)}
            </div>
            <p className="text-muted-foreground text-xs">
              {stats.revenue.change !== 0 && (
                <>
                  <TrendingUpIcon
                    size={12}
                    className={`mr-1 inline ${stats.revenue.change >= 0 ? "text-green-600" : "text-red-600"}`}
                  />
                  {formatChange(stats.revenue.change)} {t.dashboard.fromLastMonth}
                </>
              )}
              {stats.revenue.change === 0 && t.dashboard.noPreviousData}
            </p>
          </CardContent>
        </Card>
        )}

        {showAppointments && hasWidget("todayAppointments") && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t.dashboard.appointments}
            </CardTitle>
            <CalendarIcon size={16} className="text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.appointments.total.toLocaleString("sl-SI")}
            </div>
            <p className="text-muted-foreground text-xs">
              +{stats.appointments.monthly} {t.dashboard.thisMonth}
            </p>
          </CardContent>
        </Card>
        )}

        {hasWidget("customers") && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t.dashboard.totalCustomers}
            </CardTitle>
            <UsersIcon size={16} className="text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.customers.total.toLocaleString("sl-SI")}
            </div>
            <p className="text-muted-foreground text-xs">
              +{stats.customers.weekly} {t.dashboard.newThisWeek}
            </p>
          </CardContent>
        </Card>
        )}

        {hasWidget("recentOrders") && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {ordersLabel}
            </CardTitle>
            <ShoppingBagIcon size={16} className="text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.orders.total.toLocaleString("sl-SI")}
            </div>
            <p className="text-muted-foreground text-xs">
              {stats.orders.change !== 0 && (
                <>
                  {formatChange(stats.orders.change)} {t.dashboard.fromLastMonth}
                </>
              )}
              {stats.orders.change === 0 && t.dashboard.noPreviousData}
            </p>
          </CardContent>
        </Card>
        )}
      </div>

      {/* Work-order widgets — data-driven by profile.dashboardWidgets (§10 + Phase 5 configurator) */}
      {ww && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { key: "activeOrders", label: t.workForms.workOrders.stats.active, value: ww.active, href: "/dashboard/work-orders" },
            { key: "deadlines", label: t.workForms.workOrders.stats.dueSoon, value: ww.dueSoon, href: "/dashboard/work-orders" },
            { key: "pendingApprovals", label: t.workForms.workOrders.stats.pendingApprovals, value: ww.pendingApprovals, href: "/dashboard/work-orders" },
            { key: "readyForDelivery", label: t.workForms.workOrders.stats.readyForDelivery, value: ww.readyForDelivery, href: "/dashboard/work-orders" },
          ].filter((w) => hasWidget(w.key as (typeof profile.dashboardWidgets)[number])).map((w) => (
            <Link key={w.label} href={w.href}>
              <Card className="hover:border-primary/40 transition-colors">
                <CardContent className="p-4">
                  <div className="text-2xl font-bold">{w.value}</div>
                  <p className="text-muted-foreground mt-1 text-xs">{w.label}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Today's Appointments — only for appointment-capable profiles + widget enabled (Phase 5) */}
        {showAppointments && hasWidget("todayAppointments") && (
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>{t.dashboard.todaysAppointments}</CardTitle>
            <CardDescription>
              {t.dashboard.youHaveAppointmentsToday(todaysAppointments.length)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {todaysAppointments.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">
                  {t.dashboard.noAppointmentsToday}
                </p>
              ) : (
                todaysAppointments.slice(0, 5).map((apt) => (
                  <div
                    key={apt.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold">
                        <ClockIcon size={20} />
                      </div>
                      <div>
                        <p className="font-medium">
                          {apt.customer?.name || apt.guestName || t.dashboard.guest}
                        </p>
                        <p className="text-muted-foreground text-sm">
                          {apt.services.map((s) => s.service.name).join(", ")} •{" "}
                          {t.dashboard.staffLabel} {apt.staff.name}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatSalonTime(new Date(apt.startTime), salonTz)}
                      </p>
                      <Link href={`/dashboard/appointments/${apt.id}`}>
                        <Button variant="link" size="sm" className="h-auto p-0">
                          {t.common.actions.viewDetails}
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-4">
              <Link href="/dashboard/appointments">
                <Button variant="outline" className="w-full">
                  {t.dashboard.viewAllAppointments}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Production deadlines — replaces the calendar for
            appointment-less, work-order profiles (§10, §21; widget-gated Phase 5) */}
        {!showAppointments && hasWidget("deadlines") && workOrders && workOrders.orders.length > 0 && (
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>{t.workForms.workOrders.stats.dueSoon}</CardTitle>
              <CardDescription>{ordersLabel}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {workOrders.orders
                  .filter((o) => o.status === "OPEN")
                  .sort((a, b) => {
                    if (!a.dueDate) return 1
                    if (!b.dueDate) return -1
                    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
                  })
                  .slice(0, 6)
                  .map((o) => (
                    <Link
                      key={o.id}
                      href={`/dashboard/work-orders/${o.id}`}
                      className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          #{String(o.number).padStart(3, "0")} {o.title}
                        </p>
                        <p className="text-muted-foreground truncate text-sm">
                          {o.currentStageName ?? "—"} · {o.customerName ?? t.workForms.workOrders.noCustomer}
                        </p>
                      </div>
                      <div className="pl-3 text-right">
                        <p
                          className={`text-sm font-semibold ${
                            o.overdue
                              ? "text-red-600"
                              : ""
                          }`}
                        >
                          {o.dueDate
                            ? new Date(o.dueDate).toLocaleDateString(locale === "en" ? "en-GB" : "sl-SI", {
                                day: "numeric",
                                month: "short",
                              })
                            : "—"}
                        </p>
                      </div>
                    </Link>
                  ))}
              </div>
              <div className="mt-4">
                <Link href="/dashboard/work-orders">
                  <Button variant="outline" className="w-full">
                    {t.workForms.workOrders.title}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card className={showAppointments || (!showAppointments && workOrders && workOrders.orders.length > 0) ? "col-span-3" : "col-span-7"}>
          <CardHeader>
            <CardTitle>{t.dashboard.quickActions}</CardTitle>
            <CardDescription>{t.dashboard.commonTasks}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {showAppointments && (
            <Link href="/dashboard/appointments/new">
              <Button className="w-full justify-start" variant="outline">
                <CalendarIcon size={16} className="mr-2" />
                {t.dashboard.newAppointment}
              </Button>
            </Link>
            )}
            <Link href="/dashboard/products/new">
              <Button className="w-full justify-start" variant="outline">
                <ShoppingBagIcon size={16} className="mr-2" />
                {t.dashboard.addProduct}
              </Button>
            </Link>
            <Link href="/dashboard/users">
              <Button className="w-full justify-start" variant="outline">
                <UsersIcon size={16} className="mr-2" />
                {t.dashboard.manageCustomers}
              </Button>
            </Link>
          </CardContent>

          <CardHeader>
            <CardTitle className="text-base">{t.dashboard.recentActivity}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              {recentActivities.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center">
                  {t.dashboard.noRecentActivity}
                </p>
              ) : (
                recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-2">
                    <div
                      className={`mt-0.5 h-2 w-2 rounded-full ${
                        activity.color === "green"
                          ? "bg-green-500"
                          : activity.color === "blue"
                            ? "bg-blue-500"
                            : "bg-amber-500"
                      }`}
                    />
                    <div>
                      <p className="font-medium">
                        {activity.type === "appointment"
                          ? t.dashboard.activity.appointment(activity.name)
                          : activity.type === "order"
                            ? t.dashboard.activity.order(activity.name)
                            : t.dashboard.activity.customer(activity.name)}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {formatDistanceToNow(new Date(activity.createdAt), {
                          addSuffix: true,
                          locale: dateFnsLocale,
                        })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
