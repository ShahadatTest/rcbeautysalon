"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { PencilLine, Rocket, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { publishSite } from "@/app/actions/publication"
import type { PublishState } from "@/lib/publication"

interface PreviewBannerProps {
  state: PublishState
  hasUnpublishedChanges: boolean
  /** Public (published) URL of the tenant site. */
  siteUrl: string
}

/**
 * Owner-only banner shown on /s/[slug]/preview (EPIC #3 E3-2): marks the page
 * as a DRAFT preview, offers publishing and a way back to the editor. Guests
 * never see it — they are redirected to the public site by the page gate.
 */
export function PreviewBanner({
  state,
  hasUnpublishedChanges,
  siteUrl,
}: PreviewBannerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [published, setPublished] = useState(false)

  const nowPublished = state === "PUBLISHED" || published
  const showPublishButton = !nowPublished || hasUnpublishedChanges

  const handlePublish = () => {
    startTransition(async () => {
      try {
        const result = await publishSite()
        if (result.success) {
          setPublished(true)
          toast.success("Spremembe so objavljene — javna stran je posodobljena.")
          router.refresh()
        } else {
          toast.error(result.errors.join(" "))
        }
      } catch {
        toast.error("Prišlo je do napake. Poskusite znova.")
      }
    })
  }

  return (
    <div className="bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-200 sticky top-0 z-50 border-b border-amber-200 dark:border-amber-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium">
          Predogled osnutka —
          {nowPublished
            ? hasUnpublishedChanges
              ? " spremembe še NISO objavljene. Obiščevalci vidijo zadnjo objavljeno verzijo."
              : " vsebina je objavljena in enaka javni strani."
            : " stran ni objavljena. Obiščevalci vidijo vzdrževalno stran."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={handlePublish}
            disabled={isPending || !showPublishButton}
            className="min-h-9 bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500"
          >
            <Rocket className="size-4" aria-hidden="true" />
            {nowPublished ? "Objavi spremembe" : "Objavi stran"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="min-h-9 border-amber-300 bg-transparent text-amber-950 hover:bg-amber-200 hover:text-amber-950 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-900"
            asChild
          >
            <Link href="/dashboard/settings">
              <PencilLine className="size-4" aria-hidden="true" />
              Nazaj v urejevalnik
            </Link>
          </Button>
          {nowPublished && (
            <Button
              size="sm"
              variant="ghost"
              className="min-h-9 text-amber-950 hover:bg-amber-200 hover:text-amber-950 dark:text-amber-200 dark:hover:bg-amber-900"
              asChild
            >
              <a href={siteUrl} target="_blank" rel="noopener noreferrer">
                <Undo2 className="size-4" aria-hidden="true" />
                Javna stran
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
