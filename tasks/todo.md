# Master planas — hero/foto subsistema → cleanup → reviewer (2026-05-28)

Nuoseklus planas. **Principas: užbaigti vieną subsistemą prieš pereinant prie
kitos.** Šokinėjimas nuo temos prie temos sustabdytas.

## Statusas
- ✅ Hero drawing pipeline (Gemini restyle + Sonnet vision gate + sharp transparentize) — katalogo seed **79/79** (offline batch)
- ✅ Drawing kokybės debug — Ficus houseplant fix, globalus no-text fix; Calathea/Dracaena/Senecio priimtini
- 🔜 **Phase A** — produkcinė integracija (žemiau)

Atmesta (žr. AI optimizacijos analizę): prompt caching (low value dėl global-lib
dedup), Haiku narrative (safety-critical auditor), Phase1+2 merge (UX).

> **▶ NEXT SESSION:** žr. **`tasks/audit.md`** (pilnas 4-ramsčių + write/state auditas,
> 2026-05-29). Verdiktas: NE big-bang rewrite, bet tikslinai struktūriniai refaktorai.
> P0 = user-plant↔catalog denormalizacija (didžiausia tikslumo spraga). P1 = care-data
> grounding + toksiškumo severity (peržiūrėti KARTU). B2 ✅ BAIGTA 2026-05-28.

---

## PHASE A — Hero/foto subsistemos produkcinė integracija  [AKTYVU]

Tikslas: nauji augalai (Phase-2 → global-save) automatiškai gauna drawing
(default hero) + gerai parinktą realią foto. Rank-aware.

### A0. Tyrimas / dizainas  ✅ DONE
- [x] Phase-2 global-save: client `SearchModal:802` (flag OFF) / server `save-plant.js:373` (flag ON, `waitUntil`)
- [x] `rank` NEsaugomas → deriv'inti `parseLatinName(latin).rank`
- [x] Brave: `/api/plant-image?q=` proxy (`fetchBraveImages`)
- [x] `waitUntil` jau naudojamas `save-plant.js:91`; `heroIllustration` niekur nerašomas (insertion point)
- [x] Sprendimas: decoupled `/api/generate-hero` trigger (path-agnostic); genus→text, species/cultivar→restyle; rašom tik heroIllustration

### A1. `api/_lib/heroGen.js` — bendras modulis
- [x] **Žingsnis 1:** iškelta morphologyBrief, geminiRestyle, geminiTextToImage, transparentizeBg + konstantos; batch refaktor'intas naudoti modulį (verifikuota: aloe restyle·full-habit). Upload lieka per-caller.
- [x] **Žingsnis 2 (rank-aware):** ✅ DONE
  - genus → text→img + houseplant-form hint (verifikuota: Ficus → houseplant, ne medis/tekstas)
  - species/cultivar → vision-gate (gatherCandidates: entry.image + iNat + Wiki + Brave „{name} houseplant potted") → assessAndPick (Sonnet parenka geriausią) → restyle (fallback text). Verifikuota: Monstera restyle·full-habit
  - `generateHeroForEntry(entry, {braveApiKey})` → `{ buf, heroPromptBrief, heroPhotoAssessment, _heroMethod, chosenRealPhoto, rank }`

### A2. `api/generate-hero.js` route  ✅ DONE (deploy-verifikacija laukia)
- [x] Auth (Bearer, `uidFromToken`), `maxDuration: 120`
- [x] `{ latinName, force }` → catalogDocId → fetch entry → `generateHeroForEntry` → upload + catalog write
- [x] Idempotent (skip jei turi hero nebent force)
- [ ] ⚠️ DEPLOY VERIFIKACIJA: ar `process.env.VERCEL_OIDC_TOKEN` prieinamas Vercel funkcijoje (AI Gateway). Jei ne → AI Gateway API key env var

### A3. Įvielinti į Phase-2 global-save  ✅ DONE (client kelias)
- [x] `triggerHeroGen(latinName)` plantAI.js (fire-and-forget, keepalive, auth)
- [x] SearchModal:802 `saveCatalogWithSpeciesParent(...).then(() => triggerHeroGen(latinName))`
- [x] Build praeina
- [ ] Server kelio trigger (`save-plant.js` processPlant) → Phase B (kai konsoliduosim; flag dabar OFF → client aktyvus)

### A4. Verifikacija  [ROOT CAUSE RASTAS — laukia env fix]
- [x] Diagnozė: route'as fail'ina, nes **Vercel NETURI AI Gateway credential**. Prod env: tik ANTHROPIC_API_KEY + BRAVE_API_KEY. `VERCEL_OIDC_TOKEN` runtime'e neprieinamas (OIDC neįjungtas), `AI_GATEWAY_API_KEY` nenustatytas → route 503 → jokio drawing. (Kiti route'ai veikia per ANTHROPIC_API_KEY.)
- [x] Bonus bug fix: 16MB kandidatas (Yucca) crash'ino gen (>5MB Sonnet limit) → fetchImagePart dabar resize per sharp (gina ir prod route'ą)
- [x] Deployment Protection (SSO) įjungtas *.vercel.app; prod domenas = lapasid.lt (public)
- [x] **USER pridėjo `AI_GATEWAY_API_KEY`** → trigger+route AUTO-suveikė (Alocasia regal shield gavo drawing be rankinio). **Phase A ✅ BAIGTA.**
- [x] Manual gens: Alocasia, ficus_ginseng, Calathea warscewiczii, Yucca elephantipes ✓
- [x] (polish) widget cache fix: `refreshHeroMap()` (cache-bust + re-preload) → App po add'o delayed (45s/90s) + grįžus į tab'ą auto-refresh'ina → widget pasiima drawing be hard-refresh. heroMapV counter → re-render.

---

## PHASE B — Save/AI flow cleanup  [AKTYVU]
- [x] **B1 (client):** Narrative lygiagrečiai su details (`Promise.all`) `fetchDetails` — -5–15s. (server mirror → B2)
- [x] **Prod flag = server-side:** console atskleidė `VITE_USE_SERVERSIDE_SAVE="1"` PRODUKCIJOJE (A0 skaitė lokalų .env.local OFF — klaidinga). Aktyvus kelias = branch 2 (server). Client triggerHeroGen fire'indavo route IŠKART, bet catalog rašomas async processPlant'e → **route 404 (catalog_entry_not_found)** → jokio drawing.
- [x] **Server hero hook:** `processPlant` step 7 (PO catalog write) → `generateHeroForEntry` + upload + catalog.heroIllustration. Branch-2 client trigger pašalintas. (Fast-path/flag-off client trigger lieka.) **Tai ir yra teisingoji A3 server-integracija.**
- [x] **B2 (normal-approach):** ✅ DONE 2026-05-28 — žr. žemiau.

### 🎯 SUTARTAS NORMAL-APPROACH (vietoj bandaid'ų)  ✅ DONE 2026-05-28
Buvo: hero gen išbarstytas per SearchModal save šakas + display per `_heroMap`
bulk-cache + refresh timer'ius (dae3195/65185e8 = bandaid'ai). User'is teisingai
flag'ino. **Du švarūs mechanizmai pririšti prie TIKRŲ įvykių:**

- **A. Display = LIVE Firestore subscription** ✅:
  - `subscribeHeroMap(onChange)` (catalog.js) → `onSnapshot(collection('catalog'))`
    palaiko `_heroMap` gyvai → serveris parašo `heroIllustration` → snapshot (~1s)
    → map update → App `heroMapV` bump → kortelės re-render akimirksniu.
  - Pigu: `persistentLocalCache` (firebase.js) serve'ina iš IndexedDB + sync'ina
    tik delta'as (vs buvę full re-fetch'ai kas 45s/90s/focus).
  - **IŠMESTA:** `preloadHeroMap` + `refreshHeroMap` (catalog.js), mount/focus/
    `lapas:hero-gen-started` refresh timer'iai (App.jsx). Visi bandaid'ai.
  - Ištaisė „widget niekada neatsinaujina".
- **B. Generation = pririšta prie CATALOG WRITE, viena vieta** ✅:
  - Server (prod, flag-on): `processPlant` step 7 PO catalog write — vienintelis
    gen mechanizmas produkcijoj. Palikta.
  - Client (flag-off dev): `triggerHeroGen` po `saveCatalogWithSpeciesParent`
    (SearchModal :808, `.then()` — jokio race).
  - **IŠMESTA:** fast-path SearchModal trigger (:3077, buvo redundant idempotent
    POST kiekvienam catalog-hit'ui) + `lapas:hero-gen-started` dispatch
    (`triggerHeroGen` plantAI.js — display dabar per live subscription).
- NB: prod `VITE_USE_SERVERSIDE_SAVE="1"` (server-side aktyvus).

## PHASE C — Duomenų kokybės audit (vienas praėjimas)
- [ ] Asmeninės foto global'e — audit: rasti entries su user personal photos kaip `image`; flag/replace (privatumas)
- [ ] `dracaena_marginata` naming (senas įrašas — LT vardas tik „Dracena")
- [ ] 4 mismatch realios foto (Calathea/Dracaena/Ficus/Senecio) — drawing pataisytas, bet galerijos „tikra foto" dar bloga
- [ ] **User plant ↔ catalog DIVERGENCE** (rasta tiriant Alocasia regal shield): catalog lieka `preview` (pre-DB data: „Alokazija"), user plant turi Phase-1 data („Karališkoji alokazija"). Pilnas Phase-2 catalog reconciliation (upsert + `preview→verified`) nesuveikia fast/pre-DB kelyje → diverge. Fix: kai user save'ina, suderinti catalog su turtingesne data + upgrade status.
- [ ] **Latin normalizavimas trade-name'ams**: „Alocasia regal shield" → `Alocasia 'Regal Shield'` (hibridas). Latin resolver nenormalizuoja angliškų trade names.
- [x] **Latin trade-name normalizavimas** ✅ (`d57233f`) — PLANT_SYSTEM classify prompt + genus-fallback guard (`6d99682`)
- [x] **englishNames haliucinacijos** ✅ (`d57233f`) — iNat+GBIF genus-consistency guard
- [x] **Toksiškumas severity** ✅ (`3eb3081`) — peržiūrėta kartu. Žmonėms: trailing `\b` fix (irritation→silpnas) + oxalate dietinis de-escalation. Saugumas: ASPCA `vidutinis` floor (confidence≠severity) + `abiem`→du pavojai (gyvūnų pusė nebedingsta). Client+server mirror. **Esamiems įrašams:** `node --env-file=.env.local scripts/cleanup-toxicity-severity.mjs --dry-run` (`a4b787c`).
- [ ] **Genus-fallback dublikatai cleanup**: esami „Alokazija" (×2) + kiti genus-vardu pažymėti cultivar įrašai (sukurti prieš `6d99682`) — script: rasti catalog entries kur lietuviškas==genus LT name BET latin turi rūšį/cultivar → re-identify per AI / flag admin'ui.
- [x] **Care grounding (audit P1)** ✅ — **Tręšimas:** kategorijos lentelė autoritetinė (AI skaičiaus nebenaudojam), praturtinta orchidėja/mėsėdis(=none), konservatyvios reikšmės; tipas iš FERTILIZER_TIPS. **Laistymas:** AI reikšmė + clamp [2,40]/[2,90] (ziema≥vasara NEverčiam — winter-active). **Narratives kvalitatyvinės** (be dienų-skaičių) → nekonfliktuoja. **substratas JSON-unwrap.** PlantCareCard fert dead-field fix. (commits fert/normalize/prompt)
- [ ] **Admin editor tręšimo/laistymo lentelei** (žingsnis 2 — patvirtinta): redaguoti INTERVALS/FERTILIZER_TIPS be deploy'o.
- [ ] (minor) substratas JSON-wrapper esamuose įrašuose (Pilea) — unwrap'as taiso NAUJUS; senus per admin edit ar cleanup.

## PHASE D — Reviewer/approval flow (LAUKIA — po UX-3-tier consolidation)
- [ ] `verified`/`reviewedBy`/`reviewedAt` laukai naujam global entry
- [ ] Admin „nauji nepatikrinti" eilė; regenerate-hero + approve → verified
- [ ] **Admin langas perprojektavimas** (kartu su reviewer flow — daug naujų unverified/fallback įrašų)
- [ ] „Atnaujinti per AI" (`plantAI.js`) → admin-only (greičiausiai stale schema — patikrinti)
- [ ] (refine, ne dabar) **Greitis:** AI Phase 1 (vendor name) 24→45s — apriboti web_search max_uses, prompt trumpinti, ar timeout. Phase 2 irgi ilgokai (ar nėra blokuojančių klaidų — patikrinti). Tikslas: greičiau nepralaimint kokybei.

## PHASE E — Backlog (mažiausias skubumas)
- [ ] „Įsigijau" → nufotografuoti → asmeninė foto flow
- [ ] Likę katalogo tier'ai (2/3 enrich)
- [ ] Toksikologija pre-DB additions
- [ ] PFAF `sonnet-*` pipeline
- [ ] Schlumbergera fix (ziema < vasara — klaidinga kryptis)

---

## Pastabos
- `.env.local`: po batch'o `rm` (turi service account + OIDC). Produkcinė integracija naudoja Vercel env, ne local.
- Senas snooze refaktoras (buvęs todo.md) → `backlog.md` [DONE] + git istorija.
