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
| **E3-3 Načrti + entitlementi (brez plačil)** | konfigurabilni `Plan` (v kodi/registru, zod-validiran: limiti — št. izdelkov/storitev/osebkov/storage; zmožnosti pro; `FREE/PRO/SCALE`), strežniško uveljavljanje pri kreiranju vsebin (429 z razumljivim sporočilom), uporaba prikazana v Nastavitvah | lastnik na FREE ne more prekoračiti limitov prek API-ja; upgrade v UI spremeni entitlemente (plačilni sloj sledi) | ✅ `src/lib/plans/` (registry + resolve), uveljavljanje v `createService`/`createProduct`/`createStaffMember`, `PlanUsageCard` v Nastavitvah, `changePlan` deluje (brezplačno v predstavitveni fazi), 17 novih testov |
| **E3-4 Naročnine + plačilni adapter** | ločen platformni Stripe račun (env `PLATFORM_STRIPE_*`), adapter vmesnik (`PaymentProvider`), hosted checkout za naročnino, webhook z idempotenco in validacijo podpisa, `Subscription` stanje per najemnik, obračunsko zgodovino; **brez konfiguriranega ključa: jasen „setup required“ stanje, ni fake uspeha** | upgrade/deactivate/renewal gnano IZKLJUČNO s webhook dogodki; ni označenega plačila brez potrditve ponudnika; testi idempotence | ✅ `src/lib/payments/` (types/adapter/stripe-provider/subscription-state/billing-overview), webhook `POST /api/webhooks/platform-stripe`, `PlatformSubscription` + `PlatformBillingEvent` (migracija `20251124000000`), akciji `startPlanCheckout`/`cancelSubscription`, plačilna vrata v `changePlan` (`CHECKOUT_REQUIRED`/`CANCEL_REQUIRED`), `PlanUsageCard` razširjen s statusom naročnine + zgodovino obračunavanja, 19 novih testov |
| **E3-5 Operator konzola** | `/platform` (vrata ločena od najemniškega admina; dostop prek `PLATFORM_ADMIN_EMAILS` env + ločen role check), seznami najemnikov/naročnin/objav/uporabe, suspend/reaktivacija z razlogom + audit trail; ni izpostavljena najemniškim lastnikom | operator vidi in upravlja; najemnik ne more dostopati (test); vsako dejanje v sledi | ✅ `src/lib/platform/` (access — čisti pravili, guard — `requirePlatformAdmin`, overview — branja, labels — sl/en), `PlatformAuditLog` (append-only, migracija `20251126000000`), `Organization.suspendedAt/suspendedReason`, akciji `suspendTenant`/`reactivateTenant` (transakcija stanje+revizija), proxy branja `/platform` (redirect le UX; layout + akcije preverjajo avtoritativno), UI `/platform` (statistika, iskanje/filter, tabela najemnikov, revizijska sled) + `/platform/tenants/[id]` (raba vs. limiti, naročnina, objava, uporabniki, zgodovina obračunavanja, revizijska sled), 21 novih testov |
| **E3-6 Domene (priprava + implementacija po evidence)** | `CustomDomain` model (org-scoped, status PENDING/VERIFIED/FAILED, primarna domena), DNS navodila v UI, verifikacija prek Vercel Domains API ko je token konfiguriran; **ne označi povezane/SSL, dokler ponudnik ne potrdi** | brez tokena: UI pokaže „konfiguracija ponudnika manjka“; s tokenom: realna verifikacija; konflikti slugs/domain | ✅ `src/lib/domains/` (normalize — čista validacija + iskreni statusni avtomat, types, vercel-domains — Vercel Domains API adapter z injiciranim fetch, provider — izbor + iskren null ponudnik), `CustomDomain` model (aditivna migracija `20251127000000`), akcije `src/app/actions/domains.ts` (add/verify/remove/primary, org-scoped, plan gate prek `customDomains` entitlementa), host-based razrešitev najemnika v `getPublicOrg` (VERIFIED domena servira najemnika; ACTIVE + PUBLISHED vrata), UI zavihek „Domene“ v Nastavitvah (DNS navodila, statusi, primarna, odstranitev), `customDomains` entitlement (FREE 0 / PRO 1 / SCALE neomejeno) z rabo v PlanUsageCard, 36 novih testov |
| **E3-7 Metrija + opozorila** | uporabniški števci (izdelki/storitve/osebje/storage/orders) iz obstoječih tabel (brez dvojnega knjiženja), prikaz „X/Y“ + opozorilo pri 80 %, grace politika pri neplačilu dokumentirana (ne briše podatkov) | limiti se pokažejo pred blokado; downgrade/neplačilo NE izbriše podatkov | ✅ `src/lib/plans/types.ts` (`checkStorageLimit` čista vrata, `bytesToMb` ceil, `monthStartUtc` UTC meja, `orders` v `LimitResource` + RESOURCE_NOUNS), registry: orders limiti FREE 50 / PRO 1000 / SCALE null, `src/lib/plans/resolve.ts`: števci `orders` (mesečen) + `storageBytes` (org Media aggregate) + `getOrgStorageBytes`, upload ruta `/api/upload` Path B: storage gate pred zapisom (HTTP 429 dvojezično po locale), `createProductCheckoutSession`: mesečni orders gate (nevtralno sporočilo stranki), `PlanUsageCard`: vrstici Shramba (MB) + Naročila (mesec), opozorilo pri 80 % (obstoječe) zajame nove vrstice, `docs/EPIC-3/GRACE-POLICY.md`, 13 novih testov |
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
| **FREE limiti nad največjim onboarding setom** (15 storitev / 20 izdelkov / 3 zaposleni > 10/6/1 seed) | svež najemnik nikoli takoj prekorači — omejitve je treba doseči z rabo, ne z onboardingom; testirana invarianta (`tests/plans/registry.test.ts`) |
| **Uveljavljanje samo pri NOVIH vnosih** — obstoječa vsebina nikoli ni blokirana/izbrisana (downgrade tolerance) | E3-7 načelo „downgrade/neplačilo NE izbriše podatkov“ že v E3-3; prekoračitev = blokada kreiranja, UI pokaže opozorilo |
| **Obstoječi 7 najemnikov → `scale` (migracija `20251031000000`)**, novi najemniki → `free` (privzeta shemska vrednost) | E3-1 precedens „no rewrite, keep working flows“: brez migracije bi privzeti „free“ takoj blokiral ustvarjanje (privzeti org ima 4 zaposlene > FREE limit 3) — regresija vedenja; z backfilom obstoječi ostanejo brez omejitev, komerciala velja za nove najemnike od začetka |
| **`changePlan` je realen in brezplačen v predstavitveni fazi** (UI to izrecno pove) | akceptančni kriterij „upgrade v UI spremeni entitlemente“ brez fake checkouta; E3-4 na isto akcijo priključi plačilno vrata |
| **Limit sporočila po jeziku upravitelja** (`getLocaleFromCookies` v akcijah, 429-semantika) | razumljivo sporočilo zahteva §E3-3; čista `checkPlanLimit` vrne strukturo + sl/en besedilo, akcija izbere po locale |
| **storageMb v registru, brez uveljavljanja** | uveljavljanje uploadov zahteva merjenje medijev — sledi z metrijo (E3-7); polje je deklarirano in prikazano |
| **Webhook je EDAINI pisec stanja naročnine** (`checkout.session.completed` samo vpisuje identifikatorje in briše pending namen; status/entitlemente nosijo `customer.subscription.*` dogodki) | akceptančni kriterij E3-4: upgrade/deactivate/renewal gnano izključno s webhook dogodki; ne glede na vrstni red dostave dogodkov sta oba vektorja idempotentna upserta |
| **Idempotenca = unique `PlatformBillingEvent.stripeEventId` + guarded apply** (update le, če se stanje dejansko spremeni) | ponovitve dostave so brez učinka; apply-preden-zapiši + unique ključ pomenita, da replay ali konferenca nikoli ne podvoji dogodka/veljavnosti; testirano čisto (`isEventAlreadyProcessed`, `subscriptionUpdateFromSnapshot`) |
| **Entitlement pravilo: ACTIVE/TRIALING → paket, CANCELED/UNPAID → free, PAST_DUE → brez spremembe (grace), INCOMPLETE → brez spremembe** | fail-closed: ne-potrjena stanja nikoli ne povišajo entitlementov; prehodna checkout stanja ne podrejajo sred plačila; grace politika (podatkovnik sledi v E3-7) |
| **`changePlan` nosi plačilna vrata** (`CHECKOUT_REQUIRED` za plačljive cilje, `CANCEL_REQUIRED` za vrnitev na FREE z aktivno naročnino), ko je platformni Stripe konfiguriran; brez ključev ostane E3-3 predstavitveni preklop, UI to izrecno pove | denar v igri → izključno webhook-gnani tok; brez konfiguracije se nič ne pretvarja — pošteno "setup required" stanje v UI |
| **Customer resolve: lokalno shranjen `stripeCustomerId` → `customers.search` po `metadata.orgId` → create** | search indeks Stripa je končno konsistenten — lokalni id je determinističen in se izogne duplikatom; search je backup za ročno ustvarjene profili |
| **Invoice podporo po API 2025-10-29: `invoice.parent.subscription_details` + `pricing.price_details.price`** | Stripe v19 tipi; legacy fakture brez parenta se varno preskočijo z dnevniškim zapisom (ne ugibajo najemnika) |
| **Domene: VERIFIED nastavi IZKLJUČNO potrditev ponudnika** (`verified === true` v odgovoru Vercel Domains API); brez `DOMAINS_VERCEL_*` je zapis PENDING, vsako preverjanje pošteno vrne SETUP_REQUIRED | §7 izrecno: „Do not claim a domain is connected or secure until the provider confirms“ — ni fejkane povezave |
| **Statusni avtomat domen je čista funkcija** (`domainStatusTransition`): VERIFIED je zaklenjen (lokalna koda nikoli ne od-verificira), FAILED samo iz PENDING, enako→enako idempotentno | vsak zapis statusa gre skozi ena vrata; testirana invarianta, ne konvencija |
| **`customDomains` entitlement z vrednostjo 0** (`limitValueOrZero` v registru); PlanUsageCard vrsto z limitom 0 skrije | 0 = vir ni del paketa (FREE) — drugače kot „positive“, ker je to komercialna izbira; nadgradnjo pokaže DomainsCard, ne zavajajoča „0 / 0“ vrsta |
| **Host-based razrešitev najemnika v `getPublicOrg`, ne v proxyju** | proxy ne sme pogledati v DB; `getPublicOrg` že bere `Host` header in že vrača `null` za vzdrževalno stran — VERIFIED domena + ACTIVE najemnik + PUBLISHED stran = najemnik, sicer vzdrževalna stran; potni URL (`x-org-slug`) ostane s prednostjo |
| **Konflikti domen: platform-wide UNIQUE `CustomDomain.domain` + prijazen pre-check pred akcijo** | en host = največ en najemnik; UNIQUE omejitev DB je varovalka, akcija vrne razumljivo sporočilo (§7 „conflict prevention“) |
| **DNS navodila prihajajo od ponudnika** (adapter vrne zapise: A `@` → `76.76.21.21` apex, CNAME → `cname.vercel-dns.com` poddomene, TXT izzivi za verifikacijo) | navodila niso trdo kodirana v UI; adapter zamenljiv brez dotikanja UI (isti vzorec kot PaymentProvider) |
| **E3-7 storage gate meri samo platformno (DB) shrambo** — `Media.aggregate(_sum: size)` org-scoped; Cloudinary pot ni merjena (zunanji ponudnik ima svoje kvote), avatarji brez najemnika (`organizationId: null`) so platformski prostor | števec mora biti iz obstoječih tabel (brez dvojnega knjiženja); merjenje Cloudinaryja bi zahtevalo zunanji klic brez garancij — pošteno dokumentirano Namesto fake številke |
| **storage gate računa would-be bytes** (`currentBytes + file.size` → `checkStorageLimit`) pred zapisom vrstice; točno na meji še dovoljen, naslednji upload blokiran (HTTP 429, dvojezično po locale) | doslednost z drugimi viri: blokada zadene NOVI vnos, ne obstoječega; partial MB se šteje kot cel MB (`bytesToMb` ceil) |
| **orders je MESECEN deriviran števec** (`Order.count(createdAt >= monthStartUtc())`, UTC meja) z limiti FREE 50 / PRO 1000 / SCALE null v registru | issue §7 izrecno omenja „Monthly orders“; vrednosti so predstavitvene komercialne izbire, nastavljive v registru brez sprememb kode |
| **Blokada checkouta pri prekoračenih naročilih vrne NEVTRALNO sporočilo končni stranki** („Trgovina trenutno ne sprejema novih naročil…“) — brez imena paketa ali kvot | kupec je stranka najemnika, ne platforme; podrobnosti paketa vidi izključno lastnik v Nastavitvah → Paket |
| **Grace politika dokumentirana kot podatkovna garancija** (`docs/EPIC-3/GRACE-POLICY.md`): padec paketa nikoli ne briše; PAST_DUE ohranja plačani paket (grace), CANCELED/UNPAID → free, novi vnosi blokirani do padca rabe pod limit | akceptančni kriterij E3-7: „downgrade/neplačilo NE izbriše podatkov“ — dokument za podpise: kaj se zgodi s podatki v vsakem stanju naročnine |
