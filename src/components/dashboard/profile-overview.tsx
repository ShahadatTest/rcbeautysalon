"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useI18n } from "@/lib/i18n/provider"
import {
  getOrgProfileOverview,
  type OrgProfileOverview,
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

const STATE_STYLE: Record<string, string> = {
  required: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  optional: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  disabled: "border-border bg-muted text-muted-foreground line-through decoration-1",
}

const STATE_LABEL: Record<string, { sl: string; en: string }> = {
  required: { sl: "obvezno", en: "required" },
  optional: { sl: "izbirno", en: "optional" },
  disabled: { sl: "izklopljeno", en: "disabled" },
}

/** Settings card showing the resolved activity profile and materialized assets. */
export function ProfileOverview() {
  const { locale, t } = useI18n()
  const [data, setData] = useState<OrgProfileOverview | { error: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getOrgProfileOverview()
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch(() => {
        if (!cancelled) setData({ error: "Napaka pri nalaganju." })
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
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-6 w-3/4" />
        </CardContent>
      </Card>
    )
  }

  if (!data || "error" in data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.profile.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            {data && "error" in data ? data.error : t.settings.profile.loadError}
          </p>
        </CardContent>
      </Card>
    )
  }

  const enabled = data.capabilities.filter((c) => c.state !== "disabled")
  const disabled = data.capabilities.filter((c) => c.state === "disabled")
  const capLabel = (key: string) =>
    locale === "en"
      ? CAPABILITY_LABELS[key]?.en ?? key
      : CAPABILITY_LABELS[key]?.sl ?? key
  const stateLabel = (state: string) =>
    locale === "en" ? STATE_LABEL[state]?.en : STATE_LABEL[state]?.sl

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>{t.settings.profile.title}</CardTitle>
            <CardDescription>{data.profileDescription}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono">
              {data.profileId}
            </Badge>
            <Badge variant="outline">v{data.profileVersion}</Badge>
            {data.materializedVersion && (
              <Badge variant="outline" className="font-mono text-xs">
                {data.materializedVersion}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Capabilities */}
        <section aria-label={t.settings.profile.capabilities}>
          <h4 className="mb-2 text-sm font-semibold">{t.settings.profile.capabilities}</h4>
          <div className="flex flex-wrap gap-1.5">
            {enabled.map((c) => (
              <Badge key={c.key} variant="outline" className={cn("font-normal", STATE_STYLE[c.state])}>
                {capLabel(c.key)} · {stateLabel(c.state)}
              </Badge>
            ))}
            {disabled.length > 0 && (
              <Badge variant="outline" className={cn("font-normal", STATE_STYLE.disabled)}>
                {disabled.map((c) => capLabel(c.key)).join(", ")} · {stateLabel("disabled")}
              </Badge>
            )}
          </div>
        </section>

        {/* Workflows */}
        {data.workflows.length > 0 && (
          <section aria-label={t.settings.profile.workflows}>
            <h4 className="mb-2 text-sm font-semibold">{t.settings.profile.workflows}</h4>
            <div className="space-y-3">
              {data.workflows.map((w) => (
                <div key={w.key} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">{w.name}</span>
                    <Badge variant="outline" className="font-mono text-xs">{w.entity}</Badge>
                  </div>
                  <ol className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    {w.stages.map((s, i) => (
                      <li key={s.key} className="flex items-center gap-1">
                        {i > 0 && <span aria-hidden>→</span>}
                        <span
                          className={cn(
                            "rounded border px-1.5 py-0.5",
                            s.isFinal && "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          )}
                        >
                          {s.name}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Forms */}
        {data.forms.length > 0 && (
          <section aria-label={t.settings.profile.forms}>
            <h4 className="mb-2 text-sm font-semibold">{t.settings.profile.forms}</h4>
            <ul className="space-y-1.5">
              {data.forms.map((f) => (
                <li key={f.key} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                  <span className="font-medium">{f.name}</span>
                  <span className="text-muted-foreground">
                    {f.fieldCount} {t.settings.profile.fieldsCount} · v{f.version}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Extensions */}
        {data.extensions.length > 0 && (
          <section aria-label={t.settings.profile.extensions}>
            <h4 className="mb-2 text-sm font-semibold">{t.settings.profile.extensions}</h4>
            <ul className="space-y-1.5">
              {data.extensions.map((e) => (
                <li key={e.id} className="rounded-lg border p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{e.name}</span>
                    <Badge variant="outline" className="font-mono text-xs">{e.id}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{e.description}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  )
}
