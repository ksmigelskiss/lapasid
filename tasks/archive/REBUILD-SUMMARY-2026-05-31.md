# lt-names.json rebuild — galutinis summary (2026-05-31)

**Statusas:** rebuild atliktas, **VISKAS .NEW failuose**. Production untouched. Sprendimas laukia tavo review'o.

---

## TL;DR

| | OLD | NEW |
|---|---|---|
| Total genera | 1641 | 1673 (+32) |
| Total species | 4438 | 4696 (+258) |
| ltName changed | — | **433** ← peržiūrėk! |
| Synonym changes | — | 131 |
| Removed genera | — | 813 |
| Added genera | — | 845 |
| Species changed | — | **1 only** ✓ |

## Pagrindiniai sprendimai pasieky procese

### 1. Atradimas — plants.json genus rows turi corruption
Aquilegia → „vanduo" (water!), Acer → „klevai" (plural!), Antennaria → „antena" (antenna!) ir t.t. **Plants.json species rows yra patikimesni** — visi Aquilegia species'ai baigiasi „sinavadas".

### 2. Sprendimas — `plants-species-inferred` šaltinis (NEW)
Naujas „virtual" šaltinis: per genus paimam paskutinį žodį iš species LT names, paskaičiuojam dažnius. Jei konsensusas (1 species + sanity, 2 species + 100% agree, 3+ species + 70%) → tai canonical genus LT name. **1298 genera dabar gauna LT vardą per šitą metodą**, su `confidence: high`.

### 3. Source priority split — genus vs species channels
- `plants-species` (binomial rows iš plants.json) → 92 priority (HIGHEST species'ams)
- `plants-species-inferred` → 90 (highest genus'ams)
- `plants-genus` → demoted į 60 (corruption rizika)
- `inat` → 30 (cross-genus pollution risk)

### 4. AI verification fix'as 11 plants.json garbage entries
HIGH confidence replacements per Wikipedia LT + plants.json species cross-reference. Įdėti į `data/lt-names-overrides.json`:
```
Acacia → akacija       Pistacia → pistacija    Schoenus → vikšrenis
Blechnum → unksmenė    Potamogeton → plūdė     Sisyrinchium → vikšruolė
Myrica → sotvaras      Taxus → kukmedis        Thymus → čiobrelis
Myrrhis → garduoklė    Myrtus → mirta
```
Plus 4 MEDIUM/LOW confidence — laukia tavo review'o `_pending_review` sekcijoje.

### 5. Cross-genus pollution detection
Strict iNat reject'inimas (Streptocarpus → „Sanpaulija" → REJECT, nes „Sanpaulija" yra canonical kitam genus). 20 atvejų catched.

---

## Spot-check rezultatai (kritiniai cases)

| Latin | OLD | NEW | Šaltinis | Verdict |
|---|---|---|---|---|
| Aquilegia | "vanduo" ❌ | "Sinavadas" | species-inferred | ✓ FIXED |
| Acer | "Acer" (Latin) | "Klevas" | species-inferred | ✓ FIXED |
| Antennaria | "antena" ❌ | "Katpėdė" | species-inferred | ✓ FIXED |
| Adansonia | "Baobabai" (plural) | "Baobabas" (singular) | species-inferred | ✓ FIXED |
| Achillea | "kraujažolė" | "Kraujažolė" | species-inferred | ✓ case + conf upgraded |
| Sansevieria | "sansevjera" | "Sansevjera" | species-inferred | ✓ now high confidence |
| Streptocarpus | "Streptokarpas" + „Sanpaulija" pollution | "Streptokarpas" clean | wiki | ✓ pollution gone |
| Taxus | "kukmedis" (low conf) | "Kukmedis" | override-user | ✓ |
| Thymus | "čiobrelis" | "Čiobrelis" | override-user | ✓ high conf |
| Rosa | "rožė" | "Erškėtis" | species-inferred | ⚠ DISCUSSION — modern LT "rožė", but botanically "Erškėtis" |

---

## Failai (visi .NEW arba tasks/)

**Naujos data files (NOT applied):**
- `data/lt-names.json.NEW` (1673 genera)
- `data/species-lt-names.json.NEW` (4696 species)
- `data/lt-names-overrides.json` (user-curated, NEW file)

**Script files (sukurti):**
- `scripts/build-lt-names-v2.mjs` (637 lines, naujas architektūros script)
- `scripts/diff-lt-names.mjs` (compare old vs new tool)

**Markdown reports:**
- `tasks/REBUILD-SUMMARY-2026-05-31.md` ← šitas failas
- `tasks/rebuild-lt-names-diff-2026-05-31.md` ← detalus diff (521 eilutės)
- `tasks/verify-plants-garbage-2026-05-31.md` ← AI verify findings
- `tasks/rebuild-cross-genus-rejections.json` ← 20 cross-genus rejects log

---

## Kaip priimti pakeitimą

### 1 — Review (rekomenduoju):
```bash
# Skaityk diff report
cat /Users/kestutissmigelskis/lapasid/tasks/rebuild-lt-names-diff-2026-05-31.md

# Spot-check naujus failus:
jq '.ltNames.Sansevieria' /Users/kestutissmigelskis/lapasid/data/lt-names.json.NEW
jq '.ltNames.Aquilegia' /Users/kestutissmigelskis/lapasid/data/lt-names.json.NEW
```

### 2 — Apply (kai patenkintas):
```bash
cd /Users/kestutissmigelskis/lapasid
mv data/lt-names.json.NEW data/lt-names.json
mv data/species-lt-names.json.NEW data/species-lt-names.json

# Rebuild app:
npm run build

# Smoke test:
# - Search "Sansevieria zeylanica" — expect: „Sansevjera zeylanica"
# - Search "Aquilegia vulgaris" — expect: „Paprastasis sinavadas"
# - Search "Streptocarpus" — expect: „Streptokarpas" (no „Sanpaulija" chip)

git add data/lt-names.json data/species-lt-names.json data/lt-names-overrides.json scripts/build-lt-names-v2.mjs scripts/diff-lt-names.mjs tasks/REBUILD-SUMMARY-2026-05-31.md tasks/rebuild-lt-names-diff-2026-05-31.md tasks/verify-plants-garbage-2026-05-31.md
git commit -m "feat(data): lt-names.json v2 rebuild — species-inferred genus names"
git push
```

### 3 — Reject (jei nepatinka):
```bash
rm data/lt-names.json.NEW data/species-lt-names.json.NEW
# Production absoliuti untouched
```

---

## Likę open questions tau

1. **`_pending_review` overrides** (file: `data/lt-names-overrides.json`):
   - Arachis → „arachis" (Latin loan)
   - Cistus → „švitrūnas" (commercial sources strong)
   - Arundo → „arundas" (weakest evidence)
   - Chondrilla → 3 competing names — manual pick reikia

2. **Rosa genus**: „rožė" vs „Erškėtis"? Plants.json species nukreipia į „Erškėtis" (botanikos konvencija — wild rose), bet moderniame LT vartosena yra „rožė" (cultivated rose). Spręsk kaip primary genus name.

3. **Gaspadorius scraping bugs** (out of scope this rebuild — atskirai 9 entries identifikuoti `verify-plants-garbage-2026-05-31.md` Section 3a). Galim sukurti `data/gaspadorius-overrides.json` ar atskirai pataisyti raw failą.

4. **Species-level LT names patobulinimas** (Section 4e iš verify report): ~8 plants.json species rows looks wrong (e.g. `Arundo donax = vaistinė nendrūnė` — Nendrūnė is wrong genus). Out of scope dabar, atskira task'a.

---

## Rizikos vertinimas

- ✅ **Production untouched** (`.NEW` files, build script naujas, niekas necommit'inta)
- ✅ **433 ltName changes** — dauguma yra CORRECTIONS (case, plurals, genus-row corruption). Spot-checked, žiūr. lentelę.
- ⚠ **813 removed genera** — tai genera, kurių VISI candidates buvo garbage (multi-word, cross-genus, family-level). Daugumai jų nei OLD DB nieko gero neturėjo. Reikia spot-check.
- ⚠ **Rosa case** — sprendimas (rožė vs Erškėtis) gali turėti vartotojo facing impact.
- ✅ **Species channel** — tik 1 real change. Praktiškai zero risk.

---

**Kelias atgal į prod, kai pasiruošęs**: žiūr. „Kaip priimti pakeitimą → 2 Apply" aukščiau.
