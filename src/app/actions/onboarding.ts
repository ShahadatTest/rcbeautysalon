"use server"

import { Prisma } from "@prisma/client"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { isReservedSlug, isSlugAvailable, slugify } from "@/lib/tenant"
import { PALETTES, seedOrganizationCatalog, verticalSiteContent, getVertical, presetStaffImage } from "@/lib/verticals"
import { listProfileOptions } from "@/lib/profiles/registry"
import { validateSecondaryVertical } from "@/lib/profiles/secondary"
import { materializeProfileAssets } from "@/lib/profiles/materialize"
import { PALETTE_OPTIONS } from "@/lib/palettes-client"

export interface CreateSalonInput {
  name: string
  slug: string
  vertical: string
  /** Optional secondary activity (E2-4): capability union, primary keeps terminology. */
  secondaryVertical: string | null
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
 * Creates a complete business tenant in one logical flow:
 * Organization -> User (ADMIN) + Staff + WorkingHours -> catalog seed ->
 * profile asset materialization (forms + workflows) -> staff services ->
 * SalonConfig (site content, locale, booking policy).
 */
export async function createSalonOrganization(input: CreateSalonInput): Promise<CreateSalonResult> {
  try {
    // --- Validation (friendly Slovenian messages) ---
    const name = (input.name ?? "").trim()
    if (name.length < 2) {
      return { success: false, error: "Ime podjetja mora imeti vsaj 2 znaka." }
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

    // Validate the activity profile against the single-source registry
    // (EPIC #1) — the profile determines modules, terminology, forms and
    // workflows, not just appearance.
    const profile = listProfileOptions().find((p) => p.id === input.vertical)
    if (!profile) {
      return { success: false, error: "Izberite veljavno dejavnost." }
    }

    // Secondary activity (E2-4): same pure rules as the settings action —
    // unknown ids and same-as-primary are rejected before any write.
    const secondaryCode = validateSecondaryVertical(input.vertical, input.secondaryVertical)
    if (secondaryCode === "UNKNOWN_PROFILE") {
      return { success: false, error: "Izberite veljavno dodatno dejavnost." }
    }
    if (secondaryCode === "SAME_PROFILE") {
      return {
        success: false,
        error: "Dodatna dejavnost mora biti različna od primarne dejavnosti.",
      }
    }
    const secondaryVertical = input.secondaryVertical || null

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
    // New tenants start UNPUBLISHED (EPIC #3 E3-1): the site is a private
    // owner preview until they publish it from Settings.
    const org = await prisma.organization.create({
      data: {
        slug,
        name,
        vertical: profile.id,
        secondaryVertical,
        palette,
        publishState: "DRAFT",
      },
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
              // Preset portrait for the activity (test/demo realism, EPIC #4
              // visual pass). undefined -> Prisma leaves image null and the
              // public staff card renders the initials fallback.
              ...(presetStaffImage(profile.id)
                ? { image: presetStaffImage(profile.id) }
                : {}),
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

      // Sample categories + services + products for the chosen activity.
      // NOTE (E2-4): catalog seeds, forms/workflows materialization and the
      // site content snapshot remain PRIMARY-only — the secondary activity
      // contributes capability modules (the union), never duplicated
      // terminology or definitions. The owner can add catalog items of the
      // second activity manually in the shared modules.
      await seedOrganizationCatalog(org.id, profile.id)

      // Materialize profile-owned definitions (forms + workflows) so the
      // owner can customize them per-tenant without code (EPIC #1 §4).
      await materializeProfileAssets(org.id, profile.id)

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

      // Salon configuration with profile-driven defaults (locale, currency,
      // timezone come from the activity preset — no more hardcoded values).
      const preset = getVertical(profile.id)
      await prisma.salonConfig.create({
        data: {
          organizationId: org.id,
          name,
          email,
          country: "SI",
          currency: preset.currency || "EUR",
          locale: preset.locale || "sl",
          timezone: preset.timezone || "Europe/Ljubljana",
          bookingDeposit: 10,
          cancellationPolicy: "Odpoved možna najkasneje 24 ur pred terminom.",
          siteContent: verticalSiteContent(profile.id) as unknown as object,
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
    console.error("Business onboarding error:", error)
    return {
      success: false,
      error: "Pri ustvarjanju podjetja je prišlo do napake. Poskusite znova.",
    }
  }
}
