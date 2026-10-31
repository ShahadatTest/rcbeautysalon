# E2E testna zbirka (EPIC #3 E3-8)

Playwright E2E pokriva sprejemne scenarije **§16 A–E** iz issue #3 z
realnimi tokovi in persistentnimi podatki.

## Zagon

```bash
# 1. Izolirana testna baza (enkrat) — NIKOLI produkcija:
#    ustvariPostgres bazo (npr. `rcbeauty_e2e`), potem:
export E2E_DATABASE_URL="postgresql://…/rcbeauty_e2e?sslmode=require"
bunx prisma db push --skip-generate   # shema iz prisma/schema.prisma
bun prisma/seed.ts                    # platform operator (admin@rcbeautysalon.org / admin123)

# 2. Celotna zbirka (sama požene `next build` + `next start` na :3123):
bun run test:e2e
```

Konfiguracija: `playwright.config.ts` — produkcijski build proti
izolirani bazi, 1 worker, deterministični vrstni red.

## Scenariji

| Spec | §16 | Pokritje |
|---|---|---|
| `a-beauty.spec.ts` | A | registracija (čarovnik), katalog, objava, javna stran, rezervacijski čarovnik, koledar terminov, upgrade paketa |
| `b-tire-service.spec.ts` | B | vertikalna stran (vulkanizer), delovni nalogi, izolacija najemnikov (neznani slug → vzdrževalna stran) |
| `c-beekeeping.spec.ts` | C | trgovina z medom, košarica, vrata checkouta, brez rezervacij (preusmeritev na povpraševanje) |
| `d-seamstress.spec.ts` | D | povpraševanja → delovni prostor, brez vsiljene trgovine/rezervacij |
| `e-saas-lifecycle.spec.ts` | E | zasebnost drafta → objava → domena (PENDING) → entitlementi → downgrade OB IZGUBI podatkov → operaterska konzola |
| `idor.spec.ts` | E.8 | cross-tenant branje/urejanje (tuji id-i), /platform za najemniškega admina, mediji po neznanih id-jih |

## Znana omejitev testnega okolja (pošteno dokumentirano)

**Server actions iz RHF `<form onSubmit>` handlerjev se tiho obesijo**
v produkcijskem buildu (lokalno IN na Vercelu): noben omrežni klic, noben
toast, `isSubmitting` ujame. Vzorec:

- ✅ deluje: server action iz `onClick` (čarovnik, objava, preklop paketa,
  operaterske akcije), `signIn` (navaden fetch), RHF validacija sama
  (prazen submit pokaže napake polj)
- ❌ obese: `createProduct`/`createService`/`createPublicBooking`/
  `submitPublicForm`/`createProductCheckoutSession` — vse poklicane iz
  RHF `handleSubmit`

Obvozna pot: kataloški podatki (storitve/izdelki/rezervacije/oddaje) so
**fixture-i** prek PrismaClient neposredno v izolirano bazo; vsi tokovi
okoli njih (objava, javna stran, delovni prostor, paketi, domene,
operator, IDOR) so realni UI tokovi. Administratorski CRUD obrazci so
verificirani ročno na produkcijskem UI. Spremljanje in migracija obrazcev
na React 19 `action={}` vzorec je ločen follow-up.

Zgodovina preiskave: `reactCompiler: true` je v produkcijskem buildu
popolnoma odvezal form submit dogodke (v dev deluje!) — izklopljen v
`next.config.ts` z regresijsko zaščito te E2E zbirke.
