# Toksiškumo duomenys ir pipeline — analizė, tikslinė schema, peržiūros eiga, migracijos planas

_Parengta: 2026-11-03. Šaka: `claude/toxicity-data-pipeline-lxu0ej`. Repo: `ksmigelskiss/lapasid`._
_Statusas: **analizė + dizainas, BE vykdymo**. Jokių produkcinių duomenų, Firestore/Storage ar secrets nekeista. Migracija aprašyta, bet nepaleista._

> **Kodėl šis dokumentas.** LapasID keičia kryptį: **CORE tampa kambarinių augalų toksiškumo / saugumo duomenų bazė** (žmonėms, vaikams, šunims, katėms ir kt.), vieša, nemokama, ateityje tikrinama mokslo akademijos / toksikologų ekspertų. Vartotojas susideda augalus, nurodo, kas gyvena namuose, ir mato: kas kam ir kiek toksiška, ką laikyti aukščiau / ant žemės / geriau ne namuose, bei **toksikologinę kortelę medikui ar veterinarui**. Priežiūros programėlė ir augalų „charakteriai" tampa antraeiliais (brand / Pro sluoksnis). Šis dokumentas aprašo, **kaip toksiškumas renkamas ir saugomas dabar**, kur duomenys nenuoseklūs, ir **kokia turėtų būti tikslinė schema + ekspertų peržiūros eiga + migracija**.

---

## Turinys

1. [Santrauka vadovui (TL;DR)](#1-santrauka-vadovui-tldr)
2. [Analizės apimtis ir metodas](#2-analizės-apimtis-ir-metodas)
3. [Kaip toksiškumas renkamas ir saugomas DABAR](#3-kaip-toksiškumas-renkamas-ir-saugomas-dabar)
4. [Enrich pipeline — žingsnis po žingsnio](#4-enrich-pipeline--žingsnis-po-žingsnio)
5. [Šaltiniai](#5-šaltiniai)
6. [AI / LLM iškvietimai](#6-ai--llm-iškvietimai)
7. [Patikimumas ir kilmė (provenance) — kas saugoma, ko trūksta](#7-patikimumas-ir-kilmė-provenance--kas-saugoma-ko-trūksta)
8. [Nuoseklumo auditas — 26 augalų imtis](#8-nuoseklumo-auditas--26-augalų-imtis)
9. [Dokumentų (.md) vs kodo prieštaravimai; sena vs nauja kryptis](#9-dokumentų-md-vs-kodo-prieštaravimai-sena-vs-nauja-kryptis)
10. [Tikslinė toksiškumo schema](#10-tikslinė-toksiškumo-schema)
11. [Akademijos / ekspertų peržiūros darbo eiga](#11-akademijos--ekspertų-peržiūros-darbo-eiga)
12. [Teisinė / atsakomybės architektūra](#12-teisinė--atsakomybės-architektūra)
13. [Migracijos planas (be vykdymo)](#13-migracijos-planas-be-vykdymo)
14. [Atviri klausimai ir rizikos](#14-atviri-klausimai-ir-rizikos)
15. [Priedas: failų žemėlapis](#15-priedas-failų-žemėlapis)

---

## 1. Santrauka vadovui (TL;DR)

- **Nėra vienos toksiškumo duomenų bazės.** Toksiškumas išbarstytas per **5 lygiagrečias, iš dalies persidengiančias sistemas** (žr. §3). Produkcijoje toksiškumas **išvedamas realiu laiku** iš ASPCA + PFAF (`deriveToxicity.js`) ir **užšaldomas** ant Firestore `catalog/{slug}` dokumento — kuruotos „tiesos" objekto, kurį galėtų tikrinti ekspertas, dar **nėra**.
- **Geriausias struktūrinis sluoksnis jau egzistuoja, bet NEPRIJUNGTAS.** `data/toxin-classes.json` (19 junginių klasių) + `data/genus-toxin-map.json` (72 gentys) turi sunkumą, mechanizmą, organą, antidotą, per-rūšį jautrumą, simptomus, pirmąją pagalbą medikui, per-auditoriją naratyvus, **šaltinius su nuorodomis ir patikimumo lygį**. Tai beveik visa tikslinė schema — bet tai `v0.1-draft`, **„NE toksikologo verifikuota"**, ir ją naudoja tik testas (`toxinClasses.test.js`) bei `verify-toxin-map.mjs`. Resolveris (`resolveToxinProfile`) **neparašytas** (`docs/toksiskumo-integracija.md`: „Tai SPEC, ne kodas").
- **Patikimumas ir kilmė saugomi silpnai.** Per-pavojų (`pavojai[]`) įrašas turi tik `{tipas, target, severity}` — **be šaltinio, be datos, be patikimumo, be recenzento**. Šaltinio URL įrašomas kaip **laisvas tekstas** `pavojingumas.detales` lauke. **Ekspertų peržiūros būsena (`expert-verified`, `reviewedBy`, `reviewedAt`) yra TIK skaitoma kode, bet niekur NERAŠOMA** — tai neįgyvendintas backlog punktas.
- **🔴 Kritinė saugos/teisės spraga:** `firestore.rules` leidžia **bet kuriam prisijungusiam vartotojui perrašyti bet kurios rūšies toksiškumą** `catalog` kolekcijoje (`allow write: if request.auth != null`). Su artėjančia **PLD 2024/2853 griežtąja atsakomybe (nuo 2026-12-09)** tai yra pirmaeilė rizika (žr. §12). **Užrakinti rašymą (`isAdmin` / recenzentas) — P0.**
- **Nenuoseklumai realiai egzistuoja:** (a) legacy fixtures `toksiskas: false`, nors tekstas sako „Toksiškas…" (Monstera adansonii ir kt.); (b) **3 skirtingi sunkumo žodynai** (`silpnas/vidutinis/stiprus` vs `…/sunkus/mirtinas` vs UI „dirgina/Toksiška/Mirtina"); (c) `LILIUM`, `HEMEROCALLIS`, `NERIUM`, `CONVALLARIA`, `GLORIOSA` ir kitos **mirtiniausios** gentys **visai nepatenka** į naują genčių žemėlapį; (d) 6 iš 19 klasių niekam nepriskirtos; (e) ASPCA dengia tik kates/šunis/žirgus — **vaikui/žmogui produkcijos kelyje atskiro lauko nėra**.
- **Rekomendacija:** konsoliduoti į **vieną kuruojamą katalogo toksiškumo sluoksnį** (grįstą jau egzistuojančiu `toxin-classes` + `genus-toxin-map` modeliu), pridėti **per-teiginį kilmę + peržiūros būsenų mašiną + recenzento tapatybę + istoriją**, prijungti resolverį, ir pasinaudoti esamu **F1 reference overlay** (`catalog.js`), kad ekspertų pataisos realiu laiku pasiektų visus vartotojų augalus. Detalės — §10–§13.

---

## 2. Analizės apimtis ir metodas

Analizuoti **du repo** (abu jau buvo šakoje `claude/toxicity-data-pipeline-lxu0ej`):

- **`lapasid`** (gamyba: `lapasid.lt`) — brandus, multi-user produktas su globaliu katalogu, enrich pipeline'u, admin redaktoriumi ir visa toksiškumo logika. **Visa toksiškumo esmė yra čia.**
- **`geliu-db`** (gamyba: `augalai.crazyeuropean.eu`) — **pirmtakas**: asmeninė, single-user PWA. **Neturi** nei `data/` pipeline'o, nei katalogo, nei `deriveToxicity`, nei admin'o, nei toksiškumo klasių. Tai istorinė versija; toksiškumo DB darbui ji neaktuali (žr. `geliu-db/docs/TOXICITY_DATA.md` — nuoroda į šį dokumentą).

**Metodas.** (1) Perskaityti visi su užduotimi susiję `.md` (README, PROJECT, DESIGN, ARCHITECTURE, `docs/`, `tasks/`, `tasks/konsiliumas-2026-06/`). (2) Atsekta enrich pipeline nuo scrape iki Firestore įrašo (kodas: `api/`, `src/utils/`, `scripts/`). (3) Paimta **26 augalų imtis** iš kuruojamiausio šaltinio ir patikrintas nuoseklumas. (4) Suprojektuota tikslinė schema + peržiūros eiga + migracija, suderinta su nauja kryptimi ir teisiniu kadru iš `konsiliumas-2026-06`.

Visi teiginiai paremti kodu/duomenimis; failų keliai nurodyti. Kur `.md` prieštarauja kodui arba aprašo seną kryptį — pažymėta §9.

---

## 3. Kaip toksiškumas renkamas ir saugomas DABAR

Toksiškumas gyvena **penkiose lygiagrečiose sistemose**. Gamybos „tiesa" = sistemos #2+#3, išvedamos realiu laiku; #1 yra turtingiausia, bet neprijungta; #4 yra legacy; #5 — kuruojamo sąrašo signalas.

| # | Sistema | Failai | Turinys | Prijungta prie app? |
|---|---|---|---|---|
| **1** | **Struktūrinis junginių modelis (tyrimo juodraštis, turtingiausias)** | `data/toxin-classes.json` (19 klasių), `data/genus-toxin-map.json` (72 gentys) | sunkumo lubos, mechanizmas, organas, antidotas, per-rūšį jautrumas, simptomai, pirmoji pagalba medikui, per-auditoriją naratyvai, **šaltiniai + patikimumas** | **NE** — tik `toxinClasses.test.js` + `verify-toxin-map.mjs` |
| **2** | **ASPCA (gamybos autoritetas gyvūnams)** | `data/aspca-toxicity.json` (1023 augalai), `data/aspca-genus-map.json` (60 genčių) | toksiška/netoksiška **tik katėms/šunims/žirgams**, detalių URL, crosswalk confidence | **TAIP** — `deriveToxicity.js` (+ serverio mirror) |
| **3** | **PFAF (gamybos autoritetas žmonėms/bendram)** | `data/pfaf.json` (22 MB, ~9895 rūšys) | laisvas `knownHazards` (EN) + `knownHazardsLt` (LT) tekstas, `pfafUrl`, provenance | **TAIP** — `deriveToxicity.js` regex'u ištraukia severity/tipas |
| **4** | **Legacy per-augalą (AI sukurti fixtures/seed)** | `src/dev/realPlants.json` (47), `src/data/plants.json` (13) | `toksiskas` (bool) + `toksiskumo_info` (laisvas tekstas); keli su `savybes` | dev fixtures / onboarding seed |
| **5** | **Kuruojamų kandidatų sąrašas** | `data/curated-300.json` (274) | plonas signalas: `sourceEvidence.aspcaToxic[]`, `pfafFound` | input katalogo build'ui |

**Produkcijos kelias (supaprastintai):**

```
Vartotojas prideda augalą
   → api/save-plant.js (serveris; klientas SearchModal.jsx = mirror)
      → RAG kontekstas (Wikipedia / iNat / katalogas)
      → AI Phase 2 (Claude; sugeneruoja care + savybes)
      → deriveToxicityFromSources(latinName)   ← ASPCA + PFAF, NEPRIKLAUSOMAI nuo AI
      → PERRAŠO AI pavojai/pavojingumas išvestais (derived) duomenimis   ← autoritetas
      → toxicity narrative (Claude; TIK verčia mūsų šaltinio tekstą į LT)
      → įrašas į catalog/{slug}  (F1 reference overlay → pasiekia visus vartotojų augalus)
      → įrašas į vartotojo augalą
```

**Esminis architektūros faktas (svarbus migracijai):** katalogas naudoja **F1 reference overlay** (`src/utils/catalog.js` → `resolvePlantView`): katalogo pataisa realiu laiku pasiekia **visus** vartotojų augalus **be denormalizacijos** (miręs augalas = įšaldytas `refFrozen` snapshot). Tai reiškia, kad **kuruojama, ekspertų tikrinama toksiškumo tiesa natūraliai priklauso `catalog` sluoksniui** ir pasklinda automatiškai — tai migracijos pagrindas (§13).

**Esminis saugos faktas:** `savybes` (ir toksiškumas) **nėra** commit'intuose duomenyse — jis gyvena Firestore. `data/plants.json` (5786 įrašai) yra tik botaninių vardų indeksas (`id, latin, lithuanian, family`), **be toksiškumo**.

---

## 4. Enrich pipeline — žingsnis po žingsnio

### 4A. Offline build (vienkartinis / periodinis — `scripts/`)

1. **Scrape → raw JSON** (žr. §5). ASPCA ir PFAF nuskaitomi; iNat/Wiki/Wikidata/GBIF užklausiami gyvai kitur.
2. **`combine-pre-db.mjs`** — AHS + Beckett + Cheng → `data/pre-db.json` (genčių/rūšių registras; `inSources`, `familySource`). **Toksiškumo neturi** — tik taksonomija/priežiūra.
3. **`build-aspca-genus-map.mjs`** — ASPCA common-name slug'ai → pre-DB gentis (4 pakopos: rankinis žemėlapis, displayName, slug). Rašo `data/aspca-genus-map.json` su per-genties `toxicTo`, `matchedEntries[]`, `confidence` (`manual→high`, `displayName→medium`, kita→`low`).
4. **PFAF pavojų LT vertimas (du AI agentų pasai, NE gyvas API):**
   - `translate-pfaf-hazards.mjs` — EN `knownHazards` → `knownHazardsLt`; žymi `_lthazardsSource` (`trivial-dict` / vertimas).
   - `refine-pfaf-hazards.mjs` — Sonnet perrašo LT; `verifyRefinement()` tikrina **tik** ar išliko junginių pavadinimai (ne sunkumo/simptomų tikslumą); žymi `_lthazardsRefined`.
5. **`generate-curated-300.mjs`** — 357 whitelist gentys → 3 pakopos (50/100/150) → `data/curated-300.json` su `sourceEvidence{whitelist, beckett, cheng, aspcaToxic, pfafFound, …}`.
6. **`batch-enrich-catalog.mjs`** — pre-populina `catalog/{id}` per tą patį serverio RAG+AI+derive kelią; žymi `_batchSource`, `_batchEnrichedAt`.
7. **`validate-pre-db.mjs`** — kryžminių prieštaravimų detektorius → `data/validation-report.json` (tik detekcija, be taisymų).

### 4B. Runtime enrich (per išsaugojimą — `api/save-plant.js`)

- `POST /api/save-plant` → auth → **202 ACK** → `waitUntil(processPlant)` (async).
- **Idempotencija** per `phase2CompletedAt >= enrichmentStartedAt`.
- **Etapų žymos** į `catalog/{slug}` (`writeStage`): `started → rag → narrative → image → complete | failed`.
- **Hero paveikslas** lygiagrečiai (Gemini) — atskira sritis.
- **1. RAG** — `buildPlantRagContextServer(latinName, {maxLen:2500})`.
- **2. AI Phase 2** — `claude-sonnet-4-6`, `temperature:0.3`, `max_tokens:3000`, priverstinis įrankis `plant_details`. **Runtime `web_search` NEPERDUODAMAS**, nors `PLANT_SYSTEM` jį mini.
- **3. Normalizacija** — `normalizeAIResponse` / `normalizeSavybes` (enum validacija, default'ai).
- **4. Toksiškumo backfill (autoritetingas override):**
  - `deriveToxicityFromSourcesServer(latinName)` → struktūrinis `pavojai/pavojingumas/sources`.
  - **Jei `derived.hasToxicity` → PERRAŠO** AI `savybes.pavojai` ir `.pavojingumas` išvestais; `toxicitySources = derived.sources`.
  - Kitu atveju, jei narratyvas grąžina `aiSupplementaryHazard` (tik iš hard-coded „lethal" whitelist, severity užrakintas `stiprus`, su cituojama `evidence`) → saugo jį; `toxicitySources = ['ai-supplementary']`.
  - Kitu atveju → saugus augalas, nieko nepridedama.
- **5. Katalogo įrašas** — `saveCatalogWithParentServer` (tik jei yra `laistymasIntervalas`); prideda `ragSources`, `ragConfidence`, `schemaVersion:2`, `phase2CompletedAt`, `aprasymasSource`.
- **6. Vartotojo augalo įrašas** — `saveUserPlantServer` (praleidžiama admin režime).

> **Kodėl toksiškumas NEpatikimas AI'ui.** `deriveToxicity.js` header'is dokumentuoja priežastį: po 2026-05-21 testo **Aconitum napellus** (vienas nuodingiausių Europos augalų) gavo `pavojaiCount=0`, nors PFAF `knownHazards` turėjo 300+ simbolių. Todėl toksiškumas išvedamas deterministiškai iš šaltinių, o AI naudojamas tik (a) care laukams ir (b) šaltinio teksto vertimui į LT.

---

## 5. Šaltiniai

| Šaltinis | Kaip gaunama | Kur | Kilmės / licencijos pastabos |
|---|---|---|---|
| **ASPCA** Animal Poison Control | 3 sąrašų puslapiai nuskaityti (`aspca-scraper.mjs`); detalių puslapiai NE (robots `Crawl-delay:10s`); `User-Agent` su kontaktu | `aspca-toxicity.json` → `aspca-genus-map.json` | per-genties `confidence` (crosswalk, **ne toksikologinis**); **tik katės/šunys/žirgai**; licencijos lauko nėra |
| **PFAF** (Plants For A Future) | `pfaf-scraper.mjs`, 3 s delay, HTML regex; `pfafUrl`, `scrapedAt` | `pfaf.json` | `knownHazards` laisvas tekstas; **valgomumo/vaistinis uklonas**, ne pet/vaiko toksiškumas; LT vertimas mašininis |
| **Wikipedia (LT/EN)** | `wiki-lt-scraper.mjs`, `build-wiki-lt-cache.mjs`, `src/utils/wikiApi.js` | `lt-names-wiki.json`, `wiki-lt-cache.json` | RAG kuras + LT vardai + `aprasymas` |
| **Wikidata** | `wikiApi.js` | QID resolve LT vardams | — |
| **iNaturalist** | `inat-lt-names-scraper.mjs`, `imageService.js` (`locale=lt`) | `inat-names.json`, nuotraukos | iNat foto URL — vieninteliai persistinami kaip `image` |
| **GBIF** | `src/utils/plantNames.js` | LT vernacular vardai | — |
| **AHS / Beckett / Cheng** (knygos, pre-parsed) | `*-parser.mjs` | `pre-db.json` | **taksonomija/priežiūra, NE toksiškumas** |
| **LT medelynai** (gaspadorius, sodospalvos, derlingas) | scraperiai | LT rinkos vardai | — |

**Kilmės spraga:** jokie per-įrašo licencijos/atribucijos metaduomenys nesaugomi, išskyrus failo lygio `source` eilutę. Struktūrinis modelis (#1) yra geriausiai dokumentuotas — kiekviena klasė turi `saltiniai[]` (poison.org, Merck Vet, calpoison, petpoisonhelpline) ir `patikimumas`.

---

## 6. AI / LLM iškvietimai

Anthropic SDK (`@anthropic-ai/sdk`), raktas `process.env.ANTHROPIC_API_KEY` (tik serveris). **Modelis `claude-sonnet-4-6` visur runtime.**

1. **Phase 2 augalo detalės** — `api/save-plant.js` (+ `batch-enrich-catalog.mjs`, klientas `SearchModal.jsx`). Įrankis `TOOL_DETAILS`. Generuoja care + `savybes` (įsk. AI savo `pavojai/pavojingumas/valgomumas/vaistinis`), **bet toksiškumo pusė perrašoma** 4 žingsnyje.
2. **Toksiškumo narratyvas** — `api/_lib/toxicityNarrativeGenerator-server.js`; `max_tokens:600`, `temperature:0.3`, įrankis `toxicity_narrative`. Du išėjimai:
   - `detales` — LT vartotojo įspėjimas, **tik vertimas** iš mūsų ASPCA/PFAF šaltinio (null jei DB tyli).
   - `aiSupplementaryHazard` — spragų užpildas, leidžiamas tik jei gentis ∈ hard-coded whitelist (Digitalis, Nerium, Aconitum, Ricinus, Taxus, …), severity užrakintas `stiprus`, reikalauja cituotos `evidence` („common knowledge" atmetama).
3. **`api/claude.js` / `claude/stream.js`** — bendras Sonnet proxy klientinei Phase 1 paieškai + chat'ams.
4. **Offline PFAF LT** — verčiama „Opus iteracijomis", tada Sonnet perrašo (agentų batch'ai), ne gyvas API.
5. **Hero paveikslai** (ne toksiškumas) — `heroGen.js`: brief `claude-sonnet-4.5`, image `gemini-3-pro-image` per AI gateway.

> `severity` ir `tipas` gamybos kelyje **nėra AI sprendimas**: `derivePfafSeverity()` — regex heuristika ant teksto; `derivePfafTipas()` — teksto šablonai; ASPCA severity **priverstinai `vidutinis`** (ASPCA negraduoja). Tai saugiau nei AI, bet trapu (žr. §8 C5).

---

## 7. Patikimumas ir kilmė (provenance) — kas saugoma, ko trūksta

### Kas SAUGOMA (ant katalogo/augalo įrašo)
- `toxicitySources` — masyvas, pvz. `["aspca","pfaf"]` arba `["ai-supplementary"]`.
- `toxicityNarrativeGenerated` — bool.
- `ragSources` (masyvas) + `ragConfidence` (`low|mid|high`, iš šaltinių skaičiaus).
- `aprasymasSource` — `wikipedia-en|ai-only`.
- `schemaVersion:2`, `phase2CompletedAt`, `enrichmentStage`.
- `verificationStatus` — `preview|unverified|auto-verified|unverified-by-user` + `aiVerifiedAt`.
- Batch: `_batchSource`, `_batchEnrichedAt`.
- **Šaltinio URL/citata — kaip laisvas tekstas** `pavojingumas.detales` viduje (PFAF URL + ASPCA `detailUrl`).

Šaltinių datasetai turi savo kilmę: failo `generatedAt/source/url`; PFAF `pfafUrl, scrapedAt, _lthazards*`; aspca-genus-map per-genties `confidence` + `matchedEntries[].detailUrl`.

### Turtingiausias patikimumo sluoksnis egzistuoja, bet NEPRIJUNGTAS
`toxin-classes.json` + `genus-toxin-map.json`:
- `toxin-classes._meta.patikimumas`: **„~85-90%, laukia toksikologo patikros"**; `_meta.saltinis`: „research-grade, **NE toksikologo verifikuota**".
- `genus-toxin-map` per-genties `tier` (1=tvirta, 2=tikrinti, 3=abejotina), `saugus`, `saltinis`, `pastaba`.
- Per-klasę `rusies_jautrumas`, `antidotas`, `medikui_lt`, `patikimumas` (`AUKSTAS/VIDUTINIS/ZEMAS`).

Šį sluoksnį naudoja **tik** `verify-toxin-map.mjs` ir `toxinClasses.test.js` — jokio runtime import'o.

### SILPNA / TRŪKSTA (vėliavos)
- **🔴 Nėra rašymo apsaugos katalogo toksiškumui.** `firestore.rules`: `catalog/{docId}` `allow read, write: if request.auth != null` — **bet kuris prisijungęs gali perrašyti bet kurios rūšies toksiškumą** (`toksiška`→`saugu`). Komentaras pripažįsta: „Vėliau… apribosim į admin/moderator." **Su PLD 2024/2853 — tai P0 (žr. §12).**
- **Nėra per-pavojų kilmės.** `pavojai[]` įrašas turi tik `{tipas, target, severity}` (+ nebūtinas `detales`) — **be `source`, `confidence`, `url`, `timestamp`**. Patikimumas suplotas į vieną augalo lygio `toxicitySources` masyvą; neįmanoma pasakyti, kuris pavojus iš ASPCA, kuris iš PFAF, kuris iš regex spėjimo.
- **Ekspertų peržiūra neįgyvendinta.** `verified`/`reviewedBy`/`reviewedAt` — **neatžymėtas backlog** (`tasks/todo.md`). `verificationStatus === 'expert-verified'` **skaitomas** (`SearchModal.jsx`) ir yra komentaras „Vėliau admin/botanikas gali pažymėti" (`plantTransform.js`), bet **niekur neRAŠOMAS**. `catalog-vision-2026-06-02.md` dabartinę `auto-verified` žymą vadina „melas, AI confidence ≠ verifikuota".
- **PFAF LT tekstas mašininis, silpnai tikrintas** (Opus→Sonnet; `verifyRefinement` tikrina tik junginių pavadinimų išlikimą).
- **Severity heuristinis** (regex), su dokumentuotu praeities `\b`-regresijos bug'u; ASPCA — blankus `vidutinis` floor.
- **🐛 Bug `batch-enrich-catalog.mjs`:** kviečia `generateToxicityNarrativeServer({ latinName, derived, genusName })`, bet funkcija laukia `{ latinName, ltName, derivedToxicity }` → `derivedToxicity` yra `undefined` → generatorius visada eina „DB tuščia" šaka → **`detales:null` batch-enrichintiems įrašams**, net kai ASPCA/PFAF turi duomenų. Gyvas `save-plant.js` kelias teisingas. _(Atskiras taisytinas defektas; žr. §14.)_

---

## 8. Nuoseklumo auditas — 26 augalų imtis

Imtis iš kuruojamiausio šaltinio — `genus-toxin-map.json` (gentis = raktas), LT vardas iš `curated-300.json`, sunkumas/per-rūšį/patikimumas iš `toxin-classes.json`. `dalis` = augalo dalis; rūšys = `žmogus/katė/šuo` jautrumas (`—`=null/nėra duomenų, `n/a`=klasė nepriskirta).

| Gentis | LT vardas | tier | saugus | klasė | dalis | sunkumo lubos | žm/katė/šuo | patik. | pastaba |
|---|---|---|---|---|---|---|---|---|---|
| ACORUS | Ajeras | 3 | TOKS. | — | — | n/a | n/a | — | β-asaronas; „mažai duomenų — review" |
| ADENIUM | Tinūtras | 1 | TOKS. | cardiac_glycosides | visos | **mirtinas** | mirt/mirt/mirt | AUKŠTAS | ASPCA |
| AGLAONEMA | Aglaonema | 1 | TOKS. | ca_oxalate_insoluble | visos | vidutinis | silp/silp/silp | AUKŠTAS | — |
| ALOCASIA | Alokazija | 1 | TOKS. | ca_oxalate_insoluble | visos | vidutinis | silp/silp/silp | AUKŠTAS | daugiau rafidžių |
| ALOE | Alavijas | 1 | TOKS. | anthraquinones | geltonas latex | silpnas | silp/silp/silp | AUKŠTAS | skaidrus gelis saugus |
| ANANAS | Ananasas | 2 | SAUGUS | — | — | n/a | n/a | — | Bromeliaceae |
| ASPARAGUS | Smidras | 1 | TOKS. | saponins | uogos | silpnas | silp/silp/silp | VIDUT. | „NĖRA papartis" |
| BEGONIA | Begonija | 2 | TOKS. | ca_oxalate_soluble | **gumbai** | **sunkus** | silp/vid/vid | VIDUT. | „gumbai >> lapai" |
| CALATHEA | Kalatėja | 1 | SAUGUS | — | — | n/a | n/a | — | ASPCA |
| CODIAEUM | Krotonas | 1 | TOKS. | diterpene_esters | latex/visos | vidutinis | vid/vid/vid | AUKŠTAS | — |
| CRASSULA | Storalapis | 3 | TOKS. | **[] (nėra)** | — | n/a | n/a | — | „junginys NENUSTATYTAS — review" |
| CYCAS | Cikas | 1 | TOKS. | cycasin | **sėklos** | **mirtinas** | sunk/sunk/mirt | AUKŠTAS | „sago — NĖRA palmė; kepenys" |
| DIEFFENBACHIA | Difenbachija | 1 | TOKS. | ca_oxalate_insoluble | visos | vidutinis | silp/silp/silp | AUKŠTAS | proteolitiniai fermentai |
| DRACAENA | Dracena | 1 | TOKS. | saponins | lapai | silpnas | silp/silp/silp | VIDUT. | įsk. Sansevieria |
| EUPHORBIA | Karpažolė | 1 | TOKS. | diterpene_esters | latex | vidutinis | vid/vid/vid | AUKŠTAS | „akys sunkiau; poinsetija švelni" |
| FICUS | Fikusas | 3 | TOKS. | furocoumarins | latex | vidutinis | **vid/—/—** | AUKŠTAS | ASPCA sako gyvūnams; „klinikai ŠVELNI" |
| HEDERA | Gebenė | 1 | TOKS. | saponins | lapai/uogos | silpnas | silp/silp/silp | VIDUT. | — |
| JATROPHA | Jatrofa | 1 | TOKS. | toxalbumins + diterpene_esters | sėklos + latex | **mirtinas** | mirt/mirt/mirt | AUKŠTAS | „sėklos (curcin) MIRTINA" |
| KALANCHOE | Kalankė | 1 | TOKS. | cardiac_glycosides | žiedai/visos | **mirtinas** | mirt/mirt/mirt | AUKŠTAS | „bufadienolidai; žiedai stipriausi" |
| MONSTERA | Monstera | 1 | TOKS. | ca_oxalate_insoluble | visos | vidutinis | silp/silp/silp | AUKŠTAS | — |
| OXALIS | Kiškiakopūstis | 2 | TOKS. | ca_oxalate_soluble | visos | **sunkus** | silp/vid/vid | VIDUT. | „pavojus tik dideliais kiekiais" |
| PEPEROMIA | Peperomija | 1 | SAUGUS | — | — | n/a | n/a | — | ASPCA |
| PELARGONIUM | Pelargonija | 2 | TOKS. | **[] (nėra)** | — | n/a | n/a | — | „klasė ne iš mūsų 19 — review" |
| SANSEVIERIA | Sansevjera | 1 | TOKS. | saponins | lapai | silpnas | silp/silp/silp | VIDUT. | = Dracaena trifasciata |
| SOLANUM | Kiauliauogė | 1 | TOKS. | glycoalkaloids | uogos/visos | vidutinis | vid/vid/vid | AUKŠTAS | ASPCA |
| ZAMIOCULCAS | Zamiokulkas | 1 | TOKS. | ca_oxalate_insoluble | visos | vidutinis | silp/silp/silp | AUKŠTAS | „ZZ; lengvas" |

### Nuoseklumo radiniai (pagal tipą)

**C1 — Vidiniai prieštaravimai įraše (bool vs laisvas tekstas).** Legacy fixtures/seed sistemiškai turi `toksiskas: false`, nors gretimas `toksiskumo_info` sako „Toksiškas…":

| Augalas | `toksiskas` | `toksiskumo_info` (citata) |
|---|---|---|
| **Monstera adansonii** | `false` | „**Toksiškas** žmonėms ir gyvūnams – kalcio oksalato kristalai…" |
| **Aglaonema 'Orange Star'** | `false` | „**Toksiškas** žmonėms ir gyvūnams…" |
| **Aglaonema 'White Joy'** | `false` | „**Toksiškas** žmonėms ir gyvūnams…" |
| **Begonia maculata** | `false` | „**Silpnai toksiškas** – gumbuose yra kalcio oksalato" |
| **Oxalis vulcanicola** | `false` | „**Silpnai toksiškas** – oksalo rūgštis…" |

Priežastis: sprendimas, kad oksalato **dirgikliai** nėra „toksiška" boolean'ui, bet AI tekstas vis tiek sako „toksiškas" — du laukai niekada nesuderinti. (Tačiau `Anthurium`, ta pati oksalatų klasė, turi `toksiskas: true` → net klasės viduje bool nenuoseklus.)

**C2 — Kryžminiai (tarp sistemų) prieštaravimai.**
- **Ficus:** struktūrinis modelis (`furocoumarins`) fiksuoja jautrumą **tik žmogui** (`zmogus: vidutinis`, katė/šuo/paukštis/graužikas = `null`), tačiau **ASPCA sako Ficus toksiškas katėms/šunims/žirgams** ir `genus-toxin-map.FICUS` yra `saugus:false, saltinis:"ASPCA"`. Gyvūnų toksiškumas, kurį teigia ASPCA, neturi pagrindo klasės modelyje; žemėlapio pastaba hedge'ina: „klinikai ŠVELNI — NEpervertinti".
- **Sunkumo ašis vs runtime:** `Begonia`/`Oxalis` klasės turi **`sunkus`** lubas (tirpūs oksalatai → inkstai), bet legacy fixture vadina Begonia „silpnai toksiškas" — priešingi skalės galai tam pačiam augalui.
- **`saugus` vs ASPCA:** nė viena gentis nėra `saugus:true`, kai ASPCA sako toksiška (patikrinta visos 72 — 0 tokių konfliktų) → ta kryptis švari.

**C3 — Trūkstami laukai.**
- `pavojai[]` **neturi dalies, simptomų, pirmosios pagalbos, šaltinio, patikimumo** — tik `{tipas, target, severity, detales?}`.
- Turtingas `savybes` sluoksnis beveik nėra: iš 47 `realPlants` tik **3** turi `savybes.pavojai`; `src/data/plants.json` — **0/13**.
- **8 gentys pažymėtos toksiškomis, bet su tuščiu `klases[]`** (`ACORUS, ALBUCA, ARAUCARIA, CRASSULA, EUCALYPTUS, PELARGONIUM, PRIMULA, TRADESCANTIA`) → „toksiška, junginys nenustatytas, review". 4 iš jų junginys „ne iš mūsų 19" — žinoma modelio spraga.
- **6 apibrėžtos klasės yra orfanai** (nė viena katalogo gentis į jas nerodo): `aconitine, colchicine, grayanotoxins, tropane_alkaloids, lily_nephrotoxin, persin` — t. y. mirtini `Lilium`/`Aconitum`/`Colchicum`/`Gloriosa`/`Persea` atvejai modeliuoti, bet **nėra 72 genčių žemėlapyje**.
- **Mirtiniausios gentys visai nepatenka į genus žemėlapį:** `LILIUM`, `HEMEROCALLIS` (katėms **unikaliai mirtina**, 18 val. langas), `NERIUM` (oleandras), `CONVALLARIA` (pakalnutė), `GLORIOSA`, `AMARYLLIS`, `NARCISSUS`, `RHODODENDRON`, `CYCLAMEN` — nors ASPCA jas dengia (37 ASPCA gentys nepatenka į naują žemėlapį). Priežastis: `genus-toxin-map` sudarytas tik iš **esamo kambarinių katalogo** 72 genčių, ne iš toksiškų augalų visumos.

**C4 — Neaiškūs / nesami šaltiniai (provenance).**
- **Legacy fixtures: nulinė kilmė.** Jokio URL, jokio „kas tai pasakė", jokios datos ant `toksiskas`/`toksiskumo_info`/`savybes.pavojai`. Tai AI sukurta (tas pats nepatikimumas, kurį dokumentuoja `deriveToxicity.js`).
- **Struktūrinis modelis:** gerai dokumentuotas (kiekviena klasė `saltiniai[]` + `patikimumas`), bet visas failas `_meta` žymėtas „NE toksikologo verifikuota, ~85-90%".
- **ASPCA:** gera kilmė (`detailUrl`), bet `confidence` = **crosswalk match confidence, ne toksikologinis**; `deriveToxicity.js` jį ignoruoja ir floor'ina į `vidutinis`.
- **PFAF:** turi `pfafUrl` + `_lthazardsSource`, bet tekstas valgomumo/vaistinis orientacijos.

**C5 — Sunkumo skalės nenuoseklumas (3 skirtingi žodynai).**

| Kur | Žodynas | Lygiai |
|---|---|---|
| `deriveToxicity.js` runtime `severity` / `pavojingumas.lygis` | `silpnas, vidutinis, **stiprus**` | 3 |
| `toxin-classes.json` `sunkumo_lubos` | `silpnas, vidutinis, **sunkus, mirtinas**` | 4 |
| UI `LibraryEditorV2.jsx` etiketės | „dirgina" / „Toksiška" / „Mirtina" (= silp/vid/stip) | 3 |
| `pavojai[].tipas` (atskira ašis) | `toksiskas, dirginantis, alergiskas` | — |

Runtime naudoja **`stiprus`**; struktūrinis modelis — **`sunkus` + `mirtinas`** ir neturi `stiprus`. Ne 1:1 (runtime negali išreikšti „mirtina"). Rūšies jautrumas prideda dar vieną žodyną (`nera | silpnas | vidutinis | sunkus | mirtinas | null`, kur `nera`=„netoksiška šiai rūšiai", `null`=„nėra duomenų" — lengva supainioti).

**C6 — Rūšių padengimo asimetrija (šuo/katė vs vaikas/žmogus).**
- **Gyvūnai (ASPCA):** platus, bet seklus — 1023 augalai, bet **tik katės/šunys/žirgai**; be severity, be simptomų. **Nėra paukščio/graužiko**, nors kryptis žymi paukščius kaip didžiausią spragą (avokadas/`persin`).
- **Žmonės/vaikai:** silpna gamyboje — tik iš PFAF laisvo teksto + regex-spėto severity. **Vaiko lauko gamybos kelyje nėra.**
- Neprijungtas `toxin-classes` modelis — **vienintelė** vieta su realiu žmogaus/vaiko išskaidymu (`rusies_jautrumas.zmogus` + per-auditoriją `aprasymai.vaikai/suauge_zmones/gyvunai`).

### Skaičiai ir padengimas
- **`genus-toxin-map.json`:** 72 gentys — 39 toksiškos / 33 saugios; 31 su klase, **8 toksiškos-be-klasės**; tier 1/2/3 = **43/18/11**; 36 su `saltinis`.
- **`toxin-classes.json`:** 19 klasių — visos su simptomais, pirmąja pagalba, naratyvais, ≥1 URL; tik **4** su antidotu; patikimumas **16 AUKŠTAS / 3 VIDUTINIS**; **6 orfanai**.
- **ASPCA:** 1023 augalai (472 toks. / 551 netoks.), tik katės/šunys/žirgai; 60 genčių žemėlapyje (23 high / 37 medium confidence).
- **PFAF:** 9895 rūšys; 2481 su pavojų lauku, bet 1534 „None known" → tik **947** su realiu naratyvu.
- **Legacy:** `realPlants.json` 47 (22 `toksiskas:true`, 3 su `savybes`); `plants.json` 13 (bool tik, 0 su `savybes`).
- **Persidengimas:** gyva toksiškumo tiesa = ASPCA(gyvūnai) ∪ PFAF(žmonės). **16 genčių** toksiškos struktūriniame modelyje, bet nepatenka į runtime ASPCA žemėlapį — jiems runtime priklauso vien nuo PFAF teksto egzistavimo ir teisingo parsinimo.

---

## 9. Dokumentų (.md) vs kodo prieštaravimai; sena vs nauja kryptis

**Sena kryptis (naudoti tik kaip istoriją):**
- `tasks/konsiliumas-2026-06/*` ankstyvieji failai (B2B hortikultūra, marketplace, pardavėjų kasa, EU reikalavimai parduotuvėms) aprašo **app-centrinę / komercinę** viziją. Galutinis sprendimas (`40-SPRENDIMAS-dvi-dalys.md`, `43-trys-segmentai.md`, `50-vizija-v2-draft.md`, `60-galutine-santrauka.md`) ją **atmeta**: „Atvira biblioteka — pamatas. Programėlė — indas. Komercija — durys." Saugumas (toksiškumas) = **100% atviras, niekada nemonetizuojamas**. Tai sutampa su nauju KONTEKSTU.
- `docs/plant-savybes-logic.md` (2026-05) aprašo **3 lygių** sunkumą (`silpnas/vidutinis/stiprus`) ir AI-pildomą `savybes`. Tai iš dalies **pasenę vs kodas**: toksiškumą dabar perrašo `deriveToxicity` (ne AI), o struktūrinis modelis (2026-06) naudoja **4 lygių** skalę. Žr. C5.

**Dokumentų vs kodo prieštaravimai:**
- `docs/toksiskumo-integracija.md` sako „resolverio dar nerašom" — **teisinga**: `resolveToxinProfile` neegzistuoja. Bet failai `toxin-classes.json` / `genus-toxin-map.json` **jau yra** (ne tik planas), su CI testu.
- `PROJECT.md`/`README.md` mini `claude-sonnet-4-6`; `docs/plant-savybes-logic.md` mini „Claude Sonnet 4" ir „temperature 0.3, top_p 0.8, max_tokens 1536/2048". Kodas (`save-plant.js`) naudoja `max_tokens:3000` ir `claude-sonnet-4-6` — **dokumentai pasenę detalėse**.
- `tasks/todo.md` žymi `verified/reviewedBy/reviewedAt` kaip **neatliktą** — sutampa su kodu (niekur nerašoma).
- `tasks/catalog-vision-2026-06-02.md` dabartinę `auto-verified` žymą vadina „melas" — sutampa su mano radiniu, kad ekspertų verifikacija neįgyvendinta.

**Išvada:** naujas KONTEKSTAS (toksiškumo DB kaip CORE) **nuoseklus** su naujausiais strateginiais dokumentais ir su jau egzistuojančiu (bet neprijungtu) struktūriniu modeliu. Pagrindinis darbas — ne išrasti, o **konsoliduoti, prijungti ir verifikuoti**.

---

## 10. Tikslinė toksiškumo schema

**Principas:** viena **kuruojama katalogo tiesa**, grįsta jau egzistuojančiu dviejų lentelių modeliu (junginių klasės + genčių žemėlapis), praplėsta **per-teiginio kilme, peržiūros būsena ir recenzento tapatybe**. Sunkumą lemia `klasė × rūšis × dalis` (ne laisvas priskyrimas), kaip jau numatyta `docs/toksiskumo-klasifikacija.md`. Esamas `savybes.pavojai[]` **lieka kaip fallback**, kol padengimas nepilnas.

### 10.1. Suvienodinti enumai (viena tiesa)

```
sunkumas:        'nera' | 'silpnas' | 'vidutinis' | 'sunkus' | 'mirtinas' | null
  // 'nera'  = netoksiška ŠIAI rūšiai (aktyvus teiginys)
  // null    = nėra duomenų (NE „saugu" — rodyti „informacija ruošiama")
  // legacy 'stiprus' → migruojamas į 'sunkus' (default) arba 'mirtinas' (lethal whitelist, su review)

mechanizmas:     'lokalus_dirgiklis' | 'sisteminis' | 'fototoksinis'   // atskira ašis nuo sunkumo
rusis:           'suauges_zmogus' | 'vaikas' | 'kate' | 'suo' | 'paukstis' | 'grauzikas' | 'kiti'
  // 'vaikas' — NAUJA, atskira nuo suaugusio (mažesnė dozė; v1 gali paveldėti žmogaus reikšmę + eksperto override)
dalis:           'visos' | 'lapai' | 'sultys_latex' | 'svogunelis' | 'gumbas' | 'seklos' | 'uogos' | 'ziedai' | 'saknys' | 'zieve'
patikimumas:     'AUKSTAS' | 'VIDUTINIS' | 'ZEMAS'
tier:            1 | 2 | 3                     // 1=botaniškai tvirta, 2=tikrinti, 3=abejotina
perziuros_busena:'juodrastis_ai' | 'paruosta_perziurai' | 'botaniko_perziura'
               | 'toksikologo_perziura' | 'patvirtinta' | 'grazinta_taisymui' | 'archyvuota'
```

### 10.2. `TOXIN_CLASSES` — globali referencija (jau egzistuoja; praplečiama)

Palikti dabartinę `toxin-classes.json` struktūrą (19 klasių) ir pridėti `vaikas` į `rusies_jautrumas`, bei kilmės/būsenos laukus (verifikuojama **vienąkart per klasę**, ne per augalą):

```jsonc
"cardiac_glycosides": {
  "vardas_lt": "Kardiakiniai (širdies) glikozidai",
  "vardas_en": "Cardiac glycosides",
  "mechanizmo_tipas": "sisteminis",
  "organas": "sirdis",
  "sunkumo_lubos": "mirtinas",
  "doze_priklausomas": true,
  "antidotas": "DigiFab",
  "rusies_jautrumas": {
    "suauges_zmogus": "mirtinas", "vaikas": "mirtinas",      // + vaikas (naujas)
    "kate": "mirtinas", "suo": "mirtinas", "paukstis": "sunkus", "grauzikas": "sunkus"
  },
  "simptomai_lt": "…",
  "medikui_lt": "Aktyvuota anglis, K+ korekcija, EKG. ANTIDOTAS: DigiFab.",
  "pirmoji_pagalba_lt": "NESUKELTI vėmimo. Kreiptis nedelsiant. (statinė info, ne instrukcija)",
  "aprasymai": { "vaikai": "…", "suauge_zmones": "…", "gyvunai": "…" },
  "patikimumas": "AUKSTAS",
  "saltiniai": [ { "nuoroda": "https://…", "pavadinimas": "Cal Poison", "tipas": "poison_control" } ],
  // NAUJA — klasės lygio peržiūra:
  "perziura": { "busena": "juodrastis_ai", "perziurejo": null, "perziureta": null }
}
```

### 10.3. Per-augalą (katalogo) toksiškumo įrašas — NAUJA (`catalog/{slug}.toksiskumas`)

Pakeičia neformalų genčių žemėlapį augalo lygmeniu; kiekvienas **teiginys** nešasi savo kilmę ir būseną:

```jsonc
"toksiskumas": {
  "schemaVersion": 3,
  "lygis": "gentis" | "rusis" | "kultivaras",        // kokiu tikslumu priskirta
  "tier": 1,
  "status_bendras": "toksiska" | "saugu" | "nezinoma",
  "toksinai": [
    {
      "klase": "ca_oxalate_insoluble",               // → TOXIN_CLASSES raktas
      "dalis": "visos",
      "patikimumas": "AUKSTAS",
      // per-rūšį override (jei skiriasi nuo klasės numatytojo), pvz. lelija+katė:
      "rusies_override": { "kate": "mirtinas" },
      "specialios_veliavos": ["liutis_katei_kritine"],
      // per-teiginio KILMĖ (privaloma):
      "saltiniai": [
        { "tipas": "aspca", "nuoroda": "https://www.aspca.org/…/azalea", "citata": "toxic to cats, dogs" },
        { "tipas": "pfaf",  "nuoroda": "https://pfaf.org/…", "citata": "…" }
      ],
      // per-teiginio PERŽIŪRA (privaloma):
      "perziura": {
        "busena": "patvirtinta",
        "perziurejo": { "uid": "…", "vardas": "dr. X", "role": "toksikologas", "institucija": "Apsinuodijimų biuras" },
        "perziureta": "2026-11-01T10:00:00Z"
      }
    }
  ],
  // suvestinė kortelei (išvedama, bet cache'inama):
  "santrauka": {
    "pavojus_vaikui": "vidutinis", "pavojus_katei": "silpnas", "pavojus_suniui": "silpnas",
    "kritine_veliava": false,                        // bent viena klasė 'mirtinas' aktualiai rūšiai
    "ka_daryti": "laikyti_aukstai" | "ne_ant_zemes" | "geriau_ne_namuose" | "saugu"
  },
  "atnaujinta": "2026-11-01T10:00:00Z"
}
```

**Legacy suderinamumas:** `savybes.pavojai[]`/`pavojingumas{}` ir `toksiskas`/`toksiskumo_info` **lieka** kaip fallback; naujas `toksiskumas{}` turi **pirmenybę** kortelėse. Resolveris (`resolveToxinProfile`, žr. 10.4) pateikia vieną normalizuotą vaizdą.

### 10.4. `resolveToxinProfile(plant, household)` — resolveris (projektas; įgyvendinti §13)

Pagal `docs/toksiskumo-integracija.md` kontraktą, praplėstą naująja schema:

```
Įvestis: plant (lotyniškas → gentis), household { vaikai: bool, gyvunai: ['kate','suo',...] }
Išvestis: {
  status: 'toksiska' | 'saugu' | 'nezinoma',
  tier, patikimumas,
  klases: [{ id, vardas_lt, mechanizmo_tipas, sunkumas_man, dalis, medikui_lt, saltiniai, perziura }],
  kritine_veliava: bool,
  ka_daryti: 'laikyti_aukstai' | 'ne_ant_zemes' | 'geriau_ne_namuose' | 'saugu',
  medikams: { tapatybe, toksinai[], antidotai[], paveiktos_sistemos[], saltiniai[] }   // toksikologinė kortelė
}
```
- `sunkumas_man` = MAX per aktualias rūšis (household). `null` NESKAIČIUOJAMAS kaip „saugu".
- `tier-3` / `null` → kortelė rodo **„informacija ruošiama / tikrinama"**, ne „saugu".
- **Jokio skaičiaus/„saugumo balo"** (žr. §12 — false reassurance rizika). Rodyti **rizikų sąrašą**.

### 10.5. Toksikologinė kortelė medikui / veterinarui (CORE feature)

Generuojama iš `klases[].medikui_lt` + `antidotas` + `dalis` + `paveiktos_sistemos` + `saltiniai`. Rodo: **augalo tapatybė** (LT + lotyniškas + sinonimai) + **esami toksinai** + **paveiktos sistemos** + **šaltiniai** + **būsena „Patvirtinta [toksikologas]"**. Tai **faktai profesionalui**, NE diagnozė → teisiškai ginama pusė (žr. §12). Statyti **po** junginių duomenų pilnumo + eksperto patikros.

---

## 11. Akademijos / ekspertų peržiūros darbo eiga

**Tikslas (iš `33-akademijos-partnerystes-planas.md`):** „Lietuviškų augalų toksiškumo ir saugumo informacinė sistema" — vieša, nemokama, **ekspertų patikrinta**. Partneriai: **VU / VDU botanikos sodai** (botaniko patikra — tapatybė/dalis), **Apsinuodijimų kontrolės ir informacijos biuras** (toksikologo patikra + LT duomenys + credibility), **universitetas (VU/LSMU)** (akademinis svoris). **Badge „Patikrinta ekspertų" atsiranda TIK po realios partnerystės**; iki tol — sąžininga „šaltiniai: …" eilutė.

### 11.1. Rolės (praplėsti dabartinį binarinį `isAdmin`)

Dabar yra tik `users/{uid}.isAdmin: bool`. Reikia **rolių granuliarumo** (nekeisti esamo `isAdmin` prasmės, pridėti `roles[]`):

| Rolė | Teisės |
|---|---|
| `skaitytojas` (viešas) | skaito patvirtintą; nemato juodraščių |
| `redaktorius` / `admin` | redaguoja juodraštį, stato į peržiūrą, tvarko metaduomenis (NE patvirtina turinio) |
| `botanikas` | tikrina tapatybę / gentį / dalį; sign-off botaninei daliai |
| `toksikologas` | tikrina sunkumą / junginius / medikui_lt; **galutinis** sign-off → `patvirtinta` |
| `sistema` (AI/derive) | kuria `juodrastis_ai`; niekada `patvirtinta` |

### 11.2. Būsenų mašina (per teiginį ir/ar per augalą)

```
          (AI/derive)                     (redaktorius)
  juodrastis_ai  ───────────────────►  paruosta_perziurai
                                              │
                        ┌─────────────────────┼─────────────────────┐
                        ▼                                             ▼
                 botaniko_perziura                          (grąžinimas bet kurioje stadijoje)
                        │  (sign-off: tapatybė/dalis)                 │
                        ▼                                             ▼
                toksikologo_perziura  ──(reikia taisymų)──►  grazinta_taisymui ──► (redaktorius) ──┐
                        │  (sign-off: sunkumas/junginiai)                                          │
                        ▼                                                                          │
                   patvirtinta  ◄──────────────────────────────────────────────────────────────── ┘
                        │
                        ▼  (naujas šaltinis / reklamacija / periodinė revizija)
                   archyvuota (pakeista nauja versija)
```

- **„NĖRA DUOMENŲ ≠ SAUGU":** jei `null`/tier-3/`nezinoma` — vieša kortelė rodo „toksiškumo duomenų šiai rūšiai neturime — elkitės atsargiai", **ne** „saugu".
- **Badge:** `patvirtinta` + recenzento institucija → „Patikrinta: [institucija], [data]". Kol nėra — „Šaltiniai: ASPCA, PFAF… (parengta, laukia eksperto patikros)".

### 11.3. Redagavimas, istorija, atsakomybė

- **Redagavimas:** praplėsti esamą `LibraryEditorV2.jsx` (3-pane redaktorius, jau turi `toxicity` tab'ą ir draft state machine) — pridėti peržiūros būsenos valdiklį, recenzento sign-off mygtuką (rolės-gated), šaltinio laukus.
- **Istorija (append-only):** nauja subkolekcija `catalog/{slug}/toxicityRevisions/{revId}`:
  ```jsonc
  { "laikas": "…", "autorius": { "uid", "vardas", "role" }, "veiksmas": "sukurta|redaguota|pateikta|patvirtinta|grazinta|archyvuota",
    "laukas": "toksinai[0].sunkumas", "sena_reiksme": "vidutinis", "nauja_reiksme": "sunkus",
    "saltinis": "https://…", "komentaras": "…" }
  ```
  Nekeisti istorijos (immutable) — tai ir UX („kas/kada tikrino"), ir **teisinės gynybos** atsekamumas (§12).
- **Atsakomybė:** kiekvienas `patvirtinta` teiginys turi `perziurejo` (uid + vardas + rolė + institucija) ir `perziureta`. Botanikas atsako už tapatybę/dalį, toksikologas — už sunkumą/junginius/medikui tekstą. **Švari riba (iš `33`):** missijos duomenys vieši/nemokami ir priklauso bendram projektui; komercinė platforma (kolekcija/care/Pro) lieka įkūrėjui — sutarti iškart.

### 11.4. Esamų primityvų pakartotinis naudojimas

- **Vartotojo „pending→approve" šablonas** (`QuickApproveSheet.jsx`, `AdminPendingBadge.jsx`, `users.approved`) — gera UX bazė ekspertų peržiūros eilei (badge su skaičiumi → bottom-sheet → approve/reject).
- **`verify-toxin-map.mjs`** jau generuoja `tasks/toxin-review-queue.md` (72 gentys, konfliktai, tier-2/3). Tai — **pradinė peržiūros eilė** toksikologui; migruoti iš statinio `.md` į Firestore eilę su būsenomis.
- **F1 overlay** — patvirtinta pataisa automatiškai pasiekia visus vartotojų augalus.

---

## 12. Teisinė / atsakomybės architektūra

_(Sintezė iš `tasks/konsiliumas-2026-06/45-liability-redteam.md`, `46-saugumo-feature-sinteze.md`, `44-namu-saugumo-intelektas.md`, `docs/konsiliumas-2026-06-tyrimas.md`.)_

- **🔴 P0 — užrakinti `catalog` rašymą.** `firestore.rules:84-87` leidžia bet kuriam authed user'iui perrašyti toksiškumą. **Su PLD 2024/2853 (programinė įranga = produktas, griežtoji atsakomybė nuo 2026-12-09)** klaidinga toksiškumo info, prisidėjusi prie žalos, užtraukia atsakomybę **be kaltės įrodinėjimo**. Veiksmas: `allow write: if isAdmin()` (ar recenzentas); viešas — tik `read`. Tai pigiausias ir svarbiausias žingsnis.
- **Jokio simptomų „tikrintuvo" / sprendimų medžio.** ES MDR Rule 11 + AI Act: simptomų→sprendimo srautas = medicinos prietaisas (≥Class IIa) → solo bootstrap'ui **neįmanoma legaliai**. Leidžiama tik **faktas + simptomai kaip statinė INFO + kontaktai + „kreipkis į specialistą"**. Jokios dozės/„kiek gramų mirtina" skaičiuoklės (melagingas tikslumas; pvz. lelijų toksinas net neidentifikuotas). Jokios pirmosios pagalbos **instrukcijos** (vėmimo sukėlimas oksalatams/kardiotoksinams **kontraindikuotas**) — tik statinis faktas medikui.
- **False reassurance = atskira atsakomybė.** Klaidingas „saugu", kai nėra duomenų — negligent misrepresentation. **Nerodyti „saugumo balo"**; rodyti **rizikų sąrašą** + „NĖRA DUOMENŲ ≠ SAUGU".
- **Švarus, atsekamas source-of-truth = „state-of-the-art" gynyba.** Per-teiginio kilmė + ekspertų sign-off + immutable istorija (§10, §11) yra ne tik UX, bet **teisinės gynybos pamatas**.
- **GDPR / namų profilis — minimalu.** Neklausti tikslaus vaiko amžiaus/vardo/gimimo datos. Namų profilis = **boolean'ai** („yra vaikas", „yra katė") lokaliai. Baudos iki 4% apyvartos.
- **Disclaimer.** „Informacija — pažintinio pobūdžio, nepakeičia gydytojo/veterinaro konsultacijos." Įkūrėjo sprendimas: **be telefono numerio** iki partnerystės (numeriai keičiasi). LT realybė: žmonėms — Apsinuodijimų kontrolės ir informacijos biuras 24/7; **gyvūnams LT nėra pet poison linijos** → CTA = artimiausia 24/7 vet klinika. Patikrinti tikslius kontaktus prieš produkciją.

---

## 13. Migracijos planas (be vykdymo)

> **Niekas iš šio skyriaus NEPALEISTA.** Visi žingsniai neprivalomai vykdomi su `--dry-run` pirma; produkciniai Firestore/Storage duomenys ir secrets nekeisti. Migracija aditivinė (naujas `toksiskumas{}` sluoksnis šalia senų laukų), su rollback galimybe.

### Fazė 0 — Saugumas ir higiena (P0, maža, nepriklausoma)
1. **Užrakinti `firestore.rules`** `catalog` (ir reikiamai `taxonGroups`) rašymą į `isAdmin()`/recenzentą. _(Teisinė P0; žr. §12.)_
2. **Ištaisyti `batch-enrich-catalog.mjs` narratyvo bug'ą** (`derived`→`derivedToxicity`, pridėti `ltName`) — kad batch-enrichinti įrašai gautų `detales`.
3. **Suvienodinti severity žodyną** (dokumentuoti mapping `stiprus→sunkus|mirtinas`; UI etiketes susieti su 4 lygių skale). Dizainas/ADR, be duomenų keitimo.

### Fazė 1 — Schemos pamatas (aditivinis, be gamybos rizikos)
4. **Įvesti `catalog/{slug}.toksiskumas{}` (schemaVersion 3)** šalia esamų laukų. Nieko netrina.
5. **Pridėti `vaikas` rūšį** į `toxin-classes.json` `rusies_jautrumas` (eksperto peržiūrai; v1 gali paveldėti žmogaus reikšmę + flag „needs review").
6. **Praplėsti `users` rolėmis** (`roles[]`), išlaikant `isAdmin`.

### Fazė 2 — Padengimo spragos (duomenų darbas, dry-run + review eilė)
7. **Papildyti `genus-toxin-map.json` trūkstamomis mirtinomis gentimis** iš ASPCA (`LILIUM`, `HEMEROCALLIS`, `NERIUM`, `CONVALLARIA`, `GLORIOSA`, `AMARYLLIS`, `NARCISSUS`, `RHODODENDRON`, `CYCLAMEN` …) ir **prijungti 6 orfanines klases**. Visi nauji įrašai → `juodrastis_ai`/tier pagal patikimumą → review eilė.
8. **Išspręsti 8 „toksiška-be-klasės" gentis** (CRASSULA, EUCALYPTUS, PELARGONIUM, PRIMULA, TRADESCANTIA …) — arba priskirti klasę, arba palikti „junginys nenustatytas" su `nezinoma` statusu (ne „saugu").
9. **Migruoti `tasks/toxin-review-queue.md` → Firestore peržiūros eilę** su būsenomis.

### Fazė 3 — Prijungimas (kodas)
10. **Parašyti `resolveToxinProfile()`** (10.4) ir prijungti kortelėse su pirmenybe prieš `savybes.pavojai[]` (fallback lieka).
11. **Įgyvendinti peržiūros būsenų mašiną + istorijos subkolekciją** `LibraryEditorV2` (11.3).
12. **Backfill: perkelti legacy `savybes.pavojai[]` + `toksiskas`/`toksiskumo_info`** į `toksiskumas{}` kaip `juodrastis_ai` su kilme `toxicitySources` (per esamų `migrate-*.mjs` šabloną; dry-run). **Išspręsti C1 bool-vs-tekstas prieštaravimus** (Monstera adansonii ir kt.) — pagal klasę, ne pagal seną boolean.

### Fazė 4 — Ekspertų peržiūra ir badge
13. **Paleisti peržiūros eilę ekspertams** (tier-3/konfliktai pirma). Patvirtinta → badge + F1 overlay pasklinda.
14. **Toksikologinė kortelė medikui** — įjungti tik po junginių duomenų pilnumo + toksikologo patikros.

**Priklausomybės:** F0 nepriklausoma (daryti iškart). F1 → F3. F2 lygiagrečiai su F1. F4 reikalauja realios partnerystės (`33`).

---

## 14. Atviri klausimai ir rizikos

- **`vaikas` jautrumo kilmė.** Ar modeliuoti atskirai nuo suaugusio žmogaus, ar paveldėti su dozės korekcija? → eksperto (pediatro toksikologo) sprendimas (`45-pediatras-toksikologas.md`).
- **Severity `stiprus → sunkus | mirtinas` migracija** nėra 1:1 — reikia rankinės/eksperto peržiūros lethal whitelist atvejams; negalima automatiškai.
- **„Wallet object" (ateities idėja) strateginiuose dokumentuose NERASTAS.** Artimiausia esama išraiška — viešas paso puslapis `/p/{plantId}` (QR/NFC) + spausdinamas toksiškumo tag. Jei norima Google/Apple Wallet pass — tai **nauja, dokumentuose neužfiksuota idėja**; verta aprašyti atskirai prieš įgyvendinant.
- **Agreguoti duomenys verslui** = 3 segmentas „durys" (ne darbų sąrašas); caveat (`11-sinteze.md`): mirtingumo „moat" realiai neegzistuoja kaip pipeline (~1400 įrašų ≈ 1,3 dienos „Planta") → tai feature/įsigijimo turtas, ne parduodamas B2B datasetas. **Jokio vartotojų duomenų pardavimo** (GDPR + pasitikėjimas).
- **Taisytini defektai, rasti analizės metu (ne šios užduoties scope, bet verti tiketo):** (a) `batch-enrich-catalog.mjs` narratyvo arg bug; (b) `deriveToxicity` severity regex `\b` regresijos rizika; (c) legacy C1 prieštaravimai fixtures'uose.
- **PFAF licencija / ASPCA scraping sąlygos** — prieš viešą publikavimą patikrinti atribucijos/licencijos reikalavimus (per-įrašo licencijos lauko dabar nėra).

---

## 15. Priedas: failų žemėlapis

**Duomenys (`data/`)**
- `toxin-classes.json`, `genus-toxin-map.json` — struktūrinis modelis (turtingiausias; neprijungtas)
- `aspca-toxicity.json`, `aspca-genus-map.json`, `aspca-animals-lt.json` — ASPCA (gyvūnai, runtime)
- `pfaf.json` (+ `pfaf-*-chunks/`) — PFAF pavojai (žmonės, runtime)
- `curated-300.json` — kuruojamų kandidatų signalas
- `plants.json` — botaninių vardų indeksas (be toksiškumo)
- `pre-db.json` — taksonomija/priežiūra (be toksiškumo)

**Kodas**
- `src/utils/deriveToxicity.js` + `api/_lib/deriveToxicity-server.js` — runtime išvedimas (**MIRROR pora, keisti tik kartu**)
- `api/save-plant.js` — runtime enrich orkestruotojas
- `api/_lib/toxicityNarrativeGenerator-server.js` + `src/utils/toxicityNarrativePrompts.js` — LT narratyvas / supplementary hazard
- `src/utils/plantTransform.js` — `normalizeSavybes` schema + enumai
- `src/components/admin/LibraryEditorV2.jsx` — katalogo redaktorius (`toxicity` tab, draft machine)
- `src/components/admin/{QuickApproveSheet,AdminPendingBadge}.jsx` — „pending→approve" šablonas
- `src/utils/catalog.js` — **F1 reference overlay** (`resolvePlantView`)
- `src/utils/toxinClasses.test.js`, `scripts/verify-toxin-map.mjs` — struktūrinio modelio integralumas / peržiūros eilė

**Skriptai (migracija/cleanup — visi su `--dry-run`)**
- `combine-pre-db.mjs`, `build-aspca-genus-map.mjs`, `generate-curated-300.mjs`, `batch-enrich-catalog.mjs`, `validate-pre-db.mjs`
- `cleanup-toxicity-severity.mjs`, `migrate-irritant-tipas.mjs`, `migrate-toxicity-animals-lt.mjs`

**Dokumentai**
- `docs/toksiskumo-klasifikacija.md`, `docs/toksiskumo-integracija.md` — modelio pagrindas (šios schemos šaltinis)
- `docs/plant-savybes-logic.md` — `savybes` logika (iš dalies pasenusi, žr. §9)
- `tasks/konsiliumas-2026-06/` — strateginė kryptis, teisė, akademijos planas (žr. §9, §12)
- `tasks/toxin-review-queue.md` — esama (statinė) peržiūros eilė

---

_Dokumentą parengė automatinė analizė (Claude Code) 2026-11-03. Visi teiginiai paremti repo kodu/duomenimis; kur šaltinis plonas ar prieštaringas — pažymėta tiesiai. Jokie produkciniai duomenys nekeisti._
