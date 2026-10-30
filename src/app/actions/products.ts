"use server"

import { cache } from "react"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { CreateProductInput } from "@/lib/interfaces"
import { requireAdminOrg, getResolvedOrg } from "@/lib/tenant"
import { getPublicOrg } from "@/lib/tenant"
import { UnauthorizedError } from "@/lib/auth/guards"

export type UpdateProductInput = Partial<CreateProductInput>

/**
 * Resolve the organization for functions used by BOTH the public site and the
 * admin dashboard: admins/staff get their session org, everyone else gets the
 * public (tenant) org.
 */
async function resolveRequestOrg() {
  // Tenant header (/s/[slug]) always wins over the session to avoid
  // cross-tenant leakage when a signed-in admin browses another salon.
  return getResolvedOrg()
}

// Get featured products for homepage
export const getFeaturedProducts = cache(async () => {
  const org = await getPublicOrg()
  if (!org) return []

  const products = await prisma.product.findMany({
    where: { isActive: true, isFeatured: true, organizationId: org.id },
    include: { category: true },
    take: 4,
    orderBy: { name: "asc" },
  })

  return products.map((p) => ({
    ...p,
    price: p.price.toNumber(),
    compareAtPrice: p.compareAtPrice?.toNumber() ?? null,
  }))
})

// Get all products for shop page
export const getShopProducts = cache(async () => {
  const org = await getPublicOrg()
  if (!org) return []

  const products = await prisma.product.findMany({
    where: { isActive: true, organizationId: org.id },
    orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
  })

  return products.map((product) => ({
    ...product,
    price: product.price.toNumber(),
    compareAtPrice: product.compareAtPrice?.toNumber() ?? null,
  }))
})

// Admin: Get all products with counts
export async function getAdminProducts(search?: string) {
  const { org } = await requireAdminOrg()

  const products = await prisma.product.findMany({
    where: {
      organizationId: org.id,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { sku: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      category: { select: { name: true } },
      _count: { select: { orderItems: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return products.map((product) => ({
    ...product,
    price: product.price.toNumber(),
    compareAtPrice: product.compareAtPrice?.toNumber() ?? null,
  }))
}

// Admin: Get product statistics
export async function getProductStats() {
  const { org } = await requireAdminOrg()

  const [totalProducts, inStock, lowStock, outOfStock] = await Promise.all([
    prisma.product.count({ where: { organizationId: org.id } }),
    prisma.product.count({
      where: { stockQuantity: { gt: 10 }, organizationId: org.id },
    }),
    prisma.product.count({
      where: { stockQuantity: { gt: 0, lte: 10 }, organizationId: org.id },
    }),
    prisma.product.count({
      where: { stockQuantity: { equals: 0 }, organizationId: org.id },
    }),
  ])

  return { totalProducts, inStock, lowStock, outOfStock }
}

// Get product by ID (public shop detail + admin edit)
// Cached to avoid duplicate fetches in generateMetadata + page component
export const getProductById = cache(async (id: string) => {
  const org = await resolveRequestOrg()
  if (!org) return null

  const product = await prisma.product.findFirst({
    where: { id, organizationId: org.id },
    include: { category: true },
  })

  if (!product) return null

  return {
    ...product,
    price: product.price.toNumber(),
    compareAtPrice: product.compareAtPrice?.toNumber() ?? null,
  }
})

// Create product
export async function createProduct(data: CreateProductInput) {
  try {
    const { org } = await requireAdminOrg()

    // Extract categoryId from data
    const { categoryId, ...productData } = data

    // Validate the category belongs to this organization
    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: categoryId, organizationId: org.id },
        select: { id: true },
      })
      if (!category) {
        return { success: false, error: "Invalid category" }
      }
    }

    const product = await prisma.product.create({
      data: {
        ...productData,
        organization: { connect: { id: org.id } },
        ...(categoryId && { category: { connect: { id: categoryId } } }),
      },
    })

    revalidatePath("/dashboard/products")
    revalidatePath("/shop")

    return {
      success: true,
      product: {
        ...product,
        price: product.price.toNumber(),
        compareAtPrice: product.compareAtPrice?.toNumber() ?? null,
      },
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error creating product:", error)
    return { success: false, error: "Failed to create product." }
  }
}

// Update product
export async function updateProduct(id: string, data: UpdateProductInput) {
  try {
    const { org } = await requireAdminOrg()

    // Extract categoryId from data
    const { categoryId, ...productData } = data

    // Verify ownership before mutating
    const existing = await prisma.product.findFirst({
      where: { id, organizationId: org.id },
      select: { id: true },
    })
    if (!existing) {
      return { success: false, error: "Product not found" }
    }

    // Validate the category belongs to this organization
    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: categoryId, organizationId: org.id },
        select: { id: true },
      })
      if (!category) {
        return { success: false, error: "Invalid category" }
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...productData,
        ...(categoryId !== undefined && {
          category: categoryId
            ? { connect: { id: categoryId } }
            : { disconnect: true },
        }),
      },
    })

    revalidatePath("/dashboard/products")
    revalidatePath("/shop")

    return {
      success: true,
      product: {
        ...product,
        price: product.price.toNumber(),
        compareAtPrice: product.compareAtPrice?.toNumber() ?? null,
      },
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error updating product:", error)
    return { success: false, error: "Failed to update product." }
  }
}

// Delete product
export async function deleteProduct(id: string) {
  try {
    const { org } = await requireAdminOrg()

    // Verify ownership before mutating
    const existing = await prisma.product.findFirst({
      where: { id, organizationId: org.id },
      select: { id: true },
    })
    if (!existing) {
      return { success: false, error: "Product not found" }
    }

    const orderCount = await prisma.orderItem.count({
      where: { productId: id },
    })

    if (orderCount > 0) {
      return {
        success: false,
        error:
          "Cannot delete product with existing orders. Deactivate instead.",
      }
    }

    await prisma.product.delete({ where: { id } })

    revalidatePath("/dashboard/products")
    revalidatePath("/shop")

    return { success: true }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error deleting product:", error)
    return { success: false, error: "Failed to delete product." }
  }
}

// Toggle product active status
export async function toggleProductStatus(id: string) {
  try {
    const { org } = await requireAdminOrg()

    const product = await prisma.product.findFirst({
      where: { id, organizationId: org.id },
      select: { isActive: true },
    })

    if (!product) {
      return { success: false, error: "Product not found." }
    }

    const updated = await prisma.product.update({
      where: { id },
      data: { isActive: !product.isActive },
    })

    revalidatePath("/dashboard/products")
    revalidatePath("/shop")

    return { success: true, isActive: updated.isActive }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return { success: false, error: error.message }
    }
    console.error("Error toggling product status:", error)
    return { success: false, error: "Failed to toggle product status." }
  }
}
