"use client"

import { useEffect } from "react"
import { useCartStore } from "@/store/cart-store"

/**
 * Binds the cart store to the tenant currently being viewed. Mounted once
 * per (public)/(customer) layout — every cart read/write below it is scoped
 * to this organization, so two salons never share a basket (P0-1 fix).
 */
export function CartOrgScope({ slug }: { slug: string | null }) {
  const setActiveOrg = useCartStore((state) => state.setActiveOrg)

  useEffect(() => {
    setActiveOrg(slug)
  }, [slug, setActiveOrg])

  return null
}
