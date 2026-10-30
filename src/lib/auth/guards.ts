import { auth } from "@/lib/auth/auth"
import { UserRole } from "@prisma/client"

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
