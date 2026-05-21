// Test Stage 1 utility — verify 4-layer search behavior

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

globalThis.fetch = async (url) => {
  const path = url instanceof URL ? url.pathname : url.replace(/^file:\/\//, '')
  return { ok: true, json: async () => JSON.parse(readFileSync(path, 'utf-8')) }
}

const { searchStage1 } = await import('../src/utils/searchStage1.js')

console.log('=== STAGE 1 SEARCH TESTS ===\n')

const queries = [
  // Latin direct (popular houseplants)
  'Monstera',
  'Monstera deliciosa',
  'Pilea peperomioides',
  'Aloe vera',
  'Sansevieria',

  // LT name → Latin reverse lookup
  'alijošius',
  'Alavijas',
  'Kalankė',
  'Pilėja',
  'Filodendras',

  // Plural / diacritic variations
  'monstera',          // lowercase
  'kraujažolės',       // plural form

  // Obsolete name (reclassified)
  'Sansevieria trifasciata',

  // Truly unknown (should miss DB)
  'Xenomorphica fictionalis',
]

for (const q of queries) {
  console.log(`\nQuery: "${q}"`)
  const r = await searchStage1(q)
  if (r.found) {
    const reclass = r.reclassification ? ` (was: ${r.reclassification.obsolete})` : ''
    const cheng = r.hasChengProfile ? ' ⭐Cheng' : ''
    console.log(`  ✅ ${r.layer} (${r.elapsedMs}ms) | ${r.confidence}`)
    console.log(`     Latin: ${r.latin}${reclass}`)
    console.log(`     LT: ${r.lietuviškas ?? '(none)'}${r.ltSynonyms.length > 1 ? ' [+' + (r.ltSynonyms.length-1) + ' syn]' : ''}`)
    console.log(`     Family: ${r.family} | sources: ${r.dbSources.join('+')}${cheng}`)
    const toxIcon = r.toxicityStatus === 'toxic' ? '⚠️' : r.toxicityStatus === 'safe' ? '✅' : 'ⓘ'
    const toxStr = r.toxicity
      ? `toxic to ${r.toxicity.toxicTo.join(', ')} (ASPCA)`
      : 'no ASPCA match (info nesurinkta)'
    console.log(`     Toxicity: ${toxIcon} ${toxStr}`)
    if (r.ltMatchedFrom !== 'direct') console.log(`     Matched: ${r.ltMatchedFrom}`)
  } else {
    console.log(`  ❌ ${r.layer} (${r.elapsedMs}ms) — ${r.note ?? r.error}`)
  }
}

console.log('\n\n=== SUMMARY ===')
const results = []
for (const q of queries) {
  results.push(await searchStage1(q))
}
const hits = results.filter(r => r.found).length
const misses = results.filter(r => !r.found).length
const avgMs = Math.round(results.reduce((s,r) => s + (r.elapsedMs || 0), 0) / results.length)
console.log(`DB hits: ${hits}/${queries.length} (${(hits/queries.length*100).toFixed(0)}%)`)
console.log(`Misses (need AI fallback): ${misses}`)
console.log(`Avg response time: ${avgMs}ms`)
