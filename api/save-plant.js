// Vercel serverless function — server-side plant Save flow.
//
// VAIDMUO: replace client-side fetchDetails Phase 2 with server-side
// resilient flow. Klientas (SearchModal) siunčia POST su latinName +
// baseResult, mes grąžiname 202 ACK iškart, o waitUntil() tęsia darbą
// background'e net jei klientas dingsta (modal close, tab close).
//
// FLOW:
//   1. Auth check (uidFromToken — konsistent su /api/claude pattern'u)
//   2. Limit check (Phase 2 = searches counter)
//   3. waitUntil(processPlant) → background:
//      a. Build RAG context iš mūsų sources (pre-DB + PFAF + ASPCA)
//      b. Anthropic call (TOOL_DETAILS — full plant info)
//      c. normalizeAIResponse + stripUndefinedDeep
//      d. generateToxicityNarrative (jei reikia)
//      e. saveCatalogWithSpeciesParent → Firebase Admin Firestore write
//      f. collections/{colId}/plants/{plantId} write (user plant copy)
//   4. Response 202 ACK iškart su plantId pranešimu
//
// MŪSŲ ANKSTESNIS PROBLEM'AS (client-side fetchDetails):
//   • User uždaro modal → AbortController nutraukia client fetch
//   • Anthropic call'as TĘSIASI server-side (mes mokame $)
//   • Response negrįžta į klientą → niekur nesaugomas
//   • catalog nepasiekia 'auto-verified' status'o → $ prarastas
//
// SERVER-SIDE FIX:
//   • Visa Phase 2 logika serveryje per Anthropic SDK direct
//   • waitUntil užtikrina, kad background darbas baigsi net po response
//   • Firebase Admin SDK (server) writes tiesiogiai į Firestore
//   • Klientas gali dingti — server'is baigia
//
// STATUS (2026-05-22):
//   • Step 1: SKELETON only — processPlant() placeholder, no Firestore writes
//   • Step 2: Firebase Admin SDK migration (saveCatalogWithSpeciesParent)
//   • Step 3: Client SearchModal integration su feature flag
//   • Step 4-5: production test + flag flip

import Anthropic from '@anthropic-ai/sdk'
import { waitUntil } from '@vercel/functions'
import { fsGet, fsIncrement, uidFromToken, checkLimit } from './_firestore.js'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const config = {
  // Phase 2 može trukti ilgokai (RAG context build + AI + narrative + writes)
  maxDuration: 60,
}

/**
 * Background processing — runs AFTER 202 ACK sent. Vercel waitUntil()
 * ensures this completes even if client disconnects.
 *
 * @param {object} params
 * @param {string} params.latinName
 * @param {string} params.name        - LT name from Phase 1
 * @param {object} params.baseResult  - Phase 1 SLIM data (image, aprasymas, etc.)
 * @param {string} params.uid         - User ID (for plant write to collections/)
 * @param {string} params.colId       - Target collection ID
 */
async function processPlant({ latinName, name, baseResult, uid, colId }) {
  const startMs = Date.now()
  console.log(`[save-plant] processPlant START: ${latinName} (uid=${uid?.slice(0, 8)}…, col=${colId?.slice(0, 8)}…)`)

  try {
    // STEP 1: Build RAG context (server-side using isomorphic dataLoader)
    const { buildPlantRagContext } = await import('../src/utils/buildPlantRagContext.js')
    const rag = await buildPlantRagContext(latinName, {
      includeCheng: true,
      includePropagation: true,
      maxLen: 2500,
    })
    console.log(`[save-plant] RAG context: ${rag.context.length} chars, sources: ${rag.sources.join('+')}`)

    // STEP 2: Anthropic call (TOOL_DETAILS) — Phase 2 full plant info
    // TODO Step 2: implement full prompt assembly + tool schema
    // For now — placeholder, just record that we got the request
    console.log('[save-plant] Step 2 placeholder — Anthropic call not yet implemented')

    // STEP 3: Deterministic toxicity backfill (regardless of AI output)
    const { deriveToxicityFromSources } = await import('../src/utils/deriveToxicity.js')
    const derivedToxicity = await deriveToxicityFromSources(latinName)
    console.log(`[save-plant] derived toxicity: hasToxicity=${derivedToxicity.hasToxicity}, pavojaiCount=${derivedToxicity.pavojai.length}`)

    // STEP 4: generateToxicityNarrative (jei hasToxicity)
    // TODO Step 2: implement Anthropic SDK direct narrative call

    // STEP 5: Firebase Admin SDK writes
    // TODO Step 2: saveCatalogWithSpeciesParent (via admin.firestore())
    // TODO Step 2: collections/{colId}/plants write

    const elapsedMs = Date.now() - startMs
    console.log(`[save-plant] processPlant END: ${latinName} | ${elapsedMs}ms (placeholder, no writes yet)`)
  } catch (e) {
    console.error(`[save-plant] processPlant FAILED: ${latinName}`, e?.message ?? e)
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Auth check
  const idToken = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!idToken) return res.status(401).json({ error: 'auth_required' })
  const uid = uidFromToken(idToken)
  if (!uid) return res.status(401).json({ error: 'invalid_token' })

  // Body validation
  const { latinName, name, baseResult, colId } = req.body ?? {}
  if (!latinName || typeof latinName !== 'string') {
    return res.status(400).json({ error: 'latinName required' })
  }
  if (!colId || typeof colId !== 'string') {
    return res.status(400).json({ error: 'colId required' })
  }

  // Limit check (Phase 2 counts as 'searches' — same as client-side)
  try {
    const user = await fsGet('users', uid, idToken)
    const hit = checkLimit(user, 'searches')
    if (hit) {
      const used = (user?.aiUsage || {})['searches'] ?? 0
      return res.status(403).json({ error: 'limit_reached', limitType: hit, used })
    }
  } catch (e) {
    console.warn('[save-plant] limit check failed (proceeding):', e?.message)
  }

  // Schedule background processing — survives client disconnect via waitUntil
  waitUntil(processPlant({ latinName, name, baseResult, uid, colId }))

  // Increment counter NOW (optimistic — we count even if processPlant fails)
  // TODO consider moving to processPlant success path post-Step 2
  fsIncrement('users', uid, 'aiUsage.searches', idToken).catch(() => {})

  // Return 202 ACCEPTED iškart
  return res.status(202).json({
    status: 'accepted',
    latinName,
    message: 'Plant Save scheduled for background processing',
  })
}
