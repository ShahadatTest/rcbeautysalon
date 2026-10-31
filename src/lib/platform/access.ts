// ============================================================
// PLATFORM ACCESS + SUSPENSION RULES (EPIC #3 E3-5)
// Pure, client-safe decision logic for the platform operator
// console. No server-only imports — the same functions are used
// by the middleware guard (proxy.ts), server actions and tests.
//
// Authorization model: the PLATFORM_ADMIN_EMAILS env allowlist is
// the ONLY source of operator identity (fail-closed — an empty or
// missing list means NOBODY is an operator). This is deliberately
// separate from the tenant ADMIN role: being a tenant owner never
// grants platform access, and being an operator never implies a
// tenant.
// ============================================================

export const PLATFORM_ADMIN_EMAILS_ENV = "PLATFORM_ADMIN_EMAILS"

/** Organization.status values (tenant root lifecycle). */
export const ORG_STATUS_ACTIVE = "ACTIVE"
export const ORG_STATUS_SUSPENDED = "SUSPENDED"
export type OrgStatus = typeof ORG_STATUS_ACTIVE | typeof ORG_STATUS_SUSPENDED

/** Append-only audit actions (PlatformAuditLog.action). */
export const PLATFORM_AUDIT_ACTIONS = [
  "TENANT_SUSPENDED",
  "TENANT_REACTIVATED",
] as const
export type PlatformAuditAction = (typeof PLATFORM_AUDIT_ACTIONS)[number]

/**
 * Parse the comma-separated operator allowlist. Lowercases and
 * trims entries; empty fragments are dropped.
 */
export function platformAdminEmails(raw: string | undefined | null): string[] {
  if (!raw) return []
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0)
}

/**
 * The authorization decision. Case-insensitive on both sides;
 * fails closed when the email is missing or the list is empty.
 */
export function isPlatformAdminEmail(
  email: string | null | undefined,
  raw: string | undefined | null
): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  if (!normalized) return false
  return platformAdminEmails(raw).includes(normalized)
}

// ------------------------------------------------------------
// Suspension reason validation — the reason is REQUIRED (audit
// trail + owner display), bounded, and stored trimmed.
// ------------------------------------------------------------

export const SUSPENSION_REASON_MIN = 3
export const SUSPENSION_REASON_MAX = 500

export type ReasonValidation =
  | { ok: true; value: string }
  | { ok: false; code: "MISSING" | "TOO_SHORT" | "TOO_LONG" }

export function validateSuspensionReason(
  reason: string | null | undefined
): ReasonValidation {
  const value = (reason ?? "").trim()
  if (!value) return { ok: false, code: "MISSING" }
  if (value.length < SUSPENSION_REASON_MIN) return { ok: false, code: "TOO_SHORT" }
  if (value.length > SUSPENSION_REASON_MAX) return { ok: false, code: "TOO_LONG" }
  return { ok: true, value }
}

// ------------------------------------------------------------
// Suspension state machine — suspending a suspended tenant (or
// reactivating an active one) is a no-op refusal, never a silent
// double write.
// ------------------------------------------------------------

export type SuspensionAction = "SUSPEND" | "REACTIVATE"

export type SuspensionTransition =
  | { ok: true; next: OrgStatus }
  | { ok: false; code: "ALREADY_ACTIVE" | "ALREADY_SUSPENDED" }

export function suspensionTransition(
  current: string,
  action: SuspensionAction
): SuspensionTransition {
  if (action === "SUSPEND") {
    if (current === ORG_STATUS_SUSPENDED) {
      return { ok: false, code: "ALREADY_SUSPENDED" }
    }
    return { ok: true, next: ORG_STATUS_SUSPENDED }
  }
  // REACTIVATE
  if (current === ORG_STATUS_ACTIVE) {
    return { ok: false, code: "ALREADY_ACTIVE" }
  }
  return { ok: true, next: ORG_STATUS_ACTIVE }
}
