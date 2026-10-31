import { PublicNavbar } from "@/components/layouts/public-navbar"
import { getPublicOrg } from "@/lib/tenant"
import { resolvePublicCta } from "@/lib/public-cta"
import { resolvePublishGate } from "@/lib/publish-gate"
import { MaintenanceScreen } from "@/components/public/maintenance-screen"

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const org = await getPublicOrg()

  // Publication gate (EPIC #3 E3-1): same rule as the (public) layout —
  // drafts/unpublished tenants are private; owner sees a preview, everyone
  // else a neutral maintenance screen (also covers /shop and /inquiry).
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
