// ============================================================
// E2E GLOBAL SETUP (EPIC #3 E3-8)
// Turbopack dev compiles each route on first hit — a fresh run
// can spend minutes compiling the dashboard surface DURING a
// test, blowing test timeouts. Warm the key routes up front
// (auth-gated routes still compile on request) so specs run
// against warm pages.
// ============================================================

import { FullConfig } from "@playwright/test"

async function warm(baseUrl: string, paths: string[]): Promise<void> {
  for (const p of paths) {
    await fetch(`${baseUrl}${p}`, { redirect: "follow" }).catch(() => {})
  }
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  const baseUrl = process.env.BASE_URL ?? "http://127.0.0.1:3123"
  // Public + auth surfaces first (compile-heavy), then dashboard/admin
  // surfaces (redirect to /login when unauthenticated — still compiles).
  await warm(baseUrl, [
    "/",
    "/login",
    "/start",
    "/dashboard",
    "/dashboard/settings",
    "/dashboard/services",
    "/dashboard/services/new",
    "/dashboard/products",
    "/dashboard/appointments",
    "/dashboard/forms",
    "/dashboard/work-orders",
    "/platform",
  ])
}
