"use server"

import { prisma } from "@/lib/prisma"
import { requireAdminOrg } from "@/lib/tenant"
import { resolveEffectiveProfile } from "@/lib/profiles/resolve"
import {
  parsePublishState,
  validatePublishRequirements,
} from "@/lib/publication"
import { revalidatePath } from "next/cache"

export interface PublicationStatus {
  state: ReturnType<typeof parsePublishState>
  publishedAt: Date | null
}

/** Current publication state for the Settings card. */
export async function getPublicationStatus(): Promise<PublicationStatus> {
  const { org } = await requireAdminOrg()
  return {
    state: parsePublishState(org.publishState),
    publishedAt: org.publishedAt,
  }
}

/**
 * Publish the tenant site. Runs the requirement gate FIRST: on failure the
 * publish state is untouched (a failed publish can never replace a working
 * site) and the caller receives actionable errors.
 */
export async function publishSite(): Promise<
  { success: true } | { success: false; errors: string[] }
> {
  const { org } = await requireAdminOrg()

  const [config, serviceCount, productCount] = await Promise.all([
    prisma.salonConfig.findUnique({
      where: { organizationId: org.id },
      select: { email: true, phone: true },
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

  await prisma.organization.update({
    where: { id: org.id },
    data: { publishState: "PUBLISHED", publishedAt: new Date() },
  })

  revalidatePath("/", "layout")
  return { success: true }
}

/** Unpublish (take the site back to maintenance). Data is never touched. */
export async function unpublishSite(): Promise<{ success: true }> {
  const { org } = await requireAdminOrg()
  await prisma.organization.update({
    where: { id: org.id },
    data: { publishState: "UNPUBLISHED" },
  })
  revalidatePath("/", "layout")
  return { success: true }
}
