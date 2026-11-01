"use client"

// E2-5 (G5): settings card showing the tenant's configuration history
// (profile overrides / form definitions / workflow definitions) with a
// snapshot preview and per-version revert. Invariant surfaced in the UI
// copy: a revert NEVER rewrites history — it appends a NEW version.

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useI18n } from "@/lib/i18n/provider"
import { OVERRIDES_ENTITY_KEY } from "@/lib/config-history/logic"
import {
  getConfigEntities,
  getConfigHistory,
  revertConfigChange,
  type ConfigEntityInfo,
  type ConfigHistoryEntry,
} from "@/app/actions/config-history"

function entityLabel(info: ConfigEntityInfo, t: ReturnType<typeof useI18n>["t"]): string {
  if (info.entityKey === OVERRIDES_ENTITY_KEY) return t.settings.history.entityOverrides
  const prefix =
    info.kind === "form"
      ? t.settings.history.entityForm
      : info.kind === "workflow"
        ? t.settings.history.entityWorkflow
        : info.entityKey
  return info.label ? `${prefix}: ${info.label}` : prefix
}

function actionBadgeClass(action: string): string {
  switch (action) {
    case "REVERT":
      return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
    case "RESET":
      return "border-border bg-muted text-muted-foreground"
    default:
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
  }
}

function SnapshotPreview({
  entry,
  t,
}: {
  entry: ConfigHistoryEntry
  t: ReturnType<typeof useI18n>["t"]
}) {
  const blocks: { title: string; value: unknown }[] = [
    { title: t.settings.history.previous, value: entry.previous },
    { title: t.settings.history.next, value: entry.next },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {blocks.map((b) => (
        <div key={b.title}>
          <p className="mb-1 text-xs font-medium text-muted-foreground">{b.title}</p>
          <pre className="max-h-48 overflow-y-auto rounded-md bg-muted/50 p-3 text-xs leading-relaxed">
            {b.value == null ? "—" : JSON.stringify(b.value, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  )
}

export function ConfigHistoryCard() {
  const { t, locale } = useI18n()
  const [entities, setEntities] = useState<ConfigEntityInfo[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  /** Loaded history keyed by the entity it belongs to (derived loading state). */
  const [historyData, setHistoryData] = useState<{ key: string; entries: ConfigHistoryEntry[] } | null>(null)
  const [openPreview, setOpenPreview] = useState<number | null>(null)
  const [revertTarget, setRevertTarget] = useState<ConfigHistoryEntry | null>(null)
  const [pending, startTransition] = useTransition()

  const entries = historyData && historyData.key === selected ? historyData.entries : null
  const entriesLoading = selected != null && !loadError && historyData?.key !== selected

  useEffect(() => {
    let cancelled = false
    getConfigEntities()
      .then((res) => {
        if (cancelled) return
        if (res.ok) {
          setEntities(res.entities)
          setSelected(res.entities[0]?.entityKey ?? null)
        } else {
          setLoadError(true)
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    getConfigHistory({ entityKey: selected })
      .then((res) => {
        if (cancelled) return
        if (res.ok) {
          setHistoryData({ key: selected, entries: res.entries })
          setOpenPreview(null)
        } else {
          setLoadError(true)
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [selected])

  function confirmRevert() {
    if (!revertTarget || !selected) return
    const targetVersion = revertTarget.version
    startTransition(async () => {
      const res = await revertConfigChange({
        entityKey: selected,
        version: targetVersion,
      })
      setRevertTarget(null)
      if (res.ok) {
        toast.success(t.settings.history.reverted.replace("{{version}}", String(targetVersion)))
        window.location.reload()
      } else {
        const map: Record<string, string> = {
          NOT_FOUND: t.settings.history.notFound,
          NOT_REVERTABLE: t.settings.history.notRevertable,
          ENTITY_GONE: t.settings.history.entityGone,
          INVALID: t.settings.history.invalid,
        }
        toast.error(map[res.error ?? ""] ?? t.settings.history.error)
      }
    })
  }

  if (loadError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.history.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{t.settings.history.loadError}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.settings.history.title}</CardTitle>
        <CardDescription>{t.settings.history.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {entities === null ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-full sm:w-80" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : entities.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.settings.history.empty}</p>
        ) : (
          <>
            <div>
              <p className="mb-1.5 text-sm font-medium text-muted-foreground">
                {t.settings.history.entity}
              </p>
              <Select value={selected ?? undefined} onValueChange={setSelected}>
                <SelectTrigger className="w-full sm:w-96" aria-label={t.settings.history.entity}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {entities.map((e) => (
                    <SelectItem key={e.entityKey} value={e.entityKey}>
                      {entityLabel(e, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {entriesLoading || entries === null ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.settings.history.empty}</p>
            ) : (
              <ul className="max-h-96 space-y-2 overflow-y-auto pr-1" aria-label={t.settings.history.title}>
                {entries.map((entry) => (
                  <li
                    key={entry.version}
                    className="rounded-lg border p-3 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">
                        v{entry.version}
                        {entry.version === entries[0].version && (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            ({t.settings.history.current})
                          </span>
                        )}
                      </span>
                      <Badge variant="outline" className={actionBadgeClass(entry.action)}>
                        {t.settings.history.actions[entry.action as "UPDATE"] ?? entry.action}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString(locale === "en" ? "en-GB" : "sl-SI")}
                      </span>
                      <span className="text-xs text-muted-foreground">{entry.actorEmail}</span>
                      <span className="ml-auto flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setOpenPreview(openPreview === entry.version ? null : entry.version)
                          }
                          aria-expanded={openPreview === entry.version}
                        >
                          {t.settings.history.preview}
                        </Button>
                        {entry.revertable && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={pending}
                            onClick={() => setRevertTarget(entry)}
                          >
                            {t.settings.history.revert}
                          </Button>
                        )}
                      </span>
                    </div>
                    {entry.summary && (
                      <p className="mt-1 text-sm text-muted-foreground">{entry.summary}</p>
                    )}
                    {openPreview === entry.version && (
                      <div className="mt-3">
                        <SnapshotPreview entry={entry} t={t} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>

      <Dialog open={revertTarget !== null} onOpenChange={(open) => !open && setRevertTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t.settings.history.revertConfirm.replace(
                "{{version}}",
                String(revertTarget?.version ?? "")
              )}
            </DialogTitle>
            <DialogDescription>{t.settings.history.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRevertTarget(null)}>
              {t.common.actions.cancel}
            </Button>
            <Button type="button" onClick={confirmRevert} disabled={pending}>
              {t.settings.history.revert}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
