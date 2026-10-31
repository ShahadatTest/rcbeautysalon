import "server-only"
import { cache } from "react"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth/auth"
import { requireAdmin, UnauthorizedError } from "@/lib/auth/guards"
import type { Organization } from "@prisma/client"
import { DEFAULT_SALON_TIMEZONE, safeTimezone } from "@/lib/booking-time"

export const ORG_HEADER = "x-org-slug"

export const getOrgBySlug = cache(async (slug: string) => {
  return prisma.organization.findUnique({ where: { slug } })
})

export const getOrgById = cache(async (id: string) => {
  return prisma.organization.findUnique({ where: { id } })
})

/**
 * The organization that serves the CURRENT public page:
 * either the tenant from /s/[slug] (x-org-slug header set by proxy)
 * or the default (first) organization for bare routes.
 */
export const getPublicOrg = cache(async (): Promise<Organization | null> => {
  const h = await headers()
  const slug = h.get(ORG_HEADER)
  if (slug) {
    const org = await getOrgBySlug(slug)
    if (org) {
      if (org.status === "ACTIVE") return org
      // SUSPENDED tenant (EPIC #3 E3-5): its site is OFF — return null so
      // the (public) layout renders the maintenance screen. NEVER fall
      // back to another tenant's content under this URL.
      return null
    }
    // Unknown slug → bare-domain default below.
  }
  // Platform-root fallback: only a PUBLISHED tenant may serve the bare domain
  // (a DRAFT tenant's site is private — EPIC #3 E3-1).
  return prisma.organization.findFirst({
    where: { status: "ACTIVE", publishState: "PUBLISHED" },
    orderBy: { createdAt: "asc" },
  })
})

/** Organization of the signed-in admin/staff user (falls back to default org). */
export const getSessionOrg = cache(async (): Promise<Organization | null> => {
  const session = await auth()
  const orgId = session?.user?.organizationId
  if (orgId) {
    const org = await getOrgById(orgId)
    if (org) return org
  }
  // Legacy admin (no organizationId) manages the default organization
  if (session?.user?.role === "ADMIN") {
    return prisma.organization.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    })
  }
  return null
})

/**
 * Guard + org for admin server actions. Throws UnauthorizedError when not admin.
 * Returns the organization the admin manages.
 */
export async function requireAdminOrg(): Promise<{
  session: { user: { id: string; role: string; email?: string | null; name?: string | null } }
  org: Organization
}> {
  const session = await requireAdmin()
  const orgId = session.user.organizationId
  const org = orgId
    ? await getOrgById(orgId)
    : await prisma.organization.findFirst({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
      })
  if (!org) throw new UnauthorizedError("No organization found for this account")
  return { session: session as unknown as { user: { id: string; role: string; email?: string | null; name?: string | null } }, org }
}

/** Public org for server actions (booking/checkout from a tenant site). */
export async function requirePublicOrg(): Promise<Organization> {
  const org = await getPublicOrg()
  if (!org) throw new Error("No organization available")
  return org
}

/**
 * Org resolution for functions used by BOTH the public site and the dashboard:
 * 1. tenant site (/s/[slug]) — the header tenant ALWAYS wins (prevents a
 *    signed-in admin of another salon from leaking their org into a tenant page)
 * 2. admin/staff session — their own organization (dashboard context)
 * 3. default (first ACTIVE) organization (bare public routes)
 */
export async function getResolvedOrg(): Promise<Organization | null> {
  const h = await headers()
  const slug = h.get(ORG_HEADER)
  if (slug) {
    const org = await getOrgBySlug(slug)
    if (org) {
      if (org.status === "ACTIVE") return org
      // SUSPENDED tenant (EPIC #3 E3-5): no org context — never leak
      // another tenant's data under this tenant's URL.
      return null
    }
  }
  const session = await auth()
  if (
    session?.user &&
    (session.user.role === "ADMIN" || session.user.role === "STAFF")
  ) {
    const sessionOrg = await getSessionOrg()
    if (sessionOrg) return sessionOrg
  }
  return prisma.organization.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  })
}

// --- Reserved slugs that collide with real routes ---
const RESERVED = new Set([
  "api", "dashboard", "staff-portal", "my-account", "login", "register",
  "start", "booking", "shop", "services", "staff", "cart", "checkout",
  "my-orders", "my-reviews", "forgot-password", "reset-password",
  "verify-email", "account", "about", "contact", "s", "admin", "preview",
  "sitemap.xml", "robots.txt", "favicon.ico", "manifest.json", "_next", "static", "images",
])

export function isReservedSlug(slug: string): boolean {
  return RESERVED.has(slug.toLowerCase())
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics (č->c, š->s, ž->z)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
}

export async function isSlugAvailable(slug: string): Promise<boolean> {
  if (!slug || isReservedSlug(slug)) return false
  const existing = await prisma.organization.findUnique({ where: { slug } })
  return !existing
}

/** Salon timezone of the signed-in admin/staff session (for correct time display). */
export const getSessionSalonTimezone = cache(async (): Promise<string> => {
  const org = await getSessionOrg()
  if (!org) return DEFAULT_SALON_TIMEZONE
  const config = await prisma.salonConfig.findUnique({
    where: { organizationId: org.id },
    select: { timezone: true },
  })
  return safeTimezone(config?.timezone)
})
