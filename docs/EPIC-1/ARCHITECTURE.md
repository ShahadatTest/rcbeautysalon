# EPIC #1 — Arhitektura univerzalne platforme: analiza stanja, analiza vrzeli in revidirani načrt

> Sklic: GitHub Issue #1 — *EPIC: Transform RCBeauty into a Universal Multi-Activity Business Platform*
> (vključno z razširitvijo §21 — prečnoindustrijska validacija in dodatek komentarja o posodobljeni glavni specifikaciji)
> Status dokumenta: **Faza 1 (audit + načrt) — dokončana.** Implementacija sledi fazam iz §6.

---

## 1. Namen dokumenta

Dokument je odgovor na zahtevo iz komentarja na Issue #1: *najprej primerjati obstoječo implementacijo z razširjenimi zahtevami, poročati o vrzelih in revidirati načrt, šele nato nadaljevati z implementacijo — brez neprostovoljnega prepisovanja in brez uničenja delujoče funkcionalnosti.*

Vsebuje:
- popoln pregled trenutnega stanja (audit repozitorija),
- analizo vrzeli glede na zahteve §1–§21,
- seznam arhitekturnih odločitev, ki jih je treba spremeniti,
- revidiran fazni načrt z rezultati in akceptančnimi kriteriji.

---

## 2. Trenutno stanje (po auditu repozitorija)

### 2.1 Tehnološki sklad
Next.js 16 (App Router, Turbopack) · React 19 · TypeScript 5 · Prisma + PostgreSQL (Neon) · Tailwind CSS 4 · NextAuth v5 (JWT, Pri…) · zod · Zustand · Vercel (samodejni deployment). **Ni testov, ni CI, ni vercel.json.**

### 2.2 Večnajemniška arhitektura (delujoča, ohranimo)
- `src/proxy.ts` — prepiše `/s/[slug]/*` na golo pot in vstavi glavo `x-org-slug`; tudi vlogovne preusmeritve (ADMIN→`/dashboard`, STAFF→`/staff-portal`, CLIENTE→`/my-account`).
- `src/lib/tenant.ts` — `getOrgBySlug`, `getOrgById`, `getPublicOrg`, `getSessionOrg`, `requireAdminOrg`, `getResolvedOrg`, `isReservedSlug`, `slugify`, `isSlugAvailable` (vse `React.cache`-ano, strežniško).
- Avtorizacija: `src/lib/auth/guards.ts` (`requireSession`, `requireRole`, `requireAdmin`, `requireStaffOrAdmin`); seka vsebuje `organizationId`.
- 19 datotek strežniških akcij (`src/app/actions/*`) — vse admin pisanje skozi `requireAdminOrg()`, javna branja skozi `getPublicOrg()`/`getResolvedOrg()`.
- Stripe po najemniku: šifrirani per-org ključi (`Organization.stripeSecretKey/...`), webhook z večnajemniško validacijo podpisa, env-fallback.

### 2.3 Verticales (današnji »profili« — samo izgled + vzorčni podatki)
`src/lib/verticals.ts`: 8 prednastavitev (`beauty`, `frizer`, `barber`, `nails`, `cosmetica`, `massage`, `epilation`, `generic`) — vsaka s paleto, pisavami, vzorčnimi kategorijami/storitvami in `SiteContent` besedilom. Vplivajo **izključno na**: barvno temo (CSS spremenljivke), pisave (samo javna stran), vzorčni katalog novega najemnika in privzeto besedilo spletnega mesta.

**Ne vplivajo na**: navigacijo, terminologijo, i18n, obrazce, delovne procese, dashboard, poslovna pravila.

Znane slabosti (nevarnosti):
- ročne zrcalne kopije: nova panoga zahteva urejanje ≥ 4 datotek (`verticals.ts`, `palettes-client.ts`, `site-content.ts`, seed skripte);
- neznana vrednost `vertical` se **tiho** povrne na `beauty` (`getVertical`), neznana paleta na `rose`;
- onboarding trdo kodira `EUR/sl/Europe/Ljubljana/SI` ne glede na prednastavitev (polja `currency/locale/timezone` v prednastavitvah so mrtvi podatki);
- **zastarel, nesoraden duplikat vzgradbe v `src/`** (`src/package.json`, `src/prisma/schema.prisma` z driftom — drugačni privzeti časi/valute!, `src/bun.lock`, …) — nevarnost urejanja napačne datoteke.

### 2.4 Navigacija, i18n, vsebina
- Admin sidebar: **statičen** 9-elementni seznam (`src/components/admin/sidebar.tsx`), brez vlog/panoga filtriranja; noga trdo kodira „RC Beauty Salon Admin“.
- Staff sidebar: statičen, trdo kodirana slovenščina, brez i18n.
- i18n: statični slovarji (11 imenskih prostorov), `sl`/`en`, **samo admin**; javna stran in staff portal so trdo kodirani slovensko. Ni plasti terminologije po panogi.
- `SiteContent` (JSON v `SalonConfig.siteContent`): hero, prednosti, naslovi sekcij, o nas, delovni čas, social, SEO, **7 fiksnih sekcij** (samo vidnost, ne vrstni red, ne dodajanje). `mergeSiteContent()` tolerira pokvarjene podatke.

### 2.5 Identiteta platforme
„RC Beauty Salon“ je trdo kodiran v ~31 datotekah / 104 pojavitvah: vse e-poštne predloge (10), metadata naslovi ~14 strani, admin sidebar noga, demo prijavna škatla, seed skripte. Že najemniško ozaveščeni: `Logo`, javni navbar/footer (uporabljata `org.name`).

### 2.6 Podatkovni model (relevantno)
- `Organization.vertical/palette/plan/status` so **String** (razširljivo, brez DB enumov) ✅
- `SalonConfig.siteContent Json?` — združljivo s profili ✅
- `Service.duration Int` — **obvezen** (težava za panoge brez terminov, če bi želele storitve brez trajanja)
- `Order` = izključno prodaja izdelkov iz trgovine (PENDING/PAID/COMPLETED/CANCELLED/REFUNDED) — ni delovnih naročil, ni povezave na workflow
- `Appointment` = lepotni model rezervacije (staff časovni sloti, trajanje storitev, depozit)
- **Ne obstaja**: FormDefinition/FormSubmission, Workflow*, capability/module register, feature flagi, prilagoditve po najemniku (overrides), verzioniranje profilov
- Odsoten `organizationId` na `Review`, `Appointment`, `StaffService`, `ServiceGallery/FAQ` (najemnik se sklepa prek relacij) — nove entitete morajo to pravilo dosledno upoštevati ali imeti ekspliciten scope.

### 2.7 Varnost — opažene tveganja za zaostritev (§17)
- Več mest pada nazaj na „prvi ACTIVE org“ (`getPublicOrg` brez glave, `getSessionOrg` legacy-admin veja, `settings.ts`, Stripe webhook fallback) — tiho privzemanje najemnika #1. Ne krši izolacije za admin akcije (te preverijo sejo), a je vzorec, ki ga je treba zaostriti.
- Slike: `Media` z DB-fallback; naloži samo prijavljen uporabnik (preverjeno) — potrebno avtorizacijsko testiranje v Fazi 7.

---

## 3. Analiza vrzeli: zahteve (§) → stanje

| Zahteva (§) | Stanje | Vrzel |
|---|---|---|
| §2 Univerzalno jedro (moduli) | delno — vsi moduli so vedno vključeni | ni registra modulov/zmožnosti; ni onemogočanja |
| §3 Izolacija najemnika | dobra (middleware + org-scoped akcije) | zaostriti „prvi org“ fallbacke; avtomatski izolacijski testi manjkajo |
| §4 Profil kot konfiguracijski motor | **ni** | verticale so samo izgled; ni terminologije/modulov/obrazcev/workflow/dashboard definicij, ni verzioniranja, ni overrides |
| §5 Dodajanje panoge brez jedra | **ni** | danes: urejanje ≥ 4 datotek + tihi fallbacki |
| §6 Onboarding | delno (čarovnik 3 koraki, izbira panoge, takojšnje spletno mesto) | ne inicializira modulov/obrazcev/workflow/dashboarda; trdo kodirana lokalizacija; „salon“ žargon |
| §7 Spletni graditelj | delno (besedila/slike/vidnost sekcij) | fiksne sekcije, fiksni vrstni red, CTA vezan na terminske panoge |
| §8 Dinamični obrazci | **ni** | potrebno: definicije polj, validacija, oddaje vezane na stranko/naročilo/termin |
| §9 Workflow motor | **ni** | statusi so trdi Postgres enumi, prehodi so ad-hoc v akcijah |
| §10 Dashboard po panogi | **ni** | statični widgeti; „Termini“ za vse |
| §11 Univerzalni katalog | delno (storitve+izdelki) | ni variant, paketov, serij/loto — za čebelarstvo kot extension |
| §12 Centralna administracija | dobra za današnji obseg | manjkajo: profili, obrazci, workflow, moduli |
| §13 Extension pogodba | **ni** | potrebno: dokumentirana pogodba + register |
| §14 Nevtralna identiteta | **ni** | 104 trdo kodiranih pojavitev |
| §15 Audit + načrt | **ta dokument** | — |
| §16 Podatkovni model + migracije | določen v §5 | — |
| §17 Varnost | osnova obstaja | testi izolacije, idempotenca webhookov — Faza 7 |
| §21 Cross-industry scenariji | **ni** | potrebni profili: lepotovalni studio (obstaja ~), vulkanizer/avtoservis, čebelarstvo, šiviljstvo; capability matrica required/optional/disabled |

**Sklep:** trenutna arhitektura je **zdrava večnajemniška osnova**, ki jo je mogoče razširiti konfiguracijsko — ni potreben prepis. Kritične vrzeli so: profil-motor, capability matrica, extension pogodba, obrazci, workflow, dinamična navigacija/terminologija/dashboard, nevtralna identiteta.

---

## 4. Revidirana ciljna arhitektura

### 4.1 Plasti
```
┌─────────────────────────────────────────────────────────────┐
│ UI (admin / staff / javno mesto) — bere profil najemnika     │
├─────────────────────────────────────────────────────────────┤
│ PROFILNI MOTOR (data-driven, verzioniran, validiran z zod)   │
│  · ActivityProfile: identiteta, zmožnosti, terminologija,    │
│    obrazci, workflow, dashboard, spletno mesto, razširitve   │
│  · Overrides po najemniku (JSON, verzioniran, ne mutira      │
│    skupnega profila)                                         │
├─────────────────────────────────────────────────────────────┤
│ EXTENSION POGODBA — specializirane entitete/procesi          │
│  (vozila+dimenzije, mere, serije/loti, prostori/stoli …)     │
│  re-uporabljajo univerzalne primitivе, ne duplicirajo jih    │
├─────────────────────────────────────────────────────────────┤
│ UNIVERZALNE PRIMITIVE (obstoječe jedro, ohranjeno)           │
│  najemniki, stranke, katalog, cene, naročila, plačila,       │
│  obrazci, workflow, obvestila, mediji, spletno mesto,       │
│  dashboard, vloge                                            │
├─────────────────────────────────────────────────────────────┤
│ PostgreSQL (Neon) — org-scoped, transakcije, omejitve        │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Zmožnosti: required / optional / disabled (§21)
Profil **deklarira** stanje vsake univerzalne zmožnosti — univerzalne komponente ne smejo predpostavljati, da karkoli obstaja:

| Zmožnost | pomen | privzeto izklopne panoge (primer) |
|---|---|---|
| `appointments` | rezervacije terminov (staff sloti, trajanja) | čebelarstvo, vulkanizer (delno — optional) |
| `workOrders` | delovna naročila z workflow | čebelarstvo |
| `shop` | spletna trgovina z izdelki | (večina jo ima) |
| `services` | katalog storitev | čebelarstvo |
| `inventory` | zaloge izdelkov | delno |
| `customers` | baza strank | — |
| `staff` | zaposleni z delovnim časom (rezervabilni) | čebelarstvo |
| `analytics` | poročila | — |
| `reviews` | ocene storitev | vulkanizer, čebelarstvo (optional) |
| `forms` | dinamični obrazci | — |
| `workflows` | konfigurabilni procesi | — |
| `documents` | predračuni/računi | vse (Faza 4+) |
| `delivery` | dostava/prevzem | vse (Faza 4+) |

Stanja: `required` (jedro upošteva kot obvezno, UI prikazuje), `optional` (privzeto on, lastnik lahko izklopi na nivoju najemnika), `disabled` (modul se ne izrisuje nikjer — navigacija, dashboard, javno mesto).

### 4.3 Extension pogodba (§13)
```ts
interface ExtensionDefinition {
  id: string                    // npr. "vehicle-workshop"
  name: string; description: string
  version: number
  capabilities: string[]        // katere zmožnosti razširja
  entities: ExtensionEntity[]   // deklarativni opis posebnih entitet
  formTemplateKeys?: string[]   // obrazci, ki jih razširitev potrebuje
}
```
Razširitve so **deklarativne in registrirane**, uporabljajo univerzalne primitivе (stranke, obrazci, workflow, mediji, opombe). Prva generacija: `vehicle-workshop` (vozila, registracija, dimenzije gum), `body-measurements` (mere telesa), `batch-production` (serije/loti, žetev), `workspace-resources` (sobice/stoli/platoji). Materializacija UI entitet: Faza 4; pogodba + register + povezava v profile: Faza 3 (ta dostava).

### 4.4 Profil (ActivityProfile)
```ts
interface ActivityProfile {
  id, version, label, description, palette
  capabilities: CapabilityMatrix          // required/optional/disabled
  terminology: TerminologySet             // termini po panogi (SL + EN)
  forms: ProfileFormTemplate[]            // predloge obrazcev
  workflows: ProfileWorkflowTemplate[]    // predloge procesov (stopnje, prehodi)
  dashboardWidgets: WidgetKey[]           // kateri widgeti so smiselni
  website: { ctaMode: "booking"|"inquiry"|"order"|"quote" }
  extensions: string[]                    // ExtensionDefinition ids
  catalog: { seedVerticalId: string }     // vzorčni katalog (obstoječi sistem)
}
```
- Register je **client-safe** (brez prisme) → enoten vir za onboarding, navigacijo, nastavitve, dashboard.
- Validacija z **zod ob zagonu** — napačen profil =glasen error (ne tihi fallback).
- `Organization.profileVersion` + `Organization.profileOverrides Json?` — overrides ne mutirajo skupnega profila; reševanje: `resolveProfile(org) = base ∪ overrides` (server), verzionirano.

### 4.5 Materializacija iz profilov (novi Prisma modeli)
Predloge iz profila se **materializirajo per-org** (copy-on-write), da lastnik lahko ureja brez programiranja in brez mutiranja skupnega profila:
- `FormDefinition` (org, key, name, fields Json, version, isActive) + `FormSubmission` (org, definition, data Json, status, customerId?, contextType/contextId)
- `WorkflowDefinition` (org, key, name, entity, version) + `WorkflowStage` (key, name, order, slaHours, isFinal)
- `Organization.profileVersion`, `Organization.profileOverrides`
Polimorfna povezava oddaje (`contextType`+`contextId`) namesto trdih FK na termin/naročilo — univerzalno jedro ne predpostavlja, na katero entiteto se obrazec veže. `customerId` je pravi FK (stranke so univerzalna primitiva).

### 4.6 Nav/dash/terminologija — poraba profila
- Admin sidebar: elementi nosijo `capability` filter + terminološke oznake (npr. šiviljstvo: brez „Termini“, naročila → „Delovna naročila“).
- i18n provider: prejme `profileId` → `useProfile()` + `term()`; slovarji ostanejo, terminologija se prekriva profilno.
- Dashboard: widgeti filtrirani po `dashboardWidgets`/capabilities (najprej skrivanje irelevantnih; novi widgeti Faza 4).
- Javno mesto: CTA način po profilu (booking/inquiry/order/quote) + terminologija sekcij prek `SiteContent` predlog.

---

## 5. Podatkovni model in migracijska strategija (§16)

**Dodatki (aditivno, non-breaking):**
1. `Organization.profileVersion String?`, `Organization.profileOverrides Json?`
2. `FormDefinition`, `FormSubmission`, `WorkflowDefinition`, `WorkflowStage` (org-scoped, `@@index([organizationId])`, unikati `[organizationId, key]`)
3. Preset `products` v vertikalnih prednastavitvah (za panoge s produkti: čebelarstvo) — seed izdelkov ob onboardingu.

**Ohranjeno brez sprememb:** vsi obstoječi modeli, podatki, relacije. Obstojeci najemniki dobijo definicije obrazcev/workflow z **backfill skripto** (idempotentna, upsert po `(organizationId, key)`).

**Načrtovano (Faza 4+, ločene migracije z explicitno kompatibilnostjo):**
- `Service.duration Int?` (nullable) za storitve brez trajanja
- Statusi naročil/terminov: prehod na workflow-stopnje (obstoječi enumi ostanejo kot „legacy os“ polje; workflow stopnje se vzporedno verzionirajo — dvosmerni preslikavalniki)
- Extension entitete (Vehicle, Batch, …) kot ločene tabele z `organizationId` + indexi

**Zavrnjena alternativa:** polimorfna „EAV“ tabela za vse panoge — zavrnjena zaradi integritete, indeksov in poizvedljivosti.

---

## 6. Revidirani fazni načrt (nadomešča §18 v delih, kjer je bilo treba)

| Faza | Rezultat (deliverables) | Akceptančni kriteriji | Status |
|---|---|---|---|
| **1. Audit + načrt** | ta dokument; audit 19 akcij, sheme, i18n, identitete | poročilo o vrzelih objavljeno; načrt revidiran glede §21 | ✅ |
| **2. Univerzalno jedro (dodelave)** | capability model + register profilov (zod-validiran, verzioniran) + client-safe vir; odstranjeni zrcalni seznami; nevtralna identiteta v univerzalnih komponentah; čiščenje zastarelega `src/` dvojčka | nova panoga = 1 nov profil v registru (brez spremembe jedra); build/lint zelen | ✅ (11 profilov, 4 razširitve; lint zelen; E2E potrjeno) |
| **3. Profilni motor + podatkovni model** | `FormDefinition/FormSubmission/WorkflowDefinition/WorkflowStage`; materializacija ob onboardingu; overrides polje; backfill za obstoječe najemnike; onboarding: splošen (panoga→zmožnosti→katalog→spletne strani), lokalizacija iz profila | obstoječi 4 orgi na Neonu dobijo definicije brez izgube podatkov; nov org materializira obrazce+workflow svoje panoge | ✅ (backfill zagnan: 4/4 orgi; šiviljstvo E2E: registracija→materializacija→UI) |
| **4. Dinamična izkušnja** | navigacija+dashboard po zmožnostih (**delno izvedeno v 2–3**: sidebar gating, terminologija, gating dashboardnih widgetov); javno mesto: CTA način + sekcije po profilu (site copy iz profila ✅, navbar CTA še fiksno); obrazci: graditelj + javna oddaja + admin seznam oddaj; workflow: upravljanje stopnj, prehodi z validacijo in zgodovino; katalog: paketi/varianti; dokumenti | šiviljstvo: povpraševanje→mere→predračun→izdelava→priblon→predaja→plačilo deluje E2E; ne-terminske panoge ne vidijo koledarja | 🔄 (osnova izvedena; UI graditelji sledijo) |
| **5. Lastniška prilagoditev** | centralne nastavitve: moduli on/off (optional zmožnosti), urejevalnik obrazcev/workflow, dashboard widgeti | lastnik spremeni obrazec/workflow brez kode; overrides verzionirani | ⏳ |
| **6. Panogna validacija** | E2E: lepotni studio, vulkanizer, čebelarstvo, šiviljstvo na istem jedru | vsi §21 akceptančni testi zeleni; irelevantni moduli neizrisani | ⏳ |
| **7. Produkcijska pripravljenost** | testi izolacije najemnika, idempotenca webhookov, migracijske preverbe, UX mobilnost, dokumentacija | CI zelen; varnostni pregled | ⏳ |

---

## 7. Potreben refactoring (in zakaj)

1. **Enoten vir profilov** — `verticals.ts`/`palettes-client.ts`/`site-content.ts` zrcala → register profilov kot edini vir za onboarding/nav/nastavitve (drugače vsaka nova panoga = 4+ ročni popravki, §5 krši).
2. **Odgovorna navigacija** — statičen sidebar → capability-gated (§21: „ne prikazuj irelevantnih modulov“).
3. **Onboarding generalizacija** — lokalizacija/valuta iz profila, nevtralen žargon („podjetje“ namesto „salon“), materializacija obrazcev/workflow (§4, §6, §21).
4. **Nevtralna identiteta** — 104 pojavitev → platformno nevtralne oznake; demo podatki ločeni (§14).
5. **Zastarel `src/` dvojček** —brisanje (drifted schema = realna nevarnost napačne migracije).
6. **Zaostritev fallbackov** — „prvi ACTIVE org“ samo kjer je to eksplicitno platformno vedenje; drugje zahtevaj izrazit kontekst (§17).
7. **`Service.duration Int?`** — Faza 4 (za storitve brez trajanja; do takrat take panoge ne seedejo storitev).
8. **Ni rušenja**: appointment/model, Order, Stripe, javno mesto, i18n — vse deluje naprej; spremembe so aditivne ali zaščitene s fallbacki na današnje vedenje.

---

## 8. Odločitve in kompromisi (dnevnik)

| Odločitev | Razlog |
|---|---|
| Profili v kodi (TS register) namesto v DB | verzioniranje z gitom, type-safety, client-safe uvoz, review proces; DB overrides pokrivajo per-org prilagoditve (§4 „data-driven“ izpolnjena z obojim) |
| Copy-on-write materializacija definicij per-org | lastnik ureja svoje definicije brez mutiranja skupnega profila (§4) |
| Polimorfni context na FormSubmission | univerzalno jedro ne pozna vseh prihodnjih entitet (§21 kritično pravilo) |
| Katalog seeda ostane v vertikalnih prednastavitvah | ločitev: profil = vedenje, preset = vzorčni podatki/izgled; manjši diff |
| EN jezik issue-ja / SL dokumentacija repoja | doslednost z obstoječim README |
| Brez novih testov v tej dostavi | Faza 7 definira testno strategijo (repo trenutno nima testnega ogrodja); ročni E2E po vsaki fazi |
