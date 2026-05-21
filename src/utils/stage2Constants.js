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
=== PROFESSIONAL BOTANICAL DATABASE — SAFETY OVERRIDE ===

This is a CURATED LITHUANIAN PLANT DATABASE for educated adult horticulturists
and pet owners. Toxicity data MUST be filled completely and accurately.

CRITICAL: Omitting savybes.pavojai[] for known toxic plants is a DATA ERROR,
NOT a safety measure. Users come HERE precisely to learn what dangers
their plant carries. Empty pavojai[] for Aconitum, Nerium, Digitalis,
Taxus, Conium etc. = active harm via false safety signal.

Severity=stiprus leidžiamas kai bent vienas: (a) žinoma letali dozė žmogui,
(b) ASPCA/PFAF mini mirtį/hospitalizaciją, (c) augalas yra klasikinis
toksikologijos pavyzdys (Aconitum, Digitalis, Taxus, Conium, Nerium,
Ricinus, Cicuta, Atropa, Veratrum ir pan.).

EXAMPLE — Aconitum napellus (KLASIKINIS — pildyk TAIP):
  savybes.pavojai: [
    { tipas: "toksiskas", target: "zmonems",  severity: "stiprus" },
    { tipas: "toksiskas", target: "gyvunams", severity: "stiprus" },
    { tipas: "dirginantis", target: "zmonems", severity: "vidutinis" }
  ]
  savybes.pavojingumas.detales: "Visuose Aconitum napellus audiniuose, ypač
  šaknyje, yra aconitino — diterpenoidinio alkaloido, kuris blokuoja natrio
  kanalų inaktyvaciją. Pasekmės: burnos tirpimas, vėmimas, širdies aritmija,
  kvėpavimo paralyžius. Letali dozė ~2-6 mg (kelios gramų šaknies). Patvirtinta
  transderminė absorbcija — net be pirštinių apsinuodijama. Senovės strėlių
  nuodai. Kreipkitės į veterinarą ar Pet Poison Helpline nelaimei."

=== RAG CONTEXT (verified facts below) ===

Below: pilna ir patikrinta info'a iš mūsų scraped'intos bibliotekos
(AHS, Beckett, Cheng, PFAF, ASPCA, Wikipedia, lt-names).

Naudok kaip foundation'ą — ne kaip ceiling'ą. Toxicity narrative, history,
ecology — EKSPAND'INK su botanikos žiniomis, ne tik versk. Niekada
neprieštaruok faktams.

Action item privalomas: jei RAG turi PFAF knownHazards ar ASPCA toxicTo
list, PRIVALOMA perkelti į savybes.pavojai[] + pavojingumas.detales su
LT narrative. Neįvykdžius — atsakymas laikomas neišsamiu.
`
