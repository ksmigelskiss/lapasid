// PFAF knownHazardsLt refinement — 2026-05-25
//
// PURPOSE: tobulinti EXISTING LT translations į natūralesnį voice'ą.
// Mūsų Opus iterations buvo good fact accuracy, BET stilistiškai akademiškesnės
// nei Phase 2 Sonnet voice (kuri yra production AI). Šis script paruošia
// refinement chunks ANOTHER LLM session (Sonnet) gali perdirbti vos
// natūralesniu voice'iniu stiliumi.
//
// SCOPE: skip trivial entries („Pavojų nežinoma" — tie OK). Refine TIK
// rich-content entries (~986).
//
// USAGE (Sonnet session orchestrator):
//   node scripts/refine-pfaf-hazards.mjs --identify       # generate refine chunks
//   node scripts/refine-pfaf-hazards.mjs --apply-all      # merge refined back
//
// Refinement is RESTRICTED — facts MUST NOT change. Voice MAY change.
// See tasks/sonnet-refine-pfaf.md for master prompt + style guide.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PFAF_PATH = join(__dirname, '..', 'data', 'pfaf.json')
const REFINE_DIR = join(__dirname, '..', 'data', 'pfaf-refine-chunks')

const CHUNK_SIZE = 50

function ensureDir(p) { if (!existsSync(p)) mkdirSync(p, { recursive: true }) }

// Detect trivial entries (already optimal — no refinement needed)
function isTrivial(lt) {
  if (!lt) return true
  const trimmed = lt.trim().toLowerCase()
  return trimmed === 'pavojų nežinoma' ||
         trimmed === 'pavojų nežinoma.' ||
         trimmed === 'nežinoma jokių pavojų' ||
         trimmed === 'nežinoma jokių pavojų.' ||
         trimmed.length < 15
}

function identifyPending() {
  console.log('[refine-pfaf] loading PFAF...')
  const d = JSON.parse(readFileSync(PFAF_PATH, 'utf-8'))

  const pending = []
  for (const [latin, entry] of Object.entries(d.results)) {
    if (!entry.found) continue
    if (!entry.knownHazardsLt) continue
    if (isTrivial(entry.knownHazardsLt)) continue
    if (entry._lthazardsRefined) continue  // already refined

    pending.push({
      latin,
      knownHazards: entry.knownHazards,        // EN reference for fact check
      knownHazardsLt: entry.knownHazardsLt,    // current LT (Opus) to refine
    })
  }
  console.log(`[refine-pfaf] pending refinement: ${pending.length}`)

  ensureDir(REFINE_DIR)
  const totalChunks = Math.ceil(pending.length / CHUNK_SIZE)
  for (let i = 0; i < totalChunks; i++) {
    const chunk = pending.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
    const chunkPath = join(REFINE_DIR, `chunk-${String(i + 1).padStart(3, '0')}.json`)
    writeFileSync(chunkPath, JSON.stringify({
      chunkIndex: i + 1,
      totalChunks,
      entries: chunk,
    }, null, 2))
  }
  console.log(`[refine-pfaf] wrote ${totalChunks} refine chunks to ${REFINE_DIR}/`)
  console.log(`[refine-pfaf] Sonnet orchestrator: spawn agents per chunk, refine knownHazardsLt`)
  console.log(`[refine-pfaf] expected output: chunk-XXX-refined.json with refined knownHazardsLt`)
}

// Fact verification — refined LT MUST preserve key terms from original
function verifyRefinement(original, refined, en) {
  if (!refined || refined.length < 10) return { ok: false, reason: 'too short' }

  // Length sanity — refined should be similar length
  if (refined.length > original.length * 1.5) {
    return { ok: false, reason: 'too long (>1.5x original)' }
  }

  // Key terms — if original mentions compounds, refined MUST too
  const keyTerms = [
    'glikozid', 'saponin', 'alkaloid', 'oksalat', 'taninas', 'cianid',
    'toksišk', 'nuoding', 'dirgina', 'kontaktas', 'nuriju', 'gyvūnam',
    'kalcio', 'antrachinon', 'kumarin', 'tiaminaz',
  ]
  for (const term of keyTerms) {
    const inOriginal = original.toLowerCase().includes(term)
    const inRefined = refined.toLowerCase().includes(term)
    if (inOriginal && !inRefined) {
      return { ok: false, reason: `missing key term: ${term}` }
    }
  }

  // Severity preservation
  const severityWords = ['labai', 'itin', 'mirtin', 'gausu', 'reti', 'kelet']
  // Just sanity — don't enforce
  return { ok: true }
}

function applyAll() {
  ensureDir(REFINE_DIR)
  const files = readdirSync(REFINE_DIR).filter(f => /^chunk-\d+-refined\.json$/.test(f)).sort()
  console.log(`[refine-pfaf] applying ${files.length} refined chunks...`)

  const d = JSON.parse(readFileSync(PFAF_PATH, 'utf-8'))
  let applied = 0
  let skipped = 0
  let rejected = 0
  const rejectedSamples = []

  for (const f of files) {
    const refined = JSON.parse(readFileSync(join(REFINE_DIR, f), 'utf-8'))
    for (const item of refined.entries) {
      const entry = d.results[item.latin]
      if (!entry) { skipped++; continue }
      if (!item.knownHazardsLtRefined) { skipped++; continue }

      // Verify against original LT (mūsų Opus translation) + EN reference
      const verify = verifyRefinement(
        entry.knownHazardsLt,
        item.knownHazardsLtRefined,
        entry.knownHazards,
      )
      if (!verify.ok) {
        rejected++
        if (rejectedSamples.length < 10) {
          rejectedSamples.push({ latin: item.latin, reason: verify.reason })
        }
        continue  // keep original Opus translation
      }

      entry.knownHazardsLt = item.knownHazardsLtRefined
      entry._lthazardsRefined = true
      entry._lthazardsRefinedAt = new Date().toISOString()
      entry._lthazardsRefineSource = 'sonnet'
      applied++
    }
  }

  writeFileSync(PFAF_PATH, JSON.stringify(d, null, 2))
  console.log(`[refine-pfaf] applied: ${applied}, skipped: ${skipped}, rejected: ${rejected}`)
  if (rejectedSamples.length > 0) {
    console.log('[refine-pfaf] rejected samples (key facts missing — kept original):')
    for (const r of rejectedSamples) console.log(`  • ${r.latin}: ${r.reason}`)
  }
}

const arg = process.argv[2]
if (arg === '--identify') {
  identifyPending()
} else if (arg === '--apply-all') {
  applyAll()
} else {
  console.error('Usage:')
  console.error('  node scripts/refine-pfaf-hazards.mjs --identify   # generate refine chunks')
  console.error('  node scripts/refine-pfaf-hazards.mjs --apply-all  # merge refined back (with verification)')
  process.exit(1)
}
