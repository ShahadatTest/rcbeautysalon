"use client"

// ============================================================
// DOMAINS CARD (EPIC #3 E3-6 — issue #3 §7)
// Settings → custom domains: add, DNS instructions, verify,
// set primary, remove.
//
// Honesty first:
//  • provider not configured → visible "setup required" banner,
//    the record stays PENDING, verification buttons answer
//    SETUP_REQUIRED — never a fake "connected";
//  • VERIFIED is set EXCLUSIVELY by the provider confirmation
//    path on the server;
//  • plan gate: FREE tenants see the upgrade hint instead of
//    the add form.
// ============================================================

import { useState, useTransition, type FormEvent } from "react"
import { toast } from "sonner"
import {
  CheckCircle2,
  Clock,
  Copy,
  Globe,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  TriangleAlert,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
import {
  addCustomDomain,
  removeCustomDomain,
  setPrimaryDomain,
  verifyCustomDomain,
  type DomainsStatus,
} from "@/app/actions/domains"
import type { CustomDomainView } from "@/lib/domains/types"

interface DomainsCardProps {
  initial: DomainsStatus
  /** Tenant path address on the platform, e.g. /s/my-salon */
  sitePath: string | null
}

/** Shape returned by the domain server actions. */
type DomainActionResultUi =
  | { success: true; domains: CustomDomainView[] }
  | { success: false; code: string; message: string; messageEn: string }

const statusMeta: Record<
  CustomDomainView["status"],
  { label: string; className: string; icon: typeof Clock }
> = {
  PENDING: {
    label: "Čaka na DNS",
    className:
      "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300",
    icon: Clock,
  },
  VERIFIED: {
    label: "Preverjena",
    className:
      "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300",
    icon: CheckCircle2,
  },
  FAILED: {
    label: "Napaka",
    className: "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-950 dark:text-red-300",
    icon: XCircle,
  },
}

function CopyButton({ value }: { value: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-7"
      aria-label={`Kopiraj ${value}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          toast.success("Kopirano.")
        } catch {
          toast.error("Kopiranje ni uspelo.")
        }
      }}
    >
      <Copy className="size-3.5" aria-hidden="true" />
    </Button>
  )
}

function DnsInstructions({ records }: { records: NonNullable<CustomDomainView["dnsRecords"]> }) {
  if (records.length === 0) return null
  return (
    <div className="rounded-md border bg-muted/40 p-3 text-sm">
      <p className="mb-2 font-medium">DNS zapisi pri vašem ponudniku domen:</p>
      <ul className="space-y-1.5">
        {records.map((rec, i) => (
          <li key={`${rec.type}-${rec.name}-${i}`} className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="font-mono text-[11px]">
              {rec.type}
            </Badge>
            <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">{rec.name}</code>
            <span aria-hidden="true">→</span>
            <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs">{rec.value}</code>
            <CopyButton value={rec.value} />
            {rec.description ? (
              <span className="w-full text-xs text-muted-foreground">{rec.description}</span>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Spremembe DNS lahko trajajo do nekaj ur. Status se osveži z gumbom &quot;Preveri&quot;.
      </p>
    </div>
  )
}

export function DomainsCard({ initial, sitePath }: DomainsCardProps) {
  const [status, setStatus] = useState<DomainsStatus>(initial)
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<CustomDomainView | null>(null)
  const [isPending, startTransition] = useTransition()

  const planLocked = !status.planAllowsCustomDomains

  const run = (fn: () => Promise<DomainActionResultUi>) => {
    startTransition(async () => {
      try {
        const result = await fn()
        if (result.success) {
          setStatus((s) => ({ ...s, domains: result.domains }))
        } else {
          setError(result.message)
          toast.error(result.message)
        }
      } catch {
        toast.error("Dejanje ni uspelo. Poskusite znova.")
      }
    })
  }

  const handleAdd = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const raw = value.trim()
    if (!raw) return
    run(async () => {
      const result = await addCustomDomain(raw)
      if (result.success) setValue("")
      return result
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="size-5" aria-hidden="true" />
          Lastna domena
        </CardTitle>
        <CardDescription>
          Povežite svojo spletno domeno (npr. moj-salon.si) s svojo stranjo.
          {sitePath ? (
            <>
              {" "}
              Trenutno dosegljivo na:{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{sitePath}</code>
            </>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!status.providerConfigured && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>
              Povezovanje lastnih domen še ni aktivirano na platformi (ponudnik domen ni
              konfiguriran). Lahko dodate domeno in pripravite DNS zapise; preverjanje bo
              mogoče, ko operater konfigurira ponudnika.
            </p>
          </div>
        )}

        {planLocked ? (
          <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm">
            <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p>
              Lastne domene so na voljo v paketih PRO in SCALE. Nadgradite paket v zavihku
              &quot;Osnovno&quot; (sekcija Paket in raba).
            </p>
          </div>
        ) : (
          <form onSubmit={handleAdd} className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="moj-salon.si"
              aria-label="Domena za povezavo"
              autoComplete="off"
              disabled={isPending}
            />
            <Button type="submit" disabled={isPending || value.trim().length === 0} className="sm:w-auto">
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="size-4" aria-hidden="true" />
              )}
              Dodaj domeno
            </Button>
          </form>
        )}

        {error && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        )}

        {status.domains.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ni povezanih domen. {planLocked ? "" : "Dodajte domeno zgoraj."}
          </p>
        ) : (
          <ul className="space-y-3">
            {status.domains.map((d) => {
              const meta = statusMeta[d.status]
              const Icon = meta.icon
              return (
                <li key={d.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-medium">{d.domain}</span>
                    <Badge className={meta.className}>
                      <Icon className="size-3" aria-hidden="true" />
                      {meta.label}
                    </Badge>
                    {d.isPrimary && (
                      <Badge variant="outline">
                        <Star className="size-3" aria-hidden="true" />
                        Primarna
                      </Badge>
                    )}
                    <span className="ml-auto flex items-center gap-1">
                      {!planLocked && d.status !== "VERIFIED" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => run(() => verifyCustomDomain(d.id))}
                        >
                          <RefreshCw className="size-3.5" aria-hidden="true" />
                          Preveri
                        </Button>
                      )}
                      {!planLocked && d.status === "VERIFIED" && !d.isPrimary && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => run(() => setPrimaryDomain(d.id))}
                        >
                          <Star className="size-3.5" aria-hidden="true" />
                          Nastavi kot primarno
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 dark:text-red-400"
                        disabled={isPending}
                        onClick={() => setRemoveTarget(d)}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                        Odstrani
                      </Button>
                    </span>
                  </div>

                  {d.lastError && d.status !== "VERIFIED" && (
                    <p className="mt-2 text-xs text-muted-foreground">{d.lastError}</p>
                  )}

                  {d.status === "PENDING" && d.dnsRecords && (
                    <div className="mt-3">
                      <DnsInstructions records={d.dnsRecords} />
                    </div>
                  )}
                  {d.status === "PENDING" && !d.dnsRecords && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Usmerite CNAME zapis na platformo (ali A zapis za korensko domeno) in
                      kliknite &quot;Preveri&quot;. Točne vrednosti se prikažejo, ko je ponudnik
                      domen konfiguriran.
                    </p>
                  )}
                  {d.status === "VERIFIED" && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Domena je preverjena{d.isPrimary ? " in primarna" : ""}. DNS/SSL vodenje
                      opravi ponudnik domen.
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <AlertDialog open={removeTarget !== null} onOpenChange={(open) => !open && setRemoveTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Odstraniti domeno {removeTarget?.domain}?</AlertDialogTitle>
              <AlertDialogDescription>
                Domena se odstrani s strani in pri ponudniku. Vaša stran ostane dosegljiva na
                platformnem naslovu.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Prekliči</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const target = removeTarget
                  setRemoveTarget(null)
                  if (target) run(() => removeCustomDomain(target.id))
                }}
              >
                Odstrani
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
