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

import { parseLatinName } from './latinName.js'

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

let speciesLtCache = null
let speciesLoadPromise = null
async function loadSpeciesLt() {
  if (speciesLtCache) return speciesLtCache
  if (speciesLoadPromise) return speciesLoadPromise
  speciesLoadPromise = (async () => {
    try {
      const url = new URL('../../data/species-lt-names.json', import.meta.url)
      const res = await fetch(url)
      speciesLtCache = res.ok ? await res.json() : {}
    } catch { speciesLtCache = {} }
    return speciesLtCache
  })()
  return speciesLoadPromise
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
  if (!latinName) return null
  const data = await loadLtNames()
  const words = latinName.trim().split(/\s+/)
  const genusKey = words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase()
  const genusEntry = data.ltNames[genusKey] ?? null

  // SPECIES-FIRST (2026-05-29): species-lygio LT vardas (plants.json →
  // species-lt-names.json) PRIEŠ genties fallback'ą. Sprendžia genus-fallback
  // name bug'ą (cultivar/rūšis gaudavo genties vardą).
  if (words.length >= 2) {
    const sp = await loadSpeciesLt()
    const spName = sp[latinName.trim().toLowerCase()]
                ?? sp[words.slice(0, 2).join(' ').toLowerCase()]
                ?? null
    if (spName) {
      return {
        ltName: spName,
        ltSynonyms: [],
        ltAllForms: [spName],
        ltFamily: genusEntry?.ltFamily ?? null,
        confidence: 'high',
        sources: ['plants-species'],
        wikiUrl: genusEntry?.wikiUrl ?? null,
        wikidataId: null,
        inatTaxonId: null,
        conflicts: null,
      }
    }
  }

  // Genus fallback (esamas elgesys)
  if (!genusEntry || !genusEntry.ltName) return null

  // SPECIES-QUALIFIED genus fallback (2026-05-30): kai užklausa yra
  // species-level (du žodžiai), bet konkreti species nėra species-lt-names.json'e,
  // konstruojam „[genus LT] [latin epithet]" formą vietoj bare genus name.
  // Sprendžia bug'ą, kuriame „Sansevieria zeylanica" → tik „Sansevjera"
  // (vartotojas mato genties vardą be species qualifier'io).
  //
  // Pavyzdys:
  //   query: „Sansevieria zeylanica"
  //   genus DB: „sansevjera"
  //   result: „Sansevjera zeylanica" (NOT just „Sansevjera")
  //
  // Confidence laikom mid — nes species LT name'as nėra validuotas (gali būti
  // istorinis ar netiksli forma), tik genus + epithet konkatenacija.
  let ltName = genusEntry.ltName
  let speciesQualified = false
  if (words.length >= 2) {
    // 2026-06-01 — parseLatinName proper'ly handles cultivar quotes
    // (multi-word: 'Orange Star', 'White Joy' etc.). Mano ankstesnis naive
    // words[1] split lūždavo ant multi-word cultivars („Aglaonema 'Orange
    // Star'" → words = ["Aglaonema","'Orange","Star'"] → losing both
    // structure + close quote detection).
    const parsed = parseLatinName(latinName)
    if (parsed.cultivar) {
      // Cultivar epithet — ICNCP notation su single-quotes. Preserve original
      // capitalization (ne lowercase): 'White Joy', 'Orange Star', 'Davana'.
      ltName = `${genusEntry.ltName} '${parsed.cultivar}'`
      speciesQualified = true
    } else if (parsed.species) {
      // Species epithet — be quotes, lowercase.
      const epithet = parsed.species.toLowerCase()
      if (!genusEntry.ltName.toLowerCase().includes(epithet)) {
        ltName = `${genusEntry.ltName} ${epithet}`
        speciesQualified = true
      }
    }
  }

  // ltAllForms — kai species-qualified, NEnaudojam genusEntry.ltAllForms,
  // nes tas array'us (per lt-names.json data quality issue) gali turėti
  // related-species ar related-genus pavadinimus (e.g. Sansevieria genus
  // turi „Sansevjera trijuostė" — kuri yra trifasciata species, ne zeylanica).
  // Inkliuduojant juos čia, vartotojas matytų KLAIDINGUS synonimų chip'us.
  // Žiūr. task #37 dėl lt-names.json source audit'o.
  const allForms = speciesQualified
    ? [...new Set([ltName, genusEntry.ltName])]   // tik 2 forms: constructed + genus
    : (genusEntry.ltAllForms ?? [genusEntry.ltName])

  return {
    ltName,
    ltSynonyms: genusEntry.ltSynonyms ?? [],
    ltAllForms: allForms,
    ltFamily: genusEntry.ltFamily ?? null,
    confidence: genusEntry.confidence,
    sources: speciesQualified
      ? [...(genusEntry.sources ?? []), 'genus-fallback-qualified']
      : (genusEntry.sources ?? []),
    wikiUrl: genusEntry.wikiUrl ?? null,
    wikidataId: genusEntry.wikidataId ?? null,
    inatTaxonId: genusEntry.inatTaxonId ?? null,
    conflicts: genusEntry.conflicts ?? null,
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
