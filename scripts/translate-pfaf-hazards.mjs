// PFAF knownHazards EN → LT batch translator — 2026-05-25
//
// SCOPE: PFAF dataset turi 1540 entries su knownHazards EN text. Phase 1
// raw display rodo šitą tekstą tiesiog (su [NNN] markers + EN). Mūsų
// architectural fix (D variant per user'io diskusiją):
//   • Pre-DB batch translate vienkartinis → cache field knownHazardsLt
//   • Runtime deriveToxicity prefer'ina knownHazardsLt jei egzistuoja
//   • Phase 2 AI voice persona generuoja TOLIAU per-save narrative (kaip dabar)
//
// USAGE:
//   Script veikia dual mode:
//     • node scripts/translate-pfaf-hazards.mjs --identify     → list pending entries
//     • node scripts/translate-pfaf-hazards.mjs --apply FILE   → apply translated chunk back
//
// Translation happens VIA AGENT BATCHES (orchestrator spawns agents,
// each translates a chunk of entries). Script generates chunk files +
// applies results back into data/pfaf.json.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PFAF_PATH = join(__dirname, '..', 'data', 'pfaf.json')
const CHUNKS_DIR = join(__dirname, '..', 'data', 'pfaf-translate-chunks')

const CHUNK_SIZE = 50  // ~50 real-content entries per agent — reasonable per Claude turn

// Trivial patterns — handled deterministic'iškai, no AI translate needed
const TRIVIAL_TRANSLATIONS = {
  // EN raw → LT translated
  'None known': 'Pavojų nežinoma',
  'None known.': 'Pavojų nežinoma',
  'None': 'Pavojų nežinoma',
  'None.': 'Pavojų nežinoma',
  '': null,  // skip empty
}

function tryTrivialTranslate(text) {
  if (!text) return null
  const trimmed = text.trim()
  if (TRIVIAL_TRANSLATIONS.hasOwnProperty(trimmed)) {
    return TRIVIAL_TRANSLATIONS[trimmed]
  }
  // Other short uninformative cases
  if (trimmed.length < 5) return null
  if (/^Plants For A Future can not take/i.test(trimmed)) return 'Pavojų nežinoma'
  return null  // not trivial — needs AI
}

function ensureDir(p) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true })
}

// ── IDENTIFY: which entries need translation + apply trivial inline ──
function identifyPending() {
  console.log('[pfaf-translate] loading PFAF...')
  const d = JSON.parse(readFileSync(PFAF_PATH, 'utf-8'))

  let trivialApplied = 0
  const needsAI = []

  for (const [latin, entry] of Object.entries(d.results)) {
    if (!entry.found) continue
    if (!entry.knownHazards) continue
    if (entry.knownHazardsLt) continue  // already translated

    // Try trivial translation first
    const trivial = tryTrivialTranslate(entry.knownHazards)
    if (trivial !== null) {
      entry.knownHazardsLt = trivial
      entry._lthazardsTranslatedAt = new Date().toISOString()
      entry._lthazardsSource = 'trivial-dict'
      trivialApplied++
      continue
    }

    // Real content — needs AI
    needsAI.push({ latin, knownHazards: entry.knownHazards })
  }

  if (trivialApplied > 0) {
    writeFileSync(PFAF_PATH, JSON.stringify(d, null, 2))
    console.log(`[pfaf-translate] applied ${trivialApplied} trivial translations in-place`)
  }
  console.log(`[pfaf-translate] real entries needing AI: ${needsAI.length}`)

  // Output chunk files for AI batch translation
  ensureDir(CHUNKS_DIR)
  const totalChunks = Math.ceil(needsAI.length / CHUNK_SIZE)
  for (let i = 0; i < totalChunks; i++) {
    const chunk = needsAI.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
    const chunkPath = join(CHUNKS_DIR, `chunk-${String(i + 1).padStart(3, '0')}.json`)
    writeFileSync(chunkPath, JSON.stringify({
      chunkIndex: i + 1,
      totalChunks,
      entries: chunk,
    }, null, 2))
  }
  console.log(`[pfaf-translate] wrote ${totalChunks} chunks to ${CHUNKS_DIR}/`)
}

// ── APPLY: merge translated chunk back into pfaf.json ─────────
function applyChunk(filePath) {
  if (!existsSync(filePath)) {
    console.error(`[pfaf-translate] chunk file not found: ${filePath}`)
    process.exit(1)
  }
  const translated = JSON.parse(readFileSync(filePath, 'utf-8'))
  if (!translated.entries || !Array.isArray(translated.entries)) {
    console.error('[pfaf-translate] invalid chunk format — expected { entries: [...] }')
    process.exit(1)
  }

  console.log('[pfaf-translate] loading PFAF...')
  const d = JSON.parse(readFileSync(PFAF_PATH, 'utf-8'))

  let applied = 0
  let skipped = 0
  for (const item of translated.entries) {
    const entry = d.results[item.latin]
    if (!entry) { skipped++; continue }
    if (!item.knownHazardsLt || item.knownHazardsLt === item.knownHazards) {
      skipped++; continue
    }
    entry.knownHazardsLt = item.knownHazardsLt
    entry._lthazardsTranslatedAt = new Date().toISOString()
    applied++
  }

  writeFileSync(PFAF_PATH, JSON.stringify(d, null, 2))
  console.log(`[pfaf-translate] applied: ${applied}, skipped: ${skipped} from chunk ${translated.chunkIndex ?? '?'}`)
}

// ── APPLY ALL chunks at once (post-batch) ─────────────────────
function applyAll() {
  ensureDir(CHUNKS_DIR)
  const files = readdirSync(CHUNKS_DIR).filter(f => /^chunk-\d+-translated\.json$/.test(f)).sort()
  console.log(`[pfaf-translate] applying ${files.length} translated chunks...`)
  let totalApplied = 0
  const d = JSON.parse(readFileSync(PFAF_PATH, 'utf-8'))
  for (const f of files) {
    const translated = JSON.parse(readFileSync(join(CHUNKS_DIR, f), 'utf-8'))
    for (const item of translated.entries) {
      const entry = d.results[item.latin]
      if (!entry) continue
      if (!item.knownHazardsLt || item.knownHazardsLt === item.knownHazards) continue
      entry.knownHazardsLt = item.knownHazardsLt
      entry._lthazardsTranslatedAt = new Date().toISOString()
      totalApplied++
    }
  }
  writeFileSync(PFAF_PATH, JSON.stringify(d, null, 2))
  console.log(`[pfaf-translate] applied ${totalApplied} translations to pfaf.json`)
}

// ── Main ──────────────────────────────────────────────────────
const arg = process.argv[2]
if (arg === '--identify') {
  identifyPending()
} else if (arg === '--apply' && process.argv[3]) {
  applyChunk(process.argv[3])
} else if (arg === '--apply-all') {
  applyAll()
} else {
  console.error('Usage:')
  console.error('  node scripts/translate-pfaf-hazards.mjs --identify        # generate chunk files')
  console.error('  node scripts/translate-pfaf-hazards.mjs --apply FILE      # apply one translated chunk')
  console.error('  node scripts/translate-pfaf-hazards.mjs --apply-all       # apply all translated chunks')
  process.exit(1)
}
