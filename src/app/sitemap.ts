import type { MetadataRoute } from "next"
import { prisma } from "@/lib/prisma"

/**
 * sitemap.xml (SEO odkrivanje) — javne strani vsake OBJAVLJENE organizacije.
 * Osnutki (draft) niso vključeni (niso indeksirani). Stabilni URL-ji:
 *  - /s/{slug}            (domača stran salona)
 *  - /s/{slug}/services   (storitve)
 *  - /s/{slug}/booking    (rezervacija)
 *  - /s/{slug}/shop       (trgovina)
 *  - /                    (platforma — prva objavljena org)
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ).replace(/\/+$/, "")

  const orgs = await prisma.organization
    .findMany({
      where: { status: "ACTIVE", publishState: "PUBLISHED" },
      orderBy: { createdAt: "asc" },
      select: { slug: true, updatedAt: true },
    })
    .catch(() => [])

  const publicPaths = ["", "/services", "/booking", "/shop"]
  const lastModified = new Date()

  const tenantEntries: MetadataRoute.Sitemap = orgs.flatMap((org) =>
    publicPaths.map((path) => ({
      url: `${appUrl}/s/${org.slug}${path}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
    }))
  )

  const bareRoot: MetadataRoute.Sitemap =
    orgs.length > 0
      ? [{ url: appUrl, lastModified, changeFrequency: "weekly", priority: 0.9 }]
      : []

  return [...bareRoot, ...tenantEntries]
}
