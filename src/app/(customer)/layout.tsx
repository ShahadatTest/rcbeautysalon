import { PublicNavbar } from "@/components/layouts/public-navbar"
import { getPublicOrg } from "@/lib/tenant"
import { resolvePublicCta } from "@/lib/public-cta"

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const org = await getPublicOrg()
  const cta = resolvePublicCta(org?.vertical)

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
