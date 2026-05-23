// Latin synonyms reverse-map extension — 2026-05-24
//
// `data/latin-synonyms-reverse.json` turi 1103 entries (auto-generated iš
// pre-db.json + pfaf.json synonym field'ų). BET trūksta žinomų MAJOR
// taxonomy migrations, kurias botanikos pasaulis pripažįsta, ne ne visi
// šaltiniai dar atitinkamai update'inti:
//
//   • Sansevieria → Dracaena (Mwanza et al. 2017)
//   • Saintpaulia → Streptocarpus sect. Saintpaulia (Nishii et al. 2017)
//
// Šie migrations svarbūs RAG context'ui — jeigu user'is search'ina
// „Saintpaulia ionantha" ir lookup'as ne randa (Wikipedia jau migravo į
// Streptocarpus), turim fall back'inti per reverse synonym lookup.
//
// Šis script'as PRIDEDA migrations į existing reverse map. Idempotent —
// galima paleisti kelis kartus, nieko ne sugadina.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REVERSE = join(__dirname, '..', 'data', 'latin-synonyms-reverse.json')

// ── Žinomi major taxonomy migrations ──────────────────────────
// Each entry: legacy/old name → modern canonical name
//
// Sources:
//   • Mwanza et al. 2017 (Sansevieria reassignment)
//   • Nishii et al. 2017 (Saintpaulia incorporation into Streptocarpus)
//   • POWO (Plants of the World Online) — RBG Kew authoritative
//   • IPNI accepted name updates
//
// PRINCIPAS: Reverse map'as turi padėti user'iams, kurie naudoja LEGACY
// names'us (pvz. „Sansevieria" nes daugelyje LT shop'ų vis dar šitaip
// vadinama), bet aktualus pre-DB content'as gulasi po modern names'ais
// (Dracaena, Streptocarpus).
const MIGRATIONS = {
  // ── Sansevieria → Dracaena (2017) ──
  'Sansevieria':                  'Dracaena',
  'Sansevieria trifasciata':      'Dracaena trifasciata',
  'Sansevieria cylindrica':       'Dracaena angolensis',
  'Sansevieria masoniana':        'Dracaena masoniana',
  'Sansevieria hahnii':           'Dracaena trifasciata',  // cultivar of D. trifasciata
  'Sansevieria zeylanica':        'Dracaena zeylanica',
  'Sansevieria laurentii':        'Dracaena trifasciata',  // var. laurentii
  'Sansevieria moonshine':        'Dracaena trifasciata',
  'Sansevieria bacularis':        'Dracaena bacularis',
  'Sansevieria stuckyi':          'Dracaena stuckyi',

  // ── Saintpaulia → Streptocarpus sect. Saintpaulia (2017) ──
  'Saintpaulia':                  'Streptocarpus',
  'Saintpaulia ionantha':         'Streptocarpus ionanthus',
  'Saintpaulia confusa':          'Streptocarpus confusus',
  'Saintpaulia grandifolia':      'Streptocarpus grandifolius',
  'Saintpaulia teitensis':        'Streptocarpus teitensis',

  // ── Aspidistra elatior — stable (just confirm) ──
  // (no migration)

  // ── Schlumbergera — confused trade synonyms ──
  'Zygocactus truncatus':         'Schlumbergera truncata',
  'Zygocactus':                   'Schlumbergera',

  // ── Trade synonyms commonly seen LT shop'uose ──
  'Kentia':                       'Howea',
  'Kentia forsteriana':           'Howea forsteriana',
  'Kentia belmoreana':            'Howea belmoreana',
  'Howeia':                       'Howea',  // common misspelling
  'Howeia forsteriana':           'Howea forsteriana',

  // ── Cyrtomium / Polystichum (fern confusion) ──
  // (only if needed — POWO accepts both)

  // ── Old Crassula trade synonyms ──
  'Crassula portulacea':          'Crassula ovata',  // old trade name
  'Crassula argentea':            'Crassula ovata',  // very old
  'Cotyledon ovata':              'Crassula ovata',  // misapplied

  // ── Old Epipremnum trade synonyms (Pothos confusion) ──
  // Pothos aureus → Epipremnum aureum (now Epipremnum pinnatum 'Aureum')
  'Scindapsus aureus':            'Epipremnum aureum',
  'Pothos aureus':                'Epipremnum aureum',
  'Rhaphidophora aurea':          'Epipremnum aureum',

  // ── Ficus / Ficus benjamina common variants ──
  'Ficus pandurata':              'Ficus lyrata',  // common misidentification

  // ── Old Zamioculcas spelling ──
  'Zamioculcas lanceolata':       'Zamioculcas zamiifolia',
}

console.log('[extend-syn] loading reverse map...')
const data = JSON.parse(readFileSync(REVERSE, 'utf-8'))
const map = data.reverseMap

const before = Object.keys(map).length
let added = 0
let alreadyHad = 0

for (const [legacy, canonical] of Object.entries(MIGRATIONS)) {
  if (map[legacy]) {
    // Already exists — skip if matches, log if conflict
    if (map[legacy].canonical !== canonical) {
      console.warn(`[extend-syn] CONFLICT: ${legacy} — existing→${map[legacy].canonical}, new→${canonical}. Keeping existing.`)
    } else {
      alreadyHad++
    }
    continue
  }
  map[legacy] = {
    canonical,
    sources: ['major-taxonomy-migration-manual-2026-05-24'],
  }
  added++
}

data.reverseMap = map
data.totalEntries = Object.keys(map).length
data.extendedAt = new Date().toISOString()
data.extensionNote = 'Major taxonomy migrations added manually 2026-05-24 — Sansevieria→Dracaena, Saintpaulia→Streptocarpus, plus trade synonyms.'

writeFileSync(REVERSE, JSON.stringify(data, null, 2))

console.log('')
console.log('=== EXTENSION DONE ===')
console.log(`Before: ${before} entries`)
console.log(`Added:  ${added} new migrations`)
console.log(`Skipped (already had): ${alreadyHad}`)
console.log(`After:  ${data.totalEntries} entries`)
console.log('')
console.log('[extend-syn] wrote ' + REVERSE)
