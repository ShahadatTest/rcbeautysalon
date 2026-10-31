import { getLocaleFromCookies } from "@/lib/i18n/server"
import { getPlatformLabels } from "@/lib/platform/labels"
import { isPlatformAdminEmail, PLATFORM_ADMIN_EMAILS_ENV } from "@/lib/platform/access"
import { PlatformHeader } from "@/components/platform/platform-header"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth/auth"

export const dynamic = "force-dynamic"

// ============================================================
// (platform) ROUTE GROUP LAYOUT (EPIC #3 E3-5)
// A deliberately SEPARATE surface from the tenant admin
// ((admin)/dashboard): its own chrome, its own guard. The layout
// authoritatively re-checks the operator allowlist — the proxy
// redirect is only a UX convenience.
// ============================================================

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  const email = session?.user?.email ?? null
  if (!isPlatformAdminEmail(email, process.env[PLATFORM_ADMIN_EMAILS_ENV])) {
    redirect("/")
  }

  const locale = await getLocaleFromCookies()
  const labels = getPlatformLabels(locale)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PlatformHeader labels={labels} operatorEmail={email ?? ""} />
      <main className="flex-1">
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  )
}
