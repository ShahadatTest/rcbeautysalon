import { cookies } from "next/headers"
import { LOCALE_COOKIE, Locale, parseLocale } from "./config"
import { getDictionary, getDateFnsLocale } from "./dictionaries"

/** Read the admin locale from cookies (server components / server actions). */
export async function getLocaleFromCookies(): Promise<Locale> {
  const store = await cookies()
  return parseLocale(store.get(LOCALE_COOKIE)?.value)
}

/** Convenience helper: locale + full dictionary for server components. */
export async function getServerI18n(): Promise<{
  locale: Locale
  t: ReturnType<typeof getDictionary>
  dateFnsLocale: ReturnType<typeof getDateFnsLocale>
}> {
  const locale = await getLocaleFromCookies()
  return { locale, t: getDictionary(locale), dateFnsLocale: getDateFnsLocale(locale) }
}
