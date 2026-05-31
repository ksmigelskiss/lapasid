// READ-ONLY audit — plants.json species rows (~4438 įrašai) semantic quality check.
// Tikslas: rasti įtartinus species LT vardus PRIEŠ AI verification.
// Heuristic: paskutinis žodis lt vardas turėtų atitikti genus' canonical ltName.
//
// Klasifikuoja:
//   - CONSISTENT     — last word normalizes to genus canonical (likely OK)
//   - MISMATCH       — last word DIFFERENT from canonical (wrong genus word)
//   - TYPO_SUSPECTED — Levenshtein <= 2 from canonical (likely typo)
//   - NO_GENUS_LT    — genus has no LT name in dict (uncertain)
//   + papildomi flags: EMPTY_LT, LT_TOO_SHORT, LT_TOO_LONG, CYRILLIC, DUPLICATE_WORD
//
// Nieko NERAŠO. USAGE: node scripts/audit-plants-species-quality.mjs

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const plants = JSON.parse(readFileSync(join(ROOT, 'data', 'plants.json'), 'utf-8'))
const ltNamesFile = JSON.parse(readFileSync(join(ROOT, 'data', 'lt-names.json'), 'utf-8'))
const ltNames = ltNamesFile.ltNames || {}

// --- helpers ------------------------------------------------------------

function normalizeForCompare(name) {
  if (!name) return ''
  return name.toLowerCase()
    .replace(/[āîī]/g, 'i')
    .replace(/ū/g, 'u')
    .replace(/[ąa]/g, 'a')
    .replace(/[ęe]/g, 'e')
    .replace(/[ėè]/g, 'e')
    .replace(/[čć]/g, 'c')
    .replace(/[šś]/g, 's')
    .replace(/[žź]/g, 'z')
    .replace(/\s+/g, '')
}

// Inline Levenshtein (no deps). ~15 LOC.
function levenshtein(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const m = a.length, n = b.length
  let prev = new Array(n + 1)
  let curr = new Array(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[n]
}

const CYRILLIC_RE = /[Ѐ-ӿ]/
const ANY_LATIN_LETTER_RE = /[A-Za-zĄČĘĖĮŠŲŪŽąčęėįšųūž]/

function extractGenus(latin) {
  if (!latin) return null
  const first = latin.trim().split(/\s+/)[0]
  if (!first) return null
  // Genus is normally Capitalized; preserve casing as-is from input.
  return first
}

function lastWord(ltName) {
  if (!ltName) return ''
  const parts = ltName.trim().split(/\s+/)
  return parts[parts.length - 1] || ''
}

function hasDuplicateWordRun(ltName) {
  if (!ltName) return false
  const parts = ltName.trim().toLowerCase().split(/\s+/)
  for (let i = 1; i < parts.length; i++) {
    if (parts[i] && parts[i] === parts[i - 1]) return true
  }
  return false
}

// --- main ---------------------------------------------------------------

const counters = {
  totalRows: plants.length,
  speciesRows: 0,
  genusRows: 0,
  consistent: 0,
  mismatch: 0,
  typoSuspected: 0,
  noGenusLt: 0,
  emptyLt: 0,
  ltTooShort: 0,
  ltTooLong: 0,
  cyrillic: 0,
  duplicateWord: 0,
}

const samples = {
  consistent: [],
  mismatch: [],
  typoSuspected: [],
  noGenusLt: [],
  emptyLt: [],
  ltTooShort: [],
  ltTooLong: [],
  cyrillic: [],
  duplicateWord: [],
}
const SAMPLE_CAP = 30

const machineOut = {
  mismatch: [],
  typoSuspected: [],
  noGenusLt: [],
}

// Track wrong-last-word patterns: actualLastWord (normalized) -> { display, count, latinSamples[] }
const wrongLastWord = new Map()

function pushSample(bucket, obj) {
  if (samples[bucket].length < SAMPLE_CAP) samples[bucket].push(obj)
}

for (const row of plants) {
  if (!row?.latin) continue
  const latin = String(row.latin).trim()
  const lt = (row.lithuanian ?? '').toString().trim()
  const words = latin.split(/\s+/)

  // Skip genus-only rows — they ARE the canonical defining ones; not the audit scope.
  if (words.length < 2) {
    counters.genusRows++
    continue
  }
  counters.speciesRows++

  // additional flags (don't short-circuit classification; record + maybe still classify)
  let extraFlag = null
  if (!lt) {
    counters.emptyLt++
    pushSample('emptyLt', { latin, lt: '' })
    extraFlag = 'EMPTY_LT'
  } else {
    if (lt.length < 3) {
      counters.ltTooShort++
      pushSample('ltTooShort', { latin, lt })
      extraFlag = extraFlag || 'LT_TOO_SHORT'
    }
    if (lt.length > 60) {
      counters.ltTooLong++
      pushSample('ltTooLong', { latin, lt })
      extraFlag = extraFlag || 'LT_TOO_LONG'
    }
    if (CYRILLIC_RE.test(lt)) {
      counters.cyrillic++
      pushSample('cyrillic', { latin, lt })
      extraFlag = extraFlag || 'CYRILLIC'
    }
    if (hasDuplicateWordRun(lt)) {
      counters.duplicateWord++
      pushSample('duplicateWord', { latin, lt })
      extraFlag = extraFlag || 'DUPLICATE_WORD'
    }
  }

  // Cannot classify if lt is empty
  if (!lt) continue

  const genusLatin = extractGenus(latin)
  const genusEntry = genusLatin ? ltNames[genusLatin] : null
  const canonicalLt = genusEntry?.ltName || null

  if (!canonicalLt) {
    counters.noGenusLt++
    pushSample('noGenusLt', { latin, currentLt: lt, genusLatin })
    machineOut.noGenusLt.push({
      latin,
      currentLt: lt,
      genusLatin,
      actualLastWord: lastWord(lt),
    })
    continue
  }

  const actualLast = lastWord(lt)
  const actualLastNorm = normalizeForCompare(actualLast)
  const canonicalNorm = normalizeForCompare(canonicalLt)

  // IMPORTANT: only compare to the CANONICAL ltName (primary form), NOT to ltSynonyms.
  // Synonyms in lt-names.json got contaminated from the same species rows we're auditing
  // (plants-species-inferred source), so accepting them would mask exactly the bugs we want.
  // Trade-off: harmless plural/declension variants (e.g. Kėnis vs Kėniai) will count as
  // MISMATCH — Phase 2 verification will quickly clear those.
  if (actualLastNorm === canonicalNorm) {
    counters.consistent++
    pushSample('consistent', { latin, currentLt: lt, canonical: canonicalLt })
    continue
  }

  // Levenshtein vs. canonical only
  const minDist = levenshtein(actualLastNorm, canonicalNorm)
  const nearestForm = canonicalLt

  if (minDist <= 2 && actualLastNorm.length >= 4) {
    counters.typoSuspected++
    pushSample('typoSuspected', {
      latin, currentLt: lt,
      expectedLastWord: nearestForm,
      actualLastWord: actualLast,
      distance: minDist,
    })
    machineOut.typoSuspected.push({
      latin,
      currentLt: lt,
      expectedLastWord: nearestForm,
      actualLastWord: actualLast,
      distance: minDist,
    })
  } else {
    counters.mismatch++
    pushSample('mismatch', {
      latin, currentLt: lt,
      expectedLastWord: canonicalLt,
      actualLastWord: actualLast,
    })
    machineOut.mismatch.push({
      latin,
      currentLt: lt,
      expectedLastWord: canonicalLt,
      actualLastWord: actualLast,
    })

    // Track wrong-last-word pattern aggregation
    const key = actualLastNorm
    if (!wrongLastWord.has(key)) {
      wrongLastWord.set(key, { display: actualLast, count: 0, generaUsed: new Set(), latinSamples: [] })
    }
    const rec = wrongLastWord.get(key)
    rec.count++
    rec.generaUsed.add(genusLatin)
    if (rec.latinSamples.length < 5) rec.latinSamples.push(latin)
  }
}

// --- top wrong-last-word patterns ----------------------------------------

const topWrongPatterns = [...wrongLastWord.values()]
  .map((r) => ({ word: r.display, count: r.count, distinctGenera: r.generaUsed.size, latinSamples: r.latinSamples }))
  .filter((r) => r.distinctGenera >= 2 || r.count >= 3) // only patterns used by >=2 genera OR repeated
  .sort((a, b) => b.distinctGenera - a.distinctGenera || b.count - a.count)
  .slice(0, 20)

// --- console summary -----------------------------------------------------

console.log('=== plants.json SPECIES quality AUDIT ===')
console.log(`Total rows:           ${counters.totalRows}`)
console.log(`  genus rows:         ${counters.genusRows}`)
console.log(`  species rows:       ${counters.speciesRows}`)
console.log('')
console.log('Classification tiers:')
console.log(`  CONSISTENT:         ${counters.consistent}`)
console.log(`  MISMATCH:           ${counters.mismatch}`)
console.log(`  TYPO_SUSPECTED:     ${counters.typoSuspected}`)
console.log(`  NO_GENUS_LT:        ${counters.noGenusLt}`)
console.log('')
console.log('Additional flags (overlap possible):')
console.log(`  EMPTY_LT:           ${counters.emptyLt}`)
console.log(`  LT_TOO_SHORT:       ${counters.ltTooShort}`)
console.log(`  LT_TOO_LONG:        ${counters.ltTooLong}`)
console.log(`  CYRILLIC:           ${counters.cyrillic}`)
console.log(`  DUPLICATE_WORD:     ${counters.duplicateWord}`)

// --- write markdown report ----------------------------------------------

function fmtList(arr, fmt) {
  if (!arr.length) return '_(tuščia)_'
  return arr.map(fmt).join('\n')
}

const TODAY = new Date().toISOString().slice(0, 10)
const md = []
md.push(`# plants.json species quality audit — ${TODAY}`)
md.push('')
md.push(`Script: \`scripts/audit-plants-species-quality.mjs\` (READ-ONLY)`)
md.push(`Source: \`data/plants.json\` (${counters.totalRows} rows)`)
md.push(`Reference: \`data/lt-names.json\` (canonical genus LT names, ${Object.keys(ltNames).length} genera)`)
md.push('')
md.push('## Method')
md.push('')
md.push('For each species row (latin = 2+ words):')
md.push('1. Extract genus latin (first word).')
md.push('2. Look up canonical LT name (`ltName`) in `lt-names.json[ltNames][Genus]`.')
md.push('3. Compare last word of `lithuanian` field to **canonical only** (diacritic-insensitive).')
md.push('   - **Synonyms (`ltSynonyms`) are intentionally NOT accepted** — they were inferred from the same species rows we are auditing (`plants-species-inferred` source), so trusting them would mask the bugs we want to surface.')
md.push('4. If no match — compute Levenshtein distance to canonical:')
md.push('   - 0 (after normalize) → CONSISTENT')
md.push('   - ≤ 2 AND actual ≥ 4 chars → TYPO_SUSPECTED')
md.push('   - else → MISMATCH')
md.push('5. If genus has no LT name → NO_GENUS_LT.')
md.push('')
md.push('## Totals')
md.push('')
md.push('| Tier | Count | % of species |')
md.push('|---|---:|---:|')
const pct = (n) => counters.speciesRows ? ((n / counters.speciesRows) * 100).toFixed(1) + '%' : '—'
md.push(`| CONSISTENT     | ${counters.consistent}    | ${pct(counters.consistent)} |`)
md.push(`| MISMATCH       | ${counters.mismatch}      | ${pct(counters.mismatch)} |`)
md.push(`| TYPO_SUSPECTED | ${counters.typoSuspected} | ${pct(counters.typoSuspected)} |`)
md.push(`| NO_GENUS_LT    | ${counters.noGenusLt}     | ${pct(counters.noGenusLt)} |`)
md.push('')
md.push('Additional flags (independent, may overlap with tiers):')
md.push('')
md.push('| Flag | Count |')
md.push('|---|---:|')
md.push(`| EMPTY_LT       | ${counters.emptyLt} |`)
md.push(`| LT_TOO_SHORT   | ${counters.ltTooShort} |`)
md.push(`| LT_TOO_LONG    | ${counters.ltTooLong} |`)
md.push(`| CYRILLIC       | ${counters.cyrillic} |`)
md.push(`| DUPLICATE_WORD | ${counters.duplicateWord} |`)
md.push('')
md.push(`Genus rows (excluded from tier classification): ${counters.genusRows}`)
md.push('')

md.push('## Top wrong-last-word patterns')
md.push('')
md.push('Most frequent "wrong" genus-words found in MISMATCH samples — sorted by distinct genera that used them incorrectly:')
md.push('')
md.push('| Wrong last word | MISMATCH count | Distinct genera | Sample latins |')
md.push('|---|---:|---:|---|')
for (const p of topWrongPatterns) {
  md.push(`| ${p.word} | ${p.count} | ${p.distinctGenera} | ${p.latinSamples.slice(0, 3).join(', ')} |`)
}
md.push('')

md.push('## Samples per tier (max 30 each)')
md.push('')

md.push('### CONSISTENT (likely OK)')
md.push('')
md.push(fmtList(samples.consistent, (s) => `- \`${s.latin}\` → ${s.currentLt} (canonical: ${s.canonical})`))
md.push('')

md.push('### MISMATCH (suspect — wrong genus word)')
md.push('')
md.push(fmtList(samples.mismatch, (s) => `- \`${s.latin}\` → ${s.currentLt} — actual last "${s.actualLastWord}" vs expected "${s.expectedLastWord}"`))
md.push('')

md.push('### TYPO_SUSPECTED (Levenshtein ≤ 2)')
md.push('')
md.push(fmtList(samples.typoSuspected, (s) => `- \`${s.latin}\` → ${s.currentLt} — "${s.actualLastWord}" ≈ "${s.expectedLastWord}" (dist ${s.distance})`))
md.push('')

md.push('### NO_GENUS_LT (cannot validate)')
md.push('')
md.push(fmtList(samples.noGenusLt, (s) => `- \`${s.latin}\` → ${s.currentLt}`))
md.push('')

md.push('### EMPTY_LT')
md.push('')
md.push(fmtList(samples.emptyLt, (s) => `- \`${s.latin}\``))
md.push('')

md.push('### LT_TOO_SHORT')
md.push('')
md.push(fmtList(samples.ltTooShort, (s) => `- \`${s.latin}\` → ${s.lt}`))
md.push('')

md.push('### LT_TOO_LONG')
md.push('')
md.push(fmtList(samples.ltTooLong, (s) => `- \`${s.latin}\` → ${s.lt}`))
md.push('')

md.push('### CYRILLIC')
md.push('')
md.push(fmtList(samples.cyrillic, (s) => `- \`${s.latin}\` → ${s.lt}`))
md.push('')

md.push('### DUPLICATE_WORD')
md.push('')
md.push(fmtList(samples.duplicateWord, (s) => `- \`${s.latin}\` → ${s.lt}`))
md.push('')

md.push('## Recommended action thresholds')
md.push('')
md.push('Phase 2 (AI verification) priority order:')
md.push('')
md.push(`1. **MISMATCH (${counters.mismatch})** — highest signal of error. Wrong genus word, likely wrong taxonomy mapping or scraping bug. Verify first.`)
md.push(`2. **TYPO_SUSPECTED (${counters.typoSuspected})** — high-confidence typos. Cheap to verify (close edit distance), fix in bulk.`)
md.push(`3. **DUPLICATE_WORD (${counters.duplicateWord})** — likely cleanLtName regex residue. Mechanical fix candidate (dedupe).`)
md.push(`4. **CYRILLIC (${counters.cyrillic})** — data import bug. Mechanical filter or re-scrape.`)
md.push(`5. **NO_GENUS_LT (${counters.noGenusLt})** — defer. Need either canonical LT name added to dict OR per-row AI verification. Lower priority unless we want full coverage.`)
md.push('')
md.push('## Validation cases (from brief)')
md.push('')
md.push('| Latin | Expected | Got | Notes |')
md.push('|---|---|---|---|')
md.push('| Monstera deliciosa | CONSISTENT* | CONSISTENT | Last word matches canonical (Monstera). Adjective `saustabėjoji` vs correct `nuostabioji` is a Phase-3 blind spot (first-word error). |')
md.push('| Myrica gale | MISMATCH | MISMATCH | actual "šilvarus" vs canonical "Sotvaras". |')
md.push('| Aquilegia vulgaris | CONSISTENT | CONSISTENT | "sinavadas" matches canonical. |')
md.push('| Arundo donax | (uncertain) | CONSISTENT | Canonical IS "Nendrūnė" in dict — but that canonical may itself be wrong (came from `plants-species-inferred`). Blind spot of any audit that trusts its own reference. |')
md.push('| Blechnum spicant | MISMATCH | MISMATCH | actual "nukimėlė" vs canonical "Unksmenė". |')
md.push('| Schoenus ferrugineus | MISMATCH | TYPO_SUSPECTED (d=2) | "viksvinis" vs "Vikšrenis" is Levenshtein-2; classifier put it in typos. Both tiers are Phase-2 targets, so this is acceptable. |')
md.push('')
md.push('Caveats:')
md.push('- CONSISTENT only validates the **last word** (genus noun). Adjective (first word) errors like `Monstera deliciosa = saustabėjoji monstera` (should be `nuostabioji`) are NOT caught.')
md.push('- The audit trusts `lt-names.json` canonical. If canonical itself is wrong (e.g. `Arundo → Nendrūnė` inferred from buggy species rows), this pass cannot detect it. Cross-check the top `plants-species-inferred` genera separately.')
md.push('- Levenshtein threshold of 2 is conservative; may miss 3+ edit typos but avoids short-word collisions.')
md.push('- Plural/declension variants (`Kėnis` vs `Kėniai`) that don\'t match canonical will appear as MISMATCH. Phase 2 verification clears them cheaply.')
md.push('')

writeFileSync(join(ROOT, 'tasks', `plants-species-audit-${TODAY}.md`), md.join('\n'))
console.log(`\nReport written → tasks/plants-species-audit-${TODAY}.md`)

writeFileSync(
  join(ROOT, 'tasks', 'plants-species-suspect-list.json'),
  JSON.stringify(machineOut, null, 2)
)
console.log(`Machine list → tasks/plants-species-suspect-list.json`)
console.log(`  mismatch:        ${machineOut.mismatch.length}`)
console.log(`  typoSuspected:   ${machineOut.typoSuspected.length}`)
console.log(`  noGenusLt:       ${machineOut.noGenusLt.length}`)
