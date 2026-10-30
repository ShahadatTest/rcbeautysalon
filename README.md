# RC Beauty Salon — večnajemniška platforma za salone lepote

Sodobna full-stack platforma za upravljanje frizerskih in kozmetičnih salonov, zgrajena z **Next.js 16**, **React 19**, **TypeScript** in **Tailwind CSS v4**.

🌐 **V živo:** [https://rcbeautysalon-phi.vercel.app](https://rcbeautysalon-phi.vercel.app)

Ena namestitev streže **več neodvisnim salonom** — vsak s svojo domeno (`/s/ime-salona`), temo, vsebino, storitvami, osebjem in plačili.

## ✨ Zmožnosti

### 🏢 Večnajemniškost (multi-tenant)
- Vsak salon dobi svojo javno stran pod `/s/[slug]` (npr. `/s/salon-luna/rezervacija`)
- **Vertikale** — vnaprej pripravljeni predloge po panogi: frizer, barber, nohti, lepota, masaža, depilacija, splošno
- Vsaka vertikala prinese lastne kategorije, vzorčne storitve, barvno paleto, pisave in besedila
- **Tema engine** — palete + pisave na nivoju organizacije, urejanje vsebine (hero, odprt čas, o nas …)
- **Samostojno vključitev (onboarding)** — nov salon se registrira na `/start` in takoj dobi celotno stran

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
- Ključ je vezan na organizacijo (multi-tenant) in se shrani le strežniško
- Ključ se **nikoli** ne vrne brskalniku — samo maskiran prikaz (`sk_live_••••1234`)
- Webhook preverja podpis za vse najemnike (env skrivnost + skrivnosti vseh organizacij)
- Fallback: če organizacija nima ključa, se uporabi `STRIPE_SECRET_KEY` iz okolja
- Plačila se elegantno degradirajo, ko ključ ni nastavljen (prijazno sporočilo, brez sesutja)

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

# Stripe — NEOBVEZNO: admin lahko ključe vnese v Nastavitve → Plačila
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
```

> 💡 Stripe ključi v okolju so le platformni fallback. Priporočeno je, da vsak salon vnese svoje ključe prek nadzorne plošče — brez ponovnega deploya.

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
pnpm format       # Prettier
pnpm db:studio    # Prisma Studio (GUI za bazo)
pnpm db:seed      # vzorčni podatki
```

## 📄 Licenca

Proprietary — vse pravice pridržane.

---

Zgrajeno z ❤️ — Next.js 16, React 19, Tailwind CSS v4 · 🇸🇮 po slovensko
