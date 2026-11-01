import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { WarningCircleIcon, ArrowLeftIcon, CalendarIcon } from "@/components/icons"
import { getPublicOrg } from "@/lib/tenant"
import { orgPath } from "@/lib/org-path"

export default async function ServiceNotFound() {
  // not-found.tsx is a server component rendered inside the same request as
  // the page that threw notFound() — the org header is still available, so
  // links can stay inside the tenant's site (/s/{slug}/...). Null org
  // (unknown/suspended slug or bare platform route) falls back to bare paths.
  const org = await getPublicOrg()
  const orgSlug = org?.slug ?? null

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="container mx-auto px-4">
        <Card className="mx-auto max-w-2xl border-primary/20 text-center">
          <CardHeader className="space-y-4 pb-4">
            {/* Icon */}
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
              <WarningCircleIcon size={40} className="text-destructive" />
            </div>

            {/* Title */}
            <div>
              <CardTitle className="mb-2 text-3xl font-bold">
                Service Not Found
              </CardTitle>
              <CardDescription className="text-base">
                The service you&apos;re looking for doesn&apos;t exist or has been removed.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Suggestions */}
            <div className="rounded-lg bg-muted/50 p-4 text-left">
              <p className="mb-2 font-semibold">What you can do:</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Check the URL for typos</li>
                <li>• Browse our complete services catalog</li>
                <li>• Search for a similar service</li>
                <li>• Return to the homepage</li>
              </ul>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href={orgPath(orgSlug, "/services")} className="flex-1 sm:flex-initial">
                <Button
                  size="lg"
                  className="from-primary to-accent w-full bg-linear-to-r hover:opacity-90"
                >
                  <CalendarIcon size={20} className="mr-2" />
                  Browse All Services
                </Button>
              </Link>
              <Link href={orgPath(orgSlug, "/")} className="flex-1 sm:flex-initial">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary/50 hover:bg-primary/5 w-full"
                >
                  <ArrowLeftIcon size={20} className="mr-2" />
                  Back to Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
