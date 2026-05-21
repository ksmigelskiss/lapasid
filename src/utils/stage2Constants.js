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
// authoritative source, ne AI memory. Tas yra Stage 2 RAG sukimuko esmė —
// AI rolė pakeičiama iš „generate from knowledge" į „structure verified facts".
export const RAG_PRIORITY_INSTRUCTION = `
=== RAG CONTEXT — VERIFIED FACTS (PRIORITY OVER MEMORY) ===

You will receive VERIFIED FACTS below from our scraped plant database
(AHS Encyclopedia, Beckett, Cheng "House Plant Journal", PFAF, ASPCA,
Wikipedia, lt-names dictionary).

HIERARCHY (in priority order):
  1. RAG VERIFIED FACTS (below)        ← always prefer
  2. Your botanical knowledge           ← only when RAG silent
  3. Cross-reference                    ← if conflict, cite RAG, mark
                                          memory inference as „tikriausiai"

RULES:
  • Do NOT contradict RAG facts. If you "remember" something different,
    defer to RAG and skip your version.
  • USE RAG facts directly — translate to Lithuanian, restructure into
    schema, but do NOT invent new claims that contradict RAG.
  • TOXICITY: prioritize ASPCA + PFAF knownHazards verbatim. Never
    paraphrase poison mechanism — quote source exactly.
  • If RAG is silent on a field — you MAY use general botanical
    knowledge BUT mark uncertain claims with „tikriausiai" / „galimai".
  • For first-aid advice — refer to external vet links (see below),
    NEVER generate dosage or treatment.
`
