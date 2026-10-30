// ============================================================
// PROFILE MATERIALIZATION (EPIC #1 §4) — copies profile form/
// workflow templates into per-tenant DB definitions (copy-on-
// write) so the owner can customize them without code and
// without mutating the shared profile.
// Server-only. Idempotent: upserts by (organizationId, key).
// ============================================================

import { prisma } from "@/lib/prisma"
import { getProfile } from "./registry"
import type { ActivityProfile } from "./types"

/** Materialize the profile's form + workflow templates for one org. */
export async function materializeProfileAssets(
  orgId: string,
  profileId: string
): Promise<{ profile: ActivityProfile; forms: number; workflows: number }> {
  const profile = getProfile(profileId)

  for (const form of profile.forms) {
    await prisma.formDefinition.upsert({
      where: { organizationId_key: { organizationId: orgId, key: form.key } },
      create: {
        organizationId: orgId,
        key: form.key,
        name: form.name,
        description: form.description,
        version: 1,
        isActive: true,
        fields: form.fields,
      },
      update: {
        // Never clobber owner edits: only create if missing (update is a no-op).
      },
    })
  }

  for (const wf of profile.workflows) {
    await prisma.workflowDefinition.upsert({
      where: { organizationId_key: { organizationId: orgId, key: wf.key } },
      create: {
        organizationId: orgId,
        key: wf.key,
        name: wf.name,
        entity: wf.entity,
        version: 1,
        isActive: true,
        stages: {
          create: wf.stages.map((s, i) => ({
            key: s.key,
            name: s.name,
            description: s.description,
            order: i,
            slaHours: s.slaHours,
            isFinal: !!s.isFinal,
          })),
        },
      },
      update: {
        // Same as forms: create-if-missing semantics.
      },
    })
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { profileVersion: `v${profile.version}` },
  })

  return { profile, forms: profile.forms.length, workflows: profile.workflows.length }
}

/** Ensure every active org has definitions for its current profile (backfill). */
export async function materializeForAllOrganizations(): Promise<
  { orgId: string; slug: string; vertical: string; forms: number; workflows: number }[]
> {
  const orgs = await prisma.organization.findMany({
    select: { id: true, slug: true, vertical: true },
  })
  const results: { orgId: string; slug: string; vertical: string; forms: number; workflows: number }[] = []
  for (const org of orgs) {
    const r = await materializeProfileAssets(org.id, org.vertical)
    results.push({ orgId: org.id, slug: org.slug, vertical: org.vertical, forms: r.forms, workflows: r.workflows })
  }
  return results
}
