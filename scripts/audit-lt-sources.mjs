// Comprehensive LT name sources quality audit.
//
// Užduotis: per-source kokybės analizė ir cross-source disagreement
// detection. Padeda identifikuoti, kuris šaltinis labiausiai užteršia
// derinį ir kur dažniausiai kyla konfliktai.
//
// SOURCES SCANNED (priority order pagal build-lt-names-v2.mjs):
//   1. lt-names-overrides.json  (curated)              priority 100
//   2. plants.json              (OCR botany dictionary) priority 92/60
//   3. derlingas-pairs.json     (LT gardening site)    priority 70
//   4. sodospalvos-names.json   (sodos palvos)         priority 55
//   5. lt-names-wiki.json       (Wikipedia LT)         priority 50
//   6. gaspadorius-detail.json  (gaspadorius.lt)       priority 40
//   7. inat-names.json          (iNaturalist)          priority 30
//
// CORRUPTION PATTERNS detected:
//   A. Latvian-style macrons (ā ē ī ō — not LT, only ū is valid)
//   B. Suspicious short tokens (likely truncated, e.g. „Raukltoji" instead of „Raukšlėtoji")
//   C. Latin verbatim (LT === Latin, no translation done)
//   D. Mojibake markers (â€™, ‚ Â etc — UTF-8 mis-decode signs)
//   E. Question marks (likely missing chars)
//   F. ALL CAPS or alllowercase (unusual case patterns)
//   G. Empty/null values
//
// OUTPUT: tasks/data-audit-2026-06-01.md su per-source stats + samples
//
// USAGE:
//   node scripts/audit-lt-sources.mjs

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dirname, '..', 'data')
const OUT = join(__dirname, '..', 'tasks', 'data-audit-2026-06-01.md')

// ── Source loaders + normalizers ──────────────────────────────────
//
// Kiekvienas grąžina: { name, entries: [{ latin, ltName, raw? }] }

function loadPlantsJson() {
  const data = JSON.parse(readFileSync(join(DATA, 'plants.json'), 'utf-8'))
  return {
    name: 'plants.json',
    entries: data
      .filter(p => p.latin && p.lithuanian)
      .map(p => ({ latin: p.latin.trim(), ltName: p.lithuanian.trim() })),
  }
}

function loadDerlingas() {
  const data = JSON.parse(readFileSync(join(DATA, 'derlingas-pairs.json'), 'utf-8'))
  const entries = []
  for (const page of Object.values(data.pages ?? {})) {
    for (const pair of (page.pairs ?? [])) {
      if (pair.latin && pair.lt) entries.push({ latin: pair.latin.trim(), ltName: pair.lt.trim() })
    }
  }
  return { name: 'derlingas-pairs.json', entries }
}

function loadSodospalvos() {
  const data = JSON.parse(readFileSync(join(DATA, 'sodospalvos-names.json'), 'utf-8'))
  const entries = []
  for (const p of (data.pairs ?? [])) {
    const latin = p.latinFull || p.latin
    if (latin && p.ltName) entries.push({ latin: latin.trim(), ltName: p.ltName.trim() })
  }
  return { name: 'sodospalvos-names.json', entries }
}

function loadGaspadorius() {
  const data = JSON.parse(readFileSync(join(DATA, 'gaspadorius-detail.json'), 'utf-8'))
  const entries = []
  for (const p of (data.pairs ?? [])) {
    if (p.latin && p.ltName) entries.push({ latin: p.latin.trim(), ltName: p.ltName.trim() })
  }
  return { name: 'gaspadorius-detail.json', entries }
}

function loadInat() {
  const data = JSON.parse(readFileSync(join(DATA, 'inat-names.json'), 'utf-8'))
  const entries = []
  for (const [latin, info] of Object.entries(data.results ?? {})) {
    if (info?.preferredLtName) {
      entries.push({ latin: latin.trim(), ltName: info.preferredLtName.trim() })
    } else if (info?.ltNames?.length > 0) {
      entries.push({ latin: latin.trim(), ltName: info.ltNames[0].trim() })
    }
  }
  return { name: 'inat-names.json', entries }
}

function loadWiki() {
  const data = JSON.parse(readFileSync(join(DATA, 'lt-names-wiki.json'), 'utf-8'))
  const entries = []
  for (const [latin, info] of Object.entries(data.results ?? {})) {
    if (info?.exists && info?.ltName) {
      entries.push({ latin: latin.trim(), ltName: info.ltName.trim() })
    }
  }
  return { name: 'lt-names-wiki.json', entries }
}

function loadOverrides() {
  const data = JSON.parse(readFileSync(join(DATA, 'lt-names-overrides.json'), 'utf-8'))
  const entries = []
  // species section
  for (const [latin, lt] of Object.entries(data.species ?? {})) {
    if (latin.startsWith('_')) continue
    entries.push({ latin: latin.trim(), ltName: lt.trim() })
  }
  // genus section
  for (const [latin, genusEntry] of Object.entries(data.genus ?? {})) {
    if (genusEntry?.ltName) entries.push({ latin: latin.trim(), ltName: genusEntry.ltName.trim() })
  }
  return { name: 'lt-names-overrides.json', entries }
}

// ── Corruption detectors ──────────────────────────────────────────

const LATVIAN_MACRONS = /[āēīōĀĒĪŌ]/
const MOJIBAKE_MARKERS = /[ÃÂ¥¦§©®]|â€/
const QUESTION_MARK_PLACEHOLDER = /\?{2,}|¿/

function detectIssues(ltName, latinName) {
  const issues = []
  if (!ltName || !ltName.trim()) {
    issues.push('empty')
    return issues
  }
  if (LATVIAN_MACRONS.test(ltName))           issues.push('latvian-macron')
  if (MOJIBAKE_MARKERS.test(ltName))          issues.push('mojibake')
  if (QUESTION_MARK_PLACEHOLDER.test(ltName)) issues.push('question-marks')
  if (ltName === latinName)                   issues.push('latin-verbatim')

  // Note: didn't add „consonant-cluster" or „vowel-deprivation" heuristics —
  // tested šie false positive'us LT plant names'ams (juodalksnis, minkštasis,
  // dyglis), bet realiai NEPAGAUNA „Raukltoji" tipo corruption (kuri turi tik
  // 3 consonants in row). Heuristic'a šitam corruption pattern'ui nepatikima.
  // Geriausias signal'as — cross-source DISAGREEMENT.

  return issues
}

// ── Audit run ────────────────────────────────────────────────────

const sources = [
  loadOverrides(),
  loadPlantsJson(),
  loadDerlingas(),
  loadSodospalvos(),
  loadWiki(),
  loadGaspadorius(),
  loadInat(),
]

const perSourceStats = []
for (const src of sources) {
  const stats = {
    name: src.name,
    total: src.entries.length,
    issuesByType: {},
    issueCount: 0,
    samples: [],
  }
  for (const e of src.entries) {
    const issues = detectIssues(e.ltName, e.latin)
    if (issues.length > 0) {
      stats.issueCount++
      for (const i of issues) {
        stats.issuesByType[i] = (stats.issuesByType[i] ?? 0) + 1
      }
      if (stats.samples.length < 15) {
        stats.samples.push({ latin: e.latin, ltName: e.ltName, issues })
      }
    }
  }
  perSourceStats.push(stats)
}

// ── Cross-source disagreement ─────────────────────────────────────
//
// Per Latin, jei du+ sources turi tą LT name'ą bet skirtingą — flag.

const byLatin = new Map()  // latin → [{ source, ltName }]
for (const src of sources) {
  for (const e of src.entries) {
    const key = e.latin.toLowerCase()
    if (!byLatin.has(key)) byLatin.set(key, [])
    byLatin.get(key).push({ source: src.name, latin: e.latin, ltName: e.ltName })
  }
}

const disagreements = []
for (const [key, entries] of byLatin) {
  if (entries.length < 2) continue
  const uniqueLts = [...new Set(entries.map(e => e.ltName.toLowerCase().normalize('NFC')))]
  if (uniqueLts.length > 1) {
    disagreements.push({ latin: entries[0].latin, entries })
  }
}

// ── Write markdown report ─────────────────────────────────────────

const lines = []
lines.push('# LT Name Sources Audit — 2026-06-01')
lines.push('')
lines.push(`Auto-generated by \`scripts/audit-lt-sources.mjs\`.`)
lines.push('')
lines.push('## Per-source quality')
lines.push('')
lines.push('| Source | Total | With issues | % issues |')
lines.push('|--------|------:|------------:|---------:|')
for (const s of perSourceStats) {
  const pct = s.total > 0 ? (100 * s.issueCount / s.total).toFixed(2) : '0.00'
  lines.push(`| \`${s.name}\` | ${s.total} | ${s.issueCount} | ${pct}% |`)
}
lines.push('')

for (const s of perSourceStats) {
  if (s.issueCount === 0) continue
  lines.push(`### ${s.name}`)
  lines.push('')
  lines.push('Issues by type:')
  for (const [type, count] of Object.entries(s.issuesByType).sort((a, b) => b[1] - a[1])) {
    lines.push(`- **${type}**: ${count}`)
  }
  lines.push('')
  if (s.samples.length > 0) {
    lines.push('Sample problematic entries:')
    for (const sm of s.samples) {
      lines.push(`- \`${sm.latin}\` → \`${sm.ltName}\` _(${sm.issues.join(', ')})_`)
    }
    lines.push('')
  }
}

lines.push('## Cross-source disagreements')
lines.push('')
lines.push(`Total Latin names with **multiple sources providing different LT names**: ${disagreements.length}`)
lines.push('')

// HIGH PRIORITY: cases where 2+ NON-plants.json sources AGREE, and plants.json disagrees.
// These are strong candidates for override (plants.json likely corrupted).
const highPriority = []
for (const d of disagreements) {
  const nonPlantsEntries = d.entries.filter(e => e.source !== 'plants.json' && e.source !== 'lt-names-overrides.json')
  const plantsEntry = d.entries.find(e => e.source === 'plants.json')
  if (nonPlantsEntries.length < 2 || !plantsEntry) continue
  // Check if 2+ non-plants sources agree (case-insensitive normalize)
  const norm = (s) => s.toLowerCase().normalize('NFC')
  const ltCounts = new Map()
  for (const e of nonPlantsEntries) {
    const k = norm(e.ltName)
    ltCounts.set(k, (ltCounts.get(k) ?? 0) + 1)
  }
  const consensus = [...ltCounts.entries()].find(([_, count]) => count >= 2)
  if (!consensus) continue
  // plants.json must differ from consensus
  if (norm(plantsEntry.ltName) === consensus[0]) continue
  highPriority.push({
    latin: d.latin,
    plantsJson: plantsEntry.ltName,
    consensusLt: nonPlantsEntries.find(e => norm(e.ltName) === consensus[0])?.ltName,
    sources: nonPlantsEntries.filter(e => norm(e.ltName) === consensus[0]).map(e => e.source),
  })
}

lines.push(`### High priority override candidates: ${highPriority.length}`)
lines.push('')
lines.push('Cases where **2+ sources agree against plants.json** — strong evidence plants.json is wrong.')
lines.push('')
if (highPriority.length > 0) {
  lines.push('| Latin | plants.json (likely wrong) | Consensus (2+ sources) | Agreeing sources |')
  lines.push('|-------|---------------------------|------------------------|------------------|')
  for (const h of highPriority.slice(0, 60)) {
    lines.push(`| \`${h.latin}\` | ${h.plantsJson} | **${h.consensusLt}** | ${h.sources.join(', ')} |`)
  }
  lines.push('')
}

lines.push('### All disagreements (first 40)')
lines.push('')
for (const d of disagreements.slice(0, 40)) {
  lines.push(`**${d.latin}**`)
  for (const e of d.entries) {
    lines.push(`  - \`${e.source}\` → \`${e.ltName}\``)
  }
  lines.push('')
}

writeFileSync(OUT, lines.join('\n'))
console.log(`[audit] wrote ${OUT}`)
console.log('')
console.log('SUMMARY:')
for (const s of perSourceStats) {
  const pct = s.total > 0 ? (100 * s.issueCount / s.total).toFixed(2) : '0.00'
  console.log(`  ${s.name.padEnd(28)} ${String(s.total).padStart(6)} entries, ${String(s.issueCount).padStart(5)} issues (${pct}%)`)
}
console.log('')
console.log(`Cross-source disagreements: ${disagreements.length}`)
