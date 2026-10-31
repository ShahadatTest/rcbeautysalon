"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/ui/logo"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { LanguageSwitcher } from "@/components/admin/language-switcher"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useI18n } from "@/lib/i18n/provider"
import type { CapabilityKey } from "@/lib/profiles/types"
import {
  LayoutDashboardIcon,
  ChartBarIcon,
  CalendarIcon,
  UsersIcon,
  ScissorsIcon,
  PackageIcon,
  ToteIcon,
  ShoppingBagIcon,
  ReceiptIcon,
  FileTextIcon,
  SlidersIcon,
  StackIcon,
  UserCogIcon,
  SettingsIcon,
  CloseIcon,
  FolderIcon,
} from "@/components/icons"

interface NavItem {
  nameKey: "dashboard" | "analytics" | "appointments" | "customers" | "services" | "products" | "packages" | "shopOrders" | "workOrders" | "documents" | "forms" | "records" | "projects" | "staff" | "settings"
  href: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  /** Capability that must not be "disabled" for this item to render. */
  capability?: CapabilityKey
  /** Item renders when ANY of these capabilities is enabled (§11: packages combine services AND products). */
  anyCapabilities?: CapabilityKey[]
  /** Item renders only when the profile enables at least one extension with entities (§13). */
  requiresExtensions?: boolean
  /** Item renders only when the profile enables THIS extension id (E2-3: projects). */
  extension?: string
  /** Terminology key overriding the generic dictionary label. */
  termKey?: "appointmentPlural" | "servicePlural" | "productPlural" | "orderPlural"
}

const navigation: NavItem[] = [
  { nameKey: "dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
  { nameKey: "analytics", href: "/dashboard/analytics", icon: ChartBarIcon, capability: "analytics" },
  { nameKey: "appointments", href: "/dashboard/appointments", icon: CalendarIcon, capability: "appointments", termKey: "appointmentPlural" },
  { nameKey: "customers", href: "/dashboard/users", icon: UsersIcon, capability: "customers" },
  { nameKey: "services", href: "/dashboard/services", icon: ScissorsIcon, capability: "services", termKey: "servicePlural" },
  { nameKey: "products", href: "/dashboard/products", icon: PackageIcon, capability: "shop", termKey: "productPlural" },
  // Packages (bundles of services and/or products) — shown when either exists
  { nameKey: "packages", href: "/dashboard/packages", icon: ToteIcon, anyCapabilities: ["shop", "services"] },
  // Work orders (workflow-driven jobs) — terminology comes from the profile
  { nameKey: "workOrders", href: "/dashboard/work-orders", icon: ReceiptIcon, capability: "workOrders", termKey: "orderPlural" },
  // Documents (quotes/invoices) — gated by the documents capability (§13)
  { nameKey: "documents", href: "/dashboard/documents", icon: FileTextIcon, capability: "documents" },
  // E-commerce shop orders — generic label, only for shop-capable tenants
  { nameKey: "shopOrders", href: "/dashboard/orders", icon: ShoppingBagIcon, capability: "shop" },
  { nameKey: "forms", href: "/dashboard/forms", icon: SlidersIcon, capability: "forms" },
  // Extension entity registries (vehicles, batches, …) — §13, rendered
  // only when the profile enables extensions that contribute entities
  { nameKey: "records", href: "/dashboard/records", icon: StackIcon, requiresExtensions: true },
  // Projects & tasks (E2-3) — rendered only when the profile enables
  // the `projects` extension (runtime shipped in E2-3; other profiles
  // keep today's experience verbatim).
  { nameKey: "projects", href: "/dashboard/projects", icon: FolderIcon, extension: "projects" },
  { nameKey: "staff", href: "/dashboard/staff", icon: UserCogIcon, capability: "staff" },
  { nameKey: "settings", href: "/dashboard/settings", icon: SettingsIcon },
]

interface SidebarNavProps {
  onNavigate?: () => void
}

function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname()
  const { t, term, profile } = useI18n()

  // Capability-gated navigation (EPIC #1 §21): irrelevant modules never render.
  const visible = navigation.filter((item) => {
    if (item.extension) {
      return profile.extensions.includes(item.extension)
    }
    if (item.requiresExtensions) {
      return profile.extensions.length > 0
    }
    if (item.anyCapabilities?.length) {
      return item.anyCapabilities.some(
        (cap) => profile.capabilities[cap] !== "disabled"
      )
    }
    if (!item.capability) return true
    return profile.capabilities[item.capability] !== "disabled"
  })

  return (
    <nav className="space-y-1 px-3">
      {visible.map((item) => {
        const isActive = pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href))
        const IconComponent = item.icon
        // Industry terminology overrides the generic dictionary label.
        const label = item.termKey ? term(item.termKey) : t.common.nav[item.nameKey]
        return (
          <Link
            key={item.nameKey}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <IconComponent size={18} className={cn(isActive && "text-primary-foreground")} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

export function AdminSidebar() {
  const { t } = useI18n()
  return (
    <aside className="hidden w-64 shrink-0 bg-card shadow-sm lg:block">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Logo variant="sidebar" />
          </Link>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-4">
          <SidebarNav />
        </ScrollArea>

        {/* Footer */}
        <div className="space-y-2 p-4">
          <div className="flex justify-center">
            <LanguageSwitcher />
          </div>
          <p className="text-center text-xs text-muted-foreground">
            {t.common.platformTagline}
          </p>
        </div>
      </div>
    </aside>
  )
}

interface MobileSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileSidebar({ open, onOpenChange }: MobileSidebarProps) {
  const { t } = useI18n()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="flex h-16 flex-row items-center justify-between px-4">
          <SheetTitle className="flex items-center gap-2">
            <Logo variant="sidebar" />
          </SheetTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onOpenChange(false)}
          >
            <CloseIcon size={18} />
            <span className="sr-only">{t.common.header.closeMenu}</span>
          </Button>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-4rem)] py-4">
          <SidebarNav onNavigate={() => onOpenChange(false)} />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
