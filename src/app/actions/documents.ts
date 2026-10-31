"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requireAdminOrg } from "@/lib/tenant"

// ============================================================
// DOCUMENTS: QUOTES + INVOICES (EPIC #1 Phase 4b, §13 documents
// capability). Per-tenant sequential numbering per type, status
// transitions validated server-side, printable line-item layout.
// Quotes: DRAFT → SENT → ACCEPTED | REJECTED.
// Invoices: DRAFT → ISSUED → PAID | CANCELLED.
// All queries/actions are strictly org-scoped via requireAdminOrg.
// ============================================================

export type DocumentType = "QUOTE" | "INVOICE"

export interface DocumentLineInput {
  description: string
  quantity: number
  unitPrice: number
}

export interface DocumentItemInfo {
  id: string
  description: string
  quantity: number
  unitPrice: number
  total: number
}

export interface DocumentListItem {
  id: string
  type: DocumentType
  number: number
  status: string
  customerName: string | null
  customerEmail: string | null
  workOrderId: string | null
  workOrderTitle: string | null
  workOrderNumber: number | null
  issueDate: string
  dueDate: string | null
  total: number
  /** INVOICE issued & not paid & dueDate in the past. */
  overdue: boolean
  createdAt: string
}

export interface DocumentsStats {
  quotesDraft: number
  quotesSent: number
  quotesAccepted: number
  quotesRejected: number
  invoicesDraft: number
  invoicesIssued: number
  invoicesUnpaid: number
  invoicesPaid: number
  /** Sum of ISSUED (unpaid) invoice totals this tenant. */
  unpaidTotal: number
  overdueCount: number
}

export interface DocumentsOverview {
  quotes: DocumentListItem[]
  invoices: DocumentListItem[]
  stats: DocumentsStats
  openWorkOrders: { id: string; number: number; title: string }[]
}

export interface DocumentDetail {
  id: string
  type: DocumentType
  number: number
  status: string
  issueDate: string
  dueDate: string | null
  total: number
  notes: string | null
  customer: {
    id: string
    name: string
    email: string | null
    phone: string | null
  } | null
  workOrder:
    | { id: string; number: number; title: string; currentStageKey: string | null }
    | null
  items: DocumentItemInfo[]
  createdAt: string
}

function toNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function serializeListItem(
  d: {
    id: string
    type: string
    number: number
    status: string
    issueDate: Date
    dueDate: Date | null
    total: { toNumber(): number }
    createdAt: Date
    customer: { name: string; email: string | null } | null
    workOrder: { id: string; number: number; title: string } | null
  }
): DocumentListItem {
  const overdue =
    d.type === "INVOICE" &&
    d.status === "ISSUED" &&
    !!d.dueDate &&
    d.dueDate.getTime() < Date.now()
  return {
    id: d.id,
    type: d.type as DocumentType,
    number: d.number,
    status: d.status,
    customerName: d.customer?.name ?? null,
    customerEmail: d.customer?.email ?? null,
    workOrderId: d.workOrder?.id ?? null,
    workOrderTitle: d.workOrder?.title ?? null,
    workOrderNumber: d.workOrder?.number ?? null,
    issueDate: d.issueDate.toISOString(),
    dueDate: d.dueDate?.toISOString() ?? null,
    total: d.total.toNumber(),
    overdue,
    createdAt: d.createdAt.toISOString(),
  }
}

const DOC_TYPES = ["QUOTE", "INVOICE"] as const

function computeStats(
  docs: { type: string; status: string; dueDate: Date | null; total: { toNumber(): number } }[]
): DocumentsStats {
  const now = Date.now()
  const stats: DocumentsStats = {
    quotesDraft: 0,
    quotesSent: 0,
    quotesAccepted: 0,
    quotesRejected: 0,
    invoicesDraft: 0,
    invoicesIssued: 0,
    invoicesUnpaid: 0,
    invoicesPaid: 0,
    unpaidTotal: 0,
    overdueCount: 0,
  }
  for (const d of docs) {
    if (d.type === "QUOTE") {
      if (d.status === "DRAFT") stats.quotesDraft++
      if (d.status === "SENT") stats.quotesSent++
      if (d.status === "ACCEPTED") stats.quotesAccepted++
      if (d.status === "REJECTED") stats.quotesRejected++
    } else {
      if (d.status === "DRAFT") stats.invoicesDraft++
      if (d.status === "ISSUED") {
        stats.invoicesIssued++
        stats.unpaidTotal += d.total.toNumber()
        if (d.dueDate && d.dueDate.getTime() < now) stats.overdueCount++
      }
      if (d.status === "PAID") stats.invoicesPaid++
    }
  }
  return stats
}

/** Overview for the documents page: both types, stats, work-order picker. */
export async function getDocumentsOverview(): Promise<DocumentsOverview> {
  const { org } = await requireAdminOrg()

  const [docs, openWorkOrders] = await Promise.all([
    prisma.document.findMany({
      where: { organizationId: org.id, type: { in: [...DOC_TYPES] } },
      include: {
        customer: { select: { name: true, email: true } },
        workOrder: { select: { id: true, number: true, title: true } },
      },
      orderBy: [{ type: "asc" }, { number: "desc" }],
    }),
    prisma.workOrder.findMany({
      where: { organizationId: org.id, status: "OPEN" },
      select: { id: true, number: true, title: true },
      orderBy: { number: "desc" },
      take: 200,
    }),
  ])

  const quotes = docs.filter((d) => d.type === "QUOTE").map(serializeListItem)
  const invoices = docs.filter((d) => d.type === "INVOICE").map(serializeListItem)

  return {
    quotes,
    invoices,
    stats: computeStats(docs),
    openWorkOrders,
  }
}

/** Full detail of one document (org-scoped) — used by detail dialog + print. */
export async function getDocumentDetail(
  id: string
): Promise<DocumentDetail | null> {
  const { org } = await requireAdminOrg()

  const doc = await prisma.document.findFirst({
    where: { id, organizationId: org.id },
    include: {
      customer: true,
      workOrder: { select: { id: true, number: true, title: true, currentStageKey: true } },
      items: { orderBy: { position: "asc" } },
    },
  })
  if (!doc) return null

  return {
    id: doc.id,
    type: doc.type as DocumentType,
    number: doc.number,
    status: doc.status,
    issueDate: doc.issueDate.toISOString(),
    dueDate: doc.dueDate?.toISOString() ?? null,
    total: doc.total.toNumber(),
    notes: doc.notes,
    customer: doc.customer
      ? {
          id: doc.customer.id,
          name: doc.customer.name,
          email: doc.customer.email,
          phone: doc.customer.phone,
        }
      : null,
    workOrder: doc.workOrder
      ? {
          id: doc.workOrder.id,
          number: doc.workOrder.number,
          title: doc.workOrder.title,
          currentStageKey: doc.workOrder.currentStageKey,
        }
      : null,
    items: doc.items.map((it) => ({
      id: it.id,
      description: it.description,
      quantity: toNumber(it.quantity),
      unitPrice: it.unitPrice.toNumber(),
      total: it.total.toNumber(),
    })),
    createdAt: doc.createdAt.toISOString(),
  }
}

export interface CreateDocumentInput {
  type: DocumentType
  customerId?: string | null
  workOrderId?: string | null
  issueDate?: string | null
  dueDate?: string | null
  notes?: string | null
  items: DocumentLineInput[]
}

export interface DocumentActionResult {
  ok: boolean
  error?: string
  id?: string
}

function validateDocInput(
  input: CreateDocumentInput
): { ok: true; lines: DocumentLineInput[] } | { ok: false; error: string } {
  if (input.type !== "QUOTE" && input.type !== "INVOICE")
    return { ok: false, error: "INVALID_TYPE" }
  if (!input.items || input.items.length === 0)
    return { ok: false, error: "NO_ITEMS" }
  const lines: DocumentLineInput[] = []
  for (const it of input.items) {
    const description = it.description?.trim()
    if (!description) return { ok: false, error: "EMPTY_LINE" }
    if (!Number.isFinite(it.quantity) || it.quantity <= 0)
      return { ok: false, error: "INVALID_QUANTITY" }
    if (!Number.isFinite(it.unitPrice) || it.unitPrice < 0)
      return { ok: false, error: "INVALID_PRICE" }
    lines.push({
      description,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
    })
  }
  return { ok: true, lines }
}

/** Create a quote or invoice in DRAFT. Number = max+1 per org AND type. */
export async function createDocument(
  input: CreateDocumentInput
): Promise<DocumentActionResult> {
  const { org } = await requireAdminOrg()
  const v = validateDocInput(input)
  if (!v.ok) return { ok: false, error: v.error }

  if (input.workOrderId) {
    const wo = await prisma.workOrder.findFirst({
      where: { id: input.workOrderId, organizationId: org.id },
      select: { id: true },
    })
    if (!wo) return { ok: false, error: "NOT_FOUND" }
  }
  if (input.customerId) {
    const c = await prisma.customer.findFirst({
      where: { id: input.customerId, organizationId: org.id },
      select: { id: true },
    })
    if (!c) return { ok: false, error: "NOT_FOUND" }
  }

  const created = await prisma.$transaction(async (tx) => {
    const max = await tx.document.aggregate({
      where: { organizationId: org.id, type: input.type },
      _max: { number: true },
    })
    const number = (max._max.number ?? 0) + 1
    return tx.document.create({
      data: {
        organizationId: org.id,
        type: input.type,
        number,
        status: "DRAFT",
        customerId: input.customerId || null,
        workOrderId: input.workOrderId || null,
        issueDate: input.issueDate ? new Date(input.issueDate) : new Date(),
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        notes: input.notes?.trim() || null,
        total: v.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0),
        items: {
          create: v.lines.map((l, i) => ({
            organizationId: org.id,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            total: l.quantity * l.unitPrice,
            position: i + 1,
          })),
        },
      },
    })
  })

  revalidatePath("/dashboard/documents")
  revalidatePath("/dashboard")
  return { ok: true, id: created.id }
}

const QUOTE_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SENT", "REJECTED", "CANCELLED"],
  SENT: ["ACCEPTED", "REJECTED"],
}

const INVOICE_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["ISSUED", "CANCELLED"],
  ISSUED: ["PAID", "CANCELLED"],
}

/**
 * Change document status with server-side transition validation.
 * Also accepts "CANCELLED" for either type (kept out of the maps
 * above for quotes only when already terminal).
 */
export async function changeDocumentStatus(
  id: string,
  status: string
): Promise<DocumentActionResult> {
  const { org } = await requireAdminOrg()

  const doc = await prisma.document.findFirst({
    where: { id, organizationId: org.id },
  })
  if (!doc) return { ok: false, error: "NOT_FOUND" }

  const allowed =
    doc.type === "QUOTE" ? QUOTE_TRANSITIONS : INVOICE_TRANSITIONS
  const next = allowed[doc.status] ?? []
  if (!next.includes(status)) return { ok: false, error: "INVALID_TRANSITION" }

  await prisma.document.update({
    where: { id: doc.id },
    data: { status },
  })

  revalidatePath("/dashboard/documents")
  revalidatePath("/dashboard")
  return { ok: true, id: doc.id }
}

/**
 * Convert an ACCEPTED quote into an INVOICE (DRAFT). The quote is
 * closed (status stays ACCEPTED — terminal); the invoice copies
 * customer, work-order link, notes and line items.
 */
export async function convertQuoteToInvoice(
  id: string
): Promise<DocumentActionResult> {
  const { org } = await requireAdminOrg()

  const quote = await prisma.document.findFirst({
    where: { id, organizationId: org.id, type: "QUOTE" },
    include: { items: { orderBy: { position: "asc" } } },
  })
  if (!quote) return { ok: false, error: "NOT_FOUND" }
  if (quote.status !== "ACCEPTED") return { ok: false, error: "NOT_ACCEPTED" }

  const created = await prisma.$transaction(async (tx) => {
    const max = await tx.document.aggregate({
      where: { organizationId: org.id, type: "INVOICE" },
      _max: { number: true },
    })
    const number = (max._max.number ?? 0) + 1
    return tx.document.create({
      data: {
        organizationId: org.id,
        type: "INVOICE",
        number,
        status: "DRAFT",
        customerId: quote.customerId,
        workOrderId: quote.workOrderId,
        issueDate: new Date(),
        dueDate: quote.dueDate,
        notes: quote.notes,
        total: quote.total,
        items: {
          create: quote.items.map((it) => ({
            organizationId: org.id,
            description: it.description,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            total: it.total,
            position: it.position,
          })),
        },
      },
    })
  })

  revalidatePath("/dashboard/documents")
  revalidatePath("/dashboard")
  return { ok: true, id: created.id }
}

/** Customers for the create dialog (org-scoped, minimal fields). */
export async function listDocumentCustomers(): Promise<
  { id: string; name: string; email: string | null }[]
> {
  const { org } = await requireAdminOrg()
  const customers = await prisma.customer.findMany({
    where: { organizationId: org.id },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
    take: 200,
  })
  return customers
}
