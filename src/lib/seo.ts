import type { Metadata } from "next"
import type { SiteContent } from "@/lib/site-content"

/**
 * Per-tenant SEO (P1) — čiste funkcije, testabilne brez DB.
 *
 * Konteksti:
 *  - "tenant": zahteva pod /s/[slug] (x-org-slogan header) — polni OG/Twitter,
 *    canonical na /s/{slug}, indeksirano le, če je najemnik objavljen
 *  - "bare": anonimni goli javni dosežek (prva objavljena organizacija) —
 *    kot tenant, canonical usmerja na kanonični /s/{slug} URL
 *  - "private": brandanje iz prijavljene seje (dashboard) ali skriti osnutek —
 *    samo naslov/opis + noindex (dashboard ne sme biti indeksiran,
 *    kanonični URL na dashboard straneh bi bil zavajajoč)
 */

export type SeoContext = "tenant" | "bare" | "private"

export interface TenantSeoOrg {
  name: string
  slug: string
  logo: string | null
  /** Vertikala (beauty/frizer/nails/cosmetica/seamstress) — določa JSON-LD @type. */
  vertical?: string | null
}

export interface TenantSeoInput {
  org: TenantSeoOrg
  content: SiteContent
  appUrl: string
  context: SeoContext
  indexable: boolean
}

/** App URL za absolutne OG/canonical povezave (env injiciran za teste). */
export function resolveAppUrl(
  env: Record<string, string | undefined> = process.env
): string {
  const explicit = env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, "")

  const vercel = env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`

  return "http://localhost:3000"
}

/** SEO naslov najemnika: SEO vnos > ime salona. */
export function tenantTitle(content: SiteContent, orgName: string): string {
  const custom = content.seo.title?.trim()
  return custom || orgName
}

/** SEO opis najemnika: SEO vnos > hero podnasov > varno prazno. */
export function tenantDescription(
  content: SiteContent,
  orgName: string
): string {
  const custom = content.seo.description?.trim()
  if (custom) return custom
  const subtitle = content.hero.subtitle?.trim()
  return subtitle || orgName
}

/** Relativne medijske poti (/api/media/…) pretvori v absolutne URL-je. */
export function absoluteMediaUrl(
  url: string | null | undefined,
  appUrl: string
): string | null {
  const trimmed = url?.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith("/")) return `${appUrl}${trimmed}`
  return `${appUrl}/${trimmed}`
}

/**
 * OG slika najemnika: hero slika > logotip > privzeta platforma OG slika.
 * Brez slike družabni deljenje (WhatsApp/Facebook — v Sloveniji ključni
 * kanal) ne pokaže predogleda, zato imamo vedno zanesljiv zadnji pregled.
 */
export function tenantOgImageUrl(
  content: SiteContent,
  orgLogo: string | null,
  appUrl: string
): string {
  return (
    absoluteMediaUrl(content.hero.imageUrl, appUrl) ??
    absoluteMediaUrl(orgLogo, appUrl) ??
    `${appUrl}/og-default.png`
  )
}

export interface JsonLdOpeningHour {
  day: number
  open: string | null
  close: string | null
}

/**
 * JSON-LD LocalBusiness (HairSalon/BeautySalon po vertikali) — Google
 * bogati rezultati (delovni čas, povezave, opis) brez ročnega vnosa.
 * Vključuje samo podatke, ki jih lastnik dejansko je nastavil (brez izmišljenih naslovov).
 */
export function buildTenantJsonLd({
  org,
  content,
  appUrl,
  indexable,
}: {
  org: TenantSeoOrg
  content: SiteContent
  appUrl: string
  indexable: boolean
}): Record<string, unknown> | null {
  if (!indexable) return null

  const typeByVertical: Record<string, string> = {
    beauty: "BeautySalon",
    frizer: "HairSalon",
    nails: "NailSalon",
    cosmetica: "BeautySalon",
    seamstress: "ClothingStore",
  }
  const jsonLdType =
    (org.vertical && typeByVertical[org.vertical]) || "BeautySalon"

  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ]
  const hours = (content.openingHours || [])
    .filter((h) => h.open && h.close)
    .map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: days[h.day % 7],
      opens: h.open,
      closes: h.close,
    }))

  const sameAs = Object.values(content.social || {}).filter(
    (u): u is string => typeof u === "string" && /^https?:\/\//.test(u)
  )

  return {
    "@context": "https://schema.org",
    "@type": jsonLdType,
    name: org.name,
    description: tenantDescription(content, org.name),
    url: `${appUrl}/s/${org.slug}`,
    image: tenantOgImageUrl(content, org.logo, appUrl),
    ...(hours.length > 0 ? { openingHoursSpecification: hours } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
  }
}

export function buildTenantMetadata({
  org,
  content,
  appUrl,
  context,
  indexable,
}: TenantSeoInput): Metadata {
  const title = tenantTitle(content, org.name)
  const description = tenantDescription(content, org.name)

  const base: Metadata = {
    title,
    description,
    icons: { icon: org.logo || "/favicon.svg" },
    manifest: "/manifest.json",
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: false },
  }

  // Zasebni kontekst (dashboard / skriti osnutek): brez OG in kanoničnega URL.
  if (context === "private") {
    return base
  }

  const ogImage = tenantOgImageUrl(content, org.logo, appUrl)

  return {
    ...base,
    metadataBase: new URL(appUrl),
    alternates: {
      canonical: `${appUrl}/s/${org.slug}`,
    },
    openGraph: {
      title,
      description,
      url: `${appUrl}/s/${org.slug}`,
      siteName: org.name,
      type: "website",
      locale: "sl_SI",
      images: ogImage ? [{ url: ogImage, alt: org.name }] : undefined,
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  }
}
