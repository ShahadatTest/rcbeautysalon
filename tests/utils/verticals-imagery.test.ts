import { existsSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { VERTICALS, verticalSiteContent } from "@/lib/verticals"

/**
 * EPIC #4 test imagery invariant: every preset service and product
 * ships with imagery, and every local preset path points at a file
 * that actually exists in /public — a missing asset would render as
 * a broken image on every newly onboarded tenant.
 */
describe("vertical preset imagery completeness", () => {
  const isLocalPreset = (url: string) => url.startsWith("/img/presets/")

  it("every service in every vertical has an imageUrl", () => {
    for (const v of VERTICALS) {
      for (const cat of v.categories) {
        for (const svc of cat.services) {
          expect(svc.imageUrl, `${v.id}/${cat.slug}/${svc.name} missing imageUrl`).toBeTruthy()
        }
      }
    }
  })

  it("every beekeeping product has an imageUrl", () => {
    const bee = VERTICALS.find((v) => v.id === "beekeeping")
    expect(bee?.products?.length).toBeGreaterThan(0)
    for (const p of bee!.products!) {
      expect(p.imageUrl, `beekeeping product ${p.name} missing imageUrl`).toBeTruthy()
    }
  })

  it("every imageUrl is an https URL or a local /img/presets/ path", () => {
    for (const v of VERTICALS) {
      for (const cat of v.categories) {
        for (const svc of cat.services) {
          const url = svc.imageUrl!
          const ok = url.startsWith("https://") || isLocalPreset(url)
          expect(ok, `${v.id}/${svc.name} unexpected imageUrl: ${url}`).toBe(true)
        }
      }
    }
    for (const p of VERTICALS.find((v) => v.id === "beekeeping")!.products!) {
      const url = p.imageUrl!
      expect(url.startsWith("https://") || isLocalPreset(url)).toBe(true)
    }
  })

  it("local preset paths point at files that exist in public/", () => {
    const publicDir = join(process.cwd(), "public")
    const urls: string[] = []
    for (const v of VERTICALS) {
      for (const cat of v.categories) {
        for (const svc of cat.services) {
          if (svc.imageUrl && isLocalPreset(svc.imageUrl)) urls.push(svc.imageUrl)
        }
      }
    }
    for (const p of VERTICALS.find((v) => v.id === "beekeeping")!.products!) {
      if (p.imageUrl && isLocalPreset(p.imageUrl)) urls.push(p.imageUrl)
    }
    for (const imagery of [verticalSiteContent("barber"), verticalSiteContent("seamstress"), verticalSiteContent("tire-service"), verticalSiteContent("beekeeping"), verticalSiteContent("massage"), verticalSiteContent("epilation")]) {
      for (const section of [imagery.hero, imagery.about, imagery.cta]) {
        if (section.imageUrl && isLocalPreset(section.imageUrl)) urls.push(section.imageUrl)
      }
    }
    expect(urls.length).toBeGreaterThan(10)
    for (const url of urls) {
      const file = join(publicDir, url)
      expect(existsSync(file), `missing preset asset: ${url}`).toBe(true)
    }
  })

  it("non-beauty verticals get vertical-specific hero imagery (no generic salon shot)", () => {
    for (const id of ["barber", "massage", "epilation", "seamstress", "tire-service", "beekeeping"]) {
      const content = verticalSiteContent(id)
      expect(content.hero.imageUrl?.startsWith("/img/presets/hero-"), `${id} hero not vertical-specific`).toBe(true)
    }
    // Beauty keeps its video hero; remaining profiles keep the salon shot.
    expect(verticalSiteContent("beauty").hero.videoUrl).toBeTruthy()
    expect(verticalSiteContent("nails").hero.imageUrl).toContain("cloudinary")
  })
})
