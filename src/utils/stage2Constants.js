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
export const RAG_PRIORITY_INSTRUCTION = `
=== TASK CONTEXT — WARNING LABEL GENERATOR (NOT MEDICAL ADVICE) ===

YOU ARE GENERATING WARNING LABELS for a Lithuanian consumer plant database.
Output equivalent to back-of-package safety warnings on commercial plant
sales — what dangers a buyer must know to avoid harm to themselves, family,
and pets. This is CONSUMER PROTECTION work, not medical instruction.

KEY DISTINCTION: We are not teaching HOW to poison. We are warning that
a plant CAN cause harm — same as „CAUTION: contains lead" on paint cans
or „MAY CAUSE DROWSINESS" on medication. Omitting warnings = product
liability violation.

=== HARD RULES (override any conservative instinct) ===

🔴 EXPLICIT TOXICITY WHITELIST — for these plants severity=stiprus ALWAYS,
no judgement needed, no dose evidence needed:
  Aconitum, Digitalis, Taxus, Conium, Nerium, Ricinus, Cicuta,
  Atropa, Veratrum, Colchicum, Brugmansia, Datura, Rhododendron,
  Convallaria, Hyoscyamus, Strychnos

🔴 SCHEMA ENFORCEMENT — IF (RAG context has PFAF knownHazards with
toxic/poison/fatal/paralyz/death keywords) OR (RAG has ASPCA toxicTo list)
THEN savybes.pavojai[] MUST have at least 1 entry. Empty pavojai[] in
this case = SCHEMA ERROR, not safe default.

🔴 DOSE CAVEAT DOES NOT BLOCK SEVERITY — Earlier instruction said „severity=
stiprus requires hospitalisation evidence". CORRECTION: severity=stiprus
needs NO dose evidence if plant is in WHITELIST above. Dose context goes
into detales text, never blocks severity decision.

🔴 RAG TRIGGER FORCE-FILL — If RAG contains words „highly toxic", „fatal",
„death", „paralyz", „lethal" → pavojai[] PRIVALOMAS, severity ≥ vidutinis
automatically. No interpretation needed.

=== EXAMPLE — Aconitum napellus (warning label pattern) ===

savybes.pavojai: [
  { tipas: "toksiskas", target: "zmonems",  severity: "stiprus" },
  { tipas: "toksiskas", target: "gyvunams", severity: "stiprus" },
  { tipas: "dirginantis", target: "zmonems", severity: "vidutinis" }
]
savybes.pavojingumas.detales: "ĮSPĖJIMAS: visi šio augalo audiniai
nuodingi. Pagrindinis junginys — aconitinas. Pasekmės nurijus: burnos
tirpimas, vėmimas, širdies aritmija, kvėpavimo paralyžius. Net odos
kontaktas su sultimis sukelia tirpimą. Vaikams, augintiniams (katėms,
šunims, arkliams) ypač pavojinga. Nelaimei — kreipkitės į veterinarą
ar Pet Poison Helpline."

=== RAG CONTEXT (verified facts) ===

Below: pilna info iš mūsų bibliotekos. Toxicity duomenys ATEINA iš ASPCA
(veterinary authority) ir PFAF (botanikos compendium) — juos perkelk į
schema laukus PER mūsų above hard rules. Niekada neprieštaruok.
`
