# RC Beauty Salon — večnajemniška platforma za salone lepote

Sodobna full-stack platforma za upravljanje frizerskih in kozmetičnih salonov, zgrajena z **Next.js 16**, **React 19**, **TypeScript** in **Tailwind CSS v4**.

🌐 **V živo:** [https://rcbeautysalon-phi.vercel.app](https://rcbeautysalon-phi.vercel.app)

Ena namestitev streže **več neodvisnim salonom** — vsak s svojo domeno (`/s/ime-salona`), temo, vsebino, storitvami, osebjem in plačili.

## ✨ Zmožnosti

### 🏢 Univerzalna platforma za vse dejavnosti (EPIC #1)
- **Profilni motor dejavnosti** — dejavnost določa CELO izkušnjo, ne samo izgled: module, terminologijo (SL/EN), obrazce, delovne procese, dashboard widgete, javni CTA način (`booking | inquiry | order | quote`) in razširitve
- **11 profilov dejavnosti**: lepotni salon, frizer, barber, nohti, kozmetika, masaža, epilacija, šiviljstvo, **vulkanizer & avtoservis**, **čebelarstvo** + univerzalno
- **Matrika zmožnosti `required | optional | disabled`** — irelevantni moduli se nikjer ne izrisujejo (npr. čebelarstvo brez terminov, delovnih nalog in storitev)
- **Univerzalna delovna naročila** s konfigurabilnimi procesi (stopnje, validirani prehodi, popolna sled dogodkov)
- **Dinamični obrazci** — javna povpraševanja + admin inbox, urejanje polj brez kode, strežniška validacija vsakega polja
- **Evidence po razširitvah** (§13) — evidenca vozil in gum za vulanizerja, serije/žetev za čebelarstvo, mere za šiviljstvo; nova razširitev = samo vnos v register, brez kode in brez migracije
- **Katalog**: storitve, izdelki, variante, paketi (storitve + izdelki), ponudbe in računi s številčenjem po najemniku
- **Lastniška prilagoditev**: moduli vklop/izklop, dashboard widgeti, urejevalniki obrazcev in procesov — vse verzionirano, brez programiranja

### 🧩 Razširitve in več dejavnosti (EPIC #2)
- **Registry razširitev zmožnosti** — deklarativni vnosi z tipiziranimi odvisnostmi; nova razširitev = samo vnos v register + test ([vodnik](docs/ADD-NEW-TEMPLATE.md))
- **Projekti + naloge (E2-3)** — večnevski posli (fotograf/čistilec/šiviljstvo): pravilo zaključka (vse naloge DONE → projekt COMPLETED), opozorila rok
- **Inventarni runtime (E2-2)** — `StockMovement` LEDGER: prihod/odhod v transakciji, negativna zaloga zavrnjena, sledljivost serij prek `ExtensionRecord`
- **Več dejavnosti pod enim računom (E2-4)** — sekundarna panoga kot **unija zmožnosti**: moduli obeh se združijo, terminologija/obrazci/stran ostanejo od primarne (vulkanizer + trgovina)
- **Zgodovina konfiguracije + rollback (E2-5)** — append-only sled vsake spremembe modulov/obrazcev/procesov; povrnitev ustvari NOVO verzijo, zgodovina se nikoli ne prepiše

### 🚀 SaaS platforma (EPIC #3)
- **Objava/predogled strani** — DRAFT/PUBLISHED/UNPUBLISHED življenjski cikel, snapshot objave, povrnitev verzij vsebine
- **Naročnine + plani** — FREE/PRO/SCALE register, limiti pri novih vnosih, raba „X/Y“ z opozorili pri 80 %, Stripe checkout + idempotenten webhook, grace politika (neplačilo/downgrade **nikoli** ne briše podatkov — [GRACE-POLICY](docs/EPIC-3/GRACE-POLICY.md))
- **Lastne domene** — verifikacija prek Vercel Domains API (VERIFIED izključno s potrditvijo ponudnika), DNS navodila v UI, host-based razrešitev najemnika
- **Operaterska konzola `/platform`** — najemniki, naročnine, suspend/reaktivacija z revizijsko sledjo
- **React 19 `action={}` obrazci (F1)** — kritični obrazci na React 19 vzorec z kontroliranimi polji in FormData pomočniki (`src/lib/forms/form-data.ts`)

### 📊 Analitika in zdravje (EPIC #4)
Načrt ostankov po zaključku EPIC #3: platformna analitika v operaterski konzoli (E4-1: distribucija paketov, konverzija, odhod, prihodki, webhook zdravje — vse izpeljano iz obstoječih tabel), najemniška analitika (E4-2a: povpraševanja s poštenimi praznimi stanji; E4-2b: neobvezen lastni GA4 Measurement ID — skript izključno v objavljeni strani, platforma sama ne sledi), **webhook dnevnik napak (E4-3: vsaka neuspešna dostava vedno zabeležena, vidna v `/platform`, pošteno omejen zapisovalnik zoper zlorabe, idempotenca ostane)**, **najemniški Stripe ključi izključno lastniški vnos (E4-3b: env fallback odstranjen — platforma ne more imeti ključa)**, **nadaljevanje namestitve (E4-4: osnutek čarovnika v localStorage — „Nadaljuj, kjer si ostal?“ na `/start`, gesla strukturno izključena iz osnutka, TTL 7 dni, brisanje po uspešni kreaciji)**, health endpoint (§13) — [docs/EPIC-4/PLAN.md](docs/EPIC-4/PLAN.md)

### 🏢 Večnajemniškost (multi-tenant)
- Vsak salon dobi svojo javno stran pod `/s/[slug]` (npr. `/s/salon-luna/rezervacija`)
- **Izolacija najemnikov** — vsaka poizvedba org-scoped, shemski guardrail test zahteva `organizationId` + indeks na vseh najemniških modelih, runtime izolacijski skript
- **Profili dejavnosti** — vnaprej pripravljene predloge po panogi, ki jih lastnik lahko preglasi (overrides ne mutirajo skupnega profila)
- **Tema engine** — palete + pisave na nivoju organizacije, urejanje vsebine (hero, odprt čas, o nas …)
- **Samostojno vključitev (onboarding)** — nov salon se registrira na `/start`, izbere dejavnost in takoj dobi celotno stran z materializiranimi obrazci, procesi in katalogom

### 📅 Rezervacije
- Spletna rezervacija s pologom (znesek nastavi salon, privzeto **50 €**)
- Koledar z **uvojitvijo `Europe/Ljubljana`** — termini so natančni na časovni pas (date-fns tz)
- Preverjanje razpoložljivosti v realnem času, izbira storitve in osebja
- Preklic / prestavitev rezervacije s strani stranke
- Samodejna e-poštna potrdila in opomniki

### 🛍️ Trgovina (e-commerce)
- Katalog izdelkov s slikami, košarica (Zustand), Stripe checkout
- Upravljanje naročil in zalog v nadzorni plošči
- Valuta salona (EUR) — brez trdo kodiranih USD

### 💳 Stripe plačila — **admin vnese ključe sam**
Ni treba urejati environment spremenljivk! Lastnik salona v **Nastavitve → Plačila** sam vnese:
1. **Skrivni ključ** (`sk_live_…` / `sk_test_…`) — pred shranjevanjem se preveri prek Stripe API-ja
2. **Webhook skrivnost** (`whsec_…`) — za zanesljive potrditve plačil

Varnost:
- Ključ vnaša salon sam in je vezan na organizacijo (multi-tenant); platforma **nima skupnega ključa** — plačila vedno gredo neposredno na salona lastni Stripe račun
- Ključ se **nikoli** ne vrne brskalniku — samo maskiran prikaz (`sk_live_••••1234`)
- Webhook preverja podpis s skrivnostmi organizacij (vsak salon registrira endpoint v svojem Stripe računu) — brez platformne/env skrivnosti (E4-3b)
- Fallback na okolje je **namenoma odstranjen** (E4-3b): brez lastnega ključa se plačila elegantno degradirajo (prijazno sporočilo, brez sesutja)

### 🈸 Dvojezičnost (i18n)
- **Slovenščina (privzeto)** + angleščina, preklopnik v glavi
- Preveden celoten vmesnik: javne strani, rezervacije, trgovina, košarica, nadzorna plošča, staff portal, avtentikacija

### 👥 Vloge
| Vloga | Dostop |
|---|---|
| `ADMIN` | Nadzorna plošča: analitika, termini, storitve, izdelki, stranke, osebje, nastavitve, plačila |
| `STAFF` | Staff portal: lastni termini, urnik, stranke |
| `CLIENTE` | Rezervacije, trgovina, moji termini / naročila / ocene |

### 📧 E-pošta
React Email predloge: potrdilo rezervacije, opomnik 24 h, prestavitev, zaključen termin, no-show, aktivacija računa, ponastavitev gesla, potrdilo naročila.

## 🚀 Tehnologije

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Jezik:** TypeScript 5
- **Styling:** Tailwind CSS v4 + shadcn/ui + Phosphor/Lucide ikone
- **Baza:** PostgreSQL (Neon) + Prisma ORM
- **Avtentikacija:** NextAuth.js v5 (Prisma adapter)
- **Plačila:** Stripe (ključi na nivoju organizacije)
- **E-pošta:** React Email
- **Obrazci:** React Hook Form + Zod
- **Paketni upravitelj:** pnpm

## 📦 Lokalna namestitev

```bash
# 1. Namesti odvisnosti
pnpm install

# 2. Nastavi okolje
cp .env.example .env   # izpolni spodnje spremenljivke

# 3. Baza
pnpm prisma generate
pnpm db:push           # ali: pnpm db:migrate
pnpm db:seed           # (neobvezno) vzorčni podatki

# 4. Zaženi
pnpm dev               # http://localhost:3000
```

### Okoljske spremenljivke

```env
DATABASE_URL="postgresql://user:password@localhost:5432/beauty_salon"
AUTH_SECRET=""              # openssl rand -base64 32
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Stripe — NEOBVEZNO in NEDOSTOJNO za najemniška plačila: ključe vnese
# vsak salon lastnik v Nastavitve → Plačila (E4-3b: env fallback je odstranjen)
# PLATFORM_STRIPE_* pa so izključno platformin lastni račun za naročnine SaaS
```

> 💡 Najemniški Stripe ključi se VEDNO vnesejo prek nadzorne plošče (lastnik salona) — platforma ne hrani skupnega ključa. `PLATFORM_STRIPE_*` velja samo za platformin lastni račun za naročnine.

## 💳 Nastavitev Stripe (za lastnika salona)

1. Prijavi se kot admin → **Nastavitve → Plačila**
2. V [Stripe Dashboard → Developers → API keys](https://dashboard.stripe.com/apikeys) kopiraj **Secret key** (`sk_test_…` za testiranje, `sk_live_…` za produkcijo)
3. Prilepi v aplikacijo → **»Shrani in preveri ključ«** — aplikacija takoj preveri veljavnost ključa prek Stripe API-ja
4. (Priporočeno) V Stripe: **Developers → Webhooks → Add endpoint**:
   - Naslov: `https://tvoja-domena.si/api/webhooks/stripe`
   - Dogodek: `checkout.session.completed`
   - Skrivnost (`whsec_…`) prilepi v **Nastavitve → Plačila**
5. Status se spremeni v »Testni način« / »Živi način« — plačila so aktivna ✅

## 🗂️ Struktura projekta

```
src/
├── app/
│   ├── (public)/            # Javne strani (na /s/slug preko proxyja)
│   │   ├── page.tsx         # Domov
│   │   ├── booking/         # Rezervacija (+ uspeh / preklic)
│   │   ├── services/        # Storitve
│   │   └── staff/           # Osebje
│   ├── (customer)/          # Strankov portal
│   │   ├── shop/            # Trgovina
│   │   ├── cart/ checkout/  # Košarica + blagajna
│   │   └── my-appointments/ my-orders/ my-reviews/ my-account/
│   ├── (staff)/             # Staff portal
│   ├── (admin)/dashboard/   # Nadzorna plošča
│   │   ├── analytics/ appointments/ orders/
│   │   ├── products/ services/ users/ staff/
│   │   └── settings/        # Nastavitve (vklj. zavihek Plačila)
│   ├── (auth)/              # Prijava, registracija, /start (onboarding) …
│   ├── actions/             # Server Actions (appointments, payments, …)
│   └── api/webhooks/stripe/ # Stripe webhook (večnajemniška verifikacija)
├── components/              # UI + dashboard + booking + shop komponente
├── lib/
│   ├── i18n/                # SL/EN slovarji + provider
│   ├── verticals.ts         # Panoge: palete, pisave, vzorčne vsebine
│   ├── stripe.ts            # Stripe na nivoju organizacije + validacija ključev
│   ├── booking-time.ts      # Časovni pasi (Europe/Ljubljana)
│   ├── org-path.ts          # orgPath() — /s/slug predpone
│   ├── auth/                # NextAuth + guards (requireRole …)
│   └── email/               # React Email predloge
└── proxy.ts                 # Middleware: /s/[slug]/* → /* + x-org-slug + role guards
```

## 🏗️ Kako deluje večnajemniškost

1. Zahteva na `/s/salon-luna/booking` → middleware (`src/proxy.ts`) prepiše na `/booking` in nastavi glavo `x-org-slug: salon-luna`
2. Vse poizvedbe v bazi se filtrirajo po organizaciji (`src/lib/tenant.ts`)
3. Vsaka organizacija ima svoje: temo, vsebino, storitve, osebje, stranke, izdelke, Stripe ključe, valuta in časovni pas
4. Nov salon: registracija na `/start` → izbira panoge (vertikale) → samodejno ustvarjanje kategorij, storitev in teme

## 🚢 Deployment

### Vercel + Neon (trenutna nastavitev)
1. Repo povezan z Vercelom — vsak push na `main` se samodejno deploya
2. Baza: [Neon](https://neon.tech) PostgreSQL
3. Webhook endpoint: `https://rcbeautysalon-phi.vercel.app/api/webhooks/stripe`

### Drugi ponudniki baz
Neon ✅ · Supabase · Railway — katerikoli PostgreSQL

## 🛠️ Razvoj

```bash
pnpm dev          # dev strežnik (Turbopack)
pnpm build        # produkcijski build
pnpm lint         # ESLint
pnpm test         # vitest — profilni motor, razširitve, unija dejavnosti, zgodovina konfiguracije, viri v razporejevalniku, obrazni FormData vrata, platformna + najemniška analitika (302 testov)
DATABASE_URL=… bun scripts/verify-tenant-isolation.ts   # runtime preverba izolacije najemnikov
pnpm format       # Prettier
pnpm db:studio    # Prisma Studio (GUI za bazo)
pnpm db:seed      # vzorčni podatki
```

Arhitektura in fazni načrti:
- EPIC #1 (univerzalna platforma): [`docs/EPIC-1/ARCHITECTURE.md`](docs/EPIC-1/ARCHITECTURE.md)
- EPIC #2 (razširitve po panogah): [`docs/EPIC-2/PLAN.md`](docs/EPIC-2/PLAN.md)
- EPIC #3 (SaaS platforma): [`docs/EPIC-3/PLAN.md`](docs/EPIC-3/PLAN.md)
- EPIC #4 (analitika + zdravje): [`docs/EPIC-4/PLAN.md`](docs/EPIC-4/PLAN.md)
- **Nov profil/razširitev v 1 datoteki + 1 testu:** [`docs/ADD-NEW-TEMPLATE.md`](docs/ADD-NEW-TEMPLATE.md)

## 📄 Licenca

Proprietary — vse pravice pridržane.

---

Zgrajeno z ❤️ — Next.js 16, React 19, Tailwind CSS v4 · 🇸🇮 po slovensko
