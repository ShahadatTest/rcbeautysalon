"use client"

import { createContext, useContext } from "react"
import type { PermissionKey } from "@/lib/permissions/roles"

/**
 * Effective permissions of the signed-in member, computed SERVER-SIDE in
 * the (admin) layout (G8) and consumed by the sidebar / client chrome.
 * `permissions` is always a concrete list (empty for CLIENTE); `isAdmin`
 * gates admin-only chrome such as the custom-roles page link.
 */
interface PermissionsContextValue {
  permissions: PermissionKey[]
  isAdmin: boolean
}

const PermissionsContext = createContext<PermissionsContextValue>({
  permissions: [],
  isAdmin: false,
})

export function PermissionsProvider({
  value,
  children,
}: {
  value: PermissionsContextValue
  children: React.ReactNode
}) {
  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissions(): PermissionsContextValue {
  return useContext(PermissionsContext)
}
