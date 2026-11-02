/**
 * Pure guard-decision rules for admin member management and org-bound
 * admin checks (EPIC #4 G8 follow-up — full permission matrix, E4-6b).
 *
 * These are the SINGLE decision points for:
 *  - whether an admin may manage (role/password) a target member
 *  - whether an ADMIN session is bound to a specific request-resolved org
 *
 * Pure functions: no DB, no auth() — the server actions resolve the data
 * and pass it in, so every rule stays unit-testable by design.
 */

export type MemberManageBlockReason = "self" | "not-member" | "admin-target"

export interface MemberTargetInfo {
  id: string
  role: string
  organizationId: string | null
  staff?: { organizationId: string | null } | null
  customer?: { organizationId: string | null } | null
}

/** True when the target belongs to the given org (direct, staff or customer link). */
export function targetBelongsToOrg(target: MemberTargetInfo, orgId: string): boolean {
  return (
    target.organizationId === orgId ||
    target.staff?.organizationId === orgId ||
    target.customer?.organizationId === orgId
  )
}

/**
 * May the acting admin manage (change role / set password of) the target?
 *
 * Policy (mirrors the audited `adminSetUserPassword` rules, now shared):
 *  - self-management is blocked (use account settings / own profile)
 *  - the target MUST belong to the admin's organization
 *  - other ADMINs are protected (no dashboard privilege escalation)
 */
export function canAdminManageTarget(
  actor: { id: string },
  target: MemberTargetInfo,
  orgId: string
): { ok: true } | { ok: false; reason: MemberManageBlockReason } {
  if (actor.id === target.id) return { ok: false, reason: "self" }
  if (!targetBelongsToOrg(target, orgId)) return { ok: false, reason: "not-member" }
  if (target.role === "ADMIN") return { ok: false, reason: "admin-target" }
  return { ok: true }
}

/**
 * Is an ADMIN session bound to the given request-resolved organization?
 *
 * An admin of org A browsing another tenant's site (/s/org-b) must NOT
 * pass as "the admin" of org B. Legacy admins without `organizationId`
 * keep access ONLY to the org their session resolves to (default-org
 * fallback) — never to an arbitrary request org.
 */
export function isAdminForOrg(
  user: { role: string; organizationId?: string | null },
  orgId: string,
  sessionOrgId?: string | null
): boolean {
  if (user.role !== "ADMIN") return false
  return user.organizationId === orgId || sessionOrgId === orgId
}
