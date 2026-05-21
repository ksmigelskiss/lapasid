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

// RAG priority instrukcija — pasakanti AI'ui, kad VERIFIED FACTS žemiau yra
// authoritative FOUNDATION, ne tiesiog COPY source. Tas yra Stage 2 RAG
// sukimuko esmė — AI rolė: „ground in RAG + EXPAND with botanical context".
//
// 2026-05-21 update'as: po user test'o pamatėm, kad AI buvo PER MUCH compliant
// — Eucomis aprasymas TIESIOG IŠVERSTAS Beckett intro (1 sakinys), Aconitum
// pavojai array TUŠČIA nors PFAF knownHazards 300+ chars. Sprendimas — aiški
// EXPAND nurodymas + hard rule on toxicity structurizing.
export const RAG_PRIORITY_INSTRUCTION = `
=== RAG CONTEXT — VERIFIED FACTS (FOUNDATION + EXPAND) ===

You will receive VERIFIED FACTS below from our scraped plant database
(AHS Encyclopedia, Beckett, Cheng "House Plant Journal", PFAF, ASPCA,
Wikipedia, lt-names dictionary).

YOUR ROLE: USE RAG AS FOUNDATION, THEN EXPAND.
RAG facts are the verified core — but plant detail pages need RICH content.
A 1-sentence Beckett intro is NOT enough. EXPAND with botanical knowledge:
history, etymology, ecological role, geographic context, cultural significance,
horticultural details. Mark uncertain extensions with „tikriausiai" / „galimai".

HIERARCHY (in priority order):
  1. RAG VERIFIED FACTS (below)        ← never contradict; always include
  2. Your botanical knowledge           ← EXPAND on RAG, fill gaps, add context
  3. If conflict, cite RAG, mark memory inference as „tikriausiai"

FIELD-LEVEL RULES:

📝 APRASYMAS — Minimum 3-5 sakiniai LIETUVIŠKAI.
  • Foundation: RAG taxonomy + family + origin
  • EXPAND: morphology, ekologinis kontekstas, history of cultivation,
    distinctive features, kultūrinė reikšmė.
  • NEPAKANKA tiesiog išversti Beckett 1-sakinio intro.

⚠️ SAVYBES.PAVOJAI[] — HARD RULE:
  • IF RAG turi ASPCA "Toxic to: X" → savybes.pavojai[] PRIVALO turėti entry
    per target (tipas:"toksiskas", target:"gyvunams", severity, detales).
  • IF RAG turi PFAF "knownHazards" textą su žodžiais toxic/poison/hazard →
    savybes.pavojai[] PRIVALO turėti bent vieną entry (severity iš mechanism:
    "death/fatal" → stiprus, "nausea/burning" → vidutinis, "irritation" → silpnas).
  • NEPRALEISI šio lauko užpildymo. Tas yra projekto primary value —
    vartotojas paliks gyvūną namuose pasitikėdamas mūsų info.

✨ IDOMYBES[] — Minimum 2-3 items LIETUVIŠKAI.
  • Naudok RAG facts kaip seed, ekspand'ink su:
    geographic origin specifics, taxonomic history (kas atrado, when,
    nepatvirtinta etymology), cultural/medicinal traditional uses,
    ekologiniai aspektai (kas dargina, ką dauginasi).

🌱 PRIEZIURA — RAG'as duoda PFAF cultivation prose. Strukturizuok į:
  • prieziura: 4 narrative LT field'ai (sviesa, laistymas, temperatura, dregme)
  • sviesa.lygis: žema/vidutinė/ryški + ppfd range jei žinai
  • vanduo.lygis: mažai/vidutiniškai/daug
  • laistymasIntervalas.vasara/ziema: number iš PFAF moisture/USDA hardiness

🦴 VAISTINIS / VALGOMUMAS — Iš PFAF edibility/medicinal ratings + uses.
  • Jei rating > 0 → pildyk statusas, naudojama, detales.
  • Jei rating = 0 ar nėra info → statusas: "none", tuščia.

🩹 FIRST-AID — NIEKADA negeneruok dosing'o ar treatment'o.
  • Toxic plants → savybes.pavojingumas.detales gali paminėti "konsultuokitės
    su veterinaru ar Pet Poison Helpline" su pridedamais external sources URLs
    (žiūrėk =EXTERNAL SOURCES= sekciją žemiau).
`
