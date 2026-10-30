"use client"

import { useEffect } from "react"

/**
 * Scroll-spy titles per section. Generic salon labels — pass an
 * optional organization name to brand the document title.
 */
export function useScrollSpy(sectionIds: string[], orgName?: string) {
  useEffect(() => {
    const brand = orgName?.trim() || "Salon"

    const sectionTitle: Record<string, string> = {
      home: `${brand} | Domov`,
      services: `${brand} | Storitve`,
      shop: `${brand} | Trgovina`,
      about: `${brand} | O nas`,
      team: `${brand} | Ekipa`,
      contact: `${brand} | Kontakt`,
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("id")
            if (id) {
              // Update URL without reload
              history.replaceState(null, "", `#${id}`)

              // Dynamically change title
              const newTitle = sectionTitle[id] || brand
              if (document.title !== newTitle) {
                document.title = newTitle
              }
            }
            break
          }
        }
      },
      {
        rootMargin: "-50% 0px -50% 0px", // Activate when section is centered
        threshold: 0,
      }
    )

    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean)

    elements.forEach((el) => observer.observe(el!))

    return () => observer.disconnect()
  }, [sectionIds, orgName])
}
