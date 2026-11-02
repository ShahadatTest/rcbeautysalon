"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAdminOrg } from "@/lib/tenant"
import { isValidPermissionSet } from "@/lib/permissions/roles"

// ============================================================
// Custom roles CRUD (EPIC #4 G8) — org-scoped, admin-only.
// Permission keys are ALWAYS validated against the catalog; the
// client never dictates raw permission data.
// ============================================================

const roleDataSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(280).optional().nullable(),
  permissions: z
    .array(z.string())
    .refine(isValidPermissionSet, {
      message: "Neznana dovoljenja",
    }),
})

export type CustomRoleInput = z.infer<typeof roleDataSchema>

/** All custom roles of the salon, newest first, with member counts. */
export async function listCustomRoles() {
  const { org } = await requireAdminOrg()

  return prisma.customRole.findMany({
    where: { organizationId: org.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { users: true } },
    },
  })
}

/** Org members that can receive a custom role (ADMIN/STAFF only). */
export async function listAssignableMembers() {
  const { org } = await requireAdminOrg()

  return prisma.user.findMany({
    where: {
      organizationId: org.id,
      role: { in: ["ADMIN", "STAFF"] },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      customRoleId: true,
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  })
}

export async function createCustomRole(input: CustomRoleInput) {
  const { org } = await requireAdminOrg()
  const data = roleDataSchema.parse(input)

  const duplicate = await prisma.customRole.findFirst({
    where: { organizationId: org.id, name: data.name },
    select: { id: true },
  })
  if (duplicate) {
    return { success: false as const, error: "Vloga s tem imenom že obstaja." }
  }

  const role = await prisma.customRole.create({
    data: {
      organizationId: org.id,
      name: data.name,
      description: data.description ?? null,
      permissions: data.permissions,
    },
  })
  return { success: true as const, id: role.id }
}

export async function updateCustomRole(id: string, input: CustomRoleInput) {
  const { org } = await requireAdminOrg()
  const data = roleDataSchema.parse(input)

  const existing = await prisma.customRole.findFirst({
    where: { id, organizationId: org.id },
    select: { id: true },
  })
  if (!existing) {
    return { success: false as const, error: "Vloga ne obstaja." }
  }

  const duplicate = await prisma.customRole.findFirst({
    where: { organizationId: org.id, name: data.name, id: { not: id } },
    select: { id: true },
  })
  if (duplicate) {
    return { success: false as const, error: "Vloga s tem imenom že obstaja." }
  }

  await prisma.customRole.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description ?? null,
      permissions: data.permissions,
    },
  })
  return { success: true as const }
}

export async function deleteCustomRole(id: string) {
  const { org } = await requireAdminOrg()

  const existing = await prisma.customRole.findFirst({
    where: { id, organizationId: org.id },
    select: { id: true },
  })
  if (!existing) {
    return { success: false as const, error: "Vloga ne obstaja." }
  }

  // User.customRoleId is ON DELETE SET NULL — members keep their base
  // ADMIN/STAFF role and immediately regain full legacy access.
  await prisma.customRole.delete({ where: { id } })
  return { success: true as const }
}

/** Assign (or clear, with null) a custom role for an org member. */
export async function assignCustomRole(
  userId: string,
  customRoleId: string | null
) {
  const { org } = await requireAdminOrg()

  const member = await prisma.user.findFirst({
    where: { id: userId, organizationId: org.id },
    select: { id: true, role: true },
  })
  if (!member || member.role === "CLIENTE") {
    return { success: false as const, error: "Član ne obstaja." }
  }

  if (customRoleId !== null) {
    const role = await prisma.customRole.findFirst({
      where: { id: customRoleId, organizationId: org.id },
      select: { id: true },
    })
    if (!role) {
      return { success: false as const, error: "Vloga ne obstaja." }
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { customRoleId },
  })
  return { success: true as const }
}
