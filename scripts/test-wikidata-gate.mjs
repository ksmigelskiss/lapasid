// Wikidata gate'o testas — patikrina, ar gate'as praleidžia augalus ir
// blokuoja non-plant užklausas ("keptuvė", "xyz123", produktus, etc.)
//
// Naudoja `previewParallelFetch` su `includeWikidataGate: true` flag'u.
//
// Run: node scripts/test-wikidata-gate.mjs

import { previewParallelFetch } from '../src/utils/previewParallelFetch.js'

if (typeof fetch === 'undefined') {
  console.error('FATAL: Node fetch unavailable. Requires Node 18+.')
  process.exit(1)
}

console.log('╔═══════════════════════════════════════════════════════════╗')
console.log('║  Wikidata Plant Gate — Filter Verification                ║')
console.log('╠═══════════════════════════════════════════════════════════╣')
console.log('║  Tikslas: ✓ PLANT (augalas, taxon), ✗ BLOCK (kita)        ║')
console.log('╚═══════════════════════════════════════════════════════════╝\n')

const TESTS = [
  // ── DEFINITELY plants — gate turi PRALEIST (passesPlantGate=true)
  { q: 'Monstera deliciosa',     expectGate: true,  category: 'plant (species)' },
  { q: 'Pilea peperomioides',    expectGate: true,  category: 'plant (species)' },
  { q: 'Aloe vera',              expectGate: true,  category: 'plant (species)' },
  { q: 'Hosta plantaginea',      expectGate: true,  category: 'plant (species)' },

  // ── Genus level — taxon, gate praleidžia
  { q: 'Philodendron',           expectGate: true,  category: 'plant (genus)' },

  // ── Non-plant items — gate turi BLOKUOT (passesPlantGate=false)
  { q: 'frying pan',             expectGate: false, category: 'cooking utensil' },
  { q: 'smartphone',             expectGate: false, category: 'electronic device' },
  { q: 'pizza',                  expectGate: false, category: 'food (prepared)' },

  // ── Animals — augalų app'e GYVŪNAS turi būti blokuotas.
  // Wikidata "Felis catus" P31 = Q55983715 (organisms known by common name),
  // ne plant/taxon QID — natūraliai krenta į ✗BLOCK. Geriau nei tikėjausi.
  { q: 'Felis catus',            expectGate: false, category: 'animal (correctly blocked)' },

  // ── Edge: doesn't exist anywhere
  { q: 'Xenomorphica fictionalis', expectGate: false, category: 'fictional (no Wiki)' },
  { q: 'xyz123 plant',           expectGate: false, category: 'garbage query' },

  // ── Edge: LT word that exists in Wikipedia but not as plant
  // ("keptuvė" LT Wiki page'as gali būti su pageprops, gali ne)
  { q: 'keptuvė',                expectGate: false, category: 'LT non-plant noun' },
]

const results = []
for (const t of TESTS) {
  const r = await previewParallelFetch(t.q, {
    debug: false,
    includeWikidataGate: true,
    includeWikiEn: true,
  })
  const actual = r?.passesPlantGate ?? false
  const match = actual === t.expectGate
  results.push({ ...t, actual, match, r })
}

console.log('\n┌────────────────────────────────┬─────────┬─────────┬─────────┬──────────────────────┐')
console.log('│ Query                          │ Expect  │ Actual  │ Match   │ Notes                │')
console.log('├────────────────────────────────┼─────────┼─────────┼─────────┼──────────────────────┤')

for (const { q, expectGate, actual, match, category, r } of results) {
  const qStr = q.padEnd(30).slice(0, 30)
  const exp = (expectGate ? '✓PLANT' : '✗BLOCK').padEnd(7)
  const act = (actual    ? '✓PLANT' : '✗BLOCK').padEnd(7)
  const mat = (match ? '  ✅   ' : '  ❌   ')

  const wdQid = r?.wikidataGate?.found ? r.wikidataGate.instanceOf?.[0] ?? 'no-P31' : 'no-wiki'
  const notes = `${category.slice(0, 18).padEnd(20)}`

  console.log(`│ ${qStr} │ ${exp} │ ${act} │ ${mat} │ ${notes} │`)
}

console.log('└────────────────────────────────┴─────────┴─────────┴─────────┴──────────────────────┘')

const passing = results.filter(r => r.match).length
const total = results.length
const totalMs = results.reduce((s, r) => s + (r.r?.totalMs ?? 0), 0)

console.log(`\nResults: ${passing}/${total} (${Math.round(passing/total*100)}%)`)
console.log(`Total wall-clock time: ${totalMs}ms (avg ${Math.round(totalMs/total)}ms per query)`)

if (passing < total) {
  console.log('\n❌ FAILED CASES:')
  for (const { q, expectGate, actual, category, r } of results) {
    if (actual !== expectGate) {
      console.log(`  • "${q}" (${category})`)
      console.log(`    expected: ${expectGate ? 'PLANT' : 'BLOCK'}, actual: ${actual ? 'PLANT' : 'BLOCK'}`)
      if (r?.wikidataGate) {
        console.log(`    wikidata: ${JSON.stringify({ found: r.wikidataGate.found, instanceOf: r.wikidataGate.instanceOf?.slice(0, 3), labels: r.wikidataGate.labels })}`)
      } else {
        console.log(`    wikidata: not fetched (no wikidataId from Wiki extract)`)
      }
    }
  }
}

process.exit(passing === total ? 0 : 1)
