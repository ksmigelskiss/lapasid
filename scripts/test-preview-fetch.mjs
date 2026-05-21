// Preview parallel fetch — real-world latency test.
//
// Paleidžia previewParallelFetch ant 10 augalų (popular + edge cases) ir
// rodo timing lentelę kiekvienam šaltinui + total. Skirta validuoti ar
// ~1.5s biudžetas realistinis.
//
// Run: node scripts/test-preview-fetch.mjs
//
// NB: Brave testas SKIP'inamas — reikalauja BRAVE_API_KEY ir Vercel proxy.
// Browser'yje pridės papildomus ~500-1500ms (cached) ar 2-3s (uncached).

import { previewParallelFetch } from '../src/utils/previewParallelFetch.js'

const TESTS = [
  // Popular houseplants — Wiki LT tikrai egzistuoja
  'Monstera deliciosa',
  'Pilea peperomioides',
  'Aloe vera',
  'Ficus elastica',

  // EN-only (Wiki LT gali nebūti)
  'Sansevieria trifasciata',   // reclassified — kelias per LT redirect?
  'Calathea orbifolia',
  'Pothos aureus',             // common name, taxonomically wrong

  // Edge: rare cultivar
  'Philodendron Birkin',

  // Truly obscure
  'Pilea cadierei',

  // Should miss everything
  'Xenomorphica fictionalis',
]

// Node.js fetch polyfill check
if (typeof fetch === 'undefined') {
  console.error('FATAL: Node fetch unavailable. Requires Node 18+.')
  process.exit(1)
}

console.log('╔═══════════════════════════════════════════════════════════╗')
console.log('║  Preview Parallel Fetch — Real-World Latency Test         ║')
console.log('╠═══════════════════════════════════════════════════════════╣')
console.log('║  Šaltiniai: Wiki-LT extract, Wiki-EN extract, Wiki-photo, ║')
console.log('║             iNat-photo. Brave atskirai (browser only).    ║')
console.log('║  Biudžetas: <1500ms — testuojam ar realistinis.           ║')
console.log('╚═══════════════════════════════════════════════════════════╝\n')

const results = []

for (const latin of TESTS) {
  const r = await previewParallelFetch(latin, {
    debug: true,
    includeBrave: false,    // skip — needs API key + proxy
    includeWikiEn: true,
  })
  results.push({ latin, r })
}

// Summary table
console.log('\n\n╔═══════════════════════════════════════════════════════════════════════════════════════╗')
console.log('║  SUMMARY                                                                              ║')
console.log('╠═══════════════════════════════════════════════════════════════════════════════════════╣')
console.log('║  Plant                       │ Total │ wkLT │ wkEN │ wPic │ iNat │ Photo  │ Extract  ║')
console.log('╠══════════════════════════════╪═══════╪══════╪══════╪══════╪══════╪════════╪══════════╣')

for (const { latin, r } of results) {
  const ms = n => (n != null ? `${n}ms`.padStart(5) : '   - ')
  // ✓ = found w/ real content, ○ = HTTP ok but empty/no page, ✗ = error/timeout
  const ok = x => !x?.ok ? '✗' : (x.found ? '✓' : '○')

  const name = latin.padEnd(28).slice(0, 28)
  const total = `${r.totalMs}ms`.padStart(5)
  const wkLT = `${ms(r.wikiLt?.ms)}${ok(r.wikiLt)}`.padEnd(4)
  const wkEN = `${ms(r.wikiEn?.ms)}${ok(r.wikiEn)}`.padEnd(4)
  const wPic = `${ms(r.wikiPhoto?.ms)}${ok(r.wikiPhoto)}`.padEnd(4)
  const iNat = `${ms(r.iNatPhoto?.ms)}${ok(r.iNatPhoto)}`.padEnd(4)
  const photo = (r.bestPhoto?.source ?? 'none').padEnd(6)
  const extract = r.bestExtract
    ? `${r.bestExtract.lang}${r.bestExtract.needsTranslation ? '→LT' : '   '}`.padEnd(8)
    : 'none    '
  console.log(`║  ${name} │ ${total} │${wkLT} │${wkEN} │${wPic} │${iNat} │ ${photo} │ ${extract} ║`)
}

console.log('╚══════════════════════════════╧═══════╧══════╧══════╧══════╧══════╧════════╧══════════╝')

const totals = results.map(({ r }) => r.totalMs)
const avg = Math.round(totals.reduce((a, b) => a + b, 0) / totals.length)
const max = Math.max(...totals)
const min = Math.min(...totals)
const under1500 = totals.filter(t => t < 1500).length

console.log(`\nTotal latency: min=${min}ms  avg=${avg}ms  max=${max}ms`)
console.log(`Under 1500ms budget: ${under1500}/${totals.length} (${Math.round(under1500/totals.length*100)}%)`)

const photoHits = results.filter(({ r }) => r.bestPhoto).length
const extractHits = results.filter(({ r }) => r.bestExtract).length
const ltExtractHits = results.filter(({ r }) => r.bestExtract?.lang === 'lt').length

console.log(`Photo coverage:   ${photoHits}/${results.length} (${Math.round(photoHits/results.length*100)}%)`)
console.log(`Extract coverage: ${extractHits}/${results.length} (${Math.round(extractHits/results.length*100)}%) — ${ltExtractHits} LT, ${extractHits - ltExtractHits} EN`)

console.log('\nLegend: ✓ found  ○ no data  ✗ error')
