import type { Metadata } from "next"
import { listCustomRoles, listAssignableMembers } from "@/app/actions/custom-roles"
import { permissionsFromJson } from "@/lib/permissions/roles"
import { requireUnrestrictedPage } from "@/lib/auth/guards"
import { RolesClient, type RoleRow, type MemberRow } from "@/components/dashboard/roles-client"

export const metadata: Metadata = {
  title: "Vloge | Poslovna platforma",
  description: "Vloge po meri in dovoljenja članov salona (G8)",
}

export default async function RolesPage() {
  // E4-6b: administering the permission catalog escalates privileges —
  // only an UNRESTRICTED admin (all keys) may enter; restricted admins
  // and staff are sent back to the dashboard.
  await requireUnrestrictedPage()

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
