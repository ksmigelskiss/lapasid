/**
 * plantPromptConfig — Anthropic tool + system prompt for plant_details (Phase 2).
 *
 * VAIDMUO: vienintelis source-of-truth, share'inamas tarp client'o ir server'io.
 *   • Client'as (SearchModal.jsx fetchDetails) — re-export'ina šituos exports,
 *     kad legacy import'ai `import { TOOL_DETAILS } from '../components/SearchModal'`
 *     ir toliau veiktų be touch'o.
 *   • Server'is (api/save-plant.js processPlant Step 4) — import'ina tiesiogiai
 *     iš šito file'o, kad nereikia bundle'inti SearchModal'io (UI) į Vercel
 *     Function'o deploy bundle'ą.
 *
 * KODĖL EXTRACT'INTA:
 *   Pirmą bandymą (Variant B Step 3) extrakcija buvo, BET tame committe
 *   palikta `_UNUSED_OLD_TOOL_DETAILS` ir `_UNUSED_OLD_PLANT_SYSTEM`
 *   commented-out dead code SearchModal.jsx'e — įtariam, kad tas dead
 *   code paveikė Vite tree shaking'ą ir prisidėjo prie production
 *   regression'o (kartu su dataLoader.js dynamic URL bug'u). Šitas
 *   retake'as PILNAI pašalina senas declaration'us per Edit (ne komentaras).
 *
 * CONTENT IS IDENTICAL su SearchModal'io ankstesnėmis declaration'omis —
 * jokios behavior'inės pakeitimas, tik file location'o pakeitimas.
 *
 * Kaip pakeisti prompt'ą:
 *   • Edit'ink čia. Klientas + serveris gauna update'ą iškart.
 *   • NEKURK dvi copies. Jei reikia naujo tool'o (e.g. TOOL_BULK_SERIES
 *     admin flow'ui kuris dabar lieka SearchModal'yje) — galim
 *     persikelti čia kai server'iui taip pat prireiks.
 */

// ── Phase 2: full details (care, watering, problems, etc.) ────────
export const TOOL_DETAILS = {
  name: 'plant_details',
  description: 'Pateik PILNĄ augalo info save\'ui — care, savybes, įdomybės, šviesa/vanduo lygmenys. All human-readable fields in Lithuanian.',
  input_schema: {
    type: 'object',
    properties: {
      // ── ABOUT THE PLANT (description) ────────────────────────
      // Bug fix: anksciau aprasymas nebūdavo TOOL_DETAILS schema'oj, todėl
      // jei baseResult'as turėjo Wikipedia EN extract'ą (LT versija
      // neegzistuoja arba nepasiekta — pvz. Lavandula angustifolia LT Wiki
      // indeksuoja per „Tikrosios levandos", ne Latin name'ą), EN tekstas
      // passthrough'indavosi į catalog + user plant. Dabar AI privalo
      // grąžinti LT versiją — verčia EN→LT verbatim arba sukuria iš
      // savo žinių jei RAG'e nieko nėra.
      aprasymas: {
        type: 'string',
        description: 'Bendras augalo aprasymas LIETUVISKAI, 3-5 sakiniai. RAG context turi Wikipedia turini (LT arba EN) — naudok ji kaip FAKTU saltini, BET rasyk SAVO ZODZIAIS pagal VOICE_PERSONA „Sodininkas" friend stilius (ziur. sistemos prompte). NETIESIOG VERSI Wikipedia teksto — paimk faktus ir perskazuok kaip lietuvis sodininkas pasakotu draugui. Botaniniai terminai PAPRASTESNE versija jei techniniai: „daugiametis zolinis augalas" ne „rhizomatous perennial"; „lapai" ne „undivided leaves with sheathing stalks"; „zydi smulkiomis geliu kekemis" ne „three-petalled flowers with staminodes". NIEKADA negrazinti EN. Apie GENUS-level augala (e.g. Maranta kaip gentis), ne apie konkretu kultivara.',
      },

      // ── ORIGIN ────────────────────────────────────────────────
      // Step 6o — pre-DB AHS origin field'as yra EN (e.g. „Tropical America").
      // Anksciau šis EN string'as patekdavo į catalog kaip kilme. AI Phase 2
      // dabar verčia į LT iš RAG context'o (origin yra įtraukta į RAG).
      kilme: {
        type: 'string',
        description: 'Augalo kilme LIETUVISKAI, 1-3 sakiniai. RAG turi origin field (EN, e.g. „Tropical America" arba ilgesni botanikos tekstas) — naudok kaip FAKTU saltini, BET rasyk SAVO ZODZIAIS VOICE_PERSONA stiliumi. Pateik regionus, ekologini kontekta jei zinai („auga Brazilijos Atograzu misku paklotese, kur silta ir dregna", ne „naturally grows in clump-forming perennials"). NIEKADA negrazinti EN.',
      },

      // ── LT VERNACULAR NAMES ──────────────────────────────────
      // Step 6o — kai AI žino LT folk names (e.g. Maranta → „Maldos augalas"),
      // pridėk čia kaip array. Server merge'ina į plant.sinonimai šalia
      // baseResult.sinonimai (iš iNat/Wiki). Anksciau AI minėdavo folk names
      // idomybes sekcijoje — dabar struktūruotai į sinonimus.
      ltSynonyms: {
        type: 'array',
        items: { type: 'string' },
        description: 'LT folk/vernacular names jei zinai (e.g. Maranta -> ["Maldos augalas"], Crassula -> ["Pinigu medis"]). Tik PRIDEK names cia, nedubliuok jei jie jau yra zinomi rusies (ziur. RAG ltName). Tuscias array OK kai folk name nezinai. NESVARSTYK descriptors (e.g. „zolinis augalas") kaip names.',
      },

      // ── PRIMARY LT NAME (species-qualified, 2026-05-25 fix) ───
      // PRIES: lt-names.json turi tik GENUS-level entries (visi Dracaena
      // species gauna „Dracena", visi Begonia gauna „Begonija"). User'is
      // mato library'ėj dvi „Dracena" korteles (marginata + trifasciata),
      // nedidelės skirtingo iš tikrųjų rūšies.
      //
      // PO: Phase 2 AI generuoja species-qualified LT name pagal LT
      // botanikos konvenciją (gaspadorius pavyzdžiai: 83 multi-word
      // entries — „Aspidistra aukštoji", „Begonija aukštoji", „Ajeras
      // viksvinis", „Chrizantema indinė", „Cirtomis pjautuviškasis").
      // Tas override'ina baseResult.lietuviškas (genus-only Phase 1 fallback).
      lietuviskas: {
        type: 'string',
        description: 'LT vardas (overrides genus-only Phase 1 fallback). Logika: jei latinName yra GENUS-level (vienas zodis, e.g. Maranta) - grazink genus LT name (Maranta). Jei SPECIES-level (du zodziai, e.g. Dracaena trifasciata) - privalomai generuok species-qualified LT name pagal LT botanikos konvencija: arba [Genus LT] [adjective species qualifier] (gaspadorius pavyzdziai: Aspidistra aukstoji, Begonija aukstoji, Ajeras viksvinis, Chrizantema indine, Cirtomis pjautuviskasis), arba [Adjective] [genus LT] (Trijuoste dracena, Marginatoji dracena). JEI nezinai LT species adjective - naudok Latin epithet kaip qualifier: Dracena trifasciata. NIEKADA negrazink tik genus name (e.g. Dracena) kai latinName yra species-level - tas sukuria identicnas etiketes skirtingoms rusims.',
      },

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
        minItems: 0,
        maxItems: 4,
        description: 'Array of 0-4 fun facts in Lithuanian. Acceptable categories: history (verifiable persons/dates), etymology (cited or well-known sources), ecological role, cultural significance (well-documented folklore), unusual biology, geographic origin story, traditional uses (medicine/food with literature backing). NEVER fabricate specific claims — do NOT invent etymology like „vardas kilo iš X" without a real source, do NOT attribute fake historical episodes, do NOT cite imaginary scientific studies. If uncertain about a specific fact — return empty array [] (perfectly acceptable, much better than invented content). When including folklore that may be apocryphal — hedge with „pasakojama, kad..." or „anekdotinė istorija mini...". REAL verifiable facts (e.g. NASA Clean Air Study 1989 confirmed plants, named botanists like Joseph Dieffenbach, traditional medicinal uses documented in pharmacopoeia) are ENCOURAGED.',
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

      // ── auginimas (kategorija — 2026-05-24, task #37) ────────
      // KRITISKAI: rusinio lygio kategorija, NE per-augalui auginimo vieta.
      // Sansevieria visada „kambarinis" (nepriklauso ar augintojas turi
      // ji viduje ar balkone vasara). Berzas visada „laukinis".
      //
      // Default'as 300 batch'ams = „kambarinis" (mes apsirubezijom).
      // AI Phase 2 turi grazinti tinkama vert'e pagal augalo realybe —
      // override default jei matomi sodo / laukinis signal'ai.
      //
      // Naudojama Phase 1 classifier'iui (task #33) — gate'a kambarinis-only
      // search'ui ir future sodo/laukinis pipeline'ams.
      auginimas: {
        type: 'string',
        enum: ['kambarinis', 'sodo', 'laukinis'],
        description: 'Augalo RUSINE kategorija (NE auginimo vieta). kambarinis=tropic/subtropic rūšis, gyvena viduje (Sansevieria, Monstera, Spathiphyllum, Aloe). sodo=ornamentinis arba produktyvus sodo augalas (rožės, bijūnai, daržoves, vaistažoles, dekoratyviniai krūmai). laukinis=LT pievų/miškų rūšis (beržas, pakalnutė, ramunė). Per kuratą 300 batch — visi kambarinis defaults; pasirinkti kita TIK jei RAG signalas akivaizdus.',
      },

      // ── infoConfidence (computed patikimumas — 2026-05-24) ────
      // Bendras Phase 2 output patikimumas. Specialist'ui flag'as:
      // aukstas → spot-check 5-10%; vidutinis → reviewable subset;
      // zemas → kritiska peržiūra reikalinga (toxicity claims!).
      //
      // AI computes pagal RAG source agreement:
      //   • Wiki EN extract found + Pre-DB has genus + (PFAF or ASPCA) + LT name high → aukstas
      //   • 2-3 sources confirm, AI fill genus-level → vidutinis
      //   • 0-1 source agreement, dauguma AI generated → zemas
      infoConfidence: {
        type: 'string',
        enum: ['aukstas', 'vidutinis', 'zemas'],
        description: 'Bendras šio augalo info patikimumas (computed pagal RAG source agreement). aukstas=visi pagrindiniai laukai patvirtinti per multi-source RAG (pre-db Beckett/Cheng + PFAF + ASPCA jei pavojinga + Wiki + LT name high conf). vidutinis=2-3 sources confirm, kai kurie laukai AI fill iš genus-level knowledge be specific RAG support. zemas=0-1 source agreement, dauguma AI generated be RAG verification — TOXICITY claims šitam kategorijoj turi būti specialist re-verified. UI rodys badge.',
      },
    },
    required: ['laistymasIntervalas', 'tresimas', 'dormancyInfo', 'prieziura',
               'substratas', 'persodinimas', 'ziemojimas', 'dauginimas', 'problemos',
               'sviesa', 'vanduo', 'tipas', 'augimo_greitis', 'sunkumas', 'idomybes', 'savybes',
               'aprasymas', 'kilme', 'auginimas', 'infoConfidence', 'lietuviskas'],
               // ltSynonyms NEEINA į required — tuščias array OK kai nežinai folk name'o
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

TRADE NAMES / UNQUOTED CULTIVARS: when the query is a commercial trade
name or an unquoted cultivar you recognize (NOT a real wild species
epithet), NORMALIZE latinName to proper quoted cultivar form and set
matchLevel: „cultivar":
  ✓ „Alocasia regal shield"  → „Alocasia 'Regal Shield'"  (cultivar)
  ✓ „Philodendron birkin"    → „Philodendron 'Birkin'"    (cultivar)
  ✓ „Monstera thai constellation" → „Monstera 'Thai Constellation'"
Do NOT treat the second word as a species epithet when it is actually a
capitalized cultivar/trade name (there is no species „Alocasia regal").
If you cannot confirm the cultivar, fall back to the species/genus per
the ladder above — never invent a fake species epithet.

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
