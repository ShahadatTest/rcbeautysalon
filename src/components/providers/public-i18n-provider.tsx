import { getLocaleFromCookies } from "@/lib/i18n/server"
import { AdminI18nProvider } from "@/lib/i18n/provider"

/**
 * i18n za javne najemniške strani (P1): enak cookie in slovar kot
 * nadzorna plošča — jezikovni preklopnik v navbarju deluje takoj.
 * Profil dejavnosti omogoča tudi terminologijo po panogi (term()).
 */
export async function PublicI18nProvider({
  org,
  children,
}: {
  org?: {
    vertical?: string | null
    secondaryVertical?: string | null
    profileOverrides?: unknown
  } | null
  children: React.ReactNode
}) {
  const locale = await getLocaleFromCookies()

  return (
    <AdminI18nProvider
      initialLocale={locale}
      profileId={org?.vertical ?? undefined}
      secondaryVertical={org?.secondaryVertical ?? null}
      profileOverrides={org?.profileOverrides}
    >
      {children}
    </AdminI18nProvider>
  )
}
