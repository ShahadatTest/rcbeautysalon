"use server"

// ============================================================
// CUSTOM DOMAIN ACTIONS (EPIC #3 E3-6 — issue #3 §7)
// The tenant-owner surface for connecting a custom hostname:
// add → DNS instructions → verify → primary → remove.
//
// HONESTY RULE (same as the publication/payment gates): the
// VERIFIED status is written ONLY when the domain provider
// confirms it. Without a configured provider the record stays
// PENDING, every verify attempt answers SETUP_REQUIRED, and the
// UI shows the "setup required" state — never a fake success.
//
// Plan gate (§8 entitlements): the customDomains limit lives in
// the plan registry; enforcement here is server-side and counts
// the real CustomDomain rows (derived usage, no double booking).
// ============================================================

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"

import { getPlan } from "@/lib/plans/registry"
import { checkPlanLimit } from "@/lib/plans/types"
import {
  assertPrimaryEligibility,
  canUseCustomDomains,
  domainStatusTransition,
  normalizeDomainInput,
  parseDomainStatus,
} from "@/lib/domains/normalize"
import { getDomainProvider } from "@/lib/domains/provider"
import type { CustomDomainView } from "@/lib/domains/types"
import { revalidatePath } from "next/cache"

/** Fresh, org-scoped domain state for the Settings card. */
export interface DomainsStatus {
  providerConfigured: boolean
  planAllowsCustomDomains: boolean
  customDomainsLimit: number | null
  domains: CustomDomainView[]
}

export async function getDomainsStatus(): Promise<DomainsStatus> {
  const { org } = await requirePermissionOrg("settings.manage")
  const provider = getDomainProvider()
  const plan = getPlan(org.plan)
  const rows = await prisma.customDomain.findMany({
    where: { organizationId: org.id },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  })
  return {
    providerConfigured: provider.isConfigured(),
    planAllowsCustomDomains: canUseCustomDomains(plan.limits),
    customDomainsLimit: plan.limits.customDomains,
    domains: rows.map(toView),
  }
}

export type DomainActionResult =
  | { success: true; domains: CustomDomainView[] }
  | { success: false; code: "INVALID_DOMAIN" | "PLAN_LIMIT" | "DOMAIN_CONFLICT" | "SETUP_REQUIRED" | "PROVIDER_ERROR" | "NOT_FOUND" | "NOT_ELIGIBLE" | "DOMAIN_NOT_FOUND"; message: string; messageEn: string }

/**
 * Add a custom hostname for this tenant. Normalization/validation
 * is pure (normalize.ts), the plan gate is server-side, and the
 * provider (when configured) is asked FIRST — a provider refusal
 * means nothing is saved. With no provider configured the record
 * is stored as PENDING so the owner can prepare DNS, and the UI
 * honestly reports that verification needs the provider.
 */
export async function addCustomDomain(raw: string): Promise<DomainActionResult> {
  const { org } = await requirePermissionOrg("settings.manage")
  const provider = getDomainProvider()
  const plan = getPlan(org.plan)

  const normalized = normalizeDomainInput(raw)
  if (!normalized.ok) {
    return { success: false, code: "INVALID_DOMAIN", message: normalized.message, messageEn: normalized.messageEn }
  }
  const domain = normalized.domain

  // Plan gate — NEW additions only; existing rows are never removed
  // by a downgrade (downgrade tolerance, same as other resources).
  const current = await countDomains(org.id)
  const gate = checkPlanLimit(plan, "customDomains", current)
  if (!gate.ok) {
    return {
      success: false,
      code: "PLAN_LIMIT",
      message:
        plan.limits.customDomains === 0
          ? `Lastne domene niso na voljo v paketu ${plan.label}. Nadgradite paket v Nastavitvah.`
          : `Dosegli ste omejitev paketa ${plan.label}: največ ${plan.limits.customDomains} lastnih domen. Nadgradite paket ali odstranite obstoječo domeno.`,
      messageEn:
        plan.limits.customDomains === 0
          ? `Custom domains are not available on the ${plan.label} plan. Upgrade your plan in Settings.`
          : `You reached the ${plan.label} plan limit: max ${plan.limits.customDomains} custom domains. Upgrade or remove an existing domain.`,
    }
  }

  // Cross-tenant conflict (platform-wide UNIQUE in the DB too).
  const existing = await prisma.customDomain.findUnique({ where: { domain } })
  if (existing && existing.organizationId !== org.id) {
    return {
      success: false,
      code: "DOMAIN_CONFLICT",
      message: "Ta domena je že povezana z drugim podjetjem na platformi.",
      messageEn: "This domain is already connected to another business on the platform.",
    }
  }
  if (existing && existing.organizationId === org.id) {
    // Idempotent re-add: return the current state unchanged.
    return { success: true, domains: await listViews(org.id) }
  }

  let status = "PENDING"
  let dnsRecords: object | undefined
  let verifiedAt: Date | undefined
  let lastError: string | undefined

  if (provider.isConfigured()) {
    const result = await provider.addDomain(domain)
    if (!result.ok) {
      // A provider refusal (invalid/conflict/error) saves NOTHING —
      // the caller sees the reason and can retry.
      return { success: false, code: result.code, message: result.message, messageEn: result.messageEn }
    }
    if (result.verified) {
      status = "VERIFIED"
      verifiedAt = new Date()
    } else {
      dnsRecords = result.dnsRecords as object
    }
  } else {
    lastError = providerSetupMessage()
  }

  await prisma.customDomain.create({
    data: {
      organizationId: org.id,
      domain,
      status,
      dnsRecords,
      verifiedAt,
      lastError,
    },
  })

  revalidatePath("/dashboard/settings")
  return { success: true, domains: await listViews(org.id) }
}

/**
 * Re-check DNS/provider state for one domain. The status moves to
 * VERIFIED ONLY on provider confirmation; "DNS not ready yet" keeps
 * PENDING (with a fresh lastCheckedAt), and a missing provider
 * domain marks FAILED. Without a configured provider this is an
 * honest SETUP_REQUIRED — nothing is guessed.
 */
export async function verifyCustomDomain(id: string): Promise<DomainActionResult> {
  const { org } = await requirePermissionOrg("settings.manage")
  const provider = getDomainProvider()

  const row = await prisma.customDomain.findFirst({ where: { id, organizationId: org.id } })
  if (!row) {
    return { success: false, code: "NOT_FOUND", message: "Domena ni bila najdena.", messageEn: "Domain not found." }
  }
  if (!provider.isConfigured()) {
    return {
      success: false,
      code: "SETUP_REQUIRED",
      message:
        "Ponudnik domen ni konfiguriran — preverjanje ni mogoče. Operater platforme mora nastaviti DOMAINS_VERCEL_* okoljske spremenljivke.",
      messageEn:
        "The domain provider is not configured — verification is unavailable. The platform operator must set the DOMAINS_VERCEL_* environment variables.",
    }
  }

  const result = await provider.verifyDomain(row.domain)
  const checkedAt = new Date()
  if (!result.ok) {
    if (result.code === "DOMAIN_NOT_FOUND") {
      // The provider does not know this hostname — the previous
      // add either never happened at the provider or was removed.
      if (domainStatusTransition(parseDomainStatus(row.status), "FAILED").ok) {
        await prisma.customDomain.update({
          where: { id: row.id },
          data: { status: "FAILED", lastError: result.message, lastCheckedAt: checkedAt },
        })
      }
    } else {
      await prisma.customDomain.update({
        where: { id: row.id },
        data: { lastCheckedAt: checkedAt, lastError: result.message },
      })
    }
    return { success: false, code: result.code, message: result.message, messageEn: result.messageEn }
  }

  if (result.verified && domainStatusTransition(parseDomainStatus(row.status), "VERIFIED").ok) {
    await prisma.customDomain.update({
      where: { id: row.id },
      data: {
        status: "VERIFIED",
        verifiedAt: new Date(),
        lastError: null,
        lastCheckedAt: checkedAt,
        ...(result.dnsRecords ? { dnsRecords: result.dnsRecords as object } : {}),
      },
    })
  } else {
    // Provider knows the domain but DNS/verification is not done yet.
    await prisma.customDomain.update({
      where: { id: row.id },
      data: {
        lastCheckedAt: checkedAt,
        lastError: null,
        ...(result.dnsRecords ? { dnsRecords: result.dnsRecords as object } : {}),
      },
    })
  }

  revalidatePath("/dashboard/settings")
  return { success: true, domains: await listViews(org.id) }
}

/**
 * Remove a domain. Provider removal is attempted first when the
 * provider is configured; a provider failure KEEPS the local row
 * so the retry path stays available. With no provider configured
 * the local record is simply deleted (nothing exists at any
 * provider to clean up).
 */
export async function removeCustomDomain(id: string): Promise<DomainActionResult> {
  const { org } = await requirePermissionOrg("settings.manage")
  const provider = getDomainProvider()

  const row = await prisma.customDomain.findFirst({ where: { id, organizationId: org.id } })
  if (!row) {
    return { success: false, code: "NOT_FOUND", message: "Domena ni bila najdena.", messageEn: "Domain not found." }
  }

  if (provider.isConfigured()) {
    const result = await provider.removeDomain(row.domain)
    if (!result.ok) {
      return { success: false, code: result.code, message: result.message, messageEn: result.messageEn }
    }
  }

  await prisma.customDomain.delete({ where: { id: row.id } })
  revalidatePath("/dashboard/settings")
  return { success: true, domains: await listViews(org.id) }
}

/**
 * Mark one VERIFIED domain as the tenant's primary. PENDING/FAILED
 * hostnames are refused (assertPrimaryEligibility). The swap is a
 * transaction: exactly one primary domain per tenant.
 */
export async function setPrimaryDomain(id: string): Promise<DomainActionResult> {
  const { org } = await requirePermissionOrg("settings.manage")

  const row = await prisma.customDomain.findFirst({ where: { id, organizationId: org.id } })
  if (!row) {
    return { success: false, code: "NOT_FOUND", message: "Domena ni bila najdena.", messageEn: "Domain not found." }
  }
  const eligible = assertPrimaryEligibility(parseDomainStatus(row.status))
  if (!eligible.ok) {
    return { success: false, code: "NOT_ELIGIBLE", message: eligible.message, messageEn: eligible.messageEn }
  }

  await prisma.$transaction([
    prisma.customDomain.updateMany({ where: { organizationId: org.id, isPrimary: true }, data: { isPrimary: false } }),
    prisma.customDomain.update({ where: { id: row.id }, data: { isPrimary: true } }),
  ])
  revalidatePath("/dashboard/settings")
  return { success: true, domains: await listViews(org.id) }
}

// ------------------------------------------------------------
// helpers
// ------------------------------------------------------------

async function countDomains(orgId: string): Promise<number> {
  return prisma.customDomain.count({ where: { organizationId: orgId } })
}

async function listViews(orgId: string): Promise<CustomDomainView[]> {
  const rows = await prisma.customDomain.findMany({
    where: { organizationId: orgId },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  })
  return rows.map(toView)
}

function toView(row: {
  id: string
  domain: string
  status: string
  isPrimary: boolean
  dnsRecords: unknown
  lastError: string | null
  lastCheckedAt: Date | null
  verifiedAt: Date | null
}): CustomDomainView {
  return {
    id: row.id,
    domain: row.domain,
    status: parseDomainStatus(row.status),
    isPrimary: row.isPrimary,
    dnsRecords: Array.isArray(row.dnsRecords) ? (row.dnsRecords as CustomDomainView["dnsRecords"]) : null,
    lastError: row.lastError,
    lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
  }
}

function providerSetupMessage(): string {
  return "Ponudnik domen ni konfiguriran — domena čaka na preverjanje."
}
