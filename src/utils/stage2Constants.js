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

// RAG priority instrukcija (2026-05-21 v4 — DRASTICALLY SIMPLIFIED).
//
// Po user test #7 pamatėm STIPRŲ regression — Aconitum AI grąžino
// idomybesCount=0 net su explicit FORCED tool schema. Hipotezė: per
// daug instrukcijų sluoksnių (PLANT_SYSTEM 4.5K + RAG_PRIORITY 3.5K +
// RAG context 2.4K + LT_CLIMATE 1K + VET_LINKS 0.2K = ~12K chars
// system prompt'as → ~3000 tokens). AI'us tampa overloaded'as ir
// praleidžia laukus net iš forced schemos.
//
// Sprendimas: TIK ESMINIS žinutis — 1 paragraf'as. Detali instrukcija
// jau yra TOOL_DETAILS user message'e (SearchModal.jsx:776-820).
export const RAG_PRIORITY_INSTRUCTION = `
=== VERIFIED FACTS FROM OUR DATABASE ===

Below: pilna ir patikrinta info'a iš mūsų scraped'inta bibliotekos
(AHS, Beckett, Cheng, PFAF, ASPCA, Wikipedia, lt-names).

Naudok šias žinias kaip foundation'ą — ne kaip celling'ą. Toxicity
narrative, history, ecology — EKSPAND'INK savo botanikos žiniomis,
ne tik versk. Niekada neprieštaruok faktams, bet visada pilnai
užpildyk schema su rich LT narrative (3-5 sakiniai kur reikia).
`
