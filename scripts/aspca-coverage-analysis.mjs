// ASPCA coverage analizė — kurie ASPCA entries dar nesumap'inti į mūsų
// pre-DB genus, BET galimai turėtų būti.
//
// VAIDMUO (2026-05-22 naktinis): pamatėm, kad mūsų ASPCA mappping'as
// padengia 116 unique genera iš 1023 ASPCA entries (~10%). Likę 90% gali
// būti:
//   (a) augalai, kurie nėra mūsų pre-DB (no genus match galimas)
//   (b) augalai, kuriuos galima sumap'inti rankiniu būdu (MANUAL_MAP plėtra)
//
// Šis skriptas:
//   1. Pakraunja ASPCA + pre-DB + aspca-genus-map
//   2. Filtruoja: ASPCA entries, kurie NEsumap'inti
//   3. Bando suggest'inti potencialius genus match'us:
//      - Slug word'as match'ina pre-DB genus
//      - displayName common name fuzzy match
//   4. Output: top 100 unmatched entries su suggest'ed mapping'ais

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ASPCA  = join(__dirname, '..', 'data', 'aspca-toxicity.json')
const PRE_DB = join(__dirname, '..', 'data', 'pre-db.json')
const MAP    = join(__dirname, '..', 'data', 'aspca-genus-map.json')
const OUTPUT = join(__dirname, '..', 'data', 'aspca-unmatched-analysis.json')

const aspca  = JSON.parse(readFileSync(ASPCA, 'utf-8'))
const preDb  = JSON.parse(readFileSync(PRE_DB, 'utf-8'))
const map    = JSON.parse(readFileSync(MAP,    'utf-8'))

const preDbGenera = new Set(Object.keys(preDb.genera).map(g => g.toLowerCase()))
const preDbCommonNames = new Map() // commonName.toLowerCase() → genus
for (const [genus, data] of Object.entries(preDb.genera)) {
  if (data.commonName) {
    preDbCommonNames.set(data.commonName.toLowerCase(), genus)
  }
}

// Set of ASPCA slugs that are already matched
const matchedSlugs = new Set()
for (const [genus, entry] of Object.entries(map.toxicityByGenus ?? {})) {
  for (const e of entry.matchedEntries ?? []) {
    matchedSlugs.add(e.slug)
  }
}

console.log(`[aspca-coverage] ASPCA total: ${Object.keys(aspca.toxicity).length}`)
console.log(`[aspca-coverage] Already matched: ${matchedSlugs.size}`)
console.log(`[aspca-coverage] Unmatched: ${Object.keys(aspca.toxicity).length - matchedSlugs.size}`)
console.log()

// ── Analyze unmatched ─────────────────────────────────────────

const unmatched = []
for (const [slug, entry] of Object.entries(aspca.toxicity)) {
  if (matchedSlugs.has(slug)) continue

  // Try to suggest a genus match
  const suggestions = []

  // 1. Slug word match against pre-DB genera
  for (const word of slug.split(/-/)) {
    if (preDbGenera.has(word) && word.length >= 4) {
      suggestions.push({ source: 'slug-word', genus: word.toUpperCase(), confidence: 'high' })
    }
  }

  // 2. displayName word match (lowercase + split)
  const nameWords = entry.displayName.toLowerCase().split(/[\s'\-,()]+/).filter(Boolean)
  for (const word of nameWords) {
    if (preDbGenera.has(word) && word.length >= 4) {
      const exists = suggestions.find(s => s.genus === word.toUpperCase())
      if (!exists) {
        suggestions.push({ source: 'displayName-word', genus: word.toUpperCase(), confidence: 'medium' })
      }
    }
  }

  // 3. Common name lookup (pre-DB commonName field)
  const nameLower = entry.displayName.toLowerCase()
  for (const [common, genus] of preDbCommonNames) {
    if (nameLower.includes(common) || common.includes(nameLower)) {
      const exists = suggestions.find(s => s.genus === genus)
      if (!exists) {
        suggestions.push({ source: 'pre-db-common-name', genus, confidence: 'medium' })
      }
    }
  }

  unmatched.push({
    slug,
    displayName: entry.displayName,
    toxicTo: entry.toxicTo,
    suggestions,
    suggestionCount: suggestions.length,
  })
}

// Sort: those with suggestions first, then by toxicTo count (more = more important)
unmatched.sort((a, b) => {
  if (a.suggestionCount > 0 && b.suggestionCount === 0) return -1
  if (a.suggestionCount === 0 && b.suggestionCount > 0) return 1
  return b.toxicTo.length - a.toxicTo.length
})

const withSuggestions = unmatched.filter(u => u.suggestionCount > 0)
const noSuggestion = unmatched.filter(u => u.suggestionCount === 0)

console.log('=== UNMATCHED ANALYSIS ===')
console.log(`Total unmatched:             ${unmatched.length}`)
console.log(`With auto-suggestions:       ${withSuggestions.length}`)
console.log(`No suggestions (manual):     ${noSuggestion.length}`)
console.log()
console.log('=== TOP 30 WITH SUGGESTIONS (verify rankiniu) ===')
for (const u of withSuggestions.slice(0, 30)) {
  const sug = u.suggestions.map(s => `${s.genus} (${s.source}/${s.confidence})`).join(', ')
  console.log(`  ${u.displayName.padEnd(40)} → ${sug}`)
  console.log(`    slug: ${u.slug.padEnd(40)} toxicTo: ${u.toxicTo.join('+')}`)
}
console.log()
console.log('=== TOP 20 NO SUGGESTIONS (gal nieks galima padaryti) ===')
for (const u of noSuggestion.slice(0, 20)) {
  console.log(`  ${u.displayName.padEnd(40)} slug: ${u.slug.padEnd(50)} toxicTo: ${u.toxicTo.join('+')}`)
}

const final = {
  generatedAt: new Date().toISOString(),
  source: 'ASPCA unmatched analysis — suggest extensions for MANUAL_MAP in build-aspca-genus-map.mjs',
  totalAspcaEntries: Object.keys(aspca.toxicity).length,
  alreadyMatched: matchedSlugs.size,
  unmatched: unmatched.length,
  withSuggestions: withSuggestions.length,
  noSuggestion: noSuggestion.length,
  entries: {
    withSuggestions,
    noSuggestion: noSuggestion.slice(0, 100), // top 100 only
  },
}

writeFileSync(OUTPUT, JSON.stringify(final, null, 2))
console.log(`\n[aspca-coverage] wrote ${OUTPUT}`)
