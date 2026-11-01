import { auth } from "@/lib/auth/auth"
import { NextResponse } from "next/server"
import { isPlatformAdminEmail, PLATFORM_ADMIN_EMAILS_ENV } from "@/lib/platform/access"

const ORG_HEADER = "x-org-slug"

export default auth((req) => {
  const { pathname } = req.nextUrl

  // ---- TENANT RESOLUTION: /s/[slug]/* -> /* with x-org-slug header ----
  // Must run BEFORE role guards so rewritten public pages resolve the org.
  const orgMatch = pathname.match(/^\/s\/([^/]+)(\/.*)?$/)
  if (orgMatch) {
    const slug = orgMatch[1]
    if (req.headers.get(ORG_HEADER) !== slug) {
      const requestHeaders = new Headers(req.headers)
      requestHeaders.set(ORG_HEADER, slug)
      const url = req.nextUrl.clone()
      url.pathname = orgMatch[2] || "/"
      return NextResponse.rewrite(url, { request: { headers: requestHeaders } })
    }
  }

  const isLoggedIn = !!req.auth
  const userRole = req.auth?.user?.role

  // Route definitions
  const isAdminDashboard = pathname.startsWith("/dashboard")
  const isStaffPortal = pathname.startsWith("/staff-portal")
  const isClientArea = pathname.startsWith("/my-account")
  const isAuthPage = pathname === "/login" || pathname === "/register"

  // Platform Operator Console - env allowlist ONLY (EPIC #3 E3-5).
  // This is a UX redirect, not the security boundary: the layout
  // and every action re-check via requirePlatformAdmin().
  if (pathname.startsWith("/platform")) {
    if (!isLoggedIn) {
      const callbackUrl = encodeURIComponent(pathname)
      return NextResponse.redirect(
        new URL(`/login?callbackUrl=${callbackUrl}`, req.url)
      )
    }
    const operatorAllowed = isPlatformAdminEmail(
      req.auth?.user?.email ?? null,
      process.env[PLATFORM_ADMIN_EMAILS_ENV]
    )
    if (!operatorAllowed) {
      // Never expose the console to tenant users — route them to
      // their own surface instead of leaking that /platform exists.
      if (userRole === "ADMIN") {
        return NextResponse.redirect(new URL("/dashboard", req.url))
      }
      if (userRole === "STAFF") {
        return NextResponse.redirect(new URL("/staff-portal", req.url))
      }
      if (userRole === "CLIENTE") {
        return NextResponse.redirect(new URL("/my-account", req.url))
      }
      return NextResponse.redirect(new URL("/", req.url))
    }
  }

  // Admin Dashboard - ONLY ADMIN
  if (isAdminDashboard) {
    if (!isLoggedIn) {
      const callbackUrl = encodeURIComponent(pathname)
      return NextResponse.redirect(
        new URL(`/login?callbackUrl=${callbackUrl}`, req.url)
      )
    }
    if (userRole !== "ADMIN") {
      // Staff and clients redirected to their areas
      if (userRole === "STAFF") {
        return NextResponse.redirect(new URL("/staff-portal", req.url))
      }
      if (userRole === "CLIENTE") {
        return NextResponse.redirect(new URL("/my-account", req.url))
      }
      return NextResponse.redirect(new URL("/", req.url))
    }
  }

  // Staff Portal - STAFF and ADMIN
  if (isStaffPortal) {
    if (!isLoggedIn) {
      const callbackUrl = encodeURIComponent(pathname)
      return NextResponse.redirect(
        new URL(`/login?callbackUrl=${callbackUrl}`, req.url)
      )
    }
    if (userRole !== "STAFF" && userRole !== "ADMIN") {
      // Clients can't access staff portal
      if (userRole === "CLIENTE") {
        return NextResponse.redirect(new URL("/my-account", req.url))
      }
      return NextResponse.redirect(new URL("/", req.url))
    }
  }

  // Client Area - CLIENTE and ADMIN
  if (isClientArea) {
    if (!isLoggedIn) {
      const callbackUrl = encodeURIComponent(pathname)
      return NextResponse.redirect(
        new URL(`/login?callbackUrl=${callbackUrl}`, req.url)
      )
    }
    if (userRole !== "CLIENTE" && userRole !== "ADMIN") {
      // Staff can't access client area
      if (userRole === "STAFF") {
        return NextResponse.redirect(new URL("/staff-portal", req.url))
      }
      return NextResponse.redirect(new URL("/", req.url))
    }
  }

  // Redirect authenticated users from auth pages to their dashboard
  if (isLoggedIn && isAuthPage) {
    // Respect a SAFE callbackUrl (e.g. the cart checkout round-trip):
    // only same-origin relative paths are honored — reject protocol-relative
    // "//host", backslash variants, and absolute URLs (open-redirect guard).
    const callbackUrl = req.nextUrl.searchParams.get("callbackUrl")
    if (
      callbackUrl?.startsWith("/") &&
      !callbackUrl.startsWith("//") &&
      !callbackUrl.includes("\\")
    ) {
      return NextResponse.redirect(new URL(callbackUrl, req.url))
    }
    if (userRole === "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }
    if (userRole === "STAFF") {
      return NextResponse.redirect(new URL("/staff-portal", req.url))
    }
    if (userRole === "CLIENTE") {
      return NextResponse.redirect(new URL("/my-account", req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
