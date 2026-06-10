# Phase 2c — Blind spots batch 2 (entries 210-end)

Method: Direct `WebFetch` of `https://lt.wikipedia.org/wiki/{Latin}` for each species, extract page H1 (model-assisted). 404 = no article, skipped per spec. Comparison is case- and diacritic-insensitive (NFC, lowercased). Only flagged `wikiDisagrees` when Wikipedia EXPLICITLY uses a different LT name as the article title.

| Verdict | Count |
|---|---|
| wikiDisagrees (potential bugs) | 22 |
| confirmedOk | 14 |
| noArticle | 173 |
| **Total checked** | **209** |
| of which had a Wikipedia article | 36 |

## All wiki-disagrees (22)

| Latin | currentLt (plants.json) | Wikipedia LT title | source |
|---|---|---|---|
| `Impatiens walleriana` | Vilerio sprigė | **Valero sprigė** | indoor-whitelist |
| `Monstera deliciosa` | saustabėjoji monstera | **Nuostabioji monstera** | indoor-whitelist |
| `Musa textilis` | pluošinis banalas | **Pluoštinis bananas** | indoor-whitelist |
| `Opuntia ficus-indica` | figin opuntija | **Figavaisė opuncija** | indoor-whitelist |
| `Opuntia microdasys` | smulkiadygl opuntija | **Trumpašerė opuncija** | indoor-whitelist |
| `Oxalis acetosella` | paprastasis kikiakopstis | **Paprastasis kiškiakopūstis** | indoor-whitelist |
| `Oxalis stricta` | statusis kikiakopstis | **Statusis kiškiakopūstis** | indoor-whitelist |
| `Oxalis tuberosa` | gumbinis kikiakopstis | **Gumbinis kiškiakopūstis** | indoor-whitelist |
| `Pereskia aculeata` | adatuotoji pereskija | **Dygliuotoji pereskija** | indoor-whitelist |
| `Polygala amarella` | karčioji putoklė | **Karčioji putokšlė** | indoor-whitelist |
| `Polygala comosa` | skiauterėtoji putoklė | **Skiauterėtoji putokšlė** | indoor-whitelist |
| `Sansevieria cylindrica` | cilindrinė sansevjera | **Cilindrinė karduotė** | indoor-whitelist |
| `Scutellaria galericulata` | pelkinė kalpoka | **Pelkinė kalpokė** | indoor-whitelist |
| `Scutellaria hastifolia` | jietėlipė kalpoka | **Iečialapė kalpokė** | indoor-whitelist |
| `Senecio paludosus` | aukštoji žilė | **Pelkinė žilė** | indoor-whitelist |
| `Solanum dulcamara` | karklavijinė kiaulienažolė | **Karklavijas** | indoor-whitelist |
| `Solanum melongena` | baklažaninė kiaulienažolė | **Baklažanas** | indoor-whitelist |
| `Solanum nigrum` | juodoji kiaulienažolė | **Juodoji kiauliauogė** | indoor-whitelist |
| `Solanum pseudocapsicum` | vyšninė kiaulienažolė | **Koralinė kiauliauogė** | indoor-whitelist |
| `Strelitzia reginae` | prašmatnioji strelicija | **Puošnioji strelicija** | indoor-whitelist |
| `Tillandsia usneoides` | kelnenio tilandsija | **Kedeninė tilandsija** | indoor-whitelist |
| `Zantedeschia aethiopica` | etiopinė kilija | **Abisininė kalija** | indoor-whitelist |

### Notes on the disagrees

**Genus-level naming variants (whole-genus rename in plants.json):**

- `Oxalis` (3 entries): plants.json uses `kikiakopstis` -> Wikipedia uses `kiškiakopūstis`. Plants.json form is malformed (missing š, ū). Affects: `acetosella`, `stricta`, `tuberosa`.
- `Polygala` (2 entries): plants.json `putoklė` -> Wikipedia `putokšlė`. Missing `š`. Affects: `amarella`, `comosa`.
- `Solanum` (4 entries): plants.json `kiaulienažolė` -> Wikipedia `kiauliauogė` (different genus name entirely). Affects: `nigrum`, `pseudocapsicum`. For `dulcamara` and `melongena` Wikipedia uses single-word titles (`Karklavijas`, `Baklažanas`).
- `Scutellaria` (2 entries): plants.json `kalpoka` -> Wikipedia `kalpokė`. Affects: `galericulata`, `hastifolia`.
- `Sansevieria cylindrica`: plants.json `sansevjera` -> Wikipedia `karduotė` (different genus name).
- `Zantedeschia aethiopica`: plants.json `kilija` -> Wikipedia `kalija`. Likely typo (`i` for `a`).

**Likely clean wins (typos / variant spellings in epithet):**

- `Musa textilis`: `pluošinis banalas` -> `Pluoštinis bananas` (both adjective `pluošinis`/`pluoštinis` AND genus `banalas`/`bananas` — `banalas` looks like a typo across all 4 `Musa` entries).
- `Tillandsia usneoides`: `kelnenio` -> `Kedeninė` (malformed input).
- `Opuntia ficus-indica`: `figin opuntija` -> `Figavaisė opuncija` (truncated input + genus `opuntija`/`opuncija`).
- `Opuntia microdasys`: `smulkiadygl opuntija` -> `Trumpašerė opuncija` (different epithet + genus variant).

**Likely true disagreements (different epithet — needs human review):**

- `Impatiens walleriana`: `Vilerio` -> `Valero` (transliteration of "Waller").
- `Monstera deliciosa`: `saustabėjoji` -> `Nuostabioji`.
- `Pereskia aculeata`: `adatuotoji` -> `Dygliuotoji`.
- `Senecio paludosus`: `aukštoji žilė` -> `Pelkinė žilė` (different epithet entirely).
- `Strelitzia reginae`: `prašmatnioji` -> `Puošnioji`.

## confirmedOk (full list — 14)

| Latin | LT name |
|---|---|
| `Impatiens noli-tangere` | paprastoji sprigė |
| `Lotus corniculatus` | paprastasis garždenis |
| `Lotus tenuis` | siauralapis garždenis |
| `Lotus uliginosus` | pelkinis garždenis |
| `Mimosa pudica` | jautrioji mimoza |
| `Olea europaea` | europinis alyvmedis |
| `Phoenix dactylifera` | datulinis finikas |
| `Piper betle` | betelinis pipiras |
| `Piper nigrum` | juodasis pipiras |
| `Sedum acre` | aitrusis šilokas |
| `Senecio vernalis` | pavasarinė žilė |
| `Vanilla planifolia` | kvapioji vanilė |
| `Yucca filamentosa` | pluoštinė juka |
| `Zingiber officinale` | tikrasis imbieras |

## noArticle

173 entries (~83%) have no Wikipedia LT page at `https://lt.wikipedia.org/wiki/<Latin>`. Triage was skipped for these per spec (no follow-up search).

See `phase2c-blindspots-batch2.json` for the full list.
