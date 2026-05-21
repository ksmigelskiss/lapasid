// Latin synonyms reverse-search index — sprendžia taxonomy migration problemą.
//
// Pavyzdys: Sansevieria trifasciata buvo reclassified į Dracaena trifasciata
// 2017 m. Vartotojas, naudojantis seną pavadinimą, neturi rasti tuščio result —
// jis turi būti redirected į CURRENT accepted name.
//
// Įvestis: data/pre-db.json (each species has synonyms[] field from AHS/Beckett/PFAF)
// Plus: data/pfaf.json (latinSynonyms iš PFAF)
//
// Išvestis: data/latin-synonyms-reverse.json
//   {
//     "Sansevieria trifasciata": {
//       canonical: "Dracaena trifasciata",
//       sources: ["pfaf-latinSynonyms"]
//     },
//     "Pothos aureus": {
//       canonical: "Epipremnum aureum",
//       sources: ["beckett"]
//     },
//     ...
//   }
//
// Naudojama pre-DB lookup'e: jei query nerasta tiesiai, check reverse map.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PRE_DB    = join(__dirname, '..', 'data', 'pre-db.json')
const PFAF      = join(__dirname, '..', 'data', 'pfaf.json')
const OUTPUT    = join(__dirname, '..', 'data', 'latin-synonyms-reverse.json')

console.log('[reverse-syn] loading sources...')
const preDb = JSON.parse(readFileSync(PRE_DB, 'utf-8'))
const pfaf = existsSync(PFAF) ? JSON.parse(readFileSync(PFAF, 'utf-8')) : { results: {} }

// Build reverse map
const reverseMap = new Map() // syn → { canonical, sources[] }

function addReverse(synonym, canonical, source) {
  if (!synonym || !canonical || synonym === canonical) return
  // Clean up
  const syn = synonym.trim().replace(/^[A-Z]\.\s+/, '') // strip "A. species" → "species"... wait we want full binomials
  const canonClean = canonical.trim()
  if (!syn || !canonClean) return
  // Skip if syn looks malformed
  if (syn.length < 4 || syn.split(/\s+/).length < 1) return

  const existing = reverseMap.get(syn)
  if (!existing) {
    reverseMap.set(syn, { canonical: canonClean, sources: [source] })
  } else {
    if (!existing.sources.includes(source)) existing.sources.push(source)
    // Conflict: different canonical for same syn? prefer pre-db over pfaf
    if (existing.canonical !== canonClean && source === 'pre-db-species') {
      existing.canonical = canonClean
    }
  }
}

// Step 1: From pre-db species synonyms (AHS, Beckett)
let preDbSynCount = 0
for (const [gKey, g] of Object.entries(preDb.genera)) {
  const genusProper = gKey.charAt(0) + gKey.slice(1).toLowerCase()
  for (const [sk, sp] of Object.entries(g.species)) {
    const canonical = sp.latinName || `${genusProper} ${sk}`
    for (const syn of (sp.synonyms || [])) {
      // Synonyms can be "A. species", "B. species", or "FullBinomial"
      // Expand "X. species" abbreviation using genus context
      const expanded = syn.startsWith(genusProper.charAt(0) + '.') || syn.match(/^[A-Z]\./)
        ? syn.replace(/^([A-Z])\./, m => {
            // If first letter matches genus → use full genus
            if (m[0] === genusProper.charAt(0) + '.') return genusProper
            return m // leave abbreviation if different genus (unknown context)
          })
        : syn
      addReverse(expanded, canonical, 'pre-db-species')
      preDbSynCount++
    }
  }
}
console.log(`[reverse-syn] from pre-db species: ${preDbSynCount} synonym mentions`)

// Step 2: From PFAF latinSynonyms (cleaner: full binomials)
let pfafSynCount = 0
for (const [latin, result] of Object.entries(pfaf.results || {})) {
  if (!result.latinSynonyms || result.latinSynonyms.length === 0) continue
  for (const syn of result.latinSynonyms) {
    addReverse(syn, latin, 'pfaf-latinSynonyms')
    pfafSynCount++
  }
}
console.log(`[reverse-syn] from PFAF latinSynonyms: ${pfafSynCount} synonym mentions`)

// Output
const out = {}
for (const [syn, data] of reverseMap.entries()) {
  out[syn] = data
}

// Stats
const totalEntries = Object.keys(out).length
const fromMultipleSources = Object.values(out).filter(v => v.sources.length > 1).length
const fromPfaf = Object.values(out).filter(v => v.sources.includes('pfaf-latinSynonyms')).length
const fromPreDb = Object.values(out).filter(v => v.sources.includes('pre-db-species')).length

console.log()
console.log('=== REVERSE SYNONYMS INDEX ===')
console.log(`Total reverse entries:   ${totalEntries}`)
console.log(`Multi-source verified:   ${fromMultipleSources}`)
console.log(`From PFAF:               ${fromPfaf}`)
console.log(`From pre-db:             ${fromPreDb}`)
console.log()
console.log('Sample entries (first 15):')
let i = 0
for (const [syn, data] of Object.entries(out)) {
  if (i++ >= 15) break
  console.log(`  ${syn.padEnd(40)} → ${data.canonical} [${data.sources.join(',')}]`)
}

// Famous reclassifications to check
console.log('\nFamous reclassifications check:')
const checks = [
  'Sansevieria trifasciata',  // → Dracaena trifasciata (2017)
  'Aloe arborescens',         // syn variations
  'Pothos aureus',            // → Epipremnum aureum
  'Aloe vera',                // syn: Aloe barbadensis
  'Scindapsus aureus',        // → Epipremnum aureum
  'Philodendron oxycardium',  // → Philodendron hederaceum
  'Philodendron scandens',    // → Philodendron hederaceum
]
checks.forEach(s => {
  const r = out[s]
  console.log(`  ${s.padEnd(35)} → ${r ? r.canonical + ' [' + r.sources.join(',') + ']' : 'NOT MAPPED'}`)
})

const final = {
  generatedAt: new Date().toISOString(),
  totalEntries,
  fromMultipleSources,
  reverseMap: out,
}
writeFileSync(OUTPUT, JSON.stringify(final, null, 2))
console.log(`\n[reverse-syn] wrote ${OUTPUT}`)
