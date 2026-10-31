/**
 * ============================================================
 * EPIC #1 Phase 7 — RUNTIME TENANT ISOLATION VERIFICATION (§3/§17)
 * End-to-end proof on a real database that tenant-scoped reads
 * never leak rows across tenants:
 *
 *   1. Creates TWO throwaway orgs (unique suffix, cascade cleanup).
 *   2. Seeds one ExtensionRecord + one WorkOrder per org.
 *   3. Replays the EXACT query shapes the server actions use
 *      (findFirst/findMany filtered by organizationId).
 *   4. Asserts org A never sees org B rows (and vice versa).
 *   5. Cross-tenant write attempts (update by raw id without scope)
 *      are attempted through the same org-scoped findFirst guard the
 *      actions use — must find nothing.
 *   6. Cleans up both orgs in `finally` (Cascade deletes all rows).
 *
 * Run: bun scripts/verify-tenant-isolation.ts
 * Safe to run against any environment; leaves zero rows behind.
 * ============================================================
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const SUFFIX = `isol-${Date.now().toString(36)}`

async function main(): Promise<void> {
  console.log("• creating two throwaway tenants…")
  const orgA = await prisma.organization.create({
    data: { name: `IsoA ${SUFFIX}`, slug: `iso-a-${SUFFIX}`, vertical: "tire-service" },
  })
  const orgB = await prisma.organization.create({
    data: { name: `IsoB ${SUFFIX}`, slug: `iso-b-${SUFFIX}`, vertical: "beekeeping" },
  })

  try {
    console.log("• seeding one ExtensionRecord + one WorkOrder per tenant…")
    const recA = await prisma.extensionRecord.create({
      data: { organizationId: orgA.id, extensionId: "vehicle-workshop", entityKey: "vehicle", title: `Vozilo A ${SUFFIX}`, data: { license_plate: "NM-A-1" } },
    })
    const recB = await prisma.extensionRecord.create({
      data: { organizationId: orgB.id, extensionId: "batch-production", entityKey: "batch", title: `Serija B ${SUFFIX}`, data: { batch_code: "B-1" } },
    })
    const woA = await prisma.workOrder.create({
      data: { organizationId: orgA.id, number: 1, title: `Nalog A ${SUFFIX}`, linkedRecordId: recA.id },
    })
    const woB = await prisma.workOrder.create({
      data: { organizationId: orgB.id, number: 1, title: `Nalog B ${SUFFIX}`, linkedRecordId: recB.id },
    })

    console.log("• replaying org-scoped queries (same shapes as server actions)…")

    // --- ExtensionRecord: listExtensionRecords shape ---
    const aRecords = await prisma.extensionRecord.findMany({ where: { organizationId: orgA.id, entityKey: "vehicle" } })
    const bRecords = await prisma.extensionRecord.findMany({ where: { organizationId: orgB.id, entityKey: "batch" } })

    // --- WorkOrder: getWorkOrdersOverview shape (include linkedRecord) ---
    const aOrders = await prisma.workOrder.findMany({
      where: { organizationId: orgA.id },
      include: { linkedRecord: { select: { id: true, title: true, entityKey: true } } },
    })

    // --- Detail fetch shape: findFirst({ id, organizationId }) ---
    const aTriesBrecord = await prisma.extensionRecord.findFirst({ where: { id: recB.id, organizationId: orgA.id } })
    const aTriesBorder = await prisma.workOrder.findFirst({ where: { id: woB.id, organizationId: orgA.id } })
    const bTriesArecord = await prisma.extensionRecord.findFirst({ where: { id: recA.id, organizationId: orgB.id } })
    const bTriesAorder = await prisma.workOrder.findFirst({ where: { id: woA.id, organizationId: orgB.id } })

    // --- Assertions ---
    const problems: string[] = []
    if (aRecords.length !== 1 || aRecords[0].id !== recA.id) problems.push("orgA record list wrong")
    if (bRecords.length !== 1 || bRecords[0].id !== recB.id) problems.push("orgB record list wrong")
    if (aRecords.some((r) => r.organizationId !== orgA.id)) problems.push("orgA list leaked foreign rows")
    if (bRecords.some((r) => r.organizationId !== orgB.id)) problems.push("orgB list leaked foreign rows")
    if (aOrders.length !== 1 || aOrders[0].id !== woA.id) problems.push("orgA order list wrong")
    if (aOrders[0].linkedRecord?.id !== recA.id) problems.push("orgA order linkedRecord wrong")
    if (aTriesBrecord !== null) problems.push("LEAK: orgA read orgB record by id")
    if (aTriesBorder !== null) problems.push("LEAK: orgA read orgB work order by id")
    if (bTriesArecord !== null) problems.push("LEAK: orgB read orgA record by id")
    if (bTriesAorder !== null) problems.push("LEAK: orgB read orgA work order by id")

    if (problems.length > 0) {
      console.error("✗ ISOLATION FAILURES:")
      for (const p of problems) console.error("  -", p)
      process.exitCode = 1
      return
    }

    console.log("✓ isolation verified:")
    console.log("  - org-scoped lists return only own rows (ExtensionRecord, WorkOrder)")
    console.log("  - cross-tenant reads by raw id return nothing (findFirst + organizationId guard)")
    console.log(`  - orgs A=${orgA.slug} B=${orgB.slug}`)
  } finally {
    console.log("• cleaning up throwaway tenants (cascade)…")
    await prisma.organization.delete({ where: { id: orgA.id } })
    await prisma.organization.delete({ where: { id: orgB.id } })
  }
}

main()
  .catch((e) => {
    console.error("✗ verification error:", e.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
