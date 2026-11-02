import { prisma } from "@/lib/prisma"
import {
  effectivePermissionKeys,
  hasPermission,
  type PermissionKey,
} from "@/lib/permissions/roles"

/**
 * Server-side effective permissions for a member (G8).
 *
 * Reads the user FRESH from the DB on every call — JWT sessions are
 * long-lived, but permission changes must apply immediately (revoking
 * a role takes effect on the next request, not after re-login).
 */
export async function getEffectivePermissions(
  userId: string
): Promise<PermissionKey[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      customRole: { select: { permissions: true } },
    },
  })
  if (!user) return []
  return effectivePermissionKeys({
    role: user.role,
    customRolePermissions: user.customRole?.permissions ?? null,
  })
}

/** Single server-side decision point for permission checks. */
export async function userHasPermission(
  userId: string,
  key: PermissionKey
): Promise<boolean> {
  return hasPermission(await getEffectivePermissions(userId), key)
}
