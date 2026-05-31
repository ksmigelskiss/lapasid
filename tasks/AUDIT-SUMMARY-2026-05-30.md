# Audit summary — overnight findings (2026-05-30)

**Statusas:** 3 audit'ai atlikti per naktį. Jokie pakeitimai į kodą / data / git nepadaryti. Visi script'ai dry-run only arba nepaleisti (credentials reikia atstatyti).

**Šiandienos sprendimai laukia tavęs** — žemiau top 3 actions su rizikos vertinimu ir konkrečiom komandom.

---

## 🎯 Top 3 sprendimai

| # | Sprendimas | Effort | Risk | Recommended |
|---|---|---|---|---|
| 1 | **Pašalint „+ visa serija" iš SearchModal** | ~1h | Žema | ✅ Taip (3 priežastys žemiau) |
| 2 | **Paleist catalog audit'ą su credentials** | ~30min | Žero (read-only) | ✅ Taip — info gathering |
| 3 | **Pradėt lt-names.json build-time filter fix** | ~3-5h | Vidutinė (reikia testing) | ⏸ Decide po #2 rezultatų |

---

## 📊 Findings santrauka

### 1. `lt-names.json` cross-genus pollution audit
**Detalus report'as:** [tasks/audit-lt-names-pollution-2026-05-30.md](audit-lt-names-pollution-2026-05-30.md)
**Audit script'as:** [scripts/audit-lt-names-pollution.mjs](../scripts/audit-lt-names-pollution.mjs) — JAU PALEISTAS, switched OK

**Skaičiai (faktiniai, ne estimate'ai):**
- 1641 genus entries total → 888 turi non-empty `ltAllForms`
- **88 genera (~10%) turi pollution** — 68 species-polluted + 23 cross-genus + 17 ambiguous
- Konkretūs tavo testai patvirtinti: `Sansevieria → "Sansevjera trijuostė"`, `Streptocarpus → "Sanpaulija"`

**Root cause (lokacija identifikuota):**
- `scripts/build-lt-names.mjs:299-310` — gaspadorius-detail.json species entries (83 iš 217) indexed kaip genus, ignoruoja `latinSpecies != null`
- `data/inat-names.json` — `preferredLtName` grąžina populiariausią vernacular be cross-genus check'o (Streptocarpus → „Sanpaulija")

**Fix strategijos (NEįgyvendinta):**
- **Option A**: build-time strict filter (gaspadorius species → species-lt-names.json kanalas, NE genus) — root cause fix, ~3-5h, idempotent
- **Option B**: post-hoc cleanup script — greitesnis bandaid, ~2h
- **Option C**: runtime filter ltDictionary.js'e (jau iš dalies veikia speciesQualified path'e) — nesprendžia root cause

**Rekomendacija:** A + B (build-time fix + vienkartinis cleanup atstatyti istorinę būseną)

---

### 2. Catalog legacy pollution audit
**Detalus report'as:** [tasks/audit-catalog-legacy-pollution-2026-05-30.md](audit-catalog-legacy-pollution-2026-05-30.md)
**Audit script'as:** [scripts/audit-catalog-legacy-pollution.mjs](../scripts/audit-catalog-legacy-pollution.mjs) — PARAŠYTAS, NEPALEISTAS (credentials)

**Kontekstas:** šiandien deploy'inti 4 fix'ai užkardo NAUJUS sugadintus įrašus. Bet LEGACY catalog entries (saved prieš fix'us) gali turėti pollution.

**4 klasifikatoriai (kiekvienas mapina į šiandienos commit'ą):**
- `vendorEchoSuspected` ← commit 024a756 (vendor echo ban) — estimuojama ~5-30 įrašų
- `genusOnlyBug` ← commit f7a7b4e (species-qualified fallback) — estimuojama ~10-40
- `hallucinationLikely` ← commit ed0707a (kanapė/ąžuolas/...) — estimuojama ~5-20
- `crossSpeciesSinonimai` ← commit 6b330fb — estimuojama ~5-15

**KRITIŠKAS caveat — Doc ID pollution:** `catalogDocId()` generuoja slug iš `lotyniskas`. Jei lotyniskas polluted (e.g. `dracaena_aubrytiana_nite_lite`), doc ID irgi polluted. `setDoc({merge:true})` field'ų pataisymas **NEPATAISO** doc ID. Cleanup gali reikt create-and-delete pattern'o.

**Cleanup strategy matrix:**
| Kategorija | Recommended | Reason |
|---|---|---|
| `hallucinationLikely` | Strategy C (nuke + re-search) | 100% bug, mažas N, surgical |
| `genusOnlyBug` strong | Strategy A (auto-fix) su backup | Deterministinis fix rule egzistuoja |
| `crossSpeciesSinonimai` | Strategy A | Additive metadata, safe |
| `vendorEchoSuspected` | Strategy B (flag-for-review) | Reikia AI re-id, auto-fix unsafe |

**Komanda paleist audit'ą:**
```bash
cd /Users/kestutissmigelskis/lapasid
vercel env pull .env.local
node --env-file=.env.local scripts/audit-catalog-legacy-pollution.mjs --json > audit-2026-05-30.json
```

---

### 3. Bulk series UX rethink (task #30)
**Detalus report'as:** [tasks/bulk-series-rethink-2026-05-30.md](bulk-series-rethink-2026-05-30.md)

**KRITIŠKAS SURPRISE FINDING:** „+ visa serija" mygtukas **NĖRA admin-gated**. Inline komentaras sako „Admin bulk save", BET `SearchModal` neimportuoja `isAdmin` ir nepatikrina. Bet kuris vartotojas mato.

**Quality gap (single save VS bulk):**
| Safeguard | Single | Bulk |
|---|---|---|
| RAG context (PFAF/ASPCA/Cheng) | ✓ | ✗ |
| D-strict toxicity per-cultivar | ✓ | ✗ |
| VOICE_PERSONA prompt | ✓ | ✗ |
| Per-cultivar idomybes/problemos/dauginimas | ✓ | ✗ (tik series-level) |
| Phase 2 enrichment kai user „+Pridėti" | ✓ | ✗ |
| `verificationStatus` upgrade logic | ✓ | ✗ (HARDCODED 'auto-verified') |

**Hallucination amplifier:** TOOL_BULK_SERIES schema sako „Surašyk VISUS žinomus cultivars (iki 25)" — list-completion task verčia AI pildyt quota. Wikidata verification VYKSTA, bet `wikidataVerified=false` NESTABDO save'o.

**Semantic drift:** `verificationStatus: 'auto-verified'` reiškia DU skirtingus dalykus (single = `aiConfidence==='high' && !fallbackInfo`; bulk = HARDCODED). Quality signal degradacija — vienas badge Library tab'e nebereiškia to paties.

**Rekomendacija: Option C (pašalint iš SearchModal)** + backup TOOL_BULK_SERIES schema palikti.

**Argumentai:**
1. Admin-leak (mygtukas neprotekcijuotas)
2. Vartotojo intent mismatch (ieško 1 augalo, gauna 25 į catalog)
3. Quality gap = MŪSŲ #1 tikslo (accuracy) tiesioginis pažeidimas
4. „Long-term TODO" framework anti-pattern (žiūr. lessons.md 2026-05-27)
5. Vienkartinis effort ~1h, low risk

**Backup**: jei admin'ui reikės bulk seeding po pašalinimo — Option B mini-version (admin review queue) tampa atskiras 2-week sprint.

---

## 🔥 Cross-cutting insights

1. **„Auto-verified" semantic drift** — pasitvirtino DU šaltiniai: bulk save (HARDCODED) ir Phase 2 (conditional). Galbūt verta įvesti `verificationStatus='auto-verified-phase2'` vs `'auto-verified-bulk'` nepriklausomai nuo bulk feature'o likimo.

2. **Data quality compounding** — visi 3 audit'ai rodo, kad pollution layer'iai susilieja:
   - lt-names.json pollution → search synonym chips wrong
   - catalog legacy pollution → user library wrong names
   - bulk save → catalog hallucinations
   Visi prisideda prie to paties symptom'o (user sees wrong names) per skirtingus kelius.

3. **Doc ID pollution** kaip systemic issue — `catalogDocId()` slug iš `lotyniskas`. Vendor echo ne tik užteršia field'us, bet ir docId'us. Cleanup gali reikti naujo „rename" pattern'o.

---

## 📋 Rytojaus action plan

### Saugiausias path (rekomenduoju):

**Žingsnis 1 — Bulk series removal (~1h)** ⚡
- Greitas win, žema rizika, sutvarko admin-leak
- Aš galiu padaryt vienu commit'u
- Greenlight: pasakyk „darom bulk series remove" → padarysiu

**Žingsnis 2 — Paleist catalog audit (~5min)** 📊
- `vercel env pull .env.local`
- Run script, get real numbers
- Tu sprendi pagal counts'us, kurią cleanup strategiją taikom

**Žingsnis 3 — lt-names.json build-time fix (~3-5h)** 🔧
- Reikia testing — modifikuoji build-lt-names.mjs, regenerate'i lt-names.json, verifikuoji kad nieks nesulūžo
- Galim split'inti į:
  - Build script fix (atskiras commit)
  - One-time cleanup script (atskiras commit)
  - Verification testavimas

### Alternatyvūs path'ai:
- **Tik #1 + #2** (jei ribotai laiko) — fix immediate bugs, palikti lt-names.json rytojui
- **Tik #2** (jei nori tik info) — pamatyk counts'us, decide later
- **Skip #1 padaryt rankomis** (jei nori pati pažiūrėti kodą) — aš nepaliesiu nieko

---

## 🚫 Ko šią naktį NEPALIETIAU

- **plants.json** — canonical curator = tu
- **lt-names.json** — nei vienos eilutės
- **Live catalog** — script'as nepaleistas
- **build-lt-names.mjs** — nė vienos modifikacijos
- **Production code** — nieko nepush'inta, nė commit'o
- **Animacijos** — tavo darbas

---

## 📁 Failai

**Sukurti per naktį (tasks/):**
- `AUDIT-SUMMARY-2026-05-30.md` ← šitas failas
- `audit-lt-names-pollution-2026-05-30.md` ← Agent A
- `audit-catalog-legacy-pollution-2026-05-30.md` ← Agent B
- `bulk-series-rethink-2026-05-30.md` ← Agent C

**Sukurti per naktį (scripts/):**
- `audit-lt-names-pollution.mjs` ← read-only, JAU paleistas, OK
- `audit-catalog-legacy-pollution.mjs` ← read-only, NEPALEISTAS (credentials)

**Atnaujinti memory entries:**
- `search_ux_decisions_2026_05_30.md` ← šiandienos UX sprendimai
- `feedback_naming_conventions.md` ← tavo „LT DB kaip guard gateway" filosofija

---

**Ką sakai? Pradedam nuo Žingsnis 1 (bulk series remove)?**
