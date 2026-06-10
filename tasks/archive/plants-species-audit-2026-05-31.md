# plants.json species quality audit — 2026-05-31

Script: `scripts/audit-plants-species-quality.mjs` (READ-ONLY)
Source: `data/plants.json` (5786 rows)
Reference: `data/lt-names.json` (canonical genus LT names, 1673 genera)

## Method

For each species row (latin = 2+ words):
1. Extract genus latin (first word).
2. Look up canonical LT name (`ltName`) in `lt-names.json[ltNames][Genus]`.
3. Compare last word of `lithuanian` field to **canonical only** (diacritic-insensitive).
   - **Synonyms (`ltSynonyms`) are intentionally NOT accepted** — they were inferred from the same species rows we are auditing (`plants-species-inferred` source), so trusting them would mask the bugs we want to surface.
4. If no match — compute Levenshtein distance to canonical:
   - 0 (after normalize) → CONSISTENT
   - ≤ 2 AND actual ≥ 4 chars → TYPO_SUSPECTED
   - else → MISMATCH
5. If genus has no LT name → NO_GENUS_LT.

## Totals

| Tier | Count | % of species |
|---|---:|---:|
| CONSISTENT     | 4034    | 90.9% |
| MISMATCH       | 331      | 7.5% |
| TYPO_SUSPECTED | 29 | 0.7% |
| NO_GENUS_LT    | 44     | 1.0% |

Additional flags (independent, may overlap with tiers):

| Flag | Count |
|---|---:|
| EMPTY_LT       | 0 |
| LT_TOO_SHORT   | 1 |
| LT_TOO_LONG    | 0 |
| CYRILLIC       | 0 |
| DUPLICATE_WORD | 0 |

Genus rows (excluded from tier classification): 1348

## Top wrong-last-word patterns

Most frequent "wrong" genus-words found in MISMATCH samples — sorted by distinct genera that used them incorrectly:

| Wrong last word | MISMATCH count | Distinct genera | Sample latins |
|---|---:|---:|---|
| takažolė | 57 | 12 | Polygonum aviculare, Polygonum calcatum, Polygonum dumetorum |
| vulgaris | 3 | 3 | Barbarea arcuata, Filipendula hexapetala, Silene cucubalus |
| nigra | 3 | 2 | Ballota borealis, Ballota foetida, Sinapis nigra |
| maritima | 2 | 2 | Alyssum maritimum, Beta maritima |
| pubescens | 2 | 2 | Avena pubescens, Betula alba |
| bitkrėslė | 2 | 2 | Chrysanthemum vulgare, Tanacetum vulgare |
| arvensis | 2 | 2 | Satureja acinos, Scabiosa arvensis |
| kalkias | 8 | 1 | Salix phylicifolia, Salix polaris, Salix purpurea |
| agrastas | 7 | 1 | Ribes burejense, Ribes divaricatum, Ribes hirtellum |
| tp | 6 | 1 | Orthotrichum affine, Orthotrichum anomalum, Orthotrichum diaphanum |
| avietė | 6 | 1 | Rubus idaeus, Rubus illecebrosus, Rubus occidentalis |
| maurabragis | 5 | 1 | Chara polyacantha, Chara rudis, Chara scoparia |
| rožė | 5 | 1 | Rosa chinensis, Rosa damascena, Rosa gallica |
| laibšiūnis | 4 | 1 | Alyssum alyssoides, Alyssum argenteum, Alyssum gmelinii |
| tūbė | 4 | 1 | Verbascum lychnitis, Verbascum phlomoides, Verbascum phoeniceum |
| skaistažolė | 3 | 1 | Chrysanthemum coronarium, Chrysanthemum corymbosum, Chrysanthemum segetum |
| juodmedis | 3 | 1 | Diospyros ebenaster, Diospyros ebenum, Diospyros melanoxylon |
| persimonas | 3 | 1 | Diospyros kaki, Diospyros lotus, Diospyros virginiana |
| angustirete | 3 | 1 | Eurhynchium angustirete, Eurhynchium angustifolium, Eurhynchium swartzii |
| skaisteinis | 3 | 1 | Tanacetum cinerariifolium, Tanacetum coccineum, Tanacetum corymbosum |

## Samples per tier (max 30 each)

### CONSISTENT (likely OK)

- `Abies alba` → europinis kėnis (canonical: Kėnis)
- `Abies arizonica` → arizoninis kėnis (canonical: Kėnis)
- `Abies balsamea` → balzaminis kėnis (canonical: Kėnis)
- `Abies cephalonica` → graikinis kėnis (canonical: Kėnis)
- `Abies concolor` → pilkasis kėnis (canonical: Kėnis)
- `Abies grandis` → didysis kėnis (canonical: Kėnis)
- `Abies holophylla` → smailiaspyglis kėnis (canonical: Kėnis)
- `Abies homolepis` → lygiažvynis kėnis (canonical: Kėnis)
- `Abies lasiocarpa` → vilčo kėnis (canonical: Kėnis)
- `Abies nordmanniana` → kaukazinis kėnis (canonical: Kėnis)
- `Abies pinsapo` → ispaninis kėnis (canonical: Kėnis)
- `Abies sibirica` → sibirinis kėnis (canonical: Kėnis)
- `Abies veitchii` → vičo kėnis (canonical: Kėnis)
- `Abietinella abietina` → dirvoninė keniūtė (canonical: Keniūtė)
- `Abrus precatorius` → vaistinis abras (canonical: Abras)
- `Acacia arabica` → arabinė akacija (canonical: Akacija)
- `Acacia catechu` → tanidinė akacija (canonical: Akacija)
- `Acacia dealbata` → sidabrinė akacija (canonical: Akacija)
- `Acacia melanoxylon` → australinė akacija (canonical: Akacija)
- `Acacia nilotica` → dervingoji akacija (canonical: Akacija)
- `Acacia retinodes` → dervingoji akacija (canonical: Akacija)
- `Acacia senegal` → arabinė akacija (canonical: Akacija)
- `Acaena argentea` → sidabrinis dyglius (canonical: Dyglius)
- `Acaena glaucophylla` → magellaninis dyglius (canonical: Dyglius)
- `Acaena magellanica` → melsvalapis dyglius (canonical: Dyglius)
- `Acaena microphylla` → smulkialapis dyglius (canonical: Dyglius)
- `Acanthocereus tetragonus` → akantolimoninis akantocereusas (canonical: Akantocereusas)
- `Acanthopanax sessiliflorus` → bekotis dyglys (canonical: Dyglys)
- `Acanthophyllum acerosum` → kolonchinis dyglys (canonical: Dyglys)
- `Acanthus hungaricus` → vengrinis dyglis (canonical: Dyglis)

### MISMATCH (suspect — wrong genus word)

- `Alcea ocutargula` → Alcea acutiloba — actual last "acutiloba" vs expected "Piliarožė"
- `Allium ascalonicum` → askalonas — actual last "askalonas" vs expected "Česnakas"
- `Allium cepa` → valgomasis svogūnas — actual last "svogūnas" vs expected "Česnakas"
- `Allium porrum` → daržinis poras — actual last "poras" vs expected "Česnakas"
- `Allium proliferum` → daugiasluoksnis svogūnas — actual last "svogūnas" vs expected "Česnakas"
- `Alnus glutinosa` → juodalksnis — actual last "juodalksnis" vs expected "Alksnis"
- `Alnus incana` → baltalksnis — actual last "baltalksnis" vs expected "Alksnis"
- `Alpinia galanga` → didysis galangas — actual last "galangas" vs expected "Alpinija"
- `Alpinia officinarum` → vaistinis alpinijos kalgan — actual last "kalgan" vs expected "Alpinija"
- `Alyssum alyssoides` → taurelinis laibšiūnis — actual last "laibšiūnis" vs expected "Laibenis"
- `Alyssum argenteum` → sidabrinis laibšiūnis — actual last "laibšiūnis" vs expected "Laibenis"
- `Alyssum gmelinii` → smiltyninis laibšiūnis — actual last "laibšiūnis" vs expected "Laibenis"
- `Alyssum maritimum` → Lobularia maritima — actual last "maritima" vs expected "Laibenis"
- `Alyssum saxatile` → Aurinia saxatilis — actual last "saxatilis" vs expected "Laibenis"
- `Alyssum tortuosum` → vingrusis laibšiūnis — actual last "laibšiūnis" vs expected "Laibenis"
- `Angelica archangelica` → vaistinė šveitragėvė — actual last "šveitragėvė" vs expected "Skudutis"
- `Angelica fragrans` → kvapnioji angerkasa — actual last "angerkasa" vs expected "Skudutis"
- `Angelica sesquipedale` → didysis angrėkas — actual last "angrėkas" vs expected "Skudutis"
- `Anomodon attenuatus` → smulkiojo anomodono — actual last "anomodono" vs expected "Dantis"
- `Anomodon longifolius` → ilgalapis anomodonas — actual last "anomodonas" vs expected "Dantis"
- `Anomodon viticulosus` → krūmiškas anomodonas — actual last "anomodonas" vs expected "Dantis"
- `Anthoceros punctatus` → spuoguotoji žvainė — actual last "žvainė" vs expected "Žiedas"
- `Arctostaphylos alpinus` → Arctous alpina — actual last "alpina" vs expected "Meška"
- `Arctostaphylos uva-ursi` → miltinė meškauogė — actual last "meškauogė" vs expected "Meška"
- `Arenaria graminifolia` → Arenaria procera — actual last "procera" vs expected "Smiltė"
- `Artemisia dracunculus` → peletrūnas — actual last "peletrūnas" vs expected "Kietis"
- `Artocarpus altilis` → paprastasis duonmedis — actual last "duonmedis" vs expected "Duona"
- `Artocarpus communis` → Artocarpus altilis — actual last "altilis" vs expected "Duona"
- `Artocarpus heterophyllus` → indiškasis duonmedis — actual last "duonmedis" vs expected "Duona"
- `Artocarpus integer` → Artocarpus heterophyllus — actual last "heterophyllus" vs expected "Duona"

### TYPO_SUSPECTED (Levenshtein ≤ 2)

- `Alpinia zerumbet` → raibasis alpinijos — "alpinijos" ≈ "Alpinija" (dist 2)
- `Anagallis foemina` → melsvasis pelėjūdis — "pelėjūdis" ≈ "Pelėjūdė" (dist 2)
- `Annona cherimola` → perūnė anonė — "anonė" ≈ "Anona" (dist 1)
- `Bidens cernua` → nukabusis lakstinys — "lakstinys" ≈ "Laksinys" (dist 1)
- `Chrysanthemum balsamita` → didysis chrizantemas — "chrizantemas" ≈ "Chrizantema" (dist 1)
- `Chrysanthemum carinatum` → įvairiaspalvis chrizantemas — "chrizantemas" ≈ "Chrizantema" (dist 1)
- `Chrysanthemum cinerariifolium` → pelenėtasis chrizantemas — "chrizantemas" ≈ "Chrizantema" (dist 1)
- `Desmodium canadense` → kanadinė jakšlinė — "jakšlinė" ≈ "Jaksloje" (dist 2)
- `Epidendrum radicans` → epidendrum — "epidendrum" ≈ "Epidendrai" (dist 2)
- `Galium aparine` → kibieji lipikai — "lipikai" ≈ "Lipikas" (dist 1)
- `Lyngbya aestuarii` → liūnbijos liūnbija — "liūnbija" ≈ "Lingbija" (dist 2)
- `Mentha pulegium` → takkščioji mėtė — "mėtė" ≈ "Mėta" (dist 1)
- `Myrrhis odorata` → kvapioji garduvėlė — "garduvėlė" ≈ "Garduoklė" (dist 2)
- `Orchis militaris` → almuotoji gegrair — "gegrair" ≈ "Gegrais" (dist 1)
- `Orchis morio` → maoji gegrair — "gegrair" ≈ "Gegrais" (dist 1)
- `Orchis palustris` → pelkin gegrair — "gegrair" ≈ "Gegrais" (dist 1)
- `Orchis traunsteineri` → Traunteinerio gegrair — "gegrair" ≈ "Gegrais" (dist 1)
- `Orchis ustulata` → smilkusioji gegrair — "gegrair" ≈ "Gegrais" (dist 1)
- `Oscillatoria acuminata` → smailioji vyturl — "vyturl" ≈ "Vyburl" (dist 1)
- `Oscillatoria agardhii` → Agardo vyturl — "vyturl" ≈ "Vyburl" (dist 1)
- `Pennisetum alopecuroides` → plauktotoji soruol — "soruol" ≈ "Soruolė" (dist 1)
- `Pennisetum purpureum` → dramblin soruol — "soruol" ≈ "Soruolė" (dist 1)
- `Schoenus ferrugineus` → rusvasis viksvinis — "viksvinis" ≈ "Vikšrenis" (dist 2)
- `Schoenus nigricans` → juosvasis viksvinis — "viksvinis" ≈ "Vikšrenis" (dist 2)
- `Selenicereus grandiflorus` → didžiažiedis naktinis — "naktinis" ≈ "Naktenis" (dist 1)
- `Sempervivum tectorum` → stogiine šilropė — "šilropė" ≈ "Šilropės" (dist 1)
- `Serratula tinctoria` → dažinė pjūklė — "pjūklė" ≈ "Pjūklas" (dist 2)
- `Sisyrinchium montanum` → viksvuolė — "viksvuolė" ≈ "Vikšruolė" (dist 1)
- `Tomentypnum nitens` → žvilgančioji veltinė — "veltinė" ≈ "Veltinis" (dist 2)

### NO_GENUS_LT (cannot validate)

- `Abutilon avicennae` → teofrastinis abutilas
- `Abutilon hybridum` → hibridinis galėnis
- `Abutilon theophrasti` → pūslėtinis galėnis
- `Aethusa cynapium` → šunpetrė
- `Alhagi persarum` → persinė kupranugarine zoloka
- `Alhagi pseudalhagi` → kupranugarine dyglyžolė
- `Anisantha sterilis` → nevaisingoji anišanta
- `Anisantha tectorum` → stoginis dirsuolis
- `Anisantha pfitzeri` → pficerio anišanta
- `Anthriscus cerefolium` → valgomoji daržovė
- `Anthriscus sylvestris` → miškinis builis
- `Areca catechu` → katechinė
- `Buphthalmum salicifolium` → gluosnialapis
- `Buphthalmum speciosum` → puošnusis
- `Cardaminopsis arenosa` → smiltyninis ankštinis
- `Eraphila verna` → L.
- `Erophila verna` → pavasarinė pavasaris
- `Gymnodinium Penard` → gimnodinis
- `Gymnadenia conopsea` → pievinis plonėtis
- `Gymnadenia odoratissima` → kvapioji plūretė
- `Gymnocarpium dryopteris` → trakeližmedis
- `Gymnocarpium robertianum` → papartlitis
- `Gymnodinium paradoxum` → netikras gimnodinis
- `Libanotis montana` → kalninis sklerinis
- `Peucedanum americanum` → amerikinė peršėja
- `Peucedanum persica` → persikinė peršėja
- `Peucedanum vulgaris` → paprastasis persikas
- `Peucedanum cervaria` → standžialūpis sausvė
- `Peucedanum officinale` → vaistinis sausvė
- `Peucedanum oreoselinum` → šilinis sausvė

### EMPTY_LT

_(tuščia)_

### LT_TOO_SHORT

- `Eraphila verna` → L.

### LT_TOO_LONG

_(tuščia)_

### CYRILLIC

_(tuščia)_

### DUPLICATE_WORD

_(tuščia)_

## Recommended action thresholds

Phase 2 (AI verification) priority order:

1. **MISMATCH (331)** — highest signal of error. Wrong genus word, likely wrong taxonomy mapping or scraping bug. Verify first.
2. **TYPO_SUSPECTED (29)** — high-confidence typos. Cheap to verify (close edit distance), fix in bulk.
3. **DUPLICATE_WORD (0)** — likely cleanLtName regex residue. Mechanical fix candidate (dedupe).
4. **CYRILLIC (0)** — data import bug. Mechanical filter or re-scrape.
5. **NO_GENUS_LT (44)** — defer. Need either canonical LT name added to dict OR per-row AI verification. Lower priority unless we want full coverage.

## Validation cases (from brief)

| Latin | Expected | Got | Notes |
|---|---|---|---|
| Monstera deliciosa | CONSISTENT* | CONSISTENT | Last word matches canonical (Monstera). Adjective `saustabėjoji` vs correct `nuostabioji` is a Phase-3 blind spot (first-word error). |
| Myrica gale | MISMATCH | MISMATCH | actual "šilvarus" vs canonical "Sotvaras". |
| Aquilegia vulgaris | CONSISTENT | CONSISTENT | "sinavadas" matches canonical. |
| Arundo donax | (uncertain) | CONSISTENT | Canonical IS "Nendrūnė" in dict — but that canonical may itself be wrong (came from `plants-species-inferred`). Blind spot of any audit that trusts its own reference. |
| Blechnum spicant | MISMATCH | MISMATCH | actual "nukimėlė" vs canonical "Unksmenė". |
| Schoenus ferrugineus | MISMATCH | TYPO_SUSPECTED (d=2) | "viksvinis" vs "Vikšrenis" is Levenshtein-2; classifier put it in typos. Both tiers are Phase-2 targets, so this is acceptable. |

Caveats:
- CONSISTENT only validates the **last word** (genus noun). Adjective (first word) errors like `Monstera deliciosa = saustabėjoji monstera` (should be `nuostabioji`) are NOT caught.
- The audit trusts `lt-names.json` canonical. If canonical itself is wrong (e.g. `Arundo → Nendrūnė` inferred from buggy species rows), this pass cannot detect it. Cross-check the top `plants-species-inferred` genera separately.
- Levenshtein threshold of 2 is conservative; may miss 3+ edit typos but avoids short-word collisions.
- Plural/declension variants (`Kėnis` vs `Kėniai`) that don't match canonical will appear as MISMATCH. Phase 2 verification clears them cheaply.
