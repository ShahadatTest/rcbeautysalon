"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requireAdminOrg } from "@/lib/tenant"
import { UnauthorizedError } from "@/lib/auth/guards"
import { mergeSiteContent, type SiteContent } from "@/lib/site-content"
import { PALETTES } from "@/lib/verticals"

/** Full branding + content payload for the "Izgled in vsebina" editor. */
export async function getOrgBranding() {
  try {
    const { org } = await requireAdminOrg()
    const config = await prisma.salonConfig.findUnique({
      where: { organizationId: org.id },
    })
    return {
      success: true,
      org: {
        id: org.id,
        slug: org.slug,
        name: org.name,
        logo: org.logo,
        vertical: org.vertical,
        palette: org.palette,
        siteUrl: `/s/${org.slug}`,
      },
      siteContent: mergeSiteContent(config?.siteContent, org.vertical),
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error loading org branding:", error)
    return { success: false, error: "Failed to load branding." }
  }
}

/** Saves the whole site content JSON (hero, about, features, CTA, hours, social, SEO, sections). */
export async function updateSiteContent(content: SiteContent) {
  try {
    const { org } = await requireAdminOrg()

    // Minimal server-side sanitization: plain strings only, bounded lengths.
    const clean = JSON.parse(JSON.stringify(content)) as SiteContent
    if (!clean.hero?.title || typeof clean.hero.title !== "string") {
      return { success: false, error: "Hero naslov je obvezen." }
    }

    await prisma.salonConfig.upsert({
      where: { organizationId: org.id },
      create: {
        organizationId: org.id,
        name: org.name,
        siteContent: clean as unknown as object,
      },
      update: { siteContent: clean as unknown as object },
    })

    revalidatePath("/", "layout")
    return { success: true }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error updating site content:", error)
    return { success: false, error: "Failed to update site content." }
  }
}

/** Palette switch (rose, amber, charcoal, ...). */
export async function updateOrgPalette(palette: string) {
  try {
    const { org } = await requireAdminOrg()
    if (!PALETTES[palette]) {
      return { success: false, error: "Neznana paleta." }
    }
    await prisma.organization.update({
      where: { id: org.id },
      data: { palette },
    })
    revalidatePath("/", "layout")
    return { success: true }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error updating palette:", error)
    return { success: false, error: "Failed to update palette." }
  }
}

/** Logo update (URL from /api/upload). */
export async function updateOrgLogo(logo: string | null) {
  try {
    const { org } = await requireAdminOrg()
    await prisma.organization.update({
      where: { id: org.id },
      data: { logo },
    })
    revalidatePath("/", "layout")
    return { success: true }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error updating logo:", error)
    return { success: false, error: "Failed to update logo." }
  }
}

/** Vertical switch — optionally re-seeds the default catalog for the new vertical. */
export async function updateOrgVertical(vertical: string, reseedCatalog: boolean) {
  try {
    const { org } = await requireAdminOrg()
    const { getVertical, seedOrganizationCatalog } = await import("@/lib/verticals")
    const preset = getVertical(vertical)
    if (!preset) return { success: false, error: "Neznana panoga." }

    await prisma.organization.update({
      where: { id: org.id },
      data: { vertical: preset.id, palette: org.palette || preset.palette },
    })
    if (reseedCatalog) {
      await seedOrganizationCatalog(org.id, preset.id)
    }
    revalidatePath("/", "layout")
    return { success: true }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error updating vertical:", error)
    return { success: false, error: "Failed to update vertical." }
  }
}
