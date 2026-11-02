"use server"

import { prisma } from "@/lib/prisma"
import { getPublicOrg } from "@/lib/tenant"
import { CartItem } from "@/store/cart-store";

export async function validateCartStock(items: CartItem[]) {
  const errors: {
    productId: string
    name: string
    available: number
    requested: number
  }[] = []

  // SECURITY (E4-6b): the tenant is ALWAYS resolved from the request
  // (proxy header / custom domain / session). A client-supplied orgId
  // would allow cross-tenant product probing, so the parameter was removed.
  const org = await getPublicOrg()

  if (!org) {
    // No organization -> no products can be validated
    return {
      valid: false,
      errors: items.map((item) => ({
        productId: item.productId,
        name: item.name,
        available: 0,
        requested: item.quantity,
      })),
    }
  }

  // Fetch all products in parallel (not sequentially), scoped to the organization
  const products = await Promise.all(
    items.map((item) =>
      prisma.product.findFirst({
        where: { id: item.productId, organizationId: org.id },
      })
    )
  )

  // Validate each product
  items.forEach((item, index) => {
    const product = products[index]
    if (!product || product.stockQuantity < item.quantity) {
      errors.push({
        productId: item.productId,
        name: item.name,
        available: product?.stockQuantity ?? 0,
        requested: item.quantity,
      })
    }
  })

  return { valid: errors.length === 0, errors }
}
