/**
 * Preview parallel fetch — paima viską, ko reikia preview kortelei, paraleliai.
 *
 * Šaltiniai (visi $0 jei cached, instrumentuoti su timing log'ais):
 *   1. Wikipedia LT extract (1-st paragraph + URL)
 *   2. Wikipedia EN extract (fallback + Stage 2 RAG context)
 *   3. Wikipedia thumbnail (geresnė kokybė nei iNat)
 *   4. iNat photo (fallback su default_photo)
 *   5. (optional) Brave Image — TIK jei opts.includeBrave (default off, Save click'e)
 *
 * Visi su Promise.allSettled — vienas šaltinis fail'ins, kiti tęs.
 * Kiekvienas turi savo timeout (3s), kad vienas slow šaltinis neužkabintų kitų.
 *
 * USAGE:
 *   const fetched = await previewParallelFetch('Monstera deliciosa', { debug: true })
 *   // → {
 *   //     wikiLt: { extract, url, ms, ok },
 *   //     wikiEn: { extract, url, ms, ok },
 *   //     wikiPhoto: { url, ms, ok },
 *   //     iNatPhoto: { url, taxonId, ms, ok },
 *   //     brave: { images, ms, ok } | null,
 *   //     bestPhoto: { url, source, ms },
 *   //     totalMs: 1234,
 *   //   }
 *
 * DEBUG mode — kiekvienas šaltinis console.log:
 *   [preview-fetch] wikiLt: 234ms ✓ (812 chars)
 *   [preview-fetch] wikiEn: 312ms ✓ (1450 chars)
 *   [preview-fetch] wikiPhoto: 280ms ✓ https://...
 *   [preview-fetch] iNatPhoto: 198ms ✓ (taxon 47218)
 *   [preview-fetch] TOTAL: 412ms (best photo: wiki)
 */

import {
  fetchWikiExtract as wikiExtract,
  fetchWikiPhoto as wikiPhoto,
  fetchWikidataIsPlant as wikidataPlantCheck,
  WIKI_USER_AGENT,
} from './wikiApi.js'

// Per-source timeout: 1.5s. Promise.allSettled — vienas slow source nestabdo
// kitų. Real-world cold start pirmajam useriui ~800ms, warm cache ~200ms.
const TIMEOUT_MS = 1500

// iNat reikalauja identifikuoto User-Agent (kaip ir Wikipedia).
// Naudojam tą patį WIKI_USER_AGENT — viena identity per visus 3rd party API.
const COMMON_HEADERS = {
  'Accept': 'application/json',
  'User-Agent': WIKI_USER_AGENT,
}

function timed(label, promise, debug) {
  const start = Date.now()
  return promise
    .then(value => {
      const ms = Date.now() - start
      if (debug) console.log(`[preview-fetch] ${label}: ${ms}ms ✓`, summary(label, value))
      return { ...value, ms, ok: true }
    })
    .catch(err => {
      const ms = Date.now() - start
      if (debug) console.log(`[preview-fetch] ${label}: ${ms}ms ✗ ${err?.message ?? err}`)
      return { ms, ok: false, error: err?.message ?? String(err) }
    })
}

function summary(label, value) {
  if (!value) return ''
  if (label.startsWith('wiki') && label.endsWith('Photo')) {
    return value.url ? value.url.slice(0, 80) : '(no photo)'
  }
  if (label.startsWith('wiki')) {
    if (!value.found) return '(no page)'
    return `(${value.extract?.length ?? 0} chars)`
  }
  if (label.endsWith('Photo')) return value.url ? value.url.slice(0, 80) : '(no photo)'
  if (label === 'brave' && value.images) return `(${value.images.length} candidates)`
  return ''
}

function withTimeout(fetchPromise, ms) {
  return Promise.race([
    fetchPromise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout ${ms}ms`)), ms)),
  ])
}

// ── Sources 1-3: Wikipedia extract + photo (proxy į wikiApi.js) ──

async function fetchWikiExtract(latin, lang) {
  return wikiExtract(latin, lang, { timeoutMs: TIMEOUT_MS })
}

async function fetchWikiPhoto(latin, lang = 'en') {
  return wikiPhoto(latin, lang, { timeoutMs: TIMEOUT_MS })
}

// ── Source 4: iNat photo ──────────────────────────────────────

async function fetchINatPhoto(latin) {
  const url = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(latin)}&rank=species,subspecies,variety,genus&limit=3`
  const res = await withTimeout(fetch(url, { headers: COMMON_HEADERS }), TIMEOUT_MS)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  const lower = latin.toLowerCase()
  const taxon =
    json.results?.find(t => t.name?.toLowerCase() === lower) ??
    json.results?.[0]
  if (!taxon?.default_photo) return { url: null, taxonId: taxon?.id ?? null, found: false }
  return {
    url: taxon.default_photo.medium_url ?? taxon.default_photo.url,
    taxonId: taxon.id,
    found: true,
  }
}

// ── Source 5: Brave Image (optional, paid) ─────────────────────

async function fetchBraveImages(latin, opts = {}) {
  // Browser → proxy through /api/plant-image (Vercel edge-cached 30d)
  // Node tests → direct call (skip — needs API key)
  const url = `/api/plant-image?q=${encodeURIComponent(latin)}`
  const res = await withTimeout(fetch(url), TIMEOUT_MS)
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status} ${txt.slice(0, 80)}`)
  }
  const json = await res.json()
  return {
    images: json.images ?? [],
    found: (json.images?.length ?? 0) > 0,
  }
}

// ── Main orchestrator ────────────────────────────────────────

/**
 * @param {string} latinName
 * @param {object} opts
 * @param {boolean} opts.debug — console.log per-source timings
 * @param {boolean} opts.includeBrave — include Brave Image (Save click context)
 * @param {boolean} opts.includeWikiEn — also fetch EN Wiki extract (default true — needed for Stage 2 RAG)
 * @param {boolean} opts.includeWikidataGate — fetch Wikidata P31 (instance of)
 *                  to verify Wikipedia page is a plant/taxon, NOT "keptuvė" or
 *                  similar non-plant. ~200ms extra (paralelinis su Wiki extract).
 *                  Naudoti TIK pre-DB miss kelyje — pre-DB hit'as jau yra
 *                  verified plant'as, gate'as nieko nepridėtų.
 */
export async function previewParallelFetch(latinName, opts = {}) {
  const {
    debug = false,
    includeBrave = false,
    includeWikiEn = true,
    includeWikidataGate = false,
  } = opts

  if (!latinName) return null
  const totalStart = Date.now()

  if (debug) console.log(`\n[preview-fetch] ━━━ ${latinName} ━━━`)

  const tasks = {
    wikiLt:    timed('wikiLt',    fetchWikiExtract(latinName, 'lt'), debug),
    wikiPhoto: timed('wikiPhoto', fetchWikiPhoto(latinName, 'en'),   debug),
    iNatPhoto: timed('iNatPhoto', fetchINatPhoto(latinName),         debug),
  }
  if (includeWikiEn) tasks.wikiEn = timed('wikiEn', fetchWikiExtract(latinName, 'en'), debug)
  if (includeBrave)  tasks.brave  = timed('brave',  fetchBraveImages(latinName),       debug)

  const entries = await Promise.all(
    Object.entries(tasks).map(async ([k, p]) => [k, await p]),
  )
  const result = Object.fromEntries(entries)

  // Best photo picker — priority: brave (if requested) → wiki → inat
  let bestPhoto = null
  if (result.brave?.ok && result.brave.images?.length) {
    bestPhoto = { url: result.brave.images[0].url, source: 'brave', ms: result.brave.ms }
  } else if (result.wikiPhoto?.ok && result.wikiPhoto.url) {
    bestPhoto = { url: result.wikiPhoto.url, source: 'wikipedia', ms: result.wikiPhoto.ms }
  } else if (result.iNatPhoto?.ok && result.iNatPhoto.url) {
    bestPhoto = { url: result.iNatPhoto.url, source: 'inat', ms: result.iNatPhoto.ms }
  }
  result.bestPhoto = bestPhoto

  // Best LT description — LT preferred, EN fallback (flagged for later translation)
  let bestExtract = null
  if (result.wikiLt?.ok && result.wikiLt.found) {
    bestExtract = {
      lang: 'lt',
      extract: result.wikiLt.extract,
      url: result.wikiLt.url,
      title: result.wikiLt.title,
    }
  } else if (result.wikiEn?.ok && result.wikiEn.found) {
    bestExtract = {
      lang: 'en',
      extract: result.wikiEn.extract,
      url: result.wikiEn.url,
      title: result.wikiEn.title,
      needsTranslation: true,
    }
  }
  result.bestExtract = bestExtract

  // ── Wikidata plant gate ──────────────────────────────────────
  // wikidataId pasiimamas iš Wiki extract'o pageprops (vienas API call'as
  // grąžina ir extract'ą, ir QID). Antras call'as eina į Wikidata wbgetentities
  // gauti P31 (instance of). Iškviečiamas TIK jei toj pačioj sesijoj reikia
  // gate'o (opt-in flag).
  if (includeWikidataGate) {
    const wikidataId = result.wikiEn?.wikidataId ?? result.wikiLt?.wikidataId ?? null
    if (wikidataId) {
      const gateResult = await timed(
        'wikidataGate',
        wikidataPlantCheck(wikidataId, { timeoutMs: TIMEOUT_MS }),
        debug,
      )
      result.wikidataGate = gateResult
      // PERMISSIVE gate: isPlant ARBA isTaxon → leist eiti per AI fallback.
      // Block'inam tik kai EXPLICITIŠKAI not-plant (cooking utensil ir pan.).
      result.passesPlantGate = !!(gateResult.ok && (gateResult.isPlant || gateResult.isTaxon))
    } else {
      // Net Wikipedia page'o nėra → null wikidataId → useris pateikė neegzistuojantį
      // ar gerokai iškraipytą terminą. Gate'as nepraeitas.
      result.wikidataGate = null
      result.passesPlantGate = false
    }
  }

  result.totalMs = Date.now() - totalStart

  if (debug) {
    const gateInfo = includeWikidataGate
      ? ` | gate: ${result.passesPlantGate ? '✓PLANT' : '✗BLOCK'}`
      : ''
    console.log(
      `[preview-fetch] TOTAL: ${result.totalMs}ms` +
      ` | photo: ${bestPhoto?.source ?? 'none'}` +
      ` | extract: ${bestExtract?.lang ?? 'none'}` +
      (bestExtract?.needsTranslation ? ' (EN→LT pending)' : '') +
      gateInfo,
    )
  }

  return result
}
