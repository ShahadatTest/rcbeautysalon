// ============================================================
// PLAN TYPES (EPIC #3 E3-3 — commercial layer, no payments yet)
// Plans are a CODE registry (like activity profiles): versioned
// with git, type-safe, zod-validated at module load. No DB
// model in the first step (docs/EPIC-3/PLAN.md decision log).
//
// Client-safe: NO server-only imports.
// ============================================================

/** Known plan ids. Organization.plan stores exactly one of these strings. */
export const PLAN_IDS = ["free", "pro", "scale"] as const
export type PlanId = (typeof PLAN_IDS)[number]

/**
 * Resources a plan can limit. `null` limit = unlimited.
 * storageMb (E3-7): derived from the Media table (org-scoped bytes)
 * and enforced on the DB-backed upload route — see checkStorageLimit.
 * orders (E3-7): MONTHLY derived counter (Order rows created since
 * monthStartUtc — no double bookkeeping), enforced where orders are
 * created. customDomains = connected hostnames per tenant (E3-6);
 * the count is derived from the CustomDomain table, enforcement
 * happens in the domains action.
 */
export type LimitResource =
  | "services"
  | "products"
  | "staff"
  | "storageMb"
  | "customDomains"
  | "orders"

export type PlanLimits = Record<LimitResource, number | null>

/** Marketing/upgrade bullets, localized (registry is client-safe). */
export interface LocalizedText {
  sl: string
  en: string
}

export interface PlanDefinition {
  id: PlanId
  version: number
  /** Uppercase display label, e.g. "FREE". */
  label: string
  description: LocalizedText
  limits: PlanLimits
  features: LocalizedText[]
}

// ------------------------------------------------------------
// Pure limit checking (shared by server actions and tests)
// ------------------------------------------------------------

export interface LimitCheckOk {
  ok: true
}

export interface LimitCheckBlocked {
  ok: false
  code: "LIMIT_REACHED"
  resource: LimitResource
  planId: PlanId
  /** The concrete limit that was hit (never null when blocked). */
  limit: number
  /** Current usage that hit the limit (>= limit; downgrade tolerance). */
  current: number
  /** Slovenian, action-oriented message (names plan, limit, fix path). */
  message: string
  /** English message for en-locale admins. */
  messageEn: string
}

export type LimitCheck = LimitCheckOk | LimitCheckBlocked

/** Resource nouns used inside limit messages (genitive plural for sl).
 * storageMb is excluded: storage has its own byte-based gate
 * (checkStorageLimit) with storage-specific wording. */
export const RESOURCE_NOUNS: Record<
  Exclude<LimitResource, "storageMb">,
  { sl: string; en: string }
> = {
  services: { sl: "storitev", en: "services" },
  products: { sl: "izdelkov", en: "products" },
  staff: { sl: "zaposlenih", en: "team members" },
  customDomains: { sl: "lastnih domen", en: "custom domains" },
  orders: { sl: "naročil ta mesec", en: "orders this month" },
}

// ------------------------------------------------------------
// Storage + monthly counters (E3-7 pure helpers)
// ------------------------------------------------------------

export const BYTES_PER_MB = 1024 * 1024

/** Ceil to whole MB — a partial MB still consumes a full MB of quota. */
export function bytesToMb(bytes: number): number {
  return Math.ceil(bytes / BYTES_PER_MB)
}

/**
 * First day of the current month, UTC (00:00:00.000). The monthly
 * orders counter counts Order rows created at/after this instant.
 * UTC keeps the metric deterministic across server timezones.
 */
export function monthStartUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

export interface StorageCheckOk {
  ok: true
}

export interface StorageCheckBlocked {
  ok: false
  code: "STORAGE_LIMIT_REACHED"
  planId: PlanId
  /** Plan storage limit in MB (never null when blocked). */
  limitMb: number
  /** Would-be usage in MB (existing bytes + incoming file, ceiled). */
  wouldBeMb: number
  /** Slovenian, action-oriented message (names plan and fix path). */
  message: string
  /** English message for en-locale admins. */
  messageEn: string
}

export type StorageCheck = StorageCheckOk | StorageCheckBlocked

/**
 * Pure storage gate for NEW uploads (E3-7). Blocks only when the
 * would-be usage (existing + incoming file) exceeds the plan's
 * storageMb limit — existing media is NEVER removed (downgrade
 * tolerance: over-quota tenants keep their files, uploads stop).
 * `null` limit = unlimited. Enforced server-side on the DB-backed
 * upload route; Cloudinary storage is metered by the external
 * provider and out of this gate's scope (PLAN.md decision log).
 */
export function checkStorageLimit(
  plan: PlanDefinition,
  wouldBeBytes: number
): StorageCheck {
  const limitMb = plan.limits.storageMb
  if (limitMb === null) return { ok: true }
  const wouldBeMb = bytesToMb(wouldBeBytes)
  if (wouldBeMb <= limitMb) return { ok: true }
  return {
    ok: false,
    code: "STORAGE_LIMIT_REACHED",
    planId: plan.id,
    limitMb,
    wouldBeMb,
    message:
      `Dosegli ste omejitev paketa ${plan.label}: največ ${limitMb} MB shrambe. ` +
      `Izbrišite nepotrebne slike ali nadgradite paket v Nastavitvah.`,
    messageEn:
      `You reached the ${plan.label} plan storage limit: max ${limitMb} MB. ` +
      `Delete unused images or upgrade your plan in Settings.`,
  }
}

/**
 * Pure limit gate. Blocks only NEW creations at/over the limit —
 * existing content is NEVER removed (downgrade tolerance, EPIC #3
 * E3-7 principle: downgrade must not delete tenant data).
 */
export function checkPlanLimit(
  plan: PlanDefinition,
  resource: Exclude<LimitResource, "storageMb">,
  currentCount: number
): LimitCheck {
  const limit = plan.limits[resource]
  if (limit === null || currentCount < limit) return { ok: true }
  const noun = RESOURCE_NOUNS[resource]
  return {
    ok: false,
    code: "LIMIT_REACHED",
    resource,
    planId: plan.id,
    limit,
    current: currentCount,
    message:
      `Dosegli ste omejitev paketa ${plan.label}: največ ${limit} ${noun.sl}. ` +
      `Nadgradite paket v Nastavitvah ali odstranite obstoječe vnose.`,
    messageEn:
      `You reached the ${plan.label} plan limit: max ${limit} ${noun.en}. ` +
      `Upgrade your plan in Settings or remove existing entries.`,
  }
}
