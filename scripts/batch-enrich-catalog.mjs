// Batch catalog enrichment — 2026-05-25
//
// PURPOSE: Pre-populate catalog/{latinName} su Phase 2 enrichment'u per
// curated-300 sąrašą. Catalog-only writes (NE touch user plant docs).
//
// SAFETY:
//   • Rašo TIK į catalog/{latinName} per saveCatalogWithParentServer
//   • NE liečia user plant docs (jokio saveUserPlantServer call'o)
//   • Catalog image freeze (Step 6t) protect user'io custom photos
//   • PERSONAL_FIELDS (photos, timeline, komentaras) NEKALINTI
//
// FLOW per entry:
//   1. Minimal baseResult build (pre-DB + lt-names lookup, NO Wiki/iNat live)
//   2. buildPlantRagContextServer (mūsų shared RAG layer)
//   3. Anthropic Phase 2 call (TOOL_DETAILS + VOICE_PERSONA)
//   4. deriveToxicityFromSourcesServer (post-AI backfill)
//   5. generateToxicityNarrativeServer (severity-aware narrative + supplementary)
//   6. saveCatalogWithParentServer (catalog write only)
//
// USAGE (NODE 24 BUILT-IN ENV LOADER — no dotenv dep):
//   node --env-file=.env.local scripts/batch-enrich-catalog.mjs --tier=1 --limit=2
//   node --env-file=.env.local scripts/batch-enrich-catalog.mjs --tier=1
//   node --env-file=.env.local scripts/batch-enrich-catalog.mjs --all
//   node --env-file=.env.local scripts/batch-enrich-catalog.mjs --resume --tier=1
//   node --env-file=.env.local scripts/batch-enrich-catalog.mjs --dry-run --tier=1 --limit=1
//
// RESUME: checkpoint file data/batch-catalog-checkpoint.json tracks progress.
// Failed entries retried next run.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'

import { TOOL_DETAILS, PLANT_SYSTEM } from '../src/utils/plantPromptConfig.js'
import { VOICE_PERSONA } from '../src/utils/plantVoicePersona.js'
import { LT_CLIMATE_CONTEXT, VET_LINKS, RAG_PRIORITY_INSTRUCTION } from '../src/utils/stage2Constants.js'
import { normalizeAIResponse } from '../src/utils/plantTransform.js'
import { fetchWikiPhoto } from '../src/utils/wikiApi.js'
import { buildPlantRagContextServer } from '../api/_lib/buildPlantRagContext-server.js'
import { deriveToxicityFromSourcesServer } from '../api/_lib/deriveToxicity-server.js'
import { generateToxicityNarrativeServer } from '../api/_lib/toxicityNarrativeGenerator-server.js'
import { saveCatalogWithParentServer } from '../api/_lib/taxon-groups-server.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CURATED_PATH = join(__dirname, '..', 'data', 'curated-300.json')
const CHECKPOINT_PATH = join(__dirname, '..', 'data', 'batch-catalog-checkpoint.json')

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── Arg parsing ──────────────────────────────────────────────
const args = process.argv.slice(2)
const TIER = args.find(a => a.startsWith('--tier='))?.split('=')[1] ?? null
const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] ?? '0') || null
const ALL = args.includes('--all')
const RESUME = args.includes('--resume')
const DRY_RUN = args.includes('--dry-run')

// ── Load curated-300 + checkpoint ────────────────────────────
console.log('[batch] loading curated-300...')
const curated = JSON.parse(readFileSync(CURATED_PATH, 'utf-8'))
const allEntries = Object.values(curated.entries)

let targetEntries = allEntries
if (TIER === '1') targetEntries = allEntries.filter(e => e.tier === 1)
else if (TIER === '2') targetEntries = allEntries.filter(e => e.tier === 2)
else if (TIER === '3') targetEntries = allEntries.filter(e => e.tier === 3)
else if (!ALL && !TIER) {
  console.error('Specify --tier=1|2|3 or --all (plus optional --limit=N)')
  process.exit(1)
}
if (LIMIT) targetEntries = targetEntries.slice(0, LIMIT)
console.log(`[batch] target entries: ${targetEntries.length}`)

let checkpoint = { processed: {}, failed: {} }
if (RESUME && existsSync(CHECKPOINT_PATH)) {
  checkpoint = JSON.parse(readFileSync(CHECKPOINT_PATH, 'utf-8'))
  console.log(`[batch] resuming — already processed: ${Object.keys(checkpoint.processed).length}, failed: ${Object.keys(checkpoint.failed).length}`)
}

function saveCheckpoint() {
  writeFileSync(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2))
}

// ── iNat default_photo fallback (when Wiki returns no thumbnail) ──
// iNat taxa API turi default_photo field net genus level'yje. Naudojame
// kai Wiki grąžina disambiguation page (pvz. Dracaena = augalas + driežas)
// be thumbnail'o. iNat URL'us pripažįsta catalog-server.js isPublicPhoto().
async function fetchINatPhoto(latinName) {
  if (!latinName) return null
  try {
    // Species first, tada genus fallback
    const variants = [latinName]
    const genus = latinName.split(/\s+/)[0]
    if (genus && genus !== latinName) variants.push(genus)

    for (const variant of variants) {
      const res = await fetch(
        `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(variant)}&rank=species,genus&limit=5`,
        { headers: { Accept: 'application/json' } },
      )
      if (!res.ok) continue
      const data = await res.json()
      // Filter: TIK plants (Plantae) — kad iNat search'as nepasiūlytų paukščių
      // ar driežų su panašiu vardu (pvz. „Pilea" rezultatuose Dryocopus pileatus).
      const plants = (data.results ?? []).filter(t => t.iconic_taxon_name === 'Plantae')
      const exact = plants.find(
        t => t.name?.toLowerCase() === variant.toLowerCase() && t.default_photo,
      )
      const anyWithPhoto = plants.find(t => t.default_photo)
      const taxon = exact ?? anyWithPhoto
      const url = taxon?.default_photo?.medium_url ?? taxon?.default_photo?.url ?? null
      if (url) return url
    }
    return null
  } catch (e) {
    console.warn(`  ⚠ iNat photo fetch failed: ${e.message}`)
    return null
  }
}

// ── Phase 2 AI call (mirror api/save-plant.js processPlant) ──
async function callAIPhase2(latinName, ltName, ragContext) {
  const groundedSystem = [
    VOICE_PERSONA,
    '',
    PLANT_SYSTEM,
    '',
    RAG_PRIORITY_INSTRUCTION,
    '',
    ragContext,
    '',
    LT_CLIMATE_CONTEXT,
    '',
    VET_LINKS,
  ].join('\n')

  const userMsg = `Pateik PILNĄ info apie augalą "${latinName}" (${ltName || latinName}). Privaloma užpildyti VISUS plant_details laukus pagal schema. Stilius — VOICE_PERSONA „Sodininkas friend" LT.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    temperature: 0.3,
    system: groundedSystem,
    tools: [TOOL_DETAILS],
    tool_choice: { type: 'tool', name: 'plant_details' },
    messages: [{ role: 'user', content: userMsg }],
  })

  const toolUse = response.content.find(b => b.type === 'tool_use')
  if (!toolUse?.input) throw new Error('No tool_use in AI response')
  return normalizeAIResponse(toolUse.input)
}

// ── Process single entry ─────────────────────────────────────
async function processEntry(entry) {
  const latinName = entry.latinName
  const ltName = entry.ltName ?? null

  // 1. RAG context
  const rag = await buildPlantRagContextServer(latinName, {
    includeCheng: true,
    includePropagation: true,
    maxLen: 2500,
  })

  // 2. AI Phase 2
  const aiResult = await callAIPhase2(latinName, ltName, rag.context)

  // 3. Backfill toxicity if AI missed
  //
  // DEFENSIVE: AI kartais grąžina savybes kaip JSON string'ą (ne object'ą) —
  // schema confusion. JSON.parse'inam jei taip; jei parse fail — start fresh.
  // Dracaena 2026-05-27 atvejis: savybes buvo string'as '{"pavojai":[...]}'
  // → mutate'inant crashed su „Cannot create property 'pavojai' on string".
  if (typeof aiResult.savybes === 'string') {
    try {
      aiResult.savybes = JSON.parse(aiResult.savybes)
      console.log(`  ⚠ savybes was JSON string — parsed OK`)
    } catch {
      console.warn(`  ⚠ savybes was malformed string — replacing with {}`)
      aiResult.savybes = {}
    }
  }
  if (!aiResult.savybes || typeof aiResult.savybes !== 'object') {
    aiResult.savybes = {}
  }

  const derived = await deriveToxicityFromSourcesServer(latinName)
  if (!aiResult.savybes.pavojai || aiResult.savybes.pavojai.length === 0) {
    aiResult.savybes.pavojai = derived.pavojai
  }
  if (!aiResult.savybes.pavojingumas || !aiResult.savybes.pavojingumas.yra) {
    aiResult.savybes.pavojingumas = derived.pavojingumas
  }

  // 4. Toxicity narrative + supplementary hazard
  if (derived.hasToxicity || aiResult.savybes.pavojingumas?.yra) {
    const nar = await generateToxicityNarrativeServer({
      latinName,
      derived,
      genusName: latinName.split(/\s+/)[0],
    })
    if (nar.detales && aiResult.savybes.pavojingumas) {
      aiResult.savybes.pavojingumas.detales = nar.detales
    }
    if (nar.aiSupplementaryHazard) {
      aiResult.savybes.aiSupplementaryHazard = nar.aiSupplementaryHazard
    }
  }

  // 5. Catalog image — Wiki primary, iNat fallback.
  // catalog-server.js turi image-freeze logiką: pirmas save set'ina,
  // sekantys preserve existing. Jei catalog jau turi nuotrauką (user upload'as
  // ar ankstesnis save) — batch'as NEperrašys.
  //
  // Strategija:
  //   1. Wiki EN species → 2. Wiki LT species → 3. Wiki EN genus →
  //   4. iNat species/genus default_photo
  // iNat dažnai turi default photo'ą net kai Wiki returns disambiguation
  // (pvz. Dracaena — Wiki disambiguation page be thumbnail, iNat turi).
  let catalogImage = null
  try {
    let wiki = await fetchWikiPhoto(latinName, 'en', { thumbSize: 800 })
    if (!wiki?.found) wiki = await fetchWikiPhoto(latinName, 'lt', { thumbSize: 800 })
    if (!wiki?.found) {
      const genus = latinName.split(/\s+/)[0]
      if (genus && genus !== latinName) {
        wiki = await fetchWikiPhoto(genus, 'en', { thumbSize: 800 })
      }
    }
    if (wiki?.found && wiki.url) {
      catalogImage = wiki.url
    } else {
      // iNat fallback — default_photo iš taxa search
      const inatUrl = await fetchINatPhoto(latinName)
      if (inatUrl) catalogImage = inatUrl
    }
  } catch (e) {
    console.warn(`  ⚠ Photo fetch failed: ${e.message}`)
  }

  // 6. Build catalog entry (Wiki photo if first save — image-freeze protects existing)
  const catalogEntry = {
    lotyniskas: latinName,
    lietuviškas: aiResult.lietuviskas ?? ltName ?? '',
    sinonimai: aiResult.ltSynonyms ?? [],
    ...aiResult,
    ...(catalogImage ? { image: catalogImage } : {}),
    // Provenance
    _batchEnrichedAt: new Date().toISOString(),
    _batchSource: 'curated-300-batch-v1',
  }

  // 6. Catalog write
  if (DRY_RUN) {
    console.log('[batch] DRY-RUN — would write:', latinName, 'fields:', Object.keys(catalogEntry).slice(0, 10).join(','))
    return { ok: true, dryRun: true }
  }

  const result = await saveCatalogWithParentServer(catalogEntry)
  return result
}

// ── Main loop ────────────────────────────────────────────────
let success = 0
let failed = 0
const startTime = Date.now()

for (let i = 0; i < targetEntries.length; i++) {
  const entry = targetEntries[i]
  const latin = entry.latinName

  if (RESUME && checkpoint.processed[latin]) {
    console.log(`[${i+1}/${targetEntries.length}] SKIP (already processed): ${latin}`)
    continue
  }

  console.log(`[${i+1}/${targetEntries.length}] ${latin} (tier ${entry.tier})...`)
  const entryStart = Date.now()

  try {
    const result = await processEntry(entry)
    const ms = Date.now() - entryStart
    console.log(`  ✓ ${ms}ms`, result.ok ? 'OK' : 'WARN: ' + JSON.stringify(result))
    checkpoint.processed[latin] = { at: new Date().toISOString(), ms, result }
    delete checkpoint.failed[latin]
    success++
  } catch (e) {
    console.error(`  ✗ FAILED:`, e.message)
    checkpoint.failed[latin] = { at: new Date().toISOString(), error: e.message }
    failed++
  }

  // Save checkpoint every 5 entries
  if ((i + 1) % 5 === 0) saveCheckpoint()

  // Rate limit safety — Anthropic API ~5s buffer between calls
  await new Promise(r => setTimeout(r, 500))
}

saveCheckpoint()

const totalMin = ((Date.now() - startTime) / 60000).toFixed(1)
console.log('')
console.log('=== BATCH DONE ===')
console.log(`Processed: ${success}/${targetEntries.length}`)
console.log(`Failed:    ${failed}`)
console.log(`Total:     ${totalMin} min`)
console.log(`Checkpoint: ${CHECKPOINT_PATH}`)
