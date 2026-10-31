// ============================================================
// PLAN REGISTRY (EPIC #3 E3-3)
// Single source of truth for commercial plans. Adding/changing a
// plan = editing ONE entry here — no core changes. Zod-validated
// AT MODULE LOAD: an invalid plan definition breaks the build,
// not production behavior.
//
// Client-safe (importable from client components): NO prisma.
// Server-side usage counting lives in ./resolve.ts.
// ============================================================

import { z } from "zod"
import { PLAN_IDS, type PlanDefinition, type PlanId } from "./types"

export { PLAN_IDS, checkPlanLimit } from "./types"
export type { LimitCheck, LimitResource, PlanDefinition, PlanId } from "./types"

// ------------------------------------------------------------
// Zod schema
// ------------------------------------------------------------

const planIdSchema = z.enum(PLAN_IDS)

const localizedText = z.object({ sl: z.string().min(1), en: z.string().min(1) })

/** null = unlimited; a number must be a positive integer. */
const limitValue = z.number().int().positive().nullable()

/** Like limitValue but 0 is allowed — a resource can be entirely
 * outside a plan (e.g. custom domains on FREE, EPIC #3 E3-6). */
const limitValueOrZero = z.number().int().min(0).nullable()

const planSchema = z.object({
  id: planIdSchema,
  version: z.number().int().positive(),
  label: z.string().min(1).max(24),
  description: localizedText,
  limits: z.object({
    services: limitValue,
    products: limitValue,
    staff: limitValue,
    storageMb: limitValue,
    customDomains: limitValueOrZero,
    // Monthly orders (E3-7) — a derived counter, so the same
    // nullable-positive schema as other count limits applies.
    orders: limitValue,
  }),
  features: z.array(localizedText).min(1),
})

// ------------------------------------------------------------
// Plan definitions
// ------------------------------------------------------------
// FREE limits sit ABOVE the largest onboarding catalog seed
// (10 services / 6 products / 1 staff) so a freshly onboarded
// tenant is never immediately over-limit. Monthly orders limits
// (E3-7) are derived Order rows per UTC month — presentation-phase
// values, tunable here without code changes (registry decision).

const PLAN_LIST: PlanDefinition[] = [
  {
    id: "free",
    version: 1,
    label: "FREE",
    description: {
      sl: "Za začetek in manjša podjetja — preizkusite platformo brez obveznosti.",
      en: "For getting started and small businesses — try the platform with no commitment.",
    },
    limits: { services: 15, products: 20, staff: 3, storageMb: 500, customDomains: 0, orders: 50 },
    features: [
      { sl: "Do 15 storitev", en: "Up to 15 services" },
      { sl: "Do 20 izdelkov", en: "Up to 20 products" },
      { sl: "Do 3 zaposleni", en: "Up to 3 team members" },
      { sl: "Javna spletna stran z urejevalnikom", en: "Public website with the no-code editor" },
      { sl: "Rezervacije ali povpraševanja po profilu dejavnosti", en: "Bookings or inquiries based on your activity profile" },
      { sl: "Spletna naslov na platformi (lastna domena v PRO)", en: "Address on the platform domain (custom domain in PRO)" },
      { sl: "50 naročil mesečno", en: "50 orders per month" },
    ],
  },
  {
    id: "pro",
    version: 1,
    label: "PRO",
    description: {
      sl: "Za rastoča podjetja — več prostora za katalog in ekipo.",
      en: "For growing businesses — more room for your catalog and team.",
    },
    limits: { services: 100, products: 500, staff: 25, storageMb: 10_000, customDomains: 1, orders: 1000 },
    features: [
      { sl: "Do 100 storitev", en: "Up to 100 services" },
      { sl: "Do 500 izdelkov", en: "Up to 500 products" },
      { sl: "Do 25 zaposlenih", en: "Up to 25 team members" },
      { sl: "1 lastna domena", en: "1 custom domain" },
      { sl: "1000 naročil mesečno", en: "1000 orders per month" },
      { sl: "Vse zmožnosti FREE paketa", en: "Everything in FREE" },
      { sl: "Prednostna podpora", en: "Priority support" },
    ],
  },
  {
    id: "scale",
    version: 1,
    label: "SCALE",
    description: {
      sl: "Za večje posle — brez omejitev vsebine in ekipe.",
      en: "For larger operations — no content or team limits.",
    },
    limits: { services: null, products: null, staff: null, storageMb: null, customDomains: null, orders: null },
    features: [
      { sl: "Brez omejitev storitev in izdelkov", en: "Unlimited services and products" },
      { sl: "Brez omejitev zaposlenih", en: "Unlimited team members" },
      { sl: "Lastne domene brez omejitev", en: "Custom domains without limits" },
      { sl: "Naročila brez omejitev", en: "Orders without limits" },
      { sl: "Vse zmožnosti PRO paketa", en: "Everything in PRO" },
    ],
  },
]

// ------------------------------------------------------------
// Validation + accessors (mirrors profiles/registry.ts)
// ------------------------------------------------------------

function validatePlans(list: PlanDefinition[]): Record<PlanId, PlanDefinition> {
  const out = {} as Record<PlanId, PlanDefinition>
  for (const plan of list) {
    const parsed = planSchema.safeParse(plan)
    if (!parsed.success) {
      throw new Error(
        `[plans] Invalid plan "${plan.id}": ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`
      )
    }
    if (out[plan.id]) throw new Error(`[plans] Duplicate plan id: ${plan.id}`)
    out[plan.id] = plan
  }
  for (const id of PLAN_IDS) {
    if (!out[id]) throw new Error(`[plans] Missing required plan: ${id}`)
  }
  return out
}

export const PLANS: Record<PlanId, PlanDefinition> = validatePlans(PLAN_LIST)

/** Fallback is always FREE — an unknown plan value degrades, never escalates. */
export const DEFAULT_PLAN_ID: PlanId = "free"

export function isPlanId(value: string | null | undefined): value is PlanId {
  return typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value)
}

export function getPlan(id: string | null | undefined): PlanDefinition {
  return isPlanId(id) ? PLANS[id] : PLANS[DEFAULT_PLAN_ID]
}

export function listPlans(): PlanDefinition[] {
  return PLAN_LIST
}

/** Options for plan pickers (client-safe, serializable). */
export function listPlanOptions(): { id: PlanId; label: string }[] {
  return PLAN_LIST.map((p) => ({ id: p.id, label: p.label }))
}
