# EPIC #4 — Analitika, webhook zdravje in nadaljevanje namestitve: revizija ostankov in fazni načrt

> Sklic: GitHub Issue #3 — *FEATURE: Launch the Self-Service SaaS Business Builder, Website Publishing and Subscription Platform* (§10, §13, §15, §2) + ostanek Issue #2 (G8 vloge).
> Nadrejeni: Issue #2 (**zaključen** — E2-0…E2-7), Issue #3 (**zaključen do F1** — E3-0…E3-8 + follow-up F1, `a96115c`+`cd98fed`+`e9d7225`).
> Status dokumenta: **Faza 0 (revizija ostankov + načrt)** — vsaka trditev preverjena v kodi, ne iz spomina.
> Načelo: obstoječa delujoča funkcionalnost se ohranja; analitika je **izpeljana iz obstoječih tabel** (brez dvojnega knjiženja), izvenraba se ne fejka.

---

## 1. Revizija ostankov (kaj ostaja po EPIC #2 + #3, preverjeno v repozitoriju)

| # | Vrzela | Sklic | Dejansko stanje (verificirano) | Resnost |
|---|---|---|---|---|
| H1 | **Platformna analitika** — distribucija paketov, trial→plačljivo konverzija, churn, status prihodkov | #3 §15 („Platform: active tenants, trial-to-paid conversion, subscription status, churn, plan distribution, usage, revenue/billing status“) | `/platform` statistika (`getPlatformOverview`) ima samo osnovne števce: tenants/active/suspended/published/drafts/subscriptionsActive/subscriptionsPastDue. `PlatformBillingEvent` ima `amountCents`/`currency`/`plan`/`type` — surovina za prihodke **obstaja**, ni prikazana | visoka |
| H2 | **Najemniška analitika** — povpraševanja, termini, naročila po obdobjih; integracija obiskov | #3 §15 („Tenant: … enquiries, bookings, orders, conversion-relevant events … or available analytics integration“) | Dashboard ima widgete (danes/termini/naročila), ni trendov po obdobjih; obiski: **ni sledenja** (pošteno glede na zasebnost) — potrebna opcija lastne analitike (GA4/plausible ID polje) namesto izmišljenih številk | visoka |
| H3 | **Webhook zdravje v operaterski konzoli** | #3 §10 („Review billing integration/webhook health and failed events“) | Platformni webhook (`/api/webhooks/platform-stripe`) je idempotenten z validacijo podpisa, a **neuspešni dogodki niso vidni** v `/platform` — `PlatformBillingEvent` beleži samo uspešno aplicirane | srednja |
| H4 | **Nadaljevanje namestitve (onboarding resume)** | #3 §2 („Save progress and resume onboarding later“) | `start-wizard.tsx` (3 koraki, 605 vrstic) ima `useState(1)` — **brez persistencе**: zapustitev čarovnika = izguba vnosa. Ni localStorage, ni strežniškega osnutka | srednja |
| H5 | **Operativno zdravje/alerting** | #3 §13 („Monitoring, error reporting and operational alerts“) | `docs/EPIC-3/ROLLBACK-BACKUP.md` dokumentira postopke; **runtime health endpoint ne obstaja**; napake se vidijo le v Vercel logih | srednja |
| H6 | **Vloge/permission preseti po template-u (G8)** | #2 G8 (odločeno odloženo) | ADMIN/STAFF/CLIENTE deluje; custom vloge so ločen izdelek (sklad z #3 §8 entitlementi) | nizka |

Nezaželeno je vse implementirati v enem srcanu: issue #3 §17 („Phases may be reordered only when repository evidence justifies it“) in #2 §14 („small, reviewable increments“).

---

## 2. Fazni načrt (majhni, pregledni sklopi)

| Faza | Vsebina | Akceptančni kriteriji | Status |
|---|---|---|---|
| **E4-0** (ta dostava) | Ta dokument + pošteno zaprtje prijave: konsolidirano poročilo E3-6→F1 na issue #3 (posodobitve E3-6/E3-7/E3-8/F1 so do danes bile le v commitih in PLAN-u, ne kot komentarji) | revizija objavljena; issue #3 ma poročila vseh dostav EPIC #3 | ✅ |
| **E4-1 Platformna analitika** (H1) | `getPlatformOverview` razširjen (isti fail-closed vrata): distribucija paketov (FREE/PRO/SCALE iz `Organization.plan`), konverzija (delež najemnikov z ACTIVE/TRIALING plačljivim paketom), churn (CANCELED/UNPAID naročnine / vse naročnine), prihodki tekočega meseca (vsota `amountCents` uspešnih billing dogodkov, zabeleženi `currency` izpostavljen — brez pretvarjanja), zdravje webhooka (števec dogodkov zadnjih 7 dni); vsi izpeljani iz obstoječih tabel — brez novih modelov | številke se ujemajo z resnico v DB (test na fiksni fiktivni podatkovni množici); ni izmišljenih vrednosti; UI na `/platform` (SL/EN) | ⏳ |
| **E4-2 Najemniška analitika** (H2) | Pregled po obdobjih: povpraševanja/termini/naročila — tekoči mesec vs. prejšnji (izpeljano iz `Inquiry`/`Appointment`/`Order`), prikaz na dashboardu kot izbirna kartica; opcionalno polje za lastno analitiko obiskov (GA4 Measurement ID) v nastavitvah — vstavlja skript SAMO na objavljeno stran lastnika, brez sledenja po platformi | števci iz obstoječih tabel (brez dvojnega knjiženja); prazno obdobje = pošteno „ni podatkov“, ne 0 % rasti; GA4 skript ni prisoten, dokler lastnik ne nastavi ID | ⏳ |
| **E4-3 Webhook zdravje + odpovedani dogodki** (H3) | Tabela `PlatformWebhookFailure` (aditivna migracija: stripeEventId, type, razlog, payload osnutek) ali zabeleženi sklici v obstoječem dnevniku; prikaz v `/platform` (zadnje napake, ponovna obdelava kjer je varno); idempotenca ostane | napaka validacije/znak je VEDNO zabeležena; konzola pokaže zadnje napake; nič ne zlomi obstoječega webhook toka (testi idempotence ostanejo zeleni) | ⏳ |
| **E4-4 Nadaljevanje namestitve** (H4) | Osnutek čarovnika na klientu (localStorage, ključ per brskalnik, TTL, brisanje po uspešni kreaciji najemnika); ob vrnitvi na `/start` vprašanje „Nadaljuj, kjer si ostal?“; gesla se NE shranjujejo v osnutek; po kreaciji najemnika osnutek izbrisan | izpolnjena polja preživijo osvežitev; drug uporabnik na istem brskalniku začne čisto; testi logike serializacije; brez DB sprememb | ⏳ |
| **E4-5 Health endpoint + alerting priprava** (H5) | `/api/health` (javen minimalen: status + verzija, brez podatkov DB); `/api/health/internal` za operatorja (DB ping, števec napak webhookov, stanje migracij) — fail-closed prek `PLATFORM_ADMIN_EMAILS`; dokumentacija alerting priprave v ROLLBACK-BACKUP.md | health endpoint odgovori < 200 ms brez DB; notranji pokaže realno stanje; nič ne izpiše občutljivih podatkov | ⏳ |
| **E4-6 Custom vloge (G8)** — ŠELE, ko komercialna plast zahteva | permission preseti per template; ločen načrt ob začetku | odloženo z utemeljitvijo | ⏳ |

Faze so namerno zaporedne (E4-0 → E4-1 → …); vsaka je neodvisno reverzibilna (aditivne migracije, nič ne uničujočega).

---

## 3. Odločitve (dnevnik)

| Odločitev | Razlog |
|---|---|
| **Analitika je izpeljana iz obstoječih tabel** (Organization, PlatformSubscription, PlatformBillingEvent, Inquiry/Appointment/Order) — brez novih številskih modelov | isti princip kot E3-7 metrija („brez dvojnega knjiženja“); derivirani števci so vedno skladni z resničnim stanjem; ni migracijskega tveganja |
| **Prihodki prikazani po zabeleženim valutam, brez pretvarjanja** | pretvorba valut bi bila izmišljena natančnost; `amountCents`+`currency` prikažemo kot resnico („49,00 EUR / 20,00 USD“); platforma danes obračunava v eni valuti — test zaklene |
| **Konverzija/churn definiciji dokumentirani v UI** (npr. konverzija = ACTIVE+TRIALING / vsi najemniki z naročnino) | §15: „Clearly label estimates“ — metrika brez definicije je lažna; definicija stoji ob številu |
| **Obiski NE sledeni po platformi; namesto tega opcionalen lastni ID najemnika (E4-2)** | §15 dopušča „available analytics integration“; platforma ne piše piškotkov tretjih brez soglasja lastnika; poštena prazna stanja namesto izmišljenih grafikonov |
| **Osnutek čarovnika na klientu (localStorage), ne v DB (E4-4)** | čarovnik `/start` poteka PRED prijavo/kreacijo najemnika — strežniški osnutek zahteval bi anonimne zapise in GDPR plasti; localStorage + TTL + brisanje po uspehu je sorazmerno z riziko; gesla se nikoli ne shranijo |
| **Webhook napake v ločeni tabeli, ne v `PlatformBillingEvent` (E4-3)** | uspešni dogodki imajo unique `stripeEventId` in idempotentno semantiko — mešanje napak bi zmotilo „event processed“ invarianto; ločena tabela = čista zgodovina neuspehov, ki jih webhook ne bodo popravili |
| **E4-6 (vloge) ostaja odloženo, vendar viden** | poštenost načrta: G8 je bil odložen z utemeljitvijo (prekrivanje s §8 entitlementi); brisanje iz načrta bi prikrilo ostanek |
| **Poročanje EPIC #3 zaključka na issue #3 je del E4-0** | dostave E3-6/E3-7/E3-8/F1 so bile verificirane in dokumentirane (PLAN, README, testi), a brez komentarjev na issue-ju; skladnost z lastnim postopkom („commit ločen in povezan na ta issue“) zahteva popravilo sledljivosti, ne nove kode |
