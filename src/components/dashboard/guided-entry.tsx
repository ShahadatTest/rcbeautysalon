"use client"

// ============================================================
// GUIDED ENTRY ("vodeni vstop") — the dashboard's first screen:
// WHO are you? (frizer / vulkanizer & avtoservis / kozmetika / …)
//
// Contract with the user's mental model:
//   1. FIRST choose the activity — BEFORE entering the workspace.
//   2. Each card honestly lists the modules that vertical opens
//      with ("kaj je zakupil") — required core vs. switchable extras.
//   3. Confirming CHANGES everything together: capabilities,
//      terminology, sidebar, forms/workflows (server action).
//   4. Same-vertical confirmation is non-destructive; changing the
//      vertical never deletes business data (honest notes shown).
//
// Two variants:
//   • gate   — full-screen first-run gate inside the dashboard
//              (rendered instead of the widgets until confirmed)
//   • dialog — re-run entry point from Settings → Dejavnosti
// ============================================================

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, LayoutGrid, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { modulesForVertical } from "@/lib/profiles/modules"
import { PROFILE_ICONS } from "@/lib/profiles/profile-icons"
import { PALETTE_OPTIONS, type PaletteOption } from "@/lib/palettes-client"
import { listProfileOptions, type ProfileOption } from "@/lib/profiles/registry"
import type { SettingsDict } from "@/lib/i18n/dict/settings"
import { completeGuidedEntry, getGuidedEntryContext } from "@/app/actions/guided-entry"

export interface GuidedEntryProps {
  profiles: ProfileOption[]
  currentVertical: string
  currentPalette: string
  dict: SettingsDict["guidedEntry"]
  variant?: "gate" | "dialog"
  onDone?: () => void
}

export function GuidedEntryBody({
  profiles,
  currentVertical,
  currentPalette,
  dict,
  onDone,
}: Omit<GuidedEntryProps, "variant">) {
  const router = useRouter()
  const [selected, setSelected] = useState(currentVertical)
  const [palette, setPalette] = useState(currentPalette)
  const [pending, startTransition] = useTransition()

  // "Kaj je zakupil" — module list for the selected activity, memoized
  // so the details panel re-renders cheaply while browsing cards.
  const modules = useMemo(() => modulesForVertical(selected), [selected])
  const selectedProfile = profiles.find((p) => p.id === selected)
  const changed = selected !== currentVertical || palette !== currentPalette

  const confirm = () => {
    startTransition(async () => {
      const res = await completeGuidedEntry({ vertical: selected, palette })
      if (!res.success) {
        toast.error(res.error ?? dict.error)
        return
      }
      if (res.catalogNote === "in-use") {
        toast.info(dict.catalogInUse)
      } else if (res.changed) {
        toast.success(dict.catalogReseeded)
      }
      toast.success(res.changed ? dict.changed : dict.confirmed)
      onDone?.()
      router.refresh()
    })
  }

  return (
    <div className="space-y-8">
      {/* Step 1 — activity picker */}
      <div>
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
          <span className="bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold">
            1
          </span>
          {dict.chooseActivity}
        </h2>
        <div
          role="radiogroup"
          aria-label={dict.chooseActivity}
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {profiles.map((profile) => {
            const Icon = PROFILE_ICONS[profile.id] ?? LayoutGrid
            const isSelected = selected === profile.id
            const isCurrent = profile.id === currentVertical
            return (
              <button
                key={profile.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelected(profile.id)}
                className={cn(
                  "relative rounded-xl border p-4 text-left transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/30"
                    : "hover:border-primary/40 hover:bg-muted/50"
                )}
              >
                {isCurrent && (
                  <Badge
                    variant="secondary"
                    className="absolute right-2 top-2 text-[10px]"
                  >
                    {dict.current}
                  </Badge>
                )}
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                      isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}
                  >
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold leading-tight">
                      {profile.label}
                    </h3>
                    <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                      {profile.description}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* "Kaj je zakupil" — modules that open with this activity */}
      {selectedProfile && (
        <div className="bg-muted/40 rounded-xl border p-4">
          <h3 className="text-sm font-semibold">
            {dict.included} —{" "}
            <span className="font-bold">{selectedProfile.label}</span>
          </h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {modules.map((m) => (
              <li key={m.key}>
                <Badge
                  variant={m.state === "required" ? "default" : "outline"}
                  className="gap-1 font-normal"
                  title={m.state === "required" ? dict.requiredTag : dict.optionalTag}
                >
                  {m.state === "required" ? (
                    <Check size={12} aria-hidden="true" />
                  ) : null}
                  {m.labelSl}
                </Badge>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-3 text-xs">{dict.contentsNote}</p>
        </div>
      )}

      {/* Step 2 — palette (optional) */}
      <div>
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold">
          <span className="bg-primary text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold">
            2
          </span>
          {dict.choosePalette}
        </h2>
        <div role="radiogroup" aria-label={dict.choosePalette} className="mt-4 flex flex-wrap gap-2">
          {PALETTE_OPTIONS.map((p: PaletteOption) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={palette === p.id}
              aria-label={p.label}
              onClick={() => setPalette(p.id)}
              className={cn(
                "flex items-center gap-2 rounded-full border py-1.5 pl-2 pr-3 text-sm transition-all",
                palette === p.id
                  ? "border-primary ring-2 ring-primary/30"
                  : "hover:border-primary/40"
              )}
            >
              <span
                className="h-5 w-5 rounded-full border border-black/10"
                style={{
                  background: `linear-gradient(135deg, ${p.primary} 50%, ${p.accent} 50%)`,
                }}
                aria-hidden="true"
              />
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Confirm — one honest action: switch (or keep) and enter. */}
      <div>
        <Button onClick={confirm} disabled={pending} size="lg" className="w-full sm:w-auto">
          {pending && <Loader2 size={16} className="mr-2 animate-spin" aria-hidden="true" />}
          {changed ? `${dict.switchTo} ${selectedProfile?.label ?? ""}` : dict.keepCurrent}
        </Button>
      </div>
    </div>
  )
}

/** Full-screen first-run gate — rendered INSTEAD of the dashboard widgets. */
export function GuidedEntryGate(props: Omit<GuidedEntryProps, "variant">) {
  return (
    <div className="flex min-h-[70vh] items-start justify-center py-10">
      <div className="w-full max-w-4xl space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {props.dict.title}
          </h1>
          <p className="text-muted-foreground mx-auto mt-2 max-w-2xl">
            {props.dict.subtitle}
          </p>
        </div>
        <GuidedEntryBody {...props} />
      </div>
    </div>
  )
}

/** Dialog entry point for Settings → Dejavnosti ("run guided entry again"). */
export function GuidedEntryDialog({
  triggerLabel,
  dict,
}: {
  triggerLabel: string
  dict: SettingsDict["guidedEntry"]
}) {
  const [open, setOpen] = useState(false)
  // Self-contained: profiles come from the client-safe registry; the
  // current vertical/palette arrive from the server action on open.
  const profiles = useMemo(() => listProfileOptions(), [])
  const [context, setContext] = useState<{
    currentVertical: string
    currentPalette: string
  } | null>(null)

  useEffect(() => {
    if (!open || context) return
    let cancelled = false
    getGuidedEntryContext().then((res) => {
      if (cancelled) return
      if ("error" in res) {
        toast.error(res.error)
        return
      }
      setContext({ currentVertical: res.currentVertical, currentPalette: res.currentPalette })
    })
    return () => {
      cancelled = true
    }
  }, [open, context])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{dict.title}</DialogTitle>
          <DialogDescription>{dict.reopenDescription}</DialogDescription>
        </DialogHeader>
        {context ? (
          <GuidedEntryBody
            profiles={profiles}
            currentVertical={context.currentVertical}
            currentPalette={context.currentPalette}
            dict={dict}
            onDone={() => setOpen(false)}
          />
        ) : (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin" size={24} aria-hidden="true" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
