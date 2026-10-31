"use client"

// ============================================================
// PLAN USAGE CARD (EPIC #3 E3-3 → E3-4)
// Settings → current plan, live usage vs. limits, plan switching,
// subscription state and billing history.
//
// Two switching modes, chosen by CONFIGURATION (never faked):
//   • platform billing configured → paid plans open the hosted
//     Stripe checkout; the plan change arrives via webhook events
//     only. Cancelling requests provider-side cancellation.
//   • not configured → the demonstrative free switch (E3-3),
//     explicitly labeled as such; subscription actions honestly
//     report "setup required".
// ============================================================

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  CalendarClock,
  CreditCard,
  Gauge,
  ReceiptText,
  RefreshCw,
  TriangleAlert,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useI18n } from "@/lib/i18n/provider"
import { getPlan, listPlans, type PlanId } from "@/lib/plans/registry"
import { changePlan, getPlanContext } from "@/app/actions/plans"
import { startPlanCheckout, cancelSubscription } from "@/app/actions/billing"

export interface PlanUsageInitial {
  planId: PlanId
  usage: { services: number; products: number; staff: number }
}

/** Serializable billing data passed from the server page. */
export interface BillingUiData {
  paymentsConfigured: boolean
  subscription: {
    status: string
    plan: string
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
  } | null
  history: {
    id: string
    type: string
    amountCents: number | null
    currency: string | null
    createdAt: string
  }[]
}

interface PlanUsageCardProps {
  initial: PlanUsageInitial | null
  billing: BillingUiData | null
  /** Server-rendered ?billing=success|cancelled flag. */
  billingFlag?: string | null
}

type UsageRow = {
  key: "services" | "products" | "staff"
  used: number
  limit: number | null
}

type ConfirmMode = "demo-switch" | "checkout" | "cancel"

/** {plan} placeholder substitution for dict templates. */
function fill(template: string, planLabel: string): string {
  return template.replace("{plan}", planLabel)
}

function formatAmount(cents: number, currency: string | null): string {
  try {
    return new Intl.NumberFormat("sl-SI", {
      style: "currency",
      currency: (currency || "eur").toUpperCase(),
    }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} ${(currency || "EUR").toUpperCase()}`
  }
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("sl-SI", { dateStyle: "medium" }).format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}

export function PlanUsageCard({ initial, billing, billingFlag }: PlanUsageCardProps) {
  const { t, locale } = useI18n()
  const [state, setState] = useState<PlanUsageInitial | null>(initial)
  const [target, setTarget] = useState<PlanId | null>(null)
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>("demo-switch")
  const [isPending, startTransition] = useTransition()

  // Server-rendered checkout outcome — honest feedback: the plan
  // itself changes only when the provider's webhook confirms.
  useEffect(() => {
    if (billingFlag === "success") toast.success(t.settings.plan.billing.checkoutSuccess)
    if (billingFlag === "cancelled") toast.info(t.settings.plan.billing.checkoutCancelled)
    // Run once on mount — the flag comes from the server redirect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!state) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-5" aria-hidden="true" />
            {t.settings.plan.title}
          </CardTitle>
          <CardDescription>{t.settings.plan.loadError}</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    )
  }

  const plan = getPlan(state.planId)
  const dict = t.settings.plan
  const bdict = dict.billing
  const paymentsConfigured = billing?.paymentsConfigured ?? false
  const subscription = billing?.subscription ?? null
  const history = billing?.history ?? []
  const hasActiveSubscription =
    subscription !== null && ["ACTIVE", "TRIALING", "PAST_DUE"].includes(subscription.status)

  const rows: UsageRow[] = [
    { key: "services", used: state.usage.services, limit: plan.limits.services },
    { key: "products", used: state.usage.products, limit: plan.limits.products },
    { key: "staff", used: state.usage.staff, limit: plan.limits.staff },
  ]

  const hasOverLimit = rows.some((r) => r.limit !== null && r.used >= r.limit)
  const hasNearLimit = rows.some(
    (r) => r.limit !== null && r.limit > 0 && r.used >= r.limit * 0.8 && r.used < r.limit
  )

  const handleRefresh = () => {
    startTransition(async () => {
      try {
        const ctx = await getPlanContext()
        if (ctx) setState({ planId: ctx.planId, usage: { ...ctx.usage } })
      } catch {
        toast.error(dict.switchFailed)
      }
    })
  }

  /** Demonstrative switch (only when platform billing is NOT configured). */
  const handleDemoSwitch = (planId: PlanId) => {
    startTransition(async () => {
      try {
        const result = await changePlan(planId)
        if (result.success) {
          const next = getPlan(result.planId)
          setState((s) => (s ? { ...s, planId: next.id } : s))
          setTarget(null)
          toast.success(fill(dict.switchSuccess, next.label))
        } else if (result.code === "CHECKOUT_REQUIRED") {
          // Defense in depth: server routed us to checkout.
          setTarget(planId)
          setConfirmMode("checkout")
          void openCheckout(planId)
        } else if (result.code === "CANCEL_REQUIRED") {
          setConfirmMode("cancel")
        } else {
          toast.error(locale === "en" && result.errorEn ? result.errorEn : result.error)
        }
      } catch {
        toast.error(dict.switchFailed)
      }
    })
  }

  /** Hosted Stripe checkout — the plan changes ONLY via webhook confirmation. */
  const openCheckout = (planId: PlanId) => {
    startTransition(async () => {
      try {
        const result = await startPlanCheckout(planId)
        if (result.success) {
          window.location.href = result.checkoutUrl
        } else {
          toast.error(locale === "en" && result.errorEn ? result.errorEn : result.error)
        }
      } catch {
        toast.error(dict.switchFailed)
      }
    })
  }

  const handleCancelSubscription = () => {
    startTransition(async () => {
      try {
        const result = await cancelSubscription()
        if (result.success) {
          setTarget(null)
          toast.success(bdict.cancelSuccess)
        } else {
          toast.error(locale === "en" && result.errorEn ? result.errorEn : result.error)
        }
      } catch {
        toast.error(dict.switchFailed)
      }
    })
  }

  /** What does the primary action for a (non-current) plan do? */
  const actionFor = (planId: PlanId): ConfirmMode => {
    if (!paymentsConfigured) return "demo-switch"
    if (planId === "free") return hasActiveSubscription ? "cancel" : "demo-switch"
    return "checkout"
  }

  const targetPlan = target ? getPlan(target) : null
  const downgradeWarning =
    targetPlan &&
    rows.some((r) => {
      const limit = targetPlan.limits[r.key]
      return limit !== null && r.used >= limit
    })

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-5" aria-hidden="true" />
            {dict.title}
          </CardTitle>
          <CardDescription>{dict.description}</CardDescription>
        </div>
        <Badge
          className={
            hasOverLimit
              ? "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-950 dark:text-red-300"
              : "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
          }
        >
          {plan.label} · {dict.currentBadge}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Usage rows */}
        <div className="space-y-3">
          <p className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
            <Gauge className="size-4" aria-hidden="true" />
            {dict.usage}
          </p>
          {rows.map((row) => {
            const pct =
              row.limit === null
                ? 0
                : row.limit === 0
                  ? 100
                  : Math.min(100, Math.round((row.used / row.limit) * 100))
            const over = row.limit !== null && row.used >= row.limit
            const near = !over && row.limit !== null && row.limit > 0 && row.used >= row.limit * 0.8
            return (
              <div key={row.key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{dict.resources[row.key]}</span>
                  <span
                    className={
                      over
                        ? "font-medium text-red-600 dark:text-red-400"
                        : near
                          ? "font-medium text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground"
                    }
                  >
                    {row.used} / {row.limit === null ? dict.unlimited : row.limit}
                  </span>
                </div>
                {row.limit !== null && (
                  <div
                    role="progressbar"
                    aria-valuenow={row.used}
                    aria-valuemin={0}
                    aria-valuemax={row.limit}
                    aria-label={`${dict.resources[row.key]}: ${row.used} / ${row.limit}`}
                    className="bg-muted h-2 w-full overflow-hidden rounded-full"
                  >
                    <div
                      className={
                        over
                          ? "h-full rounded-full bg-red-500 transition-all"
                          : near
                            ? "h-full rounded-full bg-amber-500 transition-all"
                            : "bg-primary h-full rounded-full transition-all"
                      }
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {hasOverLimit && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950"
          >
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400"
              aria-hidden="true"
            />
            <p className="text-red-800 dark:text-red-300">{dict.overLimit}</p>
          </div>
        )}
        {!hasOverLimit && hasNearLimit && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950">
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
              aria-hidden="true"
            />
            <p className="text-amber-800 dark:text-amber-300">{dict.nearLimit}</p>
          </div>
        )}

        {/* Subscription state (E3-4) */}
        <Separator />
        <div className="space-y-2">
          <p className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
            <ReceiptText className="size-4" aria-hidden="true" />
            {bdict.statusTitle}
          </p>
          {!paymentsConfigured ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950">
              <TriangleAlert
                className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  {bdict.setupRequiredTitle}
                </p>
                <p className="text-amber-800 dark:text-amber-300">{bdict.setupRequired}</p>
              </div>
            </div>
          ) : !subscription ? (
            <p className="text-muted-foreground text-sm">{bdict.noSubscription}</p>
          ) : (
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {bdict.status[subscription.status as keyof typeof bdict.status] ??
                    subscription.status}
                </Badge>
                <span className="text-muted-foreground">
                  {getPlan(subscription.plan).label}
                </span>
              </div>
              {subscription.cancelAtPeriodEnd && (
                <p className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                  <CalendarClock className="size-4" aria-hidden="true" />
                  {bdict.cancelRequested}
                </p>
              )}
              {subscription.currentPeriodEnd && !subscription.cancelAtPeriodEnd && (
                <p className="text-muted-foreground flex items-center gap-1.5">
                  <CalendarClock className="size-4" aria-hidden="true" />
                  {bdict.nextBilling} {formatDate(subscription.currentPeriodEnd)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Billing history */}
        {history.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{bdict.historyTitle}</p>
            <ul className="divide-y rounded-md border">
              {history.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {bdict.eventTypes[e.type as keyof typeof bdict.eventTypes] ?? e.type}
                    </p>
                    <p className="text-muted-foreground text-xs">{formatDate(e.createdAt)}</p>
                  </div>
                  <span className="shrink-0 tabular-nums">
                    {e.amountCents !== null ? formatAmount(e.amountCents, e.currency) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Available plans */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{dict.plansTitle}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isPending}
              className="min-h-9"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              {dict.refresh}
            </Button>
          </div>
          {!paymentsConfigured && (
            <p className="text-muted-foreground text-xs">{bdict.demoMode}</p>
          )}
          <div className="grid gap-3 md:grid-cols-3">
            {listPlans().map((p) => {
              const isCurrent = p.id === plan.id
              const mode = actionFor(p.id)
              const isCancelCard = mode === "cancel"
              return (
                <div
                  key={p.id}
                  className={
                    isCurrent
                      ? "rounded-lg border-2 border-primary p-4"
                      : "rounded-lg border p-4"
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{p.label}</span>
                    {isCurrent && (
                      <Badge variant="secondary" className="text-xs">
                        ✓
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {locale === "en" ? p.description.en : p.description.sl}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {p.features.map((f, i) => (
                      <li key={i} className="text-muted-foreground text-xs">
                        • {locale === "en" ? f.en : f.sl}
                      </li>
                    ))}
                  </ul>
                  {!isCurrent && (
                    <Button
                      variant={isCancelCard ? "outline" : "default"}
                      size="sm"
                      className="mt-3 w-full min-h-9"
                      disabled={isPending}
                      onClick={() => {
                        setTarget(p.id)
                        setConfirmMode(mode)
                      }}
                    >
                      {isCancelCard
                        ? bdict.cancel
                        : mode === "checkout"
                          ? fill(bdict.subscribe, p.label)
                          : fill(dict.switchTo, p.label)}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Confirm dialog — mode decides meaning and action */}
        <AlertDialog
          open={target !== null}
          onOpenChange={(open) => {
            if (!open) {
              setTarget(null)
              setConfirmMode("demo-switch")
            }
          }}
        >
          <AlertDialogContent>
            {confirmMode === "cancel" ? (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>{bdict.cancelConfirmTitle}</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2">
                    <span className="block">{bdict.cancelConfirmBody}</span>
                    {downgradeWarning && (
                      <span className="block font-medium text-red-600 dark:text-red-400">
                        {dict.confirmDowngradeWarning}
                      </span>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t.common.actions.cancel}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault()
                      handleCancelSubscription()
                    }}
                    className="min-h-11"
                  >
                    {bdict.cancelConfirmAction}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            ) : confirmMode === "checkout" ? (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {targetPlan ? fill(bdict.subscribe, targetPlan.label) : ""}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2">
                    <span className="block">{bdict.subscribeNote}</span>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t.common.actions.cancel}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault()
                      if (target) openCheckout(target)
                    }}
                    className="min-h-11"
                  >
                    {t.common.actions.confirm}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            ) : (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {targetPlan ? fill(dict.confirmTitle, targetPlan.label) : ""}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2">
                    <span className="block">{dict.confirmFreePhase}</span>
                    {downgradeWarning && (
                      <span className="block font-medium text-red-600 dark:text-red-400">
                        {dict.confirmDowngradeWarning}
                      </span>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t.common.actions.cancel}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault()
                      if (target) handleDemoSwitch(target)
                    }}
                    className="min-h-11"
                  >
                    {dict.confirmAction}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            )}
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
