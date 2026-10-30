import { AdminI18nProvider } from "@/lib/i18n/provider"
import { getLocaleFromCookies } from "@/lib/i18n/server"

export const dynamic = "force-dynamic"

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocaleFromCookies()

  return (
    <AdminI18nProvider initialLocale={locale}>{children}</AdminI18nProvider>
  )
}
