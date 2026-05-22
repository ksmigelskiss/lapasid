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
function classifyQuery(query) {
  const trimmed = query.trim()
  if (!trimmed) return { type: 'empty' }

  const hasLtDiacritics = /[ąęįųėčšž]/i.test(trimmed)
  if (hasLtDiacritics) {
    return { type: 'lt', ltName: trimmed }
  }

  // ASCII only — could be Latin
  const words = trimmed.split(/\s+/)
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

// ── Main Stage 1 search ──────────────────────────────────────

/**
 * Stage 1 search — returns slim plant info using 4-layer fallback.
 *
 * @param {string} userQuery
 * @returns {Promise<SearchStage1Result>}
 */
export async function searchStage1(userQuery) {
  const startTime = Date.now()
  const parsed = classifyQuery(userQuery)

  if (parsed.type === 'empty') {
    return { found: false, error: 'empty query', layer: null }
  }

  // ── LAYER 1: DB lookup ─────────────────────────────────────
  let latin = null
  let ltMatchedFrom = null  // 'direct' | 'reverse' | null

  if (parsed.type === 'latin') {
    // Check if obsolete name → redirect
    const canonical = await resolveCanonical(parsed.latin)
    latin = canonical
    ltMatchedFrom = canonical !== parsed.latin ? 'reclassified' : 'direct'
  } else if (parsed.type === 'lt') {
    // Reverse lookup: LT → Latin
    const resolved = await resolveLatin(parsed.ltName)
    if (resolved) {
      latin = resolved
      ltMatchedFrom = 'reverse'
    }
  }

  if (latin) {
    // We have a Latin name — lookup in pre-DB
    const plant = await lookupPlant(latin)
    const ltEntry = await resolveLt(latin)
    const reclass = await getReclassification(parsed.latin || latin)

    if (plant?.genus) {
      // Successful DB hit
      const aspcaMap = await getAspcaMap()
      const toxicity = aspcaMap[plant.genus.genus] ?? null
      const result = buildSlimResult({
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
      return result
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
