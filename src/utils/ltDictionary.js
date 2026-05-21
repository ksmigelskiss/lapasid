/**
 * LT name resolver — connects Lithuanian plant names ↔ Latin binomials.
 *
 * USAGE:
 *   import { resolveLt, resolveLatin, getAllLtForms } from './ltDictionary'
 *
 *   // User types "alijošius" → returns "Aloe" (Latin genus)
 *   const latin = await resolveLatin('alijošius')
 *
 *   // User types "Aloe" → returns "Alavijas" (canonical LT) + synonyms
 *   const lt = await resolveLt('Aloe')
 *   // → { ltName: 'Alavijas', ltSynonyms: ['alijošiumi'], confidence: 'high', sources: [...] }
 *
 * 4-TIER RESOLUTION (from data/lt-names.json built from 6 sources):
 *   1. EXACT match (case + diacritics)
 *   2. NORMALIZED match (strip diacritics, plural endings)
 *   3. SYNONYM match (search ltAllForms array)
 *   4. NULL (no LT name in our DB — caller falls back to AI translation)
 *
 * SCHEMA shape iš lt-names.json:
 *   {
 *     ltNames: {
 *       "Aloe": {
 *         latin: "Aloe",
 *         ltName: "Alavijas",
 *         ltSynonyms: ["alijošiumi"],
 *         ltAllForms: ["Alavijas", "alijošiumi"],
 *         ltFamily: "Asfodeliniai",
 *         sources: ["wiki", "plants", "inat"],
 *         confidence: "high",
 *         conflicts: null,
 *         wikiUrl: "...",
 *         wikidataId: "Q49654",
 *         inatTaxonId: 47126,
 *       }
 *     }
 *   }
 */

let ltCache = null
let normalizedReverseMap = null  // normalized_lt → latin
let loadPromise = null

async function loadLtNames() {
  if (ltCache) return ltCache
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    const url = new URL('../../data/lt-names.json', import.meta.url)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to load lt-names.json: HTTP ${res.status}`)
    ltCache = await res.json()
    return ltCache
  })()
  return loadPromise
}

/**
 * Normalize LT name for comparison (matches build-lt-names.mjs normalization).
 *   "Kraujažolės" → "kraujazole"  (strips diacritics + plural)
 *   "Alavijas"    → "alavija"      (strips -s ending)
 */
function normalizeForCompare(name) {
  if (!name) return ''
  let n = name.toLowerCase()
    .replace(/[āîī]/g, 'i')
    .replace(/ū/g, 'u')
    .replace(/[ąa]/g, 'a')
    .replace(/[ęe]/g, 'e')
    .replace(/[ėè]/g, 'e')
    .replace(/[čć]/g, 'c')
    .replace(/[šś]/g, 's')
    .replace(/[žź]/g, 'z')
    .replace(/\s+/g, '')
  n = n.replace(/(es|ai|iai|os)$/, m => {
    switch (m) {
      case 'es':  return 'e'
      case 'ai':  return 'a'
      case 'iai': return 'is'
      case 'os':  return 'a'
      default:    return m
    }
  })
  return n
}

/**
 * Build reverse map: normalized LT → Latin (cached on first call).
 * Used by `resolveLatin()` for LT-name-to-Latin lookups.
 */
async function getReverseMap() {
  if (normalizedReverseMap) return normalizedReverseMap
  const data = await loadLtNames()
  normalizedReverseMap = new Map()
  for (const [latin, entry] of Object.entries(data.ltNames)) {
    if (!entry.ltName) continue
    // Index canonical
    const canonNorm = normalizeForCompare(entry.ltName)
    if (canonNorm && !normalizedReverseMap.has(canonNorm)) {
      normalizedReverseMap.set(canonNorm, latin)
    }
    // Index synonyms
    for (const syn of (entry.ltSynonyms ?? [])) {
      const synNorm = normalizeForCompare(syn)
      if (synNorm && !normalizedReverseMap.has(synNorm)) {
        normalizedReverseMap.set(synNorm, latin)
      }
    }
  }
  return normalizedReverseMap
}

// ── Public API ────────────────────────────────────────────────

/**
 * Resolve Latin name → LT entry.
 * Returns { ltName, ltSynonyms, ltAllForms, confidence, sources, wikiUrl, wikidataId, inatTaxonId, conflicts }
 * Or null if no LT name in our DB.
 */
export async function resolveLt(latinName) {
  const data = await loadLtNames()
  if (!latinName) return null
  // Pre-DB index by genus form (e.g., "Aloe", not "ALOE" — properCased)
  const key = latinName.trim().split(/\s+/)[0]
  const properKey = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()
  const entry = data.ltNames[properKey]
  if (!entry || !entry.ltName) return null
  return {
    ltName: entry.ltName,
    ltSynonyms: entry.ltSynonyms ?? [],
    ltAllForms: entry.ltAllForms ?? [entry.ltName],
    ltFamily: entry.ltFamily ?? null,
    confidence: entry.confidence,
    sources: entry.sources ?? [],
    wikiUrl: entry.wikiUrl ?? null,
    wikidataId: entry.wikidataId ?? null,
    inatTaxonId: entry.inatTaxonId ?? null,
    conflicts: entry.conflicts ?? null,
  }
}

/**
 * Resolve LT name → Latin binomial.
 * Uses normalized comparison (diacritics + plural insensitive).
 * Returns Latin string or null.
 *
 *   resolveLatin('alijošius') → 'Aloe'
 *   resolveLatin('Alavijas')  → 'Aloe'
 *   resolveLatin('Kraujažolės') → 'Achillea'
 */
export async function resolveLatin(ltName) {
  if (!ltName) return null
  const reverse = await getReverseMap()
  const normalized = normalizeForCompare(ltName)
  return reverse.get(normalized) ?? null
}

/**
 * Check if a string is a known LT plant name (exact or normalized).
 */
export async function isKnownLtName(ltName) {
  const latin = await resolveLatin(ltName)
  return latin !== null
}

/**
 * Get all forms (canonical + synonyms) for a Latin name.
 * Used by UI for displaying all LT name variations.
 */
export async function getAllLtForms(latinName) {
  const entry = await resolveLt(latinName)
  return entry?.ltAllForms ?? []
}

/**
 * Stats — for debug/admin.
 */
export async function getLtStats() {
  const data = await loadLtNames()
  return data.stats
}
