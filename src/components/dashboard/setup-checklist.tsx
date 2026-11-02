"use client"

// ============================================================
// SETUP CHECKLIST ("vodena namestitev") — the persistent activation
// checklist that LIVES on the dashboard (the Shopify/Fresha pattern:
// wizard first run → checklist until activated → next-best-action).
//
// Behavior:
//   • Expanded: one card at the top of the dashboard with the step
//     list, progress "x od y" and a single highlighted NEXT-BEST-ACTION.
//   • Completed: celebration state — the checklist becomes a calm
//     "all set" row; the guided entry stays one click away.
//   • Dismissed: collapses to the compact "Primarna dejavnost" row
//     (the previous behavior — vodeni vstop always one click away)
//     with a "Pokaži vodeno namestitev" reopen button.
//   • Step completion is computed on the SERVER from real business
//     data; this component only renders it and persists dismiss/reopen.
// ============================================================

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Check, ChevronDown, ChevronUp, LayoutGrid, Sparkles, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { GuidedEntryDialog } from "@/components/dashboard/guided-entry"
import { PROFILE_ICONS } from "@/lib/profiles/profile-icons"
import type { SetupStep, SetupStepKey } from "@/lib/profiles/setup-checklist"
import type { DashboardDict } from "@/lib/i18n/dict/dashboard"
import type { SettingsDict } from "@/lib/i18n/dict/settings"
import {
  dismissSetupChecklist,
  reopenSetupChecklist,
} from "@/app/actions/setup-checklist"

export interface SetupChecklistCardProps {
  profileId: string
  profileLabel: string
  /** "Primarna dejavnost" — resolved on the server from the settings dict. */
  primaryActivityLabel: string
  steps: SetupStep[]
  nextKey: SetupStepKey | null
  doneCount: number
  total: number
  allDone: boolean
  dismissed: boolean
  /** firstJob label switches to the work-order variant for non-booking profiles. */
  appointmentsCapable: boolean
  dict: DashboardDict["setupChecklist"]
  guidedEntryDict: SettingsDict["guidedEntry"]
}

export function SetupChecklistCard({
  profileId,
  profileLabel,
  primaryActivityLabel,
  steps,
  nextKey,
  doneCount,
  total,
  allDone,
  dismissed,
  appointmentsCapable,
  dict,
  guidedEntryDict,
}: SetupChecklistCardProps) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(true)
  const [pending, startTransition] = useTransition()

  const dismiss = () => {
    startTransition(async () => {
      const res = await dismissSetupChecklist()
      if (!res.success) {
        toast.error(res.error ?? dict.dismiss)
        return
      }
      router.refresh()
    })
  }

  const reopen = () => {
    startTransition(async () => {
      const res = await reopenSetupChecklist()
      if (!res.success) {
        toast.error(res.error ?? dict.reopen)
        return
      }
      router.refresh()
    })
  }

  const stepLabel = (key: SetupStepKey) => {
    if (key === "firstJob" && !appointmentsCapable) return dict.steps.firstJobOrder.label
    return dict.steps[key].label
  }
  const stepDescription = (key: SetupStepKey) => {
    if (key === "firstJob" && !appointmentsCapable) return dict.steps.firstJobOrder.description
    return dict.steps[key].description
  }
  const stepCta = (key: SetupStepKey) => {
    if (key === "firstJob" && !appointmentsCapable) return dict.steps.firstJobOrder.cta
    return dict.steps[key].cta
  }

  const Icon = PROFILE_ICONS[profileId] ?? LayoutGrid
  const progressPct = total > 0 ? Math.round((doneCount / total) * 100) : 0
  // Plain-string interpolation — dict props crossing the server→client
  // boundary must stay serializable (no functions).
  const progressText = allDone
    ? dict.progressAllDone
    : dict.progressFormat
        .replace("{done}", String(doneCount))
        .replace("{total}", String(total))

  // ---- DISMISSED: compact activity row (vodeni vstop one click away) ----
  if (dismissed) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
              <Icon size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold">
                {primaryActivityLabel}: {profileLabel}
              </p>
              <p className="text-muted-foreground text-xs">{guidedEntryDict.reopenDescription}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={reopen} disabled={pending}>
              {dict.reopen}
            </Button>
            <GuidedEntryDialog
              triggerLabel={guidedEntryDict.reopenButton}
              dict={guidedEntryDict}
            />
          </div>
        </CardContent>
      </Card>
    )
  }

  // ---- EXPANDED: the persistent setup guide ----
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        {/* Header — title, progress, collapse + dismiss */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                <Icon size={18} aria-hidden="true" />
              </span>
              <h2 className="text-base font-semibold sm:text-lg">{dict.title}</h2>
              <Badge variant="secondary" className="font-normal">
                {profileLabel}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1.5 text-xs sm:text-sm">
              {allDone ? dict.completedNote : dict.subtitle}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {/* Vodeni vstop is ALWAYS one click away — even while the
                checklist is open (the user's explicit ask). */}
            <div className="hidden sm:block">
              <GuidedEntryDialog
                triggerLabel={guidedEntryDict.reopenButton}
                dict={guidedEntryDict}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={expanded}
              aria-label={expanded ? dict.collapse : dict.expand}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? (
                <ChevronUp size={16} aria-hidden="true" />
              ) : (
                <ChevronDown size={16} aria-hidden="true" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label={dict.dismiss}
              title={dict.dismissDescription}
              onClick={dismiss}
              disabled={pending}
            >
              <X size={16} aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Progress — "x od y" + thin bar */}
        <div className="mt-3 flex items-center gap-3">
          <span className="text-muted-foreground shrink-0 text-xs font-medium">
            {progressText}
          </span>
          <div
            role="progressbar"
            aria-valuenow={doneCount}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label={progressText}
            className="bg-primary/10 h-1.5 flex-1 overflow-hidden rounded-full"
          >
            <div
              className="bg-primary h-full rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Body */}
        {expanded && (
          allDone ? (
            <div className="mt-4 flex flex-col items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900/50 dark:bg-green-950/30 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400">
                  <Sparkles size={20} aria-hidden="true" />
                </span>
                <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                  {dict.completedTitle}
                </p>
              </div>
              <GuidedEntryDialog
                triggerLabel={guidedEntryDict.reopenButton}
                dict={guidedEntryDict}
              />
            </div>
          ) : (
            <ol className="mt-4 space-y-1.5">
              {steps.map((step, idx) => {
                const isNext = step.key === nextKey
                return (
                  <li
                    key={step.key}
                    className={cn(
                      "rounded-xl border p-3 transition-colors sm:p-3.5",
                      step.done
                        ? "border-transparent bg-muted/40"
                        : isNext
                          ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                          : "hover:border-primary/30",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {/* Status marker — check or step number */}
                      {step.done ? (
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400"
                          aria-hidden="true"
                        >
                          <Check size={14} strokeWidth={3} />
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                            isNext
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground",
                          )}
                          aria-hidden="true"
                        >
                          {idx + 1}
                        </span>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p
                            className={cn(
                              "text-sm font-medium leading-tight",
                              step.done && "text-muted-foreground",
                            )}
                          >
                            {stepLabel(step.key)}
                          </p>
                          {isNext && (
                            <Badge className="px-1.5 py-0 text-[10px] font-semibold">
                              {dict.nextStep}
                            </Badge>
                          )}
                        </div>
                        {!step.done && (
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            {stepDescription(step.key)}
                          </p>
                        )}
                      </div>

                      {/* CTA — the guided entry opens its dialog; others navigate */}
                      {!step.done &&
                        (step.key === "vertical" ? (
                          <GuidedEntryDialog
                            triggerLabel={stepCta(step.key)}
                            dict={guidedEntryDict}
                          />
                        ) : (
                          <Link href={step.href} className="shrink-0">
                            <Button size="sm" variant={isNext ? "default" : "outline"}>
                              {stepCta(step.key)}
                            </Button>
                          </Link>
                        ))}
                    </div>
                  </li>
                )
              })}
            </ol>
          )
        )}
      </CardContent>
    </Card>
  )
}
