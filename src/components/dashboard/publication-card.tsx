"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Globe, GlobeLock, Eye, Rocket, Undo2 } from "lucide-react"
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
import {
  publishSite,
  unpublishSite,
  type PublicationStatus,
} from "@/app/actions/publication"

interface PublicationCardProps {
  initial: PublicationStatus
  /** Public URL of the tenant site, for the preview link. */
  siteHref: string | null
}

const stateLabels: Record<PublicationStatus["state"], { label: string; className: string }> = {
  DRAFT: {
    label: "Osnutek",
    className: "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-300",
  },
  PUBLISHED: {
    label: "Objavljena",
    className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300",
  },
  UNPUBLISHED: {
    label: "Umaknjena",
    className: "bg-muted text-muted-foreground hover:bg-muted",
  },
}

/**
 * Settings → publication lifecycle card (EPIC #3 E3-1). The owner can publish
 * (server-validated) and unpublish the site; publish failures are shown
 * inline and never change the live state.
 */
export function PublicationCard({ initial, siteHref }: PublicationCardProps) {
  const [status, setStatus] = useState(initial)
  const [errors, setErrors] = useState<string[]>([])
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handlePublish = () => {
    setErrors([])
    startTransition(async () => {
      try {
        const result = await publishSite()
        if (result.success) {
          setStatus({ state: "PUBLISHED", publishedAt: new Date() })
          toast.success("Spletna stran je objavljena.")
        } else {
          setErrors(result.errors)
          toast.error("Objava ni uspela — glejte razlogi spodaj.")
        }
      } catch {
        toast.error("Prišlo je do napake. Poskusite znova.")
      }
    })
  }

  const handleUnpublish = () => {
    setErrors([])
    startTransition(async () => {
      try {
        await unpublishSite()
        setStatus((s) => ({ ...s, state: "UNPUBLISHED" }))
        toast.success("Objava je umaknjena. Obiščevalci zdaj vidijo vzdrževalno stran.")
      } catch {
        toast.error("Prišlo je do napake. Poskusite znova.")
      }
    })
  }

  const badge = stateLabels[status.state]

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Globe className="size-5" aria-hidden="true" />
            Objava spletne strani
          </CardTitle>
          <CardDescription>
            Objavite stran za obiščevalce ali jo začasno umaknite. Vaši podatki
            ostanejo vedno ohranjeni.
          </CardDescription>
        </div>
        <Badge className={badge.className}>{badge.label}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.publishedAt && status.state === "PUBLISHED" && (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Eye className="size-4" aria-hidden="true" />
            Objavljeno{" "}
            {new Date(status.publishedAt).toLocaleDateString("sl-SI", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        )}

        {errors.length > 0 && (
          <div
            role="alert"
            className="border-destructive/30 bg-destructive/10 space-y-1 rounded-md border p-3 text-sm"
          >
            <p className="font-medium">Stran še ni pripravljena za objavo:</p>
            <ul className="list-disc space-y-0.5 pl-5">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {status.state !== "PUBLISHED" ? (
            <Button onClick={handlePublish} disabled={isPending} className="min-h-11">
              <Rocket className="size-4" aria-hidden="true" />
              {isPending ? "Objavljanje …" : "Objavi stran"}
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(true)}
              disabled={isPending}
              className="min-h-11"
            >
              <GlobeLock className="size-4" aria-hidden="true" />
              Umakni objavo
            </Button>
          )}
          {siteHref && (
            <Button asChild variant="ghost" className="min-h-11">
              <a href={siteHref} target="_blank" rel="noopener noreferrer">
                <Eye className="size-4" aria-hidden="true" />
                Oglej si stran
              </a>
            </Button>
          )}
        </div>

        {status.state === "DRAFT" && (
          <p className="text-muted-foreground text-xs">
            Stran je trenutno vidna samo vam (predogled zgoraj). Obiščevalci vidijo
            sporočilo, da stran ni objavljena.
          </p>
        )}

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Umakniti objavo strani?</AlertDialogTitle>
              <AlertDialogDescription>
                Stran ne bo več javno dostopna — obiščevalci bodo videli
                vzdrževalno stran. Vsi podatki (storitve, izdelki, stranke,
                naročila) ostanejo ohranjeni in objavo lahko kadar koli ponovite.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Prekliči</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault()
                  setConfirmOpen(false)
                  handleUnpublish()
                }}
                className="min-h-11"
              >
                <Undo2 className="mr-2 size-4" aria-hidden="true" />
                Umakni objavo
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
