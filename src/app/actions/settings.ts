"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { SalonSettingsInput } from "@/lib/interfaces"
import { UnauthorizedError } from "@/lib/auth/guards"
import { requireAdminOrg } from "@/lib/tenant"
import type { Organization } from "@prisma/client"

/**
 * Get salon settings for the current admin's organization.
 * Creates the config row on first access.
 *
 * SECURITY (E4-6b): admin-only. Previously this fell back to the public
 * org for anonymous callers and CREATED a SalonConfig row — an
 * unauthenticated write path. The only caller is the guarded settings
 * page, so the action itself now enforces the admin gate (null instead
 * of data for any non-admin caller).
 */
export async function getSalonSettings() {
  let org: Organization | null = null
  try {
    org = (await requireAdminOrg()).org
  } catch {
    return null
  }

  if (!org) return null

  let settings = await prisma.salonConfig.findUnique({
    where: { organizationId: org.id },
  })

  if (!settings) {
    settings = await prisma.salonConfig.create({
      data: { organizationId: org.id, name: org.name },
    })
  }

  return {
    ...settings,
    bookingDeposit: settings.bookingDeposit.toNumber(),
  }
}

// Update salon settings (admin only, scoped to own organization)
export async function updateSalonSettings(data: SalonSettingsInput) {
  try {
    const { org } = await requireAdminOrg()

    const settings = await prisma.salonConfig.upsert({
      where: { organizationId: org.id },
      update: { ...data },
      create: {
        organizationId: org.id,
        name: data.name || org.name,
        ...data,
      },
    })

    revalidatePath("/dashboard/settings")
    revalidatePath("/", "layout")

    return {
      success: true,
      settings: {
        ...settings,
        bookingDeposit: settings.bookingDeposit.toNumber(),
      },
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error updating settings:", error)
    return { success: false, error: "Failed to update settings." }
  }
}

// Reset settings to defaults (keeps site content & theme)
export async function resetSalonSettings() {
  try {
    const { org } = await requireAdminOrg()

    await prisma.salonConfig.deleteMany({ where: { organizationId: org.id } })

    const settings = await prisma.salonConfig.create({
      data: { organizationId: org.id, name: org.name },
    })

    revalidatePath("/dashboard/settings")
    revalidatePath("/", "layout")

    return {
      success: true,
      settings: {
        ...settings,
        bookingDeposit: settings.bookingDeposit.toNumber(),
      },
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error resetting settings:", error)
    return { success: false, error: "Failed to reset settings." }
  }
}
