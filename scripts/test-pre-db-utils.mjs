// Test script for Stage B utilities (preDb.js, ltDictionary.js, latinResolver.js)
//
// Tests basic functionality without app integration. Run with:
//   node scripts/test-pre-db-utils.mjs
//
// NOTE: utilities use `new URL('../../data/...', import.meta.url)` + fetch,
// which works in BROWSER but NOT raw Node. For Node test, we read files
// directly bypass the fetch step.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataPath = (file) => join(__dirname, '..', 'data', file)

// Mock fetch to read local files
globalThis.fetch = async (url) => {
  const path = url instanceof URL ? url.pathname : url.replace(/^file:\/\//, '')
  return {
    ok: true,
    json: async () => JSON.parse(readFileSync(path, 'utf-8'))
  }
}

// Now we can import the utilities
const { lookupGenus, lookupSpecies, lookupPlant, getStats } = await import('../src/utils/preDb.js')
const { resolveLt, resolveLatin, getAllLtForms } = await import('../src/utils/ltDictionary.js')
const { resolveCanonical, isObsoleteName, getReclassification } = await import('../src/utils/latinResolver.js')

console.log('\n=== STAGE B UTILITIES TEST ===\n')

// ─── preDb.js ────────────────────────────────────────────────
console.log('--- preDb.js ---')
const stats = await getStats()
console.log('DB stats:', stats)

console.log('\nMonstera genus:')
const m = await lookupGenus('Monstera')
console.log('  family:', m.family, '| sources:', m.inSources, '| species count:', m.speciesCount)
console.log('  has chengProfile:', !!m.chengProfile)

console.log('\nMonstera deliciosa species:')
const md = await lookupSpecies('Monstera', 'deliciosa')
console.log('  latinName:', md?.latinName, '| sources:', md?.sources)

console.log('\nPilea peperomioides (combined):')
const p = await lookupPlant('Pilea peperomioides')
console.log('  genus has Cheng:', !!p?.genus?.chengProfile)
console.log('  species data:', p?.hasSpeciesData)

// ─── ltDictionary.js ─────────────────────────────────────────
console.log('\n--- ltDictionary.js ---')

const tests = [
  { latin: 'Monstera', expect: 'Monstera' },
  { latin: 'Aloe', expect: 'Alavijas' },
  { latin: 'Echinacea', expect: 'Ežiuolė' },
  { latin: 'Beaucarnea', expect: 'Riestalapis nukaris' },
  { latin: 'Schefflera', expect: 'Šeflera' },
  { latin: 'NonExistent', expect: null },
]
for (const t of tests) {
  const r = await resolveLt(t.latin)
  const got = r?.ltName ?? null
  const ok = got === t.expect ? '✅' : '❌'
  console.log(`  ${ok} ${t.latin.padEnd(15)} → ${got ?? '(null)'} ${r ? '['+r.sources.join('+')+', '+r.confidence+']' : ''}`)
}

console.log('\nReverse lookup (LT → Latin):')
const reverseTests = [
  { lt: 'alijošius',  expectMatch: 'Aloe' },
  { lt: 'Alavijas',   expectMatch: 'Aloe' },
  { lt: 'Kalankė',    expectMatch: 'Kalanchoe' },
  { lt: 'Sansevjera', expectMatch: 'Sansevieria' },
  { lt: 'Pilėja',     expectMatch: 'Pilea' },
  { lt: 'kraujažolės', expectMatch: 'Achillea' },
  { lt: 'NIEKO',      expectMatch: null },
]
for (const t of reverseTests) {
  const r = await resolveLatin(t.lt)
  const ok = r === t.expectMatch ? '✅' : '❌'
  console.log(`  ${ok} "${t.lt}" → ${r ?? '(null)'}`)
}

console.log('\nAll forms for Aloe:')
console.log(' ', await getAllLtForms('Aloe'))

// ─── latinResolver.js ─────────────────────────────────────────
console.log('\n--- latinResolver.js (reverse synonyms) ---')

const reclassTests = [
  'Sansevieria trifasciata',
  'Pothos aureus',
  'Aloe vera',  // not obsolete
  'Made up name',
]
for (const t of reclassTests) {
  const canonical = await resolveCanonical(t)
  const obsolete = await isObsoleteName(t)
  const recl = await getReclassification(t)
  console.log(`  ${t.padEnd(30)} → ${canonical}${obsolete ? ' (obsolete!)' : ''}${recl ? ' [' + recl.sources.join(',') + ']' : ''}`)
}

console.log('\n✅ All tests complete')
