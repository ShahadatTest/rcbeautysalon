// ============================================================
// E4-2b — MEASUREMENT ID INTEGRATION (pure rules, no I/O)
//
// §15 "available analytics integration": the tenant owner may supply
// their own GA4 measurement ID. The platform itself never tracks
// anyone — the owner's script is injected ONLY into the owner's
// PUBLISHED public site, never into the dashboard, the operator
// console, the preview of an unpublished site or the maintenance
// screen (see analyticsScriptIdFor).
//
// This module is deliberately free of server-only imports so every
// rule is testable on fixed inputs (same principle as E4-1's
// computePlatformAnalytics).
// ============================================================

/**
 * Strict GA4 measurement ID shape: `G-` + 6..12 alphanumeric chars
 * (today's GA4 issues 10; the range keeps headroom without opening
 * the door to arbitrary strings). Anything else is rejected at save
 * time AND at injection time (defense in depth — an invalid ID can
 * never reach a script tag, so the injected URL can't be abused).
 */
export const MEASUREMENT_ID_PATTERN = /^G-[A-Za-z0-9]{6,12}$/

/** Trim surrounding whitespace; empty/absent input normalizes to null (= "not set"). */
export function normalizeMeasurementId(
  raw: string | null | undefined
): string | null {
  if (raw === null || raw === undefined) return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** Strict shape check (input is expected pre-normalized). */
export function isValidMeasurementId(id: string | null | undefined): boolean {
  if (!id) return false
  return MEASUREMENT_ID_PATTERN.test(id)
}

export type MeasurementIdParseResult =
  | { ok: true; value: string | null }
  | { ok: false; reason: "invalid" }

/**
 * Full input pipeline for the settings form:
 *   empty  -> ok, null       (owner cleared the field)
 *   valid  -> ok, value      (trimmed)
 *   junk   -> ok=false       (never silently stored or silently dropped)
 */
export function parseMeasurementIdInput(
  raw: string | null | undefined
): MeasurementIdParseResult {
  const value = normalizeMeasurementId(raw)
  if (value === null) return { ok: true, value: null }
  if (!isValidMeasurementId(value)) return { ok: false, reason: "invalid" }
  return { ok: true, value }
}

/**
 * The single decision point for script injection (§15 privacy rule):
 * the owner's analytics script exists ONLY for a PUBLISHED tenant site
 * with a VALID stored ID. Owner previews of unpublished sites, hidden
 * (maintenance) states, missing tenants and invalid IDs all yield null
 * — no script tag is ever rendered in those cases.
 */
export function analyticsScriptIdFor(input: {
  gate: "published" | "owner-preview" | "hidden"
  measurementId: string | null | undefined
}): string | null {
  if (input.gate !== "published") return null
  const id = normalizeMeasurementId(input.measurementId)
  if (!isValidMeasurementId(id)) return null
  return id
}
