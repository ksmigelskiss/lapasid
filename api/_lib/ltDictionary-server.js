/**
 * Server-side LT dictionary — MIRROR of src/utils/ltDictionary.js (resolveLt only).
 *
 * SCOPE: tik resolveLt (Latin → LT entry). Save flow'as nereikalauja
 * resolveLatin (reverse) — tas naudojamas tik client'o search input parsing'e.
 *
 * BEHAVIORAL CONTRACT — IDENTIŠKAS client'o variantui:
 *   • Pre-DB key normalization: properKey (capital first, rest lower)
 *   • Grąžinama struktūra: { ltName, ltSynonyms, ltAllForms, ltFamily,
 *     confidence, sources, wikiUrl, wikidataId, inatTaxonId, conflicts }
 *
 * KAS SKIRIASI nuo client'o:
 *   • `loadJson('lt-names.json')` vietoj `fetch(new URL(...))`
 *   • Reverse map / normalizeForCompare neimplementuojama (save flow'ui
 *     nereikia — pridėti kai prireiks)
 */
import { loadJson } from './dataLoader-server.js'

async function loadLtNames() {
  return loadJson('lt-names.json')
}
async function loadSpeciesLt() {
  try { return await loadJson('species-lt-names.json') } catch { return {} }
}

/** MIRROR src/utils/ltDictionary.js resolveLt() — Latin → LT entry.
 *  SPECIES-FIRST (2026-05-29): bando species-lygio LT vardą (plants.json →
 *  species-lt-names.json) PRIEŠ genties fallback'ą (lt-names.json). Sprendžia
 *  genus-fallback name bug'ą (cultivar/rūšis gaudavo genties vardą). */
export async function resolveLtServer(latinName) {
  if (!latinName) return null
  const data = await loadLtNames()
  const words = latinName.trim().split(/\s+/)
  const genusKey = words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase()
  const genusEntry = data.ltNames[genusKey] ?? null

  // Species-level lookup (multi-word latin): pilnas latin → genus+species.
  if (words.length >= 2) {
    const sp = await loadSpeciesLt()
    const spName = sp[latinName.trim().toLowerCase()]
                ?? sp[words.slice(0, 2).join(' ').toLowerCase()]
                ?? null
    if (spName) {
      return {
        ltName:      spName,
        ltSynonyms:  [],
        ltAllForms:  [spName],
        ltFamily:    genusEntry?.ltFamily ?? null,
        confidence:  'high',
        sources:     ['plants-species'],
        wikiUrl:     genusEntry?.wikiUrl ?? null,
        wikidataId:  null,
        inatTaxonId: null,
        conflicts:   null,
      }
    }
  }

  // Genus fallback (esamas elgesys)
  if (!genusEntry || !genusEntry.ltName) return null
  return {
    ltName:      genusEntry.ltName,
    ltSynonyms:  genusEntry.ltSynonyms ?? [],
    ltAllForms:  genusEntry.ltAllForms ?? [genusEntry.ltName],
    ltFamily:    genusEntry.ltFamily ?? null,
    confidence:  genusEntry.confidence,
    sources:     genusEntry.sources ?? [],
    wikiUrl:     genusEntry.wikiUrl ?? null,
    wikidataId:  genusEntry.wikidataId ?? null,
    inatTaxonId: genusEntry.inatTaxonId ?? null,
    conflicts:   genusEntry.conflicts ?? null,
  }
}
