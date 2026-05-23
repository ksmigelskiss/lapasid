// PFAF post-process cleanup — 2026-05-24
//
// Sąžiningas „stuburas" fix'as: PFAF scrape'as turi 3 žinomas problemas
// kurios surinktose datose (data/pfaf.json) gali būti pataisytos POST-HOC
// be re-scrape'o (kuris užimtų ~8h).
//
// PROBLEMOS:
//
// 1. SKELETON FALSE-POSITIVES (~7400/9894 entries, 74.9%)
//    PFAF.org grąžina HTTP 200 + tuščią template page'ą trūkstamiems
//    augalams. Scraper'is matė „Edibility Rating" label'į (template render)
//    ir paliko `found: true` su VISIŠKAI tuščiu content'u.
//    Marker'as: cultivationDetails contains „References Carbon Farming"
//    boilerplate IR !commonNameEn IR !family.
//    Fix: flip į `found: false` + pridėk `_skeletonPage: true` debug flag'ą.
//
// 2. „References More on Edible Uses" garbage suffix (~1004 entries)
//    `edibleUses` regex baigėsi vėlai — capture'ino navigacijos link'us
//    kaip part of text. Visi nukenčia su tuo pačiu suffix'u.
//    Fix: strip regex'u.
//
// 3. PFAF UPSTREAM FACT ERRORS (PFAF jų puslapis turi, mes nieko nepadarysim)
//    e.g. Aloe vera.range = „Europe — Mediterranean" (NETIESA — Arabia/N.E. Africa)
//    Fix: marker'iuoti žinomus atvejus `_unverified: true`. Consumption side
//    turi išmokyt nepatikti šitam laukui kai marker'is true.
//
// IŠVESTIS:
//   data/pfaf.json updated in-place (Git turi backup'us — saugu)
//   stats reportas konsolei

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PFAF = join(__dirname, '..', 'data', 'pfaf.json')

console.log('[pfaf-cleanup] loading...')
const data = JSON.parse(readFileSync(PFAF, 'utf-8'))
const total = Object.keys(data.results).length
console.log(`[pfaf-cleanup] ${total} entries`)

// ── Fix 1: skeleton false-positives ───────────────────────────
// Detect: found:true + nothing real inside.
// CRITERIA (must satisfy ALL):
//   • found === true (currently)
//   • !commonNameEn (no plant identification)
//   • !family (no taxonomy)
//   • !knownHazards (no hazards)
//   • !edibleUses (no edibility content)
//   • Optional: cultivationDetails starts with "References Carbon Farming"
//     boilerplate — but absence of content is sufficient.
let skeletonsFlipped = 0
for (const [latin, entry] of Object.entries(data.results)) {
  if (!entry.found) continue
  const hasContent =
    entry.commonNameEn ||
    entry.family ||
    entry.knownHazards ||
    entry.edibleUses ||
    entry.medicinalUses ||
    (entry.edibleParts?.length > 0) ||
    (entry.careIcons?.length > 0) ||
    (entry.edibilityRating > 0) ||
    (entry.medicinalRating > 0)

  if (!hasContent) {
    entry.found = false
    entry._skeletonPage = true
    entry._cleanupReason = 'PFAF template page (empty content) — re-flipped to found:false'
    skeletonsFlipped++
  }
}
console.log(`[pfaf-cleanup] skeleton false-positives flipped: ${skeletonsFlipped}`)

// ── Fix 2: strip "References More on Edible Uses" suffix ──────
const SUFFIX_RE = /\s*References\s+More on Edible Uses\s*$/i
let suffixStripped = 0
for (const entry of Object.values(data.results)) {
  if (!entry.found) continue
  if (typeof entry.edibleUses === 'string' && SUFFIX_RE.test(entry.edibleUses)) {
    entry.edibleUses = entry.edibleUses.replace(SUFFIX_RE, '').trim() || null
    suffixStripped++
  }
}
console.log(`[pfaf-cleanup] "References More" suffix stripped: ${suffixStripped}`)

// ── Fix 3: known PFAF upstream fact errors (manual whitelist) ──
// Aloe vera range — PFAF says "Europe — Mediterranean" but real origin
// is Arabian Peninsula / N.E. Africa. Tagging as unverified so consumption
// (deriveToxicity, buildPlantRagContext) can skip range field jei
// unverified. Future: cross-reference per Wikipedia/POWO.
const UPSTREAM_FACT_ERRORS = {
  'Aloe vera': {
    fields: ['range', 'habitats', 'family'],
    note: 'PFAF range/habitats Mediterranean — netiesa, tikra Arabia/N.E. Africa. Family „Aloeaceae" outdated, dabar Asphodelaceae.',
  },
  // Add more as discovered. This is intentionally explicit (whitelist not
  // heuristic) — wrong fact errors require manual verification each time.
}
let upstreamFlagged = 0
for (const [latin, override] of Object.entries(UPSTREAM_FACT_ERRORS)) {
  const e = data.results[latin]
  if (!e) continue
  e._upstreamFactError = override
  upstreamFlagged++
}
console.log(`[pfaf-cleanup] upstream fact errors flagged: ${upstreamFlagged}`)

// ── Update meta + write ───────────────────────────────────────
const newFound = Object.values(data.results).filter(e => e.found).length
data.cleanupAppliedAt = new Date().toISOString()
data.cleanupSchema = {
  version: 2,
  appliedFixes: [
    'skeleton-false-positives-flipped',
    'edible-uses-suffix-stripped',
    'upstream-fact-errors-flagged',
  ],
  preCleanupFoundCount: 9894,
  postCleanupFoundCount: newFound,
  skeletonsFlipped,
  suffixStripped,
  upstreamFlagged,
}

writeFileSync(PFAF, JSON.stringify(data, null, 2))
console.log('')
console.log('=== PFAF CLEANUP DONE ===')
console.log(`Pre-cleanup found:   9894`)
console.log(`Post-cleanup found:  ${newFound}`)
console.log(`Skeletons removed:   ${skeletonsFlipped}`)
console.log(`Suffixes cleaned:    ${suffixStripped}`)
console.log(`Upstream flagged:    ${upstreamFlagged}`)
console.log('')
console.log('[pfaf-cleanup] written ' + PFAF)
