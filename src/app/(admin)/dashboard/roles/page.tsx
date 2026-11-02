import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth/auth"
import { listCustomRoles, listAssignableMembers } from "@/app/actions/custom-roles"
import { permissionsFromJson } from "@/lib/permissions/roles"
import { RolesClient, type RoleRow, type MemberRow } from "@/components/dashboard/roles-client"

export const metadata: Metadata = {
  title: "Vloge | Poslovna platforma",
  description: "Vloge po meri in dovoljenja članov salona (G8)",
}

export default async function RolesPage() {
  // Custom roles are an owner/admin surface — staff are sent back.
  const session = await auth()
  if (session?.user?.role !== "ADMIN") {
    redirect("/dashboard")
  }

  const [roles, members] = await Promise.all([
    listCustomRoles(),
    listAssignableMembers(),
  ])

  const roleRows: RoleRow[] = roles.map((role) => ({
    id: role.id,
    name: role.name,
    description: role.description,
    permissions: permissionsFromJson(role.permissions),
    userCount: role._count.users,
  }))

  const memberRows: MemberRow[] = members.map((member) => ({
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role as "ADMIN" | "STAFF",
    customRoleId: member.customRoleId,
  }))

  return <RolesClient roles={roleRows} members={memberRows} />
}
