/**
 * POST /api/dev-toxicity-test — fast iteration endpoint for server-side
 * toxicity narrative.
 *
 * VAIDMUO: skirtas `window.runServerToxicityTest('Aconitum napellus')`
 * console helper'iui. Identiškas D-strict flow'as kaip api/save-plant'o
 * processPlant, BET BE pilno plant info generation, BE catalog write,
 * BE user plant write. Tik:
 *   1. deriveToxicityFromSourcesServer (DB lookup)
 *   2. generateToxicityNarrativeServer (mini AI call jei hasToxicity)
 *   3. Grąžinti rezultatą JSON formatte
 *
 * Greitis: 0.5-15s (be Phase 2 AI'o). Cost: ~$0.0008 per call (TIK toxic
 * plant'am). Auth required, kad nebūtų atvira anyone.
 *
 * REQUEST BODY:
 *   { latinName: string }
 *
 * RESPONSE 200:
 *   {
 *     latinName,
 *     hasToxicity: bool,
 *     sources: ['aspca'|'pfaf'],
 *     pavojai: [...],
 *     pavojingumas: { yra, lygis, detales },
 *     narrative: {
 *       detales: string|null,
 *       aiSupplementaryHazard: object|null,   // 6a: always null
 *       elapsedMs: number,
 *     },
 *     totalMs: number,
 *   }
 *
 * NEPAVADINTAS production endpoint'u — kai versija plus (Step 6b) bus
 * stabili ir nereikės iteruoti, gali būti ištrintas.
 */
import { verifyAuthToken } from './_lib/firestore-admin.js'
import { deriveToxicityFromSourcesServer } from './_lib/deriveToxicity-server.js'
import { generateToxicityNarrativeServer } from './_lib/toxicityNarrativeGenerator-server.js'

export default async function handler(req, res) {
  // 2026-06-02 (P0/P2 security) — dev-only endpoint'as. Production'e 404 →
  // pašalina cost-abuse attack surface (kiekvienas call ~$0.0008). Lokaliai
  // (NODE_ENV !== 'production') lieka prieinamas testavimui.
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'not_found' })
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Auth — minimum protection nuo random users
  const idToken = req.headers.authorization?.replace('Bearer ', '')
  if (!idToken) return res.status(401).json({ error: 'Missing token' })
  const uid = await verifyAuthToken(idToken)
  if (!uid) return res.status(401).json({ error: 'Invalid token' })

  const { latinName } = req.body || {}
  if (!latinName || typeof latinName !== 'string') {
    return res.status(400).json({ error: 'latinName required (string)' })
  }

  const t0 = Date.now()
  try {
    const derived = await deriveToxicityFromSourcesServer(latinName)

    // 6b versija plus — VISADA kviestis narrative gen:
    //   • Jei hasToxicity → AI verčia EN → LT
    //   • Jei DB tyli → AI evaluating'as aiSupplementaryHazard
    const narrative = await generateToxicityNarrativeServer({
      latinName,
      derivedToxicity: derived,
    })

    return res.status(200).json({
      latinName,
      hasToxicity: derived.hasToxicity,
      sources: derived.sources,
      pavojai: derived.pavojai,
      pavojingumas: {
        yra: derived.pavojingumas.yra,
        lygis: derived.pavojingumas.lygis,
        // Show original placeholder for comparison
        placeholderDetales: derived.pavojingumas.detales,
      },
      narrative,
      totalMs: Date.now() - t0,
    })
  } catch (err) {
    console.error('[dev-toxicity-test] failed:', err?.message, err?.stack?.split('\n').slice(0, 4))
    return res.status(500).json({
      error: err?.message ?? 'server error',
      totalMs: Date.now() - t0,
    })
  }
}
