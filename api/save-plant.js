/**
 * POST /api/save-plant — server-side save endpoint (Variant B).
 *
 * GOAL: replace fragile client-side save flow. Anksciau, kai user'is
 * uždarydavo modal'į per AI Phase 2 (~30s), AbortController cancel'indavo
 * client fetch'ą, BET Anthropic API call'as tęsdavosi serveryje (we paid),
 * response'as buvo discard'inamas, catalog'as neatnaujinamas — ~$0.003 lost
 * per abandoned save.
 *
 * STRATEGY: HTTP 202 ACK po auth/validation → `waitUntil(processPlant)`
 * laiko Fluid Compute funkciją gyvą AI Phase 2 + Firestore write'ams.
 * Klientas gali uždaryti modal'į iškart; background work survives.
 *
 * REQUEST BODY:
 *   {
 *     latinName: string,             // pvz. "Monstera deliciosa"
 *     name: string,                  // user display name
 *     baseResult: object,            // slim preview iš Stage 1 (catalog + image, rehosted client-side)
 *     colId: string,                 // target collection
 *     plantId: string,               // client-generated UUID
 *     kategorija?: string,           // 'auginama' default | 'nori' | 'istorija'
 *   }
 *
 * RESPONSE 202:
 *   { ok: true, plantId, message: 'Processing started — close UI any time' }
 *
 * BACKGROUND PIPELINE (processPlant):
 *   1. buildPlantRagContextServer — RAG facts iš mūsų DB
 *   2. Anthropic call su TOOL_DETAILS + grounded PLANT_SYSTEM
 *   3. normalizeAIResponse — fix array-as-string, ensure structure
 *   4. deriveToxicityFromSourcesServer backfill — jei AI praleido pavojai[]
 *   5. saveCatalogWithParentServer — catalog write + parent taxon group
 *   6. saveUserPlantServer — user'io plant'as collections/{colId}/plants/{plantId}
 *
 * NOT IMPLEMENTED YET (TODO):
 *   • Mini AI call LT narrative'ui (`generateToxicityNarrative` client tik) —
 *     dabar fallback'inam į LT placeholder iš deriveToxicityServer
 *   • Web search tools — Phase 2 dabar be web search (client'as taip pat
 *     nenaudoja Phase 2 — tik Phase 1 preview'e)
 */
import { waitUntil } from '@vercel/functions'
import Anthropic from '@anthropic-ai/sdk'
import { uidFromToken } from './_firestore.js'
import { TOOL_DETAILS, PLANT_SYSTEM } from '../src/utils/plantPromptConfig.js'
import { LT_CLIMATE_CONTEXT, VET_LINKS, RAG_PRIORITY_INSTRUCTION } from '../src/utils/stage2Constants.js'
import { normalizeAIResponse } from '../src/utils/plantTransform.js'
import { buildPlantRagContextServer } from './_lib/buildPlantRagContext-server.js'
import { deriveToxicityFromSourcesServer } from './_lib/deriveToxicity-server.js'
import { saveCatalogWithParentServer } from './_lib/taxon-groups-server.js'
import { saveUserPlantServer, isUidMember } from './_lib/user-plant-server.js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

  // ── Membership pre-flight ───────────────────────────────────
  // Greitas patikrinimas DIDŽIULĖS klaidos atveju (uid nepriklauso colId).
  // Tas pats check pakartojamas processPlant'e — bet čia jis grąžina 403
  // sinchroniškai (vs background fail), kad client'as gautų aiškią klaidą.
  const allowed = await isUidMember(uid, colId)
  if (!allowed) {
    return res.status(403).json({ error: 'not a member of this collection' })
  }

  // ── Schedule background work ────────────────────────────────
  // waitUntil keeps the Fluid Compute instance alive after we return 202.
  waitUntil(processPlant({ uid, latinName, name, baseResult, colId, plantId, kategorija }))

  // ── 202 ACK ─────────────────────────────────────────────────
  return res.status(202).json({
    ok: true,
    plantId,
    message: 'Processing started — close UI any time',
  })
}

/**
 * Background pipeline — runs after 202 ACK, kept alive by waitUntil.
 */
async function processPlant({ uid, latinName, name, baseResult, colId, plantId, kategorija }) {
  const t0 = Date.now()
  console.log('[save-plant] START', { uid, latin: latinName, plantId, colId })

  try {
    // ── 1. RAG context ──────────────────────────────────────
    const ragStart = Date.now()
    const rag = await buildPlantRagContextServer(latinName, {
      includeCheng: true,
      includePropagation: true,
      maxLen: 2500,
    })
    console.log('[save-plant] RAG built', {
      plantId,
      ragMs: Date.now() - ragStart,
      contextChars: rag.context.length,
      sources: rag.sources,
      confidence: rag.confidence,
    })

    // ── 2. AI Phase 2 call ──────────────────────────────────
    // Grounded system: PLANT_SYSTEM + RAG priority + verified facts + LT climate + vet links
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

    const aiStart = Date.now()
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      temperature: 0.3,
      system: groundedSystem,
      tools: [TOOL_DETAILS],
      tool_choice: { type: 'tool', name: 'plant_details' },
      messages: [{
        role: 'user',
        content: `Pateik PILNĄ info apie augalą "${latinName}" (${name}).

PRIVALOMA užpildyti VISUS plant_details laukus:

CARE (narrative + structured):
• prieziura: 4 narrative Lithuanian field'ai (sviesa, laistymas, temperatura, dregme) — 1-2 sakiniai kiekvienam
• sviesa: STRUCTURED — { taskai: 1-3, lygis: „žema"/„vidutinė"/„ryški", ppfd: {min, max} }
• vanduo: STRUCTURED — { taskai: 1-3, lygis: „mažai"/„vidutiniškai"/„daug" }
• laistymasIntervalas: { vasara, ziema, metodas }
• tresimas: { intervalVasara, intervalZiema, tipas }
• substratas, persodinimas, ziemojimas, dauginimas, problemos

GENUS-LEVEL META (PRIVALOMA):
• tipas, augimo_greitis, sunkumas (1-5)

IDOMYBES — CRITICAL: native JSON array of 2-3 LT items. NEVER empty.

SAVYBES (PRIVALOMA struktūra):
• pavojai (granular), pavojingumas (safeguard), valgomumas, vaistinis.

Naudok botanikos žinias + Wikipedia/RHS info. Visi human-readable laukai LIETUVIŠKAI.`,
      }],
    })
    const aiMs = Date.now() - aiStart

    const block = response.content.find(b => b.type === 'tool_use' && b.name === 'plant_details')
    if (!block?.input) {
      console.warn('[save-plant] AI returned no tool_use', { plantId, aiMs })
      // Save'as fail'ina, BET ne hard error — nepalieka pusiau-save'into stato.
      // Future TODO: maybe save baseResult-only catalog'as ir user plant'as
      // be care info? Kol kas — silent abort.
      return
    }

    const rawDetails = block.input
    const details = normalizeAIResponse(rawDetails)
    console.log('[save-plant] AI Phase 2 normalized', {
      plantId,
      aiMs,
      idomybesCount: details.idomybes?.length ?? 0,
      pavojaiCount: details.savybes?.pavojai?.length ?? 0,
      tipas: details.tipas,
    })

    // ── 3. Toxicity backfill (D strict) ──────────────────────
    // Mirror'as client'o fetchDetails post-AI flow'o (žiūr. fetchDetails
    // komentarą "AI = structurer, ne creator. Mūsų DB = authority").
    // Mini AI narrative call'as praleidžiamas — fallback LT placeholder
    // iš deriveToxicityServer'io (TODO: pridėti server-side narrative gen).
    const derivedTox = await deriveToxicityFromSourcesServer(latinName)
    if (derivedTox.hasToxicity) {
      details.savybes = {
        ...(details.savybes ?? {}),
        pavojai: derivedTox.pavojai,
        pavojingumas: { ...derivedTox.pavojingumas },
      }
      details.toxicityNarrativeGenerated = false  // LT placeholder used
      details.toxicitySources = derivedTox.sources
      console.log('[save-plant] toxicity backfilled from sources', {
        plantId,
        sources: derivedTox.sources,
        severity: derivedTox.pavojingumas.lygis,
      })
    }

    // ── 4. Build full plant doc (catalog + user) ────────────
    // Spread order — same kaip client'o fetchDetails:
    //   1. baseResult (Phase 1 SLIM: aprasymas, kilme, savybes, image, sources)
    //   2. lotyniskas/lietuviškas (canonical)
    //   3. details (Phase 2 care info override'ina)
    const fullPlant = {
      ...(baseResult ?? {}),
      lotyniskas: latinName,
      lietuviškas: name,
      ...details,
      // RAG provenance
      ragSources: rag.sources,
      ragConfidence: rag.confidence,
      schemaVersion: 2,
    }

    // verificationStatus upgrade (mirror client logikos)
    const previousStatus = baseResult?.verificationStatus ?? null
    if (previousStatus === 'preview' && details.laistymasIntervalas) {
      fullPlant.verificationStatus = 'auto-verified'
      fullPlant.aiConfidence = details.confidence ?? 'mid'
      console.log('[save-plant] catalog upgrade preview → auto-verified', plantId)
    }

    // ── 5. Catalog write (with parent taxon group) ──────────
    if (details.laistymasIntervalas) {
      const catRes = await saveCatalogWithParentServer(fullPlant)
      console.log('[save-plant] catalog save', { plantId, ok: catRes?.ok, id: catRes?.id, reason: catRes?.reason })
    } else {
      console.warn('[save-plant] skipping catalog save — no laistymasIntervalas', plantId)
    }

    // ── 6. User plant write ─────────────────────────────────
    const userRes = await saveUserPlantServer({
      uid, colId, plantId,
      aiResult: fullPlant,
      kategorija: kategorija ?? 'auginama',
    })
    console.log('[save-plant] user plant save', {
      plantId, ok: userRes?.ok, reason: userRes?.reason,
    })

    console.log('[save-plant] DONE', { plantId, totalMs: Date.now() - t0 })
  } catch (err) {
    console.error('[save-plant] FAILED', {
      plantId,
      totalMs: Date.now() - t0,
      error: err?.message,
      stack: err?.stack?.split('\n').slice(0, 6).join('\n'),
    })
  }
}
