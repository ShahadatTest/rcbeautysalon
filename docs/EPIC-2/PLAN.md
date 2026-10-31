# EPIC #2 — Univerzalni poslovni templatni in konfiguracijski motor: revizija, preslikava in načrt dostave

> Sklic: GitHub Issue #2 — *FEATURE: Build the Universal Business Template and Configuration Engine*
> Nadrejeni specifikaciji: Issue #1 (arhitektura, dokončana) in Issue #3 (komercialni sloj).
> Status dokumenta: **Faza 0 (revizija + preslikava + načrt)** — objavljeno pred vsako shemsko/arhitekturno spremembo, kot zahteva §3 issue-ja.
> Prevzeti temelj: `docs/EPIC-1/ARCHITECTURE.md` (faze 1–7 dokončane, 71 testov zelenih, E2E potrjeno v brskalniku).

---

## 1. Rezultat revizije: kaj že obstaja (in je ohranjeno)

EPIC #1 je zgradil večino univerzalnega jedra, ki ga Issue #2 zahteva. Preslikava stanja na zahteve #2:

| Zahteva iz #2 | Stanje v repozitoriju | Kje |
|---|---|---|
| Ena platforma, eno univerzalno jedro (§2.1) | ✅ ena Next.js aplikacija, večnajemniško jedro (`/s/[slug]` + `x-org-slug`), brez industrijskih klonov | `src/proxy.ts`, `src/lib/tenant.ts` |
| Konfiguracija poganja izkušnjo (§2.2) | ✅ profil določa module, terminologijo, obrazce, procese, dashboard, CTA način javnega mesta | `src/lib/profiles/registry.ts`, `resolve.ts` |
| Brez univerzalnega termina-assumption (§2.3) | ✅ `appointments` je zmožnost z stanji `required/optional/disabled`; ne-terminske panoge ne vidijo koledarja, `/booking` varovalka | capability matrika, `sidebar.tsx` |
| Brez univerzalnega inventar-assumption (§2.4) | ✅ `inventory` je neodvisna zmožnost (čebelarstvo: zaloga brez terminov) | capability matrika |
| Zmožnosti: registry (§4) | ⚠️ delno — 13 univerzalnih zmožnosti (required/optional/disabled) + 4 deklarativne razširitve (`vehicle-workshop`, `body-measurements`, `batch-production`, `workspace-resources`) + runtime `ExtensionRecord` | `src/lib/profiles/*` |
| Verzionirani, validirani templati (§5) | ⚠️ delno — profili zod-validirani ob nalaganju; `profileVersion` + `profileOverrides {v}` na organizaciji; **manjka**: popolna zgodovina sprememb in rollback UI za konfiguracijo najemnika | `overrides.ts`, `Organization` |
| Lastniška prilagoditev brez kode (§6) | ✅ overrides izbirnih zmožnosti, widget konfigurator, urejevalnik obrazcev (verzija se poveča), urejevalnik stopenj procesa | Nastavitve → Moduli/Obrazci/Proces |
| Univerzalni delovni prostor + dinamična navigacija (§7) | ✅ capability-gated sidebar s terminologijo po profilu; role-aware (ADMIN/STAFF portal) | `sidebar.tsx` |
| Univerzalno javno mesto (§8) | ✅ CTA po profilu (booking/inquiry/order/quote), katalog, galerija, ekipa, kontaktni ure | `site-content.ts` + resolve |
| Obrazni motor (§9.1) | ✅ `FormDefinition/FormSubmission`, polimorfni kontekst, strežniška validacija polj, javni vnos + admin inbox + pretvorba v delovno naročilo | `/dashboard/forms`, `/inquiry` |
| Workflow motor (§9.2) | ✅ `WorkflowDefinition/Stage` + `WorkOrder/WorkOrderEvent` (validirani prehodi, nespremenljiva sled, SLA ure) | `/dashboard/work-orders` |
| Scheduling motor (§9.3) | ✅ termini (staff, izmenski sloti, konflikti, depozit); ❌ viri onkraj osebja (prostori/stoli/baji) še niso v ločevalni logiki rezervacij | `appointment*` akcije |
| Katalog in komercialni motor (§9.4) | ✅ storitve (per-org slug), izdelki + `ProductVariant`, `Package`/`PackageItem`, cene, Stripe checkout po najemniku | Faza 4b |
| Order/job motor (§9.5) | ✅ ločeno: shop `Order` (Stripe) ⟷ `WorkOrder` (procesi) ⟷ `Document` (ponudbe/računi s pretvorbo) | Faza 4b |
| Inventar/produkcija (§9.6) | ⚠️ delno — zaloge na izdelku/varianti, serije/žetev kot `ExtensionRecord`; ❌ ni gibov zaloge, dobaviteljev, sledljivosti per serija v katalogu | Faza 6 |
| Stranke (§9.7) | ✅ CRM, zgodovina, find-or-create iz javne oddaje | `customers.ts` |
| Dokumenti/plačila/obvestila (§9.8) | ✅ `Document` (PON/RAC, številčenje per najemnik, tisk); Stripe webhooki per najemnik; e-poštni predlogi nevtralni | Faza 4b + Phase 2 |
| 4 validacijski profili E2E (§10) | ✅ lepotoski studio, vulkanizer, čebelarstvo, šiviljstvo — vse brskalniško potrjeno na istem jedru | EPIC #1 faza 6 |
| Izolacija + testi (§11) | ✅ 71 vitest testov, shemski guardrail (`organizationId` + indeks), runtime izolacijski skript | `tests/`, `scripts/` |
| Migracija RCBeauty (§12) | ✅ RCBeauty izkušnja ohranjena kot konfigurabilen profil; aditivne migracije; Neon podatki nedotaknjeni | Faza 3 backfill |
| Nova panoga brez urejanja jedra (§16 DoD) | ✅ registrski vnos profila = nova panoga (11 profilov, seznami v onboarding/admin so iz registra) | `registry.ts` |

**Zaključek revizije:** jedro, ki ga #2 zahteva, obstaja in deluje. Preostale vrzeli so razširitve registriranega sistema, ne arhitekturni prelomi. Nobenega razloga za prepis — vse nadaljnje dostave so aditivne.

---

## 2. Analiza vrzeli (kaj #2 zahteva, česar še ni)

| # | Vrzela | Resnost | Komentar |
|---|---|---|---|
| G1 | **Zmožnosti iz §4, ki še ne obstajajo kot registry vnosi:** `projects` (projekti/naloge), `multiLocation` (več lokacij), `memberships` (članstva/naročnine strank), `delivery` (deklarirana, brez runtime vedenja), `suppliers` (dobavitelji) | srednja | registry naj jih deklara z stanji; runtime posamezno v naslednjih dostavah |
| G2 | **Inventarni runtime:** gibu zaloge (prihod/odhod/rezervacija), dobavitelji, sledljivost serij na nivoju kataloga | srednja | zdaj samo stanje zaloge + ExtensionRecord serije |
| G3 | **Projekti in naloge** kot univerzalna zmožnost (fotograf, čistilna firma, večdnevski posli) | srednja | nova org-scoped entiteta, povezava na workflow + dokumente |
| G4 | **Kombiniranje zmožnosti čez profile** (več dejavnosti pod enim računom, §2.5 in #1 §3) | visoka | organizacija ima danes natanko en profil; dodatne dejavnosti = izbrani izbirni moduli, ne drugi profil |
| G5 | **Zgodovina konfiguracije + rollback** (§5 „safe publish/rollback", §6 „change history") | srednja | overrides/form/workflow definicije imajo `v`, manjka zgodovina vnosov in UI za predogled/povrnitev |
| G6 | **Dokumentacija „kako dodati nov template/razširitev"** (§15/§16 DoD) | nizka | delno v EPIC-1 dok; namenski vodnik manjka |
| G7 | **Viri v razporejevalniku** (prostori/oprema/baji kot ločevalec terminov) | nizka | `workspace-resources` razširitev deklarirana; integracija v booking rezervacijo ni obvezna za vse profile |
| G8 | **Vloga/permission preseti po template-u** (§5 „default roles and permission presets") | nizka | ADMIN/STAFF/CLIENTE deluje; custom vloge so ločen izdelek (sklad z #3 §8 entitlementi) |

Nezaželeno je vse implementirati v enem srcanu: #2 §14 izrecno zahteva „small, reviewable increments".

---

## 3. Načrt dostave (aditivni, majhni sklopi)

| Sklop | Vsebina | Akceptančni kriteriji | Status |
|---|---|---|---|
| **E2-0** (ta dostava) | Ta dokument + lint čiščenje; potrjeno, da jedro ustreza §15 do 11. kriterija | revizija objavljena v dokumentaciji + komentar na issue | ✅ |
| **E2-1** | Registry razširitev zmožnosti: `projects`, `multiLocation`, `memberships`, `suppliers`, `delivery-runtime` kot tipizirani, zod-validirani vnosi z odvisnostmi; testi matrike | build/testi zeleni; novi vnosi ne spreminjajo obstoječih profilov (privzeto `disabled`) | ⏳ |
| **E2-2** | Inventarni runtime: `StockMovement` (org-scoped, viř, količina, opomba, povezava na izdelek/varianto), `Supplier`; UI na izdelku + seštevek zaloge na dashboardu (widget); sledljivost serije prek `ExtensionRecord` povezave | prihod/odhod gibov posodablja zalogo v transakciji; negativna zaloga zavrnjena pri produktnih profilih | ⏳ |
| **E2-3** | Projekti/naloge: `Project` (org-scoped, status, roki, stranka, povezava na delovno naročilo/dokument) + naloge; navigacija vezana na zmožnost `projects` | fotograf/čistilec scenarij: projekt ustvarjen → naloge → zaključek; profili brez zmožnosti ne vidijo modula | ⏳ |
| **E2-4** | Več dejavnosti pod enim računom (G4): organizaciji se lahko doda sekundarna panoga kot **skup kombiniranih zmožnosti** (unija zmožnosti + terminologija primarne), z zod validacijo kombinacij; registrski/onboarding korak | vulkanizer+trgovina, čebelar+obdelava lesa: unija modulov, izolacija ostane; ni grde unije terminov | ⏳ |
| **E2-5** | Zgodovina konfiguracije + rollback (G5): `ConfigChangeLog` (org-scoped: kdo, kaj, prej/potem JSON, verzija) za overrides/form/workflow urejanja; UI „Zgodovina" s predogledom in povrnitvijo (nov zapis = nova verzija, nikoli prepis zgodovine) | vsaka sprememba konfiguracije ima sled; povrnitev ustvari novo verzijo (audit ohranjen) | ⏳ |
| **E2-6** | Dokumentacija: `docs/ADD-NEW-TEMPLATE.md` — koraki za nov profil/razširitev SAMO v registru + test matrike; posodobitev README | nov profil z 1 datoteko + 1 test; vodja pregledan | ⏳ |
| **E2-7** | Viri v razporejevalniku (G7) — le kadar profil vklopi `workspace-resources` IN `appointments`: prostor/vir kot neobvezen ločevalec termina | ne-booking profili ne vidijo spremembe; booking profili z viri imajo konflikt-no preverjanje | ⏳ |

Vsak sklop: lint + tsc + `bun run test` zeleni, brskalniški E2E ključnega toka, aditivna migracija (brez uničujočih sprememb), commit ločen in povezan na ta issue.

---

## 4. Odločitve (dnevnik)

| Odločitev | Razlog |
|---|---|
| Ni prepisa jedra — vse vrzeli so razširitve registra/runtime | revizija §1 pokaže, da so načela #2 že implementirana; #2 §14 zahteva majhne korake |
| Kombiniranje čez profile z **unijo zmožnosti** (G4), ne z več profili per org | terminologija zahteva enoten izvor; unija ohranja en profil kot lastnika terminologije/dashboarda, dodatne zmožnosti pa prinašajo module |
| Zgodovina konfiguracije kot append-only log + verzija (E2-5) | §5/§6 zahtevata history + rollback; append-only je hkrati audit trail (§11) |
| Inventarni gibu v transakciji z negativno-založno zaščito | §11 „database constraints and transactions"; produktni profili ne smejo prodajati, česar ni |
| Custom vloge odložene | prekrivanje z #3 §8 (entitlementi/seats); brez komercialne plasti so preseti 2-vlognega sistema dovolj in pošteno dokumentirani |
