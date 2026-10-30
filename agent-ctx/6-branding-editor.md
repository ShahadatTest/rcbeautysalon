# Task 6 — Admin editor "Izgled in vsebina" + tema (branding editor)

Agent: branding-editor
Repo: /home/z/rcbeautysalon
Status: DONE (lint clean, tsc clean for touched files)

## Files created

- `src/components/dashboard/branding-editor.tsx` (NEW, client component)
  - Loads `getOrgBranding()` on mount; skeleton while loading; error card with "Poskusi znova" retry.
  - Cards (all labels Slovenian, max-w-3xl, bg-card/border-border tokens):
    - a) **Tema** — swatch grid from `PALETTE_OPTIONS` (two-tone circle primary+accent, label, `ring-2 ring-primary` on active). Click → `updateOrgPalette(id)` → toast "Tema je shranjena" + `router.refresh()`.
    - b) **Logo** — Next Image preview, fallback "Ni logotipa", upload (type "logo" → `uploadImage` → `updateOrgLogo(url)`), "Odstrani" → `updateOrgLogo(null)`.
    - c) **Hero sekcija** — eyebrow, naslov, podnaslov, slika (upload "hero"), video URL input (+hint), gumb 1/2 besedilo. Hrefs fixed to `/booking` & `/shop`, shown as read-only hints (no href inputs). Secondary CTA normalized to `null` when label empty on save.
    - d) **O salonu** — naslov, 2 odstavka, slika (upload "about"), statistika rows value+label, add/remove, max 4 (Badge x/4).
    - e) **Prednosti** — naslov+podnaslov, dynamic items (icon Select from fixed 12-name list, title, description), max 6 (Badge x/6), last-item remove protected.
    - f) **Naslovi sekcij** — services/team/shop title+subtitle pairs.
    - g) **CTA** — naslov, besedilo, besedilo gumba (hint: vodi na /booking).
    - h) **Delovni čas** — 7 rows Ponedeljek→Nedelja (day 1..0) via `normalizeHours` helper; Switch + time inputs, disabled + "Zaprto" badge when closed.
    - i) **Družabna omrežja** — Instagram/Facebook/TikTok/Spletna stran (optional, stored as undefined when empty).
    - j) **SEO** — meta naslov + meta opis.
    - k) **Sekcije** — 7 Switches mapping to `sections[].visible` (hero, prednosti, storitve, o salonu, ekipa, trgovina, CTA).
    - l) **Panoga** — collapsed `<details>`: VERTICAL_OPTIONS Select, Checkbox "Dopolni katalog z vzorčnimi storitvami te panoge", amber warning text, "Zamenjaj panogo" → `confirm()` → `updateOrgVertical(vertical, reseed)`.
  - Sticky bottom save bar (`sticky bottom-4`, card style): dirty indicator dot + "Shrani vsebino" (disabled while saving) → normalizes whole `SiteContent` (CTA hrefs, empty paragraphs/stats/features dropped, openingHours/sections normalized) → `updateSiteContent` → toast "Vsebina je shranjena — stran se je osvežila" + `router.refresh()`. Client guard: hero title required.
  - Local state: single `content: SiteContent` + `set(field, value)` immutable helper; internal sub-components kept in-file (EditorCard, Field, ImageField, FeatureRow, SectionTitlePair, EditorSkeleton).

- `src/components/dashboard/settings-tabs.tsx` (NEW, client component)
  - shadcn Tabs wrapper with two triggers: "Osnovne nastavitve" and "Izgled in vsebina".
  - Both `TabsContent` use `forceMount` + `data-[state=inactive]:hidden` so form/branding state survives tab switching.

## Files changed

- `src/app/(admin)/dashboard/settings/page.tsx`
  - Server component now renders `<SettingsTabs basic={<SettingsForm …/>} branding={<BrandingEditor />} />`.
  - Existing `SettingsForm` untouched (its internal "Settings" header is preserved inside the basic tab).
  - Added null guard for `getSalonSettings()` (pre-existing TS error in this file: return type `… | null` was passed straight into `SettingsForm`); renders Slovenian fallback Card when null.

## Not changed (by design)

- `src/components/admin/sidebar.tsx` — it is a client component with hardcoded "RC Beauty Salon Admin" footer; making it dynamic would need new data wiring, so left as-is per task instructions (not broken).
- `src/app/actions/**`, `src/lib/**`, public site, landing, layouts, onboarding, prisma — only imported, never edited.

## Lint / typecheck

- NOTE: repo script `bun run lint` is broken with Next 16 (`next lint` was removed in Next 16 → "Invalid project directory provided"). Ran ESLint directly with the repo's flat config instead:
  `bunx eslint src/components/dashboard/branding-editor.tsx src/components/dashboard/settings-tabs.tsx "src/app/(admin)/dashboard/settings/page.tsx"` → **0 problems**.
- `bunx tsc --noEmit` → no errors in files touched by this task (repo has pre-existing errors in prisma/seed.ts and src/app/actions/{products,services,staff,users}.ts from other tasks — untouched).

## Notes for next agents

- Server action results are non-discriminated unions; narrowing used via `"org" in res` / `"error" in res` guards.
- Uploads go through `/api/upload` (Cloudinary, remote pattern already in next.config); client prep via `uploadImage` from `src/lib/upload-client.ts`.
- Palette/logo/vertical save instantly; only the SiteContent JSON needs the "Shrani vsebino" button.
