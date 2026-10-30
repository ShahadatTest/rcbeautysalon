"use client"

import { useSyncExternalStore } from "react"

export function useMediaQuery(query: string) {
  // useSyncExternalStore subscribes to the media query without a
  // setState-in-effect pass (React Compiler friendly).
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query)
      media.addEventListener("change", onChange)
      return () => media.removeEventListener("change", onChange)
    },
    () => window.matchMedia(query).matches,
    () => false
  )
}
