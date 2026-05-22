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

/** MIRROR src/utils/ltDictionary.js resolveLt() — Latin → LT entry. */
export async function resolveLtServer(latinName) {
  const data = await loadLtNames()
  if (!latinName) return null
  const key = latinName.trim().split(/\s+/)[0]
  const properKey = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()
  const entry = data.ltNames[properKey]
  if (!entry || !entry.ltName) return null
  return {
    ltName:      entry.ltName,
    ltSynonyms:  entry.ltSynonyms ?? [],
    ltAllForms:  entry.ltAllForms ?? [entry.ltName],
    ltFamily:    entry.ltFamily ?? null,
    confidence:  entry.confidence,
    sources:     entry.sources ?? [],
    wikiUrl:     entry.wikiUrl ?? null,
    wikidataId:  entry.wikidataId ?? null,
    inatTaxonId: entry.inatTaxonId ?? null,
    conflicts:   entry.conflicts ?? null,
  }
}
