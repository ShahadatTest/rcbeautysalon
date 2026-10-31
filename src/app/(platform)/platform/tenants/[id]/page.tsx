import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { loadTenantDetail } from "@/lib/platform/overview"
import { getPlatformLabels, auditActionLabel } from "@/lib/platform/labels"
import { getLocaleFromCookies } from "@/lib/i18n/server"
import { TenantStatusActions } from "@/components/platform/tenant-status-actions"

export const dynamic = "force-dynamic"

interface TenantDetailPageProps {
  params: Promise<{ id: string }>
}

function formatDate(date: Date | null, locale: string): string {
  if (!date) return "—"
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "sl-SI", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function limitDisplay(limit: number | null, unlimited: string): string {
  return limit === null ? unlimited : String(limit)
}

function usageDisplay(current: number, limit: number | null, unlimited: string): string {
  return `${current} / ${limit === null ? unlimited : limit}`
}

export default async function TenantDetailPage({ params }: TenantDetailPageProps) {
  const { id } = await params
  const locale = await getLocaleFromCookies()
  const labels = getPlatformLabels(locale)
  const detail = await loadTenantDetail(id)
  if (!detail) notFound()

  const { tenant } = detail
  const suspended = tenant.status === "SUSPENDED"

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
            <Link href="/platform">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              {labels.backToOverview}
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{tenant.name}</h1>
            <Badge variant={suspended ? "destructive" : "secondary"}>
              {suspended ? labels.statusSUSPENDED : labels.statusACTIVE}
            </Badge>
            <Badge variant="outline" className="uppercase">
              {tenant.plan}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">/s/{tenant.slug}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`/s/${tenant.slug}`} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
              {labels.openPublicSite}
            </a>
          </Button>
          <TenantStatusActions
            orgId={tenant.id}
            orgName={tenant.name}
            status={tenant.status}
            labels={labels}
          />
        </div>
      </div>

      {suspended && detail.suspendedReason && (
        <Card className="border-destructive/40">
          <CardHeader className="p-4">
            <CardTitle className="text-base text-destructive">
              {labels.suspendedReasonHeading}
            </CardTitle>
            <CardDescription>
              {labels.suspendedSince}:{" "}
              {formatDate(detail.suspendedAt, locale)} — {detail.suspendedReason}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Basic info */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle>{labels.infoHeading}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{labels.slug}</dt>
              <dd className="font-medium">{tenant.slug}</dd>
              <dt className="text-muted-foreground">{labels.vertical}</dt>
              <dd className="font-medium">{tenant.vertical}</dd>
              <dt className="text-muted-foreground">{labels.createdAt}</dt>
              <dd className="font-medium">{formatDate(tenant.createdAt, locale)}</dd>
              <dt className="text-muted-foreground">{labels.colUsers}</dt>
              <dd className="font-medium">{tenant.userCount}</dd>
            </dl>
          </CardContent>
        </Card>

        {/* Plan + usage vs limits */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle>
              {labels.planHeading}: {detail.planLabel}
            </CardTitle>
            <CardDescription>{labels.usageHeading}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-0 text-sm sm:p-6 sm:pt-0">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{labels.limitServices}</span>
              <span className="font-medium tabular-nums">
                {usageDisplay(
                  tenant.serviceCount,
                  detail.planLimits?.services ?? null,
                  labels.unlimited
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{labels.limitProducts}</span>
              <span className="font-medium tabular-nums">
                {usageDisplay(
                  tenant.productCount,
                  detail.planLimits?.products ?? null,
                  labels.unlimited
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{labels.limitStaff}</span>
              <span className="font-medium tabular-nums">
                {usageDisplay(
                  tenant.staffCount,
                  detail.planLimits?.staff ?? null,
                  labels.unlimited
                )}
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{labels.limitStorage}</span>
              <span className="font-medium">
                {limitDisplay(detail.planLimits?.storageMb ?? null, labels.unlimited)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Platform subscription */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle>{labels.subscriptionHeading}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-sm sm:p-6 sm:pt-0">
            {detail.subscription ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                <dt className="text-muted-foreground">{labels.subStatus}</dt>
                <dd className="font-medium">{detail.subscription.status}</dd>
                <dt className="text-muted-foreground">{labels.subPlan}</dt>
                <dd className="font-medium uppercase">{detail.subscription.plan}</dd>
                <dt className="text-muted-foreground">{labels.subPeriod}</dt>
                <dd className="font-medium">
                  {formatDate(detail.subscription.currentPeriodStart, locale)}
                  {" → "}
                  {formatDate(detail.subscription.currentPeriodEnd, locale)}
                </dd>
                {detail.subscription.cancelAtPeriodEnd && (
                  <>
                    <dt className="text-muted-foreground">{labels.subCancelAtEnd}</dt>
                    <dd className="font-medium">✓</dd>
                  </>
                )}
                {detail.subscription.pendingPlanId && (
                  <>
                    <dt className="text-muted-foreground">{labels.subPending}</dt>
                    <dd className="font-medium uppercase">
                      {detail.subscription.pendingPlanId} ({formatDate(detail.subscription.pendingAt, locale)})
                    </dd>
                  </>
                )}
              </dl>
            ) : (
              <p className="text-muted-foreground">{labels.noSubscription}</p>
            )}
          </CardContent>
        </Card>

        {/* Publication */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle>{labels.publicationHeading}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-sm sm:p-6 sm:pt-0">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <dt className="text-muted-foreground">{labels.colPublish}</dt>
              <dd>
                <Badge variant={tenant.publishState === "PUBLISHED" ? "secondary" : "outline"}>
                  {tenant.publishState === "PUBLISHED"
                    ? labels.publishPUBLISHED
                    : tenant.publishState === "DRAFT"
                      ? labels.publishDRAFT
                      : labels.publishUNPUBLISHED}
                </Badge>
              </dd>
              <dt className="text-muted-foreground">{labels.publishedVersionLabel}</dt>
              <dd className="font-medium tabular-nums">
                {detail.publishedContentVersion ?? labels.notPublishedYet}
              </dd>
              <dt className="text-muted-foreground">{labels.versionLabel}</dt>
              <dd className="font-medium tabular-nums">{detail.contentVersion}</dd>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Users */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle>{labels.usersHeading}</CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-2 sm:pb-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{labels.userColName}</TableHead>
                <TableHead>{labels.userColEmail}</TableHead>
                <TableHead>{labels.userColRole}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.name ?? "—"}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {user.role === "ADMIN"
                        ? labels.roleADMIN
                        : user.role === "STAFF"
                          ? labels.roleSTAFF
                          : labels.roleCLIENTE}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Billing history */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle>{labels.billingHistoryHeading}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            {detail.billingHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">{labels.billingHistoryEmpty}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {detail.billingHistory.map((event) => (
                  <li
                    key={event.id}
                    className="flex items-center justify-between gap-2 rounded-md border p-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{event.type}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDate(event.createdAt, locale)}
                      </p>
                    </div>
                    <span className="shrink-0 tabular-nums">
                      {event.amountCents !== null
                        ? `${(event.amountCents / 100).toFixed(2)} ${event.currency ?? "EUR"}`
                        : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Audit trail */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle>{labels.auditHeading}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            {detail.auditTrail.length === 0 ? (
              <p className="text-sm text-muted-foreground">{labels.auditEmpty}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {detail.auditTrail.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-md border p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {auditActionLabel(entry.action, labels)}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDate(entry.createdAt, locale)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {labels.auditColActor}: {entry.actorEmail}
                      {entry.reason && ` · ${labels.auditColReason}: ${entry.reason}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
