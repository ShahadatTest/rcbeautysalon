import { defineConfig, devices } from "@playwright/test"
import path from "path"

// ============================================================
// E2E CONFIG (EPIC #3 E3-8)
// Runs the REAL Next.js app in PRODUCTION MODE against an ISOLATED
// database (DATABASE_URL points at a disposable schema — never
// production). Production build, not `next dev`: dev-mode React
// Compiler/HMR breaks form event wiring (submit handlers never
// fire) and adds on-demand compile races; the production build is
// deterministic — and the honest target for acceptance E2E.
// Scenarios §16 A–E from issue #3 use real flows + persisted data.
//
// Required env (see docs/EPIC-3/E2E.md):
//   E2E_DATABASE_URL — Postgres URL of the isolated test database
//   (schema via `prisma db push` + seeded with `bun prisma/seed.ts`).
// ============================================================

const PORT = 3123
const BASE_URL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false, // scenarios share server + DB; keep order deterministic
  workers: 1,
  retries: 0,
  globalSetup: path.join(__dirname, "e2e/global-setup.ts"),
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "sl-SI",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `bunx next build && bunx next start --port ${PORT}`,
    url: `${BASE_URL}/login`,
    reuseExistingServer: false,
    timeout: 600_000,
    env: {
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? "",
      AUTH_SECRET: "e2e-only-secret-not-used-in-production",
      NEXTAUTH_URL: BASE_URL,
      NEXT_PUBLIC_APP_URL: BASE_URL,
      // Auth.js trusts the deployment platform automatically (Vercel);
      // self-hosted production runs need this explicitly (UntrustedHost).
      AUTH_TRUST_HOST: "true",
      // Platform operator console: the seeded admin (prisma/seed.ts)
      // acts as the operator in scenario E.7.
      PLATFORM_ADMIN_EMAILS: "admin@rcbeautysalon.org",
    },
  },
})
