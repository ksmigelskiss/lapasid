# Plants.json garbage placeholder + gaspadorius mis-classification audit
**Date:** 2026-05-31
**Scope:** READ-ONLY verification report. No data files modified.
**Sources:** Lithuanian Wikipedia (lt.wikipedia.org), Wikidata, ekoagros.lt PDF (binary, partially inaccessible), gamtininkas.lt, biologija.fandom.com (FANDOM), zodynas.lt, plants.json internal cross-reference (species → genus inference).

---

## Section 1: Plants.json fixes — HIGH confidence (auto-applicable)

These 11 entries have at least two independent authoritative sources agreeing on the LT genus name (LT Wikipedia article + species name pattern in plants.json itself + family-list article on Wikipedia).

| # | Latin | Current (garbage) | Proposed LT | Sources | Confidence |
|---|---|---|---|---|---|
| 1 | Acacia | `dygliuoto medžio vardas` | `akacija` | LT WP article "Akacija" exists; plants.json species use "akacija" (e.g. `arabinė akacija`, `sidabrinė akacija`) | HIGH |
| 2 | Blechnum | `vieno iš paparčių vardas` | `unksmenė` | LT WP article "Unksmenė" defines `Unksmenė (Blechnum) – unksmeninių (Blechnaceae) šeimos augalų gentis`. ⚠️ Note: plants.json has `Blechnum spicant = varpotoji nukimėlė` (Wikipedia: `varpotoji unksmenė`) — species spelling looks wrong, OUT OF SCOPE for this task. | HIGH |
| 3 | Myrica | `kažkokės kvapaus augalo vardas` | `sotvaras` | LT WP "Pajūrinis sotvaras" article: `Sotvaras (Myrica)`. ⚠️ plants.json has `Myrica gale = pajūrinis šilvarus` — Wikipedia uses `pajūrinis sotvaras`. Species spelling discrepancy, OUT OF SCOPE. | HIGH |
| 4 | Myrrhis | `kažkokio stipriai kvepiančio augalo vardas` | `garduoklė` | LT WP article "Garduoklė": `Garduoklė (Myrrhis) – salierinių (Apiaceae) šeimos augalų gentis`. ⚠️ plants.json `Myrrhis odorata = kvapioji garduvėlė` — Wikipedia says `kvapnioji garduoklė`. Species spelling out of scope. | HIGH |
| 5 | Myrtus | `šio augalo vardas` | `mirta` | LT WP family article "Mirtiniai" lists `Mirta (Myrtus)` explicitly. plants.json: `Myrtus communis = tikroji mirta`. lt-names.json synonyms: `Mirta paprastoji`. Three concurring sources. | HIGH |
| 6 | Pistacia | `šio augalo vardas` | `pistacija` | LT WP article "Pistacija" exists: `Pistacija (Pistacia) – anakardinių šeimos augalų gentis`. plants.json species: `tikroji pistacija`, `terpentininė pistacija`, etc. | HIGH |
| 7 | Potamogeton | `iš augalo vardas` | `plūdė` | LT WP article "Potamogeton" redirects to: `Plūdė (Potamogeton) – plūdinių (Potamogetonaceae) šeimos vandens augalų gentis`. plants.json: 10+ species `... plūdė`. | HIGH |
| 8 | Schoenus | `viksvinio augalo vardas` | `vikšrenis` | LT WP article "Vikšrenis": `Schoenus`, sedge family Cyperaceae. plants.json species `Schoenus ferrugineus = rusvasis viksvinis` is malformed — Wikipedia uses `rausvasis vikšrenis`. ⚠️ plants.json species rows also look bugged; out of scope. | HIGH |
| 9 | Sisyrinchium | `šio augalo vardas` | `vikšruolė` | LT WP family article "Vilkdalginiai" (Iridaceae) lists `Vikšruolė (Sisyrinchium)`. lt-names.json synonyms confirm `Vikšruolė siauralapė`. plants.json species `Sisyrinchium montanum = viksvuolė` (likely typo for `vikšruolė`). | HIGH |
| 10 | Taxus | `šio augalo vardas` | `kukmedis` | LT WP article "Kukmedis": yew genus Taxus. plants.json species: `Taxus baccata = europinis kukmedis`, `Taxus cuspidata = elipsinis kukmedis`. | HIGH |
| 11 | Thymus | `šio augalo vardas` | `čiobrelis` | LT WP article "Čiobrelis": `Čiobrelis (Thymus) – notrelinių (Lamiaceae) šeimos augalų gentis`. plants.json species: `paprastasis čiobrelis`, `vaistinis čiobrelis`, `keturbriaunis čiobrelis`. | HIGH |

---

## Section 2: Plants.json fixes — MEDIUM/LOW confidence (review needed)

Four entries lack a dedicated LT Wikipedia article. They have at most one external source.

| # | Latin | Current (garbage) | Proposed LT | Sources | Confidence | Notes |
|---|---|---|---|---|---|---|
| 12 | Arachis | `anikštinio augalo vardas` | `arachis` | LT WP species article `Valgomasis arachis` uses `Arachis` as genus name in taxobox (no Lithuanianized name). plants.json: `Arachis hypogaea = valgomasis arachis`. VLE has dedicated `arachis` article. | MEDIUM-HIGH | Latin loan-word; lowercase `arachis` is the LT botanical convention. No translation has emerged for the genus name. |
| 13 | Arundo | `nendrės vardas` | `arundas` | LT WP search snippet: `nendrinis arundas (Arundo donax)` used in articles about wetlands and the nėjus flute. ❌ NO LT WP article titled "Arundas". ❌ plants.json `Arundo donax = vaistinė nendrūnė` is WRONG (`Nendrūnė` is the LT name for **Scolochloa**, a different genus per LT WP). Other LT botanists may use `nendrelė` informally. | MEDIUM | Multiple lay sources reference `arundas` for A. donax, but no single authoritative LT WP article confirms. Recommend `arundas` but flag for botanist review. |
| 14 | Chondrilla | `šio augalo vardas` | `arteris` (preferred) or `vabalsalotis` (synonym) | gamtininkas.lt species article: `Arteris, vikšrinis (lot. Chondrilla juncea L.)`. zodynas.lt term entry: `vabalsalotis` = LT for `Chondrilla juncea`, Asteraceae. ❌ NO LT WP article. LT WP Asteraceae genus list shows `Chondrilla` as redlink (no LT translation provided). ⚠️ plants.json has `Chondrilla juncea = viksrinis širetis` — `širetis` does NOT match either external source. | LOW-MEDIUM | Two competing LT names exist. `arteris` is supported by gamtininkas.lt species page; `vabalsalotis` by zodynas.lt. plants.json's `širetis` is unverified — possibly a regional / obscure name. Recommend manual review by a Lithuanian botanist. |
| 15 | Cistus | `šio augalo vardas` | `švitrūnas` | biologija.fandom.com/lt/wiki/Cistus: `Švitrūnas (Cistus)`. Multiple LT commercial sources (yerbamate.lt, ekomarket.lt, ekomarket.lt, 100begliuteno.lt) use `švitrūnas` for `Cistus incanus`. ❌ NO LT WP article. plants.json species: `Cistus crispus = garbanotasis švitrūnas`, `Cistus laurifolius = krymininis švitrūnas` — internally consistent. | MEDIUM-HIGH | Many commercial+wiki-style sources concur. Could promote to HIGH if a single authoritative academic source confirms. |

---

## Section 3: Gaspadorius mis-classifications

Found 16 entries with `latinGenus` that looks non-Latin or mismatched against synonyms. After fetching the underlying gaspadorius.lt source page for the worst offenders, here is the accurate picture:

### 3a. Worst offenders (require correction)

| # | Original `ltName` | Original `latinGenus` | Source page truth | Corrected entry |
|---|---|---|---|---|
| 1 | `Galenis` | `Galenis` (LT word for Abutilon) | Source page literally describes `Abutilon`, `Abutilon megapotamicum`, `Abutilon theophrasti` | `latinGenus: "Abutilon"`, `latin: "Abutilon"` (no species — generic) |
| 2 | `Alamanda` | `Alamanda` (mis-spelled) | Source page: `Alamanda (Allamanda cathartica)` — proper genus is `Allamanda` | `latinGenus: "Allamanda"`, `latin: "Allamanda cathartica"`, `latinSpecies: "cathartica"` |
| 3 | `Nedera granadinė` | `Nedera` (mis-spelled) | Source page subtitle: `Granadinė nedera (Nedera granadensis)` — but the real Latin genus is `Nertera` (note `Nertera granadensis`, the coral bead plant). gaspadorius typo. | `latinGenus: "Nertera"`, `latin: "Nertera granadensis"` (drop the bogus `Asparagus` synonym) |
| 4 | `Perilepta` | `Perilepta` | Source page uses `Perilepta dyeriana`. Modern accepted name = `Strobilanthes dyerianus` (Acanthaceae). `Perilepta` is an obsolete synonym. | `latinGenus: "Strobilanthes"`, `latin: "Strobilanthes dyerianus"`. Drop the spurious synonyms `Phoenix`, `Cupressus macrocarpa`, `Eranthemum pulchellum` — all unrelated extraction garbage. |
| 5 | `Zebrina` | `Zebrina` | Source page mentions `Zebrina pendula`, `Z. purpusii`, `Z. flocculosa`. ⚠️ `Zebrina` was sunk into `Tradescantia` by modern taxonomy (`Tradescantia zebrina`). Source page itself acknowledges close relation to Tradescantia. Spurious synonym `Eranthemum pulchellum` is extraction noise. | Suggested: `latinGenus: "Tradescantia"`, `latin: "Tradescantia zebrina"` with `latinSynonyms: ["Zebrina pendula"]`. Keep gaspadorius original `Zebrina` only if preserving source fidelity is required. |
| 6 | `Brokoliai` | `Pseudomonas maculicola` (a BACTERIUM!) | Article describes broccoli the vegetable. `Pseudomonas maculicola` is a broccoli pathogen mentioned in the article body — scraper grabbed the wrong Latin string. Real broccoli = `Brassica oleracea var. italica`. | `latinGenus: "Brassica"`, `latin: "Brassica oleracea"`, `latinSpecies: "oleracea"` (variety `italica` in a separate field if schema supports) |
| 7 | `Patisonai` | `Patisonai` (LT word, no Latin) | Source page has NO Latin name. `Patisonai` = scallop squash = `Cucurbita pepo var. patissoniana` (well-established botanical knowledge). | `latinGenus: "Cucurbita"`, `latin: "Cucurbita pepo"`, `latinSpecies: "pepo"`. Variety designation `patissoniana` if supported. |
| 8 | `Reinwardtia indica` | `Reinwardtia` (genus name OK) but `latinSynonyms: ["Dionaea muscipula", "Browallia"]` | Source page lists only `Reinwardtia indica`. Synonyms are extraction garbage. | Keep `latinGenus: "Reinwardtia"`. **Drop the bogus latinSynonyms entirely.** |
| 9 | `Tetrastigma` | `Tetrastigma` (OK) but `latinSynonyms: ["Buddleja indica"]` | Source page mentions only `Tetrastigma voinierianum`. `Buddleja indica` is unrelated. | Keep `latinGenus: "Tetrastigma"`. **Drop bogus synonym.** |

### 3b. False positives (initially flagged, but actually correct)

The heuristic also flagged these — they are valid Latin and need no change:
- `Aglaonema`, `Ananas`, `Aspidistra`, `Cycas`, `Maranta`, `Monstera`, `Pachira` — all proper Latin genera that happen to end in vowels/`a`. Verified against well-known horticultural data.

---

## Section 4: Recommendations

### 4a. Safe for auto-apply (11 entries, plants.json)
Apply the LT genus names from Section 1 directly. All have multi-source confirmation. Suggested patch shape:

```json
{ "latin": "Acacia",       "lithuanian": "akacija" },
{ "latin": "Blechnum",     "lithuanian": "unksmenė" },
{ "latin": "Myrica",       "lithuanian": "sotvaras" },
{ "latin": "Myrrhis",      "lithuanian": "garduoklė" },
{ "latin": "Myrtus",       "lithuanian": "mirta" },
{ "latin": "Pistacia",     "lithuanian": "pistacija" },
{ "latin": "Potamogeton",  "lithuanian": "plūdė" },
{ "latin": "Schoenus",     "lithuanian": "vikšrenis" },
{ "latin": "Sisyrinchium", "lithuanian": "vikšruolė" },
{ "latin": "Taxus",        "lithuanian": "kukmedis" },
{ "latin": "Thymus",       "lithuanian": "čiobrelis" }
```

### 4b. Apply with disclaimer / pending review (3 entries)
- **Arachis → arachis** — Latin loan; standard LT botanical convention. Low risk.
- **Cistus → švitrūnas** — Strong commercial+fandom-wiki consensus, no academic source confirmed. Likely safe.
- **Arundo → arundas** — Weakest evidence (search-snippet level only). Recommend a botanist confirm before applying. Alternative: leave as `arundas` and append `(unverified)` flag for now.

### 4c. Needs manual review (1 entry)
- **Chondrilla** — Two competing LT names (`arteris` vs `vabalsalotis`); plants.json has a third (`širetis`) that no external source corroborates. A native Lithuanian botanist should pick the canonical name. Recommend NOT auto-applying.

### 4d. Gaspadorius corrections (8 entries — Section 3a)
- Entries #1, #2, #3, #6, #7 are clear-cut Latin typos / scraping bugs — safe to correct.
- Entry #4 (`Perilepta` → `Strobilanthes`) is a real taxonomic update — apply with `latinSynonyms: ["Perilepta dyeriana"]` for backward compat.
- Entry #5 (`Zebrina` → `Tradescantia zebrina`) — depends on whether the database tracks legacy names; consider keeping Zebrina as a legacy alias.
- Entries #8 and #9 just need the bogus `latinSynonyms` arrays scrubbed.

### 4e. Downstream issues observed (NOT in scope, but worth a follow-up)
While verifying genus rows, I noticed several **species** rows in plants.json that don't match LT Wikipedia:
- `Blechnum spicant = varpotoji nukimėlė` → Wikipedia: `varpotoji unksmenė`
- `Myrica gale = pajūrinis šilvarus` → Wikipedia: `pajūrinis sotvaras`
- `Myrrhis odorata = kvapioji garduvėlė` → Wikipedia: `kvapnioji garduoklė`
- `Schoenus ferrugineus = rusvasis viksvinis` → Wikipedia: `rausvasis vikšrenis` + species name `rusvasis` vs `rausvasis` typo
- `Schoenus nigricans = juosvasis viksvinis` → Wikipedia: `juodasis/juosvasis vikšrenis`
- `Sisyrinchium montanum = viksvuolė` → likely typo for `vikšruolė`
- `Chondrilla juncea = viksrinis širetis` → external sources: `vikšrinis arteris` / `vabalsalotis`
- `Arundo donax = vaistinė nendrūnė` → `nendrūnė` is the LT for **Scolochloa** (different genus); should likely be `nendrinis arundas`

Recommend a separate pass for species-level audit when genus-level cleanup is done.

---

## Source reference list

- Lithuanian Wikipedia (lt.wikipedia.org): articles for Akacija, Unksmenė, Sotvaras (via Pajūrinis sotvaras), Garduoklė, Pistacija, Vikšrenis, Kukmedis, Čiobrelis, Plūdė (via Potamogeton redirect), Mirtiniai (family), Vilkdalginiai (family), Migliniai (family)
- Wikidata: Q161114 (Arundo donax) — sitelinks checked, no LT label located via WebFetch
- gamtininkas.lt — Chondrilla juncea species page
- zodynas.lt / zodis.eu — `vabalsalotis` term entries
- biologija.fandom.com/lt/wiki/Cistus — wiki-style fandom source
- gaspadorius.lt — direct source page fetches for all 9 suspicious entries
- plants.json internal cross-reference — species rows used to confirm genus translations
- lt-names.json synonyms field — cross-referenced for Myrtus and Sisyrinchium

End of report.
