"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { SalonSettingsInput } from "@/lib/interfaces"
import { UnauthorizedError } from "@/lib/auth/guards"
import { requireAdminOrg, getPublicOrg, getSessionOrg } from "@/lib/tenant"

/**
 * Get salon settings for the current context:
 * dashboard (admin) -> session org; public pages -> tenant/default org.
 * Creates the config row on first access.
 */
export async function getSalonSettings() {
  let org = await getSessionOrg()
  if (!org) org = await getPublicOrg()

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
