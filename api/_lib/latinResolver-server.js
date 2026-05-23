/**
 * Server-side Latin synonyms reverse-search — MIRROR src/utils/latinResolver.js.
 *
 * VAIDMUO: išspręsti taxonomy migration problemą RAG kontekste. Kai user'is
 * search'ina seną pavadinimą (Sansevieria trifasciata, Saintpaulia ionantha),
 * mūsų pre-DB content gulasi po modern names'u (Dracaena trifasciata,
 * Streptocarpus ionanthus). Reverse map'as redirect'ina lookup'us automatiškai.
 *
 * BEHAVIORAL CONTRACT — IDENTIŠKAS client'o variantui (src/utils/latinResolver.js).
 *
 * KAS SKIRIASI nuo client'o:
 *   • loadJson() iš dataLoader-server.js vietoj fetch'o
 *   • Module-level cache (Fluid Compute function instance reuse)
 */
import { loadJson } from './dataLoader-server.js'

let cache = null
let loadPromise = null

async function loadReverseMap() {
  if (cache) return cache
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    cache = await loadJson('latin-synonyms-reverse.json')
    return cache
  })()
  return loadPromise
}

/** MIRROR src/utils/latinResolver.js resolveCanonical(). */
export async function resolveCanonicalServer(latinName) {
  if (!latinName) return latinName
  try {
    const data = await loadReverseMap()
    const entry = data.reverseMap?.[latinName]
    return entry?.canonical ?? latinName
  } catch (e) {
    console.warn('[latinResolver-server] reverse map unavailable:', e?.message)
    return latinName
  }
}

/** MIRROR src/utils/latinResolver.js isObsoleteName(). */
export async function isObsoleteNameServer(latinName) {
  if (!latinName) return false
  try {
    const data = await loadReverseMap()
    const entry = data.reverseMap?.[latinName]
    return !!entry && entry.canonical !== latinName
  } catch { return false }
}

/** MIRROR src/utils/latinResolver.js getReclassification(). */
export async function getReclassificationServer(latinName) {
  if (!latinName) return null
  try {
    const data = await loadReverseMap()
    const entry = data.reverseMap?.[latinName]
    if (!entry || entry.canonical === latinName) return null
    return {
      obsolete: latinName,
      canonical: entry.canonical,
      sources: entry.sources ?? [],
    }
  } catch { return null }
}
