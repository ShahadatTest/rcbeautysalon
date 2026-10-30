import type { Metadata } from "next"
import Link from "next/link"
import { XCircle, ArrowLeft } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getPublicSiteData } from "@/lib/public-site"
import { orgPath } from "@/lib/org-path"

export async function generateMetadata(): Promise<Metadata> {
  const site = await getPublicSiteData()
  const orgName = site?.org.name ?? "Salon"
  return {
    title: `Rezervacija preklicana | ${orgName}`,
    description: "Vaša rezervacija je bila preklicana",
  }
}

export default async function BookingCancelPage() {
  const site = await getPublicSiteData()
  const orgSlug = site?.org.slug ?? null

  return (
    <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-16">
      <Card className="mx-auto max-w-lg text-center">
        <CardHeader className="space-y-4">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <XCircle size={48} weight="regular" className="text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl">Rezervacija preklicana</CardTitle>
          <CardDescription className="text-base">
            Plačilo je bilo preklicano in termin ni bil ustvarjen.
            Brez skrbi — ni vam bilo bremenjeno nič.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Če ste med zaključkom nakupa naleteli na težave, nas kontaktirajte
            ali poskusite znova rezervirati.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg">
              <Link href={orgPath(orgSlug, "/services")}>
                <ArrowLeft size={20} className="mr-2" weight="regular" />
                Nazaj na storitve
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
