import { headers } from "next/headers"
import { PublicNavbar } from "@/components/layouts/public-navbar"
import { getPublicOrg, ORG_HEADER } from "@/lib/tenant"
import { resolvePublicCta } from "@/lib/public-cta"
import { resolvePublishGate } from "@/lib/publish-gate"
import { MaintenanceScreen } from "@/components/public/maintenance-screen"

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const org = await getPublicOrg()

  // Suspension gate (EPIC #3 E3-5): a SPECIFIC tenant site was requested
  // (/s/[slug]) but its org is unavailable (SUSPENDED or otherwise
  // inactive). Render the neutral maintenance screen — never another
  // tenant's content under this URL, not even for the owner.
  const slugHeader = (await headers()).get(ORG_HEADER)
  if (slugHeader && !org) {
    return <MaintenanceScreen />
  }

  // Publication gate (EPIC #3 E3-1): non-published tenants are private.
  // The owner/staff of THIS tenant still sees the full site as a preview,
  // with a clear banner; everyone else gets a neutral maintenance screen
  // (no tenant data is leaked — not even the business name).
  const gate = await resolvePublishGate(org)
  if (org && gate !== "published") {
    if (gate === "hidden") {
      return <MaintenanceScreen />
    }
    return (
      <>
        <PublicNavbar
          org={{
            slug: org.slug,
            name: org.name,
            logo: org.logo,
          }}
          cta={null}
        />
        <div className="bg-amber-100 text-amber-950 border-b border-amber-200 px-4 py-2 text-center text-sm font-medium dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Predogled — ta stran še ni objavljena. Obiščevalci vidijo vzdrževalno
          stran, dokler je ne objavite v nastavitvah.
        </div>
        <main>{children}</main>
      </>
    )
  }

  const cta = resolvePublicCta(org?.vertical, "sl", org?.profileOverrides)

  return (
    <>
      <PublicNavbar
        org={{
          slug: org?.slug ?? null,
          name: org?.name ?? "Salon",
          logo: org?.logo ?? null,
        }}
        cta={cta.enabled ? { label: cta.label, href: cta.href } : null}
      />
      <main>{children}</main>
    </>
  )
}
