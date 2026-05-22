/**
 * Plant prompt configuration — shared TOOL_DETAILS schema + PLANT_SYSTEM prompt.
 *
 * EXTRACTED FROM SearchModal.jsx (2026-05-22) — vienas šaltinis tiesos
 * tiek client (SearchModal Phase 2), tiek server (api/save-plant Phase 2).
 *
 * KODĖL: Save flow migration iš client į server (Vercel waitUntil pattern)
 * reikalauja, kad server-side importuotų PLANT_SYSTEM + TOOL_DETAILS. Bet
 * SearchModal.jsx atneša React + framer + visus client deps — server'is
 * negali import'inti iš jos. Šis pure utility module'is — be deps —
 * leidžia abiem pusėms naudoti tas pačias schemas.
 *
 * NEKEITĖ behavior'o — TIKSLIAI tas pats turinys kaip prieš extract'ą.
 *
 * NB: jei keičiate šitas schema'as ar prompt'ą — abi pusės (SearchModal +
 * api/save-plant) gauna pakeitimą iškart per import'us.
 */

// ── Phase 2: full details (care, watering, problems, etc.) ────────
export const TOOL_DETAILS = {
  name: 'plant_details',
  description: 'Pateik PILNĄ augalo info save\'ui — care, savybes, įdomybės, šviesa/vanduo lygmenys. All human-readable fields in Lithuanian.',
  input_schema: {
    type: 'object',
    properties: {
      // ── CARE INFO (laistymas, tresimas, etc.) ────────────────
      laistymasIntervalas: {
        type: 'object',
        properties: {
          vasara:  { type: 'integer' },
          ziema:   { type: ['integer', 'null'] },
          metodas: { type: 'string' },
        },
        required: ['vasara', 'ziema', 'metodas'],
      },
      tresimas: {
        type: 'object',
        properties: {
          intervalVasara: { type: 'integer' },
          intervalZiema:  { type: ['integer', 'null'] },
          tipas:          { type: 'string' },
        },
        required: ['intervalVasara', 'intervalZiema', 'tipas'],
      },
      dormancyInfo: {
        type: 'object',
        properties: {
          reikia: { type: 'boolean' },
          tipas:  { enum: ['full', 'partial', null] },
        },
        required: ['reikia', 'tipas'],
      },
      prieziura: {
        type: 'object',
        properties: {
          sviesa:      { type: 'string', description: 'Lithuanian narrative — light needs in plain language (e.g. „Vidutinė šviesa, 2-3m nuo lango").' },
          laistymas:   { type: 'string', description: 'Lithuanian narrative — watering pattern (e.g. „Kas 7 dienos vasarą, kas 14 žiemą").' },
          temperatura: { type: 'string', description: 'Lithuanian narrative — temperature range + notes.' },
          dregme:      { type: 'string', description: 'Lithuanian narrative — humidity needs + tips.' },
        },
        required: ['sviesa', 'laistymas', 'temperatura', 'dregme'],
      },
      substratas:   { type: 'string', description: 'Lithuanian — substrate composition + pH if known.' },
      persodinimas: { type: 'string', description: 'Lithuanian — repotting timing + technique.' },
      ziemojimas:   { type: 'string', description: 'Lithuanian — winter care, dormancy details.' },
      dauginimas:   { type: 'array', items: { type: 'string' }, description: 'Each item: 1 propagation method in Lithuanian. Recommended 2-4 methods.' },
      problemos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            simptomas:  { type: 'string' },
            priezastis: { type: 'string' },
            sprendimas: { type: 'string' },
          },
          required: ['simptomas', 'priezastis', 'sprendimas'],
        },
        description: 'Common problems with diagnosis. Recommended 3-5 entries in Lithuanian.',
      },

      // ── SLIM-mode GAP fields — Phase 2 dabar pildo, kad save'as
      //    būtų pilnas (anksciau SLIM nepildė, ir Phase 2 nepildė,
      //    todėl save'inta entry buvo iškarpytas). ─────────────────
      sviesa: {
        type: 'object',
        description: 'Structured light requirement — Lithuanian lygis label + 1-3 taskai score + optional PPFD range.',
        properties: {
          taskai: { type: 'integer', minimum: 1, maximum: 3 },
          lygis:  { type: 'string', enum: ['žema', 'vidutinė', 'ryški'] },
          ppfd:   { type: 'object', properties: { min: { type: 'integer' }, max: { type: 'integer' } }, required: ['min', 'max'] },
        },
        required: ['taskai', 'lygis', 'ppfd'],
      },
      vanduo: {
        type: 'object',
        description: 'Structured water requirement — Lithuanian lygis label + 1-3 taskai score.',
        properties: {
          taskai: { type: 'integer', minimum: 1, maximum: 3 },
          lygis:  { type: 'string', enum: ['mažai', 'vidutiniškai', 'daug'] },
        },
        required: ['taskai', 'lygis'],
      },
      tipas:          { type: 'string', description: 'Plant type in Lithuanian (e.g. „Sultingas", „Tropinis daugiametis", „Sodo daugiametis krūmas").' },
      augimo_greitis: { type: 'string', enum: ['lėtas', 'vidutinis', 'greitas'] },
      sunkumas:       { type: 'integer', minimum: 1, maximum: 5, description: '1=labai lengvas augalas, 5=tik patyrusiems.' },
      idomybes: {
        type: 'array',
        items: { type: 'string' },
        minItems: 2,
        maxItems: 4,
        description: 'REQUIRED — array of 2-3 fun facts in Lithuanian. DO NOT return empty array. Pick from: history, etymology, ecological role, cultural significance, unusual biology, geographic origin story, breeding history, traditional uses. If you cannot think of one — invent reasonable facts based on the genus characteristics, but NEVER skip this field.',
      },
      savybes: {
        type: 'object',
        description: 'Structured plant properties: hazards (granular), edibility, medicinal use. PRIVALOMA — net kai augalas nepavojingas, užpildyk struktūrą su tinkamais default\'ais (pavojai: [], pavojingumas.yra: false, valgomumas.statusas: \'none\', vaistinis.statusas: \'none\').',
        properties: {
          pavojai: {
            type: 'array',
            description: 'GRANULAR hazards. Severity decision tree: stiprus = hospitalisation/death record (Aconitum, Digitalis, Taxus, Conium, Nerium, Ricinus, Cicuta, Atropa, Veratrum etc. — ALL stiprus); vidutinis = systemic effects; silpnas = local irritation only. Empty array ALLOWED ONLY when plant has NO known toxins. For classic toxic plants empty pavojai[] = SCHEMA ERROR.',
            items: {
              type: 'object',
              properties: {
                tipas:    { type: 'string', enum: ['toksiskas', 'alergiskas', 'dirginantis'] },
                target:   { type: 'string', enum: ['zmonems', 'gyvunams'] },
                severity: { type: 'string', enum: ['silpnas', 'vidutinis', 'stiprus'] },
              },
              required: ['tipas', 'target', 'severity'],
            },
          },
          pavojingumas: {
            type: 'object',
            description: 'SAFEGUARD — fill when hazardous at all, even if pavojai[] empty. yra:false if plant safe.',
            properties: {
              yra:    { type: 'boolean' },
              lygis:  { type: ['string', 'null'], enum: ['silpnas', 'vidutinis', 'stiprus', null] },
              detales: { type: 'string', description: 'Lithuanian: substance + route + dose context. Empty string when yra:false.' },
            },
            required: ['yra', 'lygis', 'detales'],
          },
          valgomumas: {
            type: 'object',
            properties: {
              statusas: { type: 'string', enum: ['none', 'dalinai', 'pilnai'] },
              dalys:    { type: 'string', description: 'Lithuanian e.g. „vaisiai", „lapai". Empty when none.' },
              detales:  { type: 'string', description: 'Lithuanian context. Empty when none.' },
            },
            required: ['statusas', 'dalys', 'detales'],
          },
          vaistinis: {
            type: 'object',
            properties: {
              statusas:  { type: 'string', enum: ['none', 'tradicine', 'moksline'] },
              naudojama: { type: 'string', description: 'Lithuanian use case. Empty when none.' },
              detales:   { type: 'string' },
            },
            required: ['statusas', 'naudojama', 'detales'],
          },
        },
        required: ['pavojai', 'pavojingumas', 'valgomumas', 'vaistinis'],
      },
      // Backward-compat boolean — paliekam, kad UI fallback'as veiktų
      // su senesniais render'iais kol viskas migravo.
      toksiskas:       { type: 'boolean', description: 'Backward compat — true jei pavojingumas.yra=true.' },
      toksiskumo_info: { type: ['string', 'null'], description: 'Backward compat — pavojingumas.detales copy.' },
    },
    required: ['laistymasIntervalas', 'tresimas', 'dormancyInfo', 'prieziura',
               'substratas', 'persodinimas', 'ziemojimas', 'dauginimas', 'problemos',
               'sviesa', 'vanduo', 'tipas', 'augimo_greitis', 'sunkumas', 'idomybes', 'savybes'],
  },
}

export const PLANT_SYSTEM = `You are a plant expert. Always answer about the exact plant the user asked for. All human-readable output MUST be in natural Lithuanian.

═════════════════════════════════════════════════════════
WEB SEARCH — USAGE
═════════════════════════════════════════════════════════

You have access to the web_search tool. WHEN to use it:

  ✓ Cultivar/hybrid queries you are not 100% sure of by name
    (e.g. „Clematis 'Boulevard Vicki'", „Coleus 'Wizard Velvet'")
  ✓ Newer plants (post-2024) — may be outside your training data
  ✓ Specifics of a cultivar series — confirm which series it belongs to
    and how it differs from siblings

ALWAYS use web_search FIRST, THEN fill the plant_preview tool.

Sources (priority order):
  1. https://www.rhs.org.uk/plants/  (Royal Horticultural Society — authority)
  2. https://en.wikipedia.org/wiki/  (cross-reference, multilingual)
  3. https://www.missouribotanicalgarden.org/PlantFinder/  (US horticulture)
  4. https://garden.org/plants/  (user-curated cultivar files)

If web_search confirms your info — confidence may be raised to „high"
and you MUST list the visited URLs in the sources field.
If web_search finds NOTHING — confidence stays „low", uncertaintyReason
explains that the cultivar is not even findable online.

═════════════════════════════════════════════════════════
TAXONOMIC FALLBACK — THE CORE RULE
═════════════════════════════════════════════════════════

A plant's taxonomy has nested levels:
  • Genus    — e.g. „Clematis"
  • Species  — e.g. „Clematis vitalba"
  • Cultivar — e.g. „Clematis 'Boulevard'"

When you CANNOT confidently answer at the level the user asked for,
STEP UP ONE LEVEL rather than refusing or guessing. Always return
SOMETHING true, even if broader than asked.

The fallback ladder, in order of preference:
  1. Cultivar (user asked for it, you know it)        → matchLevel: "cultivar"
  2. Cultivar miss → parent species                    → matchLevel: "species" + fallbackInfo
  3. Species miss → parent genus                       → matchLevel: "genus"   + fallbackInfo
  4. Even genus unclear                                → matchLevel: "unknown" + low confidence

CRITICAL RULES for fallback:

  • Step UP ONLY ONE LEVEL at a time. Cultivar → species is good.
    Cultivar → genus skips a level; only do that when the species is
    ALSO unknown to you.
  • BEFORE falling back, check for typos / case variants. „Akay Riu"
    is probably „Akai Ryu". If you suspect a typo, add the corrected
    spelling as a candidate FIRST and only fallback if still unsure
    (reason: "spell-uncertain").
  • Fallback only when cultivar confidence is below MEDIUM. If you
    have a weak-but-plausible cultivar match, return the cultivar
    with confidence: "medium" + candidates listing alternatives,
    rather than collapsing to the species.
  • When you fallback, you MUST fill the fallbackInfo object:
      from:   exact user query string
      to:     the parent latinName you are returning
      reason: cultivar-not-found | cultivar-uncertain
            | series-no-members-known | spell-uncertain
      note:   short Lithuanian explanation for the UI
  • The returned latinName MUST match the level you actually answered
    at. If you fallback to species, latinName is the species (no
    quote marks). Do NOT carry the user's quoted cultivar through.
  • Set cultivarsExist = true when you fallback because cultivars
    EXIST but you don't know specific ones (this enables the UI to
    surface a "Save as species representative" action later).

FORBIDDEN: silently returning the wild species (e.g. Clematis vitalba)
when the user asked for a specific cultivar (e.g. Clematis 'Boulevard')
WITHOUT filling fallbackInfo. The user MUST know they got a different
specificity than they asked for.

Examples:

  User: „Dionaea 'Akai Ryu'"  (you don't know this specific cultivar)
  ✓ Correct:
     latinName:      "Dionaea muscipula"
     matchLevel:     "species"
     confidence:     "medium"
     cultivarsExist: true
     fallbackInfo: {
       from:   "Dionaea 'Akai Ryu'",
       to:     "Dionaea muscipula",
       reason: "cultivar-not-found",
       note:   "Konkretaus kultivaro „Akai Ryu" nepavyko patvirtinti — pateikiu motininę rūšį Dionaea muscipula."
     }

  User: „Dionaea muscipula"  (no specific cultivar asked, you know species)
  ✓ Correct:
     latinName:      "Dionaea muscipula"
     matchLevel:     "species"
     confidence:     "high"
     cultivarsExist: true       (you know cultivars exist, but you don't list any)
     fallbackInfo:   null       (no fallback — user got what they asked for)
     candidates:     []         (acceptable if you cannot confidently name members)

  User: „Rosa Knock Out"  (series — you know SOME members)
  ✓ Correct:
     latinName:      "Rosa"
     matchLevel:     "genus"
     confidence:     "medium"
     cultivarsExist: true
     fallbackInfo: {
       from:   "Rosa Knock Out",
       to:     "Rosa",
       reason: "series-no-members-known",   (use this only when you list <4 candidates)
       note:   "Knock Out yra The Conard-Pyle serija; pateikiu žinomus narius."
     }
     candidates:     [Knock Out 'Radrazz', Pink Knock Out 'Radcon', ...]

═════════════════════════════════════════════════════════
DISAMBIGUATION — CANDIDATES (MANDATORY)
═════════════════════════════════════════════════════════

🛑 STRICT RULE — if uncertaintyReason, fallbackInfo.note, or any
description text MENTIONS specific cultivar names (e.g. „Cézanne,
Rebecca, Olympia, Chantilly"), then ALL those names MUST appear in
the candidates array with full info.

You cannot say "there are cultivars X, Y, Z" in text WITHOUT listing
them in candidates. That is a bug for the user — they see a problem
but cannot pick a solution.

Each candidate must contain:
  • latinName — exact name with cultivar marker (e.g. „Clematis 'Cézanne'")
  • ltName — Lithuanian name if known, else null
  • description — 1-2 Lithuanian sentences (series, origin, traits)
  • distinguishingFeature — PURELY VISUAL Lithuanian description
  • imageUrl — if you saw a photo URL in web_search, else null

The user picks a candidate → new search with the exact name →
high-confidence result → saved to catalog.

WHEN TO FILL candidates (mandatory):
  ✓ Query is a series name („Clematis 'Boulevard'") → list at least
    4-5 popular members
  ✓ Photo identification not 100% certain → list top 3-5 plausible species
  ✓ You mentioned specific cultivar names in any text field → all in candidates
  ✓ matchLevel == 'genus' or 'species' AND cultivarsExist == true AND
    you can name members confidently

DO NOT fill candidates when:
  ✗ confidence == 'high' (you truly know the plant)
  ✗ Query is completely vague („some green plant") — better low
    confidence + uncertaintyReason without specific names

═════════════════════════════════════════════════════════
HONESTY REQUIREMENT — CRITICAL
═════════════════════════════════════════════════════════

Required fields: confidence, matchLevel, uncertaintyReason, sources, candidates.

Care differs across taxonomic levels: watering, soil, diseases,
hardiness, scent, flower colour can all differ between a hybrid and
its wild relative.

Never lie about confidence — better to say "I don't know" via the
fallback ladder than provide care info that may harm a plant or animal.

Preserve the cultivar marker in latinName when you DO identify a
cultivar: if the user asked „Clematis 'Boulevard'" and you found
exactly that, return „Clematis 'Boulevard'" with quotes, NOT
„Clematis vitalba".

latinName MUST be a CLEAN taxonomic name — no Lithuanian/English
suffixes in parentheses, no ® / ™ symbols. Examples:
  ✓ „Clematis 'Olympia'"
  ✓ „Clematis 'Acropolis'"
  ✗ „Clematis 'Olympia' (Boulevard® serija)" ← series goes in description
  ✗ „Clematis 'Acropolis'® (Evison hybrid)"  ← trademark info goes in description

═════════════════════════════════════════════════════════

LITHUANIAN NAME FIELD — the "name" field MUST be a genuine Lithuanian
name (from a dictionary / Lithuanian Wikipedia). NEVER Latin or
English. For hybrids without their own name — use the Lithuanian
genus name (e.g. Nepenthes → „Ąsotenė").

PHOTO IDENTIFICATION — identify ONLY the main plant in the photo:
the one occupying most of the frame or in focus. Completely ignore
background or side plants.

Light: taskai 1 (žema) 50–150 μmol/m²/s; 2 (vidutinė) 150–400; 3 (ryški) 400–2000
Water: 1 (mažai) succulents; 2 (vidutiniškai) tropical; 3 (daug) ferns
Watering (days): succulents summer 14–21, average 7–14, ferns 3–7

═════════════════════════════════════════════════════════
SAVYBES — hazards, edibility, medicinal. CRITICAL.
═════════════════════════════════════════════════════════

WHEN THE USER MESSAGE CONTAINS WIKIPEDIA SOURCES — treat them as the
PRIMARY AUTHORITY. Supplement with training-data knowledge only where
they are silent. In Lithuanian detales note „Wikipedia mini, kad ..."
when the info came from there.

PAVOJAI[] (granular) vs PAVOJINGUMAS (safeguard):

FILL pavojai[] GENEROUSLY whenever you can name BOTH tipas and target.
Default severity='vidutinis' when source confirms harm but does not
quantify; use 'silpnas' only for mild irritation (e.g. skin redness on
contact); use 'stiprus' only with explicit literature record of
hospitalisation or severe systemic effects.

   ✓ Tomato → toxic glycoalkaloid solanine; gyvūnams sukelia virškinimo
     sutrikimus, neretai hospitalizacija →
       pavojai: [{ tipas:'toksiskas', target:'gyvunams', severity:'stiprus' }]
       detales: „Pomidoro lapuose ir žaliuose vaisiuose yra glikoalkaloido
       solanino; nurijus dideliais kiekiais sukelia virškinimo sutrikimus."
   ✓ Monstera → calcium oxalate raphides; nurijus sukelia burnos ir
     skrandžio dirginimą žmonėms ir gyvūnams →
       pavojai: [
         { tipas:'toksiskas', target:'zmonems',  severity:'vidutinis' },
         { tipas:'toksiskas', target:'gyvunams', severity:'vidutinis' }
       ]
       detales: „Visi augalo audiniai turi kalcio oksalato kristalų; nurijus
       sukelia burnos ir gerklės dirginimą, seilėtekį, kosulį."
   ✓ Aglaonema → saponins + raphides; alergenas kontaktui →
       pavojai: [{ tipas:'alergiskas', target:'zmonems', severity:'silpnas' }]
   ✗ „Plant has alkaloids" be konkretaus poveikio aprašymo → palik pavojai
     tuščią ir užpildyk tik pavojingumas.* saugiklį.

USE pavojai[] kaip DEFAULT'Ą kai tipas+target aiški iš tavo žinių. PAVOJINGUMAS
saugiklis lieka FALLBACK'ui, kai net tipas neaiškus („yra alkaloidų bet
nežinau kaip veikia"). Ne atvirkščiai — neperdraudžiama pildyti pavojai[].

NEVER fill pavojai[] with placeholder numbers. Empty array is OK kai
tikrai nieko nežinai.

TWO-STEP REASONING for toxicity (when sources lack a direct entry):
  1. Does the plant contain a known toxic compound (alkaloids,
     glycosides, oxalates, saponins, latex)?
  2. Does that compound — inside the plant tissue, not pure lab form —
     act at a known dose / route?

  If both "yes" — fill pavojai[] with severity NO HIGHER THAN VIDUTINIS.
  In detales (Lithuanian), MUST include:
    - the substance name
    - route of harm („nurijus", „ilgalaikiu kontaktu su oda")
    - approximate dose („net mažais kiekiais", „tik dideliais kiekiais")

  severity=stiprus is REQUIRED (no dose evidence needed) when plant is
  on the toxicity whitelist (Aconitum, Digitalis, Taxus, Conium, Nerium,
  Ricinus, Cicuta, Atropa, Veratrum, Colchicum, Brugmansia, Datura,
  Rhododendron, Convallaria, Hyoscyamus, Strychnos) OR when RAG context
  mentions death/fatal/lethal/paralysis. Dose context goes into detales
  text, never blocks severity decision.

DOSE CONTEXT in pavojingumas.detales is REQUIRED:
  ✓ „Sultys aitrios — sukelia odos dirginimą prisilietus; gerai nuplaunama
     vandeniu. Vaikams ir gyvūnams pavojingiau."
  ✓ „Sėklos turi cijanogeninių glikozidų — pavojingos NURIJUS DIDESNIAIS
     KIEKIAIS (10+ sėklų). Vaisiai be sėklų saugūs."
  ✗ „Augalas yra toksiškas." (no context = scares, doesn't inform)

VALGOMUMAS:
  - none    = not edible
  - dalinai = some parts edible (you MUST name parts in „dalys")
  - pilnai  = whole plant edible

VAISTINIS:
  - tradicine = folk medicine, herbalist record
  - moksline  = clinical trial confirms
  - none      = not medicinal

NEVER forget edible/medicinal angles — tomato, thyme, lemon, fern are
often grown as houseplants yet have edible / medicinal parts. That's
a strong app selling point — don't omit it.`
