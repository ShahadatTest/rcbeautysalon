"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

import { UnauthorizedError, requirePermissionOrg } from "@/lib/auth/guards"
import { mergeSiteContent, type SiteContent } from "@/lib/site-content"
import { computeRevert, hasUnpublishedChanges, parsePublishState } from "@/lib/publication"
import type { PublicationStatus } from "@/app/actions/publication"
import { PALETTES } from "@/lib/verticals"

/** Full branding + content payload for the "Izgled in vsebina" editor. */
export async function getOrgBranding() {
  try {
    const { org } = await requirePermissionOrg("settings.manage")
    const config = await prisma.salonConfig.findUnique({
      where: { organizationId: org.id },
      select: {
        siteContent: true,
        publishedContentVersion: true,
      },
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
      publication: {
        state: parsePublishState(org.publishState),
        publishedAt: org.publishedAt,
        hasUnpublishedChanges: hasUnpublishedChanges(
          org.contentVersion,
          config?.publishedContentVersion ?? null
        ),
        hasPublishedSnapshot: config?.publishedContentVersion != null,
      } satisfies PublicationStatus,
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error loading org branding:", error)
    return { success: false, error: "Failed to load branding." }
  }
}

/**
 * Saves the whole site content JSON (hero, about, features, CTA, hours,
 * social, SEO, sections). Every save creates a NEW content version (E3-2) —
 * the working draft — while the published snapshot stays untouched, so the
 * public site only changes when the owner publishes.
 */
export async function updateSiteContent(content: SiteContent) {
  try {
    const { org } = await requirePermissionOrg("settings.manage")

    // Minimal server-side sanitization: plain strings only, bounded lengths.
    const clean = JSON.parse(JSON.stringify(content)) as SiteContent
    if (!clean.hero?.title || typeof clean.hero.title !== "string") {
      return { success: false, error: "Hero naslov je obvezen." }
    }

    await prisma.$transaction([
      prisma.salonConfig.upsert({
        where: { organizationId: org.id },
        create: {
          organizationId: org.id,
          name: org.name,
          siteContent: clean as unknown as object,
        },
        update: { siteContent: clean as unknown as object },
      }),
      prisma.organization.update({
        where: { id: org.id },
        data: { contentVersion: { increment: 1 } },
      }),
    ])

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

/**
 * Discard draft edits: restore the working content to the last published
 * snapshot (E3-2). The working version re-aligns with the published version,
 * so drift detection does not report phantom "unpublished changes" for
 * content that is byte-identical to the published JSON.
 * Refuses (with a clear error) when the tenant has no published snapshot:
 * there, the working content IS the live content and nothing can be reverted.
 */
export async function revertSiteContentToPublished(): Promise<
  { success: true } | { success: false; error: string }
> {
  try {
    const { org } = await requirePermissionOrg("settings.manage")
    const config = await prisma.salonConfig.findUnique({
      where: { organizationId: org.id },
      select: { publishedSiteContent: true, publishedContentVersion: true },
    })

    const revert = computeRevert({
      contentVersion: org.contentVersion,
      publishedSiteContent: config?.publishedSiteContent ?? null,
      publishedContentVersion: config?.publishedContentVersion ?? null,
    })
    if (!revert.ok) {
      return {
        success: false,
        error: "Ni shranjene objavljene verzije — trenutna vsebina je že objavljena.",
      }
    }

    await prisma.$transaction([
      prisma.salonConfig.update({
        where: { organizationId: org.id },
        data: { siteContent: revert.siteContent as object },
      }),
      prisma.organization.update({
        where: { id: org.id },
        data: { contentVersion: revert.contentVersion },
      }),
    ])

    revalidatePath("/", "layout")
    return { success: true }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error reverting site content:", error)
    return { success: false, error: "Failed to revert site content." }
  }
}

/** Palette switch (rose, amber, charcoal, ...). */
export async function updateOrgPalette(palette: string) {
  try {
    const { org } = await requirePermissionOrg("settings.manage")
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
    const { org } = await requirePermissionOrg("settings.manage")
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
    const { org } = await requirePermissionOrg("settings.manage")
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
