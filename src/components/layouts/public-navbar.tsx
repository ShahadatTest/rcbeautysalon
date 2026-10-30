"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/ui/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { MenuIcon, CloseIcon, UserIcon, LogoutIcon, CalendarCheckIcon, SettingsIcon, ReceiptIcon, UserCogIcon, StarIcon, SpinnerGapIcon } from "@/components/icons"
import { useNavigationStore } from "@/store/navigation-store"
import { NavCartButton } from "@/components/shop/nav-cart-button"
import { orgPath } from "@/lib/org-path"

interface NavLinkItem {
  href: string
  sectionId?: string
  label: string
}

interface PublicNavbarProps {
  org: { slug: string | null; name: string; logo: string | null }
}

export function PublicNavbar({ org }: PublicNavbarProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const { data: session, status } = useSession()
  const { activeSection } = useNavigationStore()

  const homeHref = orgPath(org.slug, "/")
  const navLinks: NavLinkItem[] = [
    { href: `${homeHref}#services`, sectionId: "services", label: "Storitve" },
    { href: `${homeHref}#about`, sectionId: "about", label: "O nas" },
    { href: `${homeHref}#team`, sectionId: "team", label: "Ekipa" },
    { href: `${homeHref}#shop`, sectionId: "shop", label: "Trgovina" },
    { href: `${homeHref}#contact`, sectionId: "contact", label: "Kontakt" },
  ]

  const isLoading = status === "loading"
  const isAuthenticated = !!session?.user

  const isActive = (link: NavLinkItem) => {
    // Home page
    if (link.href === homeHref) {
      return pathname === homeHref
    }

    // Hash links (like /#about, /#contact) - check active section from scroll
    if (link.sectionId) {
      return pathname === homeHref && activeSection === link.sectionId
    }

    // Regular routes like /services, /shop
    // Match exact path or any subpath (e.g., /services/haircut)
    if (pathname === link.href) return true
    if (pathname?.startsWith(link.href + "/")) return true

    return false
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-card/95 backdrop-blur-md shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href={homeHref} className="shrink-0">
          <Logo variant="navbar" src={org.logo} alt={org.name} />
        </Link>

        {/* Desktop Navigation - Shows at md (768px+) */}
        <nav className="hidden items-center gap-0.5 md:flex md:gap-1 lg:gap-2 xl:gap-3 2xl:gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-all px-2.5 py-1.5 rounded-md xl:px-3 xl:py-2 ${
                isActive(link)
                  ? "text-primary-foreground bg-primary shadow-sm"
                  : "text-foreground/70 hover:text-primary hover:bg-primary/10"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="flex items-center gap-1.5 xl:gap-2 ml-3 xl:ml-4 pl-3 xl:pl-4 border-l border-border/50">
            <ThemeToggle />
            <NavCartButton />
            {isLoading ? (
              <Button variant="ghost" disabled size="sm" className="w-10">
                <SpinnerGapIcon size={18} className="animate-spin" />
              </Button>
            ) : isAuthenticated ? (
              <DropdownMenu open={userMenuOpen} onOpenChange={setUserMenuOpen}>
                <Tooltip open={userMenuOpen ? false : undefined}>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-foreground/80 hover:bg-secondary hover:text-primary gap-1.5">
                        <UserIcon size={18} />
                        <span className="hidden 2xl:inline max-w-20 truncate">{session.user.name || "Account"}</span>
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Račun</p>
                  </TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" className="w-48">
                  {session.user.role === "ADMIN" && (
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard" className="flex items-center gap-2 cursor-pointer">
                        <SettingsIcon size={16} />
                        Nadzorna plošča
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {session.user.role === "STAFF" && (
                    <DropdownMenuItem asChild>
                      <Link href="/staff-portal" className="flex items-center gap-2 cursor-pointer">
                        <SettingsIcon size={16} />
                        Staff Portal
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {session.user.role === "CLIENTE" && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/my-account" className="flex items-center gap-2 cursor-pointer">
                          <UserCogIcon size={16} />
                          Moj račun
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/my-appointments" className="flex items-center gap-2 cursor-pointer">
                          <CalendarCheckIcon size={16} />
                          Moji termini
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/my-orders" className="flex items-center gap-2 cursor-pointer">
                          <ReceiptIcon size={16} />
                          Moja naročila
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/my-reviews" className="flex items-center gap-2 cursor-pointer">
                          <StarIcon size={16} />
                          Moje ocene
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogoutIcon size={16} />
                    Odjava
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/login">
                <Button variant="ghost" size="sm" className="text-foreground/80 hover:bg-secondary hover:text-primary">
                  Prijava
                </Button>
              </Link>
            )}
            <Link href={orgPath(org.slug, "/booking")}>
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md">
                Rezerviraj
              </Button>
            </Link>
          </div>
        </nav>

        {/* Mobile Menu Button - Shows below md (< 768px) */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <NavCartButton />
          <button
            className="text-foreground/70 hover:text-primary transition-colors p-2 -mr-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Preklopi meni"
          >
            {mobileMenuOpen ? (
              <CloseIcon size={24} weight="bold" />
            ) : (
              <MenuIcon size={24} weight="bold" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div className="border-t border-border/50 bg-card/95 backdrop-blur-md md:hidden">
          <nav className="container mx-auto flex flex-col gap-1 px-4 py-4 sm:py-6">
            {/* Navigation Links */}
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-col sm:gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-all px-3 py-2.5 rounded-md text-center sm:text-left ${
                    isActive(link)
                      ? "text-primary-foreground bg-primary shadow-sm"
                      : "text-foreground/70 hover:text-primary hover:bg-primary/10"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Divider */}
            <div className="my-3 border-t border-border/50" />

            {/* Auth Section */}
            {isLoading ? (
              <Button variant="ghost" disabled className="w-full h-11">
                <SpinnerGapIcon size={20} className="animate-spin" />
              </Button>
            ) : isAuthenticated ? (
              <div className="space-y-1">
                {/* User name header */}
                <div className="px-3 py-2 text-sm font-medium text-muted-foreground">
                  {session.user.name || "Račun"}
                </div>

                {session.user.role === "ADMIN" && (
                  <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full h-11 text-foreground/80 hover:bg-secondary hover:text-primary gap-2 justify-start">
                      <SettingsIcon size={18} />
                      Nadzorna plošča
                    </Button>
                  </Link>
                )}
                {session.user.role === "STAFF" && (
                  <Link href="/staff-portal" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="ghost" className="w-full h-11 text-foreground/80 hover:bg-secondary hover:text-primary gap-2 justify-start">
                      <SettingsIcon size={18} />
                      Staff Portal
                    </Button>
                  </Link>
                )}
                {session.user.role === "CLIENTE" && (
                  <>
                    <Link href="/my-account" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full h-11 text-foreground/80 hover:bg-secondary hover:text-primary gap-2 justify-start">
                        <UserCogIcon size={18} />
                        Moj račun
                      </Button>
                    </Link>
                    <Link href="/my-appointments" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full h-11 text-foreground/80 hover:bg-secondary hover:text-primary gap-2 justify-start">
                        <CalendarCheckIcon size={18} />
                        Moji termini
                      </Button>
                    </Link>
                    <Link href="/my-orders" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full h-11 text-foreground/80 hover:bg-secondary hover:text-primary gap-2 justify-start">
                        <ReceiptIcon size={18} />
                        Moja naročila
                      </Button>
                    </Link>
                    <Link href="/my-reviews" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="ghost" className="w-full h-11 text-foreground/80 hover:bg-secondary hover:text-primary gap-2 justify-start">
                        <StarIcon size={18} />
                        Moje ocene
                      </Button>
                    </Link>
                  </>
                )}
                <Button
                  variant="ghost"
                  className="w-full h-11 text-destructive hover:bg-destructive/10 gap-2 justify-start"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    signOut({ callbackUrl: "/" })
                  }}
                >
                  <LogoutIcon size={18} />
                  Odjava
                </Button>
              </div>
            ) : (
              <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full h-11 text-foreground/80 hover:bg-secondary hover:text-primary">
                  Prijava
                </Button>
              </Link>
            )}

            {/* Book Now Button */}
            <Link href={orgPath(org.slug, "/booking")} onClick={() => setMobileMenuOpen(false)} className="mt-2">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 w-full h-12 text-base">
                Rezerviraj
              </Button>
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}
