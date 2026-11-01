"use client"

// ============================================================
// E4-2b — ANALYTICS INTEGRATION CARD (owner-supplied GA4 ID)
//
// Honest by design: the field is optional, empty means NO analytics
// script anywhere (shown as an explicit status, not an empty box),
// and the card states exactly where the script does and does not run.
// ============================================================

import { useActionState, useEffect, useState } from "react"
import { toast } from "sonner"
import { BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SpinnerIcon } from "@/components/icons/spinner-icon"
import {
  updateAnalyticsIntegration,
  type AnalyticsIntegrationState,
} from "@/app/actions/analytics-settings"
import { useI18n } from "@/lib/i18n/provider"

interface AnalyticsIntegrationCardProps {
  /** Stored value on first render (from the settings page loader). */
  initialValue: string | null
}

export function AnalyticsIntegrationCard({
  initialValue,
}: AnalyticsIntegrationCardProps) {
  const { t } = useI18n()
  const a = t.settings.analyticsIntegration

  const [stored, setStored] = useState<string | null>(initialValue)
  const [value, setValue] = useState<string>(initialValue ?? "")

  const [state, formAction, isPending] = useActionState<
    AnalyticsIntegrationState | null,
    FormData
  >(updateAnalyticsIntegration, null)

  useEffect(() => {
    if (!state) return
    if (state.ok) {
      setStored(state.value)
      setValue(state.value ?? "")
      toast.success(state.value ? a.saved : a.cleared)
    } else if (state.error === "invalid") {
      toast.error(a.errInvalid)
    } else {
      toast.error(a.errFailed)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" aria-hidden />
          {a.title}
        </CardTitle>
        <CardDescription>{a.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={formAction} className="space-y-2">
          <Label htmlFor="analytics-measurement-id">{a.measurementId}</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="analytics-measurement-id"
              name="measurementId"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={a.placeholder}
              autoComplete="off"
              className="sm:max-w-xs font-mono"
            />
            <Button type="submit" disabled={isPending} className="sm:w-auto">
              {isPending ? (
                <>
                  <SpinnerIcon className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  {a.saving}
                </>
              ) : (
                a.save
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{a.hint}</p>
        </form>

        {/* Honest status line — never pretend the script is active. */}
        <div
          className="rounded-md border px-3 py-2 text-sm"
          role="status"
          aria-live="polite"
        >
          {stored ? (
            <>
              <span className="text-muted-foreground">{a.setTo}</span>{" "}
              <span className="font-mono font-medium">{stored}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{a.notSet}</span>
          )}
        </div>

        <p className="text-xs text-muted-foreground">{a.activeNote}</p>
      </CardContent>
    </Card>
  )
}
