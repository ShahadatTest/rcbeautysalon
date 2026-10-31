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
 * storageMb is declared for completeness and displayed in the UI;
 * upload-route enforcement follows with metrics (E3-7), NOT here.
 */
export type LimitResource = "services" | "products" | "staff" | "storageMb"

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

/** Resource nouns used inside limit messages (genitive plural for sl). */
export const RESOURCE_NOUNS: Record<Exclude<LimitResource, "storageMb">, { sl: string; en: string }> = {
  services: { sl: "storitev", en: "services" },
  products: { sl: "izdelkov", en: "products" },
  staff: { sl: "zaposlenih", en: "team members" },
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
