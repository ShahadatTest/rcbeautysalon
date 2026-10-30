"use client"

// ============================================================
// IZGLED IN VSEBINA — admin editor for the public salon site.
// Loads org branding + SiteContent, edits it in local state and
// saves the whole object via updateSiteContent. Theme palette,
// logo and vertical are saved instantly (dedicated actions).
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  EyeIcon,
  ImageIcon,
  PlusIcon,
  SpinnerIcon,
  TrashIcon,
  WarningCircleIcon,
} from "@/components/icons"
import {
  getOrgBranding,
  updateOrgLogo,
  updateOrgPalette,
  updateOrgVertical,
  updateSiteContent,
} from "@/app/actions/site-content"
import {
  SECTION_KEYS,
  type FeatureContent,
  type OpeningHour,
  type SectionKey,
  type SiteContent,
  type StatContent,
} from "@/lib/site-content"
import { uploadImage } from "@/lib/upload-client"
import { PALETTE_OPTIONS, VERTICAL_OPTIONS } from "@/lib/palettes-client"
import { cn } from "@/lib/utils"

// ------------------------------------------------------------
// Constants
// ------------------------------------------------------------

const ICON_OPTIONS = [
  "Sparkles",
  "Scissors",
  "CalendarCheck",
  "ShoppingBag",
  "Leaf",
  "ShieldCheck",
  "Microscope",
  "HeartHandshake",
  "Zap",
  "Flame",
  "Star",
  "Clock",
] as const

const SECTION_LABELS: Record<SectionKey, string> = {
  hero: "Hero",
  features: "Prednosti",
  services: "Storitve",
  about: "O salonu",
  team: "Ekipa",
  shop: "Trgovina",
  cta: "Poziv k akciji (CTA)",
}

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const DAY_NAMES: Record<number, string> = {
  0: "Nedelja",
  1: "Ponedeljek",
  2: "Torek",
  3: "Sreda",
  4: "Četrtek",
  5: "Petek",
  6: "Sobota",
}

interface OrgInfo {
  id: string
  slug: string
  name: string
  logo: string | null
  vertical: string
  palette: string | null
  siteUrl: string
}

/** Ensure exactly 7 rows, Monday-first, closed when open/close missing. */
function normalizeHours(hours: OpeningHour[]): OpeningHour[] {
  return DAY_ORDER.map((day) => {
    const found = hours.find((h) => h.day === day)
    if (!found || !found.open || !found.close) {
      return { day, open: null, close: null }
    }
    return { day, open: found.open, close: found.close }
  })
}

// ------------------------------------------------------------
// Small internal building blocks
// ------------------------------------------------------------

function EditorCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function ImageField({
  label,
  value,
  variant = "wide",
  uploading = false,
  emptyText = "Ni slike",
  uploadLabel = "Naloži sliko",
  hint,
  onFile,
  onRemove,
}: {
  label: string
  value?: string
  variant?: "square" | "wide"
  uploading?: boolean
  emptyText?: string
  uploadLabel?: string
  hint?: string
  onFile: (file: File) => void
  onRemove?: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-4">
        <div
          className={cn(
            "relative shrink-0 overflow-hidden rounded-lg border bg-muted",
            variant === "wide" ? "h-28 w-48" : "h-20 w-20"
          )}
        >
          {value ? (
            <Image
              src={value}
              alt={label}
              fill
              sizes="192px"
              className={variant === "wide" ? "object-cover" : "object-contain p-1"}
            />
          ) : (
            <div className="grid h-full place-items-center px-2 text-center text-xs text-muted-foreground">
              {emptyText}
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 grid place-items-center bg-background/70">
              <SpinnerIcon size={20} className="animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <ImageIcon size={16} className="mr-2" />
            {uploadLabel}
          </Button>
          {value && onRemove && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={onRemove}
              disabled={uploading}
            >
              <TrashIcon size={16} className="mr-2" />
              Odstrani
            </Button>
          )}
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ""
        }}
      />
    </div>
  )
}

function FeatureRow({
  index,
  item,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number
  item: FeatureContent
  canRemove: boolean
  onChange: (patch: Partial<FeatureContent>) => void
  onRemove: () => void
}) {
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={item.icon} onValueChange={(v) => onChange({ icon: v })}>
          <SelectTrigger className="sm:w-48" aria-label={`Ikona prednosti ${index + 1}`}>
            <SelectValue placeholder="Ikona" />
          </SelectTrigger>
          <SelectContent>
            {ICON_OPTIONS.map((icon) => (
              <SelectItem key={icon} value={icon}>
                {icon}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="flex-1"
          value={item.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Naslov prednosti"
          aria-label={`Naslov prednosti ${index + 1}`}
        />
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={onRemove}
            aria-label={`Odstrani prednost ${index + 1}`}
          >
            <TrashIcon size={16} />
          </Button>
        )}
      </div>
      <Input
        value={item.description}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder="Kratek opis"
        aria-label={`Opis prednosti ${index + 1}`}
      />
    </div>
  )
}

function SectionTitlePair({
  label,
  titleId,
  subtitleId,
  title,
  subtitle,
  onTitle,
  onSubtitle,
}: {
  label: string
  titleId: string
  subtitleId: string
  title: string
  subtitle: string
  onTitle: (value: string) => void
  onSubtitle: (value: string) => void
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{label}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Naslov" htmlFor={titleId}>
          <Input id={titleId} value={title} onChange={(e) => onTitle(e.target.value)} />
        </Field>
        <Field label="Podnaslov" htmlFor={subtitleId}>
          <Input id={subtitleId} value={subtitle} onChange={(e) => onSubtitle(e.target.value)} />
        </Field>
      </div>
    </div>
  )
}

function EditorSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl border p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-3 h-4 w-72 max-w-full" />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      ))}
      <span className="sr-only">Nalaganje urejevalnika izgleda in vsebine …</span>
    </div>
  )
}

// ------------------------------------------------------------
// Main component
// ------------------------------------------------------------

export function BrandingEditor() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [org, setOrg] = useState<OrgInfo | null>(null)
  const [content, setContent] = useState<SiteContent | null>(null)
  const [dirty, setDirty] = useState(false)

  const [saving, setSaving] = useState(false)
  const [savingPalette, setSavingPalette] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null) // "logo" | "hero" | "about"
  const [savingLogo, setSavingLogo] = useState(false)

  const [vertical, setVertical] = useState("")
  const [reseed, setReseed] = useState(false)
  const [savingVertical, setSavingVertical] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getOrgBranding()
      if ("org" in res && "siteContent" in res && res.org && res.siteContent) {
        setOrg(res.org)
        setContent(res.siteContent)
        setVertical(res.org.vertical)
        setDirty(false)
      } else {
        setError(
          "error" in res && typeof res.error === "string"
            ? res.error
            : "Prilagoditev ni bilo mogoče naložiti."
        )
      }
    } catch {
      setError("Prilagoditev ni bilo mogoče naložiti. Poskusite znova.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /** Immutable update of a top-level SiteContent field. */
  const set = useCallback(
    <K extends keyof SiteContent>(field: K, value: SiteContent[K]) => {
      setContent((prev) => (prev ? { ...prev, [field]: value } : prev))
      setDirty(true)
    },
    []
  )

  // ----------------------------------------------------------
  // Instant-save handlers (palette, logo, vertical, images)
  // ----------------------------------------------------------

  const handlePalette = async (id: string) => {
    if (!org || savingPalette || org.palette === id) return
    setSavingPalette(id)
    try {
      const res = await updateOrgPalette(id)
      if ("error" in res && typeof res.error === "string") {
        toast.error(res.error)
        return
      }
      setOrg({ ...org, palette: id })
      toast.success("Tema je shranjena")
      router.refresh()
    } catch {
      toast.error("Shranjevanje teme ni uspelo. Poskusite znova.")
    } finally {
      setSavingPalette(null)
    }
  }

  const handleLogoUpload = async (file: File) => {
    setUploading("logo")
    try {
      const url = await uploadImage(file, "logo")
      const res = await updateOrgLogo(url)
      if ("error" in res && typeof res.error === "string") {
        toast.error(res.error)
        return
      }
      setOrg((prev) => (prev ? { ...prev, logo: url } : prev))
      toast.success("Logo je shranjen")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nalaganje logotipa ni uspelo.")
    } finally {
      setUploading(null)
    }
  }

  const handleLogoRemove = async () => {
    setSavingLogo(true)
    try {
      const res = await updateOrgLogo(null)
      if ("error" in res && typeof res.error === "string") {
        toast.error(res.error)
        return
      }
      setOrg((prev) => (prev ? { ...prev, logo: null } : prev))
      toast.success("Logo je odstranjen")
      router.refresh()
    } catch {
      toast.error("Odstranjevanje logotipa ni uspelo.")
    } finally {
      setSavingLogo(false)
    }
  }

  const handleImageUpload = async (key: "hero" | "about", file: File) => {
    if (!content) return
    setUploading(key)
    try {
      const url = await uploadImage(file, key)
      if (key === "hero") {
        set("hero", { ...content.hero, imageUrl: url })
      } else {
        set("about", { ...content.about, imageUrl: url })
      }
      toast.success("Slika je naložena — ne pozabite shraniti sprememb")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nalaganje slike ni uspelo.")
    } finally {
      setUploading(null)
    }
  }

  const handleVertical = async () => {
    if (!org || savingVertical) return
    const label = VERTICAL_OPTIONS.find((v) => v.id === vertical)?.label ?? vertical
    const confirmed = window.confirm(
      `Zamenjam panogo na "${label}"?` +
        (reseed ? "\nKatalog bo dopolnjen z vzorčnimi storitvami nove panoge." : "")
    )
    if (!confirmed) return
    setSavingVertical(true)
    try {
      const res = await updateOrgVertical(vertical, reseed)
      if ("error" in res && typeof res.error === "string") {
        toast.error(res.error)
        return
      }
      setOrg({ ...org, vertical })
      toast.success("Panoga je zamenjana")
      router.refresh()
    } catch {
      toast.error("Zamenjava panoge ni uspela.")
    } finally {
      setSavingVertical(false)
    }
  }

  // ----------------------------------------------------------
  // Content field helpers
  // ----------------------------------------------------------

  const updateParagraph = (idx: number, value: string) => {
    if (!content) return
    const paragraphs = [...content.about.paragraphs]
    while (paragraphs.length < 2) paragraphs.push("")
    paragraphs[idx] = value
    set("about", { ...content.about, paragraphs })
  }

  const updateStat = (idx: number, patch: Partial<StatContent>) => {
    if (!content) return
    const stats = content.about.stats.map((s, i) => (i === idx ? { ...s, ...patch } : s))
    set("about", { ...content.about, stats })
  }

  const addStat = () => {
    if (!content || content.about.stats.length >= 4) return
    set("about", {
      ...content.about,
      stats: [...content.about.stats, { value: "", label: "" }],
    })
  }

  const removeStat = (idx: number) => {
    if (!content) return
    set("about", {
      ...content.about,
      stats: content.about.stats.filter((_, i) => i !== idx),
    })
  }

  const updateFeature = (idx: number, patch: Partial<FeatureContent>) => {
    if (!content) return
    const items = content.features.items.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    set("features", { ...content.features, items })
  }

  const addFeature = () => {
    if (!content || content.features.items.length >= 6) return
    set("features", {
      ...content.features,
      items: [...content.features.items, { icon: "Sparkles", title: "", description: "" }],
    })
  }

  const removeFeature = (idx: number) => {
    if (!content) return
    set("features", {
      ...content.features,
      items: content.features.items.filter((_, i) => i !== idx),
    })
  }

  const updateHour = (day: number, patch: Partial<OpeningHour>) => {
    if (!content) return
    const hours = normalizeHours(content.openingHours).map((h) =>
      h.day === day ? { ...h, ...patch } : h
    )
    set("openingHours", hours)
  }

  const toggleDayOpen = (day: number, open: boolean) => {
    updateHour(day, open ? { open: "09:00", close: "18:00" } : { open: null, close: null })
  }

  const toggleSection = (key: SectionKey, visible: boolean) => {
    if (!content) return
    const sections = SECTION_KEYS.map((k) => ({
      key: k,
      visible: k === key ? visible : (content.sections.find((s) => s.key === k)?.visible ?? true),
    }))
    set("sections", sections)
  }

  // ----------------------------------------------------------
  // Save whole SiteContent
  // ----------------------------------------------------------

  const handleSave = async () => {
    if (!content) return
    if (!content.hero.title.trim()) {
      toast.error("Hero naslov je obvezen.")
      return
    }
    setSaving(true)
    try {
      const payload: SiteContent = {
        ...content,
        hero: {
          ...content.hero,
          eyebrow: content.hero.eyebrow?.trim() || undefined,
          videoUrl: content.hero.videoUrl?.trim() || undefined,
          posterUrl: content.hero.posterUrl?.trim() || undefined,
          primaryCta: {
            label: content.hero.primaryCta.label.trim() || "Rezerviraj termin",
            href: "/booking",
          },
          secondaryCta: content.hero.secondaryCta?.label?.trim()
            ? { label: content.hero.secondaryCta.label.trim(), href: "/shop" }
            : null,
        },
        about: {
          ...content.about,
          paragraphs: content.about.paragraphs.map((p) => p.trim()).filter(Boolean),
          stats: content.about.stats.filter((s) => s.value.trim() || s.label.trim()),
        },
        features: {
          ...content.features,
          items: content.features.items.filter((i) => i.title.trim()),
        },
        openingHours: normalizeHours(content.openingHours),
        sections: SECTION_KEYS.map((key) => ({
          key,
          visible: content.sections.find((s) => s.key === key)?.visible ?? true,
        })),
      }
      const res = await updateSiteContent(payload)
      if ("error" in res && typeof res.error === "string") {
        toast.error(res.error)
        return
      }
      setDirty(false)
      toast.success("Vsebina je shranjena — stran se je osvežila")
      router.refresh()
    } catch {
      toast.error("Shranjevanje ni uspelo. Poskusite znova.")
    } finally {
      setSaving(false)
    }
  }

  // ----------------------------------------------------------
  // Loading / error states
  // ----------------------------------------------------------

  if (loading) {
    return <EditorSkeleton />
  }

  if (error || !org || !content) {
    return (
      <Card className="mx-auto w-full max-w-3xl border-destructive/40">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <WarningCircleIcon size={32} className="text-destructive" />
          <p className="font-medium">{error || "Vsebine ni bilo mogoče naložiti."}</p>
          <Button type="button" variant="outline" onClick={() => void load()}>
            Poskusi znova
          </Button>
        </CardContent>
      </Card>
    )
  }

  const hours = normalizeHours(content.openingHours)
  const paragraph0 = content.about.paragraphs[0] ?? ""
  const paragraph1 = content.about.paragraphs[1] ?? ""
  const selectedVertical = VERTICAL_OPTIONS.find((v) => v.id === vertical)

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Izgled in vsebina</h2>
          <p className="text-muted-foreground">
            Uredite vsebine, ki jih obiskovalci vidijo na vaši javni strani.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href={org.siteUrl} target="_blank" rel="noopener noreferrer">
            <EyeIcon size={16} className="mr-2" />
            Oglej si stran
          </a>
        </Button>
      </div>

      <div className="mt-6 space-y-6">
        {/* a) Tema */}
        <EditorCard
          title="Tema"
          description="Izberite barvno paleto svoje spletne strani. Sprememba se shrani takoj."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {PALETTE_OPTIONS.map((p) => {
              const active = org.palette === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void handlePalette(p.id)}
                  disabled={savingPalette !== null}
                  aria-pressed={active}
                  aria-label={`Tema ${p.label}`}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border bg-card p-3 text-center transition-all hover:border-primary/50 disabled:opacity-60",
                    active && "border-primary ring-2 ring-primary"
                  )}
                >
                  <span className="flex h-10 w-10 overflow-hidden rounded-full border border-border">
                    <span
                      className="h-full w-1/2"
                      style={{ backgroundColor: p.primary }}
                      aria-hidden
                    />
                    <span
                      className="h-full w-1/2"
                      style={{ backgroundColor: p.accent }}
                      aria-hidden
                    />
                  </span>
                  <span className="text-xs font-medium leading-tight">{p.label}</span>
                </button>
              )
            })}
          </div>
        </EditorCard>

        {/* b) Logo */}
        <EditorCard title="Logo" description="Prikaže se v glavi in nogi vaše spletne strani.">
          <ImageField
            label="Logotip salona"
            variant="square"
            value={org.logo ?? undefined}
            uploading={uploading === "logo" || savingLogo}
            emptyText="Ni logotipa"
            uploadLabel="Naloži logo"
            hint="PNG ali JPG, najbolje kvadratne oblike."
            onFile={(file) => void handleLogoUpload(file)}
            onRemove={() => void handleLogoRemove()}
          />
        </EditorCard>

        {/* c) Hero sekcija */}
        <EditorCard
          title="Hero sekcija"
          description="Prvi vtis vaše strani — značka, naslov, podnaslov in gumba."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Značka nad naslovom" htmlFor="hero-eyebrow">
              <Input
                id="hero-eyebrow"
                value={content.hero.eyebrow ?? ""}
                onChange={(e) => set("hero", { ...content.hero, eyebrow: e.target.value })}
                placeholder="Dobrodošli"
              />
            </Field>
            <Field label="Naslov" htmlFor="hero-title" hint="Obvezen podatek.">
              <Input
                id="hero-title"
                value={content.hero.title}
                onChange={(e) => set("hero", { ...content.hero, title: e.target.value })}
                placeholder="Vaša lepota, naša strast"
              />
            </Field>
          </div>
          <Field label="Podnaslov" htmlFor="hero-subtitle">
            <Textarea
              id="hero-subtitle"
              rows={3}
              value={content.hero.subtitle}
              onChange={(e) => set("hero", { ...content.hero, subtitle: e.target.value })}
            />
          </Field>
          <ImageField
            label="Slika"
            value={content.hero.imageUrl}
            uploading={uploading === "hero"}
            onFile={(file) => void handleImageUpload("hero", file)}
            onRemove={() => set("hero", { ...content.hero, imageUrl: undefined })}
            hint="Priporočena širina vsaj 1400 px."
          />
          <Field
            label="Video URL (neobvezno)"
            htmlFor="hero-video"
            hint="Povezava do .mp4 ali .webm videa — če je izpolnjena, se predvaja namesto slike."
          >
            <Input
              id="hero-video"
              type="url"
              value={content.hero.videoUrl ?? ""}
              onChange={(e) => set("hero", { ...content.hero, videoUrl: e.target.value })}
              placeholder="https://primer.com/video.mp4"
            />
          </Field>
          <Separator />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Gumb 1 — besedilo" htmlFor="hero-cta1" hint="Gumb vodi na rezervacijo (/booking).">
              <Input
                id="hero-cta1"
                value={content.hero.primaryCta.label}
                onChange={(e) =>
                  set("hero", {
                    ...content.hero,
                    primaryCta: { ...content.hero.primaryCta, label: e.target.value },
                  })
                }
              />
            </Field>
            <Field
              label="Gumb 2 — besedilo"
              htmlFor="hero-cta2"
              hint="Gumb vodi na trgovino (/shop). Prazno = skrit."
            >
              <Input
                id="hero-cta2"
                value={content.hero.secondaryCta?.label ?? ""}
                onChange={(e) =>
                  set("hero", {
                    ...content.hero,
                    secondaryCta: { label: e.target.value, href: "/shop" },
                  })
                }
              />
            </Field>
          </div>
        </EditorCard>

        {/* d) O salonu */}
        <EditorCard
          title="O salonu"
          description="Zgodba o vašem salonu, slika in ključne številke."
        >
          <Field label="Naslov" htmlFor="about-title">
            <Input
              id="about-title"
              value={content.about.title}
              onChange={(e) => set("about", { ...content.about, title: e.target.value })}
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Odstavek 1" htmlFor="about-p1">
              <Textarea
                id="about-p1"
                rows={4}
                value={paragraph0}
                onChange={(e) => updateParagraph(0, e.target.value)}
              />
            </Field>
            <Field label="Odstavek 2" htmlFor="about-p2">
              <Textarea
                id="about-p2"
                rows={4}
                value={paragraph1}
                onChange={(e) => updateParagraph(1, e.target.value)}
              />
            </Field>
          </div>
          <ImageField
            label="Slika"
            value={content.about.imageUrl}
            uploading={uploading === "about"}
            onFile={(file) => void handleImageUpload("about", file)}
            onRemove={() => set("about", { ...content.about, imageUrl: undefined })}
          />
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Statistika</Label>
              <Badge variant="secondary">{content.about.stats.length}/4</Badge>
            </div>
            {content.about.stats.map((stat, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center"
              >
                <Input
                  className="sm:w-28"
                  value={stat.value}
                  onChange={(e) => updateStat(i, { value: e.target.value })}
                  placeholder="10+"
                  aria-label={`Statistika ${i + 1} — vrednost`}
                />
                <Input
                  className="flex-1"
                  value={stat.label}
                  onChange={(e) => updateStat(i, { label: e.target.value })}
                  placeholder="Let izkušenj"
                  aria-label={`Statistika ${i + 1} — oznaka`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeStat(i)}
                  aria-label={`Odstrani statistiko ${i + 1}`}
                >
                  <TrashIcon size={16} />
                </Button>
              </div>
            ))}
            {content.about.stats.length < 4 && (
              <Button type="button" variant="outline" size="sm" onClick={addStat}>
                <PlusIcon size={16} className="mr-2" />
                Dodaj statistiko
              </Button>
            )}
          </div>
        </EditorCard>

        {/* e) Prednosti */}
        <EditorCard
          title="Prednosti"
          description="Zakaj naj stranke izberejo prav vas (do 6 prednosti)."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Naslov" htmlFor="features-title">
              <Input
                id="features-title"
                value={content.features.title}
                onChange={(e) => set("features", { ...content.features, title: e.target.value })}
              />
            </Field>
            <Field label="Podnaslov" htmlFor="features-subtitle">
              <Input
                id="features-subtitle"
                value={content.features.subtitle}
                onChange={(e) =>
                  set("features", { ...content.features, subtitle: e.target.value })
                }
              />
            </Field>
          </div>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Prednosti</Label>
              <Badge variant="secondary">{content.features.items.length}/6</Badge>
            </div>
            {content.features.items.map((item, i) => (
              <FeatureRow
                key={i}
                index={i}
                item={item}
                canRemove={content.features.items.length > 1}
                onChange={(patch) => updateFeature(i, patch)}
                onRemove={() => removeFeature(i)}
              />
            ))}
            {content.features.items.length < 6 && (
              <Button type="button" variant="outline" size="sm" onClick={addFeature}>
                <PlusIcon size={16} className="mr-2" />
                Dodaj prednost
              </Button>
            )}
          </div>
        </EditorCard>

        {/* f) Naslovi sekcij */}
        <EditorCard
          title="Naslovi sekcij"
          description="Naslovi in podnaslovi za storitve, ekipo in trgovino."
        >
          <SectionTitlePair
            label="Storitve"
            titleId="services-title"
            subtitleId="services-subtitle"
            title={content.services.title}
            subtitle={content.services.subtitle}
            onTitle={(v) => set("services", { ...content.services, title: v })}
            onSubtitle={(v) => set("services", { ...content.services, subtitle: v })}
          />
          <Separator />
          <SectionTitlePair
            label="Ekipa"
            titleId="team-title"
            subtitleId="team-subtitle"
            title={content.team.title}
            subtitle={content.team.subtitle}
            onTitle={(v) => set("team", { ...content.team, title: v })}
            onSubtitle={(v) => set("team", { ...content.team, subtitle: v })}
          />
          <Separator />
          <SectionTitlePair
            label="Trgovina"
            titleId="shop-title"
            subtitleId="shop-subtitle"
            title={content.shop.title}
            subtitle={content.shop.subtitle}
            onTitle={(v) => set("shop", { ...content.shop, title: v })}
            onSubtitle={(v) => set("shop", { ...content.shop, subtitle: v })}
          />
        </EditorCard>

        {/* g) CTA */}
        <EditorCard
          title="Poziv k akciji (CTA)"
          description="Zadnja spodbuda za rezervacijo na dnu strani."
        >
          <Field label="Naslov" htmlFor="cta-title">
            <Input
              id="cta-title"
              value={content.cta.title}
              onChange={(e) => set("cta", { ...content.cta, title: e.target.value })}
            />
          </Field>
          <Field label="Besedilo" htmlFor="cta-text">
            <Textarea
              id="cta-text"
              rows={2}
              value={content.cta.text}
              onChange={(e) => set("cta", { ...content.cta, text: e.target.value })}
            />
          </Field>
          <Field
            label="Besedilo gumba"
            htmlFor="cta-button"
            hint="Gumb vodi na rezervacijo (/booking)."
          >
            <Input
              id="cta-button"
              value={content.cta.buttonLabel}
              onChange={(e) => set("cta", { ...content.cta, buttonLabel: e.target.value })}
            />
          </Field>
        </EditorCard>

        {/* h) Delovni čas */}
        <EditorCard
          title="Delovni čas"
          description="Urnik se prikazuje na vaši spletni strani. Izključite dneve, ko ste zaprti."
        >
          <div className="space-y-2">
            {hours.map((h) => {
              const open = !!(h.open && h.close)
              return (
                <div
                  key={h.day}
                  className={cn(
                    "flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center",
                    !open && "bg-muted/40"
                  )}
                >
                  <div className="flex items-center gap-3 sm:w-48">
                    <Switch
                      checked={open}
                      onCheckedChange={(v) => toggleDayOpen(h.day, v)}
                      aria-label={
                        open
                          ? `Označi ${DAY_NAMES[h.day]} kot zaprt`
                          : `Označi ${DAY_NAMES[h.day]} kot odprt`
                      }
                    />
                    <span className="text-sm font-medium">{DAY_NAMES[h.day]}</span>
                    {!open && <Badge variant="secondary">Zaprto</Badge>}
                  </div>
                  <div className="flex flex-1 items-center gap-2 sm:justify-end">
                    <Input
                      type="time"
                      className="sm:w-32"
                      value={h.open ?? ""}
                      disabled={!open}
                      onChange={(e) => updateHour(h.day, { open: e.target.value || null })}
                      aria-label={`${DAY_NAMES[h.day]} — odpreme`}
                    />
                    <span className="text-sm text-muted-foreground" aria-hidden>
                      –
                    </span>
                    <Input
                      type="time"
                      className="sm:w-32"
                      value={h.close ?? ""}
                      disabled={!open}
                      onChange={(e) => updateHour(h.day, { close: e.target.value || null })}
                      aria-label={`${DAY_NAMES[h.day]} — zapre`}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </EditorCard>

        {/* i) Družabna omrežja */}
        <EditorCard
          title="Družabna omrežja"
          description="Povezave se prikažejo v nogi spletne strani. Prazna polja so skrita."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Instagram" htmlFor="social-instagram">
              <Input
                id="social-instagram"
                type="url"
                value={content.social.instagram ?? ""}
                onChange={(e) =>
                  set("social", { ...content.social, instagram: e.target.value || undefined })
                }
                placeholder="https://instagram.com/…"
              />
            </Field>
            <Field label="Facebook" htmlFor="social-facebook">
              <Input
                id="social-facebook"
                type="url"
                value={content.social.facebook ?? ""}
                onChange={(e) =>
                  set("social", { ...content.social, facebook: e.target.value || undefined })
                }
                placeholder="https://facebook.com/…"
              />
            </Field>
            <Field label="TikTok" htmlFor="social-tiktok">
              <Input
                id="social-tiktok"
                type="url"
                value={content.social.tiktok ?? ""}
                onChange={(e) =>
                  set("social", { ...content.social, tiktok: e.target.value || undefined })
                }
                placeholder="https://tiktok.com/@…"
              />
            </Field>
            <Field label="Spletna stran" htmlFor="social-website">
              <Input
                id="social-website"
                type="url"
                value={content.social.website ?? ""}
                onChange={(e) =>
                  set("social", { ...content.social, website: e.target.value || undefined })
                }
                placeholder="https://…"
              />
            </Field>
          </div>
        </EditorCard>

        {/* j) SEO */}
        <EditorCard
          title="SEO"
          description="Kako se vaša stran prikaže v iskalnikih in pri delitvi povezav."
        >
          <Field label="Meta naslov" htmlFor="seo-title" hint="Če je prazno, se uporabi ime salona.">
            <Input
              id="seo-title"
              value={content.seo.title ?? ""}
              onChange={(e) => set("seo", { ...content.seo, title: e.target.value || undefined })}
            />
          </Field>
          <Field
            label="Meta opis"
            htmlFor="seo-description"
            hint="Kratek opis strani (do ~160 znakov)."
          >
            <Textarea
              id="seo-description"
              rows={3}
              value={content.seo.description ?? ""}
              onChange={(e) =>
                set("seo", { ...content.seo, description: e.target.value || undefined })
              }
            />
          </Field>
        </EditorCard>

        {/* k) Sekcije */}
        <EditorCard
          title="Sekcije"
          description="Izklopite sekcije, ki jih ne želite prikazovati na javni strani."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {SECTION_KEYS.map((key) => {
              const visible = content.sections.find((s) => s.key === key)?.visible ?? true
              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <Label htmlFor={`section-${key}`} className="font-normal">
                    {SECTION_LABELS[key]}
                  </Label>
                  <Switch
                    id={`section-${key}`}
                    checked={visible}
                    onCheckedChange={(v) => toggleSection(key, v)}
                  />
                </div>
              )
            })}
          </div>
        </EditorCard>

        {/* l) Panoga (napredno) */}
        <EditorCard
          title="Panoga"
          description="Napredno — panoga vpliva na vzorčne vsebine in katalog storitev."
        >
          <details className="rounded-lg border p-4">
            <summary className="cursor-pointer select-none text-sm font-medium">
              Prikaži napredne nastavitve panoge
            </summary>
            <div className="mt-4 space-y-4">
              <Field
                label="Trenutna panoga"
                htmlFor="vertical-select"
                hint={selectedVertical?.description}
              >
                <Select value={vertical} onValueChange={setVertical}>
                  <SelectTrigger id="vertical-select">
                    <SelectValue placeholder="Izberite panogo" />
                  </SelectTrigger>
                  <SelectContent>
                    {VERTICAL_OPTIONS.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex items-start gap-3 rounded-lg border p-3">
                <Checkbox
                  id="reseed-catalog"
                  checked={reseed}
                  onCheckedChange={(checked) => setReseed(checked === true)}
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <Label htmlFor="reseed-catalog" className="font-normal">
                    Dopolni katalog z vzorčnimi storitvami te panoge
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Vzorčne storitve bodo nadomeščene s katalogom izbrane panoge. Ročno dodane
                    storitve ostanejo.
                  </p>
                </div>
              </div>
              <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                <WarningCircleIcon size={16} className="mt-0.5 shrink-0" />
                Opozorilo: zamenjava panoge lahko spremeni privzete besedile in barvno temo
                vaše strani. Te spremembe ni mogoče preklicati.
              </p>
              <Button
                type="button"
                variant="outline"
                className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => void handleVertical()}
                disabled={savingVertical}
              >
                {savingVertical && <SpinnerIcon size={16} className="mr-2 animate-spin" />}
                Zamenjaj panogo
              </Button>
            </div>
          </details>
        </EditorCard>
      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-4 z-20 mt-8">
        <div className="flex items-center justify-between gap-4 rounded-xl border bg-card/95 p-4 shadow-lg backdrop-blur">
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                dirty ? "bg-amber-500" : "bg-emerald-500"
              )}
              aria-hidden
            />
            {dirty ? "Neshranjene spremembe" : "Vse spremembe so shranjene"}
          </p>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving && <SpinnerIcon size={16} className="mr-2 animate-spin" />}
            Shrani vsebino
          </Button>
        </div>
      </div>
    </div>
  )
}
