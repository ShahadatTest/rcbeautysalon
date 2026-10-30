import { Button } from "@/components/ui/button"
import Link from "next/link"
import { CalendarIcon, ShoppingBagIcon } from "@/components/icons"
import { orgPath } from "@/lib/org-path"
import type { CtaLink } from "@/lib/site-content"

interface HeroActionsProps {
  primaryCta: CtaLink
  secondaryCta?: CtaLink | null
  orgSlug?: string | null
}

export function HeroActions({ primaryCta, secondaryCta, orgSlug }: HeroActionsProps) {
  const toHref = (href: string) =>
    href.startsWith("http") || !href.startsWith("/") ? href : orgPath(orgSlug, href)

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
      <Link href={toHref(primaryCta.href)}>
        <Button
          size="lg"
          className="from-primary to-primary/90 group w-full bg-linear-to-r text-white shadow-xl hover:opacity-90 sm:w-auto"
        >
          <CalendarIcon className="group-hover:text-accent mr-2 h-5 w-5 transition-colors" />
          {primaryCta.label}
        </Button>
      </Link>
      {secondaryCta && (
        <Link href={toHref(secondaryCta.href)}>
          <Button
            size="lg"
            variant="outline"
            className="hover:text-accent hover:border-accent/50 group w-full border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 sm:w-auto"
          >
            <ShoppingBagIcon className="group-hover:text-accent mr-2 h-5 w-5 transition-colors" />
            {secondaryCta.label}
          </Button>
        </Link>
      )}
    </div>
  )
}
