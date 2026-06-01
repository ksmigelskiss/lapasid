// Auto-add high-priority override candidates iš data audit'o
// (tasks/data-audit-2026-06-01.md). Logika identiškai kaip audit-lt-sources.mjs —
// 2+ non-plants sources sutaria PRIEŠ plants.json → consensus tampa override.
//
// SAUGUMAS:
//   • Naudoja TIK auto-detected consensus (ne mūsų guess)
//   • Skip jei jau yra override (preserve manual fixes)
//   • Skip jei consensus identical su plants.json (no fix needed)
//   • parseLatinName decides genus vs species section
//
// USAGE:
//   node scripts/apply-audit-overrides.mjs --dry-run
//   node scripts/apply-audit-overrides.mjs

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseLatinName } from '../src/utils/latinName.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dirname, '..', 'data')
const OVERRIDES_PATH = join(DATA, 'lt-names-overrides.json')
const DRY_RUN = process.argv.includes('--dry-run')

// ── Loaders (mirror audit script) ────────────────────────────────

function loadPlantsJson() {
  const data = JSON.parse(readFileSync(join(DATA, 'plants.json'), 'utf-8'))
  return data.filter(p => p.latin && p.lithuanian).map(p => ({
    source: 'plants.json',
    latin: p.latin.trim(),
    ltName: p.lithuanian.trim(),
  }))
}

function loadDerlingas() {
  const data = JSON.parse(readFileSync(join(DATA, 'derlingas-pairs.json'), 'utf-8'))
  const out = []
  for (const page of Object.values(data.pages ?? {})) {
    for (const pair of (page.pairs ?? [])) {
      if (pair.latin && pair.lt) out.push({ source: 'derlingas-pairs.json', latin: pair.latin.trim(), ltName: pair.lt.trim() })
    }
  }
  return out
}

function loadSodospalvos() {
  const data = JSON.parse(readFileSync(join(DATA, 'sodospalvos-names.json'), 'utf-8'))
  const out = []
  for (const p of (data.pairs ?? [])) {
    const latin = p.latinFull || p.latin
    if (latin && p.ltName) out.push({ source: 'sodospalvos-names.json', latin: latin.trim(), ltName: p.ltName.trim() })
  }
  return out
}

function loadGaspadorius() {
  const data = JSON.parse(readFileSync(join(DATA, 'gaspadorius-detail.json'), 'utf-8'))
  const out = []
  for (const p of (data.pairs ?? [])) {
    if (p.latin && p.ltName) out.push({ source: 'gaspadorius-detail.json', latin: p.latin.trim(), ltName: p.ltName.trim() })
  }
  return out
}

function loadInat() {
  const data = JSON.parse(readFileSync(join(DATA, 'inat-names.json'), 'utf-8'))
  const out = []
  for (const [latin, info] of Object.entries(data.results ?? {})) {
    const lt = info?.preferredLtName || info?.ltNames?.[0]
    if (lt) out.push({ source: 'inat-names.json', latin: latin.trim(), ltName: lt.trim() })
  }
  return out
}

function loadWiki() {
  const data = JSON.parse(readFileSync(join(DATA, 'lt-names-wiki.json'), 'utf-8'))
  const out = []
  for (const [latin, info] of Object.entries(data.results ?? {})) {
    if (info?.exists && info?.ltName) out.push({ source: 'lt-names-wiki.json', latin: latin.trim(), ltName: info.ltName.trim() })
  }
  return out
}

// ── Collect all entries ─────────────────────────────────────────

const all = [
  ...loadPlantsJson(),
  ...loadDerlingas(),
  ...loadSodospalvos(),
  ...loadGaspadorius(),
  ...loadInat(),
  ...loadWiki(),
]

const byLatin = new Map()
for (const e of all) {
  const key = e.latin.toLowerCase()
  if (!byLatin.has(key)) byLatin.set(key, [])
  byLatin.get(key).push(e)
}

// ── Find high-priority candidates ─────────────────────────────

const norm = (s) => s.toLowerCase().normalize('NFC')

const candidates = []
for (const [key, entries] of byLatin) {
  const plantsEntry = entries.find(e => e.source === 'plants.json')
  if (!plantsEntry) continue
  const nonPlants = entries.filter(e => e.source !== 'plants.json')
  if (nonPlants.length < 2) continue

  const ltCounts = new Map()
  const ltExamples = new Map()
  for (const e of nonPlants) {
    const k = norm(e.ltName)
    ltCounts.set(k, (ltCounts.get(k) ?? 0) + 1)
    if (!ltExamples.has(k)) ltExamples.set(k, e.ltName)
  }
  const consensus = [...ltCounts.entries()].find(([_, count]) => count >= 2)
  if (!consensus) continue
  if (norm(plantsEntry.ltName) === consensus[0]) continue

  // Normalize ALL CAPS → Title case (some sources e.g. sodospalvos use headers ALL CAPS).
  // First letter Upper, rest lower per word. Preserve LT diacritics.
  const consensusName = ltExamples.get(consensus[0])
  const normalizedConsensus = /^[\p{Lu}\s'-]+$/u.test(consensusName)
    ? consensusName.toLowerCase().split(/(\s+)/).map((w, i) =>
        i % 2 === 1 ? w : w.charAt(0).toUpperCase() + w.slice(1)
      ).join('')
    : consensusName

  candidates.push({
    latin: plantsEntry.latin,
    plantsJson: plantsEntry.ltName,
    consensusLt: normalizedConsensus,
    sources: nonPlants.filter(e => norm(e.ltName) === consensus[0]).map(e => e.source),
  })
}

console.log(`[apply-overrides] ${candidates.length} candidates found`)

// ── Read existing overrides ──────────────────────────────────

const overrides = JSON.parse(readFileSync(OVERRIDES_PATH, 'utf-8'))
overrides.genus = overrides.genus ?? {}
overrides.species = overrides.species ?? {}

// Build existing override key sets (case-insensitive)
const existingGenusKeys = new Set(Object.keys(overrides.genus).map(k => k.toLowerCase()))
const existingSpeciesKeys = new Set(Object.keys(overrides.species).map(k => k.toLowerCase()))

// ── Classify each candidate by rank + check duplicates ──────

const newGenusEntries = []
const newSpeciesEntries = []
const skipped = []

for (const c of candidates) {
  const parsed = parseLatinName(c.latin)
  if (!parsed.genus) { skipped.push({ ...c, reason: 'unparsable' }); continue }

  if (parsed.rank === 'genus') {
    const key = parsed.genus  // preserve original case for genus section
    if (existingGenusKeys.has(key.toLowerCase())) {
      skipped.push({ ...c, reason: 'existing-genus-override' })
      continue
    }
    newGenusEntries.push({ key, ltName: c.consensusLt, candidate: c })
  } else {
    // species or cultivar
    const key = c.latin.toLowerCase()
    if (existingSpeciesKeys.has(key)) {
      skipped.push({ ...c, reason: 'existing-species-override' })
      continue
    }
    newSpeciesEntries.push({ key, ltName: c.consensusLt, candidate: c })
  }
}

console.log(`[apply-overrides] new genus entries:   ${newGenusEntries.length}`)
console.log(`[apply-overrides] new species entries: ${newSpeciesEntries.length}`)
console.log(`[apply-overrides] skipped (existing/unparsable): ${skipped.length}`)

if (DRY_RUN) {
  console.log('\n=== GENUS overrides preview (first 30) ===')
  for (const e of newGenusEntries.slice(0, 30)) {
    console.log(`  ${e.key.padEnd(28)} → ${e.ltName.padEnd(35)} (vs plants.json: ${e.candidate.plantsJson})`)
  }
  console.log('\n=== SPECIES overrides preview (first 30) ===')
  for (const e of newSpeciesEntries.slice(0, 30)) {
    console.log(`  ${e.key.padEnd(36)} → ${e.ltName.padEnd(35)} (vs plants.json: ${e.candidate.plantsJson})`)
  }
  process.exit(0)
}

// ── Apply overrides to JSON ────────────────────────────────

for (const e of newGenusEntries) {
  overrides.genus[e.key] = {
    ltName: e.ltName,
    ltSynonyms: [],
    source: `audit-2026-06-01 (consensus: ${e.candidate.sources.join('+')})`,
  }
}

for (const e of newSpeciesEntries) {
  overrides.species[e.key] = e.ltName
}

writeFileSync(OVERRIDES_PATH, JSON.stringify(overrides, null, 2) + '\n')
console.log(`[apply-overrides] wrote ${OVERRIDES_PATH}`)
console.log(`  total genus entries now:   ${Object.keys(overrides.genus).length}`)
console.log(`  total species entries now: ${Object.keys(overrides.species).filter(k => !k.startsWith('_')).length}`)
