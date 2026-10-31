"use client"

// ============================================================
// PLAN USAGE CARD (EPIC #3 E3-3)
// Settings → current plan, live usage vs. limits, and plan
// switching. Plan switching is REAL (updates Organization.plan;
// entitlements apply immediately) but free during the launch
// phase — the UI says so explicitly; the payment layer (E3-4)
// will gate the same action.
// ============================================================

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { CreditCard, Gauge, RefreshCw, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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

export interface PlanUsageInitial {
  planId: PlanId
  usage: { services: number; products: number; staff: number }
}

interface PlanUsageCardProps {
  initial: PlanUsageInitial | null
}

type UsageRow = {
  key: "services" | "products" | "staff"
  used: number
  limit: number | null
}

/** {plan} placeholder substitution for dict templates. */
function fill(template: string, planLabel: string): string {
  return template.replace("{plan}", planLabel)
}

export function PlanUsageCard({ initial }: PlanUsageCardProps) {
  const { t, locale } = useI18n()
  const [state, setState] = useState<PlanUsageInitial | null>(initial)
  const [target, setTarget] = useState<PlanId | null>(null)
  const [isPending, startTransition] = useTransition()

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

  const handleSwitch = (planId: PlanId) => {
    startTransition(async () => {
      try {
        const result = await changePlan(planId)
        if (result.success) {
          const next = getPlan(result.planId)
          setState((s) => (s ? { ...s, planId: next.id } : s))
          setTarget(null)
          toast.success(fill(dict.switchSuccess, next.label))
        } else {
          toast.error(locale === "en" && result.errorEn ? result.errorEn : result.error)
        }
      } catch {
        toast.error(dict.switchFailed)
      }
    })
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
          <div className="grid gap-3 md:grid-cols-3">
            {listPlans().map((p) => {
              const isCurrent = p.id === plan.id
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
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full min-h-9"
                      disabled={isPending}
                      onClick={() => setTarget(p.id)}
                    >
                      {fill(dict.switchTo, p.label)}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Confirm switch dialog */}
        <AlertDialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
          <AlertDialogContent>
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
                  if (target) handleSwitch(target)
                }}
                className="min-h-11"
              >
                {dict.confirmAction}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
