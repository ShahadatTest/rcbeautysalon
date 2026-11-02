import { auth } from "@/lib/auth/auth"
import { UserRole } from "@prisma/client"
import { redirect } from "next/navigation"
import type { PermissionKey } from "@/lib/permissions/roles"
import { getEffectivePermissions } from "@/lib/permissions/effective"

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message)
    this.name = "UnauthorizedError"
  }
}

/**
 * Returns the current session or throws UnauthorizedError.
 * Use inside every mutating / admin-only server action.
 */
export async function requireSession() {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError("You must be signed in to perform this action")
  }
  return session
}

/**
 * Returns the current session or throws if the user's role is not allowed.
 */
export async function requireRole(roles: UserRole[]) {
  const session = await requireSession()
  if (!roles.includes(session.user.role)) {
    throw new UnauthorizedError("You do not have permission to perform this action")
  }
  return session
}

/** Admin-only guard */
export function requireAdmin() {
  return requireRole(["ADMIN"])
}

/** Staff-or-admin guard */
export function requireStaffOrAdmin() {
  return requireRole(["ADMIN", "STAFF"])
}

/**
 * True if the current caller is an authenticated staff/admin user.
 * Used for employee-only pricing — MUST be derived server-side,
 * never trusted from client arguments.
 */
export async function isEmployeeSession(): Promise<boolean> {
  const session = await auth()
  if (!session?.user) return false
  return session.user.role === "STAFF" || session.user.role === "ADMIN"
}

// ============================================================
// Custom roles (EPIC #4 G8)
// ============================================================

/**
 * Action guard: throws when the current member lacks the permission.
 * Effective permissions are read FRESH from the DB — role edits apply
 * on the next request even for long-lived JWT sessions.
 */
export async function requirePermission(key: PermissionKey) {
  const session = await requireSession()
  const perms = await getEffectivePermissions(session.user.id)
  if (!perms.includes(key)) {
    throw new UnauthorizedError(
      "You do not have permission to perform this action"
    )
  }
  return session
}

/**
 * Page guard: same rule as requirePermission but REDIRECTS to the
 * dashboard instead of throwing (for server components).
 */
export async function requirePagePermission(key: PermissionKey) {
  const session = await requireSession()
  const perms = await getEffectivePermissions(session.user.id)
  if (!perms.includes(key)) {
    redirect("/dashboard")
  }
  return session
}
