/**
 * audit-vendor-plantlist.mjs — Read-only audit of vendor plant list scrape
 * from geliustebuklai.lt (data/Plant list/*.json).
 *
 * Klasifikuoja kiekvieną įvardiją:
 *   ✅ DB recognized — species-lt-names.json hit (binomial match)
 *   🟢 Genus known    — lt-names.json hit (genus level)
 *   ❓ Unknown        — niekur DB'e, reikia AI lookup'o
 *   🚫 Suspect        — vendor garbage / typo / dimensions
 *
 * Plus vendor pattern flags:
 *   - Unquoted cultivar (Variegata, Cristata, etc.)
 *   - Dimensions (120 cm, 5L)
 *   - Multi-word commercial trade names
 *   - Non-Latin first token
 *
 * Output:
 *   tasks/vendor-plantlist-audit-2026-05-31.md
 *
 * Run:
 *   node scripts/audit-vendor-plantlist.mjs
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PLANTLIST_DIR = join(__dirname, '..', 'data', 'Plant list')
const DATA_DIR = join(__dirname, '..', 'data')
const OUT = join(__dirname, '..', 'tasks', 'vendor-plantlist-audit-2026-05-31.md')

// ─── Load reference data ────────────────────────────────────────
const ltNames = JSON.parse(readFileSync(join(DATA_DIR, 'lt-names.json'), 'utf8'))
const speciesLt = JSON.parse(readFileSync(join(DATA_DIR, 'species-lt-names.json'), 'utf8'))
const preDb = JSON.parse(readFileSync(join(DATA_DIR, 'pre-db.json'), 'utf8'))

const knownGenera = new Set(Object.keys(ltNames.ltNames))      // canonical
const knownGeneraLowercase = new Set([...knownGenera].map(g => g.toLowerCase()))
const knownSpecies = new Set(Object.keys(speciesLt))           // already lowercased

// ─── Vendor pattern detectors ────────────────────────────────────
const RX_DIMENSIONS = /\b(\d+\s*(cm|m|l|mm|"|''))\b/i
const RX_POT = /\b(potted|pot|vazone|h\d+)\b/i
const RX_UNQUOTED_CULTIVAR = /\s+[A-Z][a-z]+\s+[A-Z][a-z]+\s*$/  // last 2 caps
const VENDOR_MARKETING = /\b(silver|gold|pearl|royal|mystic|fantasy|magic|wonder|nite\s*lite|el\s*dorado|moonshine|black\s*coral|paradise|sunshine|rainbow|cherry|chocolate|caramel|sunset|sunrise|midnight)\b/i

function classify(name) {
  if (!name) return { category: 'invalid', reason: 'empty' }

  const trimmed = name.trim()
  const flags = []

  // Check for dimensions/pot info FIRST (clear vendor garbage)
  if (RX_DIMENSIONS.test(trimmed)) flags.push('dimensions')
  if (RX_POT.test(trimmed)) flags.push('pot-info')

  // Tokenize
  const tokens = trimmed.replace(/[,()]/g, ' ').split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return { category: 'invalid', reason: 'no-tokens', flags }

  const genus = tokens[0]
  // First token must be capitalized Latin word
  if (!/^[A-Z][a-z]+$/.test(genus)) {
    flags.push('non-latin-first')
    return { category: 'suspect', reason: 'first-token-not-latin', genus: null, flags }
  }

  // Check genus in our DB
  const genusKnown = knownGenera.has(genus) || knownGeneraLowercase.has(genus.toLowerCase())

  // Detect vendor marketing names
  if (VENDOR_MARKETING.test(trimmed)) flags.push('vendor-marketing')

  // Detect unquoted cultivar (capitalized 2nd/3rd token that's not a species epithet)
  // Species epithets are lowercase. If we see "Sansevieria Aubrytiana" with cap A, suspect.
  if (tokens[1] && /^[A-Z]/.test(tokens[1])) {
    // Could be hybrid notation "× Genus" or a trade name
    if (tokens[1] !== '×') flags.push('cap-second-token')
  }

  // Build binomial
  let binomial = null
  if (tokens.length >= 2 && /^[a-z]/.test(tokens[1])) {
    binomial = `${genus.toLowerCase()} ${tokens[1].toLowerCase().replace(/['"]/g, '')}`
  }

  // Classify
  if (binomial && knownSpecies.has(binomial)) {
    return { category: 'db-recognized', genus, binomial, ltName: speciesLt[binomial], flags }
  }
  if (genusKnown) {
    return { category: 'genus-known', genus, ltName: ltNames.ltNames[genus]?.ltName, binomial, flags }
  }
  // Check pre-DB even if no LT name (might be valid genus we just don't have LT for)
  if (preDb.genera?.[genus]) {
    return { category: 'predb-only', genus, binomial, flags }
  }

  return { category: 'unknown', genus, binomial, flags }
}

// ─── Process files ──────────────────────────────────────────────
const files = readdirSync(PLANTLIST_DIR).filter(f => f.endsWith('.json'))
const results = { byFile: {}, byCategory: {}, byFlag: {}, samples: {}, total: 0 }

for (const file of files) {
  const data = JSON.parse(readFileSync(join(PLANTLIST_DIR, file), 'utf8'))
  const entries = Array.isArray(data) ? data : []
  results.byFile[file] = { total: entries.length, byCategory: {} }
  for (const entry of entries) {
    results.total++
    const cls = classify(entry.name)
    const cat = cls.category
    results.byCategory[cat] = (results.byCategory[cat] || 0) + 1
    results.byFile[file].byCategory[cat] = (results.byFile[file].byCategory[cat] || 0) + 1
    for (const f of cls.flags || []) results.byFlag[f] = (results.byFlag[f] || 0) + 1
    if (!results.samples[cat]) results.samples[cat] = []
    if (results.samples[cat].length < 15) {
      results.samples[cat].push({ name: entry.name, ...cls })
    }
  }
}

// ─── Dedupe analysis ────────────────────────────────────────────
const seenNames = new Set()
const dupes = []
for (const file of files) {
  const data = JSON.parse(readFileSync(join(PLANTLIST_DIR, file), 'utf8'))
  for (const e of (data || [])) {
    if (!e.name) continue
    const key = e.name.toLowerCase().trim()
    if (seenNames.has(key)) dupes.push(e.name)
    seenNames.add(key)
  }
}

// ─── Genus distribution ─────────────────────────────────────────
const genusCount = new Map()
for (const file of files) {
  const data = JSON.parse(readFileSync(join(PLANTLIST_DIR, file), 'utf8'))
  for (const e of (data || [])) {
    const cls = classify(e.name)
    if (cls.genus) genusCount.set(cls.genus, (genusCount.get(cls.genus) || 0) + 1)
  }
}
const topGenera = [...genusCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)

// ─── Generate report ────────────────────────────────────────────
let md = `# Vendor plantlist audit — geliustebuklai.lt
**Date:** 2026-05-31
**Source:** data/Plant list/ (4 JSON files iš vendor scrape)
**Tool:** scripts/audit-vendor-plantlist.mjs (READ-ONLY)
**Reference DBs:** lt-names.json (post-v2 rebuild), species-lt-names.json, pre-db.json

---

## TL;DR

| | Count | % |
|---|---|---|
| **Total entries** | ${results.total} | 100% |
${Object.entries(results.byCategory).sort((a, b) => b[1] - a[1]).map(([k, v]) =>
  `| ${k} | ${v} | ${(v / results.total * 100).toFixed(1)}% |`
).join('\n')}
| Duplicates (across files) | ${dupes.length} | ${(dupes.length / results.total * 100).toFixed(1)}% |

---

## Per file breakdown

| File | Total | DB recognized | Genus-known | Pre-DB only | Unknown | Suspect |
|---|---|---|---|---|---|---|
${files.map(f => {
  const r = results.byFile[f]
  return `| ${f} | ${r.total} | ${r.byCategory['db-recognized']||0} | ${r.byCategory['genus-known']||0} | ${r.byCategory['predb-only']||0} | ${r.byCategory['unknown']||0} | ${r.byCategory['suspect']||0} |`
}).join('\n')}

---

## Vendor pattern flags

| Flag | Count |
|---|---|
${Object.entries(results.byFlag).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`).join('\n')}

---

## Samples per category

`

for (const [cat, samples] of Object.entries(results.samples)) {
  md += `### ${cat} (showing up to 15)\n\n`
  for (const s of samples) {
    const flags = s.flags?.length ? ` [${s.flags.join(', ')}]` : ''
    const lt = s.ltName ? ` → "${s.ltName}"` : ''
    md += `- \`${s.name}\`${flags}${lt}\n`
  }
  md += `\n`
}

md += `---

## Top 30 most common genera

| Genus | Count | DB status |
|---|---|---|
${topGenera.map(([g, c]) => {
  const known = knownGenera.has(g) ? `✓ ${ltNames.ltNames[g].ltName}` : '✗ not in DB'
  return `| ${g} | ${c} | ${known} |`
}).join('\n')}

---

## Duplicates (first 20 samples)

${dupes.slice(0, 20).map(d => `- \`${d}\``).join('\n') || '_none_'}

---

## Recommendations

### Tinkami for batch save (no AI needed)
- **DB recognized (${results.byCategory['db-recognized']||0} entries)**: instant catalog entries with full LT names already known.
- **Genus-known (${results.byCategory['genus-known']||0} entries)**: species-qualified fallback via resolveLt construct'ina „[genus] [epithet]" (e.g. „Sansevjera zeylanica"). Saugu.

### Reikalauja AI verification
- **Pre-DB only (${results.byCategory['predb-only']||0} entries)**: genus in pre-DB but no LT name yet. Could AI-verify and add to lt-names-overrides.json.
- **Unknown (${results.byCategory['unknown']||0} entries)**: full AI lookup needed (~30s + cost per entry).

### Skip ar manual review
- **Suspect (${results.byCategory['suspect']||0} entries)**: dimensions in name, non-Latin first token, etc. Don't auto-save.
- **Vendor-marketing flags**: e.g. „El Dorado", „Nite Lite" — even if genus matches, these are vendor-specific cultivars that need verification (often hallucination risk).

### Žinome iš prior fix'ų
- „Sansevieria aubrytiana Nite Lite" tipo vardai → mūsų AI dabar žino, kad „aubrytiana" yra fake species (post-2026-05-30 prompt fix). Bus suklasifikuotas teisingai į trifasciata.
- „Cap second token" flag (e.g. „Calathea Velvet Glory") — daugumai šių reikia AI'aus, kuris pasakys ar yra accepted name.

---

## Suggested next steps

1. **Phase A (now)**: review this audit. Identify clear no-go entries.
2. **Phase B (later)**: run AI batch identification on \`genus-known\` + \`unknown\` entries → categorize confidence. Output JSON for review.
3. **Phase C (eventually)**: batch save HIGH-confidence into catalog (via /api/save-plant or direct Firestore). Skip MEDIUM/LOW for manual review.

Total potential catalog additions: ~${(results.byCategory['db-recognized']||0) + (results.byCategory['genus-known']||0)} entries (instant) + ${results.byCategory['unknown']||0} require AI (~$${((results.byCategory['unknown']||0) * 0.05).toFixed(2)} estimated).
`

writeFileSync(OUT, md)
console.log(`✓ Audit complete. Report: ${OUT}`)
console.log()
console.log(`Total entries: ${results.total}`)
console.log(`Categories:`)
for (const [k, v] of Object.entries(results.byCategory).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(20)} ${v} (${(v / results.total * 100).toFixed(1)}%)`)
}
console.log(`Duplicates: ${dupes.length}`)
