"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireAdminOrg } from "@/lib/tenant"
import { getSessionEffectiveProfile } from "@/lib/profiles/resolve"
import { computeStockDelta, type StockDirectionValue } from "@/lib/inventory/stock"

// ============================================================
// INVENTORY RUNTIME (EPIC #2 E2-2) — stock movement ledger.
// Manual receipts/issues update the product/variant stock AND
// append a ledger row in ONE transaction; negative stock is
// rejected (§11). All queries/actions are strictly org-scoped
// via requireAdminOrg. Traceability links (supplier/batch) must
// belong to the same tenant AND to an extension the profile
// actually enables — the client can never inject foreign ids.
// ============================================================

const movementInputSchema = z.object({
  productId: z.string().min(1).max(64),
  productVariantId: z.string().min(1).max(64).nullable().optional(),
  direction: z.enum(["IN", "OUT"]),
  quantity: z.number().int().positive().max(1_000_000),
  note: z.string().max(500).nullable().optional(),
  supplierRecordId: z.string().min(1).max(64).nullable().optional(),
  batchRecordId: z.string().min(1).max(64).nullable().optional(),
})

export type MovementInput = z.input<typeof movementInputSchema>

/** Error codes the UI maps to bilingual text. */
export type MovementErrorCode =
  | "VALIDATION"
  | "INVALID_QUANTITY"
  | "NEGATIVE_STOCK"
  | "NOT_FOUND"
  | "VARIANT_MISMATCH"
  | "RECORD_LINK"
  | "NOT_TRACKED"
  | "GENERIC"

export interface MovementResult {
  ok: boolean
  error?: MovementErrorCode
  fieldErrors?: Record<string, string>
  nextStock?: number
}

export interface StockMovementItem {
  id: string
  direction: StockDirectionValue
  quantity: number
  source: "MANUAL" | "ORDER"
  note: string | null
  variantName: string | null
  supplierTitle: string | null
  batchTitle: string | null
  orderNumber: string | null
  createdByName: string | null
  createdAt: string
}

export interface StockLinkOptions {
  suppliers: { id: string; title: string }[]
  batches: { id: string; title: string }[]
}

/**
 * Record ONE manual stock movement (receipt or issue) and update
 * the stock state atomically. The pure rule (computeStockDelta)
 * decides BEFORE any write — a rejected movement leaves both the
 * state and the ledger untouched.
 */
export async function createStockMovement(
  input: MovementInput
): Promise<MovementResult> {
  const parsed = movementInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "VALIDATION" }
  }
  const data = parsed.data

  const { session, org } = await requireAdminOrg()

  // Product must belong to THIS tenant (§3 isolation).
  const product = await prisma.product.findFirst({
    where: { id: data.productId, organizationId: org.id },
    select: { id: true, name: true, trackInventory: true, stockQuantity: true },
  })
  if (!product) return { ok: false, error: "NOT_FOUND" }
  if (!product.trackInventory) return { ok: false, error: "NOT_TRACKED" }

  // Variant (optional) must belong to the product.
  let variant: { id: string; stockQuantity: number } | null = null
  if (data.productVariantId) {
    const v = await prisma.productVariant.findFirst({
      where: {
        id: data.productVariantId,
        productId: product.id,
        organizationId: org.id,
      },
      select: { id: true, stockQuantity: true },
    })
    if (!v) return { ok: false, error: "VARIANT_MISMATCH" }
    if (!v.stockQuantity && v.stockQuantity !== 0) {
      return { ok: false, error: "VALIDATION" }
    }
    variant = { id: v.id, stockQuantity: v.stockQuantity }
  }

  // Traceability links must exist in THIS tenant and belong to an
  // entity the effective profile actually enables.
  const profile = await getSessionEffectiveProfile()
  const supplierEnabled = profile.extensions.includes("suppliers")
  const batchEnabled = profile.extensions.includes("batch-production")

  if (data.supplierRecordId) {
    if (!supplierEnabled) return { ok: false, error: "RECORD_LINK" }
    const rec = await prisma.extensionRecord.findFirst({
      where: {
        id: data.supplierRecordId,
        organizationId: org.id,
        entityKey: "supplier",
      },
      select: { id: true },
    })
    if (!rec) return { ok: false, error: "RECORD_LINK" }
  }
  if (data.batchRecordId) {
    if (!batchEnabled) return { ok: false, error: "RECORD_LINK" }
    const rec = await prisma.extensionRecord.findFirst({
      where: {
        id: data.batchRecordId,
        organizationId: org.id,
        entityKey: "batch",
      },
      select: { id: true },
    })
    if (!rec) return { ok: false, error: "RECORD_LINK" }
  }

  const currentStock = variant ? variant.stockQuantity : product.stockQuantity
  const computed = computeStockDelta(
    currentStock,
    data.direction as StockDirectionValue,
    data.quantity
  )
  if (!computed.ok) {
    return {
      ok: false,
      error: computed.reason === "NEGATIVE_STOCK" ? "NEGATIVE_STOCK" : "INVALID_QUANTITY",
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1) STATE — product or variant stock.
      if (variant) {
        await tx.productVariant.update({
          where: { id: variant.id },
          data: { stockQuantity: computed.nextStock },
        })
      } else {
        await tx.product.update({
          where: { id: product.id },
          data: { stockQuantity: computed.nextStock },
        })
      }

      // 2) LEDGER — append-only row for the same event.
      await tx.stockMovement.create({
        data: {
          organizationId: org.id,
          productId: product.id,
          productVariantId: variant?.id ?? null,
          direction: data.direction,
          quantity: data.quantity,
          source: "MANUAL",
          note: data.note?.trim() || null,
          supplierRecordId: data.supplierRecordId ?? null,
          batchRecordId: data.batchRecordId ?? null,
          createdById: session.user.id,
        },
      })
    })
  } catch (error) {
    console.error("[inventory] movement transaction failed:", error)
    return { ok: false, error: "GENERIC" }
  }

  revalidatePath("/dashboard/products")
  revalidatePath(`/dashboard/products/${product.id}/edit`)
  revalidatePath("/dashboard")

  return { ok: true, nextStock: computed.nextStock }
}

/** Ledger entries for one product (org-scoped, newest first). */
export async function listStockMovements(
  productId: string
): Promise<StockMovementItem[]> {
  const { org } = await requireAdminOrg()

  // Guard: product must belong to this tenant — never serve foreign rows.
  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId: org.id },
    select: { id: true },
  })
  if (!product) return []

  const rows = await prisma.stockMovement.findMany({
    where: { organizationId: org.id, productId },
    include: {
      productVariant: { select: { name: true } },
      supplierRecord: { select: { title: true } },
      batchRecord: { select: { title: true } },
      order: { select: { id: true, guestName: true, customer: { select: { name: true } } } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return rows.map((r) => ({
    id: r.id,
    direction: r.direction,
    quantity: r.quantity,
    source: r.source,
    note: r.note,
    variantName: r.productVariant?.name ?? null,
    supplierTitle: r.supplierRecord?.title ?? null,
    batchTitle: r.batchRecord?.title ?? null,
    orderNumber: r.order
      ? (r.order.customer?.name ?? r.order.guestName ?? r.order.id)
      : null,
    createdByName: r.createdBy?.name ?? null,
    createdAt: r.createdAt.toISOString(),
  }))
}

/**
 * Picker options for the movement form. Suppliers come from the
 * `suppliers` extension entity, batches from `batch-production` —
 * both only when the effective profile enables them.
 */
export async function getStockLinkOptions(): Promise<StockLinkOptions> {
  const { org } = await requireAdminOrg()
  const profile = await getSessionEffectiveProfile()

  const suppliers = profile.extensions.includes("suppliers")
    ? await prisma.extensionRecord.findMany({
        where: { organizationId: org.id, entityKey: "supplier" },
        select: { id: true, title: true },
        orderBy: { title: "asc" },
        take: 200,
      })
    : []

  const batches = profile.extensions.includes("batch-production")
    ? await prisma.extensionRecord.findMany({
        where: { organizationId: org.id, entityKey: "batch" },
        select: { id: true, title: true },
        orderBy: { title: "asc" },
        take: 200,
      })
    : []

  return {
    suppliers: suppliers.map((s) => ({ id: s.id, title: s.title })),
    batches: batches.map((b) => ({ id: b.id, title: b.title })),
  }
}

/** Dashboard widget input: stock counts + the lowest-stock items. */
export interface StockSummary {
  inStock: number
  low: number
  out: number
  lowItems: { id: string; name: string; stockQuantity: number }[]
}

/**
 * Seštevek zaloge za dashboard widget (lowStock). Counts follow
 * the products page thresholds (in > 10, low 1–10, out 0).
 */
export async function getStockSummary(): Promise<StockSummary> {
  const { org } = await requireAdminOrg()

  const [inStock, low, out, lowItems] = await Promise.all([
    prisma.product.count({
      where: { organizationId: org.id, stockQuantity: { gt: 10 } },
    }),
    prisma.product.count({
      where: { organizationId: org.id, stockQuantity: { gt: 0, lte: 10 } },
    }),
    prisma.product.count({
      where: { organizationId: org.id, stockQuantity: { equals: 0 } },
    }),
    prisma.product.findMany({
      where: { organizationId: org.id, stockQuantity: { lte: 10 } },
      select: { id: true, name: true, stockQuantity: true },
      orderBy: { stockQuantity: "asc" },
      take: 5,
    }),
  ])

  return { inStock, low, out, lowItems }
}
