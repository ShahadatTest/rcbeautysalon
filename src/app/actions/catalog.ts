"use server"

import { prisma } from "@/lib/prisma"
import { requirePermissionOrg } from "@/lib/auth/guards"
import { revalidatePath } from "next/cache"


// ============================================================
// UNIVERSAL CATALOG: VARIANTS + PACKAGES (EPIC #1 Phase 4b, §11)
// Variants: size/color/material variants of a product with an
// optional price override and own stock. Packages: sellable
// bundles combining services AND products at a package price
// (salon treatment packages, production kits, …).
// All queries/actions are strictly org-scoped via requirePermissionOrg.
// ============================================================

// ------------------------------------------------------------
// Variants
// ------------------------------------------------------------

export interface VariantItem {
  id: string
  productId: string
  name: string
  sku: string | null
  price: number | null
  trackInventory: boolean
  stockQuantity: number
  isActive: boolean
  position: number
}

export interface VariantsActionResult {
  ok: boolean
  error?: string
  id?: string
}

function serializeVariant(v: {
  id: string
  productId: string
  name: string
  sku: string | null
  price: { toNumber(): number } | null
  trackInventory: boolean
  stockQuantity: number
  isActive: boolean
  position: number
}): VariantItem {
  return {
    id: v.id,
    productId: v.productId,
    name: v.name,
    sku: v.sku,
    price: v.price ? v.price.toNumber() : null,
    trackInventory: v.trackInventory,
    stockQuantity: v.stockQuantity,
    isActive: v.isActive,
    position: v.position,
  }
}

/** Variants of one product (org-scoped, ordered). */
export async function getProductVariants(
  productId: string
): Promise<VariantItem[]> {
  const { org } = await requirePermissionOrg("products.manage")
  // Verify the product belongs to this tenant.
  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId: org.id },
    select: { id: true },
  })
  if (!product) return []

  const variants = await prisma.productVariant.findMany({
    where: { productId, organizationId: org.id },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  })
  return variants.map(serializeVariant)
}

export interface CreateVariantInput {
  productId: string
  name: string
  sku?: string | null
  price?: number | null
  trackInventory?: boolean
  stockQuantity?: number
}

export async function createProductVariant(
  input: CreateVariantInput
): Promise<VariantsActionResult> {
  const { org } = await requirePermissionOrg("products.manage")
  const name = input.name?.trim()
  if (!name) return { ok: false, error: "MISSING_NAME" }

  const product = await prisma.product.findFirst({
    where: { id: input.productId, organizationId: org.id },
    select: { id: true },
  })
  if (!product) return { ok: false, error: "NOT_FOUND" }

  const sku = input.sku?.trim() || null
  if (sku) {
    const clash = await prisma.productVariant.findFirst({
      where: { organizationId: org.id, sku },
      select: { id: true },
    })
    if (clash) return { ok: false, error: "SKU_TAKEN" }
  }

  const max = await prisma.productVariant.aggregate({
    where: { productId: input.productId },
    _max: { position: true },
  })

  const created = await prisma.productVariant.create({
    data: {
      organizationId: org.id,
      productId: input.productId,
      name,
      sku,
      price: input.price ?? null,
      trackInventory: input.trackInventory ?? true,
      stockQuantity: input.stockQuantity ?? 0,
      position: (max._max.position ?? 0) + 1,
    },
  })

  revalidatePath("/dashboard/products")
  revalidatePath(`/dashboard/products/${input.productId}/edit`)
  return { ok: true, id: created.id }
}

export interface UpdateVariantInput {
  id: string
  name?: string
  sku?: string | null
  price?: number | null
  trackInventory?: boolean
  stockQuantity?: number
  isActive?: boolean
}

export async function updateProductVariant(
  input: UpdateVariantInput
): Promise<VariantsActionResult> {
  const { org } = await requirePermissionOrg("products.manage")

  const existing = await prisma.productVariant.findFirst({
    where: { id: input.id, organizationId: org.id },
  })
  if (!existing) return { ok: false, error: "NOT_FOUND" }

  const name = input.name?.trim()
  if (name === "") return { ok: false, error: "MISSING_NAME" }

  const sku =
    input.sku === undefined ? existing.sku : input.sku?.trim() || null
  if (sku && sku !== existing.sku) {
    const clash = await prisma.productVariant.findFirst({
      where: { organizationId: org.id, sku, id: { not: existing.id } },
      select: { id: true },
    })
    if (clash) return { ok: false, error: "SKU_TAKEN" }
  }

  await prisma.productVariant.update({
    where: { id: existing.id },
    data: {
      ...(name !== undefined && name !== null ? { name } : {}),
      ...(input.sku !== undefined ? { sku } : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
      ...(input.trackInventory !== undefined
        ? { trackInventory: input.trackInventory }
        : {}),
      ...(input.stockQuantity !== undefined
        ? { stockQuantity: input.stockQuantity }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  })

  revalidatePath("/dashboard/products")
  revalidatePath(`/dashboard/products/${existing.productId}/edit`)
  return { ok: true, id: existing.id }
}

export async function deleteProductVariant(
  id: string
): Promise<VariantsActionResult> {
  const { org } = await requirePermissionOrg("products.manage")
  const existing = await prisma.productVariant.findFirst({
    where: { id, organizationId: org.id },
    select: { id: true, productId: true },
  })
  if (!existing) return { ok: false, error: "NOT_FOUND" }

  await prisma.productVariant.delete({ where: { id: existing.id } })

  revalidatePath("/dashboard/products")
  revalidatePath(`/dashboard/products/${existing.productId}/edit`)
  return { ok: true, id: existing.id }
}

// ------------------------------------------------------------
// Packages
// ------------------------------------------------------------

export interface PackageLineItem {
  itemType: "service" | "product"
  refId: string
  name: string
  quantity: number
  /** Unit price of the underlying item (informational). */
  unitPrice: number
}

export interface PackageItemInfo {
  id: string
  itemType: string
  refId: string
  name: string
  quantity: number
  unitPrice: number
}

export interface PackageInfo {
  id: string
  name: string
  description: string | null
  price: number
  compareAtPrice: number | null
  isActive: boolean
  items: PackageItemInfo[]
  /** Sum of underlying item prices × quantity (before package discount). */
  listValue: number
  createdAt: string
}

export interface PackagesOverview {
  packages: PackageInfo[]
  catalog: {
    services: { id: string; name: string; price: number }[]
    products: { id: string; name: string; price: number }[]
  }
}

/** Packages + pickable catalog (services/products) for the manager page. */
export async function getPackagesOverview(): Promise<PackagesOverview> {
  const { org } = await requirePermissionOrg("products.manage")

  const [packages, services, products] = await Promise.all([
    prisma.package.findMany({
      where: { organizationId: org.id },
      include: {
        items: {
          include: {
            service: { select: { name: true, price: true } },
            product: { select: { name: true, price: true } },
          },
          orderBy: { position: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.service.findMany({
      where: { organizationId: org.id, isActive: true },
      select: { id: true, name: true, price: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
    prisma.product.findMany({
      where: { organizationId: org.id, isActive: true },
      select: { id: true, name: true, price: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
  ])

  const serialized: PackageInfo[] = packages.map((p) => {
    const items: PackageItemInfo[] = p.items.map((it) => {
      const ref = it.itemType === "service" ? it.service : it.product
      return {
        id: it.id,
        itemType: it.itemType,
        refId: (it.serviceId ?? it.productId) ?? "",
        name: ref?.name ?? "—",
        quantity: it.quantity,
        unitPrice: ref ? ref.price.toNumber() : 0,
      }
    })
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price.toNumber(),
      compareAtPrice: p.compareAtPrice?.toNumber() ?? null,
      isActive: p.isActive,
      items,
      listValue: items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0),
      createdAt: p.createdAt.toISOString(),
    }
  })

  return {
    packages: serialized,
    catalog: {
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        price: s.price.toNumber(),
      })),
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price.toNumber(),
      })),
    },
  }
}

export interface PackageLineInput {
  itemType: "service" | "product"
  refId: string
  quantity: number
}

export interface CreatePackageInput {
  name: string
  description?: string | null
  price: number
  compareAtPrice?: number | null
  items: PackageLineInput[]
}

export interface PackageActionResult {
  ok: boolean
  error?: string
  id?: string
}

function validateLines(
  items: PackageLineInput[] | undefined
): { ok: true } | { ok: false; error: string } {
  if (!items || items.length === 0) return { ok: false, error: "NO_ITEMS" }
  for (const it of items) {
    if (!it.refId) return { ok: false, error: "NO_ITEMS" }
    if (!Number.isFinite(it.quantity) || it.quantity < 1)
      return { ok: false, error: "INVALID_QUANTITY" }
  }
  return { ok: true }
}

export async function createPackage(
  input: CreatePackageInput
): Promise<PackageActionResult> {
  const { org } = await requirePermissionOrg("products.manage")
  const name = input.name?.trim()
  if (!name) return { ok: false, error: "MISSING_NAME" }
  if (!Number.isFinite(input.price) || input.price < 0)
    return { ok: false, error: "INVALID_PRICE" }
  const lines = validateLines(input.items)
  if (!lines.ok) return { ok: false, error: lines.error }

  const created = await prisma.package.create({
    data: {
      organizationId: org.id,
      name,
      description: input.description?.trim() || null,
      price: input.price,
      compareAtPrice: input.compareAtPrice ?? null,
      items: {
        create: input.items.map((it, i) => ({
          itemType: it.itemType,
          serviceId: it.itemType === "service" ? it.refId : null,
          productId: it.itemType === "product" ? it.refId : null,
          quantity: Math.max(1, Math.round(it.quantity)),
          position: i + 1,
        })),
      },
    },
  })

  revalidatePath("/dashboard/packages")
  revalidatePath("/dashboard")
  return { ok: true, id: created.id }
}

export async function updatePackage(
  id: string,
  input: CreatePackageInput
): Promise<PackageActionResult> {
  const { org } = await requirePermissionOrg("products.manage")
  const existing = await prisma.package.findFirst({
    where: { id, organizationId: org.id },
    select: { id: true },
  })
  if (!existing) return { ok: false, error: "NOT_FOUND" }

  const name = input.name?.trim()
  if (!name) return { ok: false, error: "MISSING_NAME" }
  if (!Number.isFinite(input.price) || input.price < 0)
    return { ok: false, error: "INVALID_PRICE" }
  const lines = validateLines(input.items)
  if (!lines.ok) return { ok: false, error: lines.error }

  await prisma.$transaction(async (tx) => {
    await tx.packageItem.deleteMany({ where: { packageId: id } })
    await tx.package.update({
      where: { id },
      data: {
        name,
        description: input.description?.trim() || null,
        price: input.price,
        compareAtPrice: input.compareAtPrice ?? null,
        items: {
          create: input.items.map((it, i) => ({
            itemType: it.itemType,
            serviceId: it.itemType === "service" ? it.refId : null,
            productId: it.itemType === "product" ? it.refId : null,
            quantity: Math.max(1, Math.round(it.quantity)),
            position: i + 1,
          })),
        },
      },
    })
  })

  revalidatePath("/dashboard/packages")
  return { ok: true, id }
}

export async function togglePackage(
  id: string,
  isActive: boolean
): Promise<PackageActionResult> {
  const { org } = await requirePermissionOrg("products.manage")
  const existing = await prisma.package.findFirst({
    where: { id, organizationId: org.id },
    select: { id: true },
  })
  if (!existing) return { ok: false, error: "NOT_FOUND" }

  await prisma.package.update({ where: { id }, data: { isActive } })
  revalidatePath("/dashboard/packages")
  return { ok: true, id }
}

export async function deletePackage(
  id: string
): Promise<PackageActionResult> {
  const { org } = await requirePermissionOrg("products.manage")
  const existing = await prisma.package.findFirst({
    where: { id, organizationId: org.id },
    select: { id: true },
  })
  if (!existing) return { ok: false, error: "NOT_FOUND" }

  await prisma.package.delete({ where: { id } })
  revalidatePath("/dashboard/packages")
  return { ok: true, id }
}
