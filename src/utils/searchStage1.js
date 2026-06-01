/**
 * Stage 1 — Pre-DB powered slim preview lookup.
 *
 * VAIDMUO: Greitas, deterministic pre-DB lookup, kuris paverčia user'io
 * užklausą („Monstera", „alijošius", „Filodendras") į slim plant preview be
 * AI/web cost. Tai PIRMASIS žingsnis search chain'e:
 *
 *   1. localStorage catalog cache check     (esama, ~5ms)
 *   2. Firestore catalog/{docId} check       (esama, ~100ms)
 *   3. searchStage1() — THIS (pre-DB)        (~5ms, $0)
 *   4. previewParallelFetch (Wiki+iNat)      (~200-500ms, $0)  ← jei pre-DB miss
 *   5. AI TOOL_PREVIEW                        (esama, paskutinis fallback)
 *
 * Anksčiau buvo planuota 4-layer architecture (Layer 2 mikro AI, Layer 3 web
 * search, Layer 4 full AI fallback) — bet po architektūros peržiūros tas
 * sluoksnis paskirstytas tarp `previewParallelFetch.js` (external augmentation)
 * ir esamų SearchModal AI Phase 1/2 (RAG-grounded). Šis modulis lieka TIK
 * Layer 1 = deterministic pre-DB lookup.
 *
 * USAGE:
 *   import { searchStage1 } from './searchStage1'
 *
 *   const result = await searchStage1(userQuery)
 *   if (result.found) {
 *     // slim preview gatavas — toxicity, family, LT vardas, kilmė
 *     showSlim(result)
 *   } else {
 *     // pre-DB miss → caller paleidžia previewParallelFetch + AI fallback
 *     fallbackToExternal(userQuery)
 *   }
 *
 * RESULT shape (jei found):
 *   {
 *     latin: "Monstera deliciosa",
 *     lietuviškas: "Monstera",
 *     ltSynonyms: ["Monstera nuostabioji"],
 *     family: "ARACEAE",
 *     toxicityStatus: 'toxic'|'safe'|'unknown',
 *     toxicity: { toxicTo:[], severity, ... } | null,
 *     hasChengProfile: bool,
 *     sources: { family, lietuviškas, toxicity, ... },
 *     dbSources: ['ahs', 'pfaf', ...],
 *     reclassification: {...} | null,
 *     layer: 'db',
 *     elapsedMs, confidence, ...
 *   }
 */

import { lookupGenus, lookupPlant } from './preDb.js'
import { resolveLt, resolveLatin } from './ltDictionary.js'
import { resolveCanonical, getReclassification } from './latinResolver.js'

// Lazy-load ASPCA genus map (built from build-aspca-genus-map.mjs)
let aspcaMapCache = null
async function getAspcaMap() {
  if (aspcaMapCache) return aspcaMapCache
  try {
    const url = new URL('../../data/aspca-genus-map.json', import.meta.url)
    const res = await fetch(url)
    if (!res.ok) return {}
    const data = await res.json()
    aspcaMapCache = data.toxicityByGenus ?? {}
    return aspcaMapCache
  } catch {
    return {}
  }
}

// ── Helpers ───────────────────────────────────────────────────

/**
 * Parse user input — figure out if it's Latin or LT name.
 *   "Monstera" → { type: 'latin', latin: 'Monstera', genus: 'Monstera' }
 *   "Monstera deliciosa" → { type: 'latin', latin: 'Monstera deliciosa', genus: 'Monstera' }
 *   "monstera" → { type: 'latin', latin: 'Monstera' }  (auto-capitalize)
 *   "alijošius" → { type: 'lt', ltName: 'alijošius' }
 *   "Pinigų medis" → { type: 'lt', ltName: 'Pinigų medis' }
 *
 * Heuristics:
 *   - Has LT diacritics → LT
 *   - Capitalized first letter + ascii only + ≤2 words → likely Latin
 *   - Lowercase + ascii → ambiguous, try Latin first
 */
async function classifyQuery(query) {
  const trimmed = query.trim()
  if (!trimmed) return { type: 'empty' }

  const hasLtDiacritics = /[ąęįųėčšž]/i.test(trimmed)
  if (hasLtDiacritics) {
    // 2026-06-01 — hybrid detection (1/2): LT vernacular su diacritic'ais +
    // Latin epithet (e.g. „Trijuostė sansevjera marginata" arba „kinrožė
    // chinensis"). Be šio fix'o LT path tikrindavo TIK full ltName reverse
    // lookup — neradus bandydavo AI Phase 2. Dabar splitint'inam į genus+rest
    // ir bandom rekonstruoti Latin binomial.
    const reconstructed = await tryHybridLtPlusLatin(trimmed)
    if (reconstructed) {
      return { type: 'latin', latin: reconstructed, genus: reconstructed.split(/\s+/)[0] }
    }
    return { type: 'lt', ltName: trimmed }
  }

  // ASCII only — could be Latin OR LT vernacular without diacritics (e.g.
  // „sansevjera trifasciata", „kinroze chinensis"). Phase 1 miss-class'ina šitas
  // kaip Latin („Sansevjera trifasciata"), pre-DB miss'ina genus → AI Phase 2.
  // Hybrid detection (2/2): bandom matchint pirmajam žodžiui kaip LT vernacular
  // PRIEŠ classify'inti kaip Latin.
  const words = trimmed.split(/\s+/)
  if (words.length === 2) {
    const reconstructed = await tryHybridLtPlusLatin(trimmed)
    if (reconstructed) {
      return { type: 'latin', latin: reconstructed, genus: reconstructed.split(/\s+/)[0] }
    }
  }

  const looksLatin = /^[A-Z][a-z]+$/.test(words[0]) || /^[a-z]+$/.test(words[0])
  if (looksLatin) {
    // Auto-capitalize: "monstera" → "Monstera"
    const properCased = words.map((w, i) =>
      i === 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
              : w.toLowerCase()
    ).join(' ')
    return {
      type: 'latin',
      latin: properCased,
      genus: properCased.split(/\s+/)[0],
    }
  }

  // Unknown — try as LT first
  return { type: 'lt', ltName: trimmed }
}

/**
 * Hybrid LT vernacular + Latin epithet reconstructor.
 *
 * Bando: pirmasis žodis = LT vernacular (e.g. „sansevjera", „kinrožė").
 *         antrasis žodis = Latin epithet (a-z only) (e.g. „trifasciata").
 * Jei abu pasiteisina → grąžina rekonstruotą Latin binomial („Sansevieria
 * trifasciata"). Kitu atveju null.
 *
 * Naudoja resolveLatin reverse lookup'ą — diacritic+plural insensitive.
 */
async function tryHybridLtPlusLatin(query) {
  const words = query.trim().split(/\s+/)
  if (words.length !== 2) return null
  const epithet = words[1].toLowerCase()
  // Latin epithet pattern — striktai a-z (no diacritics, no caps, single token)
  if (!/^[a-z]+$/.test(epithet)) return null
  const latinGenus = await resolveLatin(words[0])
  if (!latinGenus) return null
  // Single-word Latin genus expected (e.g. "Sansevieria"). Skip if multi.
  if (/\s/.test(latinGenus)) return null
  return `${latinGenus} ${epithet}`
}

// ── Main Stage 1 search ──────────────────────────────────────

/**
 * Stage 1 search — returns slim plant info using 4-layer fallback.
 *
 * @param {string} userQuery
 * @returns {Promise<SearchStage1Result>}
 */
export async function searchStage1(userQuery) {
  const startTime = Date.now()
  const parsed = await classifyQuery(userQuery)

  if (parsed.type === 'empty') {
    return { found: false, error: 'empty query', layer: null }
  }

  // ── LAYER 1: DB lookup ─────────────────────────────────────
  //
  // TRY-ORIGINAL-FIRST pattern (2026-05-25 fix):
  // PRIES: code'as pirma resolveCanonical'ino (Sansevieria trifasciata →
  // Dracaena trifasciata), tada lookupPlant. BET pre-DB Dracaena.species
  // NETURI trifasciata entry'o (Beckett 1993 dar nematė 2017 migration'o),
  // tai gauni genus-level fallback su WRONG species content (e.g. marginata
  // description'as patenka).
  //
  // PO: try original FIRST — jei pre-DB turi „Sansevieria trifasciata"
  // species (TURI — su rich Beckett content), naudoji ją. Tik jei
  // original neturi SPECIES level (plant.species == null), bandai canonical.
  // RAG layer'yje (buildPlantRagContext) jau wire'inta tas pats pattern'as.
  let latin = null
  let plant = null
  let ltEntry = null
  let reclass = null
  let ltMatchedFrom = null  // 'direct' | 'reverse' | 'reclassified' | null

  if (parsed.type === 'latin') {
    // Step 1: try ORIGINAL latin (pre-canonical). Jei pre-DB turi species —
    // naudojam jį (rich content from legacy taxonomy).
    plant = await lookupPlant(parsed.latin)
    ltEntry = await resolveLt(parsed.latin)
    reclass = await getReclassification(parsed.latin)

    if (plant?.species) {
      // Original has species-level content — naudojam su reclass note (jei yra)
      latin = parsed.latin
      ltMatchedFrom = reclass ? 'reclassified-with-original-content' : 'direct'
    } else {
      // Original neturi species (arba neturi genus). Bandyk canonical.
      const canonical = await resolveCanonical(parsed.latin)
      if (canonical !== parsed.latin) {
        const canonPlant = await lookupPlant(canonical)
        if (canonPlant?.genus) {
          plant = canonPlant
          ltEntry = await resolveLt(canonical)
          latin = canonical
          ltMatchedFrom = 'reclassified'
        } else {
          // Net canonical neradom — palikt original latin, gausim genus-only
          // arba pre-DB miss path'ą
          latin = parsed.latin
          ltMatchedFrom = 'direct'
        }
      } else {
        latin = parsed.latin
        ltMatchedFrom = 'direct'
      }
    }
  } else if (parsed.type === 'lt') {
    // Reverse lookup: LT → Latin
    const resolved = await resolveLatin(parsed.ltName)
    if (resolved) {
      latin = resolved
      plant = await lookupPlant(latin)
      ltEntry = await resolveLt(latin)
      reclass = await getReclassification(latin)
      ltMatchedFrom = 'reverse'
    }
  }

  if (plant?.genus) {
    // Genus-only fallback guard: jei pre-DB rado TIK gentį (plant.species == null),
    // o užklausa nurodė daugiau nei gentį (rūšies/cultivar token'ai, pvz.
    // „Alocasia regal shield"), tai NĖRA patikima identifikacija — tik genus
    // fallback'as. Grąžinus jį kaip hit'ą, SearchModal praleidžia AI ir įrašo
    // genus-vardu („Alokazija") pažymėtą entry su neapdorotu multi-word latin'u
    // → dublikatai katalogE (kelios „Alokazija" skirtingiems cultivar'ams).
    // Vietoj to — krentam į db-miss → AI identifikuoja + normalizuoja cultivar'ą
    // (atstato numatytą „naujas augalas → Phase 2 → global biblioteka" srautą).
    const latinWordCount = (latin ?? '').trim().split(/\s+/).filter(Boolean).length
    const genusOnlyButQuerySpecific = !plant.species && latinWordCount > 1
    if (!genusOnlyButQuerySpecific) {
      const aspcaMap = await getAspcaMap()
      const toxicity = aspcaMap[plant.genus.genus] ?? null
      return buildSlimResult({
        latin,
        plant,
        ltEntry,
        reclass,
        toxicity,
        layer: 'db',
        elapsedMs: Date.now() - startTime,
        userQuery,
        ltMatchedFrom,
      })
    }
    // genus-only-but-specific → db-miss → AI fallback. `genusKnown` signalas:
    // gentis YRA realus augalas (pre-DB), tad SearchModal NETURI blokuoti per
    // Wikidata plant gate'ą (garbled species/cultivar vardas vis tiek = augalas;
    // AI identifikuoja realų — seller-name fallback). Be šito gate'as blokuoja
    // „Sansevieria aubrytiana nite lite" tipo užklausas PRIEŠ AI.
    return {
      found: false,
      layer: 'db-miss-genus-known',
      elapsedMs: Date.now() - startTime,
      userQuery,
      parsedQuery: parsed,
      genusKnown: true,
      genus: plant.genus.genus,
      note: 'Genus known, species/cultivar not — route to AI, skip plant gate.',
    }
  }

  // ── FALLBACK: jei Latin lookup miss'ino ir input ASCII (klasifikatorius
  // galėjo klaidingai pavadinti LT name kaip Latin) — retry as LT reverse lookup.
  // Sprendžia case'us: "Alavijas", "Filodendras", "Pinigų medis" (no diacritics).
  if (parsed.type === 'latin') {
    const reverseResolved = await resolveLatin(parsed.latin)
    if (reverseResolved) {
      const plant = await lookupPlant(reverseResolved)
      const ltEntry = await resolveLt(reverseResolved)
      if (plant?.genus) {
        const aspcaMap = await getAspcaMap()
        const toxicity = aspcaMap[plant.genus.genus] ?? null
        return buildSlimResult({
          latin: reverseResolved,
          plant,
          ltEntry,
          reclass: null,
          toxicity,
          layer: 'db',
          elapsedMs: Date.now() - startTime,
          userQuery,
          ltMatchedFrom: 'reverse-fallback',
        })
      }
    }
  }

  // ── PRE-DB MISS ─────────────────────────────────────────────
  // Visi pre-DB keliai išbandyti (Latin direct, reclassification,
  // LT reverse, ASCII LT fallback). Augalo nėra mūsų bibliotekoj.
  //
  // Caller'is paleidžia next chain step:
  //   • previewParallelFetch(userQuery)  — Wiki+iNat lookup
  //   • Jei vis dar miss → AI TOOL_PREVIEW
  return {
    found: false,
    layer: 'db-miss',
    elapsedMs: Date.now() - startTime,
    userQuery,
    parsedQuery: parsed,
    note: 'No pre-DB match. Caller: previewParallelFetch → AI fallback.',
  }
}

// ── Result builder ───────────────────────────────────────────

function buildSlimResult({ latin, plant, ltEntry, reclass, toxicity, layer, elapsedMs, userQuery, ltMatchedFrom }) {
  const sources = {}

  // Identity
  if (plant.genus.familySource) sources.family = plant.genus.familySource
  if (ltEntry?.sources) sources.lietuviškas = ltEntry.sources.join('+')
  if (toxicity) sources.toxicity = 'aspca-' + toxicity.confidence

  // Build toxicity badge for UI
  // 3 states: toxic / safe-confirmed / unknown
  let toxicityStatus = 'unknown'
  let toxicityDisplay = null
  if (toxicity) {
    toxicityStatus = 'toxic'
    toxicityDisplay = {
      isToxic: true,
      toxicTo: toxicity.toxicTo,
      severity: toxicity.confidence === 'high' ? 'verified' : 'likely',
      sourceCount: toxicity.matchedEntries.length,
      detailUrl: toxicity.matchedEntries[0]?.detailUrl,
    }
  }
  // TODO: when PFAF finishes, also check pfaf.knownHazards as secondary source
  // and `safe-confirmed` when PFAF explicitly says non-toxic

  return {
    found: true,
    layer,
    elapsedMs,
    confidence: ltEntry?.confidence ?? 'mid',
    aiCalled: false,
    webSearchCalled: false,

    // Core identity
    latin,
    lotyniskas: latin,
    lietuviškas: ltEntry?.ltName ?? null,
    ltSynonyms: ltEntry?.ltAllForms ?? [],
    family: plant.genus.family,

    // Pre-DB facts (slim)
    origin: plant.genus.origin ?? null,
    kind: plant.genus.kind ?? null,
    speciesCount: plant.genus.speciesCount ?? 0,

    // Toxicity (NEW — for slim preview warning)
    toxicityStatus,       // 'toxic' | 'safe' | 'unknown'
    toxicity: toxicityDisplay,

    // Cheng premium flag (if applicable)
    hasChengProfile: !!plant.genus.chengProfile,

    // Sources used
    sources,
    dbSources: plant.genus.inSources ?? [],
    ltSourcesList: ltEntry?.sources ?? [],

    // Reclassification notice for UI
    reclassification: reclass,
    ltMatchedFrom,

    // Original user query for telemetry
    userQuery,

    // Pointer to full enrichment in Stage 2
    needsStage2: true,
  }
}
