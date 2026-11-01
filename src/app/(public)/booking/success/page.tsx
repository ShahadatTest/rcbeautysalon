import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { CheckCircle, CalendarCheck, House } from "@phosphor-icons/react/dist/ssr"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { verifyAndCreateAppointment } from "@/app/actions/stripe"
import { getPublicSiteData } from "@/lib/public-site"
import { orgPath } from "@/lib/org-path"

export async function generateMetadata(): Promise<Metadata> {
  const site = await getPublicSiteData()
  const orgName = site?.org.name ?? "Salon"
  return {
    title: `Rezervacija potrjena | ${orgName}`,
    description: "Vaš termin je bil uspešno rezerviran",
  }
}

async function BookingSuccessContent({
  sessionId,
  orgSlug,
}: {
  sessionId: string | null
  orgSlug: string | null
}) {
  if (!sessionId) {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <CardHeader>
          <CardTitle className="text-destructive">Neveljavna seja</CardTitle>
          <CardDescription>
            Plačilne seje ni bilo mogoče najti. Poskusite znova rezervirati termin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href={orgPath(orgSlug, "/services")}>Nazaj na storitve</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Verify payment and create appointment (works as fallback if webhook didn't fire)
  const result = await verifyAndCreateAppointment(sessionId)

  if (!result.success) {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <CardHeader>
          <CardTitle className="text-destructive">Plačilo ni bilo zaključeno</CardTitle>
          <CardDescription>
            {result.error || "Plačilo ni bilo zaključeno. Poskusite znova."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href={orgPath(orgSlug, "/services")}>Nazaj na storitve</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mx-auto max-w-lg text-center">
      <CardHeader className="space-y-4">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle size={48} weight="fill" className="text-green-600 dark:text-green-400" />
        </div>
        <CardTitle className="text-2xl">Rezervacija potrjena!</CardTitle>
        <CardDescription className="text-base">
          Vaš termin je bil uspešno rezerviran, polog pa je bremenjen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg bg-muted/50 p-4 text-sm">
          <p className="text-muted-foreground">
            Potrditveno e-poštno sporočilo smo poslali na{" "}
            <strong className="text-foreground">{result.customerEmail}</strong>{" "}
            z vsemi podrobnostmi vašega termina.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg">
            <Link href={orgPath(orgSlug, "/my-appointments")}>
              <CalendarCheck size={20} className="mr-2" weight="regular" />
              Moji termini
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={orgPath(orgSlug, "/")}>
              <House size={20} className="mr-2" weight="regular" />
              Nazaj domov
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default async function BookingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const params = await searchParams
  const sessionId = params.session_id || null
  const site = await getPublicSiteData()
  const orgSlug = site?.org.slug ?? null

  return (
    <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-16">
      <Suspense
        fallback={
          <Card className="mx-auto max-w-lg text-center">
            <CardContent className="py-12">
              <p className="text-muted-foreground">Preverjanje plačila...</p>
            </CardContent>
          </Card>
        }
      >
        <BookingSuccessContent sessionId={sessionId} orgSlug={orgSlug} />
      </Suspense>
    </div>
  )
}
