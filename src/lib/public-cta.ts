import { getProfile, term } from "@/lib/profiles/registry"
import type { WebsiteCtaMode } from "@/lib/profiles/types"
import type { CtaLink } from "@/lib/site-content"

// ============================================================
// PUBLIC CTA RESOLVER (EPIC #1 §4/§7 — Phase 4)
// The public site's primary call-to-action is determined by the
// tenant's activity profile — NOT hardcoded to booking:
//   booking → /booking   (appointment-based businesses)
//   inquiry/quote → /inquiry (dynamic forms, e.g. seamstress)
//   order → /shop        (product businesses, e.g. beekeeping)
// Tenant-edited SiteContent CTAs remain authoritative for
// booking-mode tenants; profile terminology supplies the labels
// for the non-booking modes.
// ============================================================

export interface PublicCta {
  mode: WebsiteCtaMode
  label: string
  href: string
  /** False when the CTA target module is disabled for this profile. */
  enabled: boolean
}

/** Short navbar CTA per profile mode. */
export function resolvePublicCta(
  profileId: string | null | undefined,
  locale: "sl" | "en" = "sl"
): PublicCta {
  const profile = getProfile(profileId)
  const mode = profile.website.ctaMode

  switch (mode) {
    case "booking":
      return { mode, label: locale === "en" ? "Book now" : "Rezerviraj", href: "/booking", enabled: true }
    case "order":
      return {
        mode,
        label: term(profile, "bookingCta", locale),
        href: "/shop",
        enabled: profile.capabilities.shop !== "disabled",
      }
    case "inquiry":
    case "quote":
    default:
      return { mode, label: term(profile, "bookingCta", locale), href: "/inquiry", enabled: true }
  }
}

/**
 * Hero (and CTA section) links: booking tenants keep their
 * editable SiteContent CTAs; everyone else is driven by the
 * profile so a seamstress never sees "Rezerviraj termin".
 */
export function resolveCtaLinks(
  profileId: string | null | undefined,
  content: { hero: { primaryCta: CtaLink; secondaryCta?: CtaLink | null } }
): { primaryCta: CtaLink; secondaryCta: CtaLink | null } {
  const profile = getProfile(profileId)
  const mode = profile.website.ctaMode

  if (mode === "booking") {
    return {
      primaryCta: content.hero.primaryCta,
      secondaryCta: content.hero.secondaryCta ?? null,
    }
  }

  const href = mode === "order" ? "/shop" : "/inquiry"
  const enabled = mode !== "order" || profile.capabilities.shop !== "disabled"
  const primary: CtaLink = enabled
    ? { label: term(profile, "bookingCta", "sl"), href }
    : { label: term(profile, "bookingCta", "sl"), href: "/contact" }

  return {
    primaryCta: primary,
    // Keep the tenant's secondary CTA (e.g. shop) unless it duplicates the primary.
    secondaryCta:
      content.hero.secondaryCta && content.hero.secondaryCta.href !== primary.href
        ? content.hero.secondaryCta
        : null,
  }
}

/** Whether the booking flow makes sense for this tenant at all. */
export function isBookingEnabled(profileId: string | null | undefined): boolean {
  return getProfile(profileId).website.ctaMode === "booking"
}
