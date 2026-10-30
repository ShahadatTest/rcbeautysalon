"use client"

import { createContext, useContext, useMemo } from "react"

const CurrencyContext = createContext<string>("EUR")

export function CurrencyProvider({
  currency,
  children,
}: {
  currency: string
  children: React.ReactNode
}) {
  return (
    <CurrencyContext.Provider value={currency || "EUR"}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useOrgCurrency(): string {
  return useContext(CurrencyContext)
}

/** Org-aware price formatter for client components. */
export function useFormatPrice() {
  const currency = useOrgCurrency()
  return useMemo(() => {
    const fmt = (amount: number | string | null | undefined): string => {
      const n = Number(amount ?? 0)
      if (Number.isNaN(n)) return `${amount}`
      try {
        return new Intl.NumberFormat("sl-SI", {
          style: "currency",
          currency,
        }).format(n)
      } catch {
        return `${n.toFixed(2)} ${currency}`
      }
    }
    return fmt
  }, [currency])
}
