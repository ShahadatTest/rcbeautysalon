import type { MetadataRoute } from "next"

/**
 * robots.txt (SEO odkrivanje) — dovoli indeksiranje javnih strani,
 * blokira dashboard/API. Produkcija dobi pravi sitemap pointer.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ).replace(/\/+$/, "")

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/api/", "/my-appointments", "/settings", "/reset-password", "/verify-email"],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  }
}
