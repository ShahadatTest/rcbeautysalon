"use server"

import { Prisma } from "@prisma/client"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { isReservedSlug, isSlugAvailable, slugify } from "@/lib/tenant"
import { PALETTES, VERTICALS, seedOrganizationCatalog, verticalSiteContent } from "@/lib/verticals"
import { PALETTE_OPTIONS } from "@/lib/palettes-client"

export interface CreateSalonInput {
  name: string
  slug: string
  vertical: string
  palette: string
  ownerName: string
  email: string
  password: string
}

export interface CreateSalonResult {
  success: boolean
  slug?: string
  salonName?: string
  error?: string
}

/** Public availability check used by the onboarding wizard (debounced, client-side). */
export async function checkSlugAvailability(slug: string): Promise<{ available: boolean }> {
  const normalized = slugify(slug ?? "")
  if (!normalized) return { available: false }
  return { available: await isSlugAvailable(normalized) }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Creates a complete salon tenant in one logical flow:
 * Organization -> User (ADMIN) + Staff + WorkingHours -> catalog seed ->
 * staff services -> SalonConfig (site content, locale, booking policy).
 */
export async function createSalonOrganization(input: CreateSalonInput): Promise<CreateSalonResult> {
  try {
    // --- Validation (friendly Slovenian messages) ---
    const name = (input.name ?? "").trim()
    if (name.length < 2) {
      return { success: false, error: "Ime salona mora imeti vsaj 2 znaka." }
    }

    const slug = slugify(input.slug ?? "")
    if (!slug || slug.length < 2) {
      return { success: false, error: "Vnesite veljaven URL naslov (vsaj 2 znaka)." }
    }
    if (isReservedSlug(slug)) {
      return { success: false, error: "Ta URL naslov je rezerviran. Izberite drugega." }
    }
    if (!(await isSlugAvailable(slug))) {
      return { success: false, error: "Ta URL naslov je že zaseden. Izberite drugega." }
    }

    const vertical = VERTICALS.find((v) => v.id === input.vertical)?.id
    if (!vertical) {
      return { success: false, error: "Izberite veljavno panogo." }
    }

    const palette = PALETTES[input.palette] ? input.palette : undefined
    if (!palette) {
      return { success: false, error: "Izberite veljavno barvno paleto." }
    }

    const ownerName = (input.ownerName ?? "").trim()
    if (ownerName.length < 2) {
      return { success: false, error: "Vnesite ime in priimek lastnika." }
    }

    const email = (input.email ?? "").trim().toLowerCase()
    if (!EMAIL_REGEX.test(email)) {
      return { success: false, error: "Vnesite veljaven e-poštni naslov." }
    }

    const password = input.password ?? ""
    if (password.length < 8) {
      return { success: false, error: "Geslo mora imeti vsaj 8 znakov." }
    }

    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (existingUser) {
      return { success: false, error: "Ta e-pošta je že registrirana." }
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const paletteOption = PALETTE_OPTIONS.find((p) => p.id === palette)

    // --- Tenant creation ---
    const org = await prisma.organization.create({
      data: { slug, name, vertical, palette },
    })

    let userId: string | null = null
    try {
      // Owner user with nested Staff profile + default working hours
      const user = await prisma.user.create({
        data: {
          name: ownerName,
          email,
          password: passwordHash,
          role: "ADMIN",
          emailVerified: new Date(),
          organizationId: org.id,
          staff: {
            create: {
              name: ownerName,
              email,
              isActive: true,
              organizationId: org.id,
              workingHours: {
                create: [
                  { dayOfWeek: 1, startTime: "09:00", endTime: "18:00", isActive: true },
                  { dayOfWeek: 2, startTime: "09:00", endTime: "18:00", isActive: true },
                  { dayOfWeek: 3, startTime: "09:00", endTime: "18:00", isActive: true },
                  { dayOfWeek: 4, startTime: "09:00", endTime: "18:00", isActive: true },
                  { dayOfWeek: 5, startTime: "09:00", endTime: "18:00", isActive: true },
                  { dayOfWeek: 6, startTime: "09:00", endTime: "13:00", isActive: true },
                ],
              },
            },
          },
        },
        include: { staff: { select: { id: true } } },
      })
      userId = user.id
      const staffId = user.staff?.id

      // Sample categories + services for the chosen vertical
      await seedOrganizationCatalog(org.id, vertical)

      // Assign every created service to the owner's staff profile
      const services = await prisma.service.findMany({
        where: { organizationId: org.id },
        select: { id: true },
      })
      if (staffId && services.length > 0) {
        await prisma.staffService.createMany({
          data: services.map((s) => ({ staffId, serviceId: s.id })),
          skipDuplicates: true,
        })
      }

      // Salon configuration with vertical site content (site goes live instantly)
      await prisma.salonConfig.create({
        data: {
          organizationId: org.id,
          name,
          email,
          country: "SI",
          currency: "EUR",
          locale: "sl",
          timezone: "Europe/Ljubljana",
          bookingDeposit: 10,
          cancellationPolicy: "Odpoved možna najkasneje 24 ur pred terminom.",
          siteContent: verticalSiteContent(vertical) as unknown as object,
          primaryColor: paletteOption?.primary ?? "#000000",
          secondaryColor: "#ffffff",
          accentColor: paletteOption?.accent ?? "#d4af37",
        },
      })
    } catch (innerError) {
      // Best-effort cleanup so a failed signup never leaves a half-created tenant
      if (userId) {
        await prisma.user.delete({ where: { id: userId } }).catch(() => undefined)
      }
      await prisma.organization.delete({ where: { id: org.id } }).catch(() => undefined)
      throw innerError
    }

    return { success: true, slug, salonName: name }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = Array.isArray(error.meta?.target)
        ? (error.meta?.target as string[]).join(",")
        : String(error.meta?.target ?? "")
      if (target.includes("email")) {
        return { success: false, error: "Ta e-pošta je že registrirana." }
      }
      if (target.includes("slug")) {
        return { success: false, error: "Ta URL naslov je že zaseden. Izberite drugega." }
      }
      return { success: false, error: "Ti podatki so že v uporabi. Preverite vnesene podatke." }
    }
    console.error("Salon onboarding error:", error)
    return {
      success: false,
      error: "Pri ustvarjanju salona je prišlo do napake. Poskusite znova.",
    }
  }
}
