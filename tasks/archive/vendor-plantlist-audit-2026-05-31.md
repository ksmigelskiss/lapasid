# Vendor plantlist audit — geliustebuklai.lt
**Date:** 2026-05-31
**Source:** data/Plant list/ (4 JSON files iš vendor scrape)
**Tool:** scripts/audit-vendor-plantlist.mjs (READ-ONLY)
**Reference DBs:** lt-names.json (post-v2 rebuild), species-lt-names.json, pre-db.json

---

## TL;DR

| | Count | % |
|---|---|---|
| **Total entries** | 1029 | 100% |
| genus-known | 764 | 74.2% |
| db-recognized | 152 | 14.8% |
| unknown | 113 | 11.0% |
| Duplicates (across files) | 0 | 0.0% |

---

## Per file breakdown

| File | Total | DB recognized | Genus-known | Pre-DB only | Unknown | Suspect |
|---|---|---|---|---|---|---|
| kaktusai.json | 69 | 8 | 45 | 0 | 16 | 0 |
| lapiniai_augalai.json | 674 | 107 | 518 | 0 | 49 | 0 |
| sukulentai.json | 261 | 36 | 177 | 0 | 48 | 0 |
| tilandsijos.json | 25 | 1 | 24 | 0 | 0 | 0 |

---

## Vendor pattern flags

| Flag | Count |
|---|---|
| cap-second-token | 377 |
| vendor-marketing | 54 |
| dimensions | 10 |
| pot-info | 1 |

---

## Samples per category

### genus-known (showing up to 15)

- `Euphorbia lactea Cristata` → "Karpažolė"
- `Euphorbia obesa` → "Karpažolė"
- `Euphorbia ferox` → "Karpažolė"
- `Echinocactus grusonii` → "Ežiakaktusis"
- `Echinopsis oxygona` → "Echinopsis"
- `Gymnocalycium ragonesei` → "Nuogulis"
- `Pilosocereus azureus` → "Plaukuotis"
- `Mammillaria spinosissima` → "Mamiliarija"
- `Mammillaria painteri` → "Mamiliarija"
- `Gymnocalycium mihanovichii` → "Nuogulis"
- `Gymnocalycium baldianum` → "Nuogulis"
- `Epiphyllum anguliger` → "Lapenis"
- `Rebutia perplexa` → "Rebutija"
- `Mammillaria gracilis` → "Mamiliarija"
- `Mammillaria elongata Cristata` → "Mamiliarija"

### unknown (showing up to 15)

- `Cactus Opuntia, 120 cm` [dimensions, cap-second-token]
- `Polaskia chichipe`
- `Mammilaria plumosa`
- `Chamaelobivia paolina`
- `Echinofossulocactus multicostatus`
- `Sulcorebutia rauschii`
- `Chamaecereus silvestrii`
- `Chamaecereus luisramirezii`
- `Lepismium cruciforme Red Tip`
- `Aporocactus flagelliformis`
- `Aporocactus malisonii`
- `Sulcorebutia arenacea`
- `Marginatocereus marginatus f. cristata`
- `Marginatocereus marginatus`
- `Setiechinopsis mirabilis`

### db-recognized (showing up to 15)

- `Opuntia microdasys var. Rufida` → "Smulkiadygl opuntija"
- `Opuntia microdasys var. pallida f. undulata` → "Smulkiadygl opuntija"
- `Selenicereus grandiflorus` → "Didžiažiedis naktinis"
- `Opuntia microdasys Albata` → "Smulkiadygl opuntija"
- `Opuntia microdasys var. Pallida` → "Smulkiadygl opuntija"
- `Opuntia microdasys Albispina` → "Smulkiadygl opuntija"
- `Opuntia microdasys Velour` → "Smulkiadygl opuntija"
- `Cereus peruvianus Florida` → "Peruvinis cereus"
- `Monstera deliciosa Bulbasaur` → "Saustabėjoji monstera"
- `Laurus nobilis ant koto` → "Kilnusis laurmedis"
- `Yucca elephantipes, 100 cm` [dimensions] → "Drambliakojė juka"
- `Monstera deliciosa, 100 cm` [dimensions] → "Saustabėjoji monstera"
- `Ficus elastica Robusta, 100 cm` [dimensions] → "Stambialapis fikusas"
- `Ficus elastica Tineke, 100 cm` [dimensions] → "Stambialapis fikusas"
- `Strelitzia nicolai, 150 cm.` [dimensions] → "Nikolajaus strelicija"

---

## Top 30 most common genera

| Genus | Count | DB status |
|---|---|---|
| Philodendron | 74 | ✓ Filodendras |
| Aglaonema | 68 | ✓ Aglaonema |
| Sansevieria | 65 | ✓ Sansevjera |
| Hoya | 61 | ✓ Vaškūnė |
| Peperomia | 36 | ✓ Peperomija |
| Echeveria | 35 | ✓ Echeverija |
| Alocasia | 32 | ✓ Alokasija |
| Syngonium | 29 | ✓ Singonis |
| Calathea | 28 | ✓ Kalatėją |
| Ficus | 26 | ✓ Fikusas |
| Tillandsia | 25 | ✓ Tilandsija |
| Epipremnum | 23 | ✓ Skindapas |
| Crassula | 21 | ✓ Storžuolė |
| Monstera | 19 | ✓ Monstera |
| Tradescantia | 19 | ✓ Tradeskantė |
| Dracaena | 17 | ✓ Dracena |
| Euphorbia | 16 | ✓ Karpažolė |
| Hedera | 15 | ✓ Gebenė |
| Aloe | 15 | ✓ Alavijas |
| Caladium | 14 | ✓ Kaldis |
| Sansewieria | 13 | ✗ not in DB |
| Opuntia | 12 | ✓ Opuntija |
| Senecio | 11 | ✓ Žilė |
| Fittonia | 10 | ✓ Fitonija |
| Sedum | 10 | ✓ Šilokas |
| Mammillaria | 9 | ✓ Mamiliarija |
| Scindapsus | 9 | ✓ Sindapsas |
| Begonia | 9 | ✓ Begonija |
| Pilea | 8 | ✓ Pilea |
| Spathiphyllum | 8 | ✓ Plokščialapė |

---

## Duplicates (first 20 samples)

_none_

---

## Recommendations

### Tinkami for batch save (no AI needed)
- **DB recognized (152 entries)**: instant catalog entries with full LT names already known.
- **Genus-known (764 entries)**: species-qualified fallback via resolveLt construct'ina „[genus] [epithet]" (e.g. „Sansevjera zeylanica"). Saugu.

### Reikalauja AI verification
- **Pre-DB only (0 entries)**: genus in pre-DB but no LT name yet. Could AI-verify and add to lt-names-overrides.json.
- **Unknown (113 entries)**: full AI lookup needed (~30s + cost per entry).

### Skip ar manual review
- **Suspect (0 entries)**: dimensions in name, non-Latin first token, etc. Don't auto-save.
- **Vendor-marketing flags**: e.g. „El Dorado", „Nite Lite" — even if genus matches, these are vendor-specific cultivars that need verification (often hallucination risk).

### Žinome iš prior fix'ų
- „Sansevieria aubrytiana Nite Lite" tipo vardai → mūsų AI dabar žino, kad „aubrytiana" yra fake species (post-2026-05-30 prompt fix). Bus suklasifikuotas teisingai į trifasciata.
- „Cap second token" flag (e.g. „Calathea Velvet Glory") — daugumai šių reikia AI'aus, kuris pasakys ar yra accepted name.

---

## Suggested next steps

1. **Phase A (now)**: review this audit. Identify clear no-go entries.
2. **Phase B (later)**: run AI batch identification on `genus-known` + `unknown` entries → categorize confidence. Output JSON for review.
3. **Phase C (eventually)**: batch save HIGH-confidence into catalog (via /api/save-plant or direct Firestore). Skip MEDIUM/LOW for manual review.

Total potential catalog additions: ~916 entries (instant) + 113 require AI (~$5.65 estimated).
