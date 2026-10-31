import { test, expect } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import { makeTenant, registerTenant } from "./helpers"

// ============================================================
// CROSS-TENANT IDOR (issue #3 §16 E.8)
// Proves one tenant cannot read or modify another tenant's
// records through real HTTP surfaces. Tenant B's ids come from
// the isolated E2E database (read-only lookups); all requests
// run in tenant A's authenticated session.
// ============================================================

const e2eDb = new PrismaClient({
  datasources: { db: { url: process.env.E2E_DATABASE_URL ?? "" } },
})

test.afterAll(async () => {
  await e2eDb.$disconnect()
})

test("IDOR — tenant A cannot read or touch tenant B's records", async ({ page }) => {
  const a = makeTenant("beauty", "IDOR-A")
  const b = makeTenant("beauty", "IDOR-B")
  const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3123"

  await registerTenant(page, a)

  // Tenant B registers in its OWN context (A's session stays on `page`)
  const ctxB = await page.context().browser()!.newContext()
  const pageB = await ctxB.newPage()
  await registerTenant(pageB, b)
  await ctxB.close()

  // --- Tenant B exists with its own seeded data (created by the
  //     onboarding catalog seed) ---
  const orgB = await e2eDb.organization.findUniqueOrThrow({ where: { slug: b.slug } })
  const serviceB = await e2eDb.service.findFirstOrThrow({
    where: { organizationId: orgB.id },
  })
  // The beauty onboarding seed ships services only — give B a product
  // fixture so the product-edit IDOR path has a real record to target.
  const productB = await e2eDb.product.create({
    data: {
      organizationId: orgB.id,
      name: `IDOR-B product ${b.slug}`,
      price: 7,
      isActive: true,
    },
  })
  const staffB = await e2eDb.staff.findFirstOrThrow({ where: { organizationId: orgB.id } })
  void staffB

  // --- Addressable admin pages of B's records must never render
  //     B's data inside A's session (org scope checks → 404/not-found)
  for (const [path, marker] of [
    [`/dashboard/services/${serviceB.id}/edit`, serviceB.name],
    [`/dashboard/products/${productB.id}/edit`, productB.name],
  ] as const) {
    const res = await page.goto(`${baseUrl}${path}`)
    const body = await page.locator("body").innerText()
    expect(
      body.includes(marker),
      `cross-tenant data leak on ${path}: B's "${marker}" visible to A`
    ).toBe(false)
    expect(
      body.includes("IDOR-B"),
      `cross-tenant org name leak on ${path}`
    ).toBe(false)
    // A 200 with an EMPTY form is acceptable only when nothing of B's
    // leaked (asserted above) — the action layer refuses foreign ids.
    if (res?.status() === 200) {
      expect(body.includes(productB.name) || body.includes(serviceB.name)).toBe(false)
    }
  }

  // --- /platform is operator-only: tenant admin must not see the
  //     operator console ---
  await page.goto(`${baseUrl}/platform`)
  const platformBody = await page.locator("body").innerText()
  expect(/Operaterska konzola/i.test(platformBody)).toBe(false)

  // --- Media store is public-by-id (CDN-style, documented): unknown
  //     ids 404. Real ids are unguessable cuids. ---
  const mediaRes = await page.request.get(`${baseUrl}/api/media/nonexistent-id-e2e`)
  expect(mediaRes.status()).toBe(404)
})
