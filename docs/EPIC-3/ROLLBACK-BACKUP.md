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

## 6. Priprava na opozorila (E4-5 — §13 spremljanje, napake in operativna opozorila)

### 6.1 Končne točke za zdravje (zdravstveni končni točki)

| Končna točka | Dostop | Vsebina | Namen |
|---|---|---|---|
| `GET /api/health` | javen | `status:"ok"`, različica, commit, časovni žig — **brez DB, brez občutljivih podatkov** | zunanji spremljevalnik razpoložljivosti (odgovor < 200 ms; odsoten/časovno omejen odgovor = signal napake) |
| `GET /api/health/internal` | samo operater (`PLATFORM_ADMIN_EMAILS`, fail-closed) | `status: ok\|degraded`, DB ping (ms), stanje migracij (`_prisma_migrations`: aplicirano/nedokončano/najnovejše), števci napak webhookov (24 h / 7 dni / po razlogih) | resnično stanje za operaterja; nič občutljivega (nobenih payloadov, e-pošte ali sporočil napak DB — tveganje povezovalnega niza) |

**Odločitev o statusu (čista funkcija `healthStatusFor`, prag 20/24 h):** `degraded`, kadar je DB nedosegljiva **ali** obstaja nedokončana migracija **ali** so napake webhookov ≥ 20/24 h. Prag je konstanta v kodi (`WEBHOOK_FAILURE_ALERT_THRESHOLD`) — ista številka je vidna v `/platform` Analitika.

### 6.2 Kaj priključiti na opozorila (ko se platforma skalira)

1. **Zunanji monitor razpoložljivosti** (npr. UptimeRobot / Better Stack / Vercel Observability): interval 5 min na `GET /api/health`, opozorilo ob != 200 ali > 2 s. To je edini signal, ki ga je mogoče avtomatizirati brez prijave — notranja končna točka ostane fail-closed (prijava operaterja), po mnenju načrta namenoma brez dodatnega skrivnega žetona.
2. **Napake webhookov**: prag — opozorilo, ko `webhookFailures.last24h >= 20` (notranja končna točka ali ploščica na `/platform`). Vzrok je skoraj vedo napačno konfiguriran endpoint v Stripe računu najemnika (glej razloge v dnevniku napak na `/platform`).
3. **Migracije**: `migrations.unfinished > 0` = deploy ni zaključen (Vercel build poganja `prisma migrate deploy` — neuspel build pomeni, da je ohranjen zadnji delujoč deployment, §3). Preveri Vercel build log.
4. **Baza**: Neon nadzorna plošča (poraba, PITR ohranjenost) + §1 postopki.

### 6.3 Razlaga števcev napak webhookov (razlogi)

`missing_signature` (anonimen poskus brez podpisa — pričakovano ob spamu), `not_configured` (platformni sloj brez skrivnosti), `signature_invalid` (napačna skrivnost / podpisan drug vsebina — preveri endpoint v Stripe), `no_tenant_scope` (dogodek brez prepoznavnega najemnika — preveri metadata orgId), `processing_error` (napaka pri apliciranju — glej podrobnosti v dnevniku `/platform`). Ponovno pošiljanje VARNO prek Stripe Resend (idempotenca ostaja; platforma nikoli ne ponovi surovih payloadov — E4-3).
