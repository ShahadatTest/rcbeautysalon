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
import { getProfile, term as profileTerm } from "@/lib/profiles/registry"
import type { ActivityProfile } from "@/lib/profiles/types"

interface I18nContextValue {
  locale: Locale
  t: Dictionary
  /** Resolved activity profile of the tenant (EPIC #1). */
  profile: ActivityProfile
  /** Terminology lookup: industry-specific label for the current locale. */
  term: (key: keyof ActivityProfile["terminology"]) => string
  setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nContextValue | null>(null)

interface AdminI18nProviderProps {
  initialLocale: Locale
  /** Activity profile id of the current tenant's organization. */
  profileId?: string
  children: React.ReactNode
}

export function AdminI18nProvider({
  initialLocale,
  profileId,
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

  const value = useMemo<I18nContextValue>(() => {
    const profile = getProfile(profileId)
    return {
      locale,
      t: getDictionary(locale),
      profile,
      term: (key) => profileTerm(profile, key, locale),
      setLocale,
    }
  }, [locale, setLocale, profileId])

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
