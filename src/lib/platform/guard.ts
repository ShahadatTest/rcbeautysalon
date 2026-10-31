import "server-only"

// ============================================================
// PLATFORM OPERATOR GUARD (EPIC #3 E3-5)
// The authoritative server-side check for /platform pages and
// actions. Deliberately NOT based on the tenant ADMIN role —
// the env allowlist (PLATFORM_ADMIN_EMAILS) is the only source,
// evaluated fresh on every call, fail-closed.
// ============================================================

import { requireSession, UnauthorizedError } from "@/lib/auth/guards"
import { isPlatformAdminEmail, PLATFORM_ADMIN_EMAILS_ENV } from "@/lib/platform/access"

/**
 * Returns the operator session or throws UnauthorizedError.
 * Never trust the middleware redirect alone — every /platform
 * page and action re-checks here.
 */
export async function requirePlatformAdmin() {
  const session = await requireSession()
  const allowed = isPlatformAdminEmail(
    session.user.email,
    process.env[PLATFORM_ADMIN_EMAILS_ENV]
  )
  if (!allowed) {
    throw new UnauthorizedError("Platform operator access is restricted")
  }
  return session
}
