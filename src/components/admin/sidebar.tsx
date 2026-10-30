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
import {
  LayoutDashboardIcon,
  ChartBarIcon,
  CalendarIcon,
  UsersIcon,
  ScissorsIcon,
  PackageIcon,
  ShoppingBagIcon,
  UserCogIcon,
  SettingsIcon,
  CloseIcon,
} from "@/components/icons"

const navigation = [
  { nameKey: "dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
  { nameKey: "analytics", href: "/dashboard/analytics", icon: ChartBarIcon },
  { nameKey: "appointments", href: "/dashboard/appointments", icon: CalendarIcon },
  { nameKey: "customers", href: "/dashboard/users", icon: UsersIcon },
  { nameKey: "services", href: "/dashboard/services", icon: ScissorsIcon },
  { nameKey: "products", href: "/dashboard/products", icon: PackageIcon },
  { nameKey: "shopOrders", href: "/dashboard/orders", icon: ShoppingBagIcon },
  { nameKey: "staff", href: "/dashboard/staff", icon: UserCogIcon },
  { nameKey: "settings", href: "/dashboard/settings", icon: SettingsIcon },
] as const

interface SidebarNavProps {
  onNavigate?: () => void
}

function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname()
  const { t } = useI18n()

  return (
    <nav className="space-y-1 px-3">
      {navigation.map((item) => {
        const isActive = pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href))
        const IconComponent = item.icon
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
            {t.common.nav[item.nameKey]}
          </Link>
        )
      })}
    </nav>
  )
}

export function AdminSidebar() {
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
            RC Beauty Salon Admin
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
