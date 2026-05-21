/**
 * Stage 2 (RAG enrichment) shared constants — naudojami iš:
 *   • SearchModal.fetchDetails (inline Phase 2 RAG injection)
 *   • searchStage2.enrichPlantStage2 (standalone utility wrapper)
 *
 * Tikslas: viena vieta visam RAG-related prompt'avimui. Jei keičiam
 * climate kontekstą ar vet links — pakeitimas vienoje vietoje, ne dviejose.
 */

// Lietuvos klimato kontekstas — Stage 2 AI'us turi žinoti, kad augalas eis
// LT klimato sąlygas, ne UK ar US (kur dauguma source'ų yra).
export const LT_CLIMATE_CONTEXT = `
=== LIETUVA: KLIMATO KONTEKSTAS ===
Hardiness zona: 5b-6a (visa Lietuva, su išimtimis 7a Klaipėdoje)
Šaltų periodų minimas: -25°C kraštutinai, -15°C tipinis
Vegetacijos sezonas: maždaug gegužė-rugsėjis (frost-free)
Žiemos diena (gruodis-vasaris): tik 7-8 val šviesos — kambariniams augalams
  reikia papildomo apšvietimo arba toleruoti dormancy
Vasaros diena (birželis-liepa): iki 17 val šviesos — geri saulės mėgėjams
Vidutinė buto drėgmė šildymo sezonu (spalis-balandis): 30-40%

CARE adjustments LT klimato:
- USDA zona > 7 → tik kambarinis arba šiltnamio
- USDA zona 5-6 → tinka lauke
- USDA zona < 5 → puikiai tinka lauke
- Žiemą laistyti rečiau (mažiau šviesos, lėtesnis augimas)
- Vasarą galima išnešti į balkoną/lauką po paskutinio šalčio (maždaug gegužės vidurio)
`

// External vet links — naudojami toxic plants atveju. AI NEGENERUOJA first-aid
// medical advice'o; vietoj to linkuoja vartotoją į autoritetingus šaltinius.
export const VET_LINKS = `
=== EXTERNAL SOURCES (toxicity-related) ===
- ASPCA Animal Poison Control: https://www.aspca.org/pet-care/animal-poison-control
- Pet Poison Helpline: https://www.petpoisonhelpline.com/
- Lietuvos veterinarijos pagalba: konsultuokitės su veterinaru
`

// RAG priority instrukcija (2026-05-21 v5 — DIAGNOSTIC-DRIVEN).
//
// Po test #9 paleidome window.runPromptDiagnostic() — Claude pati pasakė
// AIŠKIAI: NĖRA mūsų prompt'e draudžiančios instrukcijos. Pagrindinis
// kaltininkas — RLHF safety training, kuris vengia detalių apie nuodus
// nepriklausomai nuo to, ką sakom. Reikia EXPLICIT OVERRIDE'o.
//
// Plus Claude pasiūlė three konkrečius pakeitimus, kuriuos čia ir
// pateikiame (A: safety override, B: few-shot Aconitum example,
// D: PRIVALOMA action directive).
// D STRICT INSTRUCTION (2026-05-21 v6, after user test #11):
//
// Vartotojo verdict'as: AI YRA STRUKTURIZATORIUS, NE KŪRĖJAS. Mūsų DB
// (ASPCA + PFAF) yra AUTHORITY. Jei mes davėme — AI privalo užrašyti.
// Jei mūsų DB tyli — AI palieka tuščia. NE pridėjimas iš training'o.
//
// Toxicity narrative (rich LT) generuojamas ATSKIRA mini AI call'a
// (toxicityNarrativeGenerator.js) iš tų pačių MŪSŲ source'ų. AI Phase 2
// pagrindiniam call'ui tik užtenka structured pavojai entries.
//
// Skirtumas nuo ankstesnių v1-v5 versijų:
//   ❌ NEBĖRA explicit whitelist'o (Aconitum/Digitalis etc.) — tas atvers
//      AI free fill door'į; vietoj — sandėlyje atskira Plus C decision
//   ❌ NEBĖRA few-shot Aconitum example'o — AI matydavo „čia kūrybiškas
//      pavyzdys", per much expand'indavo
//   ❌ NEBĖRA "warning label generator" framing'o — AI tampa creator
//   ✅ AI tampa STRICT translator iš RAG context'o
//   ✅ Empty pavojai[] yra TIESIOG VALID, jei RAG tyli
export const RAG_PRIORITY_INSTRUCTION = `
=== ROLE: DB-GROUNDED STRUCTURER ===

You are structuring verified plant data from our Lithuanian botanical
database into the schema. RAG context below is AUTHORITATIVE — translate
to natural Lithuanian, restructure into schema fields, but DO NOT add
information beyond what RAG provides.

CRITICAL: If RAG context is SILENT on a field, OUTPUT EMPTY for that
field. Do NOT fill from your training data.

  Examples:
  • RAG has ASPCA toxic-to list → fill savybes.pavojai[] entries per target.
  • RAG has PFAF knownHazards text → structured pavojai[] (severity from
    keywords: death/fatal→stiprus, paralyz/vomit/severe→vidutinis,
    irritate/mild→silpnas).
  • RAG silent on toxicity → savybes.pavojai = [], pavojingumas.yra = false.
    Do NOT add general "may be toxic" or compound-presence claims from
    your knowledge — our DB is authority on what to warn about.

For care info, idomybes, aprasymas — same principle: use RAG as foundation,
expand with Lithuanian narrative IF you can ground it in RAG. Skip
fabricating data not in RAG.

=== RAG CONTEXT ===

Below: data from our scraped database. Treat as source of truth.
`
