# Phase 2a — Explicit suspects verification (30 entries)

Verification source: lt.wikipedia.org (article-level, not search snippets unless explicitly noted)
Date: 2026-05-31

## Summary

| Verdict | Count |
|---|---|
| confirmed-error (auto-applicable correction) | 15 |
| confirmed-error (genus-level, needs bigger refactor) | 5 |
| confirmed-ok (false positive Phase 1 flag) | 1 |
| legit-alt (taxonomic synonym, leave alone) | 3 |
| unverifiable (no Wikipedia article) | 6 |

---

## Confirmed errors (auto-applicable to lt-names-overrides.json species section)

These have a clear Wikipedia article (or genus article listing the species) with the canonical Lithuanian name.

| Latin | Current (wrong) | Wikipedia LT (correct) | Source |
|---|---|---|---|
| Alpinia galanga | didysis galangas | didžioji alpinija | lt.wiki Alpinija genus + spice plants article |
| Alpinia officinarum | vaistinis alpinijos kalgan | vaistinė alpinija | lt.wiki spice plants article |
| Alpinia zerumbet | raibasis alpinijos | gražioji alpinija | lt.wiki Alpinija genus |
| Blechnum spicant | varpotoji nukimėlė | varpotoji unksmenė | lt.wiki Unksmenė |
| Citrus aurantium | karčiavaisis citrina | karčiavaisis citrinmedis | lt.wiki Citrus_aurantium |
| Citrus aurantifolia | rūgščioji citrina | rūgščiavaisis citrinmedis | lt.wiki Citrus_aurantifolia (note: vaisius = "rūgščioji citrina" = the fruit, but the plant is "rūgščiavaisis citrinmedis") |
| Clerodendrum fragrans | kvapusis švelmedis | kvapusis šventmedis | lt.wiki genus Šventmedis (švelmedis is a typo/non-word) |
| Clerodendrum thomsoniae | Tomsono švelmedis | Tomsono šventmedis | same — švelmedis→šventmedis systematic typo |
| Dioscorea oppositia | oppositia | batatinė dioskorėja | lt.wiki Batatinė_dioskorėja (note: Latin should also be "Dioscorea polystachya" — current "oppositia" is a misspelled synonym of "opposita") |
| Epidendrum radicans | epidendrum | atžalinis epidendras | lt.wiki Epidendras genus |
| Hedera canariensis | kanariškas Efėjus | kanarinė gebenė | lt.wiki Gebenė |
| Hedera colchica | kolchidinė Efėjus | kolchidinė gebenė | lt.wiki Gebenė |
| Ipomoea batatas | valgomasis bulvas | batatas | lt.wiki Batatas (alt: "saldžioji bulvė") |
| Polystichum aculeatum | nelokinis spyglainis | miškinis spyglainis | lt.wiki Miškinis_spyglainis |
| Scirpus sylvaticus | lieknais viksvilėdis | liekninis viksvameldis | lt.wiki Liekninis_viksvameldis |
| Selenicereus grandiflorus | didžiažiedis naktinis | didžiažiedis naktenis | lt.wiki Naktenis genus |

---

## Confirmed errors — genus reclassification needed (not just species rename)

These are deeper data-model fixes — the species belongs to a different LT genus than plants.json has it under, or the input's expected genus name is itself wrong.

| Latin (in plants.json) | Current LT | Wikipedia LT | Issue |
|---|---|---|---|
| Scirpus radicans | pelkinis viksvilėdis | (no LT article; genus = "viksvameldis" not "viksvilėdis") | "viksvilėdis" is a typo/non-word; should be "viksvameldis". No species-level LT name found — defer last word, fix only "viksvilėdis"→"viksvameldis" |
| Scirpus tabernaemontani | Schoenoplectus tabernaemontani | melsvasis meldas | Taxonomic reclassification: Scirpus tabernaemontani == Schoenoplectus tabernaemontani; LT genus is "meldas" not "viksvameldis". Fix LT name but consider keeping current Latin or reclassifying |
| Scirpus setaceus | Isolepis setacea | šerinis meldelis | Reclassified to Isolepis (==Scirpus setaceus); LT genus is "meldelis". Same caveat as above |
| Solanum sisarum | saldžiašaknė | saldžiašaknė drėgmenė (Sium sisarum!) | This is **Sium sisarum** (Apiaceae) NOT a Solanum. Current LT name "saldžiašaknė" is correct for Sium — genus assignment in plants.json is wrong |
| Solanum china | kininis sarsaparilis | (no LT article) — this is **Smilax china** | Misclassified — Smilax (not Solanum). "kininis sarsaparilis" is colloquial, plausible; defer |

---

## False positives (Phase 1 over-flagged)

| Latin | Current LT | Wikipedia confirms | Why Phase 1 flagged it |
|---|---|---|---|
| Hedera helix | gebenė lipikė | "Gebenė lipikė" (dedicated article) — CORRECT | Phase 1 expected last word = "Gebenė" (genus name), but the canonical full LT binomial puts "gebenė" first and species epithet "lipikė" last. The actualLastWord check is unreliable for genus-first naming |

---

## Legitimate alternative names / taxonomic reality

| Latin | Current LT | Note |
|---|---|---|
| Begonia scandens | "Begonia glabra" (Latin sneaks in) | Begonia scandens IS a synonym of Begonia glabra (taxonomically). No LT name found on Wikipedia. LT name from genus article for B. glabra = "plikoji begonija" (see blindSpots list). Recommend: rename current to "plikoji begonija" AND consider mapping scandens→glabra |
| Senecio cineraria | "Senecio bicolor" (Latin sneaks in) | Senecio cineraria == Senecio bicolor == Jacobaea maritima (taxonomic synonyms). No LT name on lt.wiki. Common horticultural name "sidabrinė žilė" exists in literature but not Wikipedia-verifiable. Defer |
| Senecio cruentus | aukštoji cineraria | Senecio cruentus is now Pericallis cruenta; "cineraria" is a common horticultural name (genus Pericallis was once split from Cineraria). No LT Wikipedia article. Defer — current is at least recognizable to horticulturists |

---

## Unverifiable (no Wikipedia article found)

| Latin | Current LT | Action |
|---|---|---|
| Begonia scandens / Begonia glabra | "Begonia glabra" | Cross-ref blindSpots: B. glabra = "plikoji begonija" — apply that |
| Epiphyllum grande | grande | No lt.wiki article. Genus = lapenis. Defer — possibly a non-accepted name; cross-check whether E. grande is even valid |
| Polystichum formosum | takažolė | This is almost certainly a Latin typo for **Polytrichum formosum** (a MOSS, not a fern!). "takažolė" doesn't match either. Defer — likely a data-entry confusion. Real Polystichum formosum is not a widely-accepted name |
| Senecio cineraria | "Senecio bicolor" | Latin string in lithuanian field is itself wrong; no LT name verifiable. Defer to botanist |
| Solanum Smilax | sarsaparilis | "Solanum Smilax" isn't a valid name (Smilax is genus). Likely meant Smilax sarsaparilla. Cleanup needed but no Wikipedia source |
| Clerodendrum fragrans | kvapusis švelmedis | Wikipedia has no species article, but genus-level fix (švelmedis→šventmedis) is firm — applied above |

---

## Systematic patterns found

### 1. "švelmedis" → "šventmedis" (Clerodendrum) — SYSTEMATIC TYPO
- Wikipedia has NO article for "švelmedis" — it is not a Lithuanian word.
- Wikipedia's article on Clerodendrum is at "Šventmedis"; species use this form (e.g. "lygusis šventmedis").
- plants.json affected entries:
  - "kvapusis švelmedis" → "kvapusis šventmedis" (Clerodendrum fragrans)
  - "Tomsono švelmedis" → "Tomsono šventmedis" (Clerodendrum thomsoniae)
  - "krūmas klerodendras" (in blindSpots list, line 687) — also wrong; "klerodendras" not in lt.wiki; should likely be "Bungės šventmedis" for Clerodendrum bungei
  - Top-level genus literal "klerodendras" — replace with "šventmedis"
- **Recommend bulk fix on the genus token.**

### 2. "viksvilėdis" → "viksvameldis" (Scirpus) — SYSTEMATIC TYPO
- "viksvilėdis" is not a word on Wikipedia. The genus Scirpus is "viksvameldis" on lt.wiki.
- plants.json affected:
  - "pelkinis viksvilėdis" (Scirpus radicans) → "pelkinis viksvameldis"
  - "lieknais viksvilėdis" (Scirpus sylvaticus) → "liekninis viksvameldis"
- **Recommend bulk fix.**

### 3. "Efėjus" → "gebenė" (Hedera)
- "Efėjus" is not the standard lt.wiki name for Hedera — "gebenė" is. (Efėjus appears in older / Polonism-influenced Lithuanian literature but is not the standard botanical name.)
- Affected entries: kanariškas Efėjus, kolchidinė Efėjus
- Hedera helix correctly uses "gebenė" → confirms gebenė is the chosen form in plants.json
- **Recommend bulk fix Efėjus → gebenė.**

### 4. "citrina" (fruit) confused with "citrinmedis" (plant)
- For Citrus species, plants.json sometimes uses "citrina" (which is the fruit lemon in LT), not "citrinmedis" (tree)
- Affected: "rūgščioji citrina", "karčiavaisis citrina"
- The full LT binomial uses "citrinmedis" suffix (e.g. "rūgščiavaisis citrinmedis")
- Cross-check: vendor list (Citrus limon, Citrus medica, Citrus paradisi, etc.) all correctly use "citrinmedis" suffix already. The aurantifolia/aurantium entries are outliers.

### 5. Solanum genus = "kiauliauogė" NOT "Kiaulienažolė"
- Input's `expectedLastWord = "Kiaulienažolė"` is itself wrong.
- Wikipedia confirms Solanum genus = "Kiauliauogė" (kiauliaouge / pig-berry).
- "Kiaulienažolė" appears nowhere on lt.wiki — generator script bug.
- Some Solanum entries (sisarum, china, Smilax) are actually mis-classified — they're NOT Solanum genus.

### 6. "Latin string in lithuanian field" data corruption
- Several entries have raw Latin in the `lithuanian` field (data quality bug):
  - "Begonia glabra" (Begonia scandens)
  - "Isolepis setacea" (Scirpus setaceus)
  - "Schoenoplectus tabernaemontani" (Scirpus tabernaemontani)
  - "Senecio bicolor" (Senecio cineraria)
- These are scraped-with-no-fallback failures.

---

## Recommendations

1. **Apply 15 auto-confirmed species overrides** to lt-names-overrides.json (see `phase2a-confirmed-errors.json`).
2. **Bulk-fix 2 systematic typos** (švelmedis→šventmedis, viksvilėdis→viksvameldis) across all affected entries — this likely fixes more rows than just the 30 here.
3. **Audit `expectedLastWord` generator** — input file's expected genus names for Solanum ("Kiaulienažolė") and Scirpus ("Ristis") are themselves wrong; Phase 1 was comparing against an invalid baseline. Recommend regenerating with correct genus map.
4. **Audit "Latin string in lithuanian field"** — separate cleanup pass to detect and re-resolve all entries where lithuanian field starts with a capital Latin word.
5. **Defer 6 entries** without Wikipedia sources to botanist review.
