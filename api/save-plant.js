/**
 * POST /api/save-plant — server-side save endpoint (Variant B, Step 1 skeleton).
 *
 * GOAL: replace fragile client-side save flow (where closing modal during AI
 * Phase 2 cancels the fetch but server keeps spending tokens, response is
 * discarded, catalog never updated — ~$0.003 lost per abandoned save).
 *
 * STRATEGY: HTTP 202 ACK after auth/validation → `waitUntil(processPlant)`
 * keeps Fluid Compute function alive for the AI Phase 2 + Firestore writes.
 * Client can close the modal immediately; the background work survives.
 *
 * STEP 1 SCOPE (this file):
 *   • Auth via Bearer ID token (uidFromToken — same JWT-decode pattern as
 *     api/claude.js; no signature verification yet — matches existing endpoints)
 *   • Body shape validation
 *   • 202 ACK to client
 *   • `waitUntil(processPlant)` placeholder that just logs — NO AI call,
 *     NO Firestore write yet. Just proves the endpoint deploys and the
 *     waitUntil contract works.
 *
 * NEXT STEPS (separate commits):
 *   • Step 2: server-only `api/_lib/dataLoader-server.js` (fs.readFile), wire
 *     server utilities to load pre-DB / ASPCA / PFAF JSON
 *   • Step 3: extract `plantPromptConfig.js` (TOOL_DETAILS + PLANT_SYSTEM)
 *     so server and client share the AI contract
 *   • Step 4: real `processPlant` — Anthropic call + saveCatalogWithParentServer
 *     + saveUserPlantServer
 *   • Step 5: client feature flag (VITE_USE_SERVERSIDE_SAVE) — minimal
 *     SearchModal SaveButton branch to POST here instead of running local AI
 *
 * REQUEST BODY:
 *   {
 *     latinName: string,             // e.g. "Monstera deliciosa"
 *     name: string,                  // user's display name
 *     baseResult: object,            // slim preview from Stage 1 (pre-DB hit)
 *     colId: string,                 // target collection
 *     plantId: string,               // client-generated UUID for the plant
 *     kategorija?: string,           // optional override
 *   }
 *
 * RESPONSE 202:
 *   { ok: true, plantId, message: 'Processing started — close UI any time' }
 */
import { waitUntil } from '@vercel/functions'
import { uidFromToken } from './_firestore.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // ── Auth ────────────────────────────────────────────────────
  const idToken = req.headers.authorization?.replace('Bearer ', '')
  if (!idToken) return res.status(401).json({ error: 'Missing token' })

  const uid = uidFromToken(idToken)
  if (!uid) return res.status(401).json({ error: 'Invalid token' })

  // ── Body validation ─────────────────────────────────────────
  const { latinName, name, baseResult, colId, plantId, kategorija } = req.body || {}
  if (!latinName || typeof latinName !== 'string') {
    return res.status(400).json({ error: 'latinName required (string)' })
  }
  if (!plantId || typeof plantId !== 'string') {
    return res.status(400).json({ error: 'plantId required (string)' })
  }
  if (!colId || typeof colId !== 'string') {
    return res.status(400).json({ error: 'colId required (string)' })
  }

  // ── Schedule background work ────────────────────────────────
  // waitUntil keeps the Fluid Compute instance alive after we return 202.
  // STEP 1: placeholder only — proves the contract deploys.
  waitUntil(processPlant({ uid, latinName, name, baseResult, colId, plantId, kategorija }))

  // ── 202 ACK ─────────────────────────────────────────────────
  return res.status(202).json({
    ok: true,
    plantId,
    message: 'Processing started — close UI any time',
  })
}

/**
 * Background pipeline. STEP 1: placeholder — just log and resolve.
 * Future steps wire AI Phase 2 + Firestore writes here.
 */
async function processPlant(ctx) {
  const t0 = Date.now()
  try {
    console.log('[save-plant] processPlant START', {
      uid: ctx.uid,
      latin: ctx.latinName,
      colId: ctx.colId,
      plantId: ctx.plantId,
    })
    // TODO Step 2-4: AI Phase 2 call + saveCatalogWithParentServer + saveUserPlantServer
    console.log('[save-plant] processPlant DONE (skeleton, no-op)', {
      plantId: ctx.plantId,
      elapsedMs: Date.now() - t0,
    })
  } catch (err) {
    // Step 1 skeleton has no real work, but future steps will throw — catch
    // here so the background promise never rejects (waitUntil would surface
    // it in Vercel logs anyway, but explicit log helps debugging).
    console.error('[save-plant] processPlant FAILED', {
      plantId: ctx.plantId,
      elapsedMs: Date.now() - t0,
      error: err?.message,
      stack: err?.stack,
    })
  }
}
