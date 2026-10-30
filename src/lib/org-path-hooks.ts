"use client"

import { usePathname } from "next/navigation"

/** Client hook: returns the tenant prefix of the current URL ("" on bare routes). */
export function useOrgPrefix(): string {
  const pathname = usePathname()
  const m = pathname?.match(/^\/s\/([^/]+)/)
  return m ? `/s/${m[1]}` : ""
}

/** Client hook: returns the tenant slug of the current URL (null on bare routes). */
export function useOrgSlug(): string | null {
  const pathname = usePathname()
  const m = pathname?.match(/^\/s\/([^/]+)/)
  return m ? m[1] : null
}
