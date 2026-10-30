/**
 * EPIC #1 Phase 3 backfill — materializes activity-profile assets
 * (FormDefinition + WorkflowDefinition + stages) for every existing
 * organization, based on its current profile id (org.vertical).
 *
 * Idempotent: definitions are upserted by (organizationId, key) and
 * existing owner edits are never clobbered. Safe to re-run.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." bun scripts/backfill-profile-assets.ts
 */

import { PrismaClient, Prisma } from "@prisma/client"
import { getProfile } from "../src/lib/profiles/registry"

const prisma = new PrismaClient()

async function main() {
  const orgs = await prisma.organization.findMany({
    select: { id: true, slug: true, name: true, vertical: true },
    orderBy: { createdAt: "asc" },
  })

  console.log(`Found ${orgs.length} organizations`)

  for (const org of orgs) {
    const profile = getProfile(org.vertical)
    let forms = 0
    let workflows = 0

    for (const form of profile.forms) {
      const existing = await prisma.formDefinition.findUnique({
        where: { organizationId_key: { organizationId: org.id, key: form.key } },
        select: { id: true },
      })
      if (!existing) {
        await prisma.formDefinition.create({
          data: {
            organizationId: org.id,
            key: form.key,
            name: form.name,
            description: form.description,
            version: 1,
            isActive: true,
            fields: form.fields as unknown as Prisma.InputJsonValue,
          },
        })
        forms++
      }
    }

    for (const wf of profile.workflows) {
      const existing = await prisma.workflowDefinition.findUnique({
        where: { organizationId_key: { organizationId: org.id, key: wf.key } },
        select: { id: true },
      })
      if (!existing) {
        await prisma.workflowDefinition.create({
          data: {
            organizationId: org.id,
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
        })
        workflows++
      }
    }

    await prisma.organization.update({
      where: { id: org.id },
      data: { profileVersion: `v${profile.version}` },
    })

    console.log(
      `  ✓ ${org.slug} (${org.vertical}) → profile ${profile.id} v${profile.version}: +${forms} forms, +${workflows} workflows`
    )
  }

  console.log("Backfill complete.")
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
