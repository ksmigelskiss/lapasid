// PFAF knownHazards FRESH translation v2 — 2026-05-25
//
// CLEAN SLATE approach (per user feedback):
// Old workflow (Opus translate → Sonnet refine → manual fixes) suko bandage
// stack — cumulative drift, severity over-dramatization, length inconsistency,
// grammar glitches in outliers.
//
// V2: fresh EN → LT translation per Sonnet (no Opus baseline bias) su explicit
// style guidelines + two-agent consensus (translator + verifier per chunk).
//
// USER STYLE GUIDELINES (encoded in master prompt):
//   • TRUMPAS: 1-3 sentences default, max 4-5 if rich content
//   • SEVERITY KALIBRACIJA: proportional — „nuoding" → „labai toksišk" →
//     „net mažais kiekiais gali būti mirtinas". NIEKADA „MIRTINAS UŽMUŠ MIRSI"
//   • TIESI KALBA: „vienas lapas vaikui pavojingas" ne theatrical drama
//   • KAI NEPAVOJINGAS: pasakyti tiesiai, no defensive hedging
//   • PET/HUMAN SPLIT: clear when dual-context (Aloe, Lilium etc.)
//   • FACT FIDELITY: compound names + severity + targets preserved (anchors)
//
// USAGE:
//   node scripts/translate-pfaf-v2.mjs --identify  # generate fresh v2 chunks
//   node scripts/translate-pfaf-v2.mjs --apply-all # merge verified entries

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PFAF_PATH = join(__dirname, '..', 'data', 'pfaf.json')
const V2_DIR = join(__dirname, '..', 'data', 'pfaf-v2-chunks')

const CHUNK_SIZE = 30  // smaller per two-pass consensus workload

function ensureDir(p) { if (!existsSync(p)) mkdirSync(p, { recursive: true }) }

// Real-content entries — skip trivial („None known" / „Pavojų nežinoma" / very short)
function isRealContent(entry) {
  if (!entry.knownHazards) return false
  const en = entry.knownHazards.trim()
  if (en.length < 15) return false
  if (/^None known\.?\s*$/i.test(en)) return false
  if (/^None\.?\s*$/i.test(en)) return false
  return true
}

function identifyPending() {
  console.log('[v2] loading PFAF...')
  const d = JSON.parse(readFileSync(PFAF_PATH, 'utf-8'))
  const pending = []
  for (const [latin, entry] of Object.entries(d.results)) {
    if (!entry.found) continue
    if (!isRealContent(entry)) continue
    pending.push({
      latin,
      knownHazards: entry.knownHazards,  // EN source — ONLY input for Sonnet
      // NB: NE įtraukiame existing knownHazardsLt — fresh translate, no
      // Opus/Sonnet refine bias contamination
    })
  }
  console.log(`[v2] real-content entries: ${pending.length}`)

  ensureDir(V2_DIR)
  const totalChunks = Math.ceil(pending.length / CHUNK_SIZE)
  for (let i = 0; i < totalChunks; i++) {
    const chunk = pending.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
    const chunkPath = join(V2_DIR, `chunk-${String(i + 1).padStart(3, '0')}.json`)
    writeFileSync(chunkPath, JSON.stringify({
      chunkIndex: i + 1,
      totalChunks,
      entries: chunk,
    }, null, 2))
  }
  console.log(`[v2] wrote ${totalChunks} chunks to ${V2_DIR}/`)
  console.log(`[v2] Sonnet orchestrator workflow:`)
  console.log(`     Phase 1 (translator): chunk-NNN.json → chunk-NNN-translated.json`)
  console.log(`     Phase 2 (verifier):   chunk-NNN-translated.json → chunk-NNN-verified.json`)
  console.log(`     Output per entry: { latin, knownHazardsLtV2, status: 'ok' | 'flagged', flagReason? }`)
}

function applyAll() {
  ensureDir(V2_DIR)
  const files = readdirSync(V2_DIR).filter(f => /^chunk-\d+-verified\.json$/.test(f)).sort()
  console.log(`[v2] applying ${files.length} verified chunks...`)

  const d = JSON.parse(readFileSync(PFAF_PATH, 'utf-8'))
  let applied = 0
  let flagged = 0
  let skipped = 0
  const flaggedSamples = []

  for (const f of files) {
    const verified = JSON.parse(readFileSync(join(V2_DIR, f), 'utf-8'))
    for (const item of verified.entries) {
      const entry = d.results[item.latin]
      if (!entry) { skipped++; continue }
      if (!item.knownHazardsLtV2) { skipped++; continue }

      if (item.status === 'flagged') {
        flagged++
        if (flaggedSamples.length < 15) {
          flaggedSamples.push({ latin: item.latin, reason: item.flagReason ?? 'unknown' })
        }
        // Skip applying flagged — keep current knownHazardsLt as fallback
        continue
      }

      // OK status — replace existing knownHazardsLt
      entry.knownHazardsLt = item.knownHazardsLtV2
      entry._lthazardsV2 = true
      entry._lthazardsV2At = new Date().toISOString()
      // Clear old refinement marker
      delete entry._lthazardsRefined
      delete entry._lthazardsManualFix
      applied++
    }
  }

  writeFileSync(PFAF_PATH, JSON.stringify(d, null, 2))
  console.log(`[v2] applied: ${applied}, flagged (kept old): ${flagged}, skipped: ${skipped}`)
  if (flaggedSamples.length > 0) {
    console.log('[v2] flagged samples (require manual review):')
    for (const f of flaggedSamples) console.log(`  • ${f.latin}: ${f.reason}`)
  }
}

const arg = process.argv[2]
if (arg === '--identify') identifyPending()
else if (arg === '--apply-all') applyAll()
else {
  console.error('Usage:')
  console.error('  node scripts/translate-pfaf-v2.mjs --identify   # generate v2 chunks')
  console.error('  node scripts/translate-pfaf-v2.mjs --apply-all  # merge verified v2 back')
  process.exit(1)
}
