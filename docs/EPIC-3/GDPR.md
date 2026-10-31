# GDPR dokument (EPIC #3 E3-8)

> Opomba: to je tehnični mapping podatkov in tokov, ne pravno mnenje
> (issue §8 izrecno prepoveduje izmišljanje pravne skladnosti).

## 1. Mapping osebnih podatkov

| Model | Podatki | Nosilec obdelave | Namen |
|---|---|---|---|
| `User` | ime, e-pošta, geslo (bcrypt), avatar, resetToken+expiry | platforma | prijava, račun |
| `Customer` | ime, e-pošta, telefon, opombe | najemnik (salon) | rezervacije, naročila, marketing najemnika |
| `Appointment` | termin, storitev, staff, guest ime/e-pošta/telefon | najemnik | rezervacije |
| `Order`/`OrderItem` | naročila, stripePaymentIntentId | najemnik (+Stripe za plačilo) | e-trgovina |
| `FormSubmission` | oddane vsebine obrazcev (JSON, vklj. kontakt) | najemnik | povpraševanja |
| `Media` | slike (base64), filename | najemnik/platforma | vsebina strani |
| `PlatformSubscription`/`PlatformBillingEvent` | naročnina, zneski, stripeCustomerId | platforma | obračunavanje SaaS |
| `PlatformAuditLog` | operaterska dejanja (brez vsebine) | platforma | revizijska sled |
| `Account`/`Session`/`VerificationToken` | OAuth/session žetoni | platforma | avtentikacija |
| `NotificationPreferences` | Preference obvestil | platforma | obvestila |

Kreditne kartice se **nikoli** ne shranjujejo (Stripe hosted checkout).

## 2. Zadrževanje (retention)

- `User.resetTokenExpiry` — žetoni za ponastavitev potečejo (polje že
  obstaja); potekle žetone se lahko pobere s periodičnim brisanjem.
- `Session` — življenjska doba po NextAuth konfiguraciji.
- `FormSubmission`/`Appointment`/`Order` — poslovni podatki najemnika;
  brisanje najemnika (spodaj) jih kaskadno odstrani.
- `PlatformAuditLog` — append-only, nič ne briše (revizijska dolžnost).

## 3. Izvoz podatkov (data export)

Trenutno stanje (pošteno): **ni samodejnega izvoza v UI.** Tok za
izvedbo (ročno, na zahtevo):

1. Najemnik: `prisma` poizvedba po vseh org-scoped modelih
   (`Service, Product, Staff, Customer, Appointment, Order,
   FormSubmission, CustomDomain, SalonConfig, Media meta`) → JSON
   export → dobava lastniku.
2. Posamezen uporabnik: `User` + povezani `Customer`/`Appointment`/
   `Order` zapisi po e-poštni identifikatorju.
3. Mediji: `Media` vrstice (base64) + Cloudinary URL-ji, kjer so v rabi.

## 4. Brisanje (right to erasure)

**Najemnik (celoten salon):**
1. Operater v `/platform` ustavi najemnika (SUSPENDED — takojšnja izklop).
2. Brisanje: `prisma.organization.delete()` — shema kaskadno briše vse
   org-scoped modele (slabši-scoped: `Media.organizationId` je
   SetNull → te vrstice je treba pobrisati ročno; `User` ostane —
   glej spodaj).
3. Preveriti: `CustomDomain` zapisi se odstranijo tudi iz Vercel
   Domains API (ročni korak operaterja — DB kaskada ne pokliče API-ja).

**Posamezen uporabnik (stranka/uporabnik):**
1. `User` brisanje kaskadira `Account`/`Session`/`NotificationPreferences`.
2. `Customer` profil najemnika: brisanje + anonimizacija povezanih
   `Appointment`/`Order` vrstic (customerId → null prek SetNull) ali
   izbris — odločitev najemnika; številke računov se anonimizirajo, ne
   brišejo (računovodske dolžnosti).
3. `Media` (avatarji brez org) — ročno brisanje po id.

## 5. Varnostni ukrepi (izvedeno)

- Strežniško uveljavljanje org-scopinga na vsaki akciji
  (`requireAdminOrg`) + IDOR E2E (`e2e/idor.spec.ts`).
- Gesla: bcrypt (12 rund). Secreti: env varijable, nikoli v klientu.
- Stripe webhook: validacija podpisa + idempotenca.
- Uploadi: le slike, 5 MB omejitev, strežniško generirani ID-ji,
  quota gate (E3-7).
- Revizijska sled operaterskih dejanj (E3-5).

## 6. Odprte točke (poštene)

- Samodejni izvoz/brisanje v UI: ni implementirano (ročni tok zgoraj).
- Cloudinary: shramba pri tretjem ponudniku — brisanje org ne briše
  Cloudinary virov (ročno/periodično čiščenje po javnih ID-jih).
- Logi strežnika (Vercel) lahko vsebujejo e-pošte — zadrževanje po
  Vercel politikah.
