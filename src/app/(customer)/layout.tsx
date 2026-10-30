import { PublicNavbar } from "@/components/layouts/public-navbar"
import { getPublicOrg } from "@/lib/tenant"

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const org = await getPublicOrg()

  return (
    <>
      <PublicNavbar
        org={{
          slug: org?.slug ?? null,
          name: org?.name ?? "Salon",
          logo: org?.logo ?? null,
        }}
      />
      <main>{children}</main>
    </>
  )
}
