# Grace politika pri neplačilu / downgrade (EPIC #3 — E3-7)

**Načelo:** padec paketa NIKOLI ne izbriše podatkov najemnika. Limiti
samo zaprejo ustvarjanje NOVIH vnosov, dokler raba ne pade pod
omejitev novega paketa.

## Kdaj se entitlementi spremenijo (že implementirano v E3-4 webhooku)

| Stanje naročnine | Efektivni paket | Razlaga |
|---|---|---|
| `ACTIVE`, `TRIALING` | plačani paket | normalno delovanje |
| `PAST_DUE` | **plačani paket (grace)** | plačilo je zamujeno, vendar v obdobju poskusa obračuna — najemnik ne ostane brez funkcij zaradi začasne napake kartice |
| `CANCELED`, `UNPAID` | `free` | entitlementi padejo na FREE, podatki ostanejo |
| `INCOMPLETE` | brez spremembe | prehodno checkout stanje ne podreja sred plačila |

Fail-closed pravilo: nepotrjena stanja nikoli ne povišajo
entitlementov; prehodna checkout stanja ne podrejajo sred plačila.

## Kaj se zgodi ob prekoračitvi limita (downgrade tolerance)

- **Obstoječa vsebina** (storitve, izdelki, zaposleni, domene, mediji,
  naročila) ostane delujoča in vidna — nič ni skrito, blokirano ali
  izbrisano.
- **NOVI vnosi** so blokirani na strežniški strani
  (`checkPlanLimit` / `checkStorageLimit`), ne le v UI:
  - storitve/izdelki/zaposleni/lastne domene → server actions vrnejo
    `{ success: false, code: "LIMIT_REACHED", message }` (429-semantika,
    dvojezično sporočilo po jeziku upravitelja),
  - **shramba** → DB-backed upload ruta vrne HTTP 429 z dvojezičnim
    sporočilom; obstoječe slike ostanejo, nove nalaganje se ustavi,
  - **naročila (mesec)** → checkout ustvarjanja naročila vrne
    **nevtralno sporočilo za končno stranko** (brez razkritja paketa
    najemnika); lastnik vidi realni števec v Nastavitvah → Paket.
- Ustvarjanje se sprosti samodejno, ko raba pade pod omejitev
  (brisanje vsebine ali nadgradnja paketa) — ni ročnih resetov.

## Številski števci (E3-7) — izvedba brez dvojnega knjiženja

Vsi števci so **derivirani** iz obstoječih tabel ob vsaki zahtevi
(`src/lib/plans/resolve.ts`):

| Števec | Vir | Opomba |
|---|---|---|
| storitve | `Service.count` | |
| izdelki | `Product.count` | |
| osebje | `Staff.count` | |
| lastne domene | `CustomDomain.count` | E3-6 |
| shramba | `Media.aggregate(_sum: size)` | org-scoped vrstice; Cloudinary meri zunanji ponudnik |
| naročila (mesec) | `Order.count(createdAt >= monthStartUtc)` | UTC mesečna meja |

Posledica: števci so vedno skladni z resničnim stanjem — ne morejo
„razhajati“ z bazo, ker niso shranjeni.

## Meje odgovornosti (poštena izvedba)

- Grace politika je **podatkovna** (ne briše), ne pravna: davčna
  obravnava in pravna soglasja niso predmet te zadeve (issue §8).
- Storage gate velja za platformno (DB) shrambo; Cloudinary ima svoje
  kvote in merjenje.
- Mesečni orders števec teče v UTC; terminsko obdobje naročnine v
  Stripe ni povezano z mesečno mejo naročil (ločeni koncepti).
