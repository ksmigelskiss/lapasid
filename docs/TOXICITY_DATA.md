# Toksiškumo duomenys ir pipeline — analizė, kritinis vertinimas, galutinis variantas, migracijos planas

_Parengta: 2026-11-03 (2-oji redakcija: pridėtas kritinis vertinimas su empiriniu auditu, alternatyvų palyginimas ir vienas rekomenduojamas galutinis variantas; pasiūlymų dalis perrašyta pagal jį)._
_Šaka: `claude/toxicity-data-pipeline-lxu0ej`. Repo: `ksmigelskiss/lapasid`._
_Statusas: **analizė + dizainas, BE vykdymo**. Jokių produkcinių duomenų, Firestore/Storage ar secrets nekeista. Migracija aprašyta, bet nepaleista. Vienintelis naujas kodas — tik skaitantis audito skriptas `scripts/audit-toxicity-sources.mjs` (atkartoja §10.2 skaičius)._

> **Kodėl šis dokumentas.** LapasID keičia kryptį: **CORE tampa kambarinių augalų toksiškumo / saugumo duomenų bazė** (žmonėms, vaikams, šunims, katėms ir kt.), vieša, nemokama, ateityje tikrinama mokslo akademijos / toksikologų ekspertų. Vartotojas susideda augalus, nurodo, kas gyvena namuose, ir mato: kas kam ir kiek toksiška, ką laikyti aukščiau / ką galima laikyti ant žemės / ko geriau nelaikyti namuose, bei **toksikologinę kortelę medikui ar veterinarui**. Priežiūros programėlė ir augalų „charakteriai" tampa antraeiliais (brand / Pro sluoksnis). Šis dokumentas aprašo, **kaip toksiškumas renkamas ir saugomas dabar**, kur duomenys nenuoseklūs, **kur dabartinis požiūris pataisomas, o kur reikia kito**, ir pateikia **vieną galutinį variantą** su schema, ekspertų peržiūros eiga ir migracija.

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
10. [Kritinis vertinimas](#10-kritinis-vertinimas)
11. [Alternatyvų palyginimas](#11-alternatyvų-palyginimas)
12. [Tobuliausias galutinis variantas](#12-tobuliausias-galutinis-variantas)
13. [Teisinė / atsakomybės architektūra](#13-teisinė--atsakomybės-architektūra)
14. [Migracijos planas (be vykdymo)](#14-migracijos-planas-be-vykdymo)
15. [Atviri klausimai ir rizikos](#15-atviri-klausimai-ir-rizikos)
16. [Priedas: failų žemėlapis](#16-priedas-failų-žemėlapis)

---

## 1. Santrauka vadovui (TL;DR)

**Dabartinė būsena**
- **Nėra vienos toksiškumo duomenų bazės.** Toksiškumas išbarstytas per **5 lygiagrečias sistemas** (§3). Produkcijoje jis **išvedamas išsaugojimo metu** iš ASPCA + PFAF (`deriveToxicity.js`) ir užrašomas į Firestore `catalog/{slug}`. Kuruotos, ekspertui tikrinamos „tiesos" kaip objekto **nėra**.
- **Turtingiausias struktūrinis sluoksnis jau yra, bet neprijungtas:** `data/toxin-classes.json` (19 junginių klasių) + `data/genus-toxin-map.json` (72 gentys). Tai `v0.1-draft`, „NE toksikologo verifikuota", jį naudoja tik testas ir `verify-toxin-map.mjs`.
- **Kilmė, peržiūra, istorija — beveik nulinės.** `pavojai[]` neturi šaltinio, datos, recenzento; `expert-verified` kode skaitomas, bet niekur nerašomas; ekspertų pataisos būtų **perrašytos** kito enrich metu (saugomas tik `image`).
- **🔴 P0:** `firestore.rules` leidžia **bet kuriam prisijungusiam** perrašyti bet kurios rūšies toksiškumą, o `api/catalog/public.js` šiuos duomenis **jau viešai rodo**. Su PLD 2024/2853 griežtąja atsakomybe (nuo 2026-12-09) — pirmaeilė rizika.

**Kritinis vertinimas (empiriškai, §10.2)**
- Iš 31 toksiškos genties su priskirta klase runtime rezultatas sutampa su struktūriniu modeliu tik **12 (39 %)**; **12 atvejų runtime rodo mažiau**, iš jų **8 — sunkios/mirtinos klasės** (Jatrofa, Passiflora, Oxalis, Senecio, Biophytum → visai be toksiškumo; Adenium, Kalanchoe, Begonia → „vidutinis"); **7 — daugiau** (visos saponinų gentys).
- **PFAF iš principo nedokumentuoja kambarinių augalų toksiškumo**: Kalanchoe 36 rūšys / 0 su pavojų tekstu, Begonia 59/0, Dieffenbachia 11/0, Aglaonema 10/0, Dracaena 19/0.
- **PFAF „genties" įrašai dažnai ne tos genties:** iš 906 — 402 yra konkrečios rūšies puslapis, 85 raktai turi **kitos genties** turinį (`Dracaena` = „Cabbage Tree", `Solanum` = „Greenleaf Five Eyes", `Lotus` = laukinis „Bird's Foot Trefoil" → katalogo Lotus, pagal modelį saugus, runtime gauna **„stiprus"**).
- **ASPCA crosswalk pasiekia tik 109 iš 472 (23 %)** toksiškų ASPCA įrašų; Aglaonema („Chinese Evergreen"), poinsetija, Syngonium, Hemerocallis — ASPCA žino, runtime ne. **Lelija katei** (mirtina) runtime virsta „vidutinis, gyvūnams".
- Išvada: ASPCA ir PFAF nėra blogi šaltiniai — **blogas būdas, kaip iš jų gaminama išvestis**. Jie tinka kaip **įrodymai**, ne kaip **autoritetas**.

**Rekomenduojamas galutinis variantas (§12)**
- **Kompiliuojamas, versijuotas, ekspertų kuruojamas toksikologijos žinynas**: autoritetas = ekspertų tikrinami **junginių klasių ir taksonų priskyrimų** įrašai git'e (`data/toxicity/`), kiekvienas teiginys su šaltiniais, patikimumu ir peržiūros būsena; ASPCA/PFAF/literatūra — **tik įrodymai ir neatitikimų detektoriai**; kompiliatorius + CI išleidžia **nekintamus leidimus `vX.Y.Z`** su ekspertų parašų manifestu; programėlė skaito **tik publikuotą leidimą**, per vieną resolverį (be client/server mirror); **AI — tik offline juodraščių asistentas**, runtime saugos kelyje AI nėra.
- Rekomendacija „aukščiau / ant žemės / ne namuose" — **deterministinė, ekspertų peržiūrėta taisyklių lentelė**, priklausanti nuo **namų narių** (katė lipa — aukštis jos neapsaugo), poveikio kelio ir augalo dalies.
- Ekspertai tikrina **~20 klasių + šeimų taisykles + išimtis**, ne tūkstančius augalų puslapių → savanoriškai akademijai realu.

**Pirmi žingsniai:** užrakinti `firestore.rules` → išjungti PFAF genties fallback'ą → lelijos×katės vėliava → `data/toxicity/` pamatas su mirtinų genčių sąrašu (§14).

---

## 2. Analizės apimtis ir metodas

Analizuoti **du repo** (abu šakoje `claude/toxicity-data-pipeline-lxu0ej`):

- **`lapasid`** (gamyba: `lapasid.lt`) — brandus, multi-user produktas su globaliu katalogu, enrich pipeline'u, admin redaktoriumi ir visa toksiškumo logika. **Visa toksiškumo esmė yra čia.**
- **`geliu-db`** (gamyba: `augalai.crazyeuropean.eu`) — **pirmtakas**: asmeninė single-user PWA, tik legacy `toksiskas`/`toksiskumo_info` laukai, be pipeline'o (žr. `geliu-db/docs/TOXICITY_DATA.md`).

**Metodas.**
1. Perskaityti visi su užduotimi susiję `.md` (README, PROJECT, DESIGN, ARCHITECTURE, `docs/`, `tasks/`, `tasks/konsiliumas-2026-06/`).
2. Atsekta enrich pipeline nuo scrape iki Firestore įrašo (`api/`, `src/utils/`, `scripts/`).
3. Paimta **26 augalų imtis** ir patikrintas nuoseklumas.
4. **Kritinis vertinimas** remiasi (a) empiriniu auditu — `scripts/audit-toxicity-sources.mjs` lygina runtime heuristiką su struktūriniu modeliu ir matuoja šaltinių kokybę; (b) **nepriklausoma antrąja architektūros peržiūra**, atlikta be šios analizės išvadų (kad nebūtų „įtvirtinta" pirmoji nuomonė); jos naujus teiginius patikrinau kode prieš įtraukdamas.
5. Suprojektuotas galutinis variantas + migracija, suderinta su nauja kryptimi ir teisiniu kadru iš `konsiliumas-2026-06`.

Visi teiginiai paremti kodu/duomenimis; keliai nurodyti. Kur remiamasi bendromis toksikologijos/botanikos žiniomis, o ne repo — pažymėta.

---

## 3. Kaip toksiškumas renkamas ir saugomas DABAR

Toksiškumas gyvena **penkiose lygiagrečiose sistemose**. Gamybos „tiesa" = #2+#3; #1 turtingiausia, bet neprijungta; #4 — legacy; #5 — kuruojamo sąrašo signalas.

| # | Sistema | Failai | Turinys | Prijungta prie app? |
|---|---|---|---|---|
| **1** | **Struktūrinis junginių modelis (tyrimo juodraštis)** | `data/toxin-classes.json` (19 klasių), `data/genus-toxin-map.json` (72 gentys) | sunkumo lubos, mechanizmas, organas, antidotas, per-rūšį jautrumas, simptomai, medikui tekstas, per-auditoriją naratyvai, **šaltiniai + patikimumas** | **NE** — tik `toxinClasses.test.js` + `verify-toxin-map.mjs` |
| **2** | **ASPCA (gamybos autoritetas gyvūnams)** | `data/aspca-toxicity.json` (1023), `data/aspca-genus-map.json` (60 genčių) | toksiška/netoksiška **tik katėms/šunims/žirgams**, detalių URL, crosswalk confidence | **TAIP** — `deriveToxicity.js` (+ serverio mirror) |
| **3** | **PFAF (gamybos autoritetas žmonėms)** | `data/pfaf.json` (22 MB, 9895 įrašai) | laisvas `knownHazards` (EN) + `knownHazardsLt`, `pfafUrl` | **TAIP** — regex ištraukia severity/tipas |
| **4** | **Legacy per-augalą (AI fixtures/seed)** | `src/dev/realPlants.json` (47), `src/data/plants.json` (13) | `toksiskas` (bool) + `toksiskumo_info`; keli su `savybes` | dev fixtures / onboarding |
| **5** | **Kuruojamų kandidatų sąrašas** | `data/curated-300.json` (274 gentys) | `sourceEvidence.aspcaToxic[]`, `pfafFound` | katalogo build input |

**Produkcijos kelias (supaprastintai):**

```
Vartotojas prideda augalą (paieška / foto identifikacija)
   → api/save-plant.js (serveris; klientas SearchModal.jsx = mirror)
      → RAG kontekstas (Wikipedia / iNat / katalogas)
      → AI Phase 2 (Claude; sugeneruoja care + savo toksiškumo spėjimą)
      → deriveToxicityFromSources(latinName)        ← ASPCA + PFAF, nepriklausomai nuo AI
      → PERRAŠO AI pavojai/pavojingumas išvestais duomenimis
      → toksiškumo narratyvas (Claude; šaltinis lemia AR toksiška, bet junginius,
        mechanizmus ir simptomus promptas leidžia PAPILDYTI iš modelio žinių)
      → catalog/{slug} (set merge:true; F1 overlay → visi vartotojų augalai)
      → vartotojo augalas
```

**Architektūros faktas:** katalogas naudoja **F1 reference overlay** (`src/utils/catalog.js` → `resolvePlantView`): katalogo pataisa realiu laiku pasiekia **visus** vartotojų augalus be denormalizacijos (miręs augalas = `refFrozen` snapshot).

**Saugos faktas:** `savybes` (ir toksiškumas) **nėra** commit'intuose duomenyse — gyvena Firestore. `data/plants.json` (5786 įrašai) — tik botaninių vardų indeksas, **be toksiškumo**.

---

## 4. Enrich pipeline — žingsnis po žingsnio

### 4A. Offline build (`scripts/`)

1. **Scrape → raw JSON** (§5).
2. **`combine-pre-db.mjs`** — AHS + Beckett + Cheng → `data/pre-db.json` (taksonomija/priežiūra; **toksiškumo nėra**).
3. **`build-aspca-genus-map.mjs`** — ASPCA common-name slug'ai → gentis (rankinis žemėlapis, displayName, slug) → `aspca-genus-map.json` su `toxicTo`, `matchedEntries[]`, `confidence` (`manual→high`, `displayName→medium`, kita→`low`). Detalių puslapiai su moksliniais vardais **nenuskaityti** (robots `Crawl-delay`) → crosswalk remiasi bendriniais vardais (§10.2).
4. **PFAF pavojų LT vertimas** (AI agentų pasai, ne gyvas API): `translate-pfaf-hazards.mjs` → `knownHazardsLt`; `refine-pfaf-hazards.mjs` — Sonnet perrašo, `verifyRefinement()` tikrina **tik** junginių pavadinimų išlikimą.
5. **`generate-curated-300.mjs`** — whitelist gentys → `curated-300.json` su `sourceEvidence`.
6. **`batch-enrich-catalog.mjs`** — pre-populina `catalog/{id}` per serverio RAG+AI+derive; žymi `_batchSource`, `_batchEnrichedAt`.
7. **`validate-pre-db.mjs`** — kryžminių prieštaravimų detektorius (tik detekcija).

### 4B. Runtime enrich (`api/save-plant.js`)

- `POST /api/save-plant` → auth → **202 ACK** → `waitUntil(processPlant)`; idempotencija per `phase2CompletedAt >= enrichmentStartedAt`; etapų žymos `started → rag → narrative → image → complete | failed`.
- **1. RAG** — `buildPlantRagContextServer(latinName, {maxLen:2500})`.
- **2. AI Phase 2** — `claude-sonnet-4-6`, `temperature:0.3`, `max_tokens:3000`, priverstinis įrankis `plant_details`. Runtime `web_search` neperduodamas, nors `PLANT_SYSTEM` jį mini.
- **3. Normalizacija** — `normalizeAIResponse` / `normalizeSavybes`.
- **4. Toksiškumo backfill (override):** `deriveToxicityFromSourcesServer` → jei `hasToxicity`, **perrašo** AI `pavojai`/`pavojingumas`; `toxicitySources = derived.sources`. Kitu atveju, jei narratyvas grąžina `aiSupplementaryHazard` (tik „lethal" whitelist, severity `stiprus`, su `evidence`) → saugo; `toxicitySources = ['ai-supplementary']`.
- **5. Katalogas** — `saveCatalogWithParentServer` → `catalog-server.js` `set(clean, { merge: true })`; **vienintelis apsaugotas laukas — `image`** (image freeze). Toksiškumo laukams „žmogaus redaguota" apsaugos nėra.
- **6. Vartotojo augalas** — `saveUserPlantServer`.

**Paieškos/foto kelias:** `src/utils/preDbBaseResult.js` išveda toksiškumą tiesiai iš `stage1.latin` (`deriveToxicityFromSources(stage1.latin)`); identifikacijos `confidence` tik perduodamas toliau kaip `preDbConfidence`, toksiškumo **neriboja**. `catalogPreviewUpsert.js` įrašo `verificationStatus:'preview'` įrašą su toksiškumu į katalogą (pilnų įrašų neperrašo).

> **Kodėl toksiškumas atskirtas nuo AI.** `deriveToxicity.js` header'is: po 2026-05-21 testo **Aconitum napellus** gavo `pavojaiCount=0`, nors PFAF turėjo 300+ simbolių pavojų teksto.

---

## 5. Šaltiniai

| Šaltinis | Kaip gaunama | Kur | Pastabos |
|---|---|---|---|
| **ASPCA** Animal Poison Control | 3 sąrašų puslapiai (`aspca-scraper.mjs`); detalių puslapiai NE | `aspca-toxicity.json` → `aspca-genus-map.json` | **tik katės/šunys/žirgai**; binarinis (be sunkumo); `confidence` = crosswalk, ne toksikologinis |
| **PFAF** | `pfaf-scraper.mjs`, užklausa `Plant.aspx?LatinName=<vardas>` | `pfaf.json` | **valgomumo/vaistinių augalų DB**, ne pet/vaiko toksikologija; genties užklausos grąžina rūšies ar kitos genties puslapį (§10.2) |
| **Wikipedia (LT/EN)** | `wiki-lt-scraper.mjs`, `build-wiki-lt-cache.mjs`, `wikiApi.js` | `lt-names-wiki.json`, `wiki-lt-cache.json` | RAG kuras + LT vardai |
| **Wikidata / GBIF / iNaturalist** | `wikiApi.js`, `plantNames.js`, `inat-lt-names-scraper.mjs` | LT vardai, taxon ID, foto | — |
| **AHS / Beckett / Cheng** | `*-parser.mjs` | `pre-db.json` | taksonomija/priežiūra, NE toksiškumas |
| **LT medelynai** | scraperiai | LT rinkos vardai | — |

**Kilmės spraga:** per-įrašo licencijos/atribucijos metaduomenų nėra. **ASPCA ir PFAF naudojimo sąlygos viešam (ir galbūt komerciniam) duomenų rinkiniui nepatikrintos** — prieš viešą publikavimą būtina (§13).

---

## 6. AI / LLM iškvietimai

Anthropic SDK, raktas tik serveryje. **Modelis `claude-sonnet-4-6` visur runtime.**

1. **Phase 2 augalo detalės** — `api/save-plant.js` (+ `batch-enrich-catalog.mjs`, klientas `SearchModal.jsx`). Įrankis `TOOL_DETAILS` vis dar **prašo AI toksiškumo** (`pavojai/pavojingumas`), kuris po to perrašomas — švaistomi tokenai ir painiava.
2. **Toksiškumo narratyvas** — `toxicityNarrativeGenerator-server.js`, sistemos promptas `TRANSLATOR_SYSTEM` (`src/utils/toxicityNarrativePrompts.js`). **Nors pavadinimas „translator", promptas eksplicitiškai leidžia**: _„you CAN and SHOULD expand with training-derived details … Specific COMPOUNDS … MECHANISMS … Typical SYMPTOMS"_. T. y. šaltinis lemia **ar** augalas toksiškas, o junginiai, mechanizmai ir simptomai **papildomi iš modelio žinių be šaltinio** ir **generuojami iš naujo kiekvieno enrich metu**. `aiSupplementaryHazard` — spragų užpildas iš „lethal" whitelist.
3. **`api/claude.js` / `claude/stream.js`** — Sonnet proxy paieškai + chat'ams.
4. **Offline PFAF LT** — agentų batch'ai (Opus → Sonnet).
5. **Hero paveikslai** — `heroGen.js` (ne toksiškumas).

> `severity`/`tipas` gamyboje **nėra AI sprendimas**: `derivePfafSeverity()` — regex ant PFAF teksto; ASPCA severity priverstinai `vidutinis`. Bet **toksiškumo tekstas, kurį mato vartotojas, yra AI generuojamas per kiekvieną enrich** — ir niekas jo neperžiūri.

---

## 7. Patikimumas ir kilmė (provenance) — kas saugoma, ko trūksta

### Kas SAUGOMA
- `toxicitySources` (pvz. `["aspca","pfaf"]` / `["ai-supplementary"]`), `toxicityNarrativeGenerated`, `ragSources` + `ragConfidence`, `aprasymasSource`, `schemaVersion:2`, `phase2CompletedAt`, `enrichmentStage`, `verificationStatus` (`preview|unverified|auto-verified|unverified-by-user`) + `aiVerifiedAt`, `_batchSource`.
- **Šaltinio URL/citata — kaip laisvas tekstas** `pavojingumas.detales` viduje.
- Šaltinių datasetai: failo `generatedAt/source/url`; PFAF `pfafUrl, scrapedAt, _lthazards*`; ASPCA `matchedEntries[].detailUrl`.

### Turtingiausias patikimumo sluoksnis — neprijungtas
`toxin-classes.json` (`_meta.patikimumas`: „~85-90%, laukia toksikologo patikros"; per-klasę `patikimumas`, `saltiniai[]`) + `genus-toxin-map.json` (`tier`, `saugus`, `saltinis`). Naudoja tik `verify-toxin-map.mjs` ir `toxinClasses.test.js`.

### SILPNA / TRŪKSTA
- **🔴 Nėra rašymo apsaugos:** `firestore.rules` `catalog/{docId}` (ir `plant-passports`) `allow write: if request.auth != null`. Komentaras: „Vėliau… apribosim į admin/moderator."
- **🔴 Duomenys jau vieši:** `api/catalog/public.js` — viešas endpoint'as **be auth**, grąžina `savybes` („toksiškumas / valgomumas / vaistinis — saugumo šerdis").
- **Žmogaus pataisos neapsaugotos:** katalogo įrašas rašomas `merge:true`, apsaugotas tik `image`. Ekspertas pataiso toksiškumą `LibraryEditorV2` → kitas enrich (batch ar admin re-enrich) jį **perrašo be pėdsako**.
- **Nėra per-pavojų kilmės:** `pavojai[]` = `{tipas, target, severity, detales?}` — be `source`, `confidence`, `url`, `timestamp`.
- **Ekspertų peržiūra neįgyvendinta:** `verified/reviewedBy/reviewedAt` — neatžymėtas backlog (`tasks/todo.md`); `expert-verified` skaitomas (`SearchModal.jsx`), niekur nerašomas; `catalog-vision-2026-06-02.md`: `auto-verified` žyma — „melas".
- **Nėra versijų:** neįmanoma pasakyti, kokius duomenis vartotojas matė tam tikrą dieną.
- **🐛 `batch-enrich-catalog.mjs`:** kviečia `generateToxicityNarrativeServer({ latinName, derived, genusName })`, funkcija laukia `{ latinName, ltName, derivedToxicity }` → batch įrašai gauna `detales:null`.

---

## 8. Nuoseklumo auditas — 26 augalų imtis

Imtis iš `genus-toxin-map.json`, LT vardas iš `curated-300.json`, sunkumas/per-rūšį/patikimumas iš `toxin-classes.json`. Rūšys = `žmogus/katė/šuo` jautrumas (`—`=nėra duomenų, `n/a`=klasė nepriskirta).

| Gentis | LT vardas | tier | saugus | klasė | dalis | sunkumo lubos | žm/katė/šuo | patik. | pastaba |
|---|---|---|---|---|---|---|---|---|---|
| ACORUS | Ajeras | 3 | TOKS. | — | — | n/a | n/a | — | β-asaronas; „review" |
| ADENIUM | Tinūtras | 1 | TOKS. | cardiac_glycosides | visos | **mirtinas** | mirt/mirt/mirt | AUKŠTAS | ASPCA |
| AGLAONEMA | Aglaonema | 1 | TOKS. | ca_oxalate_insoluble | visos | vidutinis | silp/silp/silp | AUKŠTAS | — |
| ALOCASIA | Alokazija | 1 | TOKS. | ca_oxalate_insoluble | visos | vidutinis | silp/silp/silp | AUKŠTAS | daugiau rafidžių |
| ALOE | Alavijas | 1 | TOKS. | anthraquinones | geltonas latex | silpnas | silp/silp/silp | AUKŠTAS | gelis saugus |
| ANANAS | Ananasas | 2 | SAUGUS | — | — | n/a | n/a | — | Bromeliaceae |
| ASPARAGUS | Smidras | 1 | TOKS. | saponins | uogos | silpnas | silp/silp/silp | VIDUT. | „NĖRA papartis" |
| BEGONIA | Begonija | 2 | TOKS. | ca_oxalate_soluble | **gumbai** | **sunkus** | silp/vid/vid | VIDUT. | „gumbai >> lapai" |
| CALATHEA | Kalatėja | 1 | SAUGUS | — | — | n/a | n/a | — | ASPCA |
| CODIAEUM | Krotonas | 1 | TOKS. | diterpene_esters | latex/visos | vidutinis | vid/vid/vid | AUKŠTAS | — |
| CRASSULA | Storalapis | 3 | TOKS. | **[]** | — | n/a | n/a | — | „junginys NENUSTATYTAS" |
| CYCAS | Cikas | 1 | TOKS. | cycasin | **sėklos** | **mirtinas** | sunk/sunk/mirt | AUKŠTAS | „NĖRA palmė" |
| DIEFFENBACHIA | Difenbachija | 1 | TOKS. | ca_oxalate_insoluble | visos | vidutinis | silp/silp/silp | AUKŠTAS | fermentai |
| DRACAENA | Dracena | 1 | TOKS. | saponins | lapai | silpnas | silp/silp/silp | VIDUT. | įsk. Sansevieria |
| EUPHORBIA | Karpažolė | 1 | TOKS. | diterpene_esters | latex | vidutinis | vid/vid/vid | AUKŠTAS | akys sunkiau |
| FICUS | Fikusas | 3 | TOKS. | furocoumarins | latex | vidutinis | **vid/—/—** | AUKŠTAS | ASPCA sako gyvūnams |
| HEDERA | Gebenė | 1 | TOKS. | saponins | lapai/uogos | silpnas | silp/silp/silp | VIDUT. | — |
| JATROPHA | Jatrofa | 1 | TOKS. | toxalbumins + diterpene_esters | sėklos + latex | **mirtinas** | mirt/mirt/mirt | AUKŠTAS | „sėklos MIRTINA" |
| KALANCHOE | Kalankė | 1 | TOKS. | cardiac_glycosides | žiedai/visos | **mirtinas** | mirt/mirt/mirt | AUKŠTAS | bufadienolidai |
| MONSTERA | Monstera | 1 | TOKS. | ca_oxalate_insoluble | visos | vidutinis | silp/silp/silp | AUKŠTAS | — |
| OXALIS | Kiškiakopūstis | 2 | TOKS. | ca_oxalate_soluble | visos | **sunkus** | silp/vid/vid | VIDUT. | dideliais kiekiais |
| PEPEROMIA | Peperomija | 1 | SAUGUS | — | — | n/a | n/a | — | ASPCA |
| PELARGONIUM | Pelargonija | 2 | TOKS. | **[]** | — | n/a | n/a | — | „ne iš mūsų 19" |
| SANSEVIERIA | Sansevjera | 1 | TOKS. | saponins | lapai | silpnas | silp/silp/silp | VIDUT. | = Dracaena trifasciata |
| SOLANUM | Kiauliauogė | 1 | TOKS. | glycoalkaloids | uogos/visos | vidutinis | vid/vid/vid | AUKŠTAS | ASPCA |
| ZAMIOCULCAS | Zamiokulkas | 1 | TOKS. | ca_oxalate_insoluble | visos | vidutinis | silp/silp/silp | AUKŠTAS | „ZZ; lengvas" |

### Radiniai

**C1 — bool vs tekstas tame pačiame įraše.** Legacy fixtures: `toksiskas: false`, nors tekstas sako „Toksiškas…":

| Augalas | `toksiskas` | `toksiskumo_info` (citata) |
|---|---|---|
| **Monstera adansonii** | `false` | „**Toksiškas** žmonėms ir gyvūnams – kalcio oksalato kristalai…" |
| **Aglaonema 'Orange Star'** | `false` | „**Toksiškas** žmonėms ir gyvūnams…" |
| **Aglaonema 'White Joy'** | `false` | „**Toksiškas** žmonėms ir gyvūnams…" |
| **Begonia maculata** | `false` | „**Silpnai toksiškas** – gumbuose yra kalcio oksalato" |
| **Oxalis vulcanicola** | `false` | „**Silpnai toksiškas** – oksalo rūgštis…" |

(`Anthurium`, ta pati klasė, turi `toksiskas: true` → bool nenuoseklus net klasės viduje.)

**C2 — tarp sistemų.** *Ficus*: modelis — jautrumas tik žmogui, ASPCA — toksiškas katėms/šunims/žirgams. *Begonia/Oxalis*: modelis `sunkus`, legacy — „silpnai toksiškas". `saugus` vs ASPCA — 0 konfliktų iš 72.

**C3 — trūkstami laukai.** `pavojai[]` be dalies/simptomų/pirmosios pagalbos/šaltinio/patikimumo; `savybes` turi tik 3/47 `realPlants` ir 0/13 `plants.json`; **8 toksiškos gentys be klasės** (ACORUS, ALBUCA, ARAUCARIA, CRASSULA, EUCALYPTUS, PELARGONIUM, PRIMULA, TRADESCANTIA); **6 klasės orfanai** (aconitine, colchicine, grayanotoxins, tropane_alkaloids, lily_nephrotoxin, persin); **mirtiniausios gentys nepatenka į žemėlapį** — LILIUM, HEMEROCALLIS, NERIUM, CONVALLARIA, GLORIOSA, AMARYLLIS, NARCISSUS, RHODODENDRON, CYCLAMEN (37 ASPCA gentys už žemėlapio ribų).

**C4 — kilmė.** Legacy — nulinė; struktūrinis modelis — gerai sudokumentuotas, bet nepatikrintas; ASPCA `confidence` — crosswalk, ne toksikologinis; PFAF — valgomumo orientacijos.

**C5 — 3 sunkumo žodynai.**

| Kur | Žodynas |
|---|---|
| runtime `severity` / `pavojingumas.lygis` | `silpnas, vidutinis, stiprus` (3) |
| `toxin-classes.json` `sunkumo_lubos` | `silpnas, vidutinis, sunkus, mirtinas` (4) |
| `LibraryEditorV2.jsx` etiketės | „dirgina" / „Toksiška" / „Mirtina" (= silp/vid/stip) |
| `pavojai[].tipas` (atskira ašis) | `toksiskas, dirginantis, alergiskas` |

Runtime negali išreikšti „mirtina"; `nera` vs `null` lengva supainioti.

**C6 — rūšių asimetrija.** ASPCA — tik katės/šunys/žirgai, be sunkumo; žmonės/vaikai — tik PFAF tekstas; **vaiko lauko gamyboje nėra**; vienintelis žmogaus/vaiko išskaidymas — neprijungtame modelyje.

**Skaičiai:** genus-toxin-map 72 (39 toks./33 saug.; tier 43/18/11; 36 su `saltinis`); toxin-classes 19 (4 su antidotu; 16 AUKŠTAS/3 VIDUT.); ASPCA 1023 (472 toks.), žemėlapyje 60 genčių; PFAF 9895, tik 947 su realiu pavojų naratyvu; curated-300 — 274 gentys, iš jų **tik 63** genčių žemėlapyje.

---

## 9. Dokumentų (.md) vs kodo prieštaravimai; sena vs nauja kryptis

**Sena kryptis (tik istorija):** ankstyvieji `konsiliumas-2026-06` failai (B2B, marketplace, pardavėjų kasa, EU reikalavimai parduotuvėms) — app-centrinė/komercinė vizija. Galutinis sprendimas (`40-SPRENDIMAS-dvi-dalys.md`, `43-trys-segmentai.md`, `50-vizija-v2-draft.md`, `60-galutine-santrauka.md`) ją atmeta: „Atvira biblioteka — pamatas. Programėlė — indas. Komercija — durys." Saugumas — **100 % atviras**. Sutampa su nauju KONTEKSTU.

**Dokumentai vs kodas:**
- `docs/plant-savybes-logic.md` — 3 lygių skalė, AI pildo `savybes`, „Claude Sonnet 4", `max_tokens 1536/2048`. Kodas: toksiškumą perrašo `deriveToxicity`, `max_tokens:3000`, `claude-sonnet-4-6`; struktūrinis modelis — 4 lygių. **Pasenę.**
- `docs/toksiskumo-integracija.md` — „resolverio dar nerašom": **teisinga**; bet duomenų failai jau yra, su CI testu.
- Narratyvo sistemos promptas vadinasi `TRANSLATOR_SYSTEM`, bet leidžia plėsti turinį iš modelio žinių (§6) — **pavadinimas klaidina** dėl to, ką vartotojas mato.
- `tasks/todo.md` (reviewedBy neatlikta) ir `catalog-vision-2026-06-02.md` („auto-verified — melas") — **sutampa** su kodu.

**Išvada:** naujas KONTEKSTAS nuoseklus su naujausiais strateginiais dokumentais ir su (neprijungtu) struktūriniu modeliu.

---

## 10. Kritinis vertinimas

### 10.1. Kas veikia ir verta išsaugoti

- **Toksiškumas atskirtas nuo AI** — teisingas instinktas (Aconitum pamoka).
- **Ontologija „klasė × rūšis × dalis"** (`toksiskumo-klasifikacija.md`) — toksikologiškai teisinga: sunkumą lemia junginio klasė ir rūšis, ne „kiekis"; toksinai konservuojami gentyje/šeimoje.
- **Duomenų integralumo testai CI** (`toxinClasses.test.js`) ir **peržiūros eilės generatorius** (`verify-toxin-map.mjs`).
- **F1 overlay** idėja — viena pataisa pasiekia visus vartotojus.
- **Principai dokumentuose:** „nėra duomenų ≠ saugu", lokalus dirgiklis ≠ sisteminis nuodas, katė ≠ šuo, jokio simptomų tikrintuvo — visa tai jau apgalvota (`konsiliumas-2026-06/44–46`).
- **UX primityvai:** `LibraryEditorV2` draft mašina, `QuickApproveSheet` „pending → approve" šablonas.

### 10.2. Empirinis patikrinimas

Atkartojama: `node scripts/audit-toxicity-sources.mjs` (tik skaito repo failus, <1 s).

**(a) Runtime heuristika vs struktūrinis modelis** (runtime = ASPCA floor `vidutinis` + PFAF genties įrašo `derivePfafSeverity`; modelis = maks. klasės `sunkumo_lubos`, `sunkus/mirtinas` → `stiprus`):

| Rodiklis | Gentys |
|---|---|
| Toksiškos gentys su priskirta klase | **31** |
| Sutampa | **12** (39 %) |
| Runtime **žemiau** modelio | **12** — iš jų sunkios/mirtinos: ADENIUM (mirt→vid), KALANCHOE (mirt→vid), BEGONIA (sunk→vid), **JATROPHA (mirt→null)**, **PASSIFLORA (mirt→null)**, **OXALIS, SENECIO, BIOPHYTUM (sunk→null)**; taip pat AGLAONEMA, CODIAEUM, SYNGONIUM, ZAMIOCULCAS → **null** |
| Runtime **aukščiau** modelio | **7** — ALOE, ASPARAGUS, CLIVIA, DRACAENA, HEDERA, SANSEVIERIA, YUCCA (saponinai `silpnas` → `vidutinis`) |
| Saugios pagal modelį, bet runtime rodo pavojų | **4** — CYPERUS (vid), IMPATIENS (silp), **LOTUS (stiprus)**, SCUTELLARIA (vid) |

_Sąžininga pastaba:_ modelio `sunkumo_lubos` yra **blogiausio atvejo lubos**, ir pats modelis nepatikrintas (pvz. Passiflora `mirtinas` kyla iš cianogeninių kai kurių rūšių lapų — lubos pervertina tipinį pavojų). Lentelė rodo **dviejų sistemų nesutarimą 19/31 genčių**, o ne tai, kuri teisi. Bet keli atvejai — **vienareikšmės klaidos**: Jatrofa (sėklos su curcin) be jokio toksiškumo; Aglaonema/Zamioculcas/Syngonium/Codiaeum be toksiškumo, nors ASPCA juos žino; Lotus „stiprus" iš **kito augalo** puslapio (žr. b).

**(b) PFAF „genties" įrašai — dažnai ne ta gentis.** Skreperis užklausė `?LatinName=<Gentis>`, išsaugojo PFAF grąžintą puslapį ir į `latin` įrašė **užklausos** vardą.

| Rodiklis | Kiekis |
|---|---|
| Genties lygio įrašų | 906 |
| = konkrečios rūšies puslapis (ne gentis) | **402** |
| turinys identiškas **kitos genties** raktui | **85 raktai, 42 grupės** (pvz. Aechmea+Ananas, Calathea+Maranta, Amomum+Zingiber) |
| su pavojų tekstu → naudojami kaip fallback **visai genčiai** | 305 |

Pavyzdžiai: `Dracaena` → „Cabbage Tree", šeima Agavaceae (bendrinis Cordyline australis vardas); `Solanum` → „Greenleaf Five Eyes" pavojai; `Lotus` → laukinis „Bird's Foot Trefoil" („All parts … poisonous, cyanogenic glycosides") — todėl kambarinis Lotus gauna `stiprus`. _(Augalų tapatybės pagal bendrinius vardus — bendros botanikos žinios.)_

**(c) PFAF rūšių lygmeniu kambarinių toksiškumo nedokumentuoja:**

| Gentis | PFAF rūšių | su pavojų tekstu |
|---|---|---|
| Kalanchoe | 36 | **0** |
| Begonia | 59 | **0** |
| Dieffenbachia | 11 | **0** |
| Aglaonema | 10 | **0** |
| Dracaena | 19 | **0** |
| Syngonium / Spathiphyllum / Epipremnum / Zamioculcas / Codiaeum / Jatropha | 8 / 4 / 1 / 1 / 1 / 0 | **0** |

→ **žmogaus/vaiko pusė gamyboje tuščia** būtent tiems augalams, kuriuos mažyliai dažniausiai kiša į burną.

**(d) ASPCA crosswalk:** iš **472** toksiškų ASPCA įrašų per gentį pasiekiama **109 (23 %)**. Nepasiekiami (toksiški pagal ASPCA): `chinese-evergreen` (Aglaonema), `poinsettia`, `arrow-head-vine` (Syngonium), `orange-day-lily` (Hemerocallis), `asian-lily`. Pasiekiamas `LILIUM` (`toxicTo: cats`) runtime virsta `target:'gyvunams', severity:'vidutinis'` — **mirtiniausias katei faktas domene prarandamas** išvedimo metu, o katė ir šuo sulydomi į vieną „gyvūnams".

**Išvada:** ASPCA (veterinarinis autoritetas) ir PFAF (valgomumo DB) nėra blogi — **blogas mechanizmas**: laisvo teksto regex + bendrinių vardų crosswalk + vieno lygio floor + neteisingai priskirti genties puslapiai. **Jie tinka kaip įrodymai, ne kaip autoritetas.**

### 10.3. Fundamentalios silpnybės — reikia kito požiūrio

| # | Silpnybė | Kodėl nepataisoma lopais |
|---|---|---|
| **F1** | **„Tiesa" — išsaugojimo pipeline'o šalutinis produktas, ne duomenų rinkinys.** Toksiškumas perskaičiuojamas per enrich ir `merge` užrašomas ant katalogo; žmogaus pataisos neapsaugotos; redaguojama 3 vietose (git JSON, Firestore, `LibraryEditorV2`), nė viena nėra autoritetinga. | Kol išvestis gaminama rašymo metu, bet kokia ekspertų peržiūra bus perrašyta. Reikia, kad autoritetas būtų **duomenys**, o išvestis — iš jų **kompiliuojama**. |
| **F2** | **Autoritetas apverstas.** Išvestį gamina šaltinių heuristikos (§10.2), o struktūrinis modelis — tik testuose. | Heuristikų tobulinimas (regex, crosswalk) nesprendžia, kad PFAF nedokumentuoja kambarinių, o ASPCA negraduoja sunkumo. |
| **F3** | **Duomenų forma negali išreikšti esminių faktų:** `target` tik `zmonems/gyvunams` (katė=šuo=žirgas; nėra vaiko); 3 lygiai be „mirtina"; nėra dalies ir poveikio kelio; ASPCA „netoksiška" (katėms/šunims) virsta bendru „saugu" — **vaikui tai melagingas nuraminimas pagal konstrukciją**. | Reikia naujos schemos, ne papildomų laukų ant `pavojai[]`. |
| **F4** | **Nėra kilmės, būsenos, istorijos, versijų.** | PLD gynybai reikia įrodyti: ką žinojome, iš kur, kas patikrino, kada, ką vartotojas matė. Medikų kortelė be versijos necituojama. |
| **F5** | **AI saugos kelyje runtime:** narratyvas per kiekvieną enrich, leidžiant plėsti iš modelio žinių; `aiSupplementaryHazard` gap-fill. | Kiekvienas išsaugojimas = naujas nepatikrintas tekstas; ekspertas negali „patvirtinti" to, kas regeneruojama. Patvirtintas sakinys turi būti **saugoma konstanta**. |
| **F6** | **Saugai kritinė logika dubliuota** (client ↔ server MIRROR), su regresijų istorija (`\b` bug). | Konvencija „keisti kartu" — struktūrinė rizika. Logika turi būti **viena** (geriausia — kompiliavimo metu). |
| **F7** | **Tapatybė:** gentis = `split(/\s+/)[0]` (abiejose kopijose), sinonimų resolveris toksiškumo kelyje nenaudojamas (`parseLatinName` yra `src/utils/latinName.js`); identifikacijos neapibrėžtumas į toksiškumą neperduodamas; preview įrašas su toksiškumu keliauja į katalogą. | Klaidinga tapatybė = klaidingas toksiškumas, kad ir kokie geri duomenys. (Pagal `44-namu-saugumo-intelektas.md`, poison control #1 problema — augalo identifikacija.) |
| **F8** | **Apimtis:** genčių žemėlapis sudarytas iš esamo katalogo (72), ne iš „toksiškų augalų Lietuvos namuose". | Mirtini ir sezoniniai augalai (lelijos puokštėse, poinsetija, svogūnėliai) nepateks į DB, jei apimtį lemia, ką vartotojai jau pridėjo. |

### 10.4. Pataisomi defektai (be architektūros keitimo)

| Defektas | Kur | Pataisa | Prioritetas |
|---|---|---|---|
| Atviras rašymas į `catalog`, `plant-passports` | `firestore.rules` | `allow write: if isAdmin()` (ar recenzentas) | **P0** |
| PFAF genties fallback'as su ne tos genties turiniu | `deriveToxicity*.js` (`pfaf.results[genus]`) | Išjungti genties fallback'ą arba tikrinti puslapio tapatybę | P1 |
| Lelija × katė → „vidutinis, gyvūnams" | `deriveToxicity*.js` | Laikina vėliava: Lilium/Hemerocallis + katė → kritinė | P1 |
| ASPCA crosswalk 23 % | `build-aspca-genus-map.mjs` | Papildyti rankinį žemėlapį / mokslinius vardus | P1 |
| Narratyvo arg bug | `batch-enrich-catalog.mjs` | `derived` → `derivedToxicity`, + `ltName` | P1 |
| Phase 2 schema prašo AI toksiškumo | `plantPromptConfig.js` `TOOL_DETAILS` | Išimti toksiškumo laukus | P2 |
| Naivus genties ištraukimas | `deriveToxicity*.js` | `parseLatinName` + sinonimai | P2 |
| 3 sunkumo žodynai | runtime / klasės / UI | Viena skalė (§12.3) | P2 |
| C1 bool vs tekstas | fixtures | Pataisyti / perkelti į naują modelį | P3 |
| Šeimų pavadinimų normalizacija | `curated-300.json` (`CACTACEAE` 25 vs `Cactaceae` 6; 15 genčių be šeimos) | Normalizuoti per taksonomijos stuburą | P3 |

### 10.5. Aklosios zonos

_Domenas (bendros toksikologijos/botanikos žinios, ne repo):_
- **Poveikio kelias nemodeliuojamas:** prarijimas, sultys/latex ant odos, **akys** (Euphorbia — keratitas), **žiedadulkės** (lelijos ant katės kailio), **vazos vanduo** (lelijos, pakalnutės). „Aukščiau" apsaugo tik nuo prarijimo.
- **Skinti ir sezoniniai augalai** — lelijos puokštėse (Velykos, gimtadieniai), poinsetija (Kalėdos), hiacintų/narcizų/amarilių svogūnėliai — katalogo taksonomijoje „ne kambariniai", bet būtent jie — **pagrindinis kačių apsinuodijimų šaltinis**. Katalogas neturi „puokštės" sąvokos.
- **Dalis ir sezonas:** uogos atsiranda sezoniškai (Solanum pseudocapsicum, Hedera), svogūnėliai/gumbai ≠ lapai; statiškas ženklelis neatspindi kintančios rizikos.
- **Namų narių elgsena:** **katės lipa ir šokinėja → aukštis jų neapsaugo**; šunys kasa ir graužia; mažyliai kiša į burną, bet retai praryja daug; paukščiai skraido laisvai. Rekomendacija turi priklausyti nuo **to, kas gyvena**, ne tik nuo augalo.
- **Bendrinių vardų spąstai:** „lelija" ≠ *Lilium* (Spathiphyllum, Zantedeschia, Convallaria); „sago palmė" ≠ palmė.

_Procesas:_
- **Ekspertų laiko ekonomika:** curated-300 — **274 gentys, 114 šeimų**; top-12 šeimų dengia **131 gentį (48 %)**; Cactaceae, Orchidaceae, Araceae, Gesneriaceae, Bromeliaceae — **homogeniškos** (viena taisyklė dengia ~80 genčių); Crassulaceae — nehomogeniška (Kalanchoe toksiška, Crassula neaiški, Echeveria saugi). Tikrinant per augalą — šimtai puslapių; per klasę + šeimą + išimtis — **eilės tvarka mažiau**.
- **Atkartojamumas:** nėra „leidimo", kurį gali cituoti medikas ar akademinė publikacija.
- **Vartotojų pranešimų kanalo apie klaidas nėra.**

_Teisė:_ duomenys jau vieši (`public.js`); šaltinių licencijos nepatikrintos; „saugu" teiginiai nėra apriboti rūšimi.

### 10.6. Kritika ir pačiam struktūriniam modeliui

Modelio **forma** teisinga, bet:
1. **Jį parengė AI agentai, patikimumas — savęs įvertintas ~85–90 %.** Gražiai parašyti `aprasymai` atrodo autoritetingai — didžiausia rizika, kad modelis bus prijungtas ir **daugiau niekada neperskaitytas**. Į naują sistemą jis turi įeiti kaip **juodraštis**, ne kaip tiesa.
2. **Rūšies jautrumas pririštas prie klasės** → nuo klasės nepriklausantys faktai (lelijos nefrotoksinas katėms; Crassula „toxic principle unknown") reikalauja pilnaverčių **override'ų**, kurie dabar tik nubrėžti (`specialios_veliavos`).
3. **`saugus: true` kildinamas iš ASPCA „non-toxic" sąrašų**, kurie kalba **tik apie kates/šunis/žirgus**; vaikui toks „saugu" nepagrįstas.
4. **`sunkumo_lubos` = lubos, ne tipinis pavojus** → rodant lubas pervertinama (Passiflora, Kalanchoe). Reikia atskirti **tipinį** sunkumą (per gentį/rūšį) ir **lubas** (klasės kontekstas medikui).
5. **Nėra vaiko dimensijos ir poveikio kelio.**
6. **Apimtis — 72 esamo katalogo gentys**, 6 mirtinos klasės — orfanai.

---

## 11. Alternatyvų palyginimas

| | **A. Lopyti esamą** (rules + review flag'ai ant `savybes`) | **B. Prijungti struktūrinį modelį kaip yra** (pagal `toksiskumo-integracija.md`) | **C. Kompiliuojamas, versijuotas, ekspertų kuruojamas rinkinys** | **D. Ekspertų rašomas laisvo teksto vikis per augalą** | **E. Licencijuota komercinė toksikologijos DB** | **F. AI-first (RAG + daugiau AI)** |
|---|---|---|---|---|---|---|
| Sauga | Žema — heuristikos lieka | Vidutinė — gera forma, juodraščio turinys | **Aukšta** — deterministinė, testuojama, „nėra duomenų" eksplicitiška | Aukšta, jei pabaigiama | Aukšta (EN) | Žema — haliucinacijos saugos lauke |
| Teisinis gynybiškumas | Silpnas | Vidutinis | **Stiprus** — teiginių kilmė, nekintami leidimai, parašai | Stiprus, lėtas | Vidutinis (licencijos ribos) | Silpniausias |
| Ekspertų kaina | Neribota (per augalą) | Maža (per klasę) | **Maža** (klasė + šeima + išimtys) | Labai didelė | — | — |
| Palaikomumas | Prastas (mirror, migracijos) | Vidutinis | **Geras** (vienas kompiliatorius, vienas artefaktas) | Vidutinis | Priklausomybė nuo tiekėjo | Prastas |
| Padengimas | ASPCA∪PFAF, realiai tik gyvūnai | 72 gentys | Auga per šeimas/gentis; mirtini — pirmi | Dešimtys augalų | Platus | „Visi", bet nepatikimai |
| Laikas | Dienos | 1–2 sav. | 4–8 sav. (etapais) | Mėnesiai | Derybos | Dienos |
| Atvirumas (misija) | — | — | **Atviras duomenų leidimas** | Atviras | **Neatviras** | — |

**Verdiktai:**
- **A** — būtina kaip **stopgap** (Fazė 0), bet ne kaip tikslas: F1–F5 lieka.
- **B** — teisinga forma, bet prijungus juodraštį kaip tiesą, AI parašyti tekstai įgautų autoriteto be patikros; nėra versijų ir darbo eigos.
- **D** — per brangu savanoriams; laisvas tekstas netestuojamas.
- **E** — tinka kaip **įrodymų šaltinis** (jei atsirastų partnerystė), ne kaip pamatas: angliška, licencijuota, nepublikuojama atvirai — prieštarauja misijai.
- **F** — atmesta: būtent tai, ko išmokė Aconitum atvejis.
- **C** — rekomenduojama (§12): imama B forma, pridedamas tai, ko trūksta (kilmė, būsena, versijos, darbo eiga, tapatybė, poveikio keliai).

---

## 12. Tobuliausias galutinis variantas

### 12.1. Esmė

**„LapasID toksikologijos žinynas" — kompiliuojamas, versijuotas duomenų rinkinys, kuriame vienintelis autoritetas yra ekspertų kuruojami junginių klasių ir taksonų priskyrimų įrašai (ne augalų tekstai); kiekvienas teiginys turi šaltinius, patikimumą ir peržiūros būseną; ASPCA, PFAF ir literatūra yra tik įrodymai ir neatitikimų detektoriai; AI — tik offline juodraščių asistentas; programėlė rodo tik publikuotą, versijuotą leidimą, išvestą vieno deterministinio resolverio.**

### 12.2. Architektūra

```
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ [1] ĮRODYMAI (evidence) — ASPCA, PFAF, literatūra, Apsinuodijimų biuras, │
 │     vartotojų pranešimai. NIEKADA nerodomi tiesiogiai.                   │
 └───────────────┬──────────────────────────────────────────────────────────┘
                 │ neatitikimų detektorius → peržiūros eilė („ginčijama")
                 ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ [2] PASIŪLYMAI — ekspertų forma programėlėje, redaktorius, AI juodraščiai│
 │     (su citatomis), pranešimai. Firestore `toxicityProposals` (rolės).   │
 └───────────────┬──────────────────────────────────────────────────────────┘
                 │ patvirtinta → automatinis PR
                 ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ [3] ŠALTINIO TIESA — git: data/toxicity/                                 │
 │     names · classes · families · genera · overrides · placement-rules ·  │
 │     contacts      (git istorija = audito žurnalas)                       │
 └───────────────┬──────────────────────────────────────────────────────────┘
                 │ CI: schemos validatoriai + „golden" testai
                 ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ [4] KOMPILIATORIUS scripts/build-toxicity.mjs → LEIDIMAS vX.Y.Z          │
 │     (per-taksoną × per-rūšį profilis, hash, changelog, parašų manifestas)│
 └───────────────┬──────────────────────────────────────────────────────────┘
                 ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ [5] PUBLIKAVIMAS — Firestore `toxicity/{version}` (read-only) +          │
 │     `toxicity/current`; statinis public/data/toxicity/vX.json (PWA,      │
 │     offline, atviri duomenys). Katalogas saugo tik `toxicityKey`.        │
 └───────────────┬──────────────────────────────────────────────────────────┘
                 ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ [6] RESOLVERIS (vienas modulis, be mirror): tapatybė + namų profilis +   │
 │     leidimas → rizikos, vietos rekomendacija, medikų kortelė             │
 └───────────────┬──────────────────────────────────────────────────────────┘
                 ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ [7] PATEIKIMAS — augalo kortelė · kolekcijos rizikų SĄRAŠAS (ne balas) · │
 │     „aukščiau / ant žemės / ne namuose" · medikų kortelė · „nėra duomenų"│
 └──────────────────────────────────────────────────────────────────────────┘
```

### 12.3. Duomenų modelis (`data/toxicity/`)

**Suvienodinti enumai:**

```
sunkumas:   'nera' | 'silpnas' | 'vidutinis' | 'sunkus' | 'mirtinas' | null
            // 'nera' = aktyvus teiginys „netoksiška ŠIAI rūšiai" (reikia rūšiai specifinio šaltinio)
            // null   = nėra duomenų → rodoma „nėra duomenų", NIEKADA „saugu"
            // legacy 'stiprus' → 'sunkus' (numatyta) arba 'mirtinas' (tik su peržiūra)
rusis:      'suauges' | 'vaikas' | 'kate' | 'suo' | 'paukstis' | 'grauzikas'
mechanizmas:'lokalus_dirgiklis' | 'sisteminis' | 'fototoksinis'
kelias:     'prarijimas' | 'oda_sultys' | 'akys' | 'ziedadulkes' | 'vazos_vanduo'
dalis:      'visos' | 'lapai' | 'sultys_latex' | 'svogunelis' | 'gumbas' | 'seklos' | 'uogos' | 'ziedai' | 'saknys'
patikimumas:'AUKSTAS' | 'VIDUTINIS' | 'ZEMAS'
busena:     'juodrastis' | 'parengta' | 'botaniskai_patikrinta' | 'patvirtinta' | 'gincijama' | 'pakeista'
```

**Teiginio (claim) blokas** — prisegamas prie kiekvieno faktų įrašo:

```jsonc
"teiginys": {
  "saltiniai": [
    { "tipas": "aspca", "nuoroda": "https://www.aspca.org/…/easter-lily",
      "pavadinimas": "ASPCA — Easter Lily", "rusims": ["kate"], "prieiga": "2026-11-01",
      "citata": "toxic to cats" }
  ],
  "patikimumas": "AUKSTAS",
  "perziura": {
    "busena": "patvirtinta",
    "istorija": [
      { "busena": "parengta", "kas": { "vardas": "…", "role": "redaktorius" }, "kada": "2026-11-02" },
      { "busena": "patvirtinta", "kas": { "vardas": "dr. …", "role": "vet_toksikologas",
        "institucija": "…" }, "kada": "2026-11-20" }
    ]
  }
}
```

**Failai:**

| Failas | Paskirtis | Pavyzdys / esmė |
|---|---|---|
| `names.json` | Taksonomijos stuburas: priimtas vardas, sinonimai, išoriniai ID (GBIF/POWO), LT vardai, **bendrinių vardų spąstai** | `"Sansevieria trifasciata" → "Dracaena trifasciata"`; `"lelija" → [Lilium, Spathiphyllum, Zantedeschia, Convallaria]` (reikia patikslinti) |
| `classes.json` | ~20 junginių klasių (dabartinis `toxin-classes.json` + plėtiniai) | `rusies_jautrumas` su **`vaikas`**; `keliai{}`; `organai[]`; `antidotas_yra` + `antidotas` (faktas medikui); `simptomai_lt`; `medikui_lt`; `tekstai{vaikams, suaugusiems, gyvunams}` — **statiniai, patvirtinti**; `teiginys` |
| `families.json` | Šeimų numatytosios taisyklės | `ARACEAE → ca_oxalate_insoluble (visos)`; `MARANTACEAE → nera {kate, suo}`; `CRASSULACEAE → nėra numatytosios (heterogeniška)` |
| `genera.json` | Genties priskyrimai (perrašo šeimą) | žr. žemiau |
| `overrides.json` | Retos rūšies/kultivaro išimtys | `Euphorbia pulcherrima → tipinis silpnas (mitas „mirtina")`; `Solanum pseudocapsicum → uogos` |
| `placement-rules.json` | Vietos rekomendacijų taisyklių lentelė | §12.5 |
| `contacts.json` | LT kontaktai su patikrinimo data | Apsinuodijimų kontrolės ir informacijos biuras; 24/7 vet klinikos |
| `evidence/` | Įrodymų momentinės kopijos su datomis | ASPCA, PFAF, literatūra — **tik** neatitikimų detektoriui |
| `releases/` | Sukompiliuoti leidimai + `CHANGELOG.md` + manifestas | `v1.2.0.json`, hash, parašai |

**Genties priskyrimas (`genera.json`):**

```jsonc
"LILIUM": {
  "statusas": "toksiska",
  "tier": 1,
  "toksinai": [
    { "klase": "lily_nephrotoxin",
      "dalys": ["visos", "ziedadulkes"], "keliai": ["prarijimas", "ziedadulkes", "vazos_vanduo"],
      "sunkumas": { "kate": "mirtinas", "suo": "silpnas", "suauges": null, "vaikas": null },
      "veliavos": ["kritine_katei", "puokstes_rizika"],
      "teiginys": { "saltiniai": [ /* ASPCA easter/tiger lily (rusims:[kate]), Pet Poison Helpline */ ],
                    "patikimumas": "AUKSTAS", "perziura": { "busena": "parengta" } } }
  ],
  "netoksiska": { "teiginys": null },        // „saugu" teiginiai — tik su rūšiai specifiniu šaltiniu
  "kontekstas": ["skinta_geles", "sezonine"]   // apimtis ne tik kambariniai
}
```

**Sunkumo išvedimas kompiliavimo metu:** `genera[g].sunkumas[rūšis]` (eksperto nustatytas) **>** `overrides` **>** `families` numatytasis **>** `classes.rusies_jautrumas[rūšis]` (su dalies/kelio korekcija). Kas neišvedama — `null` („nėra duomenų"). `classes.sunkumo_lubos` rodomos tik medikų kortelėje kaip kontekstas.

**Asimetrinis įrodymų slenkstis** (svarbiausia saugos taisyklė):

| Kas rodoma vartotojui | Minimalus pagrindas | Minimali būsena |
|---|---|---|
| „Pavojinga [rūšiai]" (įspėjimas) | 1 patikimas šaltinis | `parengta` |
| „Mirtina [rūšiai]" / kritinė vėliava | 1 patikimas šaltinis + klasė | `parengta` (rodoma iškart; patvirtinimas prioritetinis) |
| „Netoksiška [katei/šuniui]" | rūšiai specifinis šaltinis (pvz. ASPCA) | `botaniskai_patikrinta` |
| „Netoksiška vaikui / žmogui" | žmonėms specifinis šaltinis | `patvirtinta` (toksikologas) |
| Medikui tekstas, pirmoji pagalba | toksikologo tekstas | `patvirtinta` |
| Viskas kita | — | „Nėra duomenų — elkitės atsargiai" |

_Įspėti galima anksčiau nei nuraminti._ Tai tiesiogiai mažina „false reassurance" riziką (§13).

**Užduoties reikalavimai → kur schemoje:**

| Reikalavimas | Laukas |
|---|---|
| Per rūšį (žmogus/vaikas/šuo/katė/kiti) | `sunkumas{suauges, vaikas, kate, suo, paukstis, grauzikas}` |
| Sunkumo skalė | `nera … mirtinas` + `null`; `mechanizmas` atskira ašis |
| Toksinės medžiagos | `toksinai[].klase` → `classes.json` |
| Augalo dalys | `toksinai[].dalys` (+ `keliai`) |
| Simptomai | `classes.simptomai_lt` (statinis, patvirtintas) |
| Pirmoji pagalba | `classes.medikui_lt` + `contacts.json`; vartotojui — **tik** toksikologo patvirtintas bendras tekstas + kontaktai (§13) |
| Šaltiniai su nuorodomis | `teiginys.saltiniai[]{nuoroda, pavadinimas, rusims, prieiga, citata}` |
| Patikimumo lygis | `teiginys.patikimumas` + `tier` |
| Peržiūros būsena (AI → ekspertas → patvirtinta) | `teiginys.perziura.busena`: `juodrastis → parengta → botaniskai_patikrinta → patvirtinta` |
| Kas ir kada tikrino | `teiginys.perziura.istorija[]{kas{vardas, role, institucija}, kada}` + git istorija + leidimo manifestas |

### 12.4. Kompiliatorius ir leidimai

- **`scripts/build-toxicity.mjs`**: validuoja schemą → sprendžia sinonimus → išveda per-taksoną × per-rūšį profilį → išleidžia `releases/vX.Y.Z.json` su turinio hash ir automatiniu changelog (diff nuo ankstesnio leidimo).
- **CI blokuoja leidimą, jei:** klasė be nuorodos; teiginys be šaltinio; `nera` be rūšiai specifinio šaltinio; **mirtinų genčių sąrašo** gentis nėra arba be klasės; LT tekstas tuščias; „golden" testai (pvz. 40 ekspertų patvirtintų scenarijų „augalas × namų profilis → laukiamas rezultatas") nepraeina. Esamas `toxinClasses.test.js` — pradžia.
- **Versijavimas:** major — schemos pokytis; minor — nauji taksonai/teiginiai; patch — teksto pataisos.
- **Manifestas:** versija, data, hash, teiginių skaičius pagal būsenas, **parašai** `[{role, vardas, institucija, apimtis, data}]`.
- **Publikavimas:** Firestore `toxicity/{version}` (tik skaitomas) + `toxicity/current` rodyklė; statinis `public/data/toxicity/vX.json` (PWA offline, atviri duomenys). **Katalogo įrašas saugo tik `toxicityKey`** (priimtas taksonas); toksiškumas niekada neužrašomas ant katalogo. F1 overlay prijungia dabartinį leidimą skaitymo metu. Įšaldytas augalas (`refFrozen`) saugo `toxicityRelease`, kurį matė.
- **Rollback:** `toxicity/current` perkeliamas į ankstesnę versiją; niekas netrinama.

### 12.5. Resolveris ir tai, ką mato vartotojas

**Vienas modulis** (naršyklė + serveris tą patį failą; logika triviali, nes sunkumas jau sukompiliuotas): `resolveToxinProfile(tapatybe, namai, leidimas)`.

- **Tapatybė:** `{ priimtasVardas, kandidatai[{vardas, confidence}], vartotojasPatvirtino }`. Jei nepatvirtinta ir (`confidence` žemas **arba** kandidatų toksiškumas skiriasi) → **„Tapatybė nepatvirtinta"** + **blogiausias kandidatų profilis** + „patvirtinkite augalą". Bendrinių vardų spąstai → patikslinimo klausimas.
- **Namai:** tik booleanai `{vaikas, kate, suo, paukstis, grauzikas}` (GDPR).
- **Išvestis:** kiekvienam namų nariui — sunkumas, mechanizmas, dalys, keliai, vėliavos, būsenos etiketė, šaltiniai; vietos rekomendacija; medikų kortelės duomenys.

**Vietos rekomendacija — deterministinė taisyklių lentelė** (`placement-rules.json`, peržiūri veterinaras + pediatras toksikologas; pirmoji tinkanti eilutė laimi):

| # | Sąlyga (namuose yra…) | Rekomendacija vartotojui |
|---|---|---|
| 1 | katė **ir** `kate ≥ sunkus` arba vėliava `kritine_katei` | **„Geriau ne namuose"** — katės lipa ir šokinėja, aukštis neapsaugo; įskaitant puokštes, jei `puokstes_rizika` |
| 2 | bet kas, kurio `≥ sunkus` per `ziedadulkes` / `vazos_vanduo` | **„Geriau ne namuose"** |
| 3 | vaikas ar šuo **ir** jų `≥ vidutinis` (katės nėra arba jai `≤ silpnas`) | **„Laikyti aukščiau, nepasiekiamai; rinkti nukritusius lapus/uogas"** |
| 4 | paukštis **ir** `paukstis ≥ vidutinis` | **„Ne patalpose, kur paukštis skraido laisvai"** |
| 5 | visiems namų nariams `≤ silpnas` ir mechanizmas `lokalus_dirgiklis` | **„Gali stovėti ant žemės"** (+ „genint — pirštinės", jei `oda_sultys`) |
| 6 | visiems namų nariams `nera` (su šaltiniu) | **„Tinka bet kur"** + šaltinis |
| 7 | bent vienam namų nariui `null` | **„Nėra duomenų — laikykite atsargiai, kol patikrinsime"** |

Rekomendacijos — **faktinio pobūdžio** („kur laikyti"), ne medicininiai nurodymai.

**Kolekcijos ataskaita:** rizikų **sąrašas**, surikiuotas pagal sunkumą ir namų narius — **jokio „saugumo balo"**.

**Medikų / veterinaro kortelė:** tapatybė (LT + priimtas lotyniškas vardas + sinonimai + vartotojo nuotrauka), dalys ir keliai, junginių klasės, mechanizmas, paveiktos sistemos, ar yra antidotas (faktas), `medikui_lt`, šaltiniai, **leidimo versija + hash + peržiūros būsena + recenzento institucija**, kontaktai. Statinė, spausdinama, veikia offline, QR į viešą `/p/{plantId}`. Rodoma tik klasėms su `patvirtinta` `medikui_lt`; kitaip — tik tapatybė, šaltiniai ir kontaktai.

### 12.6. Ekspertų peržiūros darbo eiga

**Rolės** (`users.roles[]`, `isAdmin` išlaikomas):

| Rolė | Gali | Negali |
|---|---|---|
| `redaktorius` | kurti/redaguoti pasiūlymus, pridėti šaltinius, `juodrastis → parengta` | patvirtinti turinį |
| `botanikas` | tikrinti tapatybę, gentį, dalis, sinonimus → `botaniskai_patikrinta` | tvirtinti sunkumo/medikui tekstų |
| `toksikologas` (žmonėms) | tvirtinti `suauges`/`vaikas` sunkumą, simptomus, `medikui_lt` → `patvirtinta` | tvirtinti gyvūnų teiginių |
| `vet_toksikologas` | tvirtinti `kate/suo/paukstis/grauzikas` → `patvirtinta` | tvirtinti žmonių teiginių |
| `leidimo_vadovas` | sujungti PR, išleisti versiją | keisti patvirtintų teiginių be naujo pasiūlymo |
| `sistema` / AI | kurti `juodrastis` su citatomis | bet ką aukščiau `juodrastis` |
| vartotojas | „Pranešti apie klaidą" → pasiūlymas | redaguoti |

**Eiga:**

```
 pasiūlymas (forma / pranešimas / AI juodraštis / neatitikimų detektorius)
      │
      ▼
 juodrastis ──[redaktorius: šaltiniai]──► parengta ──[botanikas]──► botaniskai_patikrinta
      ▲                                                                   │
      │                                                  [toksikologas / vet_toksikologas]
      │                                                                   ▼
      └──────────── grąžinta su komentaru ◄──────────────────────── patvirtinta
                                                                          │
                       automatinis PR į data/toxicity/ → CI → leidimo vadovas sujungia
                                                                          ▼
                                                   kompiliacija → leidimas vX.Y.Z → publikuota
 naujas įrodymas / pranešimas → „gincijama" → atgal į eilę (senas leidimas lieka cituojamas)
```

- **Kur gyvena pasiūlymai:** Firestore `toxicityProposals/{id}` — skaito/rašo tik rolės; viešoji programėlė jų **neskaito**. UX — `LibraryEditorV2` režimas „Toksikologija": šalia rodomi įrodymai (ASPCA/PFAF/literatūra), neatitikimai, diff su leidimu, parašo mygtukas pagal rolę. Eilės ženklelis — pagal `AdminPendingBadge` šabloną.
- **Ekspertams git nereikia.** Patvirtinti pasiūlymai virsta PR automatiškai (serverless veiksmas su GitHub API) arba eksportu, kurį sujungia leidimo vadovas.
- **Iki akademijos:** įkūrėjas = redaktorius + leidimo vadovas; redaguoja `data/toxicity/` tiesiai per PR; leidimai žymimi „parengta, nepatikrinta ekspertų".
- **Istorija (nekintama):** git commit'ai (kas/ką/kada) + pasiūlymų įrašai (komentarai, sprendimai) + leidimų changelog. Seni leidimai niekada netrinami.
- **Atsakomybė:** kiekvienas `patvirtinta` teiginys turi konkretų recenzentą ir rolę; leidimas turi atsakingą pasirašantįjį (institucija); botanikas atsako už tapatybę/dalį, toksikologai — už sunkumą ir tekstus. **Švari riba (`33`):** misijos duomenys vieši ir (bendrai) priklauso projektui/institucijai; komercinė platforma — įkūrėjo.
- **Peržiūros tvarka (didžiausia nauda per eksperto valandą):** (1) ~20 klasių su `vaikas` ir keliais; (2) **mirtinų genčių sąrašas** (~25, įsk. puokštes/sezoninius); (3) šeimų taisyklės (~15–20 šeimų dengia didžiąją dalį); (4) heterogeniškos šeimos ir išimtys; (5) vietos taisyklių lentelė; (6) `medikui_lt`. _Įvertis: tai eksperto darbo dienos, ne mėnesiai — vs. šimtai augalų puslapių per augalą._

### 12.7. AI vieta

| Leidžiama (offline, visada → `juodrastis` su citatomis) | Draudžiama |
|---|---|
| Naujų genčių pasiūlymų juodraščiai su privalomomis nuorodomis | Bet koks toksiškumo teksto generavimas runtime |
| LT formuluočių juodraščiai klasių tekstams (peržiūrimi) | „Gap-fill" pavojų užpildymas (`aiSupplementaryHazard`) |
| Įrodymų ištraukimas iš literatūros redaktoriui | Sunkumo sprendimai |
| Identifikacija (foto/paieška) — atskira sritis, **neapibrėžtumas perduodamas** resolveriui | „Vertimas ir papildymas" per kiekvieną enrich |

Praktiškai: išimti toksiškumo laukus iš Phase 2 `TOOL_DETAILS`; pašalinti narratyvo iškvietimą (−1 Claude iškvietimas per išsaugojimą); visi vartotojo matomi toksiškumo tekstai — **saugomos, patvirtintos konstantos**, parametrizuojamos augalo vardu/dalimi.

### 12.8. Ko NEstatyti

- Simptomų → veiksmų srautų, „stebėkite namie" patarimų, dozių skaičiuoklių (MDR Rule 11).
- Namų „saugumo balo" ar bet kokio žalio „saugu" numatytojo, kai nėra duomenų.
- Runtime LLM toksiškumo tekstų; LLM pavojų užpildymo.
- Ekspertų redagavimo tiesiai gyvame Firestore/kataloge; per-augalą laisvo teksto toksiškumo laukų.
- Paukščių/graužikų teiginių be rūšiai specifinio šaltinio.
- Antros derivavimo logikos kopijos (client/server).

### 12.9. Pagrindimas — kodėl būtent šis variantas

1. **Sauga.** Deterministinė, testuojama išvestis (golden testai, mirtinų genčių vartai CI) pašalina §10.2 problemas: 19/31 nesutarimą, ne tos genties PFAF puslapius, 23 % ASPCA pasiekiamumą, lelijos×katės praradimą. Asimetrinis slenkstis leidžia įspėti iškart, o nuraminti — tik su įrodymu.
2. **Teisinis gynybiškumas.** Teiginių kilmė + nekintami leidimai + parašai + istorija = galimybė parodyti „ką žinojome, iš kur, kas patikrino, ką vartotojas matė" — PLD 2024/2853 „state-of-the-art" gynybos pamatas. Jokio triažo → ne medicinos prietaisas. Medikų kortelė cituoja konkretų leidimą.
3. **Ekspertų laiko ekonomika.** Tikrinama ~20 klasių + šeimų taisyklės + išimtys, ne tūkstančiai augalų/kultivarų (274 gentys / 114 šeimų; viena Araceae taisyklė dengia 15 genčių). Tik taip savanoriška akademijos peržiūra realiai įvykdoma.
4. **Akademinė vertė ir nuosavybė.** Versijuotas, cituojamas, atviras duomenų rinkinys — viešoji gėrybė, kurią institucija gali (bendrai) valdyti ir publikuoti; tai tiksliai atitinka `33` logiką („institucija finansuoja viešąją vertę ir save kaip savininkę").
5. **Palaikomumas.** Jau prireikė 3 duomenų migracijų dėl taisyklių pokyčių (`cleanup-toxicity-severity.mjs`, `migrate-irritant-tipas.mjs`, `migrate-toxicity-animals-lt.mjs`) — tai simptomas, kad išvestis saugoma kaip šaltinis. Naujame modelyje taisyklės pokytis = naujas leidimas, be Firestore migracijų; dingsta client/server mirror.
6. **Kaina.** Mažiau AI iškvietimų per išsaugojimą; duomenys talpinami PWA, veikia offline.
7. **Remiasi esamu turtu.** `toxin-classes.json`, `genus-toxin-map.json`, `verify-toxin-map.mjs`, `toxinClasses.test.js`, F1 overlay, `LibraryEditorV2`, „pending→approve" UX — tai **evoliucija, ne perrašymas nuo nulio**.

### 12.10. Kompromisai ir rizikos

- **Pradžioje mažai `patvirtinta` turinio.** Sprendimas — sąžiningos etiketės („parengta pagal šaltinius, laukia eksperto patikros") ir asimetrinis slenkstis.
- **Leidimų procesas prideda darbo.** Mažinama automatizavimu (auto-PR, CI, changelog).
- **Dvi vietos** (pasiūlymai Firestore, tiesa git'e) — reikia disciplinos; pasiūlymai yra tik „inbox".
- **Genties lygio granuliarumas** — išimtys per `overrides`; toksinai daugiausia konservuojami gentyje.
- **Ekspertų prieinamumas — butelio kaklelis**; reikia „čempiono" institucijoje (`33`).
- **Taksonomijos stuburas** — pradinis darbas (sinonimai, šeimų normalizacija).

---

## 13. Teisinė / atsakomybės architektūra

_(Sintezė iš `konsiliumas-2026-06/45-liability-redteam.md`, `46-saugumo-feature-sinteze.md`, `44-namu-saugumo-intelektas.md`, `docs/konsiliumas-2026-06-tyrimas.md`.)_

- **🔴 P0 — užrakinti rašymą.** `catalog` ir `plant-passports` atviri bet kuriam authed vartotojui, o `api/catalog/public.js` duomenis jau rodo viešai. PLD 2024/2853 (programinė įranga = produktas, griežtoji atsakomybė nuo 2026-12-09) → klaidinga info, prisidėjusi prie žalos, atsakomybė be kaltės įrodinėjimo.
- **Jokio simptomų tikrintuvo / sprendimų medžio** (MDR Rule 11 + AI Act). Leidžiama: faktas + simptomai kaip statinė info + kontaktai + „kreipkitės į specialistą". Jokių dozių skaičiuoklių; jokių pirmosios pagalbos **instrukcijų** pasauliečiui (vėmimo sukėlimas oksalatams/kardiotoksinams kontraindikuotas) — tik toksikologo patvirtintas bendras tekstas ir kontaktai.
- **False reassurance = atskira atsakomybė** → jokio balo; rizikų sąrašas; „nėra duomenų ≠ saugu"; **„saugu" tik apribotas rūšimi ir su šaltiniu** (§12.3 asimetrinis slenkstis).
- **Švarus, atsekamas source-of-truth** (teiginių kilmė, parašai, nekintama istorija, leidimai) = „state-of-the-art" gynyba.
- **Medikų kortelė** — saugiausias ir kartu labiausiai eksponuotas artefaktas (medikas pagal ją veiks) → visada su versija, būsena ir šaltiniais, niekada negeneruojama „skrydžio metu".
- **Šaltinių licencijos.** ASPCA ir PFAF naudojimo sąlygos viešam duomenų rinkiniui **nepatikrintos** (PFAF turinys gali būti ribojamas nekomercinėmis sąlygomis — reikia patikrinti). Naujame modelyje jie lieka **citatomis/įrodymais**, o publikuojamas tekstas — savas, ekspertų patvirtintas.
- **GDPR:** namų profilis — tik booleanai, be vaiko amžiaus/vardo.
- **Disclaimer:** „Informacija — pažintinio pobūdžio, nepakeičia gydytojo/veterinaro konsultacijos." Įkūrėjo sprendimas — be telefono numerio iki partnerystės. LT: žmonėms — Apsinuodijimų kontrolės ir informacijos biuras; **gyvūnams LT pet poison linijos nėra** → artimiausia 24/7 vet klinika. Kontaktus patikrinti prieš produkciją (`contacts.json` su patikrinimo data).

---

## 14. Migracijos planas (be vykdymo)

> **Niekas nepaleista.** Visi duomenų žingsniai — su `--dry-run` pirma; produkciniai duomenys nekeičiami be atskiro sprendimo. Migracija aditivinė: legacy laukai neištrinami (lieka istorijai), naujas sluoksnis įjungiamas šalia, rollback — `toxicity/current` rodyklės perkėlimas.

### Fazė 0 — Saugos stopgap'ai dabartiniame pipeline (dienos)
1. **Užrakinti `firestore.rules`** `catalog` ir `plant-passports` rašymą (`isAdmin()` / serverio admin SDK).
2. **Išjungti PFAF genties fallback'ą** abiejose `deriveToxicity` kopijose (tik tikslus rūšies įrašas).
3. **Lelija/Hemerocallis × katė** — laikina kritinė vėliava.
4. **Ištaisyti `batch-enrich-catalog.mjs`** narratyvo argumentus.
5. **UI:** nerodyti bendro „saugu", kai šaltinis tik apie gyvūnus.

_Baigta, kai:_ rules užrakintos; `audit-toxicity-sources.mjs` rodo 0 ne tos genties fallback'ų runtime kelyje; lelijos×katės scenarijus rodo kritinę vėliavą.

### Fazė 1 — Duomenų rinkinio pamatas git'e (1–2 sav.)
6. Sukurti `data/toxicity/` (§12.3); perkelti `toxin-classes.json` + `genus-toxin-map.json` — **visi teiginiai įeina kaip `juodrastis`/`parengta` su šaltiniais**, niekas automatiškai nevirsta `patvirtinta`.
7. `names.json` iš esamų sinonimų failų (`build-latin-synonyms-reverse.mjs`, `extend-latin-synonyms.mjs`) + `parseLatinName`; normalizuoti šeimas.
8. Pridėti **mirtinų genčių sąrašą + puokščių/sezoninius** (Lilium, Hemerocallis, Nerium, Convallaria, Gloriosa, Amaryllis/Hippeastrum, Narcissus, Hyacinthus, Tulipa, Rhododendron, Cyclamen, Digitalis, Taxus, Ricinus …); prijungti 6 orfanines klases.
9. Pridėti `vaikas`, `keliai`, tipinio vs lubų atskyrimą; `placement-rules.json` ir `contacts.json` juodraščius.

_Baigta, kai:_ CI validatoriai praeina; mirtinų genčių sąrašas 100 % su klase.

### Fazė 2 — Kompiliatorius, leidimai, neatitikimų detektorius (≈1 sav.)
10. `scripts/build-toxicity.mjs` → leidimas `v0.1.0` (žymimas „parengta, nepatikrinta ekspertų").
11. „Golden" testų rinkinys (scenarijai augalas × namai).
12. `verify-toxin-map.mjs` → neatitikimų detektorius prieš ASPCA (rūšiai specifiškai) ir PFAF (tik signalas); `audit-toxicity-sources.mjs` — regresijos kontrolė.

_Baigta, kai:_ leidimas atkartojamas (tas pats hash); golden testai praeina.

### Fazė 3 — Prijungimas prie programėlės (2–3 sav.)
13. Vienas resolverio modulis; leidimo skaitymas (PWA cache); katalogas → `toxicityKey`.
14. Augalo kortelė, namų profilis (booleanai), vietos rekomendacija, kolekcijos rizikų sąrašas, „nėra duomenų", tapatybės neapibrėžtumo tvarkymas.
15. Išimti toksiškumą iš Phase 2 schemos; pašalinti narratyvo iškvietimą ir `aiSupplementaryHazard`.
16. `savybes.pavojai` — tik laikinas fallback gentims, kurių dar nėra leidime (su „nepatikrinta" etikete); pašalinamas pasiekus padengimą.

_Baigta, kai:_ visos 274 curated gentys išsisprendžia į leidimą arba eksplicitinį „nėra duomenų"; toksiškumo kelyje runtime AI nėra.

### Fazė 4 — Ekspertų darbo eiga (≈2 sav. + partnerystė)
17. `users.roles[]`, `toxicityProposals` kolekcija + rules, `LibraryEditorV2` „Toksikologija" režimas, auto-PR, parašų manifestas, „Pranešti apie klaidą".
18. Pilotas su akademija: klasės → mirtinos gentys → šeimų taisyklės → vietos lentelė.

_Baigta, kai:_ išleistas pirmas leidimas su ≥1 institucijos parašu.

### Fazė 5 — Medikų kortelė ir atviri duomenys
19. Medikų kortelė — tik klasėms su `patvirtinta` `medikui_lt`.
20. Atviras duomenų leidimas su licencija, suderinta su institucija.
21. Legacy tvarkymas: C1 prieštaravimai išnyksta, nes rodoma iš leidimo; legacy laukai lieka tik skaitomi istorijai.

**Priklausomybės:** F0 nepriklausoma (daryti pirmą). F1 → F2 → F3. F4 gali prasidėti po F1 (redaktoriaus režimu), ekspertų parašai — po partnerystės (`33`). F5 — po F4.

---

## 15. Atviri klausimai ir rizikos

- **`vaikas` jautrumas** — atskiras vertinimas ar paveldėjimas su dozės korekcija? → pediatro toksikologo sprendimas (`45-pediatras-toksikologas.md`). Iki tol — niekada ne žemiau suaugusio vertės.
- **Ar rodyti `parengta` (nepatikrintus) teiginius viešai?** Rekomendacija: įspėjimus — taip (su etikete), „saugu" — ne.
- **Kas yra leidimo vadovas** ilgainiui — įkūrėjas ar institucija? Susiję su duomenų nuosavybe (`33`).
- **Duomenų licencija** (pvz. CC BY) — suderinti su institucija; patikrinti ASPCA/PFAF sąlygas.
- **Žirgai** (ASPCA turi) — kambarinių kontekste už apimties; paukščiai/graužikai — tik su rūšiai specifiniu šaltiniu.
- **„Wallet object"** strateginiuose dokumentuose **nerastas**; artimiausia — viešas paso puslapis `/p/{plantId}` + spausdinamas tag. Medikų kortelė (§12.5) būtų natūralus kandidatas tokiam „nešiojamam" objektui — verta aprašyti atskirai.
- **Agreguoti duomenys verslui** — 3 segmentas „durys"; vartotojų duomenys — niekada; mirtingumo „moat" kaip pipeline realiai neegzistuoja (`11-sinteze.md`).

---

## 16. Priedas: failų žemėlapis

**Duomenys (`data/`)**
- `toxin-classes.json`, `genus-toxin-map.json` — struktūrinis modelis (naujo `data/toxicity/` sėkla)
- `aspca-toxicity.json`, `aspca-genus-map.json`, `aspca-animals-lt.json` — ASPCA
- `pfaf.json` (+ `pfaf-*-chunks/`) — PFAF
- `curated-300.json` — kuruojamas genčių sąrašas (274)
- `plants.json` — vardų indeksas; `pre-db.json` — taksonomija/priežiūra

**Kodas**
- `src/utils/deriveToxicity.js` + `api/_lib/deriveToxicity-server.js` — runtime išvedimas (MIRROR)
- `api/save-plant.js` — runtime enrich; `api/_lib/catalog-server.js` — katalogo rašymas (`merge:true`, image freeze)
- `api/_lib/toxicityNarrativeGenerator-server.js` + `src/utils/toxicityNarrativePrompts.js` (`TRANSLATOR_SYSTEM`)
- `src/utils/preDbBaseResult.js`, `src/utils/catalogPreviewUpsert.js` — paieškos/preview toksiškumas
- `api/catalog/public.js` — viešas katalogo API (be auth)
- `src/utils/plantTransform.js`, `src/utils/plantPromptConfig.js` (`TOOL_DETAILS`), `src/utils/latinName.js` (`parseLatinName`)
- `src/components/admin/LibraryEditorV2.jsx`, `QuickApproveSheet.jsx`, `AdminPendingBadge.jsx`
- `src/utils/catalog.js` — F1 overlay
- `src/utils/toxinClasses.test.js`, `scripts/verify-toxin-map.mjs`
- **`scripts/audit-toxicity-sources.mjs`** — šio dokumento empirinis auditas (tik skaito)

**Skriptai (migracija/cleanup)**
- `combine-pre-db.mjs`, `build-aspca-genus-map.mjs`, `generate-curated-300.mjs`, `batch-enrich-catalog.mjs`, `validate-pre-db.mjs`
- `cleanup-toxicity-severity.mjs`, `migrate-irritant-tipas.mjs`, `migrate-toxicity-animals-lt.mjs`

**Dokumentai**
- `docs/toksiskumo-klasifikacija.md`, `docs/toksiskumo-integracija.md` — modelio pagrindas
- `docs/plant-savybes-logic.md` — iš dalies pasenęs (§9)
- `tasks/konsiliumas-2026-06/` — kryptis, teisė, akademijos planas
- `tasks/toxin-review-queue.md` — esama statinė peržiūros eilė

---

_Parengta automatinės analizės (Claude Code) 2026-11-03. Teiginiai paremti repo kodu/duomenimis; kur remiamasi bendromis žiniomis — pažymėta. Jokie produkciniai duomenys nekeisti._
