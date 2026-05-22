/**
 * pre-db.json wrapper — runtime plant registry lookup.
 *
 * Loads `data/pre-db.json` lazily (first call), caches in module scope.
 *
 * USAGE:
 *   import { lookupGenus, lookupSpecies, hasGenus } from './preDb'
 *
 *   const monstera = await lookupGenus('Monstera')
 *   // → { genus, family, species, chengProfile, inSources, ... }
 *
 *   const deliciosa = await lookupSpecies('Monstera', 'deliciosa')
 *   // → { latinName, synonyms, zones, dimensions, sources, ... }
 *
 * INTEGRATION NOTES:
 *   - pre-db.json yra 7.6 MB. Pirmas load'as ~200-500ms.
 *   - Po load'o visi lookup'ai = instant (in-memory Map).
 *   - SearchModal turi laukti async lookupGenus() prieš AI Phase 1 sprendimą.
 *
 * SHAPE iš data/pre-db.json:
 *   {
 *     genera: {
 *       "MONSTERA": {
 *         genus: "MONSTERA",
 *         family: "ARACEAE",
 *         familySource: "ahs",
 *         commonName: "Monstera",
 *         commonNameSource: "cheng",
 *         origin: "Tropical America",
 *         kind: "evergreen root climbers",
 *         inSources: ["ahs", "beckett", "cheng"],
 *         species: {
 *           "deliciosa": { latinName, synonyms, zones, dimensions, sources }
 *         },
 *         speciesCount: 6,
 *         chengProfile: { survivalStrategy, growthStrategy, ... }   // optional
 *       }
 *     }
 *   }
 */

let preDbCache = null
let loadPromise = null

/**
 * Lazy-load data/pre-db.json. Called automatically by lookup functions.
 * Returns the parsed JSON object. Cached after first call.
 */
async function loadPreDb() {
  if (preDbCache) return preDbCache
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    // Vite/webpack will bundle this as static asset
    // Path is relative to project root via ?url import
    const url = new URL('../../data/pre-db.json', import.meta.url)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to load pre-db.json: HTTP ${res.status}`)
    const data = await res.json()
    preDbCache = data
    return data
  })()
  return loadPromise
}

/**
 * Normalize genus name to pre-DB key format (UPPERCASE).
 *   "Monstera" → "MONSTERA"
 *   "monstera" → "MONSTERA"
 *   "monstera deliciosa" → "MONSTERA"  (takes first word)
 */
function genusKey(name) {
  if (!name) return null
  return name.trim().split(/\s+/)[0].toUpperCase()
}

/**
 * Extract species epithet from Latin binomial.
 *   "Monstera deliciosa" → "deliciosa"
 *   "Pilea peperomioides" → "peperomioides"
 *   "Monstera" → null  (genus only)
 *   "Monstera deliciosa 'Variegata'" → "deliciosa"  (strips cultivar)
 */
function speciesKey(latinName) {
  if (!latinName) return null
  const cleaned = latinName.trim().replace(/\s*['"`'][^'"`']*['"`'].*$/, '').trim()
  const parts = cleaned.split(/\s+/)
  if (parts.length < 2) return null
  // Skip rank markers (var., subsp., etc.) — return base species
  return parts[1].replace(/[,.]$/, '')
}

// ── Public API ───────────────────────────────────────────────

/**
 * Check if a genus exists in pre-DB (case-insensitive).
 */
export async function hasGenus(genusName) {
  const db = await loadPreDb()
  return genusKey(genusName) in db.genera
}

/**
 * Lookup genus by name. Returns full genus entry or null.
 *   - inSources[], speciesCount, species{}, chengProfile?
 */
export async function lookupGenus(genusName) {
  const db = await loadPreDb()
  const key = genusKey(genusName)
  return db.genera[key] ?? null
}

/**
 * Lookup species within a genus.
 *   lookupSpecies('Monstera', 'deliciosa') → species entry
 *   lookupSpecies('Monstera deliciosa') → same (auto-parses)
 */
export async function lookupSpecies(genusOrLatin, species = null) {
  const db = await loadPreDb()
  const gkey = genusKey(genusOrLatin)
  const skey = species ?? speciesKey(genusOrLatin)
  if (!skey) return null
  const genus = db.genera[gkey]
  if (!genus) return null
  return genus.species[skey] ?? null
}

/**
 * Get full plant info combining genus + species lookups.
 * Returns { genus, species, latinName } merged structure.
 */
export async function lookupPlant(latinName) {
  const genus = await lookupGenus(latinName)
  if (!genus) return null
  const sp = await lookupSpecies(latinName)
  return {
    genus,
    species: sp,
    latinName,
    hasSpeciesData: !!sp,
  }
}

/**
 * List all genera. Useful for debug/admin tools, NOT for runtime search
 * (returns 1655 entries).
 */
export async function listAllGenera() {
  const db = await loadPreDb()
  return Object.keys(db.genera)
}

/**
 * Stats — for debug/admin.
 */
export async function getStats() {
  const db = await loadPreDb()
  return db.stats
}

/**
 * Direct access to underlying data for advanced consumers.
 * NOTE: returned object is the cached parsed JSON — DO NOT MUTATE.
 */
export async function getRawDb() {
  return await loadPreDb()
}
