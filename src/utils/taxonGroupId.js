// Pure ID-derivation logika taxonGroup'ams — be Firebase dependencies.
//
// Šis modulis išvengia circular import problemų ir leidžia Node-side
// test'ams importuoti deterministic ID derivation funkcijas be Firebase
// SDK init'inimo (kuris reikalauja Vite environment'o).
//
// taxonGroups.js re-exportina šitas funkcijas, kad esama API išliktų
// nepakeista call site'ams.

import { parseLatinName } from './latinName.js'

// MAX_BULK_BATCH ir CATALOG_SCHEMA_VERSION irgi gali būti pure'ūs, bet
// kol kas paliekam taxonGroups.js'e — nereikia testavimui šiandien.

// 2026-06-01 — declutter'ėm dropdown'ą. Anksčiau buvo 7 type'ai
// (cultivar-series, species, hybrid, genus-care, cultivar-group, variety,
// subspecies), bet realiai catalog'e naudojami TIK du: 'species' (4 series)
// ir 'genus-care' (1 series). Mirusios opcijos:
//   - hybrid: auto-detected per parseLatinName iš „×" simbolio (rank'as,
//     ne taxonGroup type'as)
//   - cultivar-series / cultivar-group: skirti formaliam botaniniam
//     grupavimui (Knock Out roses ir pan.) — LapasID houseplant context'e
//     neaktualu
//   - variety / subspecies: taxonomic detalė retai naudojama
//
// Jei ateityje prireiks, atvirkščiai pridėt 1 minutė. Be to, taxonGroupDocId
// ir parentTaxonGroupIdFor toliau handle'ina senus type'us defensyviai
// (jei legacy data pasitaikytų), tik UI/AI schema'os nebepateikia jų.
export const TAXON_GROUP_TYPES = [
  'species',           // Nephrolepis exaltata, Oxalis vulcanicola — parent rūšies šablonas
  'genus-care',        // Aglaonema, Hosta — care šablonas visam genus'ui
]

/**
 * taxonGroupDocId — slug formatas pagal genus + name (+ optional type suffix).
 *
 *   ({ genus: "Clematis", name: "Boulevard" })                  → "clematis-boulevard"
 *   ({ genus: "Hosta",    name: "Hosta", type: "genus-care" })  → "hosta-genus"
 *   ({ genus: "Clematis", name: "×jackmanii", type: "hybrid" }) → "clematis-jackmanii-hybrid"
 *
 * `type` suffix'as automatiškai pridedamas tik genus-care, hybrid, variety,
 * subspecies atvejais (kad nesusimaišytų su species ar cultivar-series).
 */
export function taxonGroupDocId({ genus, name, type }) {
  if (!genus && !name) return null
  const norm = (s) => (s ?? '').toLowerCase()
    .replace(/[®™©]/g, '')
    .replace(/\s*['"]\s*/g, '')
    .replace(/[×x]\s+/g, '')             // strip hybrid sign
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')

  const parts = []
  if (genus) parts.push(norm(genus))
  // Don't duplicate genus in name (kai name == genus, pvz. „Hosta" + „Hosta")
  if (name && norm(name) !== norm(genus)) parts.push(norm(name))

  // Type suffix'as atskiria semantines situacijas su tuo pačiu genus+name
  if (type === 'genus-care')   parts.push('genus')
  if (type === 'hybrid')       parts.push('hybrid')
  if (type === 'variety')      parts.push('var')
  if (type === 'subspecies')   parts.push('ssp')

  return parts.join('-').slice(0, 100) || null
}

/**
 * parentTaxonGroupIdFor(latinName) — sugeneruoja deterministic parent
 * taxonGroup ID iš latin name'o. Padengia visus parent atvejus:
 *
 *   - „Dionaea muscipula 'Akai Ryu'" → „dionaea-muscipula" (species parent)
 *   - „Hosta 'Patriot'"              → „hosta-genus"        (genus-care fallback)
 *   - „Rosa Knock Out"               → „rosa-genus"         (genus-care fallback)
 *   - „Acer palmatum var. dissectum" → „acer-palmatum"      (species parent)
 *   - „Dionaea muscipula" (rūšis)    → null (entry IS the species)
 *   - „Dionaea" (gentis)             → null (entry IS the genus)
 *   - „random nonsense"              → null
 *
 * Grąžina null kai entry'is nėra cultivar/variety/subspecies/forma — tokie
 * save'inami flat'ai (jie patys yra grupė ar viršesnis lygmuo).
 */
export function parentTaxonGroupIdFor(latinName) {
  const parsed = parseLatinName(latinName)
  if (!parsed.genus) return null
  const isSubSpecific = ['cultivar', 'variety', 'subspecies', 'forma'].includes(parsed.rank)
  if (!isSubSpecific) return null

  if (parsed.species) {
    return taxonGroupDocId({ genus: parsed.genus, name: parsed.species, type: 'species' })
  }
  return taxonGroupDocId({ genus: parsed.genus, name: parsed.genus, type: 'genus-care' })
}
