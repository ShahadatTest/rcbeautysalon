export type Locale = "sl" | "en"

export const locales: Locale[] = ["sl", "en"]

export const defaultLocale: Locale = "sl"

export const LOCALE_COOKIE = "rc_admin_locale"

export const localeLabels: Record<Locale, string> = {
  sl: "Slovenščina",
  en: "English",
}

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "sl" || value === "en"
}

/** Parse a cookie value into a Locale, falling back to the default. */
export function parseLocale(value: string | undefined | null): Locale {
  return isLocale(value) ? value : defaultLocale
}
