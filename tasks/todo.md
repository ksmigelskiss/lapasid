# Master planas — hero/foto subsistema → cleanup → reviewer (2026-05-28)

Nuoseklus planas. **Principas: užbaigti vieną subsistemą prieš pereinant prie
kitos.** Šokinėjimas nuo temos prie temos sustabdytas.

## Statusas
- ✅ Hero drawing pipeline (Gemini restyle + Sonnet vision gate + sharp transparentize) — katalogo seed **79/79** (offline batch)
- ✅ Drawing kokybės debug — Ficus houseplant fix, globalus no-text fix; Calathea/Dracaena/Senecio priimtini
- 🔜 **Phase A** — produkcinė integracija (žemiau)

Atmesta (žr. AI optimizacijos analizę): prompt caching (low value dėl global-lib
dedup), Haiku narrative (safety-critical auditor), Phase1+2 merge (UX).

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

### A3. Įvielinti į Phase-2 global-save
- [ ] Po global catalog įrašymo → async (`waitUntil`) trigger hero gen
- [ ] Drawing = default hero, realios foto galerijoje (kaip dabar)
- [ ] Pirmas user mato realią foto kol drawing ruošiasi; kiti — su drawing

### A4. Verifikacija
- [ ] Naujo (ne katalogo) augalo pridėjimas → po kelių s atsiranda drawing
- [ ] Genus vs species elgsena teisinga
- [ ] Build praeina

---

## PHASE B — Save/AI flow cleanup  (KARTU su A3 — tas pats save kodas)
- [ ] Narrative lygiagrečiai su details (`Promise.all`) — `fetchDetails` (SearchModal:615) + `save-plant.js` mirror. -5–15s kiekvienam Save
- [ ] Client/server Save dublikato konsolidacija (server-side = kryptis; drift prevencija)

## PHASE C — Duomenų kokybės audit (vienas praėjimas)
- [ ] Asmeninės foto global'e — audit: rasti entries su user personal photos kaip `image`; flag/replace (privatumas)
- [ ] `dracaena_marginata` naming (senas įrašas — LT vardas tik „Dracena")
- [ ] 4 mismatch realios foto (Calathea/Dracaena/Ficus/Senecio) — drawing pataisytas, bet galerijos „tikra foto" dar bloga

## PHASE D — Reviewer/approval flow
- [ ] `verified`/`reviewedBy`/`reviewedAt` laukai naujam global entry
- [ ] Admin „nauji nepatikrinti" eilė; regenerate-hero + approve → verified
- [ ] „Atnaujinti per AI" (`plantAI.js`) → admin-only (greičiausiai stale schema — patikrinti)

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
