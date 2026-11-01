import {
  getPublicSiteData,
  getPublicFeaturedServices,
  getPublicFeaturedProducts,
  getPublicFeaturedStaff,
} from "@/lib/public-site"
import { HomeContent } from "@/components/landing/home-content"
import { resolveCtaLinks, resolveCtaSectionHref } from "@/lib/public-cta"
import { resolveEffectiveProfile } from "@/lib/profiles/resolve"

export default async function HomePage() {
  const site = await getPublicSiteData()

  if (!site) {
    return (
      <div className="container mx-auto flex min-h-[60vh] flex-col items-center justify-center px-4 py-24 text-center">
        <h1 className="text-3xl font-bold md:text-4xl">Salon ni konfiguriran</h1>
        <p className="text-muted-foreground mt-3 max-w-md">
          Ta stran še ni nastavljena. Če ste lastnik salona, se prijavite v
          nadzorno ploščo in dokončajte nastavitve.
        </p>
      </div>
    )
  }

  const { org, content } = site
  const [featuredServices, featuredProducts, featuredStaff] = await Promise.all([
    getPublicFeaturedServices(org.id),
    getPublicFeaturedProducts(org.id),
    getPublicFeaturedStaff(org.id),
  ])

  return (
    <HomeContent
      org={{ slug: org.slug, name: org.name, logo: org.logo }}
      content={content}
      ctaLinks={resolveCtaLinks(org.vertical, content, org.profileOverrides)}
      ctaSectionHref={resolveCtaSectionHref(org.vertical, content.cta.buttonHref, org.profileOverrides)}
      serviceCtaLabel={
        resolveEffectiveProfile(org).capabilities.appointments !== "disabled"
          ? "Rezerviraj"
          : "Poglej"
      }
      featuredServices={featuredServices}
      featuredProducts={featuredProducts}
      featuredStaff={featuredStaff}
      // Sections render only when their featured grid will have content —
      // a catalog that exists but has nothing featured would otherwise
      // render an empty grid with a bare button (EPIC #4 visual pass).
      hasServices={featuredServices.length > 0}
      hasProducts={featuredProducts.length > 0}
    />
  )
}
