# Task 5 — Salon self-service onboarding wizard (work record)

## Status: DONE

## Files created
1. **`src/app/actions/onboarding.ts`** ("use server")
   - `checkSlugAvailability(slug: string): Promise<{ available: boolean }>` — normalizes via `slugify()` (src/lib/tenant.ts), returns `{ available: false }` for empty/reserved/taken.
   - `createSalonOrganization(input: CreateSalonInput): Promise<CreateSalonResult>` where
     `CreateSalonInput = { name, slug, vertical, palette, ownerName, email, password }` and
     `CreateSalonResult = { success: boolean; slug?: string; salonName?: string; error?: string }`.
   - Flow: validate (SI messages) → Organization → User (role ADMIN, `password` field = bcrypt 12 hash, emailVerified = now, organizationId) with **nested** Staff (name/email/isActive/organizationId) + **nested** WorkingHours (Mon–Fri 09:00–18:00, Sat 09:00–13:00; dayOfWeek 1–6, all isActive) → `seedOrganizationCatalog(org.id, vertical)` → `staffService.createMany` for all org services → SalonConfig (name, email=owner, country SI, EUR, sl, Europe/Ljubljana, bookingDeposit 10, cancellationPolicy "Odpoved možna najkasneje 24 ur pred terminom.", `siteContent = verticalSiteContent(vertical)`, primaryColor/accentColor from palette hexes).
   - NOTE: schema field is `User.password` (not `passwordHash`) — hash stored there; matches `compare()` in src/lib/auth/auth.ts.
   - On inner failure: best-effort cleanup (delete user → cascades staff/hours/staffService; delete org → cascades config/categories/services). P2002 → friendly email/slug messages.

2. **`src/app/(auth)/start/page.tsx`** — server component, `metadata = { title: "Ustvari svoj salon" }`, renders `<StartWizard />`. No `(auth)/layout.tsx` exists (verified) — wizard owns its full-page shell.

3. **`src/components/onboarding/start-wizard.tsx`** ("use client") — 3-step SI wizard:
   - Step 1 Panoga: VERTICAL_OPTIONS cards (label + description + primary/accent color dots via PALETTE_OPTIONS); selecting a vertical pre-selects its default palette.
   - Step 2 Salon: ime (auto-slugs URL field via local `slugifyLocal` copy of tenant.ts logic until user edits slug manually), debounced (450 ms) `checkSlugAvailability` with green "Prosto" / red "Zasedeno" / "Preverjam …", `/s/<slug>` preview, 8 two-tone palette circles with ring highlight on selected.
   - Step 3 Lastnik: ime in priimek, e-pošta, geslo (min 8), potrditev; info box "Po registraciji dobite takoj svojo spletno stran z rezervacijami in trgovino." + live `/s/<slug>` and vertical catalog note.
   - Sticky footer (safe-area aware): Nazaj / Naprej / "Ustvari salon" (loading "Ustvarjam salon …"); per-step validation with sonner toasts; on success `signIn("credentials", { email, password, redirect: false })` → `toast.success("Salon je ustvarjen!")` → `router.push("/dashboard?welcome=1")` + refresh. signIn failure → toast + `/login`.

## Files changed
4. **`src/components/auth/login-form.tsx`** — added "Own a salon? **Ustvari svoj salon**" link to `/start` (below the customer "Create account" block). Wizard header links back to `/login` ("Prijava") and `/` (logo). `/register` untouched, no route conflicts (proxy.ts only guards /login /register as auth pages; /start is public).

## Lint / types
- `bun run lint` (`next lint`) is **broken project-wide in Next 16** ("Invalid project directory provided"); ran `bunx eslint` directly on all 4 files → **0 errors, 0 warnings** (after fixing 2 `react-hooks/set-state-in-effect` errors: slug state now set in change handlers, effect only schedules the async lookup).
- `bunx tsc --noEmit`: my files clean. Pre-existing errors NOT mine: `prisma/seed.ts` (CategoryWhereUniqueInput), `src/app/(admin)/dashboard/settings/page.tsx` (null config prop) — other agent/existing code.

## Not verified / notes for next agents
- No dev-server run / no DB write test (per task constraints: no prisma commands, no dev server). Creation flow is type-checked but not runtime-tested.
- Dashboard does not yet handle `?welcome=1` (Task: dashboard components owned by another agent).
- Palette hexes for SalonConfig branding come from `palettes-client.ts` (client-safe, safe to import server-side).
