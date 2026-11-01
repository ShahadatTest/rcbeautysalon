"use client"

// E2-4 (G4): settings card for the org's activities. The PRIMARY activity
// is read-only here (it owns terminology, forms, workflows and site content);
// the owner may pick ONE secondary activity whose capability set is UNIONED
// into the effective profile. Server-side rules live in
// src/lib/profiles/secondary.ts (same codes mirrored in the action).

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useI18n } from "@/lib/i18n/provider"
import { EXTENSIONS } from "@/lib/profiles/extensions"
import {
  getOrgActivities,
  setOrgSecondaryVertical,
  type OrgActivitiesInfo,
} from "@/app/actions/profile"

const CAPABILITY_LABELS: Record<string, { sl: string; en: string }> = {
  appointments: { sl: "Termini in rezervacije", en: "Appointments & bookings" },
  workOrders: { sl: "Delovna naročila", en: "Work orders" },
  shop: { sl: "Spletna trgovina", en: "Online shop" },
  services: { sl: "Katalog storitev", en: "Service catalog" },
  inventory: { sl: "Zaloge", en: "Inventory" },
  customers: { sl: "Stranke", en: "Customers" },
  staff: { sl: "Zaposleni", en: "Staff" },
  analytics: { sl: "Analitika", en: "Analytics" },
  reviews: { sl: "Ocene", en: "Reviews" },
  forms: { sl: "Dinamični obrazci", en: "Dynamic forms" },
  workflows: { sl: "Poslovni procesi", en: "Workflows" },
  documents: { sl: "Dokumenti", en: "Documents" },
  delivery: { sl: "Dostava", en: "Delivery" },
}

function errorCodeToText(code: string, t: ReturnType<typeof useI18n>["t"]): string {
  switch (code) {
    case "UNKNOWN_PROFILE":
      return t.settings.activities.unknownProfile
    case "SAME_PROFILE":
      return t.settings.activities.sameProfile
    case "RESTRICTED":
      return t.settings.activities.restricted
    case "INVALID":
      return t.settings.activities.invalid
    default:
      return t.settings.activities.error
  }
}

export function ActivitiesCard() {
  const { t, locale } = useI18n()
  const [data, setData] = useState<OrgActivitiesInfo | { error: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false
    getOrgActivities()
      .then((res) => {
        if (cancelled) return
        setData(res)
      })
      .catch(() => {
        if (!cancelled) setData({ error: "load" })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-80" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-9 w-full sm:w-72" />
          <Skeleton className="h-6 w-2/3" />
        </CardContent>
      </Card>
    )
  }

  if (!data || "error" in data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.activities.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{t.settings.activities.loadError}</p>
        </CardContent>
      </Card>
    )
  }

  const hasContribution =
    data.secondaryId != null &&
    (data.contribution.capabilities.length > 0 || data.contribution.extensions.length > 0)

  function save(next: string | null) {
    startTransition(async () => {
      const res = await setOrgSecondaryVertical({ secondaryVertical: next })
      if (res.ok) {
        // The union changes nav/dashboard everywhere → full reload shows
        // the new state (toast would be killed by the reload anyway).
        window.location.reload()
      } else {
        toast.error(errorCodeToText(res.error ?? "GENERIC", t))
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.settings.activities.title}</CardTitle>
        <CardDescription>{t.settings.activities.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {t.settings.activities.primary}
            </p>
            <Badge variant="outline" className="mt-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              {data.primaryLabel}
            </Badge>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {t.settings.activities.secondary}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Select
                value={data.secondaryId ?? "none"}
                onValueChange={(v) => {
                  const next = v === "none" ? null : v
                  if (next === data.secondaryId) return
                  save(next)
                }}
                disabled={pending}
              >
                <SelectTrigger
                  className="w-full sm:w-64"
                  aria-label={t.settings.activities.secondary}
                >
                  <SelectValue placeholder={t.settings.activities.secondaryPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t.settings.activities.secondaryNone}</SelectItem>
                  {data.options.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {pending && (
                <span className="text-xs text-muted-foreground" role="status">
                  …
                </span>
              )}
            </div>
          </div>
        </div>

        {hasContribution && (
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {t.settings.activities.addsLabel}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {data.contribution.capabilities.map((cap) => (
                <Badge key={cap} variant="secondary">
                  {CAPABILITY_LABELS[cap]?.[locale] ?? cap}
                </Badge>
              ))}
              {data.contribution.extensions.map((ext) => (
                <Badge key={ext} variant="outline">
                  {EXTENSIONS[ext]?.name ?? ext}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
