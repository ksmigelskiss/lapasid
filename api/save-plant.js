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
import { TOOL_DETAILS, PLANT_SYSTEM } from '../src/utils/plantPromptConfig.js'
import { LT_CLIMATE_CONTEXT, VET_LINKS, RAG_PRIORITY_INSTRUCTION } from '../src/utils/stage2Constants.js'
import { VOICE_PERSONA } from '../src/utils/plantVoicePersona.js'
import { normalizeAIResponse } from '../src/utils/plantTransform.js'
import { buildPlantRagContextServer } from './_lib/buildPlantRagContext-server.js'
import { deriveToxicityFromSourcesServer } from './_lib/deriveToxicity-server.js'
import { generateToxicityNarrativeServer } from './_lib/toxicityNarrativeGenerator-server.js'
import { resolveLtServer } from './_lib/ltDictionary-server.js'
import { saveCatalogWithParentServer } from './_lib/taxon-groups-server.js'
import { saveUserPlantServer, isUidMember } from './_lib/user-plant-server.js'
import admin from 'firebase-admin'
import { adminFirestore, verifyAuthToken } from './_lib/firestore-admin.js'
import { createHeroGen, finalizeHeroBuffers } from './_lib/heroGen.js'
import { catalogDocId } from './_lib/catalog-server.js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// 2026-06-01 — pinning maxDuration. Default Vercel'io 300s (Node 24 LTS),
// bet eksplicitiškai dėl waitUntil() background pipeline'o: RAG (~10s) +
// Sonnet Phase 2 (~30s) + parallel hero (~30s) + catalog/user writes (~2s)
// = realiai ~45-75s, hard edge case'ai (Sonnet retry, hero re-roll) gali
// pakelti iki ~120s. 300s buferis padengia.
export const config = { maxDuration: 300 }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // ── Auth ────────────────────────────────────────────────────
  const idToken = req.headers.authorization?.replace('Bearer ', '')
  if (!idToken) return res.status(401).json({ error: 'Missing token' })

  const uid = await verifyAuthToken(idToken)
  if (!uid) return res.status(401).json({ error: 'Invalid token' })

  // ── Body validation ─────────────────────────────────────────
  // skipHero (default false) — re-enrich tik tekstinį pipeline'ą (RAG + Sonnet
  // narrative + care + toxicity), be hero illustration regen'o. Naudinga kai
  // catalog'as jau turi gerą hero artwork'ą, o user nori atnaujinti tik
  // tekstinę info (e.g. care updated po naujo PFAF data, narrative bug fix).
  // Hero gen kainuoja ~$0.003 + 20-40s + perrašo Storage'e — taupymas vertas.
  //
  // 2026-06-01 — ADMIN MODE: jei plantId IR colId abudu MISSING → admin mode'as.
  // Naudojamas admin panel'ėje, kur admin atnaujina TIK catalog'ą (be user
  // plant doc update'o). Reikalauja Firestore users/{uid}.isAdmin === true.
  // Skip'inam:
  //   • idempotency check'ą (admin'as visada nori naujo run'o)
  //   • user plant doc write'ą (catalog-only target)
  //   • membership check'ą (admin'as nepriklauso konkrečiai kolekcijai)
  const { latinName, name, baseResult, colId, plantId, kategorija, skipHero = false } = req.body || {}
  if (!latinName || typeof latinName !== 'string') {
    return res.status(400).json({ error: 'latinName required (string)' })
  }

  const isAdminMode = !plantId && !colId
  if (!isAdminMode) {
    if (!plantId || typeof plantId !== 'string') {
      return res.status(400).json({ error: 'plantId required (string)' })
    }
    if (!colId || typeof colId !== 'string') {
      return res.status(400).json({ error: 'colId required (string)' })
    }
    // ── Membership pre-flight ────────────────────────────────
    // Greitas patikrinimas DIDŽIULĖS klaidos atveju (uid nepriklauso colId).
    // Tas pats check pakartojamas processPlant'e — bet čia jis grąžina 403
    // sinchroniškai (vs background fail), kad client'as gautų aiškią klaidą.
    const allowed = await isUidMember(uid, colId)
    if (!allowed) {
      return res.status(403).json({ error: 'not a member of this collection' })
    }
  } else {
    // Admin mode — verify isAdmin Firestore flag
    const isAdmin = await isUidAdmin(uid)
    if (!isAdmin) {
      return res.status(403).json({ error: 'admin mode requires users/{uid}.isAdmin === true' })
    }
    console.log('[save-plant] admin mode dispatch', { uid, latinName, skipHero })
  }

  // ── Schedule background work ────────────────────────────────
  // waitUntil keeps the Fluid Compute instance alive after we return 202.
  waitUntil(processPlant({ uid, latinName, name, baseResult, colId, plantId, kategorija, skipHero, isAdminMode }))

  // ── 202 ACK ─────────────────────────────────────────────────
  return res.status(202).json({
    ok: true,
    plantId: plantId ?? null,
    adminMode: isAdminMode,
    message: 'Processing started — close UI any time',
  })
}

// 2026-06-01 — admin mode helper. Tikrina Firestore users/{uid}.isAdmin.
// Atspindi useAuth.js client-side patikrinimą (line 167 ir kitur). Catch'ina
// errors silently → grąžina false (defensive — niekada nepraleisti per klaidą).
async function isUidAdmin(uid) {
  if (!uid) return false
  try {
    const snap = await adminFirestore().collection('users').doc(uid).get()
    return snap.exists && snap.data()?.isAdmin === true
  } catch (e) {
    console.warn('[isUidAdmin] check failed:', e?.message)
    return false
  }
}

/**
 * Background pipeline — runs after 202 ACK, kept alive by waitUntil.
 */
async function processPlant({ uid, latinName, name, baseResult, colId, plantId, kategorija, skipHero = false, isAdminMode = false }) {
  const t0 = Date.now()
  console.log('[save-plant] START', { uid, latin: latinName, plantId, colId })

  // Progress staging helper (2026-06-01) — write enrichmentStage to catalog
  // doc per kiekvieną milestone'ą. Client subscribes per onSnapshot ir
  // gauna realtime updates → ProgressView komponentas rodo informatyvius
  // statusus + progressively reveal'ina užbaigtus blocks (toxicity, care,
  // narrative, hero) be 30-90s blank wait.
  //
  // Stages (sekvencija):
  //   'started'   — Phase 2 processing pradėta (rodyt initial loader)
  //   'rag'       — RAG context surinkta (Wikipedia, PFAF, ASPCA, Cheng)
  //   'narrative' — AI text + care + toxicity ready (catalog main write)
  //   'image'     — hero illustration generation in progress (Gemini)
  //   'complete'  — viskas baigta, hero+thumb URL'ai available
  //
  // Idempotent failures: jei stage write fail'ina (Firestore tranzient
  // issue), tylėjom skip — pagrindiniam flow'ui nedaro reikšmingos žalos.
  const enrichSlug = catalogDocId(latinName)
  const writeStage = async (stage, extraFields = {}) => {
    if (!enrichSlug) return
    try {
      await adminFirestore().collection('catalog').doc(enrichSlug).set({
        enrichmentStage: stage,
        enrichmentUpdatedAt: new Date().toISOString(),
        ...extraFields,
      }, { merge: true })
    } catch (e) {
      console.warn(`[save-plant] stage write failed (${stage}):`, e?.message)
    }
  }

  try {
    // ── 0. Idempotency check (Step 6s — timestamp comparison) ────
    // Plant gali turėti istoriškai phase2CompletedAt (prev save), BET dabar
    // turėti naujesnį enrichmentStartedAt (re-enrich request iš UI). Tokiu
    // atveju NEturime skip'inti — naujas request laukia processing'o.
    //
    // Logic: skip TIK kai completion is at-least-as-recent kaip last start
    //        (no pending request).
    //
    // Admin mode (2026-06-01): SKIP idempotency check'ą — admin'as VISADA
    // nori naujo run'o (regen reason yra force-fresh). Be to, admin mode'e
    // mes neturime plantId/colId, tad query nuo gražaus rasti negalėtų.
    if (!isAdminMode) {
      try {
        const { adminFirestore } = await import('./_lib/firestore-admin.js')
        const snap = await adminFirestore()
          .collection('collections').doc(colId)
          .collection('plants').doc(plantId)
          .get()
        if (snap.exists) {
          const data = snap.data() ?? {}
          const completedAt = data.phase2CompletedAt
            ? new Date(data.phase2CompletedAt).getTime()
            : 0
          const startedAt = data.enrichmentStartedAt
            ? new Date(data.enrichmentStartedAt).getTime()
            : 0
          if (completedAt > 0 && completedAt >= startedAt) {
            console.log('[save-plant] IDEMPOTENT skip — completedAt >= startedAt', {
              plantId,
              completedAt: data.phase2CompletedAt,
              startedAt: data.enrichmentStartedAt ?? '(missing)',
            })
            return
          }
        }
      } catch (e) {
        // Idempotency check fail'inasi — vis tiek tęsiam (saugiau nei skip'inti)
        console.warn('[save-plant] idempotency check failed (continuing):', e?.message)
      }
    }

    // Stage: started — pirmas signal'as klientui kad enrichment vyksta
    await writeStage('started', { enrichmentStartedAtServer: new Date().toISOString() })

    // ── 0.5. Hero pipeline (PARALLEL — independent of text pipeline) ────
    // 2026-06-01: Gemini hero gen needs only Phase 1 data (latin + name +
    // image), so run paraleliai su RAG/Sonnet/toxicity text pipeline'u.
    // Total wall time max(text, hero) instead of sequential sum (~30s saved).
    //
    // Hero writes own catalog field (heroIllustration + heroThumb) per
    // merge:true update — saugu kartu su text pipeline saveCatalogWithParentServer.
    //
    // Promise PALEISTA dabar, AWAIT'INTA žemiau po text pipeline done.
    const heroToken = process.env.VERCEL_OIDC_TOKEN || process.env.AI_GATEWAY_API_KEY
    const heroEntry = {
      lotyniskas: latinName,
      lietuviškas: name,
      image: baseResult?.image ?? null,
    }
    const heroPromise = (async () => {
      if (skipHero) {
        console.log('[save-plant] hero gen skipped (skipHero=true)')
        return { ok: false, reason: 'skipped-by-request' }
      }
      if (!heroToken) return { ok: false, reason: 'no-token' }
      try {
        const hg = createHeroGen({ token: heroToken })
        // Admin mode + entry has image → admin'as curated reference'ą,
        // naudojam tiesiogiai (skip discovery). User mode (fresh save) —
        // null, gatherCandidates fresh fetch'ina iNat+Wiki+Brave.
        const refImg = (isAdminMode && baseResult?.image) ? baseResult.image : null
        if (refImg) {
          console.log('[save-plant] hero using curated reference', { latin: latinName, ref: refImg.slice(0, 80) })
        }
        const { buf: rawBuf, heroPromptBrief, heroPhotoAssessment, _heroMethod } =
          await hg.generateHeroForEntry(heroEntry, {
            braveApiKey: process.env.BRAVE_API_KEY,
            referenceImage: refImg,
          })

        // Sharp pipeline: 3:2 landscape + watermark (hero) + clean square thumb.
        // 2026-06-02: finalizeHeroBuffers prideda watermark (vizualus + forensic
        // LSB) ant hero PNG; thumb švarus. Žr. api/_lib/watermark.js.
        const slug = catalogDocId(latinName)
        const { heroBuf, thumbBuf } = await finalizeHeroBuffers(rawBuf, { id: slug })
        const bucket = admin.storage().bucket('geliu-db.firebasestorage.app')
        const cacheBust = Date.now()

        const heroFilename = `catalog/${slug}/hero-illus.png`
        const heroFile = bucket.file(heroFilename)
        await heroFile.save(heroBuf, { contentType: 'image/png', metadata: { cacheControl: 'public, max-age=31536000, immutable' } })
        await heroFile.makePublic()
        const url = `https://storage.googleapis.com/${bucket.name}/${heroFilename}?v=${cacheBust}`

        const thumbFilename = `catalog/${slug}/hero-thumb.webp`
        const thumbFile = bucket.file(thumbFilename)
        await thumbFile.save(thumbBuf, { contentType: 'image/webp', metadata: { cacheControl: 'public, max-age=31536000, immutable' } })
        await thumbFile.makePublic()
        const thumbUrl = `https://storage.googleapis.com/${bucket.name}/${thumbFilename}?v=${cacheBust}`

        // Write hero fields ATSKIRAI (independent merge) — ProgressView'as
        // gali rodyti watercolor tiek pat anksti kiek hero baigia, NESVARBU
        // kas su text pipeline.
        await adminFirestore().collection('catalog').doc(slug).set({
          heroIllustration: url,
          heroThumb: thumbUrl,
          heroPromptBrief, heroPhotoAssessment, _heroMethod,
          _heroIllustrationAt: new Date().toISOString(),
        }, { merge: true })
        console.log('[save-plant] hero gen done (parallel)', { slug, method: _heroMethod })
        return { ok: true, url, thumbUrl }
      } catch (e) {
        console.warn('[save-plant] hero gen failed (parallel):', e?.message)
        return { ok: false, reason: e?.message ?? 'unknown' }
      }
    })()

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

    // Stage: rag — šaltiniai surinkti, AI tuoj startuoja (longest wait coming)
    await writeStage('rag')

    // ── 2. AI Phase 2 call ──────────────────────────────────
    // Grounded system: VOICE_PERSONA + PLANT_SYSTEM + RAG priority + verified facts + LT climate + vet links
    // VOICE_PERSONA (Step 6l) prepend'inta — shared LT „Sodininkas" friend
    // persona visiems AI calls, kad output'as skaitytųsi vienodu balsu.
    const groundedSystem = [
      VOICE_PERSONA,
      '',
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
• aprasymas: 3-5 LT sakiniai apie GENUS-level augalą. Wikipedia EN/LT extract'as iš RAG = FAKTŲ šaltinis, BET PERPASAKOK savo žodžiais VOICE_PERSONA stiliumi (NE literal translation). Botaniniai terminai → paprastesnė versija. NIEKADA negrąžinti EN.
• kilme: 1-3 LT sakiniai apie kilmę. RAG origin field naudok kaip FAKTŲ šaltinį, perpasakok VOICE_PERSONA tonu. NIEKADA negrąžinti EN.
• ltSynonyms: array LT folk names jei žinai (Maranta → ["Maldos augalas"]). Tuščias OK jei nežinai.

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
      // P0-3 (2026-06-02) — VISADA writeStage('failed'). Anksčiau silent return
      // → admin mode client (LibraryEditorV2) laukdavo 180s failsafe'o, nes
      // catalog'as negaudavo nei 'complete' nei 'failed' signalo. Dabar
      // eksplicit failure → client iškart mato klaidą + retry.
      await writeStage('failed', {
        enrichmentError: 'AI grąžino atsakymą be tool_use block (Sonnet failure ar rate limit)',
      })
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
    // 2026-06-01 — resolveLt canonical LT name → narrative gen Sonnet'as
    // gauna autorityšką LT vardą ir nehallucinate'ina (e.g. „Drakena" iš
    // „Dracaena trifasciata"). Pulled iš species-lt-names.json + overrides.
    const ltEntry = await resolveLtServer(latinName).catch(() => null)
    const ltNameForNarrative = ltEntry?.ltName ?? null

    // 2026-06-01 — CONSERVATIVE OVERRIDE: TIK kai resolveLt grąžino CURATED
    // species-level entry'į (sources turi 'plants-species'). Genus-fallback-
    // qualified (e.g. „Pilea peperomioides" = constructed iš genus „Pilea"
    // + Latin epithet) NĖRA authoritative — gali būti identiškas Latin
    // binomial'iui (Pilea genus LT name = „Pilea" verbatim). Jei override'intume
    // tame atveju, regresuotume gerai žinomus vernacular pavadinimus iš
    // inatLtName arba AI-curated value („Kininis piniginis augalas").
    //
    // SOURCE TYPES:
    //   'plants-species'         → curated species hit (overrides.json arba
    //                              plants.json scrape)  → AUTHORITATIVE
    //   'genus-fallback-qualified' → constructed [genus] + [latin epithet]
    //                              → NE-authoritative (often Latin verbatim)
    //   other                    → genus-only fallback → ne species-qualified
    const isCuratedSpeciesHit = ltEntry?.sources?.includes('plants-species')
    if (ltEntry?.ltName && ltEntry.confidence === 'high' && isCuratedSpeciesHit) {
      const aiReturned = details.lietuviskas ?? null
      if (aiReturned !== ltEntry.ltName) {
        console.log('[save-plant] LT name override', {
          plantId, latin: latinName,
          ai: aiReturned, canonical: ltEntry.ltName,
          source: ltEntry.sources.join('+'),
        })
        details.lietuviskas = ltEntry.ltName
      }
    } else if (ltEntry?.ltName) {
      console.log('[save-plant] LT name override SKIPPED (not curated species)', {
        plantId, latin: latinName,
        ai: details.lietuviskas, candidate: ltEntry.ltName,
        sources: ltEntry.sources?.join('+'),
      })
    }

    const nar = await generateToxicityNarrativeServer({
      latinName,
      ltName: ltNameForNarrative,
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
      // SAUGUMAS: „abiem" → DU pavojai įrašai (žmonėms + gyvūnams). Anksčiau
      // collapse'inta į vien „zmonems" → gyvūnų pavojaus pusė tyliai dingdavo
      // (under-report). MIRROR SearchModal.jsx.
      const supTargets = sup.target === 'abiem' ? ['zmonems', 'gyvunams'] : [sup.target]
      details.savybes = {
        ...(details.savybes ?? {}),
        aiSupplementaryHazard: sup,
        pavojai: supTargets.map(t => ({
          tipas:    'toksiskas',
          target:   t,
          severity: sup.severity,
          detales:  `AI papildomas pavojus (${sup.evidence})`,
        })),
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
    // Step 6k — track aprasymas source for honest UX provenance.
    // Wiki EN extract'as → AI verčia/struktūrizuoja = „wikipedia-en"
    // baseResult tyli → AI sintezuoja iš training'o = „ai-only"
    // Vartotojas matosi šitą per ⓘ badge'ą PlantDetail APIE AUGALĄ sekcijoje.
    const hasWikiSource = !!(baseResult?.aprasymas && baseResult?.aprasymasLang === 'en')
    const aprasymasSource = hasWikiSource ? 'wikipedia-en' : 'ai-only'

    const fullPlant = {
      ...(baseResult ?? {}),
      // ARCHITECTURE — AI yra AUTHORITATIVE aprasymas šaltinis.
      // Po Step 6f Phase 1 modal'as nebeparodo aprasymo user'iui — jis
      // tarnauja TIK kaip RAG fuel'as AI Phase 2 translation'ui. Tad
      // baseResult.aprasymas (Wiki extract'as LT ar EN) NIEKADA neturi
      // pakliūti į plant doc'ą per spread. Unconditional strip → AI's
      // LT iš details wins. Jei AI skip'ino field'ą — null (geriau nei
      // misleading EN passthrough).
      //
      // Šis sprendimas eliminuoja:
      //   • Wikidata QID lookup root-cause complex refactor'ą (#23 closed)
      //   • Sąlyginį „if aprasymasLang === 'en'" check'ą
      //   • LT vs EN preview branching concern'us catalog write'e
      //
      // Wiki LT lookup Phase 0.5 metu lieka — naudinga UI source links
      // („Wikipedia LT" link'as direct article URL'u jei wikiLtFound).
      aprasymas: null,
      // Step 6o — kilme tas pats pattern'as: baseResult turi EN AHS origin
      // („Tropical America"), AI verčia į LT per Phase 2. Strip baseResult'ą
      // → AI's LT iš details wins.
      kilme: null,
      lotyniskas: latinName,
      lietuviškas: name,
      ...details,
      // 2026-06-01 — STRUCTURAL FIX: AI tool grąžina `lietuviskas` (be ė
      // diakritinio — JSON schema constraint), o app naudoja `lietuviškas`
      // (su š) kaip canonical display field. Be šio reconciliation'o,
      // line 460 `lietuviškas: name` (= client's stale baseResult.name)
      // OVERRIDE'ina line 461 spread'o `lietuviskas` (AI's value arba mūsų
      // resolveLt override) — abu egzistuoja kaip atskiri object keys.
      // Po šio fix'o: AI's lietuviskas (jau pataisytas resolveLt override'u
      // line 350) explicit'iškai kopijuojamas į `lietuviškas` field'ą.
      ...(details.lietuviskas ? { lietuviškas: details.lietuviskas } : {}),
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
      // Step 6k — honest provenance marker
      aprasymasSource,
    }

    // Step 6o — merge AI's ltSynonyms (folk names) into plant.sinonimai
    // (greta iNat/Wiki sources iš baseResult). Dedupe + filter empty.
    if (Array.isArray(details.ltSynonyms) && details.ltSynonyms.length > 0) {
      const existingSyns = Array.isArray(baseResult?.sinonimai) ? baseResult.sinonimai : []
      const merged = [...existingSyns, ...details.ltSynonyms]
        .map(s => typeof s === 'string' ? s.trim() : '')
        .filter(Boolean)
        .filter((v, i, a) => a.findIndex(x => x.toLowerCase() === v.toLowerCase()) === i)
      fullPlant.sinonimai = merged
      console.log('[save-plant] sinonimai merged', { plantId, ai: details.ltSynonyms, final: merged.length })
    }
    // ltSynonyms (AI source field) nereikia plant doc'e — merge'inta į sinonimai
    delete fullPlant.ltSynonyms

    // verificationStatus upgrade (mirror client logikos)
    const previousStatus = baseResult?.verificationStatus ?? null
    if (previousStatus === 'preview' && details.laistymasIntervalas) {
      fullPlant.verificationStatus = 'auto-verified'
      fullPlant.aiConfidence = details.confidence ?? 'mid'
      console.log('[save-plant] catalog upgrade preview → auto-verified', plantId)
    }

    // ── 5. Catalog write (with parent taxon group) ──────────
    // Stage 'narrative' implicit'inai įtraukta į saveCatalogWithParentServer:
    // pridedam fullPlant'e prieš save (vienam Firestore write'ui — efficient).
    let catalogSaved = false
    if (details.laistymasIntervalas) {
      fullPlant.enrichmentStage = 'narrative'
      fullPlant.enrichmentUpdatedAt = new Date().toISOString()
      const catRes = await saveCatalogWithParentServer(fullPlant)
      catalogSaved = catRes?.ok !== false
      console.log('[save-plant] catalog save', { plantId, ok: catRes?.ok, id: catRes?.id, reason: catRes?.reason })
    } else {
      console.warn('[save-plant] skipping catalog save — no laistymasIntervalas', plantId)
    }

    // ── 6. User plant write ─────────────────────────────────
    // Admin mode (2026-06-01): SKIP. Admin'as atnaujina TIK catalog'ą —
    // user plant docs propaguojami per F1 overlay'ą automatiškai (live
    // resolvePlantView'as merge'ina freshiausią catalog).
    if (!isAdminMode) {
      const userRes = await saveUserPlantServer({
        uid, colId, plantId,
        aiResult: fullPlant,
        kategorija: kategorija ?? 'auginama',
      })
      console.log('[save-plant] user plant save', {
        plantId, ok: userRes?.ok, reason: userRes?.reason,
      })
    } else {
      console.log('[save-plant] admin mode — skipping user plant write')
    }

    // ── 7. Wait for parallel hero pipeline ─────────────────
    // Hero gen pradėjom paraleliai (step 0.5). Dabar laukiam pabaigos, kad
    // galėtume pažymėti final 'complete' stage'ą. Hero gali finish'inti
    // ANKSCIAU nei text pipeline (~20s vs ~30s) arba VĖLIAU — nesvarbu,
    // abu rezultatai atsiranda catalog'e per atskirus merge:true write'us.
    const heroResult = await heroPromise
    console.log('[save-plant] hero pipeline result', { plantId, ok: heroResult?.ok, reason: heroResult?.reason })

    // P0-4 (2026-06-02) — admin mode + catalog NEišsaugotas (AI negrąžino
    // laistymasIntervalas) → 'failed', NE 'complete'. Anksčiau toks entry'is
    // rodydavo 'complete' BET catalog'e jokios care info → silent partial,
    // admin galvoja „pavyko", o realiai care duomenų nėra. Admin mode'e
    // catalog yra VIENINTELIS target'as; jei jis neišsaugotas — nieko nepavyko.
    // (User mode lieka kaip buvo: user plant doc su slim baseResult vis tiek
    // saugomas, partial save naudingas — nepažymim 'failed'.)
    if (isAdminMode && !catalogSaved) {
      console.warn('[save-plant] admin mode: catalog NOT saved (no laistymasIntervalas) → failed', plantId)
      await writeStage('failed', {
        enrichmentError: 'AI negrąžino care intervalų (laistymasIntervalas) — catalog neišsaugotas, bandyk dar kartą',
      })
    } else {
      // Final stage: complete — abu pipelines done, viskas yra.
      // skipped-by-request NĖRA error — neraportuoti į _heroError (kitaip
      // catalog'as turėtų klaidingą failure stamp'ą po normalaus „tik tekstas"
      // re-enrich'o).
      const heroSkippedIntentionally = heroResult?.reason === 'skipped-by-request'
      await writeStage('complete', {
        ...(!heroResult?.ok && !heroSkippedIntentionally
          ? { _heroError: heroResult?.reason ?? 'unknown' }
          : {}),
      })
    }

    console.log('[save-plant] DONE', { plantId, totalMs: Date.now() - t0 })
  } catch (err) {
    console.error('[save-plant] FAILED', {
      plantId,
      isAdminMode,
      totalMs: Date.now() - t0,
      error: err?.message,
      stack: err?.stack?.split('\n').slice(0, 6).join('\n'),
    })

    // 2026-06-01 — ALWAYS write 'failed' stage į catalog'ą. Tai pagrindinis
    // signal'as klientui (admin mode 90s failsafe loop'as klausosi
    // enrichmentStage='complete' ARBA 'failed'). Anksčiau ši write'a tik
    // į user plant doc'ą → admin mode'e (kur plantId/colId yra undefined)
    // failure liko silent'as, client'as 90s laukdavo timeout'o.
    try {
      await writeStage('failed', {
        enrichmentError: err?.message ?? 'unknown error',
      })
      console.log('[save-plant] failure stage written to catalog')
    } catch (stageErr) {
      console.error('[save-plant] failed to write failure stage:', stageErr?.message)
    }

    // User mode — papildomai įrašom į user plant doc'ą per merge:true.
    // Klientas naudoja šitą field'ą show'inti „failed" state'ą su retry
    // button'u (PlantDetail enrichment banner). Failsafe — jei Vercel
    // function hard-crash'inasi PRIEŠ šitą write'ą (e.g. OOM), klientas
    // vis tiek pereis į 'failed' state'ą per timing fallback'ą.
    if (!isAdminMode && colId && plantId) {
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
}
