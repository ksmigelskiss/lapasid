import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { useDetailHost } from '../contexts/DetailHostContext'
import { ArrowLeft, Search, X, Camera, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react'
import { fetchPhotos, resizeImage, fetchWikipediaContext, rehostExternalImage } from '../utils/imageService'
import { fetchPlantNames } from '../utils/plantNames'
import { fromAIResult } from '../hooks/usePlants'
import { normalizeAIResponse, makeId } from '../utils/plantTransform'
import { useAuth } from '../hooks/useAuth'

// Diagnostic: log Variant B flag state once per page load. Padeda patikrinti
// ar VITE_USE_SERVERSIDE_SAVE tikrai bake'intas į bundle'ą po Vercel'io
// env'o pakeitimo + redeploy'o. Jei matai `undefined` po env'o pridėjimo —
// reiškia redeploy NEPASIĖMĖ env'o (greičiausiai "Use existing Build Cache"
// buvo on). Force redeploy be cache'o.
if (typeof window !== 'undefined') {
  console.log('[Variant B flag] VITE_USE_SERVERSIDE_SAVE =',
    JSON.stringify(import.meta.env.VITE_USE_SERVERSIDE_SAVE))
}
import { getCatalogEntry, saveToCatalog, searchCatalog, catalogEntryToAIResult, catalogDocId, bustCatalogCache } from '../utils/catalog'
import { getCachedSearchResponse, setCachedSearchResponse } from '../utils/searchResponseCache'
import { searchStage1 } from '../utils/searchStage1'
import { previewParallelFetch } from '../utils/previewParallelFetch'
import { buildPreDbBaseResult } from '../utils/preDbBaseResult'
import { catalogPreviewUpsert } from '../utils/catalogPreviewUpsert'
import { buildPlantRagContext } from '../utils/buildPlantRagContext'
import { LT_CLIMATE_CONTEXT, VET_LINKS, RAG_PRIORITY_INSTRUCTION } from '../utils/stage2Constants'
import { VOICE_PERSONA } from '../utils/plantVoicePersona'
import { deriveToxicityFromSources, isPavojaiEmpty } from '../utils/deriveToxicity'
import { diagnosticPromptCheck } from '../utils/diagnosticPromptCheck'
import { runToxicityIsolatedTest } from '../utils/toxicityIsolatedTest'
import { generateToxicityNarrative } from '../utils/toxicityNarrativeGenerator'
// Phase 2 prompt config — share'inamas su server-side api/save-plant.js
// (žiūr. src/utils/plantPromptConfig.js — KODĖL EXTRACT'INTA komentaras).
// Re-export'iname žemiau, kad legacy PlantDetail.jsx import'as
// `import { TOOL_DETAILS, PLANT_SYSTEM } from './SearchModal'` veiktų be touch'o.
export { TOOL_DETAILS, PLANT_SYSTEM } from '../utils/plantPromptConfig'
import { TOOL_DETAILS, PLANT_SYSTEM } from '../utils/plantPromptConfig'

// ── Browser-console diagnostic tool ───────────────────────────
// User idėja iš testavimo #8: kai mes nesuprantam, kodėl AI praleidžia
// schema lauką, klausiam modelį pati paaiškinti elgesį. Atidaryk F12,
// paleisk window.runPromptDiagnostic() — gausi Claude'o LT atsakymą,
// kuris instrukcijos sluoksnis priežastiškai suvaržo.
if (typeof window !== 'undefined') {
  window.runPromptDiagnostic = async (latinName = 'Aconitum napellus', observedSkip = null) => {
    console.log(`[diagnostic] Building prompt for "${latinName}"...`)
    const rag = await buildPlantRagContext(latinName, {
      includeCheng: true,
      includePropagation: true,
      maxLen: 2500,
    })
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
    console.log(`[diagnostic] Total system prompt: ${groundedSystem.length} chars (~${Math.round(groundedSystem.length / 4)} tokens)`)
    console.log(`[diagnostic] RAG context: ${rag.context.length} chars, sources: ${rag.sources.join('+')}`)
    console.log('[diagnostic] Calling Claude with diagnostic question (no tool_use, plain text response)...')

    const r = await diagnosticPromptCheck({
      claudeCall,
      systemPrompt: groundedSystem,
      latinName,
      observedSkip: observedSkip ?? `savybes.pavojai grąžinamas tuščias array net kai RAG context'e yra PFAF knownHazards (~600 chars su žodžiais 'toxic', 'paralyze', 'vomit', 'death').`,
    })
    console.log('\n=== CLAUDE DIAGNOSTIC RESPONSE ===\n')
    console.log(r.explanation)
    console.log('\n=== USAGE ===\n', r.usage)
    return r
  }
  // Isolated toxicity test — minimal scope, fast iteration.
  // Naudoja warning-label framing'ą + TINY tool schema. Skirtas eksperimentuoti
  // su prompt'o struktūra prieš keičiant production'ą.
  window.runToxicityTest = async (latinName = 'Aconitum napellus') => {
    return await runToxicityIsolatedTest({ claudeCall, latinName })
  }

  // D strict pipeline test — IDENTIŠKAS fetchDetails post-AI flow'as, BE
  // pilnos paieškos, BE catalog'o write, BE Save'o. Tiesiog patikrina:
  //   1. deriveToxicityFromSources (DB lookup)
  //   2. generateToxicityNarrative (mini AI call iš mūsų source'ų)
  //   3. Final result: pavojai + pavojingumas.detales
  //
  // Greitis: 5-15s (tik narrative AI call'as). Nereikia trinti catalog'o.
  window.runDStrictTest = async (latinName = 'Aconitum napellus') => {
    console.log(`\n[d-strict] === ${latinName} ===`)
    const start = Date.now()

    // 1. DB lookup
    const derived = await deriveToxicityFromSources(latinName)
    console.log(`[d-strict] DB lookup:`, {
      hasToxicity: derived.hasToxicity,
      sources: derived.sources,
      pavojaiCount: derived.pavojai.length,
    })

    // 2. AI call'as (6b versija plus) — VISADA paleidžiamas:
    //    • Jei hasToxicity=true → AI verčia DB EN → LT narrative
    //    • Jei hasToxicity=false → AI evaluating'as aiSupplementaryHazard
    //      pagal whitelist + hospitalization bar (default null)
    console.log(`[d-strict] calling generateToxicityNarrative() (6b versija plus — runs always)...`)
    const narrativeStart = Date.now()
    const nar = await generateToxicityNarrative({
      claudeCall,
      latinName,
      derivedToxicity: derived,
    })
    const narrativeMs = Date.now() - narrativeStart

    console.log(`[d-strict] AI response in ${narrativeMs}ms`)
    console.log(`[d-strict] narrative.detales:`, nar.detales ? `${nar.detales.length} chars` : 'null')
    console.log(`[d-strict] narrative.aiSupplementaryHazard:`, nar.aiSupplementaryHazard)

    if (!derived.hasToxicity && !nar.aiSupplementaryHazard) {
      console.log(`[d-strict] ✓ DB tyli + AI auditor pasakė null → no toxicity flagged ✓`)
      console.log(`[d-strict] TOTAL: ${Date.now() - start}ms`)
      return {
        latinName, hasToxicity: false, pavojai: [], pavojingumas: { yra: false, lygis: null, detales: '' },
        aiSupplementaryHazard: null, narrativeMs,
      }
    }

    if (!derived.hasToxicity && nar.aiSupplementaryHazard) {
      console.log(`[d-strict] ⚠ DB tyli BET AI auditor PRIDĖJO aiSupplementaryHazard:`)
      console.log(`  reason:   ${nar.aiSupplementaryHazard.reason}`)
      console.log(`  severity: ${nar.aiSupplementaryHazard.severity}`)
      console.log(`  evidence: ${nar.aiSupplementaryHazard.evidence}`)
      console.log(`  target:   ${nar.aiSupplementaryHazard.target}`)
      console.log(`[d-strict] TOTAL: ${Date.now() - start}ms`)
      return {
        latinName, hasToxicity: false,
        pavojai: [], pavojingumas: { yra: false, lygis: null, detales: '' },
        aiSupplementaryHazard: nar.aiSupplementaryHazard, narrativeMs,
      }
    }

    console.log(`[d-strict] Final pavojai entries:`, derived.pavojai)
    console.log(`[d-strict] Final pavojingumas:`, {
      yra: derived.pavojingumas.yra,
      lygis: derived.pavojingumas.lygis,
      detales: nar.detales ?? derived.pavojingumas.detales,
    })
    console.log(`[d-strict] LT narrative text:\n${nar.detales ?? '(fallback to PFAF placeholder)'}`)
    console.log(`[d-strict] TOTAL: ${Date.now() - start}ms`)

    return {
      latinName,
      hasToxicity: true,
      sources: derived.sources,
      pavojai: derived.pavojai,
      pavojingumas: {
        ...derived.pavojingumas,
        detales: nar.detales ?? derived.pavojingumas.detales,
      },
      aiSupplementaryHazard: nar.aiSupplementaryHazard,
      narrativeMs,
      totalMs: Date.now() - start,
    }
  }

  // Server-side D strict pipeline test (Variant B Step 6a) — hit'ina
  // /api/dev-toxicity-test, kuris paleidžia deriveToxicityServer +
  // generateToxicityNarrativeServer BE catalog'o write'o BE user plant
  // write'o. Skirtas greitai iteruoti server narrative gen prompt'us
  // be pilnos save'o procedūros.
  window.runServerToxicityTest = async (latinName = 'Aconitum napellus') => {
    console.log(`\n[server-tox] === ${latinName} ===`)
    const start = Date.now()
    try {
      const idToken = await auth.currentUser?.getIdToken().catch(() => null)
      if (!idToken) {
        console.error('[server-tox] not authenticated — sign in pirma')
        return null
      }
      const res = await fetch('/api/dev-toxicity-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ latinName }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('[server-tox] HTTP', res.status, err)
        return null
      }
      const result = await res.json()
      const totalMs = Date.now() - start

      console.log('[server-tox] hasToxicity:', result.hasToxicity)
      console.log('[server-tox] sources:', result.sources)
      console.log('[server-tox] pavojai entries:', result.pavojai)
      console.log('[server-tox] pavojingumas:', {
        yra: result.pavojingumas.yra,
        lygis: result.pavojingumas.lygis,
      })
      console.log('[server-tox] narrative.elapsedMs:', result.narrative.elapsedMs)
      console.log('[server-tox] narrative.aiSupplementaryHazard:', result.narrative.aiSupplementaryHazard)
      if (result.narrative.aiSupplementaryHazard) {
        console.log('[server-tox] ⚠ VERSIJA PLUS aktivuota — AI auditor pridėjo gap-fill:')
        console.log('  reason:   ', result.narrative.aiSupplementaryHazard.reason)
        console.log('  severity: ', result.narrative.aiSupplementaryHazard.severity)
        console.log('  evidence: ', result.narrative.aiSupplementaryHazard.evidence)
        console.log('  target:   ', result.narrative.aiSupplementaryHazard.target)
      }
      if (result.narrative.detales) {
        console.log('[server-tox] ─── NARRATIVE (LT, iš mūsų DB) ───')
        console.log(result.narrative.detales)
        console.log('[server-tox] ─── PLACEHOLDER (for comparison) ───')
        console.log(result.pavojingumas.placeholderDetales)
      } else if (!result.narrative.aiSupplementaryHazard) {
        console.log('[server-tox] ✓ DB tyli + AI auditor null → safe plant, nieks nepridedam')
      }
      console.log(`[server-tox] TOTAL: ${totalMs}ms (incl. roundtrip)`)
      return result
    } catch (e) {
      console.error('[server-tox] failed:', e?.message)
      return null
    }
  }

  if (import.meta.env.DEV) {
    console.log('[debug] Diagnostic available: window.runPromptDiagnostic(latinName?, observedSkip?)')
    console.log('[debug] Isolated toxicity test: window.runToxicityTest(latinName?)')
    console.log('[debug] D strict pipeline test (client): window.runDStrictTest(latinName?)')
    console.log('[debug] D strict pipeline test (server, 6b versija plus): window.runServerToxicityTest(latinName?)')
    console.log('[debug] Try: window.runServerToxicityTest("Strophanthus kombe") — should trigger aiSupplementaryHazard')
  }
}
import { taxonGroupDocId, saveTaxonGroup, getTaxonGroup, mergeWithSeries, saveCatalogWithSpeciesParent, MAX_BULK_BATCH, CATALOG_SCHEMA_VERSION } from '../utils/taxonGroups'
import { triggerHeroGen } from '../utils/plantAI'
import { plantFuzzyScore } from '../utils/fuzzySearch'
import { ProfileContent } from './PlantDetail'
import PlantSavybesPills from './brand/PlantSavybesPills'
import { auth } from '../utils/firebase'
import PaywallSheet from './PaywallSheet'
import BrandLoader from './brand/BrandLoader'
import PlantImage from './brand/PlantImage'
import T4Icon from './brand/T4Icon'
import Mascot from './brand/Mascot'

// Calls server-side proxy — Anthropic API key never in browser
// Throws { code: 'limit_reached', limitType } when free tier is exhausted
async function claudeCall(body) {
  const idToken = await auth.currentUser?.getIdToken().catch(() => null)
  const headers = { 'Content-Type': 'application/json' }
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`

  const res = await fetch('/api/claude', {
    method:  'POST',
    headers,
    body:    JSON.stringify({ ...body, limitType: 'searches' }),
  })

  if (res.status === 403) {
    const err = await res.json().catch(() => ({}))
    if (err.error === 'limit_reached') {
      const e = new Error('limit_reached')
      e.code = 'limit_reached'
      e.limitType = err.limitType ?? 'searches'
      throw e
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Phase 1: LEAN identification preview ─────────────────────────
//
// 2026-05 admin-use-case rewrite: preview'as dabar yra TIK identification +
// disambiguation kandidatai. Anksčiau (žiūr. git tag `user-search-v1`) tas
// pats tool'as grąžindavo aprasymas / idomybes / careInfo / savybes — bet
// admin'ui to nereikia (jis daro Bulk save'ą kuris perpildo catalog'ą su
// rich info per TOOL_BULK_SERIES).
//
// Slim'inimas duoda ~70% mažiau token'ų ir ~10-20s greitesnį atsaką.
// Heavy field'ai liko schema'oje kaip OPTIONAL — jei AI vis tiek nori
// užpildyti high-confidence atveju (single plant save), neblokuojam.
// Bet `required` masyve jų nebėra — AI gali grąžinti tuščius/null.
export const TOOL_PREVIEW = {
  name: 'plant_preview',
  description: 'Identify a plant + return disambiguation candidates if uncertain. SLIM mode — ONLY identification info (latinName, ltName, candidates, confidence). DO NOT fill description, origin, care, properties, fun facts — leave null/empty. Rich info filled later via bulk_series (when admin clicks "Add series") or plant_details (when user clicks Save). All human-readable output fields (name, ltName, aprasymas, kilme, seriesNote, uncertaintyReason, fallbackInfo.note) MUST be written in Lithuanian.',
  input_schema: {
    type: 'object',
    properties: {
      // ── Confidence metadata (critical — prevents AI from silently
      //    returning the closest species as an answer to a cultivar query) ─
      confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'Your certainty that the answer matches the query. high = you clearly know this exact plant; medium = you know it generally (e.g., the genus) but not the precise cultivar/sub-species; low = you don\'t know specifically, the answer is a guess based on the closest relative.',
      },
      matchLevel: {
        type: 'string',
        enum: ['cultivar', 'species', 'genus', 'unknown'],
        description: 'The taxonomic level at which you have certainty. cultivar = exact cultivar/hybrid identified; species = only down to species level; genus = only at genus level; unknown = uncertain even of genus.',
      },
      uncertaintyReason: {
        type: ['string', 'null'],
        description: 'If confidence != high — explain in Lithuanian (1 sentence) WHY you are not sure. E.g. „Šio cultivar (Clematis Boulevard) nėra mano žinių bazėje, pateikiu bendrą Clematis informaciją." or „Nuotraukoje matomas neaiškus augalas, gali būti X arba Y." null if confidence == high.',
      },
      // ── Taxonomic fallback metadata ──────────────────────────────
      // When the user asked for a specific cultivar but we cannot find
      // it, we step UP the taxonomy (cultivar → species → genus) and
      // return the parent. UI uses this to explain WHY the user is
      // seeing a broader result than they asked for.
      fallbackInfo: {
        type: ['object', 'null'],
        description: 'Fill ONLY when you stepped UP the taxonomy to answer a more specific query. E.g. user asked „Dionaea \'Akai Ryu\'" (cultivar) but you only confidently know Dionaea muscipula (species) — record that fact here. null when the returned latinName matches the granularity of the user query (no fallback happened).',
        properties: {
          from:   { type: 'string', description: 'Original taxonomic specificity the user requested. E.g. „Dionaea \'Akai Ryu\'" or „Rosa Knock Out".' },
          to:     { type: 'string', description: 'The level you actually answered at — matches the returned latinName. E.g. „Dionaea muscipula" or „Rosa".' },
          reason: {
            type: 'string',
            enum: ['cultivar-not-found', 'cultivar-uncertain', 'series-no-members-known', 'spell-uncertain'],
            description: 'cultivar-not-found = specific cultivar absent from your knowledge; cultivar-uncertain = you have weak info and prefer the parent; series-no-members-known = series exists but you cannot name members confidently; spell-uncertain = query may be a typo, parent is the safer answer.',
          },
          note:   { type: 'string', description: '1 short Lithuanian sentence the UI will show. E.g. „Konkretaus kultivaro „Akai Ryu" neradau — pateikiu motininę rūšį Dionaea muscipula." Keep it factual, no apology.' },
        },
        required: ['from', 'to', 'reason', 'note'],
      },
      // Explicit signal that named cultivars / sub-taxa exist for this
      // species or genus. UI uses this to render the seriesNote area and
      // (later) to offer a "Save as species representative" CTA. Set true
      // ONLY if you can confidently assert at least one specific
      // cultivar/variant exists (even if you do not list it in
      // candidates). DO NOT set true on vague "probably some hybrids
      // exist" hunches.
      cultivarsExist: {
        type: ['boolean', 'null'],
        description: 'true = you know with high certainty that named cultivars/variants of this species or genus exist (ideally you list some in candidates). false = monotypic / no notable cultivars known. null = unknown.',
      },
      sources: {
        type: 'array',
        items: { type: 'string' },
        description: 'Sources you drew info from. If you used the web_search tool — list the URLs you visited (e.g. „https://www.rhs.org.uk/plants/...", „https://en.wikipedia.org/wiki/..."). If you relied solely on your own knowledge — leave the array empty.',
      },
      candidates: {
        type: 'array',
        description: 'IF confidence != "high" AND there are plausibly identifiable candidates — list them. Counts: for cultivar series (Boulevard, Wave, Knock Out) — ALL known members up to 15; for visually-similar species disambiguation — 2-5. The user then picks one → new search with exact name → high confidence result. Empty array if candidates are unclear or confidence == high.',
        maxItems: 15,
        items: {
          type: 'object',
          properties: {
            latinName:             { type: 'string', description: 'Exact latin name with cultivar marker (e.g. „Clematis \'Acropolis\'")' },
            ltName:                { type: ['string', 'null'], description: 'Lithuanian name if you know it, otherwise null' },
            description:           { type: 'string', description: '1-2 sentences in Lithuanian about this cultivar/variant — origin, series, defining characteristic.' },
            distinguishingFeature: { type: 'string', description: 'PURELY VISUAL description in Lithuanian (flower colour, size, shape, leaf form) that helps the user tell this cultivar apart from other candidates WHEN COMPARING TO A REAL PHOTO. DO NOT add series / introduction year / height / bloom period — those go in description. Good: „Ryškiai pink žvaigždiniai žiedai su tamsesne pink juostele per centrą; balti kuokeliai". BAD: „Pristatytas 2013m. Chelsea Flower Show, populiarus" — that belongs in description.' },
            imageUrl:              { type: ['string', 'null'], description: 'If during web_search you VISITED a page that contained a direct image URL (https://.../something.jpg|png|webp) of THIS specific cultivar, put it here. CRITICAL: only URLs you actually saw in web_search results, no guesses. Better null than a hallucinated URL. Ideally from RHS / nursery / Wikipedia article body, not a thumbnail.' },
          },
          required: ['latinName', 'description', 'distinguishingFeature', 'imageUrl'],
        },
      },
      name:            { type: 'string',  description: 'Genuine Lithuanian name. NEVER English or Latin.' },
      latinName:       { type: 'string',  description: 'Exact latin name (with cultivar marker if applicable, e.g. „Clematis \'Boulevard\'")' },
      emoji:           { type: 'string',  description: 'A single emoji' },
      tipas:           { type: 'string',  description: 'Plant type in Lithuanian (e.g. „Sultingas", „Tropinis daugiametis"...)' },
      augimo_greitis:  { type: 'string',  enum: ['lėtas', 'vidutinis', 'greitas'] },
      sunkumas:        { type: 'integer', minimum: 1, maximum: 5 },
      toksiskas:       { type: 'boolean', description: 'Backward compat — TRUE if there is any hazard' },
      toksiskumo_info: { type: ['string', 'null'], description: 'Backward compat — copy of savybes.pavojingumas.detales' },
      savybes: {
        type: 'object',
        description: 'Structured plant properties: hazards (granular), edibility, medicinal use.',
        properties: {
          pavojai: {
            type: 'array',
            description: 'GRANULAR hazards. Fill GENEROUSLY whenever the plant has known toxic compounds (alkaloids, glycosides, oxalates, saponins, latex). Severity decision tree: stiprus = hospitalisation/death record in literature (Aconitum, Digitalis, Taxus, Conium, Nerium, Ricinus, Cicuta, Atropa, Veratrum, etc. — ALL stiprus); vidutinis = systemic effects (vomiting, neurological); silpnas = local irritation only. Empty array ALLOWED ONLY when plant has NO known toxins AND no hazard records. For ANY plant with literature evidence of toxicity, empty pavojai[] is a SCHEMA ERROR — use pavojingumas.* safeguard for uncertainty only, never as substitute for missing pavojai.',
            items: {
              type: 'object',
              properties: {
                tipas:    { type: 'string', enum: ['toksiskas', 'alergiskas', 'dirginantis'] },
                target:   { type: 'string', enum: ['zmonems', 'gyvunams'] },
                severity: { type: 'string', enum: ['silpnas', 'vidutinis', 'stiprus'] },
              },
              required: ['tipas', 'target', 'severity'],
            },
          },
          pavojingumas: {
            type: 'object',
            description: 'SAFEGUARD — always fill if the plant is hazardous at all, even when pavojai[] is empty.',
            properties: {
              yra:    { type: 'boolean' },
              lygis:  { type: ['string', 'null'], enum: ['silpnas', 'vidutinis', 'stiprus', null] },
              detales: { type: 'string', description: 'Free text in Lithuanian: what substance, by what route, at what dose it causes harm. DOSE CONTEXT IS REQUIRED — e.g. „nurijus dideliais kiekiais", „ilgalaikiu kontaktu su oda".' },
            },
            required: ['yra', 'lygis', 'detales'],
          },
          valgomumas: {
            type: 'object',
            properties: {
              statusas: { type: 'string', enum: ['none', 'dalinai', 'pilnai'] },
              dalys:    { type: 'string', description: 'In Lithuanian, e.g. „vaisiai", „lapai", „sėklos", „visas augalas". Empty when none.' },
              detales:  { type: 'string', description: 'Context in Lithuanian. E.g. „Tik prinokę vaisiai; lapai toksiški."' },
            },
            required: ['statusas', 'dalys', 'detales'],
          },
          vaistinis: {
            type: 'object',
            properties: {
              statusas:  { type: 'string', enum: ['none', 'tradicine', 'moksline'], description: 'tradicine = folk medicine; moksline = clinical evidence' },
              naudojama: { type: 'string', description: 'In Lithuanian, e.g. „odos uždegimams, virškinimui". Empty when none.' },
              detales:   { type: 'string' },
            },
            required: ['statusas', 'naudojama', 'detales'],
          },
        },
        required: ['pavojai', 'pavojingumas', 'valgomumas', 'vaistinis'],
      },
      aprasymas:       { type: 'string',  description: '3-5 sentences in Lithuanian about the GENUS-level plant (e.g. Clematis as a plant, not the specific „Boulevard" series). How it looks, where it grows natively, why it is popular in gardening. Relevant to every series member.' },
      seriesNote:      { type: ['string', 'null'], description: 'IF latinName contains a series (e.g. „Clematis \\\'Boulevard\\\'", „Rosa Knock Out") — 1-2 sentences in Lithuanian about the series itself: who bred it, what characterises it, when it was introduced. null if this is not a series (specific cultivar, species, or genus only).' },
      kilme:           { type: 'string', description: '1 sentence in Lithuanian about where the GENUS originates (region, natural habitat). Not about the series.' },
      sviesa: {
        type: 'object',
        properties: {
          taskai: { type: 'integer', minimum: 1, maximum: 3 },
          lygis:  { type: 'string', enum: ['žema', 'vidutinė', 'ryški'] },
          ppfd:   { type: 'object', properties: { min: { type: 'integer' }, max: { type: 'integer' } }, required: ['min', 'max'] },
        },
        required: ['taskai', 'lygis', 'ppfd'],
      },
      vanduo: {
        type: 'object',
        properties: {
          taskai: { type: 'integer', minimum: 1, maximum: 3 },
          lygis:  { type: 'string', enum: ['mažai', 'vidutiniškai', 'daug'] },
        },
        required: ['taskai', 'lygis'],
      },
      idomybes: { type: 'array', items: { type: 'string' }, description: '2-3 fun facts in Lithuanian' },
    },
    // SLIM required'as — TIK identification + honesty. Visi rich field'ai
    // (tipas, savybes, aprasymas, kilme, sviesa, vanduo, idomybes ir t.t.)
    // optional'iai — AI gali grąžinti null/tuščius, ir mes nelaužiam build'o.
    // fallbackInfo + cultivarsExist nėra required — AI grąžina null
    // kai nereikia (nėra fallback'o / nežinia ar yra kultivarų).
    // (Žiūr. `user-search-v1` git tag — pilna senesnė required lista.)
    required: ['confidence', 'matchLevel', 'uncertaintyReason', 'sources', 'candidates',
               'name', 'latinName', 'emoji'],
  },
}

// ── Bulk series save — vienu call'u pildo VISĄ seriją (shared + per-cultivar) ──
//
// Užklausus seriją (pvz. „Clematis 'Boulevard'") AI grąžina:
//   • series block (SHARED — visiems cultivars vienodi field'ai)
//   • cultivars array (PER-CULTIVAR — tik kas skiriasi)
//
// Naive bulk = 20× pilnas schema = 30K tokens ≈ $0.45
// Smart bulk = 1× series + 20× minimal cultivar = 5K tokens ≈ $0.08
// 6x pigiau, semantiškai aligned su mūsų TaxonGroup + Catalog split'u.

export const TOOL_BULK_SERIES = {
  name: 'bulk_series',
  description: 'Pateik PILNĄ cultivar serijos info su VISAIS žinomais cultivars (iki 25). Shared care/savybės eina į series block; per-cultivar — į cultivars array.',
  input_schema: {
    type: 'object',
    properties: {
      series: {
        type: 'object',
        description: 'Shared atributai visiems šios serijos cultivars',
        properties: {
          type:               { type: 'string', enum: ['cultivar-series', 'species', 'hybrid', 'genus-care', 'cultivar-group', 'variety', 'subspecies'] },
          name:               { type: 'string', description: 'Serijos pavadinimas (pvz. „Boulevard", „Hosta sieboldiana")' },
          genus:              { type: 'string', description: 'Genus (pvz. „Clematis")' },
          breeder:            { type: ['string', 'null'], description: 'Brand owner / breeder (pvz. „Raymond Evison"). null jei nežinai arba neaktualus.' },
          aliases:            { type: 'array', items: { type: 'string' }, description: 'Alternative serijos pavadinimai („Boulevard®", „Evison Boulevard")' },
          aprasymas:          { type: 'string', description: '3-5 sakiniai apie seriją — kilmė, charakteristika, naudojimas' },
          kilme:              { type: 'string', description: 'Serijos kilmė (šalis, breeder, metai)' },
          tipas:              { type: 'string', description: 'Augalo tipas (pvz. „Vijoklinis daugiametis")' },
          augimo_greitis:     { type: 'string', enum: ['lėtas', 'vidutinis', 'greitas'] },
          sunkumas:           { type: 'integer', minimum: 1, maximum: 5 },
          cultivationContext: { type: 'string', enum: ['indoor', 'outdoor', 'both'], description: 'Kur augo: kambaryje, lauke, arba abu' },
          lifecycle:          { type: 'string', enum: ['annual', 'biennial', 'perennial', 'woody', 'bulbous'] },
          hardiness:          { type: ['object', 'null'], description: 'Hardiness — TIK outdoor augalams; indoor → null', properties: { usdaZone: { type: 'string' }, minTempC: { type: 'integer' } } },
          typicalHeight:      { type: 'string', description: '„0.8-1.2m" formato range' },
          typicalSpread:      { type: ['string', 'null'] },
          careInfo: {
            type: 'object',
            description: 'Shared care — visiems serijos nariams vienodi',
            properties: {
              sviesa:              { type: 'object', properties: { taskai: { type: 'integer' }, lygis: { type: 'string' }, ppfd: { type: 'object', properties: { min: { type: 'integer' }, max: { type: 'integer' } } } } },
              vanduo:              { type: 'object', properties: { taskai: { type: 'integer' }, lygis: { type: 'string' } } },
              laistymasIntervalas: { type: 'object', properties: { vasara: { type: 'integer' }, ziema: { type: ['integer', 'null'] }, metodas: { type: 'string' } } },
              tresimas:            { type: 'object', properties: { intervalVasara: { type: 'integer' }, intervalZiema: { type: ['integer', 'null'] }, tipas: { type: 'string' } } },
              substratas:          { type: 'string' },
              persodinimas:        { type: 'string' },
              ziemojimas:          { type: 'string' },
              prieziura:           { type: 'object', properties: { sviesa: { type: 'string' }, laistymas: { type: 'string' }, temperatura: { type: 'string' }, dregme: { type: 'string' } } },
            },
          },
          savybes: {
            type: 'object',
            description: 'Pavojai/valgomumas/vaistinis — paprastai shared genus-level',
            properties: {
              pavojai:      { type: 'array', items: { type: 'object', properties: { tipas: { type: 'string', enum: ['toksiskas', 'alergiskas', 'dirginantis'] }, target: { type: 'string', enum: ['zmonems', 'gyvunams'] }, severity: { type: 'string', enum: ['silpnas', 'vidutinis', 'stiprus'] } } } },
              pavojingumas: { type: 'object', properties: { yra: { type: 'boolean' }, lygis: { type: ['string', 'null'] }, detales: { type: 'string' } } },
              valgomumas:   { type: 'object', properties: { statusas: { type: 'string' }, dalys: { type: 'string' }, detales: { type: 'string' } } },
              vaistinis:    { type: 'object', properties: { statusas: { type: 'string' }, naudojama: { type: 'string' }, detales: { type: 'string' } } },
            },
          },
          dauginimas:         { type: 'array', items: { type: 'string' } },
          problemos:          { type: 'array', items: { type: 'object', properties: { pavadinimas: { type: 'string' }, sprendimas: { type: 'string' } } } },
          idomybes:           { type: 'array', items: { type: 'string' }, description: '2-3 serijos faktai' },
          sources:            { type: 'array', items: { type: 'string' }, description: 'Web search šaltiniai (URLs)' },
        },
        required: ['type', 'name', 'genus', 'cultivationContext', 'lifecycle', 'careInfo', 'savybes', 'tipas'],
      },
      cultivars: {
        type: 'array',
        description: 'Visi žinomi šios serijos cultivars (iki 25). TIK per-cultivar info — kas skiriasi nuo serijos defaults.',
        items: {
          type: 'object',
          properties: {
            latinName:             { type: 'string', description: 'TRADE name (rinkos / gardener pavadinimas, KURĮ ŽMONĖS NAUDOJA) su cultivar žymeniu. Pvz. „Clematis \'Olympia\'", „Clematis \'Boulevard Bourbon\'", „Rosa \'Knock Out\'". NIEKADA neįrašyk patent/registracijos kodų (EVIPO006, EVIPO078, RADrazz, MEIcobuis, KORnacapi) į šitą lauką — jie eina į registeredAs. Jei žinai abu — pirmenybė TRADE name.' },
            ltName:                { type: ['string', 'null'], description: 'Lietuviškas pavadinimas jei žinai (pvz. „Olimpija")' },
            distinguishingFeature: { type: 'string', description: 'Vizualus aprašymas (žiedų spalva/forma) — kuo atskiriasi nuo kitų serijos narių' },
            emoji:                 { type: 'string', description: 'Vienas emoji' },
            bloom:                 { type: ['object', 'null'], properties: { color: { type: 'string' }, period: { type: 'string' }, fragrant: { type: 'boolean' }, doubleFlower: { type: 'boolean' } } },
            registeredAs:          { type: ['string', 'null'], description: 'BREEDER patent/registration kodas (EVIPO006, EVIPO078, RADrazz, KORnacapi). Šitur, NE į latinName.' },
            overrides:             { type: ['object', 'null'], description: 'Per-cultivar overrides KAI TIKRAI skiriasi nuo serijos defaults (pvz. unikalus aukštis). Daugumai cultivars — null/empty.' },
          },
          required: ['latinName', 'distinguishingFeature', 'emoji'],
        },
        minItems: 2,
        maxItems: 25,
      },
    },
    required: ['series', 'cultivars'],
  },
}


/**
 * fetchDetails(latinName, name, baseResult?) — gauna Phase 2 care info iš AI
 * + paraleliai saugo PILNĄ catalog entry'į.
 *
 * baseResult — search result'as su Phase 1 SLIM data (aprasymas, kilme,
 * savybes, image, sources). Jei perduotas, įtraukiamas į fullPlant prieš
 * catalog save. Be jo catalog entry'is gaudavo tik care info (be image,
 * be aprasymas) ir admin matydavo tuščius laukus.
 */
async function fetchDetails(latinName, name, baseResult = null) {
  // Pirma tikriname katalogą — jei jau yra priežiūros duomenys, nemokami
  const cached = await getCatalogEntry(latinName)
  if (cached?.laistymasIntervalas) {
    // Grąžiname tik priežiūros duomenis — ne nuotrauką (kiekvienas vartotojas gauna savą iš iNaturalist)
    const { image: _img, updatedAt: _ts, lotyniskas: _lt, lietuviškas: _liet, ...careData } = cached
    return careData
  }

  // Phase 2 — FULL save. Anksciau buvo tik care info, bet SLIM mode (Phase 1)
  // nepildė savybes/sviesa/vanduo/idomybes/tipas/sunkumas/augimo_greitis,
  // todėl save'inta entry buvo iškarpytas. Dabar Phase 2 pildo VISKĄ kas
  // reikalinga „Ferrari quality" plant detail puslapiui — kaip 2026-05-02 era.
  // Token'ų cost +30% bet save'as gauna pilną spektrą.
  //
  // RAG SWAP (2026-05-21): vietoj „AI generate from memory" → „AI structure
  // verified facts". buildPlantRagContext renka faktus iš pre-DB + PFAF +
  // ASPCA + Cheng + Wikipedia ir įjungia juos kaip context'ą. AI pakeičia
  // rolę į „strukturizuoti + verst LT". Haliucinacijų rizika ↓ ~70%.
  const ragStartTime = Date.now()
  const rag = await buildPlantRagContext(latinName, {
    includeCheng: true,
    includePropagation: true,
    maxLen: 2500,   // sumažinta nuo 4500 — per ilgas system prompt'as
                    // sukėlė regressioną (Aconitum idomybesCount=0).
  })
  const ragMs = Date.now() - ragStartTime

  // Grounded system prompt: VOICE_PERSONA + PLANT_SYSTEM + RAG priority + verified
  // facts + LT climate + vet links. Step 6l — VOICE_PERSONA shared across client +
  // server, kad output'as skaitytųsi vienodu „Sodininkas" LT friend balsu.
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

  console.log('[fetchDetails] RAG context built:', {
    latinName,
    ragMs,
    contextChars: rag.context?.length ?? 0,
    confidence: rag.confidence,
    sources: rag.sources,
    hasIdentity: rag.hasIdentityData,
    hasLtName: rag.hasLtName,
    hasToxicity: rag.hasToxicity,
    hasCare: rag.hasCare,
    hasCheng: rag.hasCheng,
  })

  // B1: toxicity grandinė (deterministinis deriveToxicityFromSources + narrative AI)
  // priklauso TIK nuo latinName — NE nuo details output'o. Paleidžiam LYGIAGREČIAI
  // su details call'u (−5–15s per Save). await'inam žemiau, kur reikia.
  const toxicityPromise = (async () => {
    const derivedToxicity = await deriveToxicityFromSources(latinName)
    const nar = await generateToxicityNarrative({ claudeCall, latinName, derivedToxicity })
    return { derivedToxicity, nar }
  })()

  const r = await claudeCall({
    maxTokens:  3000,
    temperature: 0.3,   // grąžinta į 0.3 — 0.5 nepadėjo, AI'us tapdavo overload'intas
    system:     groundedSystem,
    tools:      [TOOL_DETAILS],
    toolChoice: { type: 'tool', name: 'plant_details' },
    messages:   [{
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
• laistymasIntervalas: { vasara, ziema, metodas } — dienų skaičius + technika
• tresimas: { intervalVasara, intervalZiema, tipas } — interval + trąšų rūšis
• substratas, persodinimas, ziemojimas: narrative Lithuanian
• dauginimas: array of 2-4 methods
• problemos: array of 3-5 entries su simptomas/priezastis/sprendimas

GENUS-LEVEL META (PRIVALOMA):
• tipas: pvz. „Sultingas", „Tropinis daugiametis"
• augimo_greitis: „lėtas"/„vidutinis"/„greitas"
• sunkumas: 1-5 (priežiūros sudėtingumas)

IDOMYBES — CRITICAL, DO NOT SKIP:
• REQUIRED — return native JSON array with 2-3 items. NEVER return as JSON-string.
• Each item — 1-2 short sentences in Lithuanian.
• Use Lithuanian curly quotes INSIDE strings if needed („like this"),
  but the array structure itself uses native JSON syntax.
• Topics: history/discovery, etymology, ecological role, cultural significance,
  unusual biology, geographic origin, traditional uses, hybridization history.
• Example structure (native array, NOT JSON-string):
    idomybes: [
      "Schefflera arboricola kilusi iš Taivano kalnuotų miškų, kur natūraliai pasiekia iki 8 metrų aukščio.",
      "Jos žiedai labai smulkūs ir neturi dekoratyvinės vertės — augalas auginamas tik dėl efektingų delninių lapų.",
      "Sub-tropikuose populiariai naudojama bonsai formavimui dėl atsparios kamieno struktūros."
    ]
• If you do not know specific facts — generate well-grounded ones from
  genus characteristics. NEVER leave idomybes empty.

SAVYBES (PRIVALOMA struktūra — net nepavojingam augalui):
• pavojai: GRANULIARUS array — pildyk GENEROUSLY kai žinai tipas+target.
  Default severity='vidutinis' kai info patvirtinta bet nekvantifikuota.
  Empty array kai nepavojingas.
• pavojingumas: { yra, lygis, detales } — saugiklis kai pavojai tuščias.
• valgomumas: { statusas: 'none'/'dalinai'/'pilnai', dalys, detales }
• vaistinis: { statusas: 'none'/'tradicine'/'moksline', naudojama, detales }

Naudok savo botanikos žinias + Wikipedia/RHS info kur reikia. Visi human-readable laukai LIETUVIŠKAI.`,
    }],
  })
  const block   = r.content.find(b => b.type === 'tool_use' && b.name === 'plant_details')
  const rawDetails = block?.input ?? {}

  // ────────────────────────────────────────────────────────────────
  // AI BOUNDARY — vienintelė vieta, kur normalize'inam tool_use atsakymą.
  // Anthropic API neapsaugo strict type validation'u, todėl array laukai
  // gali ateit kaip JSON-formatuoti STRING'ai. normalizeAIResponse paleidžia
  // ensureArray ant visų array laukų (ir nested pavojai). Po šio call'o
  // downstream'as (catalog write, plant doc save, render) gali tikėtis,
  // kad idomybes/dauginimas/problemos yra tikri array'ai.
  // ────────────────────────────────────────────────────────────────
  const details = normalizeAIResponse(rawDetails)

  // Diagnostic — kiek faktų sutvarkėm. Galim ištrinti po patvirtinto fix'o.
  console.log('[fetchDetails] AI Phase 2 normalized:', {
    latinName,
    idomybesCount: details.idomybes?.length ?? 0,
    rawIdomybesType: typeof rawDetails.idomybes,
    wasJsonString: typeof rawDetails.idomybes === 'string',
    pavojaiCount: details.savybes?.pavojai?.length ?? 0,
    tipas: details.tipas,
  })

  // ────────────────────────────────────────────────────────────────
  // D STRICT — DETERMINISTIC TOXICITY + AI NARRATIVE (post test #11).
  //
  // Vartotojo verdict'as: AI = structurer, ne creator. Mūsų DB = authority.
  // Strategija:
  //   1. deriveToxicityFromSources tikrai pagal MŪSŲ ASPCA+PFAF.
  //   2. JEI hasToxicity=true → STRUKTURIZUOTI pavojai užrašom (DB authority).
  //   3. JEI hasToxicity=true → mini AI call'as VERTIMUI/STRUKTURIZAVIMUI
  //      iš mūsų source'o į LT warning narrative. AI yra TRANSLATOR,
  //      ne KŪRĖJAS — neprideda iš training'o.
  //   4. JEI hasToxicity=false → palieka pavojai=[], pavojingumas.yra=false.
  //      AI NIEKO nepilanavo savo training'o (no scare mongering).
  // ────────────────────────────────────────────────────────────────
  // D STRICT (6b versija plus): VISADA kviečiam narrative gen, AI grąžina:
  //   • detales = LT translation IF mūsų DB turi entry; ELSE null
  //   • aiSupplementaryHazard = object IF DB tyli BET genus whitelist'e +
  //     hospitalization bar; ELSE null (99% atvejų)
  // Mūsų DB = primary authority. AI gap-fill su strict evidence.
  // B1: await lygiagrečiai paleistą toxicity grandinę (žr. viršuje) — iki čia
  // ji jau (beveik) baigta, nes sukosi kartu su details call'u.
  const { derivedToxicity, nar } = await toxicityPromise
  console.log(`[fetchDetails] narrative AI (parallel su details) — detales:${nar.detales ? nar.detales.length+'ch' : 'null'} aiSupplementaryHazard:${nar.aiSupplementaryHazard ? 'object' : 'null'}`)

  if (derivedToxicity.hasToxicity) {
    // DB turi entry → struktūrizuotas pavojai + LT narrative
    details.savybes = {
      ...(details.savybes ?? {}),
      pavojai: derivedToxicity.pavojai,
      pavojingumas: { ...derivedToxicity.pavojingumas },
    }
    if (nar.detales) {
      details.savybes.pavojingumas.detales = nar.detales
      details.toxicityNarrativeGenerated = true
    } else {
      // Fallback — LT placeholder iš deriveToxicity (jau LT-friendly)
      console.warn(`[fetchDetails] narrative gen failed for ${latinName} — placeholder fallback`)
      details.toxicityNarrativeGenerated = false
    }
    details.toxicitySources = derivedToxicity.sources
  } else if (nar.aiSupplementaryHazard) {
    // DB tyli BET AI auditor pridėjo gap-fill — saugom į savybes
    // su aiSupplementaryHazard lauke (audit-visible) + minimal pavojai entry
    console.warn(`[fetchDetails] aiSupplementaryHazard ACTIVATED for ${latinName}:`, nar.aiSupplementaryHazard)
    const sup = nar.aiSupplementaryHazard
    details.savybes = {
      ...(details.savybes ?? {}),
      aiSupplementaryHazard: sup,
      pavojai: [{
        tipas:    'toksiskas',
        target:   sup.target === 'abiem' ? 'zmonems' : sup.target, // schema enum
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
  // else: DB tyli + AI grąžino null → nothing to add (safe plant, scare prevention)

  // Išsaugome į katalogą — kitas vartotojas gaus iš cache.
  // Merge'inam SLIM auto-save cached data (aprasymas, kilme, savybes,
  // sviesa, vanduo) su Phase 2 details — kad parent species taxonGroup'as
  // gautų PILNĄ informaciją, ne tik care field'us. Be šito merge'o
  // parent doc'as susikurtų su mostly null'ais (TOOL_DETAILS schema nepildo
  // genus-level field'ų — tik care + dauginimas + problemos).
  if (details.laistymasIntervalas) {
    // Spread order — kuo specifiškesnis, tuo vėliau:
    //   1. cached (jei egzistuoja, sena versija)
    //   2. baseResult (search Phase 1: aprasymas, kilme, savybes, IMAGE, sources)
    //   3. lotyniskas/lietuviškas (canonical iš parametrų)
    //   4. details (Phase 2: care info, override'ina viską jei conflict)
    const fullPlant = {
      ...(cached ?? {}),
      ...(baseResult ?? {}),
      lotyniskas: latinName,
      lietuviškas: name,
      ...details,
    }

    // KRITINIS — verificationStatus upgrade'as (2026-05-21 audit fix).
    // Jei cached arba baseResult turėjo 'preview' (iš Phase 0.3 catalogPreviewUpsert),
    // o Phase 2 sėkmingai grąžino full care info (laistymasIntervalas yra) —
    // PROMOTE'inam į 'auto-verified'. normalizeAIResponse() neturi šio lauko,
    // todėl spread'as nesusveriaja status'o automatiškai.
    const previousStatus = (cached?.verificationStatus ?? baseResult?.verificationStatus ?? null)
    if (previousStatus === 'preview' && details.laistymasIntervalas) {
      fullPlant.verificationStatus = 'auto-verified'
      fullPlant.aiConfidence = details.confidence ?? 'mid'
      console.log('[fetchDetails] catalog upgrade preview → auto-verified for', latinName)
    }

    // Pridėti RAG provenance + Phase 2 sources
    fullPlant.ragSources = rag.sources
    fullPlant.ragConfidence = rag.confidence
    fullPlant.schemaVersion = 2

    saveCatalogWithSpeciesParent(fullPlant)
      .then(() => triggerHeroGen(latinName))   // Phase A3: async drawing gen po global-save
      .catch(e => console.warn('[fetchDetails] catalog save failed:', e?.message ?? e))
  }

  return details
}

async function enrich(parsed) {
  const isCultivar =
    parsed.matchLevel === 'cultivar' ||
    /['"][^'"]+['"]/.test(parsed.latinName ?? '')

  // Wikidata verification — VISADA paraleliai (abiems branches), kad main
  // result'as gautų ✓ badge'ą tokia pat tvarka kaip candidates. Hit'as ant
  // structured entity'o = stiprus signal'as, kad augalas realiai egzistuoja
  // (atmeta AI hallucinations).
  const wdPromise = fetchWikidataPlant(parsed.latinName)

  // iNaturalist NETURI cultivar coverage'o — stripCultivar() vidiniame
  // fetch'e nuima quotes prieš API call'ą, todėl grąžinama artimiausia
  // RŪŠIS (pvz. „Gelsvoji raganė" Clematis 'Boulevard' užklausai).
  //
  // Apsauga: jei AI explicitly grąžino cultivar (matchLevel=='cultivar'
  // arba latinName turi quote'us) — NEPERRAŠOM AI suggested name'o iNat
  // species'o vardu. iNat lieka species'ams kaip:
  //   - photo fallback'as (jei Brave neranda)
  //   - gallery extras (kelios nuotraukos cycling'ui PhotoSheet'e)
  //   - LT name + sinonimai + englishNames (per fetchPlantNames)
  //
  // Low-confidence rezultatai — atmetam iNat enrichment'ą visiškai.
  const trustInat = !isCultivar && parsed.confidence !== 'low'

  if (trustInat) {
    // Species path. UNIFIED photo priority — Brave FIRST (gardener-style
    // photos, ne wild collection nuotraukos), iNat fallback'as ir gallery.
    // Visa keturi šaltiniai paraleliai — bendras laikas = max(brave, inat,
    // names, wikidata), o ne suma.
    const [bravePhotos, inatPhotos, namesData, wd] = await Promise.all([
      fetchBraveImages(parsed.latinName, 5),   // TOP 5 Brave — gardener-style nuotraukos
      fetchPhotos(parsed.latinName),
      fetchPlantNames(parsed.latinName),
      wdPromise,
    ])
    const bravePhoto = bravePhotos[0] ?? null

    // Primary image priority chain:
    //   1. Brave[0] (gardener photo) → 2. iNat[0] (species photo) → 3. Wikidata P18
    //   → 4. Wikipedia thumb (paskutinis fallback'as, sequential)
    let mainImage = bravePhoto ?? inatPhotos[0] ?? wd?.imageUrl ?? null
    if (!mainImage) mainImage = await fetchWikiThumbnail(parsed.latinName)

    // Gallery — TOP 5 Brave (gardener-style, vizualiai patrauklios) PIRMA,
    // paskui iNat (wild-style species photos) kaip extras. Deduplicate'inam
    // URL'us, kad Brave hero nebūtų antrą kartą sąraše. 2026-05 fix'as —
    // anksciau gallery turėdavo TIK 1 Brave + N iNat, todėl user'is mate
    // daugiausiai biologinių wild photos. Dabar 5 Brave dominuoja pradžioje.
    const braveSet = new Set(bravePhotos)
    const gallery = [
      ...bravePhotos,
      ...inatPhotos.filter(p => p && !braveSet.has(p)),
    ]

    const inatLtName = namesData?.inatLtName ?? null
    return {
      ...parsed,
      name:             inatLtName ?? parsed.name,
      image:            mainImage,
      photos:           gallery.length > 0 ? gallery : (mainImage ? [mainImage] : []),
      inatLtName,
      inatTaxonId:      namesData?.inatTaxonId ?? null,
      sinonimai:        namesData?.sinonimai    ?? [],
      englishNames:     namesData?.englishNames ?? [],
      wikidataId:       wd?.id ?? null,
      wikidataVerified: !!wd?.id,
    }
  }

  // Cultivar / low-confidence path — multi-source priority chain:
  //   1. Brave Image Search (paid primary, ~85-90% hit rate)
  //   2. iNaturalist Taxa autocomplete (free, plant-focused, strict cultivar match)
  //   3. Wikidata P18 (free)
  //   4. Wikipedia direct + opensearch thumbnail (free)
  // null jei visi miss → UI rodo plant card be photo.
  let mainImage = await fetchBraveImage(parsed.latinName)
  if (!mainImage) mainImage = await fetchInatCultivarImage(parsed.latinName)
  const wd = await wdPromise  // join — naudojam ir image fallback'ui ir verification'ui
  if (!mainImage && wd?.imageUrl) mainImage = wd.imageUrl
  if (!mainImage) mainImage = await fetchWikiThumbnail(parsed.latinName)

  return {
    ...parsed,
    name:             parsed.name,
    image:            mainImage,
    photos:           mainImage ? [mainImage] : [],
    wikidataId:       wd?.id ?? null,
    wikidataVerified: !!wd?.id,
    inatLtName:       null,
    inatTaxonId:      null,
    sinonimai:        [],
    englishNames:     [],
  }
}

// Wikipedia RAG — Pasiima en.wikipedia.org abstract'ą ir formatuoja į user
// message'o priedą. Naudojama prieš Claude call'ą savybes RAG'ui (toksiškumas,
// valgomumas, vaistinis). null jei Wikipedia neturi straipsnio.
async function buildWikipediaContextMessage(latinName) {
  const ctx = await fetchWikipediaContext(latinName)
  if (!ctx?.extract) return null
  return `--- Wikipedia (en) šaltinis: ${ctx.title} ---\n${ctx.extract}\n--- pabaiga ---\n\nNaudok šį šaltinį kaip pirminį autoritetą savybėms (pavojai, valgomumas, vaistinis). Papildyk savo žiniomis kur trūksta. Detalėse paminėk "Wikipedia mini, kad ..." kai informacija iš ten.`
}

// Išvalo latin name'ą thumbnail search'ams — strip'inam ®/™/©, parenthetical
// suffix'us („(Boulevard® serija)"), trim. Lieka švarus „Clematis 'Acropolis'".
function cleanLatinForSearch(latinName) {
  if (!latinName) return ''
  return latinName
    .replace(/\s*\([^)]*\)\s*/g, ' ')   // strip (...) suffix
    .replace(/[®™©]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Brave Image Search API — proxy'inta per /api/plant-image. Primary
// photo source (highest hit rate, ~85-90% populiariems cultivars'ams).
// Free tier 2000 queries/mėn, paskui $3/1000.
//
// (Anksčiau bandėm Google Custom Search — Google account-level blokavo
// naujiems projektams. Brave laisvesnis.)
//
// Strict filter'is: returned image title arba url privalo turėti BOTH
// genus IR cultivar word'us. Atmetam random / unrelated photos.
async function fetchBraveImage(latinName) {
  if (!latinName) return null
  const cleaned = cleanLatinForSearch(latinName)
  if (!cleaned) return null
  const genus    = cleaned.split(/\s+/)[0].toLowerCase()
  const cultivar = cleaned.replace(/['"]/g, '').toLowerCase().split(/\s+/).slice(1).join(' ').split(/\s+/)[0]

  // Client-side timeout — server'is jau turi 4s abort, bet jei Vercel cold
  // start ar tinklas užkimba, neturim laukti 30s+ ERR_TIMED_OUT'o, kol kybos
  // visi candidates. 5s viršyti = grįžtam null ir leidžiam iNat/Wikidata/
  // Wikipedia/Commons fallback'us pradėti. (2026-05 regresija: Brave kybėjo
  // → 23s photo collection → user'iui atrodė kad photos „neveikia".)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 5000)

  try {
    const r = await fetch(`/api/plant-image?q=${encodeURIComponent(cleaned)}`, { signal: ctrl.signal })
    if (!r.ok) return null
    const data = await r.json()
    const candidates = data.images ?? []

    // Strict filter — title arba source url turi turėti BOTH genus IR cultivar.
    // Jei nei vienas neatitinka, grąžinam pirmą tik jei genus matosi
    // (genus-level fallback be cultivar mention).
    const strict = candidates.find(img => {
      const haystack = `${img.title ?? ''} ${img.source ?? ''} ${img.url ?? ''}`.toLowerCase()
      return haystack.includes(genus) && cultivar && haystack.includes(cultivar)
    })
    if (strict?.url) return strict.url

    // Genus-only fallback — atmetam tikrą false positive (irrelevant photo)
    const genusOnly = candidates.find(img => {
      const haystack = `${img.title ?? ''} ${img.source ?? ''} ${img.url ?? ''}`.toLowerCase()
      return haystack.includes(genus)
    })
    return genusOnly?.url ?? null
  } catch (e) {
    if (e.name === 'AbortError') {
      console.warn('[brave-image] timed out after 5s — falling through to iNat/Wikidata/Wikipedia/Commons')
    } else {
      console.warn('[brave-image] fetch failed:', e)
    }
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * fetchBraveImages(latinName, limit) — gauna TOP N Brave nuotraukas gallery'jai.
 * Skiriasi nuo fetchBraveImage (singular) tuo, kad grąžina array iki `limit`
 * URL'ų, filtruotų pagal genus / cultivar match.
 *
 * Naudojama enrich() gallery konstravimui — kad photos[] turėtų ne 1 Brave +
 * 9 iNat, o 3-5 Brave (gardener-style) + likę iNat (wild collection).
 *
 * Tas pats endpoint'as `/api/plant-image` (Brave Search proxy + Vercel cache).
 */
async function fetchBraveImages(latinName, limit = 5) {
  if (!latinName) return []
  const cleaned = cleanLatinForSearch(latinName)
  if (!cleaned) return []
  const genus    = cleaned.split(/\s+/)[0].toLowerCase()
  const cultivar = cleaned.replace(/['"]/g, '').toLowerCase().split(/\s+/).slice(1).join(' ').split(/\s+/)[0]

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 5000)

  try {
    const r = await fetch(`/api/plant-image?q=${encodeURIComponent(cleaned)}`, { signal: ctrl.signal })
    if (!r.ok) return []
    const data = await r.json()
    const candidates = data.images ?? []

    // Priority order — strict matches pirmiausia (genus + cultivar abu), tada
    // genus-only matches. Pirmenybės sąraše paliekam unikalius URL'us.
    const strict = candidates.filter(img => {
      const haystack = `${img.title ?? ''} ${img.source ?? ''} ${img.url ?? ''}`.toLowerCase()
      return haystack.includes(genus) && cultivar && haystack.includes(cultivar)
    })
    const genusOnly = candidates.filter(img => {
      const haystack = `${img.title ?? ''} ${img.source ?? ''} ${img.url ?? ''}`.toLowerCase()
      return haystack.includes(genus) && !strict.includes(img)
    })

    const ordered = [...strict, ...genusOnly]
    const urls = []
    const seen = new Set()
    for (const img of ordered) {
      if (!img?.url || seen.has(img.url)) continue
      seen.add(img.url)
      urls.push(img.url)
      if (urls.length >= limit) break
    }
    return urls
  } catch (e) {
    if (e.name === 'AbortError') {
      console.warn('[brave-images] timed out after 5s')
    } else {
      console.warn('[brave-images] fetch failed:', e)
    }
    return []
  } finally {
    clearTimeout(timer)
  }
}

// iNaturalist Taxa Autocomplete — plant-focused, free, no key. Garden
// cultivars dažnai yra iNat taksonomijoje su default_photo field'u.
//
// CONSERVATIVE filter'is: grąžinam tik jei iNat taxon name turi BOTH
// genus IR cultivar word'us (case-insensitive). Atmetam random Clematis
// vitalba photos kai paklausta apie Clematis 'Acropolis'.
async function fetchInatCultivarImage(latinName) {
  if (!latinName) return null
  const cleaned = cleanLatinForSearch(latinName)
  const m = cleaned.match(/^(\S+)\s+(.+)$/)
  if (!m) return null
  const genus    = m[1].toLowerCase()
  const cultivar = m[2].replace(/['"]/g, '').toLowerCase().split(/\s+/)[0]  // pirmas cultivar žodis
  if (!cultivar) return null

  try {
    const r = await fetch(`https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(cleaned)}&per_page=5`)
    if (!r.ok) return null
    const data = await r.json()
    const match = data.results?.find(t => {
      const name = (t.name ?? '').toLowerCase()
      return name.includes(genus) && name.includes(cultivar)
    })
    return match?.default_photo?.medium_url
        ?? match?.default_photo?.square_url
        ?? null
  } catch (e) {
    console.warn('[inat-cultivar] failed:', e)
    return null
  }
}

// Wikidata SPARQL/Search — structured cultivar data + image. Free, ~200ms.
//
// (Pastaba: 2026-05 bandėm pridėti Google Custom Search Image API kaip
// primary photo source. Google account-level apribojo Custom Search JSON
// API naujiems projektams — net atskiras non-Firebase project'as gavo
// 403 „This project does not have the access". Drop'inta. Likę šaltiniai:
// iNat + Wikidata + Wikipedia + Commons + AI's web_search imageUrl.)
//
// Returns: { id (Q-entity), label, description, imageUrl } | null
//
// Coverage: gerokai geresnė nei Wikipedia article — Wikidata turi structured
// entity'us populiariems cultivar'ams net jei nėra atskiro Wikipedia article'o.
// Image (P18 property) → konvertuojamas į Commons Special:FilePath URL'ą.
async function fetchWikidataPlant(latinName) {
  if (!latinName) return null
  const cleaned = cleanLatinForSearch(latinName)
  if (!cleaned) return null

  try {
    // Step 1: search entities by label
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(cleaned)}&language=en&type=item&format=json&origin=*&limit=5`
    const r = await fetch(searchUrl)
    if (!r.ok) return null
    const data = await r.json()
    const hits = data.search ?? []
    if (!hits.length) return null

    // Filter — prefer plant-related descriptions (cultivar/plant/species/genus name)
    const genus = cleaned.split(/\s+/)[0].toLowerCase()
    const plantHit = hits.find(h => {
      const desc = (h.description ?? '').toLowerCase()
      return desc.includes('cultivar') ||
             desc.includes(genus) ||
             desc.includes('plant') ||
             desc.includes('species') ||
             desc.includes('hybrid')
    }) ?? hits[0]

    // Step 2: fetch full entity to extract image (P18)
    const entityRes = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${plantHit.id}.json`)
    if (!entityRes.ok) return { id: plantHit.id, label: plantHit.label, description: plantHit.description, imageUrl: null }
    const entityData = await entityRes.json()
    const entity = entityData.entities?.[plantHit.id]

    const imageFilename = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value
    const imageUrl = imageFilename
      ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageFilename.replace(/ /g, '_'))}?width=300`
      : null

    return {
      id: plantHit.id,
      label: plantHit.label,
      description: plantHit.description,
      imageUrl,
    }
  } catch (e) {
    console.warn('[wikidata] lookup failed:', e)
    return null
  }
}

// Parent species Wikipedia cultivar mention check.
//
// Use case: AI grąžina „Dionaea muscipula 'Justina Davis'" su high confidence,
// bet Wikidata neturi entity'o atskirai tam cultivar'ui (dažnas atvejis retiems
// kultivarams). Standartinis flow'as downgrade'ina į medium. Bet jei TĖVINĖS
// rūŠIES Wikipedia puslapyje cultivar'as paminėtas (pvz. cultivar list'e) —
// tai stiprus signal'as, kad jis tikras, tiesiog be atskiro entity'o.
//
// Algoritmas:
//   1. Iš „Dionaea muscipula 'Justina Davis'" ištraukiam species + cultivarName
//   2. Fetch'inam parent species Wikipedia extract'ą (prop=extracts plain text)
//   3. Ieškom cultivarName kaip case-insensitive substring'o extract'e
//
// Bandom abi kalbas (EN + LT) — paraleliai. Pirmas hit'as = TRUE.
// Network fail'ai → false (silently — tai tik papildomas signal'as).
async function parentWikipediaMentionsCultivar(latinName) {
  if (!latinName) return false
  const m = latinName.match(/^(.+?)\s*['"]([^'"]+)['"]\s*$/)
  if (!m) return false
  const species = m[1].trim()
  const cultivarName = m[2].trim()
  if (!species || !cultivarName || cultivarName.length < 3) return false

  const needle = cultivarName.toLowerCase()
  const tryLang = async (lang) => {
    try {
      const slug = species.replace(/\s+/g, '_')
      const r = await fetch(
        `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(slug)}&prop=extracts&explaintext=1&format=json&origin=*`
      )
      if (!r.ok) return false
      const data = await r.json()
      const pages = data?.query?.pages
      if (!pages) return false
      const page = Object.values(pages)[0]
      const extract = page?.extract ?? ''
      return !!extract && extract.toLowerCase().includes(needle)
    } catch { return false }
  }
  const [en, lt] = await Promise.all([tryLang('en'), tryLang('lt')])
  return en || lt
}

// Wikipedia REST API — thumbnail per latin name. Cultivar'ams retas case'as
// kad būtų atskiras article — todėl bandom kelis variantus + fallback į
// opensearch API (Wikipedia full-text search).
async function fetchWikiThumbnail(latinName) {
  if (!latinName) return null
  const cleaned = cleanLatinForSearch(latinName)
  if (!cleaned) return null

  // Step 1: direct page summary su keliais slug variantais
  const variants = [
    cleaned.replace(/\s+/g, '_'),                     // su quote'ais
    cleaned.replace(/['"]/g, '').replace(/\s+/g, '_'), // be quote'ų
  ]
  for (const slug of variants) {
    try {
      const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`)
      if (!r.ok) continue
      const data = await r.json()
      const url = data.thumbnail?.source ?? data.originalimage?.source ?? null
      if (url) return url
    } catch {}
  }

  // Step 2: opensearch fallback — Wikipedia search, take top hit's page summary
  try {
    const r = await fetch(`https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(cleaned)}&limit=1&format=json&origin=*`)
    if (!r.ok) return null
    const [, titles] = await r.json()
    if (!titles?.[0]) return null
    const slug = titles[0].replace(/\s+/g, '_')
    const r2 = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`)
    if (!r2.ok) return null
    const data = await r2.json()
    return data.thumbnail?.source ?? data.originalimage?.source ?? null
  } catch { return null }
}

// Wikimedia Commons — search File: namespace su STRICT title filter'iu.
// Commons search'as match'ina pagal žodžius — be filtro grąžindavo
// random false positives („Volunteer parade.jpg" už „Clematis Volunteer").
//
// Filtras: file title PRIVALO turėti BOTH genus name AND cultivar name
// (case-insensitive). Atmetam kitką — geriau emoji nei klaidinanti photo.
async function fetchCommonsImage(latinName) {
  if (!latinName) return null
  const cleaned = cleanLatinForSearch(latinName)
  if (!cleaned) return null

  // Išskaidom į genus + cultivar (jei yra quote'uotas cultivar dalis)
  const cultivarMatch = cleaned.match(/^(\w+)\s+['"]?([^'"]+?)['"]?$/)
  const genus    = cultivarMatch?.[1]?.toLowerCase()
  const cultivar = cultivarMatch?.[2]?.toLowerCase()
  if (!genus || !cultivar) return null  // nesame cultivar — palieku null

  try {
    // Bandom kelis search hit'us (ne tik top 1), kad rastume match'ą filter'iui
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`${genus} ${cultivar}`)}&srnamespace=6&srlimit=5&format=json&origin=*`
    const r = await fetch(searchUrl)
    if (!r.ok) return null
    const data = await r.json()
    const hits = data.query?.search ?? []

    // Strict filter — title TURI turėti ir genus, ir cultivar name
    const validHit = hits.find(h => {
      const title = (h.title ?? '').toLowerCase()
      return title.includes(genus) && title.includes(cultivar)
    })
    if (!validHit) return null

    // Gauti thumbnail URL'ą (200px wide)
    const fileUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(validHit.title)}&prop=imageinfo&iiprop=url&iiurlwidth=200&format=json&origin=*`
    const r2 = await fetch(fileUrl)
    if (!r2.ok) return null
    const data2 = await r2.json()
    const page = Object.values(data2.query?.pages ?? {})[0]
    return page?.imageinfo?.[0]?.thumburl ?? null
  } catch { return null }
}

// Enrich'ina candidates su image URL'ais + Wikidata verification flag'u.
//
// Image priority chain (unchanged):
//   1. AI parinko imageUrl iš savo web_search (retas hit)
//   2. Brave Image Search (PAID primary, ~85-90% hit rate)
//   3. iNaturalist Taxa Autocomplete (free, plant-focused fallback)
//   4. Wikidata SPARQL (free)
//   5. Wikipedia REST direct + opensearch (free)
//   6. Wikimedia Commons strict filter (free)
//   7. null → UI fallback'ina į emoji
//
// Wikidata verification — VISADA paralelinis call'as (ne tik image fallback'ui).
// Naudojamas trust signal'ui — UI candidate card'as rodo ✓ ikonėlę „Patvirtinta
// per Wikidata" kai entity rastas. Wikidata yra human-curated structured data,
// todėl hit'as = high confidence kad cultivar realiai egzistuoja (atmeta AI
// hallucinations).
//
// Per-candidate sekvencialiai image'ams (early-exit), tarp candidates paraleliai.
async function enrichCandidates(candidates) {
  // Defensive — visada grąžinam masyvą, net jei AI'us nukrypo nuo schema'os
  // (pvz. grąžino object'ą ar null kai schema sako array). Anksčiau grąžindavom
  // input'ą as-is, kas vesdavo prie `.filter is not a function` error'o post-AI
  // verification cross-check'e.
  if (!Array.isArray(candidates) || candidates.length === 0) return []
  return Promise.all(candidates.map(async c => {
    // Wikidata — startuoja iš karto, lygiagrečiai su image enrichment'u
    const wdPromise = fetchWikidataPlant(c.latinName)

    // Image chain — early-exit kai pirmas šaltinis grąžina
    let imageUrl = c.imageUrl ?? null
    if (!imageUrl) imageUrl = await fetchBraveImage(c.latinName)
    if (!imageUrl) imageUrl = await fetchInatCultivarImage(c.latinName)

    // Join Wikidata — naudojamas tiek image fallback'ui, tiek verification flag'ui
    const wd = await wdPromise
    if (!imageUrl && wd?.imageUrl) imageUrl = wd.imageUrl

    if (!imageUrl) imageUrl = await fetchWikiThumbnail(c.latinName)
    if (!imageUrl) imageUrl = await fetchCommonsImage(c.latinName)

    return {
      ...c,
      imageUrl,
      wikidataId:       wd?.id ?? null,
      wikidataVerified: !!wd?.id,   // ✓ badge UI'e
    }
  }))
}


export default function SearchModal({ onAddToWishlist, onAddToDashboard, onClose, plants = [], onViewPlant, onPromote, onUpdatePlant, initialQuery = '', autoCamera = false }) {
  // Desktop split panel: portaliuojam į RightPanel container'į.
  const isDesktop = useIsDesktop()
  const host = useDetailHost()
  const useDesktopPanel = isDesktop && !!host?.container

  useEffect(() => {
    if (!useDesktopPanel || !host) return
    host.open()
    return () => host.close()
  }, [useDesktopPanel]) // eslint-disable-line react-hooks/exhaustive-deps

  // 2026-05-27 — SearchModal mount'inant invalidina catalog cache'ą.
  // Forces fresh fetch ant kito searchCatalog() call'o → user'is mato
  // naujausias image/care duomenis po server-side batch run'ų (Admin SDK
  // batch'as nepasiekia client'o `bustCatalogCache`). Cost'as: 1 Firestore
  // catalog reload (~80 docs) per SearchModal sesiją — acceptable trade'as.
  useEffect(() => {
    bustCatalogCache()
  }, [])

  // ESC keyboard shortcut — uždaryti modal'ą iš paneles desktop'e
  useEffect(() => {
    if (!useDesktopPanel) return
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [useDesktopPanel, onClose])

  const [query, setQuery]         = useState(initialQuery)
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState(null)
  const [error, setError]         = useState(null)
  const [dots, setDots]           = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [previewUrl, setPreview]  = useState(null) // photo search preview
  const [savingPhase2, setSavingPhase2]     = useState(false)
  const [photoIdx, setPhotoIdx]             = useState(0)
  const [paywallOpen, setPaywallOpen]       = useState(false)
  const [paywallLimitType, setPaywallLimitType] = useState(null)

  // Reset gallery index when a new result arrives
  useEffect(() => { setPhotoIdx(0) }, [result])
  const abortRef  = useRef(null)
  const inputRef  = useRef(null)
  const fileRef   = useRef(null)

  // Bulk save state — kai admin'as save'ina visus serijos cultivars iš karto.
  // null = neaktyvu; objektas = vyksta su progress info; 'done' / 'error' — terminus.
  const [bulkState, setBulkState] = useState(null)
  // { phase: 'ai'|'images'|'saving'|'done'|'error', total, completed, seriesName, savedCount, msg }

  useEffect(() => {
    if (!loading) { setDots(''); return }
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400)
    return () => clearInterval(t)
  }, [loading])

  // Real-time progress tracking — vietoj fake timer cycling (kuris atrodo
  // random nes nieko neatspindi), naudojam helper, kurį iškviečia konkretūs
  // search flow žingsniai. Konsoleje log'inam timings, kad galim matyti
  // kuris žingsnis lėtas ir optimizuoti.
  const stepStartRef = useRef(null)
  const trackStep = (label) => {
    const now = Date.now()
    if (stepStartRef.current) {
      const prevLabel = stepStartRef.current.label
      const elapsed   = ((now - stepStartRef.current.startedAt) / 1000).toFixed(2)
      console.log(`[search] ✓ ${prevLabel} — ${elapsed}s`)
    }
    if (label) {
      stepStartRef.current = { label, startedAt: now }
      setStatusMsg(label)
    } else {
      stepStartRef.current = null
      setStatusMsg('')
    }
  }

  // Auto-search if launched with a pre-filled query
  useEffect(() => {
    if (initialQuery.trim()) searchByText(initialQuery.trim())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-open camera picker if launched from camera button
  useEffect(() => {
    if (autoCamera) {
      const t = setTimeout(() => fileRef.current?.click(), 100)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Delayed input focus — kviečiama PO sheet animacijos pabaigos (spring
  // ~320ms). Skip jei autoCamera (kamera atsidaro pirma) arba jei initialQuery
  // jau yra (search'as triggerinasi automatiškai). iOS PWA fix'as: anksčiau
  // input autoFocus triggerindavo keyboard'ą kartu su sheet slide animacija,
  // dėl ko vyko coordinate shift mid-animation („overshoot į kairę").
  useEffect(() => {
    if (autoCamera || initialQuery.trim()) return
    const t = setTimeout(() => inputRef.current?.focus(), 320)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleKeyDown = e => {
    if (e.key === 'Enter' && query.trim() && !loading) searchByText(query.trim())
  }

  // ── Bulk save entire series → taxonGroups + catalog ─────────────────
  // Vienas AI call'as su TOOL_BULK_SERIES grąžina (series + cultivars).
  // Save'inam į DB ir paraleliai įkeliam image URL'us per Brave/iNat chain'ą.
  // Costs: ~$0.05-0.15 priklausomai nuo cultivars sk., +Brave queries.
  const bulkSaveSeries = async (seriesQuery, initialCandidates = []) => {
    setBulkState({ phase: 'ai', msg: 'AI surenka visą serijos info...' })
    try {
      // 1) AI bulk call su web_search (max_uses=3, nes serija dažnai reikalauja research'o)
      const r = await claudeCall({
        maxTokens:   8000,
        temperature: 0.3,
        system:      PLANT_SYSTEM,
        tools: [
          TOOL_BULK_SERIES,
          { type: 'web_search_20250305', name: 'web_search', max_uses: 3 },
        ],
        messages: [{
          role: 'user',
          content: `Pateik PILNĄ info apie augalų seriją „${seriesQuery}" naudojant bulk_series tool'ą. Surašyk VISUS žinomus cultivars (iki ${MAX_BULK_BATCH}). Series block — shared care/savybės; cultivars array — tik vizualinis aprašymas + bloom info per cultivar.

KRITIŠKAI SVARBU: cultivars[].latinName lauke naudok TRADE name (rinkos pavadinimą), pvz. „Clematis 'Olympia'", „Clematis 'Boulevard Bourbon'" — TAI, KĄ ŽMONĖS NAUDOJA. Patent/registracijos kodus (EVIPO006, EVIPO078, RADrazz) rašyk į registeredAs lauką, NIEKADA į latinName. Jei serijoje cultivars yra dvigubo pavadinimo (trade name + EVIPO kodas) — latinName = trade name, registeredAs = EVIPO kodas.

Naudok web_search RHS / Wikipedia / breeder svetainėse jei reikia patvirtinti tikrus trade name'us.`,
        }],
      })
      const block = r.content.find(b => b.type === 'tool_use' && b.name === 'bulk_series')
      if (!block) {
        console.error('[bulk] AI response without bulk_series tool_use:', r.content)
        throw new Error('AI neiškvietė bulk_series tool\'o — galimai užklausa neaiški')
      }

      // Defensive — AI'us kartais nukrypsta nuo schema'os (object vietoj array,
      // null vietoj field'o). Normalize'inam viską į saugias reikšmes prieš naudojant.
      const series    = block.input?.series ?? {}
      const cultivars = Array.isArray(block.input?.cultivars) ? block.input.cultivars : []

      // Debug log — pamatom, ką tiksliai AI grąžino, jei kažkas nepilna
      console.log('[bulk] AI response:', { seriesName: series.name, seriesType: series.type, cultivarsCount: cultivars.length })

      if (cultivars.length === 0) {
        // Pateikiam informatyvų error'ą su tuo, ką AI nustatė. Dažniausia
        // priežastis: užklausa nėra cultivar serija (pvz. tipinis genus
        // „Hosta" arba species „Hosta sieboldiana" be cultivar grupavimo).
        const aiContext = series.name
          ? `AI rado „${series.name}" (type: ${series.type ?? 'unknown'}), bet cultivar narių nesurinko.`
          : 'AI negrąžino jokios serijos informacijos.'
        throw new Error(`${aiContext} Galimos priežastys: užklausa nėra cultivar serija (pvz. tipinis genus arba species), AI'us neturi šios serijos žinių, arba web_search nieko nerado. Pabandyk tiksliau įvardinti seriją (pvz. „Clematis Boulevard" vietoj „Clematis").`)
      }

      const seriesId = taxonGroupDocId({ genus: series.genus, name: series.name, type: series.type })
      if (!seriesId) throw new Error(`Negalima sukurti seriesId (genus=„${series.genus}", name=„${series.name}")`)

      setBulkState({ phase: 'saving', msg: 'Saugomas serijos doc...', seriesName: series.name, total: cultivars.length, completed: 0 })

      // 2) Save series → taxonGroups. Visi array field'ai (aliases, dauginimas,
      // problemos, idomybes, sources) normalize'inami su Array.isArray check'u —
      // kad AI grąžintas object/null nekirtų downstream'ui.
      await saveTaxonGroup({
        id:             seriesId,
        type:           series.type,
        name:           series.name,
        genus:          series.genus,
        breeder:        series.breeder ?? null,
        aliases:        Array.isArray(series.aliases) ? series.aliases : [],
        aprasymas:      series.aprasymas,
        kilme:          series.kilme,
        tipas:          series.tipas,
        augimo_greitis: series.augimo_greitis,
        sunkumas:       series.sunkumas,
        cultivationContext: series.cultivationContext,
        lifecycle:      series.lifecycle,
        hardiness:      series.hardiness,
        typicalHeight:  series.typicalHeight,
        typicalSpread:  series.typicalSpread,
        careInfo:       series.careInfo ?? {},
        savybes:        series.savybes ?? {},
        dauginimas:     Array.isArray(series.dauginimas) ? series.dauginimas : [],
        problemos:      Array.isArray(series.problemos)  ? series.problemos  : [],
        idomybes:       Array.isArray(series.idomybes)   ? series.idomybes   : [],
        sources:        Array.isArray(series.sources)    ? series.sources    : [],
        verificationStatus: 'auto-verified',
        aiVerifiedAt:   new Date().toISOString(),
      })

      // 3) Per kiekvieną cultivar: fetch image + save į catalog (paraleliai)
      setBulkState({ phase: 'images', msg: 'Renku nuotraukas ir saugau cultivars...', seriesName: series.name, total: cultivars.length, completed: 0 })

      // Vienkartinis genus LT pavadinimo fetch'as — naudosim VISIEMS cultivars
      // šitoje serijoje (Boulevard 20 cultivars'ų visi turi tą patį Clematis →
      // „Gelsvoji raganė"). Compose'ina full Lt pavadinimą:
      //   „Gelsvoji raganė" (genus LT) + „Anželik" (cultivar LT) = „Gelsvoji raganė Anželik"
      // Anksciau lietuviškas buvo tik „Anželik" — PlantDetail title atrodė
      // nepilnas, vartotojas keldavo klausimą.
      let ltGenusName = null
      try {
        const genusNames = await fetchPlantNames(series.genus)
        ltGenusName = genusNames?.inatLtName ?? null
      } catch (e) { console.warn('[bulk] LT genus name fetch failed:', e) }

      let completed = 0
      // Defensive — initialCandidates ateina iš result.candidates (caller passes
      // SearchModal'io state'ą), kuris teoriškai jau masyvas po enrichCandidates
      // normalizacijos. Bet jei kažkas pakeitė state'ą tarp render'o ir bulk save'o —
      // nenorim cracked'inti čia.
      const safeInitial = Array.isArray(initialCandidates) ? initialCandidates : []
      const initialImageMap = new Map(
        safeInitial.map(c => [c.latinName, c.imageUrl ?? null])
      )
      // Renkam saved entries — pasirodys BulkSaveOverlay 'done' state'e
      // su „+ Pridėti į kolekciją" mygtukais kiekvienam. Vartotojas iš karto
      // po importo gali pasirinkti, kurį tiksliai pridėti į savo kolekciją.
      const savedEntries = []

      await Promise.all(cultivars.map(async (c) => {
        const cultId = catalogDocId(c.latinName)
        if (!cultId) { completed++; return }

        // Image enrichment + Wikidata verification — paraleliai.
        // Wikidata flag'ai saugomi catalog'e, kad library-first short-circuit'as
        // grąžintų cultivar'us su ✓ badge'ais (kaip ir AI-served candidates).
        const [imageUrl, wd] = await Promise.all([
          (async () => {
            let img = initialImageMap.get(c.latinName) ?? null
            if (!img) img = await fetchBraveImage(c.latinName)
            if (!img) img = await fetchInatCultivarImage(c.latinName)
            if (!img) img = await fetchWikiThumbnail(c.latinName)
            return img
          })(),
          fetchWikidataPlant(c.latinName),
        ])

        // Compose pilną LT pavadinimą: „{genus LT} {cultivar LT}".
        // Jei AI grąžino ltName, sujungiam su genus LT. Jei nėra cultivar LT,
        // fallback'as į genus LT vienas (vis tiek geriau nei latin name'as).
        // Jei net genus LT nėra — paliekam latin name'ą kaip last resort.
        const composedLt = (ltGenusName && c.ltName)
          ? `${ltGenusName} ${c.ltName}`
          : (c.ltName ?? ltGenusName ?? c.latinName)

        const entry = {
          lotyniskas:            c.latinName,
          lietuviškas:           composedLt,
          inatLtName:            ltGenusName,  // genus LT atskirai saugomas reference'ui
          emoji:                 c.emoji ?? '🌿',
          distinguishingFeature: c.distinguishingFeature,
          bloom:                 c.bloom ?? null,
          registeredAs:          c.registeredAs ?? null,
          overrides:             c.overrides ?? null,
          image:                 imageUrl,
          taxonGroupId:          seriesId,
          schemaVersion:         CATALOG_SCHEMA_VERSION,
          verificationStatus:    'auto-verified',
          wikidataId:            wd?.id ?? null,
          wikidataVerified:      !!wd?.id,
          aiVerifiedAt:          new Date().toISOString(),
        }
        // Bulk-series cultivar'ai jau turi taxonGroupId rodantį į seriją.
        // saveCatalogWithSpeciesParent matys to ir nepakuris parent species
        // taxonGroup'o (preservuos series link'ą). Care info čia ne'paduodama
        // tiesiai į cultivar entry — ji gyvena series taxonGroup'e per `careInfo`.
        await saveCatalogWithSpeciesParent(entry).catch(e => console.warn('[bulk] cultivar save failed:', c.latinName, e))
        // id reikia handleCatalogAdd'ui (catalogDocId pagal lotyniskas)
        savedEntries.push({ ...entry, id: catalogDocId(c.latinName), _id: catalogDocId(c.latinName) })

        completed++
        setBulkState(s => s ? { ...s, completed } : s)
      }))

      // Sort'inam išsaugotus pagal lietuvišką pavadinimą — vartotojui patogiau
      // skenuoti picker'yje
      savedEntries.sort((a, b) => (a.lietuviškas ?? '').localeCompare(b.lietuviškas ?? ''))

      setBulkState({
        phase: 'done',
        msg: `Pridėta ${cultivars.length} cultivars iš „${series.name}" serijos. Pasirink, kurį pridėti į kolekciją:`,
        seriesName: series.name,
        total: cultivars.length,
        completed: cultivars.length,
        savedCultivars: savedEntries,
      })
      console.log(`[bulk] ✓ ${series.name} — ${cultivars.length} cultivars saved`)
    } catch (e) {
      console.error('[bulk] failed:', e)
      setBulkState({ phase: 'error', msg: e?.message ?? 'Klaida bulk save metu' })
    }
  }

  // ── Text search — Phase 1 (preview) + Phase 2 (details) ────────
  const searchByText = async (q) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true); setResult(null); setError(null); setPreview(null)
    const totalStartedAt = Date.now()

    try {
      // ── Phase 0: Library-first short-circuit ──────────────────
      // Prieš leidžiant AI'ą (~60s + $) — patikrinam mūsų catalog'ą fuzzy
      // search'u. Jei žmonės jau yra ieškoję / admin'as bulk save'inęs šitą
      // augalą — gauname rezultatą per ~100ms be AI cost'o.
      // Library hit'ai konvertuojami į AI result shape'ą (catalogEntryToAIResult)
      // ir naudojami kaip kandidatai, kad UI'us veiktų identiškai kaip su AI.
      trackStep('Tikrinu mūsų bibliotekoje...')
      const ownedIds = new Set(plants.map(p => catalogDocId(p.lotyniskas)).filter(Boolean))
      // Limit 20 — kad serijos search'as (Boulevard, kuri turi 15 cultivars)
      // grąžintų visus narius vienu kartu. Autocomplete'as (line 1340 žemiau)
      // lieka su default'iniu 6 — kompaktiškas dropdown'as.
      const catalogHits = await searchCatalog(q.trim(), ownedIds, 20)
      if (controller.signal.aborted) return

      if (catalogHits.length > 0) {
        // Sujungiam catalog cultivars su jų taxonGroup'o care info — mūsų
        // normalizuotos DB struktūros sąjunga atgal į „pilną augalą". Cultivar
        // doc'as catalog'e turi tik unikalius field'us (image, distinguishing
        // feature, lotyniskas), o care info (sviesa, vanduo, laistymas,
        // tresimas, ziemojimas, prieziura) saugoma parent taxonGroup'e.
        //
        // Be šito merge'o, save'as į kolekciją save'intų augalus su `null`
        // care info, ir reikėtų papildomo AI Phase 2 call'o (~10s + cost).
        // Su merge'u — save'as instant'as ir 100% admin curated.
        const uniqueGroupIds = new Set(catalogHits.map(c => c.taxonGroupId).filter(Boolean))
        const groupMap = new Map()
        await Promise.all(Array.from(uniqueGroupIds).map(async gid => {
          const g = await getTaxonGroup(gid)
          if (g) groupMap.set(gid, g)
        }))
        if (controller.signal.aborted) return

        const merged = catalogHits.map(c => {
          const g = c.taxonGroupId ? groupMap.get(c.taxonGroupId) : null
          return g ? mergeWithSeries(c, g) : c
        })

        // FILTER incomplete entries — bibliotekoje yra istorinių SLIM
        // auto-save'ų be care info (Birkin/Kalatėja era). Jie neturi
        // laistymasIntervalas — reiškia nepilna info, todėl
        // „Iš mūsų patvirtintos bibliotekos" badge būtų melas.
        // Tokius entries praleidžiam į AI'us, kuris atsakys svarbiu.
        // Admin'as gali juos delete'inti per Library tab arba palikti
        // backfill'ui.
        //
        // EXCEPTION: nuo 2026-05-21 priimam ir 'preview' status'o įrašus
        // (pre-DB Phase 0.3 background upsert'ai). Jie irgi be care info,
        // BET turi verified Latin/family/toxicity/Wiki extract — verta
        // pakartotinai grąžinti antrojo userio paieškoms be Wiki re-fetch.
        const completeMerged = merged.filter(m =>
          m.laistymasIntervalas ||
          m.verificationStatus === 'preview'
        )

        if (completeMerged.length > 0) {
          // Catalog entry → candidate card shape (UI naudoja imageUrl / ltName).
          // Wikidata flag'ai propaguojami iš catalog'o (saugomi per bulk save'ą)
          // — kad library-first cultivar'ai gautų ✓ badge'us, ne tik AI-served.
          const candidates = completeMerged.map(c => ({
            ...catalogEntryToAIResult(c),
            imageUrl:         c.image ?? null,
            ltName:           c.lietuviškas ?? c.name ?? null,
            wikidataVerified: !!c.wikidataVerified,
            wikidataId:       c.wikidataId ?? null,
          }))
          // Single strong hit — set'inam kaip pagrindinį rezultatą.
          // Multiple — set'inam pirmąjį (best fuzzy score) + visus kaip candidates,
          // kad user'is galėtų pasirinkti kitą jei nepatinka.
          const primary = candidates[0]
          setResult({
            ...primary,
            candidates: candidates.length > 1 ? candidates : undefined,
            fromCatalog: true,
          })
          setLoading(false)
          trackStep(null)
          const skipped = merged.length - completeMerged.length
          console.log(`[search] ✓ TOTAL — ${((Date.now() - totalStartedAt) / 1000).toFixed(2)}s (library-first, ${completeMerged.length} match'as${completeMerged.length === 1 ? '' : 'ai'}, AI praleistas${skipped > 0 ? `; ${skipped} incomplete entries praleisti` : ''})`)
          return
        } else if (catalogHits.length > 0) {
          console.log(`[search] catalog rado ${catalogHits.length} entries, bet visi incomplete (be care info) — einam į AI`)
        }
      }

      // ── Phase 0.3: Pre-DB lookup + paralelinis Wiki/iNat/Wikidata fetch ──
      // Catalog'as nerado — bandom mūsų deterministic pre-DB lookup'ą (1655
      // genera) + paraleliai fetch'inam Wikipedia extract'ą, photo'ą ir
      // Wikidata "instance of" gate'ą. Vienas tinklo fetch'as dengia abu
      // path'us:
      //   • Pre-DB HIT  → naudojam Wiki/photo kaip preview augmentation
      //   • Pre-DB MISS → naudojam Wikidata gate'ą kaip safeguard nuo
      //                    "keptuvė"/"xyz123" tipo užklausų, BE AI laukimo
      //
      // Wiki+gate fetch'as ~500-800ms, daug pigiau už 18s AI Preview vien
      // dėl false-positive interpretacijos.
      trackStep('Tikrinu pre-DB...')
      const [stage1Result, preview] = await Promise.all([
        searchStage1(q.trim()),
        previewParallelFetch(q.trim(), {
          includeWikiEn: true,
          includeWikidataGate: true,  // visada — naudojam gate jei pre-DB miss
          includeBrave:  true,         // Step 6j — gardener-style hero photo
          debug: false,
        }),
      ])
      if (controller.signal.aborted) return

      if (stage1Result.found) {
        trackStep('Renkam nuotrauką ir aprašymą...')
        const baseResult = await buildPreDbBaseResult(stage1Result, preview, {
          userQuery: q.trim(),
        })
        setResult(baseResult)
        setLoading(false)
        trackStep(null)
        console.log(
          `[search] ✓ TOTAL — ${((Date.now() - totalStartedAt) / 1000).toFixed(2)}s ` +
          `(pre-DB hit, ${stage1Result.layer}/${stage1Result.confidence}, ` +
          `preview ${preview?.totalMs ?? 0}ms, AI praleistas)`
        )

        // Background upsert į catalog (fire-and-forget) — antras useris
        // to paties augalo gauna instant catalog hit'ą, be Wiki/iNat
        // fetch'o. Photo rehost'as paraleliai (Firebase Storage). Klaidos
        // tylios — vartotojo flow'as nesulūž jei catalog write fail'ina.
        catalogPreviewUpsert(baseResult, stage1Result).catch(e => {
          console.warn('[search] catalog preview upsert failed:', e?.message)
        })

        return
      }

      // ── Phase 0.4: Wikidata plant gate (pre-DB miss case) ────
      // Pre-DB nerado. Prieš leidžiant AI ($, 10-50s), patikrinam, ar šis
      // pavadinimas Wikipedijoj/Wikidatoje yra augalas. Block'ina:
      //   • "keptuvė" → Wiki LT yra (virtuvinis įrankis), P31=Q1198681 → BLOCK
      //   • "xyz123"  → Wikipedia neturi → null wikidataId → BLOCK
      //   • "Felis catus" → taxon, bet P31 ne plant hierarchy → BLOCK
      // Praleidžia:
      //   • Rare cultivar'ai — Wikipedia turi parent'ą, P31=Q16521 → PASS
      //   • Naujos rūšys, hybrids → Wikidata taxon → PASS
      if (!preview?.passesPlantGate) {
        const wdLabels = preview?.wikidataGate?.labels ?? {}
        const wdName = wdLabels.lt ?? wdLabels.en ?? null
        const wikidataFound = !!preview?.wikidataGate?.found
        const reason = !wikidataFound
          ? 'no-wiki-page'      // Wikipedia neturi tokio puslapio
          : 'not-a-plant'        // Wiki yra, BET P31 rodo, kad ne augalas

        // Skirtinga žinutė pagal block'avimo priežastį. Useris mato AIŠKIAI,
        // kodėl mes nepaleidžiame AI, ir gauna konkretų patarimą.
        const errorMessage = reason === 'no-wiki-page'
          ? `„${q.trim()}" — nerasta mūsų bibliotekoj nei Wikipedijoj. Patikrinkite pavadinimą.`
          : `„${q.trim()}"${wdName ? ` (${wdName})` : ''} Wikipedijoj nėra augalas. Pabandykite Latin ar LT augalo pavadinimą.`

        setError(errorMessage)
        setLoading(false)
        trackStep(null)
        console.log(
          `[search] ✗ TOTAL — ${((Date.now() - totalStartedAt) / 1000).toFixed(2)}s ` +
          `(Wikidata gate BLOCK, reason=${reason}${wdName ? `, wiki=${wdName}` : ''}, AI praleistas)`
        )
        return
      }

      // ── Phase 0.5: Query response cache ──────────────────────
      // Pre-DB nerado — patikrinam ar ankstesnis AI atsakymas tam
      // pačiam query yra cache'intas (48h TTL). Visi enrichment'ai (photos,
      // Wikidata verification) jau pritaikyti — instant replay.
      const cachedResponse = getCachedSearchResponse(q.trim())
      if (cachedResponse) {
        setResult(cachedResponse)
        setLoading(false)
        trackStep(null)
        console.log(`[search] ✓ TOTAL — ${((Date.now() - totalStartedAt) / 1000).toFixed(2)}s (response cache hit, AI praleistas)`)
        return
      }

      trackStep('AI ieško augalo...')

      // ── Phase 1: AI preview su web_search tool'u ───────────────
      // Web search'as įgalintas — Claude'as gali apsilankyti RHS, Wikipedia,
      // MissouriBotanical, kai užklausa neaiški (cultivar, hybrid, recent
      // introduction). max_uses=2 riboja latency + cost. tool_choice = auto
      // (Anthropic API leidžia web_search server-side tool'ą veikti šalia
      // forced tool'o; Claude'as gali iškviesti web_search prieš plant_preview).
      const r1 = await claudeCall({
        // SLIM preview'ui užtenka mažiau token'ų — nepildom rich field'ų.
        // 2500 = identification + iki 15 candidate'ų su distinguishingFeature
        // (Boulevard serija turi ~25 cultivars, 15 yra praktinis preview limit'as).
        maxTokens:   2500,
        temperature: 0.3,
        system:      PLANT_SYSTEM,
        tools: [
          TOOL_PREVIEW,
          // max_uses 2 → 1: identification'ui užtenka vieno verification trip'o.
          // Rich research'as eina į bulk_series flow'ą su max_uses=3.
          { type: 'web_search_20250305', name: 'web_search', max_uses: 1 },
        ],
        messages: [{
          role: 'user',
          content: `Identify the plant: "${q}".

SLIM MODE — disambiguation + minimal info, NOT a full user-facing preview.

ALL human-readable text (name, ltName, aprasymas, kilme, seriesNote, uncertaintyReason, candidate description / distinguishingFeature, fallbackInfo.note) MUST be in Lithuanian.

REQUIRED:
• latinName, ltName, candidates[] (if uncertain), confidence, sources

FILL (narrative — GENUS level, no care info):
• aprasymas: 3-5 Lithuanian sentences about the GENUS-level plant. E.g. for „Clematis 'Boulevard'" — about CLEMATIS as a plant (how it looks, where it grows natively, why it is popular), NOT about the 'Boulevard' series.
• kilme: 1 Lithuanian sentence about GENUS origin.
• seriesNote: 1-2 Lithuanian sentences about the specific series (Boulevard / Wave / Knock Out / etc.) IF latinName contains a series. null otherwise.
• fallbackInfo: fill ONLY when you stepped UP the taxonomy (see system prompt rules). null otherwise.
• cultivarsExist: true if you know named cultivars exist for the genus/species you returned, false if monotypic, null if unknown.

DO NOT FILL (too slow + saved later via other tools):
• Care info: sviesa, vanduo, substratas, persodinimas, žiemojimas, tręšimas, priežiūra — null/empty
• Savybes (toxicity, edibility, medicinal) — null
• augimo_greitis, tipas, sunkumas, lifecycle, hardiness — null

🛑 NO QUOTES = SERIES, NOT A SINGLE CULTIVAR
This is the core interpretation rule for the user query:
  • „Clematis 'Acropolis'"   → quotes → SPECIFIC CULTIVAR
  • „Clematis Boulevard"     → no quotes → SERIES (Boulevard is the series name)
  • „Rosa 'Radrazz'"          → quotes → SPECIFIC CULTIVAR
  • „Rosa Knock Out"          → no quotes → SERIES (even if „Knock Out" is also a trademark of an original cultivar — the user most likely wants the series)
  • „Hydrangea Endless Summer"→ no quotes → SERIES
  • „Petunia Wave"            → no quotes → SERIES

If the query is unquoted AND latinName matches a known series pattern → candidates[] MUST contain AT LEAST 4 members (up to 15 if you know more). UNACCEPTABLE:
  ❌ uncertaintyReason: „Knock Out yra serija su 13 cultivars" + candidates: []
  ❌ aprasymas: „Yra Pink Knock Out, Sunny Knock Out..." + candidates: []
  ❌ Identifying as a single „Rosa 'Radrazz'" when the query was „Rosa Knock Out" — not what the user wanted
  ✅ uncertaintyReason: „Knock Out yra serija, pasirink konkretų cultivar" + candidates: [Knock Out 'Radrazz', Pink Knock Out 'Radcon', Sunny Knock Out 'Radsunny', Double Knock Out 'Radtko', Rainbow Knock Out, Coral Knock Out, ...]

If you mention a cultivar name in ANY text field — it MUST be in candidates.
web_search is NOT required to confirm a series list — 4-15 popular members from training data are enough.

TAXONOMIC FALLBACK (see system prompt): if you cannot confidently identify the queried cultivar, step up ONE level (cultivar → species) and fill fallbackInfo. Do NOT silently substitute a wild species without recording the fallback.

Care + savybes are filled in a later step via other tools (TOOL_BULK_SERIES, TOOL_DETAILS).`,
        }],
      })
      if (controller.signal.aborted) return

      const previewBlock = r1.content.find(b => b.type === 'tool_use' && b.name === 'plant_preview')
      if (!previewBlock) { setError('Augalas nerastas'); setLoading(false); trackStep(null); return }

      const aiResult = previewBlock.input

      // ── Catalog-first override ──────────────────────────────────
      // Jei catalog'as turi expert-verified arba high-confidence entry'į
      // šitam latin name'ui — naudojam jį vietoj fresh AI rezultato.
      // Catalog yra source of truth verified info'ai. Skip'iname enrich
      // (iNat photo) — naudojam catalog saved photo.
      trackStep('Tikrinu mūsų bibliotekoje...')
      const cached = await getCatalogEntry(aiResult.latinName)
      // Jei catalog cultivar'as turi serija — merge'inam care info iš
      // parent taxonGroup'o (paritetas su Phase 0 library-first + photo
      // search post-AI).
      let mergedCached = cached
      if (cached?.taxonGroupId) {
        const group = await getTaxonGroup(cached.taxonGroupId)
        if (group) mergedCached = mergeWithSeries(cached, group)
      }
      const trustCatalog = mergedCached && (
        mergedCached.verificationStatus === 'expert-verified' ||
        mergedCached.aiConfidence === 'high'
      )

      if (trustCatalog) {
        setResult({ ...catalogEntryToAIResult(mergedCached), fromCatalog: true })
        setLoading(false)
        trackStep(null)
        console.log(`[search] ✓ TOTAL — ${((Date.now() - totalStartedAt) / 1000).toFixed(2)}s (from catalog${cached.taxonGroupId ? ', su taxonGroup merge' : ''})`)
        return
      }

      // ── Catalog miss arba unverified — naudojam AI + enrich ─────
      const hasCandidates = Array.isArray(aiResult.candidates) && aiResult.candidates.length > 0
      trackStep(
        hasCandidates
          ? `Renku nuotraukas (${aiResult.candidates.length} kandidatams)...`
          : 'Renku nuotrauką...'
      )
      // Paraleliai — enrich AI result (iNat photo, names) + enrich candidates (multi-source thumbnails)
      const [enriched, candidatesWithImages] = await Promise.all([
        enrich(aiResult),
        enrichCandidates(aiResult.candidates),
      ])
      enriched.candidates = candidatesWithImages
      if (controller.signal.aborted) return

      // Reliability cross-check — jei AI'us drąsiai sakė „high", bet Wikidata
      // neaptiko nei main result'o, nei nieko iš kandidatų, sąžiningai pažeminam
      // confidence į „medium" ir pridedam uncertaintyReason. Wikidata yra
      // structured human-curated source — jo absence reiškia: galimai reta
      // cultivar (dar nekatalog'inta) arba AI spėjimas, ne tikras augalas.
      // UI rodys confidence banner'į ir admin'as žinos, kad reikia žiūrėti
      // atidžiau prieš save'inant į biblioteką.
      // Defensive — enriched.candidates teoriškai jau masyvas (enrichCandidates
      // normalizuoja), bet papildomas Array.isArray guard'as apsaugo nuo
      // edge case'ų (pvz. catalog entry su corrupted candidates field'u).
      const candidatesList = Array.isArray(enriched.candidates) ? enriched.candidates : []
      const verifiedCount = (enriched.wikidataVerified ? 1 : 0) +
        candidatesList.filter(c => c.wikidataVerified).length
      if (aiResult.confidence === 'high' && verifiedCount === 0) {
        // Antras šansas prieš downgrade'ą: jei AI grąžino cultivar'ą
        // („Dionaea muscipula 'Justina Davis'"), patikrinam ar tėvinės
        // rūšies Wikipedia puslapyje tas cultivar'as paminėtas. Jei taip
        // — tai retas, bet TIKRAS cultivar'as (be atskiro Wikidata
        // entity'o), confidence lieka „high" su pastaba šaltinyje.
        // (2026-05-17 testavime „Justina Davis" iškrito į medium nors
        // Wikipedia cultivar list'e cituojamas.)
        const latinHasCultivar = /['"][^'"]+['"]/.test(enriched.latinName ?? '')
        let parentWikiOK = false
        if (latinHasCultivar) {
          parentWikiOK = await parentWikipediaMentionsCultivar(enriched.latinName)
        }

        if (parentWikiOK) {
          enriched.parentWikiVerified = true
          console.log('[search] ✓ Wikidata neverify\'no, bet parent species Wikipedia cituoja cultivar\'ą — confidence laikom high')
        } else {
          enriched.confidence = 'medium'
          const wdNote = '(Wikidata neaptiko šio cultivar entity\'o — galimai reta registracija arba AI spėjimas.)'
          enriched.uncertaintyReason = enriched.uncertaintyReason
            ? `${enriched.uncertaintyReason} ${wdNote}`
            : wdNote
          console.log('[search] ⚠ AI sakė high bet Wikidata neverify\'no — downgrade į medium')
        }
      }

      // NEBE'AUTO-SAVE į catalog'ą SLIM mode'e — anksciau pildavo incomplete
      // įrašus (be care info, be idomybės, kartais su AI hallucination'ais
      // kaip Cyrillic K Kalatėjoje). Bibliotekoje ai-tirti įrašai turėtų būt
      // tik tie, kuriuos vartotojas eksplicitiškai save'ino per SaveButton →
      // fetchDetails (Phase 2 su pilna info). Cross-user replay'us atlieka
      // response cache (per-device, 48h TTL) — žemiau setCachedSearchResponse.
      // (2026-05-17 lesson — žiūr. testavimo screenshot'us su Birkin/Kalatėja.)

      setResult(enriched)
      setLoading(false)
      trackStep(null)
      // Cache pilną enriched result'ą (su image'ais + Wikidata verification) —
      // kitą kartą šitą query'į gausim per 0ms be AI / web_search latency'o.
      setCachedSearchResponse(q.trim(), enriched, aiResult.confidence)
      console.log(`[search] ✓ TOTAL — ${((Date.now() - totalStartedAt) / 1000).toFixed(2)}s`)
    } catch (e) {
      if (e.name === 'AbortError' || controller.signal.aborted) return
      if (e.code === 'limit_reached') {
        setLoading(false); trackStep(null)
        setPaywallLimitType(e.limitType); setPaywallOpen(true)
        return
      }
      console.error('[SearchModal] error:', e)
      setError('Klaida ieškant augalo.')
      setLoading(false)
      trackStep(null)
    }
  }

  // ── Photo search — Phase 1 (preview) + Phase 2 (details) ───────
  const searchByPhoto = async (file) => {
    setLoading(true); setResult(null); setError(null); setQuery('')
    const totalStartedAt = Date.now()
    trackStep('Apdorojama nuotrauka...')
    try {
      const dataUrl = await resizeImage(file, 1200, 0.9)
      const base64  = dataUrl.split(',')[1]
      setPreview(dataUrl)
      trackStep('AI identifikuoja augalą...')

      const userMsg = {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
          { type: 'text',  text: 'Identify the plant in this photo (or on a label). SLIM mode: FILL latinName, ltName, candidates if uncertain, confidence, aprasymas (GENUS-level info — 3-5 Lithuanian sentences), kilme (1 Lithuanian sentence), seriesNote (1-2 Lithuanian sentences if a series). DO NOT FILL care info (sviesa/vanduo/etc), savybes, augimo_greitis — null/empty. All human-readable text MUST be in Lithuanian. TAXONOMIC FALLBACK: if the label shows a specific cultivar you cannot confirm, step up to the species and fill fallbackInfo (see system prompt). Set cultivarsExist=true when you fallback to a species/genus that you know has named cultivars.' },
        ],
      }

      // ── Phase 1: AI preview su web_search ──────────────────────
      // Photo search'ui irgi pridedam web_search — pvz. kai user'is įkelia
      // cultivar'o nuotrauką iš augalų pirkliautojo, AI gali patvirtinti
      // pavadinimą per RHS/Wikipedia.
      const r1 = await claudeCall({
        // SLIM mode — žiūr. searchByText komentarą prie TOOL_PREVIEW.
        maxTokens:   1500,
        temperature: 0.3,
        system:      PLANT_SYSTEM,
        tools: [
          TOOL_PREVIEW,
          { type: 'web_search_20250305', name: 'web_search', max_uses: 1 },
        ],
        messages:    [userMsg],
      })

      const previewBlock = r1.content.find(b => b.type === 'tool_use' && b.name === 'plant_preview')
      if (!previewBlock) { setError('Nepavyko identifikuoti augalo.'); setLoading(false); trackStep(null); return }

      const aiResult = previewBlock.input

      // Catalog-first override + taxonGroup merge — paritetiškai su text search
      // library-first short-circuit ir handleCatalogAdd path'ais. Anksciau
      // photo post-AI grąžindavo catalog entry as-is, prarandamos care info
      // iš parent taxonGroup'o (mergeWithSeries praleisdavo).
      trackStep('Tikrinu mūsų bibliotekoje...')
      const cached = await getCatalogEntry(aiResult.latinName)
      let mergedCached = cached
      if (cached?.taxonGroupId) {
        const group = await getTaxonGroup(cached.taxonGroupId)
        if (group) mergedCached = mergeWithSeries(cached, group)
      }
      const trustCatalog = mergedCached && (
        mergedCached.verificationStatus === 'expert-verified' ||
        mergedCached.aiConfidence === 'high'
      )

      if (trustCatalog) {
        setResult({ ...catalogEntryToAIResult(mergedCached), fromCatalog: true })
        setLoading(false)
        trackStep(null)
        console.log(`[search] ✓ TOTAL — ${((Date.now() - totalStartedAt) / 1000).toFixed(2)}s (from catalog${cached.taxonGroupId ? ', su taxonGroup merge' : ''})`)
        return
      }

      const hasCandidates = Array.isArray(aiResult.candidates) && aiResult.candidates.length > 0
      trackStep(
        hasCandidates
          ? `Renku nuotraukas (${aiResult.candidates.length} kandidatams)...`
          : 'Renku nuotrauką...'
      )
      const [enriched, candidatesWithImages] = await Promise.all([
        enrich(aiResult),
        enrichCandidates(aiResult.candidates),
      ])
      enriched.candidates = candidatesWithImages
      // NEBE'AUTO-SAVE į catalog'ą iš photo search'o — žiūr. text search
      // paaiškinimą aukščiau. SaveButton + fetchDetails atliks pilną save'ą
      // į catalog su Phase 2 care info, jei vartotojas užklausa.
      setResult(enriched)
      setLoading(false)
      trackStep(null)
      console.log(`[search] ✓ TOTAL — ${((Date.now() - totalStartedAt) / 1000).toFixed(2)}s`)
    } catch (e) {
      if (e.code === 'limit_reached') {
        setLoading(false); trackStep(null)
        setPaywallLimitType(e.limitType); setPaywallOpen(true)
        return
      }
      console.error('[SearchModal photo] error:', e)
      setError('Nepavyko identifikuoti augalo. Bandykite aiškesnę nuotrauką.')
      setLoading(false)
      trackStep(null)
    }
  }

  const clear = () => {
    abortRef.current?.abort()
    setQuery(''); setResult(null); setError(null); setLoading(false); setPreview(null)
    inputRef.current?.focus()
  }

  // ── Duplicate detection ──────────────────────────────────────
  const norm = s => s?.trim().toLowerCase() ?? ''
  const duplicate = result
    ? plants.find(p => norm(p.lotyniskas) === norm(result.latinName))
    : null

  // Local search: kol nėra AI result + nėra loading'o, filtruojam esamus
  // augalus (kad vartotojas pirma rastų savus, o AI lookup'ą darytume tik jei
  // tikrai naujo augalo ieško). Match'as per fuzzy search'ą — handle'ina LT
  // diacritic'us („raktazole" → „Raktažolė") + typo'us (1-3 char edit
  // distance pagal žodžio ilgį).
  const localMatches = (() => {
    const q = query.trim()
    if (!q || result || loading) return []
    return plants
      .map(p => ({ plant: p, score: plantFuzzyScore(p, q) }))
      .filter(x => x.score !== Infinity)
      .sort((a, b) => a.score - b.score)
      .slice(0, 8)
      .map(x => x.plant)
  })()

  // ── Catalog (bendros bibliotekos) search — vartotojas → global → AI ────
  // Debounced 200ms. Filtruoja iš rezultatų augalus, kuriuos vartotojas
  // jau turi savo kolekcijoje (per catalogDocId match'ą).
  const [catalogMatches, setCatalogMatches] = useState([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  useEffect(() => {
    const q = query.trim()
    if (!q || q.length < 2 || result || loading) {
      setCatalogMatches([])
      return
    }
    let cancelled = false
    setCatalogLoading(true)
    const debounce = setTimeout(async () => {
      const ownedIds = new Set(plants.map(p => catalogDocId(p.lotyniskas)).filter(Boolean))
      // 20 — kad serijos search'as (Boulevard turi 20 cultivars'ų) parodytų
      // visus narius. Dropdown'as turi max-height + scroll, kad neuztemptų
      // viso ekrano.
      const matches = await searchCatalog(q, ownedIds, 20)
      if (cancelled) return

      // FILTER incomplete entries (orphan SLIM stub'ai be care info).
      // Merge'inam su taxonGroup pirmiau, kad cultivar entries paveldintys
      // care iš parent'o praeitų filter'į. Tas pats logikos blokas kaip
      // library-first short-circuit'e — kad consistency išliktų autocomplete
      // + search button rezultatuose.
      const uniqueGroupIds = new Set(matches.map(m => m.taxonGroupId).filter(Boolean))
      const groupMap = new Map()
      await Promise.all(Array.from(uniqueGroupIds).map(async gid => {
        const g = await getTaxonGroup(gid)
        if (g) groupMap.set(gid, g)
      }))
      if (cancelled) return

      const completeMatches = matches.filter(m => {
        // Tiesiogiai turi care info — pre-refactor flat save'ai arba
        // post-d976ff3 Phase 2 saves.
        if (m.laistymasIntervalas) return true
        // Cultivar paveldi care iš parent group'o per mergeWithSeries.
        // Tikrinam parent group EGZISTUOJA ir turi laistymasIntervalas.
        if (m.taxonGroupId) {
          const group = groupMap.get(m.taxonGroupId)
          return !!group?.careInfo?.laistymasIntervalas
        }
        // Standalone be care + be parent'o → orphan stub'as, hide'inam.
        return false
      })

      if (!cancelled) {
        setCatalogMatches(completeMatches)
        setCatalogLoading(false)
      }
    }, 200)
    return () => { cancelled = true; clearTimeout(debounce) }
  }, [query, result, loading, plants])

  // Catalog add — naudoja onAddToWishlist (kaip ir AI result), tik prieš tai
  // catalog entry sujungiamas su taxonGroup'o care info (kaip ir library-first
  // short-circuit'as Phase 0 searchByText'e). Be šito merge'o, „+ Pridėti"
  // iš autocomplete dropdown'o save'intų tik cultivar-specific info (image,
  // distinguishingFeature) ir paliktų plant'ą be care info, nes mūsų DB
  // struktūra normalize'inta — care info gyvena parent taxonGroup'e.
  const handleCatalogAdd = async (entry) => {
    setSavingPhase2(true)
    try {
      let enriched = entry
      if (entry.taxonGroupId) {
        const group = await getTaxonGroup(entry.taxonGroupId)
        if (group) enriched = mergeWithSeries(entry, group)
      }
      const aiShape = catalogEntryToAIResult(enriched)
      await onAddToWishlist(aiShape)
    } finally {
      setSavingPhase2(false)
      onClose?.()
    }
  }

  const tree = (
    <div className={useDesktopPanel
      ? "absolute inset-0 overflow-hidden flex justify-center"
      : "fixed inset-0 z-50 overflow-hidden flex justify-center"}>
    <motion.div
      className={useDesktopPanel ? "w-full h-full max-w-full flex flex-col bg-app" : "w-full max-w-[430px] h-full flex flex-col bg-app"}
      /* iOS native pattern'as: mobile'e slide-from-bottom (y), desktop'e
         slide-from-right (x). Slide-from-right ant iOS PWA su autoFocus'inančiu
         input'u sukurdavo coordinate shift mid-animation (keyboard kyla
         tuo pat metu kai sheet slenka horizontaliai → visual „overshoot").
         Vertical slide su iOS keyboard'u eilinis pattern'as. */
      {...(useDesktopPanel ? {
        initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' },
      } : {
        initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' },
      })}
      transition={{ type: 'spring', damping: 32, stiffness: 320 }}
      style={{ touchAction: 'pan-y' }}
    >
      {/* Header — X close top-right */}
      <div className="safe-top" />
      <div className="flex items-center gap-3 px-4 py-3 border-b border-bone-400/40">
        <h2 className="font-display text-base font-semibold tracking-tight text-forest-800 flex-1">Rasti augalą</h2>
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-btn bg-bone-300/60 hover:bg-bone-400/60 text-forest-700 transition-colors"
          aria-label="Uždaryti"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none px-4 py-5 space-y-5">
        {/* Search input + photo button */}
        <div className="flex gap-2">
          <div className="flex-1 flex items-center bg-bone-50 border border-bone-400/40 rounded-2xl px-4 gap-2 focus-within:border-forest-400/60 transition-colors">
            <Search size={18} className="text-forest-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              inputMode="search"
              enterKeyHint="search"
              placeholder="Pvz. Monstera, Ficus, Alavijas..."
              value={query}
              onChange={e => { setPreview(null); setQuery(e.target.value); setResult(null); setError(null) }}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent py-3.5 text-sm text-forest-800 placeholder-forest-400 outline-none"
              autoComplete="nope"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              /* autoFocus pašalintas — programatiškai focus'inam per useEffect
                 PO sheet'o animacijos pabaigos (delay'as 320ms = spring
                 settling). Anksčiau iOS PWA'e keyboard slide'as kildavo tuo
                 pat metu kaip sheet slide'as → modal overshoot į kairę. */
            />
            {(query || previewUrl) && (
              <button onClick={clear} className="text-forest-400 px-1 flex-shrink-0"><X size={14} /></button>
            )}
          </div>
          <button
            onClick={() => { if (query.trim() && !loading) searchByText(query.trim()) }}
            disabled={!query.trim() || loading}
            className="flex-shrink-0 bg-forest-700 disabled:opacity-40 hover:bg-forest-800 transition-colors rounded-2xl flex items-center justify-center text-bone"
            style={{ width: 52, height: 52 }}
          >
            {loading
              ? <BrandLoader inline size={28} />
              : <Search size={18} />
            }
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex-shrink-0 bg-bone-50 border border-bone-400/40 hover:bg-bone-300/40 transition-colors rounded-2xl flex items-center justify-center text-forest-600"
            style={{ width: 52, height: 52 }}
          >
            <Camera size={22} />
          </button>
          <input
            ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => { const f = e.target.files[0]; if (f) { searchByPhoto(f); e.target.value = '' } }}
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            {previewUrl
              ? <img src={previewUrl} alt="" className="w-28 h-28 object-cover rounded-2xl opacity-70" />
              : <BrandLoader />
            }
            <p className="text-sm text-forest-600 font-medium">{statusMsg}{dots}</p>
            {!previewUrl && <p className="text-xs text-forest-400 italic">{query}</p>}
          </div>
        )}

        {/* Error — terracotta callout */}
        {error && !loading && (
          <div className="bg-terracotta-50 border border-terracotta-200/60 rounded-2xl p-5 text-center">
            <div className="flex justify-center mb-2 text-terracotta-400"><Search size={32} /></div>
            <p className="text-sm text-terracotta-600 font-semibold">{error}</p>
            <p className="text-xs text-terracotta-500 mt-1">Bandykite kitą pavadinimą arba aiškesnę nuotrauką</p>
          </div>
        )}

        {/* Result */}
        {result && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {/* From catalog — žalia juostelė kai duomenys iš mūsų verified
                biblioteckos (jokio AI hallucinacijos rizikos). */}
            {result.fromCatalog && (
              <div className="rounded-2xl px-4 py-2 mb-3 border bg-forest-50 border-forest-300/60 flex items-center gap-2">
                <span className="text-forest-500">✓</span>
                <p className="text-[12px] font-semibold text-forest-700">
                  Iš mūsų patvirtintos bibliotekos
                </p>
                {result.aiVerifiedAt && (
                  <span className="ml-auto font-mono text-[10px] text-forest-500">
                    {new Date(result.aiVerifiedAt).toLocaleDateString('lt-LT')}
                  </span>
                )}
              </div>
            )}

            {/* Sources chip — kai AI naudojo web_search ir surašė šaltinius.
                Transparency vartotojui — kur info patikrinta. */}
            {Array.isArray(result.sources) && result.sources.length > 0 && (
              <div className="rounded-2xl px-4 py-2 mb-3 border bg-bone-50 border-bone-400/40">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-forest-500 mb-1">Šaltiniai</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.sources.slice(0, 4).map((s, i) => {
                    let label = s
                    try { label = new URL(s).hostname.replace(/^www\./, '') } catch {}
                    return (
                      <a key={i} href={s} target="_blank" rel="noreferrer"
                         className="inline-flex items-center text-[11px] text-forest-600 bg-bone-100 border border-bone-400/40 rounded-full px-2 py-0.5 hover:bg-bone-200 transition-colors">
                        {label}
                      </a>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Taxonomic fallback banner — rodom kai AI grąžino aukštesnį
                lygį nei vartotojas paklausė (cultivar→species). Atskirai
                nuo confidence banner'io, nes čia ne „nesu tikras" o
                „eksplicitiškai pakeičiau lygį, štai kodėl ir kas tau".
                Konkretesnis nei confidence banner — visada turi note. */}
            {result.fallbackInfo && !result.fromCatalog && (
              <div className="rounded-2xl px-4 py-3 mb-3 border bg-amber-50 border-amber-300/60">
                <div className="flex items-start gap-2.5">
                  <span className="text-base flex-shrink-0 mt-0.5 text-amber-600">↑</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-amber-700">
                      Pakeičiau lygį
                      <span className="ml-1.5 font-mono text-[10px] uppercase tracking-[0.14em] opacity-70">
                        {result.fallbackInfo.from} → {result.fallbackInfo.to}
                      </span>
                    </p>
                    <p className="text-xs leading-relaxed mt-1 text-amber-700/90">
                      {result.fallbackInfo.note}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Confidence banner — rodom kai AI confidence != 'high'. Augalo
                priežiūros info gali būti netiksli; matchLevel padeda suprasti
                ar tai tik genties lygis, ar visiškai nežinia. */}
            {result.confidence && result.confidence !== 'high' && !result.fromCatalog && (
              <div className={`rounded-2xl px-4 py-3 mb-3 border ${
                result.confidence === 'low'
                  ? 'bg-terracotta-50 border-terracotta-300/60'
                  : 'bg-bone-100 border-bone-400/60'
              }`}>
                <div className="flex items-start gap-2.5">
                  <span className={`text-base flex-shrink-0 mt-0.5 ${
                    result.confidence === 'low' ? 'text-terracotta' : 'text-forest-500'
                  }`}>
                    {result.confidence === 'low' ? '⚠' : 'ℹ'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-semibold ${
                      result.confidence === 'low' ? 'text-terracotta-600' : 'text-forest-700'
                    }`}>
                      {result.confidence === 'low'
                        ? 'AI nepatvirtina šio augalo'
                        : 'Apytikrė informacija'}
                      {result.matchLevel && result.matchLevel !== 'cultivar' && (
                        <span className="ml-1.5 font-mono text-[10px] uppercase tracking-[0.14em] opacity-70">
                          {result.matchLevel === 'genus' ? 'genties lygis'
                            : result.matchLevel === 'species' ? 'rūšies lygis'
                            : 'neaiškus'}
                        </span>
                      )}
                    </p>
                    {result.uncertaintyReason && (
                      <p className={`text-xs leading-relaxed mt-1 ${
                        result.confidence === 'low' ? 'text-terracotta-600/90' : 'text-forest-600'
                      }`}>
                        {result.uncertaintyReason}
                      </p>
                    )}
                    {/* Static disclaimer rodom TIK kai info kokybė tikrai
                        abejotina: low confidence, unknown match level, ar
                        mažai šaltinių. Genus-level identifikacija su 2+ web
                        sources — info patikima struktūra net jei reikia
                        pasirinkti konkrečią rūšį. (žiūr. 2026-05 UX feedback) */}
                    {(result.confidence === 'low' ||
                      result.matchLevel === 'unknown' ||
                      (result.sources?.length ?? 0) < 2) && (
                      <p className="text-[11px] text-forest-500 mt-1.5 italic">
                        Priežiūros info gali būti netiksli — saugok kaip „nepatvirtinta" ir patikrink rankiniu būdu.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Serijos pastaba — kompaktiška info apie KONKREČIĄ seriją
                (Boulevard, Wave, Knock Out) virš kandidatų sąrašo. Genus info
                lieka ProfileContent'e žemiau. AI grąžina seriesNote per
                TOOL_PREVIEW kai latinName turi serijos identifikaciją. */}
            {result.seriesNote && (
              <div className="mb-3 bg-forest-50/50 border border-forest-200/50 rounded-2xl px-4 py-3">
                <p className="font-mono text-[10px] font-medium text-forest-600 uppercase tracking-[0.16em] mb-1.5">
                  Apie šią seriją
                </p>
                <p className="text-[13px] text-forest-700 leading-relaxed">
                  {result.seriesNote}
                </p>
              </div>
            )}

            {/* Kandidatai — pasirinkimo kortelės kai AI nepavyko 100%
                identifikuoti, bet turi 2-5 plausibly atitinkančius cultivars.
                User'is paspausta vieną → nauja paieška su tikslesniu pavadinimu
                → high confidence + saved į catalog. */}
            {Array.isArray(result.candidates) && result.candidates.length > 0 && !result.fromCatalog && (
              <div className="mb-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-forest-500 mb-2 px-1">
                  Galimi atitikmenys — pasirink savo augalą
                </p>

                {/* Admin bulk save — vienas AI call'as save'ina VISĄ seriją
                    (taxonGroup + cultivars + photos) į catalog'ą. Pigesnis nei
                    po vieną. Tinka admin/manager flow'ui — user'iui slėpti
                    vėliau (žiūr. backlog). */}
                <button
                  onClick={() => bulkSaveSeries(query.trim() || result.latinName, result.candidates)}
                  disabled={!!bulkState && bulkState.phase !== 'done' && bulkState.phase !== 'error'}
                  className="w-full mb-2 bg-forest-700 hover:bg-forest-800 disabled:opacity-40 text-bone-50 rounded-2xl px-4 py-2.5 text-[13px] font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  💾 Pridėti visą seriją į biblioteką
                  <span className="font-mono text-[10px] opacity-70">(iki {MAX_BULK_BATCH} cultivars · ~$0.10)</span>
                </button>
                <div className="space-y-1.5">
                  {result.candidates.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setQuery(c.latinName)
                        searchByText(c.latinName)
                      }}
                      className="w-full text-left bg-bone-50 border border-bone-400/40 rounded-2xl p-3 hover:bg-bone-100 hover:border-forest-300/60 active:scale-[0.98] transition-all"
                    >
                      <div className="flex items-center gap-3">
                        {/* Thumbnail — photo iš multi-source chain, fallback emoji */}
                        <div className="w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden bg-bone-200 border border-bone-400/40">
                          {c.imageUrl ? (
                            <img
                              src={c.imageUrl}
                              alt={c.ltName || c.latinName}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.currentTarget.style.display = 'none' }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-3xl">
                              🌿
                            </div>
                          )}
                        </div>
                        {/* Minimalistinis tekstas — TIK pavadinimas + vizualus
                            aprašymas. Disambiguation stadijoje user'iui
                            nereikia istorinės info, serijos paaiškinimo, ar
                            kilmės — tik kaip atskirti vizualiai. */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-forest-800 text-[15px] leading-tight flex items-center gap-1.5">
                            <span className="truncate">{c.ltName || c.latinName.replace(/^[A-Z][a-z]+\s+['"]/, '').replace(/['"]$/, '')}</span>
                            {/* Wikidata verification badge — ✓ ikonėlė reiškia,
                                kad cultivar yra Wikidata entity'je (human-curated
                                structured data). Stiprus signal'as, kad AI
                                nehallucinuoja — toks cultivar realiai egzistuoja. */}
                            {c.wikidataVerified && (
                              <CheckCircle2
                                size={13}
                                className="text-forest-600 flex-shrink-0"
                                title="Patvirtinta per Wikidata"
                                aria-label="Patvirtinta per Wikidata"
                              />
                            )}
                          </p>
                          <p className="font-mono italic text-[11px] text-forest-500 mt-0.5 truncate">
                            {c.latinName}
                          </p>
                          {c.distinguishingFeature && (
                            <p className="text-[12px] text-forest-700 mt-1.5 leading-snug">
                              {c.distinguishingFeature}
                            </p>
                          )}
                        </div>
                        <span className="text-forest-400 text-lg flex-shrink-0">›</span>
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-forest-400 italic mt-2 px-1">
                  Arba apačioj pridėk su bendra (nepatvirtinta) info.
                </p>
              </div>
            )}

            {/* Hero gallery — mobile bleeds (-mx-4) iki ekrano krašto; desktop'e
                lieka rounded card su parent padding'u (kad neišlystų už panel'ės).
                Slepiam jei result yra serijos disambiguation (>=2 candidates) —
                šitam atveju series-level „hero" nuotrauka tikriausiai bus ar
                klaidinga (Brave nelabai randa konkretų image'ą serijos
                užklausai, gali grąžinti random plant'ą), ar mažai informatyvi
                (vieno cultivar'o nuotrauka neatstovauja visos serijos).
                Vartotojas mato candidates su jų individualiomis nuotraukomis. */}
            {/* Hide hero photo kai AI nepatvirtino augalo (low confidence ar
                unknown match level). Anksčiau Brave/AI grąžindavo random foto
                kaip „Nežinomas augalas" hero — sci-fi monstrą Xenomorphica
                paieškoje, etc. Tas siunčia klaidingą signal'ą vartotojui,
                kad augalas tikrai egzistuoja. (2026-05-21 testavimo fix.) */}
            {result.image &&
             !(Array.isArray(result.candidates) && result.candidates.length >= 2) &&
             !(result.confidence === 'low' || result.matchLevel === 'unknown') ? (
              <div className={`rounded-3xl overflow-hidden h-56 relative mb-0 ${useDesktopPanel ? '' : '-mx-4'}`}>
                {/* Cross-fade image swap */}
                <AnimatePresence mode="sync" initial={false}>
                  <motion.img
                    key={result.photos?.[photoIdx] ?? result.image}
                    src={result.photos?.[photoIdx] ?? result.image}
                    alt={result.name}
                    className="absolute inset-0 w-full h-full object-cover"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.28 }}
                  />
                </AnimatePresence>
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent pointer-events-none" />

                {/* Prev / Next arrows */}
                {(result.photos?.length ?? 0) > 1 && (
                  <>
                    <button
                      onClick={() => setPhotoIdx(i => Math.max(0, i - 1))}
                      disabled={photoIdx === 0}
                      className="absolute left-3 top-1/2 -translate-y-[calc(50%+1.5rem)] w-8 h-8 bg-black/35 backdrop-blur-sm rounded-btn flex items-center justify-center text-white disabled:opacity-20 transition-opacity active:scale-90"
                    >
                      <ChevronLeft size={16} strokeWidth={2.5} />
                    </button>
                    <button
                      onClick={() => setPhotoIdx(i => Math.min((result.photos?.length ?? 1) - 1, i + 1))}
                      disabled={photoIdx >= (result.photos?.length ?? 1) - 1}
                      className="absolute right-3 top-1/2 -translate-y-[calc(50%+1.5rem)] w-8 h-8 bg-black/35 backdrop-blur-sm rounded-btn flex items-center justify-center text-white disabled:opacity-20 transition-opacity active:scale-90"
                    >
                      <ChevronRight size={16} strokeWidth={2.5} />
                    </button>
                    <div className="absolute top-3 right-3 bg-black/35 backdrop-blur-sm rounded-full px-2 py-0.5">
                      <span className="text-[11px] text-white/90 font-medium">{photoIdx + 1} / {result.photos.length}</span>
                    </div>
                  </>
                )}

                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h3 className="font-display text-xl font-semibold tracking-tight text-bone leading-tight">{result.name}</h3>
                  <p className="text-sm text-bone/70 italic mt-1">{result.latinName}</p>
                  {/* 2026-05-25 — taxonomy migration note. Rodom kitą side
                      (jei latinName yra obsolete → modern; jei canonical → anksčiau). */}
                  {result.reclassification && (
                    <p className="text-[10px] text-bone/50 mt-0.5 font-mono uppercase tracking-[0.12em]">
                      {result.latinName === result.reclassification.obsolete
                        ? `modern: ${result.reclassification.canonical}`
                        : `anksčiau: ${result.reclassification.obsolete}`}
                    </p>
                  )}
                  {(result.inatLtName || result.sinonimai?.length > 0 || result.englishNames?.length > 0) && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {result.inatLtName && (
                        <span className="font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-bone/85 bg-white/10 backdrop-blur-sm border border-white/15 rounded px-1.5 py-0.5">{result.inatLtName}</span>
                      )}
                      {result.sinonimai?.filter(s => s !== result.inatLtName).map((s, i) => (
                        <span key={i} className="font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-bone/85 bg-white/10 backdrop-blur-sm border border-white/15 rounded px-1.5 py-0.5">{s}</span>
                      ))}
                      {result.englishNames?.map((n, i) => (
                        <span key={i} className="font-mono text-[9px] uppercase tracking-[0.14em] text-bone/60 bg-white/5 border border-white/10 rounded px-1.5 py-0.5">{n}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-bone-50 border border-bone-400/40 rounded-3xl p-4 flex items-center gap-4 mb-0">
                <div className="w-16 h-16 rounded-2xl bg-bone-300 flex items-center justify-center text-4xl flex-shrink-0">
                  {result.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-lg font-semibold tracking-tight text-forest-800 leading-tight">{result.name}</h3>
                  <p className="text-sm text-forest-500 italic mt-1">{result.latinName}</p>
                  {result.reclassification && (
                    <p className="text-[10px] text-forest-500/70 mt-0.5 font-mono uppercase tracking-[0.12em]">
                      {result.latinName === result.reclassification.obsolete
                        ? `modern: ${result.reclassification.canonical}`
                        : `anksčiau: ${result.reclassification.obsolete}`}
                    </p>
                  )}
                  {(result.inatLtName || result.sinonimai?.length > 0) && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {result.inatLtName && <span className="font-mono text-[9px] font-medium uppercase tracking-[0.14em] text-forest-600 bg-forest-100 rounded px-1.5 py-0.5">{result.inatLtName}</span>}
                      {result.sinonimai?.filter(s => s !== result.inatLtName).map((s, i) => (
                        <span key={i} className="font-mono text-[9px] uppercase tracking-[0.14em] text-forest-600 bg-bone-50 border border-bone-400/40 rounded px-1.5 py-0.5">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SLIM Phase 1 preview — rodom TIK tai, kas TIKRAI lietuviškai
                ir patikimai. Aprasymas (gali būti EN), care icons (Phase 2
                ne'pildyta), idomybes (Phase 2 ne'pildyta) — VISKAS ATIDĖTA
                Phase 2 enrichment'ui, kuris pradedamas paspaudus „Pirkau"
                arba „Į biblioteką".
                Slim AI mode'as (serijos disambiguation) — irgi grąžina
                tik latinName + candidates, šis blokas vis tiek netrukdys
                (savybes tuščia → nieks nerodysim). */}
            <Phase1SlimPreview result={result} isDuplicate={!!duplicate} />

            {/* Actions — perduodam result'ą su CURRENTLY VISIBLE photo
                (atsižvelgiama į photoIdx iš hero gallery cycling'o), kad
                vartotojas išsaugotų būtent tą nuotrauką, kurią mato dabar.
                Anksciau visada save'indavom photos[0], net jei vartotojas
                paspaudęs › buvo perėjęs į kitą nuotrauką. */}
            {(() => {
              const currentImage = result.photos?.[photoIdx] ?? result.image
              const resultForSave = currentImage !== result.image
                ? { ...result, image: currentImage }
                : result
              return (
                <div className="space-y-3 pt-1 pb-4">
                  {duplicate ? (
                    <DuplicateBanner
                      duplicate={duplicate}
                      result={resultForSave}
                      onAddToDashboard={onAddToDashboard}
                      onViewPlant={onViewPlant}
                      onPromote={onPromote}
                      onUpdatePlant={onUpdatePlant}
                      onClose={onClose}
                      onSavingChange={setSavingPhase2}
                    />
                  ) : (
                    <>
                      {/* Primary action — solid INK button per brandbook auth pattern */}
                      <SaveButton
                        label="Pirkau, turiu!"
                        result={resultForSave}
                        kategorija="auginama"
                        className="w-full h-12 rounded-btn font-display text-sm font-semibold text-bone bg-forest-700 hover:bg-forest-800 disabled:opacity-60 transition-colors"
                        onSave={onAddToDashboard}
                        onClose={onClose}
                        onSavingChange={setSavingPhase2}
                      />
                      {/* Secondary — bone-50 outline (mažesnis vizualinis svoris) */}
                      <SaveButton
                        label="Pridėti į biblioteką"
                        result={resultForSave}
                        kategorija="nori"
                        className="w-full h-12 rounded-btn font-display text-sm font-semibold text-forest-700 bg-bone-50 border border-bone-400/50 hover:bg-bone-300/40 disabled:opacity-60 transition-colors"
                        onSave={onAddToWishlist}
                        onClose={onClose}
                        onSavingChange={setSavingPhase2}
                      />
                    </>
                  )}
                </div>
              )
            })()}
          </motion.div>
        )}

        {/* Local matches — rodom kol nėra AI lookup'o (vartotojas turi galimybę
            pirma rasti savus augalus, prieš einant ieškoti naujų internete). */}
        {!result && !loading && !error && query.trim() && localMatches.length > 0 && (
          <div className="space-y-2">
            <p className="font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.18em] px-1">
              Tavo augalai ({localMatches.length})
            </p>
            <div className="space-y-1.5">
              {localMatches.map(p => (
                <button
                  key={p.id}
                  onClick={() => onViewPlant?.(p)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 bg-bone-50 border border-bone-400/40 rounded-2xl text-left hover:bg-bone-300/40 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-bone-300">
                    {p.image ? (
                      <PlantImage url={p.image} alt="" size="thumb" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl">{p.emoji ?? '🌿'}</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-sm font-semibold tracking-tight text-forest-800 truncate">{p.lietuviškas}</p>
                    <p className="text-xs text-forest-500 italic truncate">{p.lotyniskas}</p>
                  </div>
                  <span className={`font-mono text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                    p.kategorija === 'auginama' ? 'bg-forest-100 text-forest-700' :
                    p.kategorija === 'nori' ? 'bg-terracotta-100 text-terracotta-600' :
                    'bg-bone-300 text-forest-500'
                  }`}>
                    {p.kategorija === 'auginama' ? 'Auginu' : p.kategorija === 'nori' ? 'Noriu' : 'Istorija'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Catalog matches — bendros bibliotekos kandidatai (rodom po lokalių,
            prieš AI button'ą). Vartotojas → global → AI hierarchija. */}
        {!result && !loading && !error && query.trim() && catalogMatches.length > 0 && (
          <div className="space-y-2">
            <p className="font-mono text-[10px] font-medium text-terracotta-600 uppercase tracking-[0.18em] px-1">
              Iš bendros bibliotekos ({catalogMatches.length})
            </p>
            <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
              {catalogMatches.map(entry => (
                <div
                  key={entry._id}
                  className="w-full flex items-center gap-3 px-3 py-2.5 bg-bone-50 border border-bone-400/40 rounded-2xl"
                >
                  <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-bone-300">
                    {entry.image ? (
                      <PlantImage url={entry.image} alt="" size="thumb" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl">{entry.emoji ?? '🌿'}</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-sm font-semibold tracking-tight text-forest-800 truncate">{entry.lietuviškas}</p>
                    <p className="text-xs text-forest-500 italic truncate">{entry.lotyniskas}</p>
                  </div>
                  <button
                    onClick={() => handleCatalogAdd(entry)}
                    className="flex-shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-btn-sm bg-forest-700 hover:bg-forest-800 text-bone text-xs font-display font-semibold transition-colors"
                    title="Pridėti į biblioteką"
                  >
                    + Pridėti
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI lookup CTA — UNIFIKUOTAS mygtukas visiems atvejams (su match'ais
            ar be jų). Anksčiau buvo du skirtingi stiliai + label'iai —
            dashed „Ieškoti naujų augalų: „query"" kai yra match'ai vs.
            solid „Ieškoti internete" kai nieko nėra. Dabar vienas
            patternas: ✦ Ieškoti su AI, solid bg-forest-700 full-width
            (matches ✦ Atnaujinti per AI iš PlantDetail). */}
        {!result && !loading && !error && query.trim() && (
          (localMatches.length > 0 || catalogMatches.length > 0) ? (
            <button
              onClick={() => { if (query.trim() && !loading) searchByText(query.trim()) }}
              className="w-full py-3 rounded-btn font-display text-sm font-semibold text-bone bg-forest-700 hover:bg-forest-800 transition-colors"
            >
              ✦ Ieškoti su AI
            </button>
          ) : (
            /* No local + no catalog matches — full empty state'as su
               hero icon'u + tuo pačiu unified AI CTA. */
            !catalogLoading && (
              <div className="text-center py-8 space-y-4">
                {/* Gardener tilt — „mąstau, ar atrasiu" empathetic momentas
                    prieš AI fallback'ą. Wilt'as būtų per dramatiškas
                    paprastam „neradome" momentui. */}
                <Mascot type="gardener" state="tilt" size={96} className="text-forest-700 mx-auto opacity-90" />
                <p className="text-sm text-forest-500">„{query}" — neradome nei tavo, nei bendroje bibliotekoje</p>
                <button
                  onClick={() => { if (query.trim() && !loading) searchByText(query.trim()) }}
                  className="w-full py-3 rounded-btn font-display text-sm font-semibold text-bone bg-forest-700 hover:bg-forest-800 transition-colors"
                >
                  ✦ Ieškoti su AI
                </button>
              </div>
            )
          )
        )}

        {/* Empty state — be query. Hero T4Icon 160px (3x prieš tai), be
            animacijos — proporcingas dizaineris'kai centrinis statiškas
            brand mark'as. */}
        {!result && !loading && !error && !query.trim() && (
          <div className="text-center py-8 space-y-4">
            <Mascot type="gardener" state="wave" size={140} className="text-forest-700 mx-auto" />
            <p className="font-display text-base font-semibold tracking-tight text-forest-700">Įveskite augalo pavadinimą</p>
            <p className="text-xs text-forest-400 max-w-[280px] mx-auto leading-relaxed">paieška ras tavo augalus, arba galėsi ieškoti naujų su AI</p>
          </div>
        )}
      </div>
    </motion.div>

    <AnimatePresence>
      {savingPhase2 && <SavingOverlay key="saving" />}
      {bulkState && (
        <BulkSaveOverlay
          key="bulk"
          state={bulkState}
          onClose={() => setBulkState(null)}
          onPick={handleCatalogAdd}
        />
      )}
    </AnimatePresence>
    <PaywallSheet open={paywallOpen} limitType={paywallLimitType} onClose={() => setPaywallOpen(false)} />
    </div>
  )

  if (useDesktopPanel) return createPortal(tree, host.container)
  return tree
}

// ── Full-screen Phase 2 loading overlay ──────────────────────────
// ── Phase 1 slim preview ─────────────────────────────────────
// VAIDMUO: search result modal'yje rodom TIK tai, kas TIKRAI lietuviškai ir
// patikimai (image, names, synonyms — hero block'e ABOVE; toxicity badges
// iš mūsų ASPCA/PFAF DB; source links Wiki/iNat). Aprasymas, care icons,
// idomybes etc — VISKAS atidėta Phase 2 enrichment'ui po Save click'o.
//
// KODĖL: anksciau ProfileContent'as buvo reuse'inamas tiek Phase 1 modal'yje,
// tiek post-save library detail card'e. Phase 1 versija rodydavo:
//   • EN aprasymą (Wiki LT lookup miss'ina exotic plant'ams)
//   • Default'us care icons iš Phase 0.5 (kurie nėra Phase 2 reliable info)
//   • Daugiau triukšmo nei naudos
// Slim versija — user'is matosi tik tai, kuo gali pasitikėti, ir
// ekonomiškai sprendžia ar pridėti augalą (kuriam tada AI Phase 2
// surinks pilną info).
function Phase1SlimPreview({ result, isDuplicate = false }) {
  if (!result) return null

  const hasToxicity = result.savybes?.pavojai?.length > 0 ||
                      result.savybes?.pavojingumas?.yra === true

  // Step 6m — discovery hint: jei augalas NĖRA mūsų catalog'e (= bus Phase 2
  // enrichment), rodom invitation banner'į. Heuristika: catalog hit'as
  // grąžina baseResult su laistymasIntervalas (full care info). Be jo — nauja.
  //
  // 2026-05-25 fix: BET — jei user'is JAU augina šitą rūšį (duplicate matched
  // per lotyniskas EXACT), Atradimas banner'is yra MISLEADING (user matytų
  // „Šio augalo bibliotekoje neturime" + drauge DuplicateBanner „Jau augini" —
  // konfliktinis UX). Suppress'inam Atradimas kai duplicate egzistuoja.
  // Tas reali situacija: user'is pridėjo augalą anksčiau, Phase 2 enrichment'as
  // nepavyko / buvo nutrauktas → catalog tuščias, bet plant'as collection'oje.
  const isNewToCatalog = !result.laistymasIntervalas && !isDuplicate

  // Source links — Wiki LT/EN + iNat (jei taxon ID žinomas). Logika mirror'as
  // PlantDetail.jsx — naudoja direct article URL jei wikiLtFound/wikiEnFound,
  // arba search URL fallback (Phase 1 metu šitie flagai dažniausiai dar nėra
  // gauti, todėl gausim search URL — kas yra OK).
  const fullName = result.latinName ?? result.lotyniskas
  const genus = fullName?.split(' ')?.[0] ?? fullName
  const sourceLinks = fullName ? [
    {
      label: 'Wikipedia LT',
      href: result.wikiLtFound
        ? `https://lt.wikipedia.org/wiki/${encodeURIComponent(fullName)}`
        : `https://lt.wikipedia.org/w/index.php?search=${encodeURIComponent(genus)}`,
    },
    {
      label: 'Wikipedia EN',
      href: result.wikiEnFound
        ? `https://en.wikipedia.org/wiki/${encodeURIComponent(fullName)}`
        : `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(genus)}`,
    },
    ...(result.inatTaxonId
      ? [{ label: 'iNaturalist', href: `https://www.inaturalist.org/taxa/${result.inatTaxonId}` }]
      : []),
  ] : []

  return (
    <div className="pt-5 pb-2 space-y-4">
      {/* Step 6m — discovery invitation banner. Atsiranda tik kai augalo
          nėra catalog'e (= bus AI Phase 2 enrichment + library indėlis).
          Tonalitetas: kvietimas, ne reklama. */}
      {isNewToCatalog && (
        <div className="rounded-2xl bg-forest-50 border border-forest-200/60 p-3">
          <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-forest-700 font-medium mb-1">
            ⭐ atradimas
          </p>
          <p className="text-[12.5px] text-forest-600 leading-relaxed">
            Šio augalo mūsų bibliotekoje dar neturime. Pridėk — AI surinks
            pilną info, o tau priklauso <span className="font-semibold">+1 AI užklausa</span>.
          </p>
        </div>
      )}

      {/* Toxicity badges — TIK kai mūsų DB turi entry. PlantSavybesPills
          internally returns null jei nieko nėra → no empty render. */}
      <PlantSavybesPills plant={result} />

      {/* „Pavojai nenustatyti" call-to-action callout — kai DB tyli, kad
          user'is nepamanytų „nieks neparodyta = saugu". Action framing'as
          paskatina paspausti save (kur AI Phase 2 dirba versiją plus
          aiSupplementaryHazard evaluation'ą). */}
      {!hasToxicity && (
        <div className="rounded-2xl bg-bone-300/40 border border-bone-400/40 p-3">
          <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-forest-500 mb-1.5">
            ⓘ pavojai
          </p>
          <p className="text-[12.5px] text-forest-600 leading-relaxed">
            Mūsų ASPCA + PFAF bazėse įrašo nėra. Tikslesnė pavojų info — kai
            leisi man surinkti duomenis (paspausk įdėjimo mygtuką).
          </p>
        </div>
      )}

      {/* Source links — visada matomi (palankiu user'iui patikrinti
          original šaltinį prieš pridedant) */}
      {sourceLinks.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
          {sourceLinks.map(({ label, href }) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer"
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-forest-500 hover:text-forest-700 underline underline-offset-2 transition-colors">
              {label}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

function SavingOverlay() {
  const [msgIndex, setMsgIndex] = useState(0)
  const msgs = [
    'Traukiu išmintį iš interneto...',
    'Klausiu augalų mokslininkų...',
    'Renkuoju priežiūros paslaptis...',
    'Skaičiuoju laistymo intervalus...',
    'Sudarinėju ligų diagnostiką...',
    'Beveik jau turiu viską...',
  ]
  useEffect(() => {
    const t = setInterval(() => setMsgIndex(i => (i + 1) % msgs.length), 1800)
    return () => clearInterval(t)
  }, [])

  const steps = [
    { label: 'Pagrindai', done: true },
    { label: 'Priežiūra',  active: true },
    { label: 'Išsaugota',  done: false },
  ]

  // createPortal į document.body — kitaip overlay rendinasi inside RightPanel
  // (per SearchModal'os portal'ą) ir jo z-[90] yra TIK RightPanel'io stacking
  // context'e (auto), todėl DesktopHeader (z-30) lieka virš overlay'aus.
  return createPortal(
    <motion.div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-forest-800/55 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-bone-50 rounded-3xl p-8 mx-6 flex flex-col items-center gap-5 shadow-[0_12px_32px_rgba(28,58,42,0.24)] border border-bone-400/50 w-full max-w-[300px]"
        initial={{ scale: 0.88, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.88, opacity: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 280 }}
      >
        <BrandLoader />
        <div className="text-center">
          <p className="font-display text-base font-semibold tracking-tight text-forest-800">Kantrybės...</p>
          <AnimatePresence mode="wait">
            <motion.p
              key={msgIndex}
              className="text-sm text-forest-500 mt-1.5 min-h-[20px]"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.22 }}
            >
              {msgs[msgIndex]}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Progress — segmented barcode (brand pattern, ne generic dot'ai).
            3 ploni bar'ai = visual indicator. Tekstas apačioje su color
            hierarchy: done vivid, active pulse, pending ghost. */}
        <div className="w-full">
          <div className="flex items-center gap-1.5 mb-2">
            {steps.map((s, i) => (
              <div
                key={i}
                className={`flex-1 h-1 rounded-full transition-colors ${
                  s.done   ? 'bg-forest-700' :
                  s.active ? 'bg-forest-500 animate-pulse' :
                             'bg-bone-400/50'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center justify-between">
            {steps.map((s, i) => (
              <span
                key={i}
                className={`font-mono text-[9.5px] font-medium uppercase tracking-[0.16em] transition-colors ${
                  s.done   ? 'text-forest-700' :
                  s.active ? 'text-forest-700 animate-pulse' :
                             'text-forest-300'
                }`}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}

// ── Save button: fetches Phase 2 details on click, then saves ────
//
// Optimizacija: jei result jau turi care info (pvz. iš library-first +
// mergeWithSeries — admin curated tikrai pilna info), praleidžiam Phase 2
// AI call'ą. Save'as tampa instant'as + sutaupom $0.01 per save.
function SaveButton({ label, result, className, onSave, onClose, onSavingChange, kategorija = 'auginama' }) {
  const [saving, setSaving] = useState(false)
  const { collectionId } = useAuth()
  // Variant B feature flag — set VITE_USE_SERVERSIDE_SAVE=1 Vercel'io env'e
  // įjungti server-side save flow'ą (POST /api/save-plant + waitUntil).
  // Default OFF — behavior'as IDENTIŠKAS šios feature'os iki Variant B retake'ui.
  //
  // Forgiving truthy check — '1' / 'true' / 'on' / 'yes' visi enable'ina.
  // Env var skaitomas BUILD TIME (Vite static replace) — jei tik ką pridėjai
  // Vercel'io env'e, REIKIA force redeploy'inti (Vercel Deployments → ⋮ →
  // Redeploy → UNCHECK "Use existing Build Cache"). Eilinis refresh'as
  // nepasiims naujo env'o.
  const flagRaw = import.meta.env.VITE_USE_SERVERSIDE_SAVE
  const useServerSide = ['1', 'true', 'on', 'yes'].includes(String(flagRaw).toLowerCase())

  const handleClick = async () => {
    setSaving(true)
    // SavingOverlay skirtas SENAM client-side Phase 2 flow'ui (~30s AI wait).
    // Variant B flag-on path'e modal'is uždaroma ~1s — overlay tik mirksi
    // ir atrodo trash. Trigger'inam TIK kai realiai laukim ilgai (client-side
    // Phase 2 path'as, žemiau).
    if (!useServerSide) onSavingChange?.(true)
    try {
      // REHOST hero photo į Firebase Storage — kad nesulūš (Brave/paghat URL'us
      // randame catalog'e admin'e, gali timeout'inti). Path'as deterministic —
      // server'is sukurs slug'ą iš latinName per savą catalogSlug() (mirror'as
      // catalogDocId), todėl Storage path GARANTUOTAI atitinka catalog/{docId}.
      // Anksčiau čia buvo inline slug derivation su dash separator'ais, kuris
      // skyrėsi nuo catalogDocId underscore'ų — sukurdavo DVI Storage path'us
      // tam pačiam augalui (2026-05-21 audit fix).
      let rehostedImage = result.image
      if (result.image && result.latinName) {
        rehostedImage = await rehostExternalImage(result.image, result.latinName, 1200)
      }
      const resultWithStorageImage = rehostedImage !== result.image
        ? { ...result, image: rehostedImage }
        : result

      // Skip Phase 2 jei result jau turi care info (mergeWithSeries iš
      // library-first). laistymasIntervalas yra patikimas indikatorius — jei
      // yra, tai reiškia merge'as įvyko ir kiti care field'ai irgi pildomi.
      // Fast path BENDRAS abiem flag stat'om — jokios Phase 2 nereikia.
      if (resultWithStorageImage.laistymasIntervalas) {
        onSave(resultWithStorageImage)
        triggerHeroGen(resultWithStorageImage.latinName)  // Phase A3: drawing gen (fast/pre-DB kelias)
        onClose()
        return
      }

      // ── VARIANT B: server-side save (flag-on) ─────────────
      // DUAL-WRITE pattern:
      //   1. Klientas iškart write'ina slim baseResult plant'ą per
      //      addToDashboard/addToWishlist (writes per Firebase JS SDK).
      //      User'is mato augalą savo bibliotekoje iš karto.
      //   2. POST /api/save-plant fire-and-forget — server'is enrich'ina
      //      AI Phase 2 care info per Firebase Admin SDK (merge:true).
      //      User'iui nereikia laukti AI; pakeitimas atsiranda real-time
      //      per Firestore listener'į usePlants hook'e (~10-30s).
      //   3. Modal'is closes iškart.
      // BENEFITS: user'is uždarymas modal'į NEBEKANCELIUOJA Anthropic call'o.
      // Server'is dirba savo darbą iki galo (waitUntil).
      if (useServerSide) {
        const plantId = makeId()
        // enrichmentStartedAt — ISO timestamp save click metu. Naudojamas
        // getPlantEnrichmentState'e timing fallback'ui (90s window'as).
        // SEPARATE nuo data_prideta (tik YYYY-MM-DD) ir separate nuo bet
        // kokio server write'o (server'is rašo phase2CompletedAt /
        // enrichmentError, niekada šio field'o).
        const resultWithId = {
          ...resultWithStorageImage,
          id: plantId,
          enrichmentStartedAt: new Date().toISOString(),
        }
        onSave(resultWithId)
        triggerHeroGen(resultWithStorageImage.latinName)  // Phase A3: drawing gen (server-side kelias)
        try {
          const idToken = await auth.currentUser?.getIdToken().catch(() => null)
          if (idToken && collectionId) {
            // Fire-and-forget — nelaukim 202. UI nepriklauso nuo šio API.
            // Jei klysta (network, server'is fail), klientas vis tiek
            // turi slim plant'ą savo bibliotekoje (žemiau onSave).
            fetch('/api/save-plant', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`,
              },
              body: JSON.stringify({
                latinName: resultWithStorageImage.latinName,
                name:      resultWithStorageImage.name,
                baseResult: resultWithStorageImage,
                colId:     collectionId,
                plantId,
                kategorija,
              }),
            }).then(r => {
              if (!r.ok) console.warn('[SaveButton] /api/save-plant status:', r.status)
            }).catch(e => console.warn('[SaveButton] /api/save-plant POST failed:', e?.message))
          } else {
            console.warn('[SaveButton] no idToken/collectionId — skipping server enrich')
          }
        } catch (e) {
          console.warn('[SaveButton] server-save dispatch failed:', e?.message)
        }
        onClose()
        return
      }

      // ── CLIENT-SIDE Phase 2 (flag-off, current flow) ──────
      // Perduodam resultWithStorageImage kaip baseResult — kad fetchDetails
      // catalog write'as gautų image (rehost'intas Storage URL), aprasymas,
      // kilme, savybes iš Phase 1 SLIM mode'o.
      const details = await fetchDetails(
        resultWithStorageImage.latinName,
        resultWithStorageImage.name,
        resultWithStorageImage,
      )
      onSave({ ...resultWithStorageImage, ...details })
      onClose()
    } catch (e) {
      console.error('[SaveButton] Phase 2 error:', e)
      // Fall back to saving Phase 1 data
      onSave(result)
      onClose()
    } finally {
      setSaving(false)
      onSavingChange?.(false)
    }
  }

  return (
    <button onClick={handleClick} disabled={saving} className={className}>
      {label}
    </button>
  )
}

// ── Update button: fetches Phase 2 and patches existing plant ────
function UpdateButton({ label, result, existingId, className, onUpdate, onClose, onSavingChange }) {
  const [saving, setSaving] = useState(false)

  const handleClick = async () => {
    setSaving(true)
    onSavingChange?.(true)
    try {
      // Skip Phase 2 jei result jau turi care info (žiūr. SaveButton komentarą)
      const merged = result.laistymasIntervalas
        ? result
        : { ...result, ...(await fetchDetails(result.latinName, result.name)) }
      const full   = fromAIResult(merged)
      // Strip identity/personal fields — only update reference data
      const { id: _id, kategorija: _kat, komentaras: _kom, data_prideta: _dat, status: _st } = full
      const patch = { ...full }
      delete patch.id; delete patch.kategorija; delete patch.komentaras
      delete patch.data_prideta; delete patch.status
      onUpdate(existingId, patch)
      onClose()
    } catch (e) {
      console.error('[UpdateButton] Phase 2 error:', e)
      onClose()
    } finally {
      setSaving(false)
      onSavingChange?.(false)
    }
  }

  return (
    <button onClick={handleClick} disabled={saving} className={className}>
      {label}
    </button>
  )
}

function DuplicateBanner({ duplicate, result, onAddToDashboard, onViewPlant, onPromote, onUpdatePlant, onClose, onSavingChange }) {
  const { kategorija } = duplicate

  // ── nori: custom layout with 3 actions ──────────────────────────
  if (kategorija === 'nori') {
    return (
      <div className="bg-terracotta-50 border border-terracotta-200/60 rounded-2xl p-4 space-y-2">
        <p className="font-mono text-[10px] font-medium text-terracotta-600 uppercase tracking-[0.16em]">Jau norų sąraše</p>
        <button
          onClick={() => { onPromote?.(duplicate.id); onClose() }}
          className="w-full h-12 rounded-btn font-display text-sm font-semibold text-bone bg-forest-700 hover:bg-forest-800 transition-colors"
        >
          Įsigijau!
        </button>
        <div className="flex gap-2">
          {onUpdatePlant && (
            <UpdateButton
              label="Atnaujinti įrašą"
              result={result}
              existingId={duplicate.id}
              className="flex-1 py-2.5 rounded-btn font-display text-sm font-semibold text-forest-700 bg-bone-50 border border-bone-400/50 hover:bg-bone-300/40 disabled:opacity-50 transition-colors"
              onUpdate={onUpdatePlant}
              onClose={onClose}
              onSavingChange={onSavingChange}
            />
          )}
          <button
            onClick={() => { onViewPlant?.(duplicate) }}
            className="flex-1 py-2.5 rounded-btn font-display text-sm font-semibold text-forest-700 bg-bone-50 border border-bone-400/50 hover:bg-bone-300/40 transition-colors"
          >
            Peržiūrėti
          </button>
        </div>
      </div>
    )
  }

  const configs = {
    auginama: {
      bg: 'bg-forest-50', border: 'border-forest-200/60', text: 'text-forest-700',
      message: `Jau augini šį augalą`,
      primary: { label: 'Pridėti dar vieną', onSave: onAddToDashboard },
    },
    istorija: {
      bg: 'bg-bone-300/40', border: 'border-bone-400/60', text: 'text-forest-600',
      message: `Šis augalas pas tave mirė...`,
      primary: { label: 'Bandyti dar kartą', onSave: onAddToDashboard },
    },
  }

  const cfg = configs[kategorija] ?? configs.auginama

  return (
    <div className={`${cfg.bg} border ${cfg.border} rounded-2xl p-4 space-y-3`}>
      <p className={`font-mono text-[10px] font-medium uppercase tracking-[0.16em] ${cfg.text}`}>{cfg.message}</p>
      <div className="flex gap-2">
        {cfg.primary.onSave ? (
          <SaveButton
            label={cfg.primary.label}
            result={result}
            className="flex-1 h-12 rounded-btn font-display text-sm font-semibold text-bone bg-forest-700 hover:bg-forest-800 disabled:opacity-60 transition-colors"
            onSave={cfg.primary.onSave}
            onClose={onClose}
            onSavingChange={onSavingChange}
          />
        ) : (
          <button
            onClick={cfg.primary.action}
            className="flex-1 h-12 rounded-btn font-display text-sm font-semibold text-bone bg-forest-700 hover:bg-forest-800 transition-colors"
          >
            {cfg.primary.label}
          </button>
        )}
        <button
          onClick={() => { onViewPlant?.(duplicate) }}
          className="flex-1 h-12 rounded-btn font-display text-sm font-semibold text-forest-700 bg-bone-50 border border-bone-400/50 hover:bg-bone-300/40 transition-colors"
        >
          Peržiūrėti
        </button>
      </div>
    </div>
  )
}

// ── BulkSaveOverlay — bulk series save progress + final summary ──────
//
// state structure (žiūr. bulkSaveSeries handler):
//   { phase: 'ai'|'saving'|'images'|'done'|'error', msg, seriesName, total,
//     completed, savedCultivars[] }
//
// Trys faze: AI generuoja → Saugomas series doc → Per-cultivar saves su images
// (visa tai client-side, paraleliai per Promise.all). „Done" faze su summary
// + picker'iu: vartotojas tiesiogiai pasirenka, kurį iš išsaugotų cultivar'ų
// pridėti į savo kolekciją (reuse'inam handleCatalogAdd → mergeWithSeries +
// onAddToWishlist + open detail card).
function BulkSaveOverlay({ state, onClose, onPick }) {
  const isDone   = state.phase === 'done'
  const isError  = state.phase === 'error'
  const isActive = !isDone && !isError
  const progress = state.total ? Math.round((state.completed ?? 0) / state.total * 100) : 0
  const saved    = Array.isArray(state.savedCultivars) ? state.savedCultivars : []
  const hasPicker = isDone && saved.length > 0

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-forest-800/55 backdrop-blur-sm p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className={`bg-bone-50 rounded-3xl flex flex-col gap-4 shadow-[0_12px_32px_rgba(28,58,42,0.24)] border border-bone-400/50 w-full ${
          hasPicker ? 'max-w-[440px] max-h-[88vh] p-5' : 'max-w-[360px] p-7 items-center'
        }`}
        initial={{ scale: 0.88, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.88, opacity: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 280 }}
      >
        {/* Header — su flex-shrink-0 kad neužimtų scroll erdvės */}
        <div className={`flex flex-col gap-3 flex-shrink-0 ${hasPicker ? '' : 'items-center'}`}>
          <div className={hasPicker ? 'flex items-center gap-3' : 'flex flex-col items-center gap-3'}>
            {isActive && <BrandLoader />}
            {isDone   && <div className={hasPicker ? 'text-3xl' : 'text-5xl'}>✓</div>}
            {isError  && <div className="text-5xl">⚠</div>}

            <div className={hasPicker ? 'flex-1 min-w-0' : 'text-center'}>
              <p className="font-display text-base font-semibold tracking-tight text-forest-800">
                {isDone ? 'Pridėta!' : isError ? 'Klaida' : 'Bulk save…'}
              </p>
              {state.seriesName && (
                <p className="font-mono text-[11px] text-forest-500 mt-0.5">
                  {state.seriesName}
                </p>
              )}
              <p className="text-sm text-forest-600 mt-1.5 leading-snug">
                {state.msg}
              </p>
            </div>
          </div>

          {/* Progress bar — rodom kai turim total */}
          {isActive && state.total > 0 && (
            <div className="w-full">
              <div className="h-1.5 bg-bone-300 rounded-full overflow-hidden">
                <div
                  className="h-full bg-forest-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="font-mono text-[10px] text-forest-400 text-center mt-1.5">
                {state.completed} / {state.total} cultivars
              </p>
            </div>
          )}
        </div>

        {/* Picker — done state'e su išsaugotais cultivars'ais */}
        {hasPicker && (
          <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1.5 min-h-0">
            {saved.map(entry => (
              <div
                key={entry.id || entry._id}
                className="flex items-center gap-3 p-2 bg-bone-100/60 border border-bone-400/30 rounded-2xl"
              >
                <div className="w-10 h-10 flex-shrink-0 rounded-xl overflow-hidden bg-bone-200 flex items-center justify-center">
                  {entry.image ? (
                    <img src={entry.image} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <span className="text-xl">{entry.emoji ?? '🌿'}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-[13px] font-semibold text-forest-800 truncate leading-tight">
                    {entry.lietuviškas || entry.lotyniskas}
                  </p>
                  <p className="text-[10px] text-forest-500 italic truncate leading-tight">{entry.lotyniskas}</p>
                </div>
                <button
                  onClick={() => onPick?.(entry)}
                  className="flex-shrink-0 inline-flex items-center gap-1 h-7 px-2.5 rounded-btn-sm bg-forest-700 hover:bg-forest-800 text-bone text-[11px] font-display font-semibold transition-colors"
                  title="Pridėti į kolekciją"
                >
                  + Pridėti
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Close — tik kai done arba error */}
        {(isDone || isError) && (
          <button
            onClick={onClose}
            className="w-full h-11 rounded-btn font-display text-sm font-semibold text-bone bg-forest-700 hover:bg-forest-800 transition-colors flex-shrink-0"
          >
            {hasPicker ? 'Praleisti' : 'Uždaryti'}
          </button>
        )}
      </motion.div>
    </motion.div>,
    document.body
  )
}
