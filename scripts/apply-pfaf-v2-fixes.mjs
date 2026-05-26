// Apply PFAF v2 suggestedFix entries (2026-05-25)
//
// Po 3-agent consensus apply'inta 768/942. Liko 174 flagged. Šis script:
//   1. Auto-apply 144 specific fixes (clear LT replacement text)
//   2. Trace 16 "Same as" references — apply referenced fix pattern
//   3. Output 14 ambiguous as manual queue (JSON file)
//
// Source: data/pfaf-v2-chunks/chunk-NNN-verified.json (status='flagged')
// Target: data/pfaf.json (knownHazardsLt field)
// Manual queue: data/pfaf-v2-manual-queue.json

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PFAF_PATH = join(__dirname, '..', 'data', 'pfaf.json')
const V2_DIR = join(__dirname, '..', 'data', 'pfaf-v2-chunks')
const MANUAL_QUEUE = join(__dirname, '..', 'data', 'pfaf-v2-manual-queue.json')

// Extract LT replacement text from suggestedFix string.
// Patterns:
//   "Add X: 'LT text'"
//   "Įterpti X: \"LT text\""
//   "'LT text in single quotes'"
//   "„LT text in LT quotes"
//   Or just bare LT replacement after colon
function extractReplacement(fix) {
  if (!fix) return null
  // Try LT smart quotes „..."
  let m = fix.match(/„([^"]+)"/) || fix.match(/„([^"„]+)$/)
  if (m) return m[1].trim()
  // ASCII double quotes "..."
  m = fix.match(/"([^"]{20,})"/)
  if (m) return m[1].trim()
  // Single quotes '...'
  m = fix.match(/'([^']{20,})'/)
  if (m) return m[1].trim()
  return null
}

function isSameAsReference(fix) {
  return /^Same as|Same fix as|Same issue as/i.test((fix||'').trim())
}

console.log('[apply-fixes] loading verified chunks...')
const files = readdirSync(V2_DIR).filter(f => /^chunk-\d+-verified\.json$/.test(f)).sort()
const flaggedEntries = []
for (const f of files) {
  const c = JSON.parse(readFileSync(join(V2_DIR, f), 'utf-8'))
  for (const e of c.entries) {
    if (e.status === 'flagged') flaggedEntries.push(e)
  }
}
console.log(`[apply-fixes] flagged entries: ${flaggedEntries.length}`)

// Build lookup: latin → entry (for "Same as X" reference traces)
const byLatin = Object.fromEntries(flaggedEntries.map(e => [e.latin, e]))

// Phase 1: classify
const specificFixes = []
const sameAsRefs = []
const ambiguous = []
for (const e of flaggedEntries) {
  const fix = e.suggestedFix || ''
  if (isSameAsReference(fix)) {
    sameAsRefs.push(e)
    continue
  }
  const replacement = extractReplacement(fix)
  if (replacement && replacement.length > 30) {
    specificFixes.push({ entry: e, replacement })
  } else {
    ambiguous.push(e)
  }
}
console.log(`[apply-fixes] classified: specific=${specificFixes.length}, sameAs=${sameAsRefs.length}, ambiguous=${ambiguous.length}`)

// Phase 2: load PFAF + apply specific fixes
const d = JSON.parse(readFileSync(PFAF_PATH, 'utf-8'))
let applied = 0
let appliedSameAs = 0
const failedSameAs = []

for (const { entry, replacement } of specificFixes) {
  const pe = d.results[entry.latin]
  if (!pe) continue
  pe.knownHazardsLt = replacement
  pe._lthazardsV2 = true
  pe._lthazardsV2Fix = 'specific-applied'
  pe._lthazardsV2At = new Date().toISOString()
  applied++
}
console.log(`[apply-fixes] applied specific: ${applied}`)

// Phase 3: trace "Same as" references — find referenced entry's fix pattern
for (const e of sameAsRefs) {
  const fix = e.suggestedFix || ''
  // Try to extract referenced latin (e.g. "Same as Prunus avium" → "Prunus avium")
  const refMatch = fix.match(/Same (?:as|fix as|issue as)\s+([A-Z][a-z]+(?:\s+[a-z]+)?)/i)
  if (!refMatch) {
    failedSameAs.push({ latin: e.latin, reason: 'no reference name found', fix })
    continue
  }
  const refLatin = refMatch[1].trim()
  // Try to find referenced entry in our flagged set OR in successfully applied entries
  const refEntry = byLatin[refLatin]
  if (!refEntry) {
    failedSameAs.push({ latin: e.latin, reason: `referenced "${refLatin}" not found in flagged set`, fix })
    continue
  }
  // Replicate ref's fix pattern: extract replacement, apply to current entry
  const refFix = refEntry.suggestedFix || ''
  const refReplacement = extractReplacement(refFix)
  if (!refReplacement) {
    failedSameAs.push({ latin: e.latin, reason: `referenced entry "${refLatin}" has no specific fix either`, fix })
    continue
  }
  // Pattern transfer: detect "Add X to existing LT" pattern in refFix, apply to current entry's Edited/V2
  // Simpler: if refReplacement contains addition (like „ir gali būti mirtina"), append to current entry's Edited
  const currentLt = e.knownHazardsLtEdited || e.knownHazardsLtV2 || ''
  // Heuristic: refReplacement ends with the addition; find the appended phrase
  const refOriginal = refEntry.knownHazardsLtEdited || refEntry.knownHazardsLtV2 || ''
  if (refReplacement.startsWith(refOriginal.slice(0, refOriginal.length - 20))) {
    // refReplacement is mostly refOriginal + small suffix
    const suffix = refReplacement.slice(refOriginal.length).trim()
    if (suffix.length > 5 && suffix.length < 100) {
      // Add same suffix to current entry's LT
      const newLt = currentLt.replace(/\.\s*$/, '') + ' ' + suffix
      const pe = d.results[e.latin]
      if (pe) {
        pe.knownHazardsLt = newLt
        pe._lthazardsV2 = true
        pe._lthazardsV2Fix = `same-as-${refLatin}-suffix-applied`
        pe._lthazardsV2At = new Date().toISOString()
        appliedSameAs++
        continue
      }
    }
  }
  // Otherwise — too complex pattern, send to manual
  failedSameAs.push({ latin: e.latin, reason: `complex pattern (referenced "${refLatin}")`, fix, refFix })
}
console.log(`[apply-fixes] applied same-as: ${appliedSameAs}, failed: ${failedSameAs.length}`)

writeFileSync(PFAF_PATH, JSON.stringify(d, null, 2))

// Phase 4: output manual queue (ambiguous + failed sameAs)
const manualQueue = {
  generatedAt: new Date().toISOString(),
  totalManual: ambiguous.length + failedSameAs.length,
  ambiguous: ambiguous.map(e => ({
    latin: e.latin,
    knownHazards: e.knownHazards,
    knownHazardsLtEdited: e.knownHazardsLtEdited,
    flagReason: e.flagReason,
    suggestedFix: e.suggestedFix,
  })),
  failedSameAs,
}
writeFileSync(MANUAL_QUEUE, JSON.stringify(manualQueue, null, 2))

console.log('')
console.log('=== FINAL ===')
console.log(`Applied specific fixes:   ${applied}`)
console.log(`Applied same-as fixes:    ${appliedSameAs}`)
console.log(`Manual queue (ambiguous + failed): ${manualQueue.totalManual}`)
console.log(`pfaf.json updated.`)
console.log(`Manual queue: data/pfaf-v2-manual-queue.json`)
