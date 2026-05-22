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
async function processPlant({ latinName, name, baseResult, uid, colId, plantId, kategorija }) {
  const startMs = Date.now()
  console.log(`[save-plant] processPlant START: ${latinName} (uid=${uid?.slice(0, 8)}…, col=${colId?.slice(0, 8)}…)`)

  try {
    // ── STEP 1: Build RAG context (verified facts iš mūsų DB) ────
    const { buildPlantRagContext } = await import('../src/utils/buildPlantRagContext.js')
    const rag = await buildPlantRagContext(latinName, {
      includeCheng: true,
      includePropagation: true,
      maxLen: 2500,
    })
    console.log(`[save-plant] RAG: ${rag.context.length} chars, sources: ${rag.sources.join('+')}`)

    // ── STEP 2: Build grounded system prompt ────────────────────
    const { PLANT_SYSTEM, TOOL_DETAILS } = await import('../src/utils/plantPromptConfig.js')
    const { LT_CLIMATE_CONTEXT, VET_LINKS, RAG_PRIORITY_INSTRUCTION } = await import('../src/utils/stage2Constants.js')
    const groundedSystem = [
      PLANT_SYSTEM,
      '',
      RAG_PRIORITY_INSTRUCTION,
      '',
      rag.context,
      '',
      LT_CLIMATE_CONTEXT,
      '',
      VET_LINKS,
    ].join('\n')

    // ── STEP 3: Anthropic Phase 2 call (TOOL_DETAILS full info) ──
    const userMessage = `Pateik PILNĄ info apie augalą "${name ?? latinName}" (${latinName}). Naudok plant_details schema. Visi narrative fields LT kalba.`
    const aiStartMs = Date.now()
    const r = await client.messages.create({
      model:       'claude-sonnet-4-6',
      max_tokens:  3500,
      temperature: 0.3,
      system:      groundedSystem,
      tools:       [TOOL_DETAILS],
      tool_choice: { type: 'tool', name: 'plant_details' },
      messages:    [{ role: 'user', content: userMessage }],
    })
    const aiMs = Date.now() - aiStartMs
    const block = r.content?.find(b => b.type === 'tool_use' && b.name === 'plant_details')
    if (!block) {
      throw new Error(`Phase 2 AI did not return plant_details tool_use. stop_reason=${r.stop_reason}`)
    }
    const rawDetails = block.input ?? {}
    console.log(`[save-plant] AI Phase 2 done in ${aiMs}ms. idomybesCount=${rawDetails.idomybes?.length ?? 0}, pavojaiCount=${rawDetails.savybes?.pavojai?.length ?? 0}`)

    // ── STEP 4: normalizeAIResponse ─────────────────────────────
    const { normalizeAIResponse, stripUndefinedDeep } = await import('../src/utils/plantTransform.js')
    const details = normalizeAIResponse(rawDetails)

    // ── STEP 5: Deterministic toxicity backfill + narrative ─────
    const { deriveToxicityFromSources } = await import('../src/utils/deriveToxicity.js')
    const derivedToxicity = await deriveToxicityFromSources(latinName)
    if (derivedToxicity.hasToxicity) {
      // Authority: mūsų DB. Overwritina AI'aus pavojai bet kuriuo atveju.
      details.savybes = {
        ...(details.savybes ?? {}),
        pavojai: derivedToxicity.pavojai,
        pavojingumas: derivedToxicity.pavojingumas,
      }

      // LT narrative iš mūsų sources (translator role)
      const { generateToxicityNarrative } = await import('../src/utils/toxicityNarrativeGenerator.js')
      const narrativeStartMs = Date.now()
      try {
        const narrative = await generateToxicityNarrative({
          claudeCall: async (body) => client.messages.create({ ...body, model: 'claude-sonnet-4-6' }),
          latinName,
          derivedToxicity,
        })
        if (narrative) {
          details.savybes.pavojingumas = {
            ...details.savybes.pavojingumas,
            detales: narrative,
          }
        }
        console.log(`[save-plant] narrative ${Date.now() - narrativeStartMs}ms (${narrative?.length ?? 0} chars)`)
      } catch (e) {
        console.warn('[save-plant] narrative generation failed:', e?.message)
      }
    }

    // ── STEP 6: Build full plant + verificationStatus upgrade ──
    const fullPlant = stripUndefinedDeep({
      ...(baseResult ?? {}),
      lotyniskas: latinName,
      lietuviškas: name ?? baseResult?.lietuviškas ?? null,
      ...details,
      ragSources: rag.sources,
      ragConfidence: rag.confidence,
      schemaVersion: 2,
    })

    // Upgrade verificationStatus: preview → auto-verified jei pilna care info
    if (baseResult?.verificationStatus === 'preview' && details.laistymasIntervalas) {
      fullPlant.verificationStatus = 'auto-verified'
    }

    // ── STEP 7: Firebase Admin SDK writes ───────────────────────
    // 7a. Catalog (rūšiniai laukai — visiems vartotojams)
    const { saveCatalogWithParentServer } = await import('./_lib/taxon-groups-server.js')
    const catalogResult = await saveCatalogWithParentServer(fullPlant)
    console.log(`[save-plant] catalog write:`, catalogResult)

    // 7b. User library — collections/{colId}/plants/{plantId} (rūšiniai + asmeniniai)
    // OVERWRITES preliminary klient'side write (jei klientas darė optimistic
    // update). Server-side write yra authoritative — pilna Phase 2 data.
    if (plantId && colId && uid) {
      const { saveUserPlantServer } = await import('./_lib/user-plant-server.js')
      const userPlantResult = await saveUserPlantServer({
        uid, colId, plantId,
        fullPlant,
        kategorija: kategorija ?? 'auginama',
      })
      console.log(`[save-plant] user plant write:`, userPlantResult)
    } else {
      console.warn('[save-plant] skip user plant write — missing plantId/colId/uid')
    }

    const elapsedMs = Date.now() - startMs
    console.log(`[save-plant] processPlant END: ${latinName} | total ${elapsedMs}ms`)
  } catch (e) {
    console.error(`[save-plant] processPlant FAILED: ${latinName}`, e?.message ?? e, e?.stack)
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
  const { latinName, name, baseResult, colId, plantId, kategorija } = req.body ?? {}
  if (!latinName || typeof latinName !== 'string') {
    return res.status(400).json({ error: 'latinName required' })
  }
  if (!colId || typeof colId !== 'string') {
    return res.status(400).json({ error: 'colId required' })
  }
  if (!plantId || typeof plantId !== 'string') {
    return res.status(400).json({ error: 'plantId required' })
  }
  if (kategorija && !['auginama', 'nori'].includes(kategorija)) {
    return res.status(400).json({ error: 'kategorija must be auginama or nori' })
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
  waitUntil(processPlant({ latinName, name, baseResult, uid, colId, plantId, kategorija }))

  // Increment counter NOW (optimistic — we count even if processPlant fails)
  // TODO consider moving to processPlant success path post-Step 2
  fsIncrement('users', uid, 'aiUsage.searches', idToken).catch(() => {})

  // Return 202 ACCEPTED iškart
  return res.status(202).json({
    status: 'accepted',
    latinName,
    plantId,
    message: 'Plant Save scheduled for background processing (catalog + user library)',
  })
}
