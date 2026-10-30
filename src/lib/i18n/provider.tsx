"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { useRouter } from "next/navigation"
import { LOCALE_COOKIE, Locale, localeLabels, locales } from "./config"
import { Dictionary, getDictionary } from "./dictionaries"

interface I18nContextValue {
  locale: Locale
  t: Dictionary
  setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nContextValue | null>(null)

interface AdminI18nProviderProps {
  initialLocale: Locale
  children: React.ReactNode
}

export function AdminI18nProvider({
  initialLocale,
  children,
}: AdminI18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)
  const router = useRouter()

  // Keep client state in sync when the server re-renders with a new cookie value.
  useEffect(() => {
    setLocaleState(initialLocale)
  }, [initialLocale])

  const setLocale = useCallback(
    (next: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
      setLocaleState(next)
      router.refresh()
    },
    [router]
  )

  const value = useMemo<I18nContextValue>(
    () => ({ locale, t: getDictionary(locale), setLocale }),
    [locale, setLocale]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error("useI18n must be used within <AdminI18nProvider>")
  }
  return ctx
}

export { localeLabels, locales }
