// ASPCA → pre-DB genus mapping.
//
// ASPCA naudoja COMMON names ("Snake Plant", "Peace Lily"), ne Latin genus.
// Mes turim 1023 ASPCA toxic plants ir 1655 pre-DB genera — reikia match'inti.
//
// Strategija (4-tier):
//   1. Manual override map (~50 entries — popular houseplants su trade names)
//   2. Auto-match if displayName contains pre-DB genus word
//   3. Auto-match if slug contains pre-DB genus word
//   4. Skip — no clear match (probably plant not in pre-DB)
//
// Output: data/aspca-genus-map.json
//   {
//     "PHILODENDRON": {
//       toxicTo: ["cats", "dogs", "horses"],
//       severity: "moderate",  // ← derived
//       matchedEntries: [
//         { slug: "heartleaf-philodendron", displayName: "Heartleaf Philodendron" },
//         { slug: "cutleaf-philodendron", displayName: "Cutleaf Philodendron" },
//         ...
//       ],
//       confidence: "high",      // ← all match via genus word
//     }
//   }

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ASPCA  = join(__dirname, '..', 'data', 'aspca-toxicity.json')
const PRE_DB = join(__dirname, '..', 'data', 'pre-db.json')
const OUTPUT = join(__dirname, '..', 'data', 'aspca-genus-map.json')

// Manual mappings — common name → pre-DB genus
// Sources: ASPCA displayName patterns + houseplant knowledge
const MANUAL_MAP = {
  // Sansevieria (popular houseplant, ASPCA uses "Snake Plant" / "Mother-in-Law's Tongue")
  'snake-plant':                   'SANSEVIERIA',
  'mother-in-laws-tongue':          'SANSEVIERIA',
  'good-luck-plant-or-snake-plant': 'SANSEVIERIA',

  // Spathiphyllum
  'peace-lily':                    'SPATHIPHYLLUM',
  'mauna-loa-peace-lily':           'SPATHIPHYLLUM',

  // Epipremnum (also old name Scindapsus, Pothos)
  'golden-pothos':                 'EPIPREMNUM',
  'satin-pothos':                  'EPIPREMNUM',
  'pothos-or-devils-ivy':          'EPIPREMNUM',

  // Convallaria
  'lily-valley':                   'CONVALLARIA',
  'lily-of-the-valley':             'CONVALLARIA',

  // Cycas
  'sago-palm':                     'CYCAS',
  'cardboard-palm':                'ZAMIA',  // not Cycas — Zamia

  // Chlorophytum
  'spider-plant':                  'CHLOROPHYTUM',

  // Nephrolepis
  'boston-fern':                   'NEPHROLEPIS',
  'sword-fern':                    'NEPHROLEPIS',

  // Schlumbergera
  'christmas-cactus':              'SCHLUMBERGERA',
  'easter-cactus':                 'SCHLUMBERGERA',

  // Zamioculcas (post-1996, often not under genus name)
  'zz-plant':                      'ZAMIOCULCAS',
  'zanzibar-gem':                  'ZAMIOCULCAS',

  // Pachira
  'money-tree':                    'PACHIRA',
  'guiana-chestnut':               'PACHIRA',

  // Ficus
  'rubber-tree':                   'FICUS',
  'fiddle-leaf-fig':                'FICUS',
  'weeping-fig':                   'FICUS',
  'indian-rubber-plant':            'FICUS',

  // Dieffenbachia
  'dumb-cane':                     'DIEFFENBACHIA',
  'dumbcane':                      'DIEFFENBACHIA',

  // Schefflera
  'umbrella-tree':                 'SCHEFFLERA',
  'umbrella-plant':                'SCHEFFLERA',

  // Hedera
  'english-ivy':                   'HEDERA',

  // Lilium (deadly to cats — important!)
  'easter-lily':                   'LILIUM',
  'tiger-lily':                    'LILIUM',
  'asiatic-lily':                  'LILIUM',
  'daylily':                       'HEMEROCALLIS',

  // Tulipa
  'tulip':                         'TULIPA',

  // Hyacinthus
  'hyacinth':                      'HYACINTHUS',

  // Cyclamen
  'cyclamen':                      'CYCLAMEN',
  'persian-violet':                'CYCLAMEN',

  // Saintpaulia (African violet — non-toxic, but ASPCA lists separately)
  'african-violet':                'SAINTPAULIA',

  // Solanum (cat fatal)
  'jerusalem-cherry':              'SOLANUM',

  // Various
  'jade-plant':                    'CRASSULA',  // C. ovata
  'flamingo-plant':                'ANTHURIUM',
  'flamingo-flower':               'ANTHURIUM',
  'desert-rose':                   'ADENIUM',
  'mistletoe':                     'VISCUM',
  'oleander':                      'NERIUM',
  'azalea':                        'RHODODENDRON',
  'rhododendron':                  'RHODODENDRON',
  'wandering-jew':                 'TRADESCANTIA',
  'inch-plant':                    'TRADESCANTIA',
  'arrowhead-vine':                'SYNGONIUM',
  'elephant-ear':                  'COLOCASIA',
  'caladium':                      'CALADIUM',
  'philodendron-monstera':          'MONSTERA',  // some ASPCA call Monstera this
  'split-leaf-philodendron':        'MONSTERA',
  'swiss-cheese-plant':            'MONSTERA',

  // Highly toxic plants — pridėta po 2026-05-21 user test'o, kai pamatėm,
  // kad mūsų ASPCA scrape'as šių NEPAGAVO. Jei rebuild'as ateityje pildys
  // duomenis, šie mapping'ai aktyvuosis automatiškai.
  'monkshood':                     'ACONITUM',
  'aconite':                       'ACONITUM',
  'wolfsbane':                     'ACONITUM',
  'helmet-flower':                 'ACONITUM',
  'pineapple-lily':                'EUCOMIS',
  'pineapple-flower':              'EUCOMIS',

  // Auto-suggested by aspca-coverage-analysis (2026-05-22):
  'common-staghorn-fern':          'PLATYCERIUM',
  'prayer-plant':                  'MARANTA',
  'silver-jade-plant':             'CRASSULA',  // already had 'jade-plant'
}

console.log('[aspca-map] loading sources...')
const aspca  = JSON.parse(readFileSync(ASPCA, 'utf-8'))
const preDb  = JSON.parse(readFileSync(PRE_DB, 'utf-8'))

// BUG FIX 2026-05-24 — filter'inam tik TOXIC entries iš naujosios v2 schema'os.
// Pre-fix scraper'is laikė non-toxic kaip toxic, todėl genus-map gaudavo
// false positives (Saintpaulia, Chlorophytum etc.). Naujasis scraper'is
// pažymi entry su `safetyStatus`, čia tiesiog filter'inam pagal jį.
//
// Sanity: v1 (pre-fix) schema'oje field'o nebuvo — fallback: jei
// `safetyStatus` undefined, manyti 'toxic' (legacy behavior).
const aspcaEntries = Object.entries(aspca.toxicity)
const toxicEntries = aspcaEntries.filter(([slug, entry]) => {
  const status = entry.safetyStatus ?? 'toxic' // legacy fallback
  return status === 'toxic'
})
const filteredOut = aspcaEntries.length - toxicEntries.length
console.log(`[aspca-map] schema: v${aspca.schemaVersion ?? 1}, filtered out ${filteredOut} non-toxic entries (e.g. African Violet, Spider Plant)`)

const preDbGenera = new Set(Object.keys(preDb.genera).map(g => g.toLowerCase()))
console.log(`[aspca-map] pre-DB: ${preDbGenera.size} genera | ASPCA toxic-only: ${toxicEntries.length} plants`)

// Convert filtered toxic entries to object for downstream compatibility
const aspcaToxic = Object.fromEntries(toxicEntries)

// Build genus → ASPCA entries map
const genusMap = new Map() // GENUS → { entries: [], matchSources: [] }

function addMatch(genus, entry, matchType) {
  if (!genusMap.has(genus)) {
    genusMap.set(genus, { entries: [], matchTypes: new Set() })
  }
  const m = genusMap.get(genus)
  if (!m.entries.find(e => e.slug === entry.slug)) {
    m.entries.push({
      slug: entry.slug,
      displayName: entry.displayName,
      toxicTo: entry.toxicTo,
      detailUrl: entry.detailUrl,
    })
  }
  m.matchTypes.add(matchType)
}

// PASS 1: Manual map (highest priority)
let manualHits = 0
for (const [slug, entry] of Object.entries(aspcaToxic)) {
  if (MANUAL_MAP[slug]) {
    addMatch(MANUAL_MAP[slug], entry, 'manual')
    manualHits++
  }
}
console.log(`[aspca-map] manual map: ${manualHits} entries matched`)

// PASS 2: Match by displayName containing pre-DB genus word
let displayNameHits = 0
for (const [slug, entry] of Object.entries(aspcaToxic)) {
  if (MANUAL_MAP[slug]) continue // already matched
  const words = entry.displayName.toLowerCase().split(/[\s'\-,()]+/).filter(Boolean)
  for (const w of words) {
    if (preDbGenera.has(w)) {
      addMatch(w.toUpperCase(), entry, 'displayName')
      displayNameHits++
      break // one match per entry
    }
  }
}
console.log(`[aspca-map] displayName match: ${displayNameHits} entries`)

// PASS 3: Match by slug words
let slugHits = 0
for (const [slug, entry] of Object.entries(aspcaToxic)) {
  if (MANUAL_MAP[slug]) continue
  // Skip if already matched in pass 2
  const alreadyMatched = [...genusMap.values()].some(m =>
    m.entries.find(e => e.slug === slug)
  )
  if (alreadyMatched) continue

  for (const w of slug.split(/-/)) {
    if (preDbGenera.has(w)) {
      addMatch(w.toUpperCase(), entry, 'slug')
      slugHits++
      break
    }
  }
}
console.log(`[aspca-map] slug match: ${slugHits} entries`)

// Build output
const output = {}
for (const [genus, data] of genusMap) {
  const allToxic = new Set()
  for (const e of data.entries) {
    for (const t of e.toxicTo) allToxic.add(t)
  }
  output[genus] = {
    toxicTo: [...allToxic].sort(),
    matchedEntries: data.entries,
    matchTypes: [...data.matchTypes],
    confidence: data.matchTypes.has('manual') ? 'high' :
                data.matchTypes.has('displayName') ? 'medium' : 'low',
  }
}

// Stats
const totalMatched = genusMap.size
const inPreDb = Object.keys(output).filter(g => preDb.genera[g]).length

console.log()
console.log('=== ASPCA-GENUS MAP RESULTS ===')
console.log(`Total pre-DB genera:         ${preDbGenera.size}`)
console.log(`Total ASPCA entries (raw):   ${Object.keys(aspca.toxicity).length}`)
console.log(`  Toxic entries used:        ${toxicEntries.length}`)
console.log(`  Non-toxic filtered out:    ${filteredOut}`)
console.log(`Unique pre-DB genera with toxicity:  ${totalMatched} (${(totalMatched/preDbGenera.size*100).toFixed(0)}%)`)
console.log()
console.log('Sample top hits:')
const sorted = [...genusMap.entries()].sort((a,b) => b[1].entries.length - a[1].entries.length).slice(0,15)
for (const [genus, data] of sorted) {
  const animals = [...new Set(data.entries.flatMap(e => e.toxicTo))].join(',')
  console.log(`  ${genus.padEnd(20)} ${data.entries.length} entry(ies) — toxic to: ${animals}`)
}

// Verify popular houseplants
console.log('\nPopular houseplant toxicity coverage:')
const popular = ['PHILODENDRON', 'MONSTERA', 'SPATHIPHYLLUM', 'SANSEVIERIA', 'EPIPREMNUM', 'DIEFFENBACHIA', 'ALOE', 'DRACAENA', 'FICUS', 'CHLOROPHYTUM', 'TRADESCANTIA', 'ZAMIOCULCAS', 'PACHIRA', 'SCHEFFLERA', 'CYCLAMEN', 'LILIUM']
for (const g of popular) {
  const m = output[g]
  console.log(`  ${g.padEnd(18)} ${m ? '✅ toxic to ' + m.toxicTo.join(',') + ' [' + m.matchTypes.join('+') + ']' : '❌ NOT FOUND'}`)
}

writeFileSync(OUTPUT, JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: 'ASPCA toxic plants list → pre-DB genus mapping',
  totalGeneraMatched: totalMatched,
  totalAspcaEntriesMatched: [...genusMap.values()].reduce((s, m) => s + m.entries.length, 0),
  manualMappings: Object.keys(MANUAL_MAP).length,
  toxicityByGenus: output,
}, null, 2))

console.log(`\n[aspca-map] wrote ${OUTPUT}`)
