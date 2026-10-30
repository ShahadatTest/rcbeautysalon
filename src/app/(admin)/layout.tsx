import { AdminSidebar } from "@/components/admin/sidebar"
import { AdminHeader } from "@/components/admin/header"
import { AdminI18nProvider } from "@/lib/i18n/provider"
import { getLocaleFromCookies } from "@/lib/i18n/server"
import { getSessionOrg } from "@/lib/tenant"

export const dynamic = "force-dynamic"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocaleFromCookies()
  // Activity profile of the tenant — drives capability-gated navigation
  // and industry terminology across the dashboard (EPIC #1).
  const org = await getSessionOrg()
  const profileId = org?.vertical

  return (
    <AdminI18nProvider initialLocale={locale} profileId={profileId}>
      <div className="admin-sans-headings flex h-screen overflow-hidden bg-background">
        {/* Desktop Sidebar */}
        <AdminSidebar />

        {/* Main content area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <AdminHeader />
          <main className="flex-1 overflow-y-auto">
            <div className="container mx-auto p-4 sm:p-6 lg:p-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AdminI18nProvider>
  )
}
