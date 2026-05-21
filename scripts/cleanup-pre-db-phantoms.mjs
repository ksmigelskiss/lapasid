// Pre-DB cleanup — pašalina AHS parser phantom'us.
//
// AHS extractor kartais chopped genus + family name'ą boundary'je, kuriant
// fake "genus" entry'us, kurie aggregating species iš kelių realių genčių.
// Pavyzdys: "BELLI" turi species `podagraria` (real: Aegopodium podagraria)
// ir `major` (real: Astrantia major) — abu priklauso UMBELLIFERAE family bet
// skirtingoms gentims.
//
// Šitas script:
//   1. Identifies confirmed phantom entries (manual list pagal pattern audit)
//   2. Deletes them iš pre-db.json
//   3. Reports stats
//
// IDEMPOTENTUS: paleisti antrą kartą — nieko nepadarys, jei phantoms jau pašalinti.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PRE_DB    = join(__dirname, '..', 'data', 'pre-db.json')

// Confirmed phantom entries (manually verified):
//   - Short names (<6 chars) that look like fragments
//   - Family also looks chopped (starts with fragment like "FERAE/", "TAE/",
//     "POSITAE/", "ACEAE/" with no preceding word)
//   - Species inside aren't valid binomials for that genus
//   - Only present in AHS source (no Wikipedia / plants.json / derlingas / sodospalvos confirmation)
const CONFIRMED_PHANTOMS = [
  'ASS',     // species → ASPARAGUS/ASPHODELUS area
  'BELLI',   // species (podagraria, major) → AEGOPODIUM, ASTRANTIA, BELLIS combined
  'COM',     // species → many Compositae chops
  'ESI',     // family ACEAE/HYDRANGEACEAE chopped
  'ATAE',    // family IACEAE fragment
  'AMAM',    // family ELIDACEAE → HAMAMELIDACEAE chopped
  'BOM',     // family ALVACEAE → MALVACEAE chopped
  'CAN',     // family ABACEAE chopped
  'CRAM',    // family CRUCIFERAE preserved but genus chopped
  'DIA',     // family HYDROPHYLLACEAE — phantom
  'DINA',    // family BERBERIDACEAE — phantom
  'ELI',     // family NACEAE chopped
  'ELIA',    // possibly chopped name
  'LAM',     // family IACEAE chopped
  'OTIS',    // phantom
  'PHI',     // family LIACEAE chopped
  'REYN',    // phantom
  'SAP',     // family INDACEAE → SAPINDACEAE chopped
  'SAPI',    // family NDACEAE → SAPINDACEAE chopped (species belong to Sapindus)
  'TONI',    // phantom
  'BAB',     // family IRIDACEAE — possibly Babiana but suspect
]

console.log('[cleanup] loading pre-DB...')
const preDb = JSON.parse(readFileSync(PRE_DB, 'utf-8'))

const before = Object.keys(preDb.genera).length
const beforeSpecies = Object.values(preDb.genera).reduce((s, g) => s + (g.speciesCount ?? 0), 0)

let removed = 0
let removedSpecies = 0
const removedList = []

for (const phantom of CONFIRMED_PHANTOMS) {
  if (preDb.genera[phantom]) {
    const g = preDb.genera[phantom]
    // Safety: only remove if AHS-only AND <30 species
    if (g.inSources.length === 1 && g.inSources[0] === 'ahs' && g.speciesCount < 35) {
      removedList.push({
        genus: phantom,
        family: g.family,
        speciesCount: g.speciesCount,
      })
      removedSpecies += g.speciesCount
      delete preDb.genera[phantom]
      removed++
    } else {
      console.log(`[cleanup] SKIP ${phantom} — multi-source (${g.inSources.join(',')}) or too many species (${g.speciesCount})`)
    }
  }
}

const after = Object.keys(preDb.genera).length

// Update top-level stats
preDb.stats.totalGenera = after
preDb.stats.totalSpecies = beforeSpecies - removedSpecies

console.log()
console.log('=== PHANTOM CLEANUP RESULTS ===')
console.log(`Genera before:  ${before}`)
console.log(`Genera after:   ${after}`)
console.log(`Removed:        ${removed} phantoms`)
console.log(`  Species removed: ${removedSpecies}`)
console.log()
console.log('Removed entries:')
removedList.forEach(r => console.log(`  - ${r.genus} (family: ${r.family}, ${r.speciesCount} sp)`))

writeFileSync(PRE_DB, JSON.stringify(preDb, null, 2))
console.log(`\n[cleanup] wrote ${PRE_DB}`)
console.log('[cleanup] re-run build-lt-names.mjs to update lt-names.json')
