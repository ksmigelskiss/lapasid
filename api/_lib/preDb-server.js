/**
 * Server-side pre-DB lookup — MIRROR of src/utils/preDb.js.
 *
 * BEHAVIORAL CONTRACT — IDENTIŠKAS client'o variantui:
 *   • genusKey() — TIKSLIAI tas pats UPPERCASE'inimas + first-word
 *   • speciesKey() — TIKSLIAI tas pats cultivar strip + species epithet
 *   • lookupGenus / lookupSpecies / lookupPlant — same shape, same null semantics
 *
 * KAS SKIRIASI nuo client'o:
 *   • Vietoj `fetch(new URL('../../data/pre-db.json', import.meta.url))`
 *     naudoja `loadJson('pre-db.json')` iš dataLoader-server.js (fs.readFile).
 *
 * Jei pakeisti reikia logikos (case normalization, species parser ir t.t.) —
 * MODIFY BOTH FILES kartu, kitaip search'as duos skirtingus rezultatus
 * client'o ir server'io flow'uose.
 */
import { loadJson } from './dataLoader-server.js'

async function loadPreDb() {
  return loadJson('pre-db.json')
}

/** MIRROR src/utils/preDb.js genusKey(). */
function genusKey(name) {
  if (!name) return null
  return name.trim().split(/\s+/)[0].toUpperCase()
}

/** MIRROR src/utils/preDb.js speciesKey(). */
function speciesKey(latinName) {
  if (!latinName) return null
  const cleaned = latinName.trim().replace(/\s*['"`'][^'"`']*['"`'].*$/, '').trim()
  const parts = cleaned.split(/\s+/)
  if (parts.length < 2) return null
  return parts[1].replace(/[,.]$/, '')
}

/** MIRROR src/utils/preDb.js hasGenus(). */
export async function hasGenusServer(genusName) {
  const db = await loadPreDb()
  return genusKey(genusName) in db.genera
}

/** MIRROR src/utils/preDb.js lookupGenus(). */
export async function lookupGenusServer(genusName) {
  const db = await loadPreDb()
  const key = genusKey(genusName)
  return db.genera[key] ?? null
}

/** MIRROR src/utils/preDb.js lookupSpecies(). */
export async function lookupSpeciesServer(genusOrLatin, species = null) {
  const db = await loadPreDb()
  const gkey = genusKey(genusOrLatin)
  const skey = species ?? speciesKey(genusOrLatin)
  if (!skey) return null
  const genus = db.genera[gkey]
  if (!genus) return null
  return genus.species[skey] ?? null
}

/** MIRROR src/utils/preDb.js lookupPlant(). */
export async function lookupPlantServer(latinName) {
  const genus = await lookupGenusServer(latinName)
  if (!genus) return null
  const sp = await lookupSpeciesServer(latinName)
  return {
    genus,
    species: sp,
    latinName,
    hasSpeciesData: !!sp,
  }
}

/** MIRROR src/utils/preDb.js getRawDb() — for advanced consumers. */
export async function getRawDbServer() {
  return await loadPreDb()
}
