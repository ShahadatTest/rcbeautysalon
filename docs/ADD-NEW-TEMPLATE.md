# Dodajanje novega profila dejavnosti ali razširitve zmožnosti

> Ta vodnik opisuje, kako platformo razširiš z **novo panogo (profilom)** ali **novo
> razširitvijo (extension)** tako, da dotakneš **samo register + testno matriko** —
> brez spreminjanja UI, navigacije, onboardinga ali planov. To je namenoma:
> register = koda (verzioniran z gitom, type-safe), vse ostale površine ga samo berejo.

---

## 1. Kje kaj živi (zemljevid)

| Datoteka | Vsebina | Obvezna? |
|---|---|---|
| `src/lib/profiles/types.ts` | `CapabilityMatrix` (13 univerzalnih zmožnosti), `ActivityProfile`, `TerminologySet` | ne (spremeniš le, če dodajaš NOVO zmožnost — redko, zahteva sync-lock test) |
| `src/lib/profiles/registry.ts` | `PROFILE_LIST` — vsi profili dejavnosti; **zod validacija pri nalaganju** (`validateProfiles`, fail-fast) | **DA** (postopek A) |
| `src/lib/profiles/extensions.ts` | `EXTENSION_LIST` — deklarativne razširitve z odvisnostmi + entitetami | **DA** (postopek B) |
| `src/lib/verticals.ts` | `VERTICALS` — izgled/seed plast (palete, kategorije, vzorčne storitve/izdelki, vsebina strani) | neobvezna — neznani id se **varno spusti na `generic`** preset (`getVertical`), zato nov profil deluje tudi brez vnosa |
| `tests/profiles/registry.test.ts` | matrika profilov (§21 scenarij), terminološka validnost, števec | **DA** (matrika) |
| `tests/profiles/extensions-e21.test.ts` | matrika razširitev: odvisnosti, DORMANT pravilo, sync-lock | **DA** (postopek B) |

**Validacijske varovalke (vse avtomatske):**
- profil ne velja, če: manjka katerakoli izmed 13 zmožnosti, terminologija ni popolna
  (11 vnosov, vsak SL+EN), `extensions` sklicuje na neobstoječo razširitev, id ni
  kebab-case ali je podvojen → `validateProfiles` **mete pri nalaganju modula**
  (testi in build padejo takoj, ne v produkciji);
- razširitev ne velja, če: odvisnosti niso podmnožica `CAPABILITY_KEYS`
  (zod `z.enum`), entitete so prazne ali id ni kebab-case;
- `CAPABILITY_KEYS` tuple je **sync-lock** z `CapabilityMatrix` — dodajanje 14.
  zmožnosti brez posodobitve tupleja ne prevede (`satisfies readonly CapabilityKey`).

---

## 2. Postopek A — nov profil dejavnosti (npr. »dental«)

### Korak 1: vnos v `PROFILE_LIST` (`src/lib/profiles/registry.ts`)

Kopiraj najbolj podoben obstoječi vnos in prilagodi. Obvezna struktura:

```ts
{
  id: "dental",                        // kebab-case, unikaten
  version: 1,
  label: "Zobna ordinacija",
  description: "Termini, pacienti in zaloge materiala",
  palette: "teal",                     // privzeta paleta (PALETTES / palettes-client)
  capabilities: {
    appointments: "required",          // bistvo panoge = required
    workOrders: "disabled",
    shop: "optional",
    // ... VSEH 13 ključev — manjkajoči = zod napaka
  },
  terminology: {
    appointmentSingular: { sl: "Termin", en: "Appointment" },
    // ... VSEH 11 vnosov, vsak { sl, en } — to JE i18n panoge, ni ločenega slovarja
  },
  forms: [],                           // neobvezno: predloge obrazcev (materializirajo per-tenant)
  workflows: [],                       // neobvezno: predloge procesov
  dashboardWidgets: ["todayAppointments", "revenue", "customers"],
  website: { ctaMode: "booking" },     // booking | inquiry | order | quote
  extensions: ["workspace-resources"], // MORAJO obstajati v extensions.ts
  catalog: { seedVerticalId: "dental" }, // seed plast; če verticals.ts vnosa ni, = generic
}
```

### Korak 2: testna matrika (`tests/profiles/registry.test.ts`)

- dodaj profil v pričakovani seznam/matriko (§21 scenarij — kateri moduli so
  required/optional/disabled za to panogo);
- preveri, da številski aserti (`PROFILES` count, „vsak profil ima 13/13“) še
  veljajo — testi so pisani, da točno pokažejo, kaj je treba posodobiti.

### Korak 3 (neobvezno): seed/izgled v `src/lib/verticals.ts`

Brez vnosa tu onboarding uporabi **`generic`** fallback (kategorije, vzorčni katalog,
vsebina strani). Dodaj vnos samo, če želiš panogi lasten seed ali slikovno vsebino.

### Korak 4: preverba

```bash
bun run test     # matrika + vse registrske validacije
bunx tsc --noEmit
bun run lint
```

### Kaj se samodejno prižge brez dodatne kode

- onboarding `/start` dobi novo kartico (`listProfileOptions`);
- navigacija, dashboard, javni CTA — vse gleda `capabilities`/`extensions` profila;
- Nastavitve → Dejavnosti (E2-4): profil postane ponudba za sekundarno dejavnost;
- planovski števci, objava, domene — nič ne veže na seznam profilov.

> **Pravilo FREE limitov (plans register):** največji onboarding set novih profilov
> naj ostane pod FREE limiti (15 storitev / 20 izdelkov / 3 zaposleni) — svež najemnik
> naj nikoli ne prekorači limitov takoj po registraciji.

---

## 3. Postopek B — nova razširitev zmožnosti (npr. `loyalty`)

### Korak 1: vnos v `EXTENSION_LIST` (`src/lib/profiles/extensions.ts`)

```ts
{
  id: "loyalty",                       // kebab-case, unikaten
  name: "Zvestobinski program",
  description: "Točke in nagrade za stranke",
  version: 1,
  capabilities: ["customers"],         // odvisnosti ⊆ CAPABILITY_KEYS (zod enum preveri)
  entities: [                          // vsaj 1 entiteta
    {
      key: "loyalty_card",
      name: "Zvestobinska kartica",
      fields: [
        { key: "points", label: "Točke", type: "number", required: false },
      ],
    },
  ],
}
```

### Korak 2: DORMANT pravilo (`tests/profiles/extensions-e21.test.ts`)

Razširitev **brez dostavljenega runtime-a** ne sme biti vklopljena na NOBENEM
obstoječem profilu (vsak najemnik ohrani današnjo izkušnjo). Dodaj id na `DORMANT`
seznam v testu. Ko v kasnejši fazi dostaviš runtime (realni model + akcije + UI,
npr. kot E2-2 inventar ali E2-3 projekti), id **premakni iz DORMANT** in odkleni
na ciljnih profilih.

### Korak 3: runtime (ko pride faza zanj)

- **Brez sheme**: entitete se hranijo v generičnem `ExtensionRecord` trgovini
  (org-scoped JSON, §13) — nič migracij; akcije v `src/app/actions/records.ts`.
- **Z lastnim modelom** (realna logika/transakcije): aditivna Prisma migracija,
  org-scoped akcije z `requireAdminOrg`, nav vnos tipa `NavItem.extension`.
  (Vzorca: E2-2 `StockMovement`, E2-3 `Project`.)

### Korak 4: preverba

Enako kot postopek A (`test`, `tsc`, `lint`).

---

## 4. Checklista pred commitom

- [ ] register + matrika sta edini **obvezni** spremembi (1 vnos + 1 test)
- [ ] vse 13 zmožnosti deklariranih; terminologija 11/11 v obeh jezikih
- [ ] `extensions` sklici obstajajo; DORMANT pravilo spoštovano
- [ ] `bun run test` zelen (matrika je posodobljena), `tsc`, `lint` čista
- [ ] nobena migracija NI potrebna za čist registrski vnos (aditivna samo za runtime)
- [ ] obstoječi najemniki se ne spremenijo: novi profili/razširitve so privzeto
      izklopljeni in nikoli ne zožijo dodeljenih zmožnosti (E2-4 unija samo razširi)

Povezana dokumentacija: [`docs/EPIC-2/PLAN.md`](EPIC-2/PLAN.md) (odločitve in faze),
[`docs/EPIC-1/ARCHITECTURE.md`](EPIC-1/ARCHITECTURE.md) (matrika zmožnosti §21).
