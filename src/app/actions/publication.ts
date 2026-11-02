"use server"

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"

import { resolveEffectiveProfile } from "@/lib/profiles/resolve"
import {
  hasUnpublishedChanges,
  parsePublishState,
  validatePublishRequirements,
} from "@/lib/publication"
import { revalidatePath } from "next/cache"

export interface PublicationStatus {
  state: ReturnType<typeof parsePublishState>
  publishedAt: Date | null
  /** True when the working content differs from the published snapshot (E3-2). */
  hasUnpublishedChanges: boolean
  /** True when a published snapshot exists (false = pre-E3-2 tenant). */
  hasPublishedSnapshot: boolean
}

/** Current publication state for the Settings card. */
export async function getPublicationStatus(): Promise<PublicationStatus> {
  const { org } = await requirePermissionOrg("settings.manage")
  const config = await prisma.salonConfig.findUnique({
    where: { organizationId: org.id },
    select: { publishedContentVersion: true },
  })
  return {
    state: parsePublishState(org.publishState),
    publishedAt: org.publishedAt,
    hasUnpublishedChanges: hasUnpublishedChanges(
      org.contentVersion,
      config?.publishedContentVersion ?? null
    ),
    hasPublishedSnapshot: config?.publishedContentVersion != null,
  }
}

/**
 * Publish the tenant site. Runs the requirement gate FIRST: on failure the
 * publish state is untouched (a failed publish can never replace a working
 * site) and the caller receives actionable errors.
 *
 * A successful publish also SNAPSHOTS the current site content (E3-2): the
 * public site renders the snapshot, so draft edits stay private until the next
 * publish. Tenants without a stored snapshot keep rendering live content
 * (pre-E3-2 behavior, unchanged).
 */
export async function publishSite(): Promise<
  { success: true } | { success: false; errors: string[] }
> {
  const { org } = await requirePermissionOrg("settings.manage")

  const [config, serviceCount, productCount] = await Promise.all([
    prisma.salonConfig.findUnique({
      where: { organizationId: org.id },
      select: { email: true, phone: true, siteContent: true },
    }),
    prisma.service.count({ where: { organizationId: org.id } }),
    prisma.product.count({ where: { organizationId: org.id } }),
  ])
  const profile = resolveEffectiveProfile(org)

  const validation = validatePublishRequirements({
    orgName: org.name,
    contactEmail: config?.email ?? null,
    contactPhone: config?.phone ?? null,
    serviceCount,
    productCount,
    capabilities: {
      services: profile.capabilities.services,
      shop: profile.capabilities.shop,
    },
  })

  if (!validation.ok) return { success: false, errors: validation.errors }

  const snapshotVersion = org.contentVersion
  const snapshotContent = config?.siteContent ?? undefined
  await prisma.$transaction([
    prisma.organization.update({
      where: { id: org.id },
      data: { publishState: "PUBLISHED", publishedAt: new Date() },
    }),
    // Freeze exactly the content that is now live. Null siteContent is fine —
    // the public site falls back to the vertical defaults (as it always has).
    prisma.salonConfig.upsert({
      where: { organizationId: org.id },
      create: {
        organizationId: org.id,
        name: org.name,
        siteContent: snapshotContent,
        publishedSiteContent: snapshotContent,
        publishedContentVersion: snapshotVersion,
      },
      update: {
        publishedSiteContent: snapshotContent,
        publishedContentVersion: snapshotVersion,
      },
    }),
  ])

  revalidatePath("/", "layout")
  return { success: true }
}

/** Unpublish (take the site back to maintenance). Data is never touched. */
export async function unpublishSite(): Promise<{ success: true }> {
  const { org } = await requirePermissionOrg("settings.manage")
  await prisma.organization.update({
    where: { id: org.id },
    data: { publishState: "UNPUBLISHED" },
  })
  revalidatePath("/", "layout")
  return { success: true }
}
