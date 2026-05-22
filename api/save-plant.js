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
import { generateToxicityNarrativeServer } from './_lib/toxicityNarrativeGenerator-server.js'
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

APIE AUGALĄ:
• aprasymas: 3-5 LT sakiniai apie GENUS-level augalą (kilmė, šeima, kaip atrodo, kur natūraliai auga). Jei RAG context'e yra Wikipedia EN extract'as — IŠVERSK jį VERBATIM (compound names, locations, taxonomy). NIEKADA negrąžinti EN teksto.

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

    // ── 3. Toxicity backfill — D STRICT 6b versija plus ──────
    // AI VISADA kviečiamas. Du output'ai:
    //   • detales: LT translation IF mūsų DB turi entry
    //   • aiSupplementaryHazard: gap-fill IF DB tyli + whitelist + bar
    // Mūsų DB authority + AI gap-fill (audit-visible per separate field).
    const derivedTox = await deriveToxicityFromSourcesServer(latinName)
    const nar = await generateToxicityNarrativeServer({
      latinName,
      derivedToxicity: derivedTox,
    })
    console.log('[save-plant] narrative AI', {
      plantId,
      elapsedMs: nar.elapsedMs,
      detalesChars: nar.detales?.length ?? 0,
      hasAiSupplement: nar.aiSupplementaryHazard != null,
    })

    if (derivedTox.hasToxicity) {
      // DB turi entry → struktūrizuotas pavojai + LT narrative
      details.savybes = {
        ...(details.savybes ?? {}),
        pavojai: derivedTox.pavojai,
        pavojingumas: { ...derivedTox.pavojingumas },
      }
      if (nar.detales) {
        details.savybes.pavojingumas.detales = nar.detales
        details.toxicityNarrativeGenerated = true
      } else {
        details.toxicityNarrativeGenerated = false
        console.warn('[save-plant] narrative gen failed — placeholder fallback', plantId)
      }
      details.toxicitySources = derivedTox.sources
    } else if (nar.aiSupplementaryHazard) {
      // DB tyli BET AI auditor pridėjo gap-fill (versija plus aktivuota).
      // Saugom su atskiru `aiSupplementaryHazard` lauku audit'ui +
      // minimal pavojai entry, kad UI rodytų badge'ą.
      console.warn('[save-plant] aiSupplementaryHazard ACTIVATED', {
        plantId, latin: latinName,
        sup: nar.aiSupplementaryHazard,
      })
      const sup = nar.aiSupplementaryHazard
      details.savybes = {
        ...(details.savybes ?? {}),
        aiSupplementaryHazard: sup,
        pavojai: [{
          tipas:    'toksiskas',
          target:   sup.target === 'abiem' ? 'zmonems' : sup.target,
          severity: sup.severity,
          detales:  `AI papildomas pavojus (${sup.evidence})`,
        }],
        pavojingumas: {
          yra:     true,
          lygis:   sup.severity,
          detales: sup.reason,
        },
      }
      details.toxicitySources = ['ai-supplementary']
    }
    // else: DB tyli + AI grąžino null → safe plant, nieks nepridedam

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
      // Variant E signals — explicit completion marker. Klientas naudoja
      // šitą lauk'ą kaip primary „enrichment baigtas" signalą per
      // getPlantEnrichmentState helper'į. Eliminuoja false-positive'ą jei
      // laistymasIntervalas dėl AI klaidos lieka tuščias.
      phase2CompletedAt: new Date().toISOString(),
      // Reset error field jei prieš tai buvo retry — explicit value (null
      // Firestore'e tinka, ne dingsta dėl merge:true semantics).
      enrichmentError: null,
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
    // Variant E — explicit error signal į user plant doc'ą per merge:true.
    // Klientas naudoja šitą field'ą show'inti „failed" state'ą su retry
    // button'u. Failsafe — jei Vercel function hard-crash'inasi PRIEŠ
    // šitą write'ą (e.g. OOM), klientas vis tiek pereis į 'failed' state'ą
    // per timing fallback'ą (data_prideta + 90s).
    try {
      const { adminFirestore } = await import('./_lib/firestore-admin.js')
      await adminFirestore()
        .collection('collections').doc(colId)
        .collection('plants').doc(plantId)
        .set({
          enrichmentError: {
            reason: err?.message ?? 'unknown error',
            at: new Date().toISOString(),
          },
        }, { merge: true })
      console.log('[save-plant] enrichmentError written for retry UI', plantId)
    } catch (writeErr) {
      console.error('[save-plant] failed to write enrichmentError:', writeErr?.message)
    }
  }
}
