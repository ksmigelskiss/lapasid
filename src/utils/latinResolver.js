/**
 * Latin synonyms reverse-search index.
 *
 * Sprendžia taxonomy migration problemą: jei vartotojas paieško senų pavadinimų
 * (Sansevieria trifasciata, Pothos aureus, Philodendron scandens), mums reikia
 * automatiškai redirect'inti į CURRENT accepted name (Dracaena trifasciata,
 * Epipremnum aureum, Philodendron hederaceum).
 *
 * USAGE:
 *   import { resolveCanonical, isObsoleteName } from './latinResolver'
 *
 *   const canonical = await resolveCanonical('Sansevieria trifasciata')
 *   // → 'Dracaena trifasciata' (if reverse map has it)
 *
 *   if (await isObsoleteName('Pothos aureus')) {
 *     showRedirectBadge('Modernus pavadinimas: Epipremnum aureum')
 *   }
 *
 * SCHEMA iš data/latin-synonyms-reverse.json:
 *   {
 *     reverseMap: {
 *       "Sansevieria trifasciata": {
 *         canonical: "Dracaena trifasciata",
 *         sources: ["pfaf-latinSynonyms"]
 *       }
 *     }
 *   }
 */

let cache = null
let loadPromise = null

async function loadReverseMap() {
  if (cache) return cache
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    const url = new URL('../../data/latin-synonyms-reverse.json', import.meta.url)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to load latin-synonyms-reverse.json: HTTP ${res.status}`)
    cache = await res.json()
    return cache
  })()
  return loadPromise
}

// ── Public API ───────────────────────────────────────────────

/**
 * Resolve potentially-obsolete Latin name to current canonical.
 * Returns canonical name (or original if not obsolete).
 *
 *   resolveCanonical('Sansevieria trifasciata') → 'Dracaena trifasciata'
 *   resolveCanonical('Aloe vera') → 'Aloe vera'  (already canonical)
 *   resolveCanonical('Made up name') → 'Made up name'  (unknown, pass-through)
 */
export async function resolveCanonical(latinName) {
  if (!latinName) return latinName
  const data = await loadReverseMap()
  const entry = data.reverseMap?.[latinName]
  return entry?.canonical ?? latinName
}

/**
 * Check if a Latin name is in our reverse map as obsolete.
 * Returns true if there's a known canonical form different from input.
 */
export async function isObsoleteName(latinName) {
  if (!latinName) return false
  const data = await loadReverseMap()
  const entry = data.reverseMap?.[latinName]
  return !!entry && entry.canonical !== latinName
}

/**
 * Get reclassification info for UI display.
 *   getReclassification('Sansevieria trifasciata')
 *   → { obsolete: 'Sansevieria trifasciata', canonical: 'Dracaena trifasciata', sources: ['pfaf-latinSynonyms'] }
 */
export async function getReclassification(latinName) {
  if (!latinName) return null
  const data = await loadReverseMap()
  const entry = data.reverseMap?.[latinName]
  if (!entry || entry.canonical === latinName) return null
  return {
    obsolete: latinName,
    canonical: entry.canonical,
    sources: entry.sources ?? [],
  }
}
