# Rollback & backup postopek (EPIC #3 E3-8)

## 1. Backup baze (Neon)

- **Point-in-time restore (PITR)**: Neon ohranja zgodovino (glede na
  paket do 7 dni); obnova v nov branch/databazo prek Neon konzole ali
  API. To je primarni mehanizem — ni treba lastnih dumpov.
- **Ročni dump pred destruktivnimi spremembami**:
  ```bash
  pg_dump "$DATABASE_URL_UNPOOLED" --schema+data -Fc -f backup-$(date +%F).dump
  ```
- **Verifikacija backupa**: obnovi v začasno bazo (`rcbeauty-restore`)
  in poženi aplikacijo proti njej; preveri `Organization` števec in
  prijavo.

## 2. Migracije (Prisma)

- Vse faze EPIC #3 so **aditivne** (nove tabele/stolpci, brez brisanja)
  — rollback = redeploy prejšnjega commita; nove tabele ostanejo
  neškodljive (stara koda jih ne bere).
- ⚠️ **Znana omejitev**: migracijska zgodovina ni ponovljiva iz nič
  (`20251030000000…` predpostavlja pred-migracijsko stanje). Za NOVO
  okolje uporabi `prisma db push` (shema iz schema.prisma) namesto
  `migrate deploy` — dokumentirano tudi v docs/EPIC-3/E2E.md.
  Priporočen follow-up: squash baseline migracije.
- Pred vsako migracijo na produkciji: ročni dump (§1) + `prisma
  migrate status` (vseh 7 apliciranih).

## 3. Rollback aplikacije (Vercel)

1. **Prejšnji deployment**: Vercel dashboard → Deployments → zadnji
   READY pred spremembo → **Promote to Production** (instant rollback,
   brez builda). Preko API:
   `POST /v13/deployments/{id}/rollback`? — trenutno najzanesljiveje
   Promote prek UI ali redeploy prejšnjega SHA:
   ```bash
   curl -X POST "https://api.vercel.com/v13/deployments?teamId=$T" \
     -H "Authorization: Bearer $VERCEL_TOKEN" \
     -d '{"target":"production","gitSource":{"type":"github",
          "repoId":1439750918,"ref":"main","commit":"<prejšnji SHA>"}}'
   ```
2. **Rollback env varijable**: če je sprememba vključevala env —
   Vercel → Settings → Environment Variables → zgodovina vrednosti.
3. **Baza po rollbacku kode**: aditivne migracije zahtevajo NIČ
   (stara koda dela brez novih tabel); nevrni (breaking) koraki so v
   EPIC #3 izrecno prepovedani.

## 4. Rollback scenariji EPIC #3

| Scenarij | Postopek |
|---|---|
| Napaka v novi fazi kode | Promote prejšnjega Vercel deploymenta (§3.1) |
| Slaba migracija (aditivna) | Koda nazaj; tabela ostane; po potrebi `DROP TABLE` ročno po dumpu |
| Razpokan Stripe webhook | Webhooki so idempotentni (`PlatformBillingEvent.stripeEventId` unique); replay dogodkov v Stripe dashboardu |
| Pokvarjena domena (E3-6) | Odstrani `CustomDomain` v DB + `DELETE /v9/projects/{id}/domains/{domain}` prek API — statusni avtomat nikoli ne vrne VERIFIED brez ponudnika |
| Suspendiran najemnik po pomoti | `/platform` → Reaktiviraj (audit zabeležen) |
| Izguba podatkov najemnika | Neon PITR do točke pred incidentom v branch → preveri → prenesi org-scoped vrstice nazaj |

## 5. Sekvencia ob incidentu (checklist)

1. Ustavi prihajajoče spremembe (zaženi znan dober deployment).
2. Oceni obseg: koda / env / baza / tretji ponudniki.
3. Koda → §3; baza → §1 PITR; domene → §4.
4. Komuniciraj najemnikom (sprememba je vidna le kot vzdrževalna stran
   — podatki nikoli ne izginejo: grace politika, docs/EPIC-3/GRACE-POLICY.md).
5. Post-incident: dopiši dnevnik odločitev v PLAN.md.
