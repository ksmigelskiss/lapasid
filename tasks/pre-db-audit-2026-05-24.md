# Pre-DB Audit + Fix — 2026-05-24 (pusdienio darbas)

**Tikslas:** Patikimas „stuburas" 300 augalų batch'ams + bendram user search'ui. Ne bandaid'ai — struktūrinis audit ir fix per visus duomenų šaltinius.

**User context:** „man reikia patikimo stuburo tiek musu 300 augalamas tiek kai useris iesko, nenoriu bandaid solutions"

## Pre-audit būklė

ASPCA fix jau commit'intas (6dec3e3 — split toxic/non-toxic). Likę šaltiniai turi žinomas problemas:

| Šaltinis | Žinomi bug'ai (prieš audit) |
|---|---|
| PFAF | Saintpaulia/Dieffenbachia entries tuščios, Aloe range „Mediterranean" netiesa, Aloe content po `barbadensis` syn |
| pre-db.json AHS species | Cross-ref parsing artifact'ai (`„'Amoena'. D. 'Exotica'. See"`) |
| pre-db.json Beckett | ~30% ne LT kambariniai (sezoniniai, dovan-augalai, conservatory) |
| lt-names.json | Syngonium → „Orchidėja bulbophyllum", Schefflera → „Orchidėja coelogyne" |
| inat-names.json | Saintpaulia ne rasta dėl 2017 taxonomy migration (Streptocarpus) |
| plants.json | Descriptor entries dirty (task #22 pending) |
| latin-synonyms-reverse | Egzistuoja, bet ne integrated į RAG builder'į |

## Etapai (atomic commit'ai)

- [x] **ETAPAS 1** PFAF audit + fix ✅
- [x] **ETAPAS 2** lt-names.json audit + cross-validate ✅
- [ ] **ETAPAS 3** iNat reverse-synonym integration + AHS species re-parse
- [ ] **ETAPAS 4** Indoor whitelist (`data/lt-indoor-whitelist.json`)
- [ ] **ETAPAS 5** Cross-source validation pipeline
- [ ] **WRAP-UP** memory + tasks update

## Progress log

### ETAPAS 1 — PFAF audit + fix (DONE)

**Audit atskleidimas (kritinis):**
- 9894 entries `found:true`, BET 7413 (74.9%) yra „skeleton pages" — PFAF rendered template page'ai be tikro content'o
- `medicinalUses` parser BROKEN 100% — match'ino navigaciją, ne realų h2 section'ą
- 984 `edibleUses` entries baigėsi su „References More on Edible Uses" garbage suffix
- `Aloe vera.range` netiesa (Mediterranean — turi būti Arabia/N.E. Africa) — PFAF upstream klaida

**Fixes pritaikyti (be re-scrape'o — taupo ~8h):**
1. `scripts/pfaf-cleanup.mjs` post-process — 7413 skeleton entries flipped į `found:false`, 984 garbage suffix'ai stripped, 1 upstream fact error (Aloe range) flagged
2. `scripts/pfaf-scraper.mjs` parser fix'ai ateičiai — empty page check su `lblCommanName` content detection, medicinalUses regex anchor'inta į `<h2>` tag'ą
3. Data result: PFAF found 9894 → **2481** (sąžiningas realybės pripažinimas)

**Curated-300 implication:** 143/300 turi rich PFAF content, 157/300 ne (genus-level entries kaip Kalanchoe, Pilea, Spathiphyllum, Philodendron, Bougainvillea, Clivia, Dieffenbachia, Crassula arborescens, Ceropegia woodii, Epipremnum pinnatum). Šie augalai PFAF'e neturi page'ų — reikės kito šaltinio (Wikipedia LT/EN, AI fallback). NE BLOCKER per se (kambariniai augalai dažnai neturi PFAF, nes PFAF orientuotas į edible/wild/forage).

**Atvira problema (kontekstui):** pre-db.json trūksta žinomų vaistažolių (Hypericum perforatum, Mentha piperita). Tai pre-DB extraction klaida (ne PFAF) — fix'inama vėliau (Etapas 3 ar future task).

### ETAPAS 2 — lt-names.json audit (DONE)

**Audit atskleidimas:**
- 1655 entries total: high=440, mid=468, null=747 (legitimūs empty — joks LT vertimas neaptiktas)
- 2 Orchidaceae cross-contamination bugs (Syngonium, Schefflera)
- 2 Latin'iški species pavadinimai vietoj LT (Stephanandra → „Arabidopsis thaliana", Reinwardtia → „Reinwardtia indica")
- 3 Wikipedia disambig suffix leakage (Hoya „Vaškuolė (reikšmės)", Lotus, Vanda „(ežeras)")
- 10 ltFamily lauke „Nuorodiniai straipsniai" (Wiki disambig kategorija)
- 3 Non-plant Wikipedia targets — Rita (filosofija), Valia (psichologija), Darwin (mokslininkas) → manual review needed

**Fixes pritaikyti:**
- `scripts/apply-lt-names-fixes.mjs` script'as (idempotentinis, daro backup'ą)
- 7 primary fixes + 8 secondary family-only fixes applied
- Backup'as sukurtas `data/lt-names.backup.2026-05-23.json` (Git turi versija history)

**Atskleistas pattern'as (escalated future task'us):**
- 38 iNat-only LT entries — likely cross-genus contamination (Aiton → „Dilgėlė", Aiton yra botanikas William Aiton, ne plant). Task #42
- 3+ non-plant artifact entries pre-db.json'e (Rita, Valia, Darwin). Task #43

**Post-fix confidence distribution:** high=440, mid=466, null=749 (2 stripped to null)
