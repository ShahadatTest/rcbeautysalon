import Link from "next/link"
import {
  Building2,
  CheckCircle2,
  FileText,
  PauseCircle,
  ReceiptEuro,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { loadPlatformOverview } from "@/lib/platform/overview"
import {
  getPlatformLabels,
  auditActionLabel,
  failureReasonLabel,
} from "@/lib/platform/labels"
import { getLocaleFromCookies } from "@/lib/i18n/server"
import { TenantStatusActions } from "@/components/platform/tenant-status-actions"

export const dynamic = "force-dynamic"

interface PlatformPageProps {
  searchParams: Promise<{ q?: string; status?: string }>
}

function formatDate(date: Date | null, locale: string): string {
  if (!date) return "—"
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "sl-SI", {
    dateStyle: "medium",
  }).format(date)
}

function formatPercent(ratePercent: number | null): string {
  return ratePercent === null ? "—" : `${ratePercent.toLocaleString("sl-SI", { maximumFractionDigits: 1 })} %`
}

export default async function PlatformPage({ searchParams }: PlatformPageProps) {
  const { q, status } = await searchParams
  const locale = await getLocaleFromCookies()
  const labels = getPlatformLabels(locale)
  const overview = await loadPlatformOverview({ q, status })

  const stats = [
    { label: labels.statsTenants, value: overview.totals.tenants, icon: Building2 },
    { label: labels.statsActive, value: overview.totals.active, icon: CheckCircle2 },
    { label: labels.statsSuspended, value: overview.totals.suspended, icon: PauseCircle },
    { label: labels.statsPublished, value: overview.totals.published, icon: FileText },
    { label: labels.statsSubsActive, value: overview.totals.subscriptionsActive, icon: ReceiptEuro },
  ]

  const statusFilters = [
    { key: "", label: labels.filterAll },
    { key: "ACTIVE", label: labels.filterActive },
    { key: "SUSPENDED", label: labels.filterSuspended },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{labels.overviewHeading}</h1>
        <p className="text-sm text-muted-foreground">{labels.subtitle}</p>
        <p
          className={cn(
            "text-xs font-medium",
            overview.billingConfigured ? "text-emerald-600" : "text-amber-600"
          )}
        >
          {overview.billingConfigured
            ? labels.billingConfigured
            : labels.billingNotConfigured}
        </p>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <stat.icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-none">{stat.value}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Analytics (E4-1) — derived-only metrics, definitions shown inline */}
      <Card>
        <CardHeader>
          <CardTitle>{labels.analyticsHeading}</CardTitle>
          <CardDescription>{labels.analyticsDescription}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Plan distribution */}
          <div className="rounded-md border p-4">
            <p className="text-sm font-medium">{labels.analyticsPlanDistribution}</p>
            {overview.analytics.planDistribution.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{labels.emptyTenants}</p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-2">
                {overview.analytics.planDistribution.map((row) => (
                  <li
                    key={row.plan}
                    className="flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs font-medium"
                  >
                    <span className="uppercase">{row.plan}</span>
                    <span className="tabular-nums">× {row.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Conversion */}
          <div className="rounded-md border p-4">
            <p className="text-sm font-medium">{labels.analyticsConversion}</p>
            {overview.analytics.conversion.ratePercent === null ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {labels.analyticsNoSubscriptions}
              </p>
            ) : (
              <p className="mt-1 text-2xl font-bold tabular-nums leading-none">
                {formatPercent(overview.analytics.conversion.ratePercent)}
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {overview.analytics.conversion.paying} /{" "}
              {overview.analytics.conversion.tenantsWithSubscription} ·{" "}
              {labels.analyticsConversionDef}
            </p>
          </div>

          {/* Churn */}
          <div className="rounded-md border p-4">
            <p className="text-sm font-medium">{labels.analyticsChurn}</p>
            {overview.analytics.churn.ratePercent === null ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {labels.analyticsNoSubscriptions}
              </p>
            ) : (
              <p className="mt-1 text-2xl font-bold tabular-nums leading-none">
                {formatPercent(overview.analytics.churn.ratePercent)}
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {overview.analytics.churn.churned} / {overview.analytics.churn.subscriptions} ·{" "}
              {labels.analyticsChurnDef}
            </p>
          </div>

          {/* Revenue (current month) */}
          <div className="rounded-md border p-4">
            <p className="text-sm font-medium">{labels.analyticsRevenue}</p>
            {overview.analytics.revenue.byCurrency.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{labels.analyticsNoRevenue}</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {overview.analytics.revenue.byCurrency.map((row) => (
                  <li key={row.currency} className="text-2xl font-bold tabular-nums leading-none">
                    {(row.amountCents / 100).toLocaleString("sl-SI", {
                      minimumFractionDigits: 2,
                    })}{" "}
                    <span className="text-sm font-semibold uppercase">{row.currency}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {labels.analyticsRevenueDef}
              {overview.analytics.revenue.otherTypeEvents > 0 && (
                <>
                  {" · "}
                  {overview.analytics.revenue.otherTypeEvents}{" "}
                  {labels.analyticsOtherTypesNote}
                </>
              )}
            </p>
          </div>

          {/* Webhook health */}
          <div className="rounded-md border p-4">
            <p className="text-sm font-medium">{labels.analyticsWebhookHealth}</p>
            {overview.analytics.webhookHealth.eventsLast7d === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{labels.analyticsNoEvents}</p>
            ) : (
              <p className="mt-1 text-2xl font-bold tabular-nums leading-none">
                {overview.analytics.webhookHealth.eventsLast7d}
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {labels.analyticsWebhookDef}
              {overview.analytics.webhookHealth.lastEventAt && (
                <>
                  {" · "}
                  {labels.analyticsLastEvent}:{" "}
                  {formatDate(overview.analytics.webhookHealth.lastEventAt, locale)}
                </>
              )}
            </p>
          </div>

          {/* Webhook failures (E4-3, §10) — every failure is always recorded */}
          <div className="rounded-md border p-4">
            <p className="text-sm font-medium">{labels.analyticsWebhookFailures}</p>
            {overview.analytics.webhookFailures.failuresLast7d === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">{labels.analyticsNoFailures}</p>
            ) : (
              <p
                className={cn(
                  "mt-1 text-2xl font-bold tabular-nums leading-none",
                  overview.analytics.webhookFailures.failuresLast7d > 0 &&
                    "text-amber-600"
                )}
              >
                {overview.analytics.webhookFailures.failuresLast7d}
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {labels.analyticsFailuresDef}
              {overview.analytics.webhookFailures.lastFailureAt && (
                <>
                  {" · "}
                  {labels.analyticsLastFailure}:{" "}
                  {formatDate(overview.analytics.webhookFailures.lastFailureAt, locale)}
                </>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Webhook failure log (E4-3, §10) — latest recorded failures */}
      <Card>
        <CardHeader>
          <CardTitle>{labels.analyticsWebhookFailures}</CardTitle>
          <CardDescription>{labels.analyticsFailuresRetryNote}</CardDescription>
        </CardHeader>
        <CardContent>
          {overview.analytics.webhookFailures.recent.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {labels.analyticsNoFailures}
            </p>
          ) : (
            <ul className="space-y-3">
              {overview.analytics.webhookFailures.recent.map((failure) => (
                <li
                  key={`${failure.createdAt.toISOString()}-${failure.reason}-${failure.stripeEventId ?? "-"}`}
                  className="flex flex-col gap-1 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      <Badge variant="destructive" className="mr-2">
                        {failureReasonLabel(failure.reason, labels)}
                      </Badge>
                      {failure.type && (
                        <span className="font-mono text-xs">{failure.type}</span>
                      )}
                    </p>
                    {failure.detail && (
                      <p className="truncate text-xs text-muted-foreground">{failure.detail}</p>
                    )}
                    {failure.stripeEventId && (
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {failure.stripeEventId}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    {formatDate(failure.createdAt, locale)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Tenant roster */}
      <Card>
        <CardHeader>
          <CardTitle>{labels.tenantsHeading}</CardTitle>
          <CardDescription>
            {labels.tenantsHeading}: {overview.totals.tenants} · {labels.statsActive}:{" "}
            {overview.totals.active} · {labels.statsSuspended}: {overview.totals.suspended}
          </CardDescription>
          <form className="flex flex-col gap-2 pt-2 sm:flex-row" action="/platform">
            <Input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder={labels.searchPlaceholder}
              className="sm:max-w-xs"
              aria-label={labels.search}
            />
            <input type="hidden" name="status" value={status ?? ""} />
            <Button type="submit" variant="outline" size="sm" className="sm:self-start">
              {labels.search}
            </Button>
          </form>
          <div className="flex flex-wrap gap-2 pt-2">
            {statusFilters.map((filter) => {
              const active = (status ?? "") === filter.key
              const href = filter.key
                ? `/platform?${new URLSearchParams({ ...(q ? { q } : {}), status: filter.key })}`
                : `/platform${q ? `?q=${encodeURIComponent(q)}` : ""}`
              return (
                <Button
                  key={filter.key || "all"}
                  asChild
                  size="sm"
                  variant={active ? "default" : "ghost"}
                >
                  <Link href={href}>{filter.label}</Link>
                </Button>
              )
            })}
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0 [&_table]:min-w-[860px]">
          <div className="max-h-[32rem] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>{labels.colTenant}</TableHead>
                  <TableHead>{labels.colPlan}</TableHead>
                  <TableHead>{labels.colStatus}</TableHead>
                  <TableHead>{labels.colPublish}</TableHead>
                  <TableHead>{labels.colSubscription}</TableHead>
                  <TableHead className="text-right">{labels.colUsers}</TableHead>
                  <TableHead>{labels.colCreated}</TableHead>
                  <TableHead className="text-right">{labels.colActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.tenants.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      {labels.emptyTenants}
                    </TableCell>
                  </TableRow>
                )}
                {overview.tenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell>
                      <Link
                        href={`/platform/tenants/${tenant.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {tenant.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">/s/{tenant.slug}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="uppercase">
                        {tenant.plan}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={tenant.status === "ACTIVE" ? "secondary" : "destructive"}
                      >
                        {tenant.status === "ACTIVE" ? labels.statusACTIVE : labels.statusSUSPENDED}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          tenant.publishState === "PUBLISHED" ? "secondary" : "outline"
                        }
                      >
                        {tenant.publishState === "PUBLISHED"
                          ? labels.publishPUBLISHED
                          : tenant.publishState === "DRAFT"
                            ? labels.publishDRAFT
                            : labels.publishUNPUBLISHED}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {tenant.subscriptionStatus ? (
                        <span>
                          {tenant.subscriptionStatus}
                          {tenant.subscriptionPeriodEnd && (
                            <span className="block text-xs text-muted-foreground">
                              {formatDate(tenant.subscriptionPeriodEnd, locale)}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{labels.subNone}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {tenant.userCount}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(tenant.createdAt, locale)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/platform/tenants/${tenant.id}`}>{labels.detail}</Link>
                        </Button>
                        <TenantStatusActions
                          orgId={tenant.id}
                          orgName={tenant.name}
                          status={tenant.status}
                          labels={labels}
                          showLabels={false}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Recent audit trail */}
      <Card>
        <CardHeader>
          <CardTitle>{labels.auditHeading}</CardTitle>
        </CardHeader>
        <CardContent>
          {overview.recentAudit.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {labels.auditEmpty}
            </p>
          ) : (
            <ul className="space-y-3">
              {overview.recentAudit.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-col gap-1 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {auditActionLabel(entry.action, labels)} ·{" "}
                      <Link
                        href={`/platform/tenants/${entry.organizationId}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {entry.organizationName}
                      </Link>
                    </p>
                    {entry.reason && (
                      <p className="truncate text-xs text-muted-foreground">
                        {labels.auditColReason}: {entry.reason}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    <p>{entry.actorEmail}</p>
                    <p>{formatDate(entry.createdAt, locale)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
