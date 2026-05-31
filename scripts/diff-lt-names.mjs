/**
 * diff-lt-names.mjs — Compare current lt-names.json vs lt-names.json.NEW
 * + species-lt-names.json vs species-lt-names.json.NEW.
 *
 * Output: human-readable markdown report with categorized changes.
 *
 * Run:
 *   node scripts/diff-lt-names.mjs > tasks/rebuild-lt-names-diff-{date}.md
 */

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data')

const OLD_LT = join(DATA_DIR, 'lt-names.json')
const NEW_LT = join(DATA_DIR, 'lt-names.json.NEW')
const OLD_SP = join(DATA_DIR, 'species-lt-names.json')
const NEW_SP = join(DATA_DIR, 'species-lt-names.json.NEW')

if (!existsSync(NEW_LT) || !existsSync(NEW_SP)) {
  console.error('Missing .NEW files — run scripts/build-lt-names-v2.mjs first')
  process.exit(1)
}

const oldLt = JSON.parse(readFileSync(OLD_LT, 'utf8'))
const newLt = JSON.parse(readFileSync(NEW_LT, 'utf8'))
const oldSp = JSON.parse(readFileSync(OLD_SP, 'utf8'))
const newSp = JSON.parse(readFileSync(NEW_SP, 'utf8'))

const oldGenera = oldLt.ltNames || {}
const newGenera = newLt.ltNames || {}

// ────────────────────────────────────────────────────────────────
// Compare genus dict
// ────────────────────────────────────────────────────────────────

const oldKeys = new Set(Object.keys(oldGenera))
const newKeys = new Set(Object.keys(newGenera))

const removed = [...oldKeys].filter(k => !newKeys.has(k))
const added = [...newKeys].filter(k => !oldKeys.has(k))
const kept = [...oldKeys].filter(k => newKeys.has(k))

const changedLtName = []
const changedSynonyms = []
const unchanged = []

for (const k of kept) {
  const oldE = oldGenera[k]
  const newE = newGenera[k]
  const oldSyn = JSON.stringify((oldE.ltSynonyms || []).slice().sort())
  const newSyn = JSON.stringify((newE.ltSynonyms || []).slice().sort())
  if (oldE.ltName !== newE.ltName) {
    changedLtName.push({ latin: k, old: oldE.ltName, new: newE.ltName, oldSrc: oldE.sources?.join(',') || '?', newSrc: newE.sources?.join(',') || '?' })
  } else if (oldSyn !== newSyn) {
    const oldSet = new Set(oldE.ltSynonyms || [])
    const newSet = new Set(newE.ltSynonyms || [])
    const synRemoved = [...oldSet].filter(s => !newSet.has(s))
    const synAdded = [...newSet].filter(s => !oldSet.has(s))
    changedSynonyms.push({ latin: k, name: oldE.ltName, removed: synRemoved, added: synAdded })
  } else {
    unchanged.push(k)
  }
}

// Species diff
const oldSpKeys = new Set(Object.keys(oldSp))
const newSpKeys = new Set(Object.keys(newSp))
const spRemoved = [...oldSpKeys].filter(k => !newSpKeys.has(k))
const spAdded = [...newSpKeys].filter(k => !oldSpKeys.has(k))
const spChanged = []
for (const k of oldSpKeys) {
  if (newSpKeys.has(k) && oldSp[k] !== newSp[k]) {
    spChanged.push({ binomial: k, old: oldSp[k], new: newSp[k] })
  }
}

// ────────────────────────────────────────────────────────────────
// Output report
// ────────────────────────────────────────────────────────────────

console.log(`# lt-names.json rebuild — diff report`)
console.log()
console.log(`**Date:** ${new Date().toISOString().slice(0, 10)}`)
console.log(`**Tool:** scripts/diff-lt-names.mjs`)
console.log(`**Old:** ${OLD_LT}`)
console.log(`**New:** ${NEW_LT}`)
console.log()
console.log(`## Summary`)
console.log()
console.log(`### Genus dict`)
console.log(`- Total old: ${oldKeys.size}`)
console.log(`- Total new: ${newKeys.size}`)
console.log(`- Removed: ${removed.length}`)
console.log(`- Added: ${added.length}`)
console.log(`- Kept: ${kept.length}`)
console.log(`  - Changed ltName: ${changedLtName.length}`)
console.log(`  - Changed synonyms only: ${changedSynonyms.length}`)
console.log(`  - Fully unchanged: ${unchanged.length}`)
console.log()
console.log(`### Species dict`)
console.log(`- Total old: ${oldSpKeys.size}`)
console.log(`- Total new: ${newSpKeys.size}`)
console.log(`- Removed: ${spRemoved.length}`)
console.log(`- Added: ${spAdded.length}`)
console.log(`- Changed: ${spChanged.length}`)
console.log()

// ────────────────────────────────────────────────────────────────
// Sections
// ────────────────────────────────────────────────────────────────

console.log(`---`)
console.log()
console.log(`## Removed genera (${removed.length})`)
console.log()
console.log(`Genera that existed in old DB but NOT in new. Likely causes:`)
console.log(`- Multi-word LT name → rejected by classifier (data goes to species channel)`)
console.log(`- Cross-genus pollution → ltName was canonical for different genus`)
console.log(`- All source candidates were garbage`)
console.log()
if (removed.length > 0) {
  console.log(`<details><summary>Show all ${removed.length} removed</summary>`)
  console.log()
  console.log(`| Latin genus | Old LT name | Old synonyms | Old sources |`)
  console.log(`|---|---|---|---|`)
  for (const k of removed.slice(0, 100)) {
    const e = oldGenera[k]
    const syn = (e.ltSynonyms || []).slice(0, 3).join(', ') + ((e.ltSynonyms || []).length > 3 ? '...' : '')
    console.log(`| \`${k}\` | ${e.ltName || '—'} | ${syn || '—'} | ${(e.sources || []).join(', ')} |`)
  }
  if (removed.length > 100) console.log(`| ... | ... | ... | (${removed.length - 100} more) |`)
  console.log()
  console.log(`</details>`)
}
console.log()

console.log(`---`)
console.log()
console.log(`## Added genera (${added.length})`)
console.log()
if (added.length > 0) {
  console.log(`| Latin genus | New LT name | Sources | Confidence |`)
  console.log(`|---|---|---|---|`)
  for (const k of added.slice(0, 50)) {
    const e = newGenera[k]
    console.log(`| \`${k}\` | ${e.ltName} | ${(e.sources || []).join(', ')} | ${e.confidence} |`)
  }
  if (added.length > 50) console.log(`| ... | ... | ... | (${added.length - 50} more) |`)
}
console.log()

console.log(`---`)
console.log()
console.log(`## Changed ltName (${changedLtName.length})`)
console.log()
console.log(`PAGRINDINIO LT VARDO PAKEITIMAS — KRITIŠKAS, peržiūrėk kiekvieną:`)
console.log()
if (changedLtName.length > 0) {
  console.log(`| Latin | Old → New | Old src → New src |`)
  console.log(`|---|---|---|`)
  for (const c of changedLtName.slice(0, 100)) {
    console.log(`| \`${c.latin}\` | "${c.old}" → "${c.new}" | ${c.oldSrc} → ${c.newSrc} |`)
  }
  if (changedLtName.length > 100) console.log(`| ... | ... | (${changedLtName.length - 100} more) |`)
}
console.log()

console.log(`---`)
console.log()
console.log(`## Changed synonyms (${changedSynonyms.length})`)
console.log()
console.log(`Sinonimų pakeitimai (ltName toks pats, bet ltSynonyms array pasikeitė):`)
console.log()
if (changedSynonyms.length > 0) {
  console.log(`| Latin | Name | Removed synonyms | Added synonyms |`)
  console.log(`|---|---|---|---|`)
  for (const c of changedSynonyms.slice(0, 100)) {
    const rem = c.removed.length > 0 ? c.removed.slice(0, 3).join(', ') + (c.removed.length > 3 ? `...(${c.removed.length})` : '') : '—'
    const add = c.added.length > 0 ? c.added.slice(0, 3).join(', ') + (c.added.length > 3 ? `...(${c.added.length})` : '') : '—'
    console.log(`| \`${c.latin}\` | ${c.name} | ${rem} | ${add} |`)
  }
  if (changedSynonyms.length > 100) console.log(`| ... | ... | ... | (${changedSynonyms.length - 100} more) |`)
}
console.log()

console.log(`---`)
console.log()
console.log(`## Species changes`)
console.log()
console.log(`### Removed species (${spRemoved.length})`)
console.log()
if (spRemoved.length > 0) {
  console.log(`<details><summary>Show ${Math.min(50, spRemoved.length)} samples</summary>`)
  console.log()
  for (const k of spRemoved.slice(0, 50)) console.log(`- \`${k}\` → "${oldSp[k]}"`)
  console.log()
  console.log(`</details>`)
}
console.log()

console.log(`### Added species (${spAdded.length})`)
console.log()
if (spAdded.length > 0) {
  console.log(`<details><summary>Show ${Math.min(50, spAdded.length)} samples</summary>`)
  console.log()
  for (const k of spAdded.slice(0, 50)) console.log(`- \`${k}\` → "${newSp[k]}"`)
  console.log()
  console.log(`</details>`)
}
console.log()

console.log(`### Changed species LT (${spChanged.length})`)
console.log()
if (spChanged.length > 0) {
  console.log(`| Binomial | Old | New |`)
  console.log(`|---|---|---|`)
  for (const c of spChanged.slice(0, 50)) {
    console.log(`| \`${c.binomial}\` | "${c.old}" | "${c.new}" |`)
  }
  if (spChanged.length > 50) console.log(`| ... | ... | (${spChanged.length - 50} more) |`)
}
console.log()

console.log(`---`)
console.log()
console.log(`## How to apply`)
console.log()
console.log(`If review looks good:`)
console.log(`\`\`\`bash`)
console.log(`mv data/lt-names.json.NEW data/lt-names.json`)
console.log(`mv data/species-lt-names.json.NEW data/species-lt-names.json`)
console.log(`# Verify nothing breaks:`)
console.log(`npm run build`)
console.log(`# Smoke test search (Sansevieria zeylanica, Streptocarpus, etc.)`)
console.log(`\`\`\``)
console.log()
console.log(`If something is wrong, just delete .NEW files — production untouched:`)
console.log(`\`\`\`bash`)
console.log(`rm data/lt-names.json.NEW data/species-lt-names.json.NEW`)
console.log(`\`\`\``)
