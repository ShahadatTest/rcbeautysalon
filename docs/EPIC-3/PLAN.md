# EPIC #3 — SaaS platforma za samopostrežno izgradnjo posla: revizija, vrzeli in fazni načrt

> Sklic: GitHub Issue #3 — *FEATURE: Launch the Self-Service SaaS Business Builder, Website Publishing and Subscription Platform*
> Nadrejeni: Issue #1 (univerzalno jedro — **dokončano**), Issue #2 (templatni motor — načrt: `docs/EPIC-2/PLAN.md`).
> Status dokumenta: **Faza 0 (revizija + preslikava + načrt)**, kot zahteva §1 in „Implementation instruction" issue-ja #3.
> Načelo: obstoječa delujoča funkcionalnost se ohranja; nič se ne nadomešča z moki; vsaka faza ima merljive akceptančne teste.

---

## 1. Revizija obstoječe infrastrukture (Phase 0 — inventory)

| Področje | Dejansko stanje (preverjeno v repozitoriju) | Pomen za #3 |
|---|---|---|
| Gostovanje | Vercel (samodejni deployment iz `main`, produkcijska domena `rcbeautysalon-phi.vercel.app`) | §7 poddomene: Vercel podpira wildcard poddomene/domen API; odločitev o ponudniku se dokumentira, ne trdo kodira |
| Baza | Neon PostgreSQL (Prisma, aditivne migracije; 7 najemnikov v produkciji) | primerno za SaaS start; backup politika Neon plasti se dokumentira v Fazi 4 |
| Auth | NextAuth v5 (JWT), vloge ADMIN/STAFF/CLIENTE, seka nosi `organizationId` | §2 samopostrežna registracija **obstaja** (`/start`, `/login`); e-poštna verifikacija in obnovitev: obstaja „pozabljeno geslo“, verifikacija ni vklopljena |
| Večnajemništvo | `proxy.ts` (`/s/[slug]` + `x-org-slug`), org-scoped akcije (19 datotek), shemski guardrail + runtime izolacijski skript + testi | §11 izpolnjeno na potni osnovi; **poddomene še ne** |
| Spletna stran najemnika | profilno poganjana javna stran (CTA načini booking/inquiry/order/quote), SiteContent JSON urejevalnik (7 sekcij, vidnost), paleta/pisave, SEO polja | §4 no-code urejevalnik **delno obstaja**; manjka: vrstni red/dodajanje sekcij, draft/predogled/objava življenjski cikel |
| Plačila | Stripe **po najemniku** (šifrirani per-org ključi, večnajemniški webhook z validacijo podpisa, idempotenca) — plačila, ki jih najemnik pobira svojim strankam | §5 ločitev tokov: to je tok #1 (tenant customers) in je REALNO delujoč; **tok #2 (naročnina platformi) ne obstaja** |
| Načrti/naročnine | `Organization.plan` in `Organization.status` (String) — **nekonsumentirana polja**, brez entitlementov, brez obračunavanja | §8 v celoti manjka |
| Operator konzola | ne obstaja (admin pristopi le svojemu najemniku; platforme ni „super-admin“) | §10 v celoti manjka |
| Metrija/uporaba | ne obstaja (ni števcev, limitov, opozoril) | §12 v celoti manjka |
| Domene | samo potne domene `/s/[slug]`; ni DNS/SSL toka | §7 v celoti manjka |
| E-pošta | SMTP prek env, nevtralni predlogi, po najemniku | dovolj za Fazo 1–2; verifikacijska/obračunska pošta se doda z naročninami |
| Testi | 71 vitest (profili, overrides, validacija, shemski guardrail) + runtime izolacijski skript | temelj za §13; E2E ogrodje (playwright) še ni v repoju |

**Zaključek:** faze 1–2 so zelo velik del že zgrajene (računi, najemniki, onboarding, profilno generirana stran + delovni prostor, no-code urejanje vsebine, izolacija s testi). Ključne manjkajoče plasti: **objavni življenjski cikel**, **komercialni sloj (načrti/entitlementi/naročnine)**, **operator konzola**, **domene**, **metrija**.

---

## 2. Preslikava zahtev #3 na obstoječe stanje

| Zahteva #3 | Stanje |
|---|---|
| §2 samopostrežen onboarding (registracija → aktivnost → startna nastavitev → predogled → objava) | ✅ do „predogleda“: `/start` ustvari najemnika + katalog + materializirane obrazce/procese; ❌ shranjevanje napredka (resume), ❌ objavni cikel |
| §3 takoj generirana stran + delovni prostor | ✅ realno, editable, per-tenant (brez mokov) |
| §4 no-code urejevalnik | ⚠️ besedila/sekcije vidnost/paleta/pisave/logo/SEO — da; ❌ dodajanje/vrstni red sekcij, ❌ draft/objava, ❌ razveljavitev |
| §5 zmožnostno poganjana funkcionalnost | ✅ capability matrika + overrides (strežniško preverjeni); ločitev plačilnih tokov (najemnik vs platforma) arhitekturno jasna |
| §6 draft/predogled/objava | ❌ stran je živa takoj po onboarding-u; ni zasebnega drafta, ni validacije pred objavo, ni nepublikiranja |
| §7 poddomene + custom domene | ❌ |
| §8 načrti/entitlementi/naročnine | ❌ (samo nekonsumentirana `plan` polja) |
| §9 plačilni adapter (platforma) | ❌ (per-tenant Stripe ne pokriva naročnin) |
| §10 operator konzola | ❌ |
| §11 multi-najemniški model | ✅ (uporabnik → več najemnikov, izolacija s testi) |
| §12 metrija + uveljavljanje limitov | ❌ |
| §13 varnost/zasebnost | ⚠️ izolacija+audit delno; GDPR mapping, retention, monitoring: dokumentacija manjka |
| §14 UX kakovost | ✅ nevtralna platformna identiteta, odzivno, i18n sl/en admin; ❌ prazna stanja ne povsod |
| §15 analitika | ❌ |
| §16 akceptančni scenariji A–E | A–D delno že E2E potrjeni (brez objavnega cikla in naročnin); E v celoti manjka |

---

## 3. Fazni načrt (prilagojen repoju; vsaka faza = majhni, pregledni sklopi)

| Faza | Vsebina | Akceptančni kriteriji | Status |
|---|---|---|---|
| **E3-0** (ta dostava) | Ta dokument; evidentirane odvisnosti (Vercel/Neon/Stripe/SMTP); odločitev, da se domene in takse NE fejkajo | revizija objavljena; ni trdih kodiranj ponudnikov | ✅ |
| **E3-1 Objavni življenjski cikel** | `SitePublication` stanje na najemniku (`DRAFT/PUBLISHED/UNPUBLISHED`), privzeto **DRAFT** za NOVE najemnike; obstoječi 7 najemnikov migrirani v `PUBLISHED` (brez behavior change); javna stran vrne vzdrževalno stran za DRAFT (vidna le lastniku/adminu z predogledom); „Objavi“ v nastavitvah z validacijo (ime, kontakt, vsaj 1 storitev/izdelek po profilu); „Nepublikiraj“ s potrditvijo | nov najemnik: javna stran = vzdrževalna; objava: živa; nepublikacija: vzdrževalna; fail objave ne spremeni stanja; testi | ✅ |
| **E3-2 Predogled + urejevalnik dodelave** | predogled objave (draft vsebina vs objavljena), dodajanje/preurejanje sekcij v SiteContent (aditivno, tolerant merge ohranjen), razveljavitev na zadnjo objavljeno verzijo (`SiteContent` verzija + shranjena snapshot polja) | urejevalnik: dodaj sekcijo → predogled → objavi → javno mesto; povrni → nazaj na objavljeno | ✅ |
| **E3-3 Načrti + entitlementi (brez plačil)** | konfigurabilni `Plan` (v kodi/registru, zod-validiran: limiti — št. izdelkov/storitev/osebkov/storage; zmožnosti pro; `FREE/PRO/SCALE`), strežniško uveljavljanje pri kreiranju vsebin (429 z razumljivim sporočilom), uporaba prikazana v Nastavitvah | lastnik na FREE ne more prekoračiti limitov prek API-ja; upgrade v UI spremeni entitlemente (plačilni sloj sledi) | ⏳ |
| **E3-4 Naročnine + plačilni adapter** | ločen platformni Stripe račun (env `PLATFORM_STRIPE_*`), adapter vmesnik (`PaymentProvider`), hosted checkout za naročnino, webhook z idempotenco in validacijo podpisa, `Subscription` stanje per najemnik, obračunsko zgodovino; **brez konfiguriranega ključa: jasen „setup required“ stanje, ni fake uspeha** | upgrade/deactivate/renewal gnano IZKLJUČNO s webhook dogodki; ni označenega plačila brez potrditve ponudnika; testi idempotence | ⏳ |
| **E3-5 Operator konzola** | `/platform` (vrata ločena od najemniškega admina; dostop prek `PLATFORM_ADMIN_EMAILS` env + ločen role check), seznami najemnikov/naročnin/objav/uporabe, suspend/reaktivacija z razlogom + audit trail; ni izpostavljena najemniškim lastnikom | operator vidi in upravlja; najemnik ne more dostopati (test); vsako dejanje v sledi | ⏳ |
| **E3-6 Domene (priprava + implementacija po evidence)** | `CustomDomain` model (org-scoped, status PENDING/VERIFIED/FAILED, primarna domena), DNS navodila v UI, verifikacija prek Vercel Domains API ko je token konfiguriran; **ne označi povezane/SSL, dokler ponudnik ne potrdi** | brez tokena: UI pokaže „konfiguracija ponudnika manjka“; s tokenom: realna verifikacija; konflikti slugs/domain | ⏳ |
| **E3-7 Metrija + opozorila** | uporabniški števci (izdelki/storitve/osebje/storage/orders) iz obstoječih tabel (brez dvojnega knjiženja), prikaz „X/Y“ + opozorilo pri 80 %, grace politika pri neplačilu dokumentirana (ne briše podatkov) | limiti se pokažejo pred blokado; downgrade/neplačilo NE izbriše podatkov | ⏳ |
| **E3-8 Trdnjava + E2E** | Playwright E2E: scenariji §16 A–E (vključno E: registracija→draft→objava→upgrade→neplačilo→grace→preklic brez izgube podatkov→operator pogled); cross-tenant idor testi za vse nove entitete; GDPR dokument (mapping, retention, export/deletion toki); rollback/backup postopek | vsi scenariji zeleni z obstojnimi podatki; dokumentacija popolna | ⏳ |

Faze so namerno zaporedne (E3-1 → E3-2 → E3-3 → E3-4 → E3-5 → E3-6 → E3-7 → E3-8); vsaka je neodvisno reverzibilna (aditivne migracije, feature-flagi kjer je treba).

---

## 4. Odločitve in kompromisi (dnevnik)

| Odločitev | Razlog |
|---|---|
| **Snapshot RAW `siteContent` (ne merge-ane vsebine)** — javna stran za objavljene najemnike s snapshotom renderira `mergeSiteContent(publishedSiteContent, vertical)` | nedotaknjene sekcije ostanejo sledljive izboljšavam privzetih vsebin po panogi; snapshot je točno tisto, kar je lastnik objavil |
| **Najemniki brez snapshotov (pre-E3-2) ostanejo na živi vsebini** — `hasUnpublishedChanges` je `false`, ko snapshot ne obstaja | „no rewrite, keep working flows“: obstoječi 7 najemnikov ne čuti nobene spremembe, dokler prvič samodejno ne objavi (takrat prevzame draft/objava cikel) |
| **Revert = NOVA verzija** (`contentVersion + 1`), nikoli prepis | zgodovina je ohranjena — povrnitev je sama po sebi sprememba osnutka (audit-friendly) |
| **Hero fiksiran na prvem mestu** v renderju (`homeSectionOrder`) in urejevalniku | hero je glava strani; poljubna lega bi lahko razbila strukturo strani — pure funkcija, testirana |
| **Preview na ločeni poti `/s/[slug]/preview`**, ne prek query parametra | strežniška vrata ostanejo preprosta (session org match), gostje so preusmerjeni na javno stran — osnutek nikoli ne uhaja; „preview“ dodan v RESERVED slugs |
| **Objavi tudi iz urejevalnika in predogleda** (poleg Nastavitev) | akceptančni tok „dodaj sekcijo → predogled → objavi → javno mesto“ brez skakanja med zasloni; vedno isti `publishSite` z validacijo |
| **Najprej objavni cikel (E3-1), nato komerciala (E3-3/4)** | §6 je predpogoj za „commercials“ (brez draft/objave ni vrednostnega razlika med načrti); tudi najmanjše tveganje za obstoječo produkcijo |
| Obstojeci 7 najemnikov → `PUBLISHED` v migraciji | §1 „no rewrite, keep working flows“: javna stran danes deluje, torej je objavljena |
| Načrti v registru v kodi (kot profili), ne v DB v prvem koraku | ista logika kot EPIC #1: verzioniranje z gitom, type-safety; DB premik mogoč v E3-5 ko operator ureja načrte |
| `PaymentProvider` adapter + „setup required“ stanje | §9 izrecno: brez ponudnika se ne sme pretvarjati, da plačila delujejo; adapter prepreči vezavo na enega ponudnika |
| Domen NE fejkamo (E3-6 ažurno) | §7: „Do not claim a domain is connected or secure until the provider confirms“ |
| Metrija iz obstoječih tabel (E3-7) | ni dvojnega knjiženja; števci so derivirani, torej vedno skladni z resničnim stanjem |
| E2E Playwright šele v E3-8 | repo nima E2E ogrodja; enkratna uvedba pokrije vse faze hkrati (ceneje kot postopno) |
| Takse/VAT: samo konfigurabilna polja + dokumentiran „ni pravno pregledano“ | §8 izrecno prepoveduje izmišljanje davčne obravnave |
