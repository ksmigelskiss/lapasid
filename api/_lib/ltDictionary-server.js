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
import { parseLatinName } from '../../src/utils/latinName.js'

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

  // SPECIES-QUALIFIED genus fallback — mirror'as client'inio resolveLt.
  // Kai užklausa species-level, bet species nėra DB'e — konstruojam
  // „[genus LT] [latin epithet]" formą. Žiūr. src/utils/ltDictionary.js
  // for detailed comments.
  let ltName = genusEntry.ltName
  let speciesQualified = false
  if (words.length >= 2) {
    // MIRROR client (2026-06-01): parseLatinName proper'ly handles multi-word
    // cultivar quotes ('Orange Star', 'White Joy'). Žiūr. src/utils/ltDictionary.js.
    const parsed = parseLatinName(latinName)
    if (parsed.cultivar) {
      ltName = `${genusEntry.ltName} '${parsed.cultivar}'`
      speciesQualified = true
    } else if (parsed.species) {
      const epithet = parsed.species.toLowerCase()
      if (!genusEntry.ltName.toLowerCase().includes(epithet)) {
        ltName = `${genusEntry.ltName} ${epithet}`
        speciesQualified = true
      }
    }
  }

  // ltAllForms — kai species-qualified, NEnaudojam genusEntry.ltAllForms
  // dėl cross-species/genus pollution (žiūr. client mirror paaiškinimą).
  const allForms = speciesQualified
    ? [...new Set([ltName, genusEntry.ltName])]
    : (genusEntry.ltAllForms ?? [genusEntry.ltName])

  return {
    ltName,
    ltSynonyms:  genusEntry.ltSynonyms ?? [],
    ltAllForms:  allForms,
    ltFamily:    genusEntry.ltFamily ?? null,
    confidence:  genusEntry.confidence,
    sources:     speciesQualified
      ? [...(genusEntry.sources ?? []), 'genus-fallback-qualified']
      : (genusEntry.sources ?? []),
    wikiUrl:     genusEntry.wikiUrl ?? null,
    wikidataId:  genusEntry.wikidataId ?? null,
    inatTaxonId: genusEntry.inatTaxonId ?? null,
    conflicts:   genusEntry.conflicts ?? null,
  }
}
