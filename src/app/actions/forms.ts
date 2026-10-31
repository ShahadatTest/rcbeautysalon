"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireAdminOrg, requirePublicOrg } from "@/lib/tenant"
import { validateFieldValues } from "@/lib/field-validation"
import type { Prisma } from "@prisma/client"

// ============================================================
// DYNAMIC FORMS ENGINE (EPIC #1 §8 — Phase 4)
// FormDefinitions are materialized per-tenant from the activity
// profile (copy-on-write). This module serves:
//   • the PUBLIC side: listing active forms for a tenant site and
//     accepting guest submissions with server-side validation of
//     every field (type, required, options) against the definition;
//   • the ADMIN side: submissions inbox (NEW → IN_REVIEW →
//     PROCESSED), definition activation toggle, and conversion of
//     a submission into a work order (for work-order profiles).
// Polymorphic context (contextType/contextId) keeps the universal
// core independent of which entity a form belongs to.
// ============================================================

export interface PublicFormField {
  key: string
  label: string
  type: string
  required: boolean
  options?: string[]
  unit?: string
  placeholder?: string
}

export interface PublicFormDefinition {
  id: string
  key: string
  name: string
  description: string | null
  fields: PublicFormField[]
}

export interface PublicSubmissionContact {
  name?: string
  email?: string
  phone?: string
}

export interface SubmitFormResult {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

export interface AdminFormDefinition {
  id: string
  key: string
  name: string
  description: string | null
  isActive: boolean
  version: number
  fields: PublicFormField[]
  submissionCount: number
  createdAt: string
}

export interface AdminFormSubmission {
  id: string
  formDefinitionId: string
  formName: string
  formKey: string
  status: string
  data: Record<string, unknown>
  contact: PublicSubmissionContact
  customerId: string | null
  customerName: string | null
  createdAt: string
}

/** Parse the fields JSON defensively (tolerates legacy/damaged rows). */
function parseFields(raw: unknown): PublicFormField[] {
  if (!Array.isArray(raw)) return []
  const out: PublicFormField[] = []
  for (const f of raw) {
    if (!f || typeof f !== "object") continue
    const o = f as Record<string, unknown>
    if (typeof o.key !== "string" || typeof o.label !== "string") continue
    out.push({
      key: o.key,
      label: o.label,
      type: typeof o.type === "string" ? o.type : "text",
      required: o.required === true,
      options: Array.isArray(o.options) ? (o.options as string[]) : undefined,
      unit: typeof o.unit === "string" ? o.unit : undefined,
      placeholder: typeof o.placeholder === "string" ? o.placeholder : undefined,
    })
  }
  return out
}

/** Public: active form definitions of the tenant the request resolves to. */
export async function getPublicForms(): Promise<PublicFormDefinition[]> {
  const org = await requirePublicOrg()
  const defs = await prisma.formDefinition.findMany({
    where: { organizationId: org.id, isActive: true },
    orderBy: { createdAt: "asc" },
  })
  return defs.map((d) => ({
    id: d.id,
    key: d.key,
    name: d.name,
    description: d.description,
    fields: parseFields(d.fields),
  }))
}

/**
 * Validate submitted values against a field definition.
 * Shared pure implementation (src/lib/field-validation.ts) — the
 * same logic guards every dynamic surface (§8 single source).
 */
function validateValues(
  fields: PublicFormField[],
  values: Record<string, unknown>
): { errors: Record<string, string>; clean: Record<string, unknown> } {
  return validateFieldValues(fields, values)
}

/** Find-or-create a tenant customer from guest contact details. */
async function findOrCreateCustomer(
  orgId: string,
  contact: PublicSubmissionContact
): Promise<string | null> {
  const email = contact.email?.trim().toLowerCase() || null
  const phone = contact.phone?.trim() || null
  if (!email && !phone) return null

  const orConditions: Prisma.CustomerWhereInput[] = []
  if (email) orConditions.push({ email })
  if (phone) orConditions.push({ phone })
  const existing = await prisma.customer.findFirst({
    where: {
      organizationId: orgId,
      OR: orConditions,
    },
    select: { id: true },
  })
  if (existing) return existing.id

  const name = contact.name?.trim() || email || phone || "Stranka"
  const created = await prisma.customer.create({
    data: {
      organizationId: orgId,
      name,
      email,
      phone,
      notes: "Ustvarjeno iz javnega obrazca (povpraševanje).",
    },
    select: { id: true },
  })
  return created.id
}

/**
 * PUBLIC: accept a guest submission for one of the tenant's active
 * forms. Every value is validated server-side against the stored
 * field definition — the client can never inject unknown fields.
 */
export async function submitPublicForm(
  formKey: string,
  values: Record<string, unknown>,
  contact: PublicSubmissionContact
): Promise<SubmitFormResult> {
  const org = await requirePublicOrg()

  const def = await prisma.formDefinition.findFirst({
    where: { organizationId: org.id, key: formKey, isActive: true },
  })
  if (!def) return { ok: false, error: "FORM_NOT_FOUND" }

  const fields = parseFields(def.fields)
  const { errors, clean } = validateValues(fields, values)
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "VALIDATION", fieldErrors: errors }
  }

  const customerId = await findOrCreateCustomer(org.id, contact)

  await prisma.formSubmission.create({
    data: {
      organizationId: org.id,
      formDefinitionId: def.id,
      status: "NEW",
      data: {
        ...clean,
        _contact: {
          name: contact.name?.trim().slice(0, 200) || null,
          email: contact.email?.trim().slice(0, 200) || null,
          phone: contact.phone?.trim().slice(0, 60) || null,
        },
      } as unknown as Prisma.InputJsonValue,
      customerId,
    },
  })

  return { ok: true }
}

// ------------------------------------------------------------
// Admin side
// ------------------------------------------------------------

/** Admin: definitions + submission counts for the forms page. */
export async function listFormDefinitions(): Promise<AdminFormDefinition[]> {
  const { org } = await requireAdminOrg()
  const defs = await prisma.formDefinition.findMany({
    where: { organizationId: org.id },
    include: { _count: { select: { submissions: true } } },
    orderBy: { createdAt: "asc" },
  })
  return defs.map((d) => ({
    id: d.id,
    key: d.key,
    name: d.name,
    description: d.description,
    isActive: d.isActive,
    version: d.version,
    fields: parseFields(d.fields),
    submissionCount: d._count.submissions,
    createdAt: d.createdAt.toISOString(),
  }))
}

/** Admin: submissions inbox (org-scoped, newest first). */
export async function listFormSubmissions(): Promise<AdminFormSubmission[]> {
  const { org } = await requireAdminOrg()
  const subs = await prisma.formSubmission.findMany({
    where: { organizationId: org.id },
    include: {
      formDefinition: { select: { name: true, key: true } },
      customer: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  })
  return subs.map((s) => {
    let data: Record<string, unknown> = {}
    if (s.data && typeof s.data === "object") data = s.data as Record<string, unknown>
    const { _contact, ...values } = data
    return {
      id: s.id,
      formDefinitionId: s.formDefinitionId,
      formName: s.formDefinition.name,
      formKey: s.formDefinition.key,
      status: s.status,
      data: values,
      contact: (_contact ?? {}) as PublicSubmissionContact,
      customerId: s.customerId,
      customerName: s.customer?.name ?? null,
      createdAt: s.createdAt.toISOString(),
    }
  })
}

/** Admin: move a submission through the review pipeline. */
export async function setSubmissionStatus(
  id: string,
  status: "NEW" | "IN_REVIEW" | "PROCESSED"
): Promise<{ ok: boolean }> {
  const { org } = await requireAdminOrg()
  const sub = await prisma.formSubmission.findFirst({
    where: { id, organizationId: org.id },
    select: { id: true },
  })
  if (!sub) return { ok: false }
  await prisma.formSubmission.update({ where: { id }, data: { status } })
  revalidatePath("/dashboard/forms")
  revalidatePath("/dashboard")
  return { ok: true }
}

/** Admin: activate/deactivate a tenant-owned form definition. */
export async function toggleFormDefinition(
  id: string,
  isActive: boolean
): Promise<{ ok: boolean }> {
  const { org } = await requireAdminOrg()
  const def = await prisma.formDefinition.findFirst({
    where: { id, organizationId: org.id },
    select: { id: true },
  })
  if (!def) return { ok: false }
  await prisma.formDefinition.update({ where: { id }, data: { isActive } })
  revalidatePath("/dashboard/forms")
  return { ok: true }
}

// ------------------------------------------------------------
// Form definition editor (EPIC #1 §8 — Phase 5, owner customization)
// ------------------------------------------------------------

export interface UpdateFormResult {
  ok: boolean
  error?: string
}

const fieldSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(60)
    // Letters/digits with inner separators (dash or underscore) —
    // materialized profile keys use underscores (e.g. garment_type).
    .regex(/^[a-z0-9]+([_-][a-z0-9]+)*$/, "KEY_FORMAT"),
  label: z.string().min(1).max(120),
  type: z.enum(["text", "textarea", "number", "date", "select", "checkbox"]),
  required: z.boolean(),
  options: z.array(z.string().min(1).max(120)).max(30).optional(),
  unit: z.string().max(20).optional(),
  placeholder: z.string().max(200).optional(),
})

const updateFormSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  fields: z.array(fieldSchema).min(1, "MIN_FIELDS").max(30, "MAX_FIELDS"),
})

/**
 * Owner edit of a materialized form definition (no code needed).
 * The definition is org-scoped (copy-on-write from the profile, so
 * editing never mutates the shared profile). Every field is validated
 * server-side; the version counter is bumped so owners can always see
 * which revision is live.
 */
export async function updateFormDefinition(
  id: string,
  input: { name?: string; fields: unknown }
): Promise<UpdateFormResult> {
  try {
    const { org } = await requireAdminOrg()
    const parsed = updateFormSchema.safeParse(input)
    if (!parsed.success) return { ok: false, error: "INVALID" }

    const { name, fields } = parsed.data

    // Unique field keys, select fields need ≥1 option.
    const keys = new Set<string>()
    for (const f of fields) {
      if (keys.has(f.key)) return { ok: false, error: "DUPLICATE_KEY" }
      keys.add(f.key)
      if (f.type === "select" && (!f.options || f.options.length === 0)) {
        return { ok: false, error: "SELECT_NEEDS_OPTIONS" }
      }
    }

    const def = await prisma.formDefinition.findFirst({
      where: { id, organizationId: org.id },
      select: { id: true, version: true },
    })
    if (!def) return { ok: false, error: "NOT_FOUND" }

    await prisma.formDefinition.update({
      where: { id: def.id },
      data: {
        ...(name ? { name } : {}),
        fields: fields as unknown as Prisma.InputJsonValue,
        version: def.version + 1,
      },
    })

    revalidatePath("/dashboard/forms")
    return { ok: true }
  } catch (error) {
    console.error("updateFormDefinition error:", error)
    return { ok: false, error: "GENERIC" }
  }
}

export interface CreateFromSubmissionResult {
  ok: boolean
  error?: string
  workOrderId?: string
}

/**
 * Admin: convert a public submission into a work order in the
 * tenant's active "order" workflow (seamstress: inquiry → …).
 * Links the order back to the submission, marks the submission
 * PROCESSED and attaches the customer when known.
 */
export async function createWorkOrderFromSubmission(
  submissionId: string
): Promise<CreateFromSubmissionResult> {
  const { org, session } = await requireAdminOrg()

  const sub = await prisma.formSubmission.findFirst({
    where: { id: submissionId, organizationId: org.id },
    include: { formDefinition: true },
  })
  if (!sub) return { ok: false, error: "NOT_FOUND" }

  const definition = await prisma.workflowDefinition.findFirst({
    where: { organizationId: org.id, isActive: true, entity: "order" },
    include: { stages: { orderBy: { order: "asc" } } },
  })
  if (!definition || definition.stages.length === 0) {
    return { ok: false, error: "NO_WORKFLOW" }
  }

  let data: Record<string, unknown> = {}
  if (sub.data && typeof sub.data === "object") {
    data = sub.data as Record<string, unknown>
  }
  const { _contact, ...values } = data
  const contact = (_contact ?? {}) as PublicSubmissionContact

  // Title: first meaningful select/text value, else the form name.
  const titleField = Object.entries(values).find(
    ([, v]) => typeof v === "string" && v.trim().length > 0 && v.length < 120
  )
  const title = titleField
    ? `${sub.formDefinition.name}: ${String(titleField[1]).slice(0, 80)}`
    : sub.formDefinition.name

  const firstStage = definition.stages[0]
  const summary = Object.entries(values)
    .slice(0, 12)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(" | ")

  const created = await prisma.$transaction(async (tx) => {
    const max = await tx.workOrder.aggregate({
      where: { organizationId: org.id },
      _max: { number: true },
    })
    return tx.workOrder.create({
      data: {
        organizationId: org.id,
        number: (max._max.number ?? 0) + 1,
        title,
        status: "OPEN",
        priority: "NORMAL",
        notes: contact.email || contact.phone
          ? `Kontakt: ${contact.name ?? ""} ${contact.email ?? ""} ${contact.phone ?? ""}\n\n${summary}`
          : summary,
        customerId: sub.customerId,
        workflowDefinitionId: definition.id,
        currentStageKey: firstStage.key,
        sourceSubmissionId: sub.id,
        events: {
          create: {
            organizationId: org.id,
            type: "CREATED",
            toStageKey: firstStage.key,
            message: `Iz oddaje obrazca «${sub.formDefinition.name}»`,
            actorEmail: session.user?.email ?? null,
          },
        },
      },
    })
  })

  await prisma.formSubmission.update({
    where: { id: sub.id },
    data: { status: "PROCESSED" },
  })

  revalidatePath("/dashboard/forms")
  revalidatePath("/dashboard/work-orders")
  revalidatePath("/dashboard")
  return { ok: true, workOrderId: created.id }
}
