/**
 * Wikipedia + Wikidata API klientas — vienas šaltinis visam Wiki fetch'ui.
 *
 * Anksčiau buvo duplikuotas `fetchWikiLt`/`fetchWikiEn` 2 vietose:
 *   • searchStage1Augment.js (be User-Agent → 429 nuo 4-os užklausos)
 *   • previewParallelFetch.js (su User-Agent)
 *
 * Šis modulis konsoliduoja į vieną:
 *   • fetchWikiExtract(latin, lang)  — text extract (LT, EN, ...)
 *   • fetchWikiPhoto(latin, lang)    — thumbnail + original URL + WikiDataID
 *   • fetchWikidataIsPlant(qid)      — P31 (instance of) check'as,
 *                                       safeguard nuo "keptuvė"-tipo užklausų
 *
 * VARTOJIMAS:
 *   import { fetchWikiExtract, fetchWikiPhoto, fetchWikidataIsPlant } from './wikiApi'
 *
 *   const lt = await fetchWikiExtract('Monstera deliciosa', 'lt')
 *   const photo = await fetchWikiPhoto('Monstera deliciosa', 'en')
 *   const isPlant = await fetchWikidataIsPlant(photo.wikidataId)
 *
 * VISI grąžina paprastus objektus su `found: boolean` — nemanydami throw'inti.
 */

// Wikipedia & Wikimedia oficialiai reikalauja identifikuojamo User-Agent.
// Be jo → 429 Too Many Requests jau po 3-4 fetch'ų iš to paties IP.
// Format: AppName/Version (contact; purpose) (https://meta.wikimedia.org/wiki/User-Agent_policy)
// IMPORTANT: ASCII-only. HTTP headers turi būti ByteString (no non-ASCII chars).
// Buvęs "augalų enciklopedija" sulaužydavo fetch() su:
//   "Cannot convert argument to a ByteString because the character ...
//    has a value of 371 which is greater than 255"
export const WIKI_USER_AGENT =
  'LapasidPlantApp/1.0 (https://augalai.crazyeuropean.eu; kestutis@okone.lt) plant-care-app'

const COMMON_HEADERS = {
  'Accept': 'application/json',
  'User-Agent': WIKI_USER_AGENT,
  'Api-User-Agent': WIKI_USER_AGENT, // Wikimedia-specifinis
}

// Wikipedia kartais grąžina puslapį be turinio (disambiguation, stub, redirect
// target tuščias). MIN_EXTRACT_CHARS — anti-phantom filtras: jei extract'as
// trumpesnis, traktuojam kaip "no page".
const MIN_EXTRACT_CHARS = 50

// Default timeout per užklausą (ms). Caller'is gali override'inti.
const DEFAULT_TIMEOUT_MS = 1500

function withTimeout(promise, ms = DEFAULT_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error(`wiki timeout ${ms}ms`)), ms),
    ),
  ])
}

// ── 1. Wikipedia extract (text) ────────────────────────────────

/**
 * Fetch Wikipedia article intro paragraph.
 *
 * @param {string} latinName  e.g. "Monstera deliciosa"
 * @param {string} lang       'lt' | 'en' | ...
 * @param {object} opts
 * @param {number} opts.timeoutMs
 * @returns {Promise<{
 *   extract: string,
 *   url: string|null,
 *   title: string|null,
 *   pageid: number|null,
 *   wikidataId: string|null,
 *   found: boolean,
 *   error?: string,
 * }>}
 */
export async function fetchWikiExtract(latinName, lang = 'en', opts = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS } = opts

  if (!latinName) {
    return { extract: '', url: null, title: null, pageid: null, wikidataId: null, found: false }
  }

  // Vienu API call'u gaunam: extract + URL + Wikidata QID (per pageprops).
  // pageprops.wikibase_item = "Q189414" pvz. — naudosim Wikidata gate'ui.
  const params = new URLSearchParams({
    action:   'query',
    format:   'json',
    titles:   latinName,
    redirects:'1',
    prop:     'extracts|info|pageprops',
    exintro:  '1',         // tik pirmas paragrafas
    explaintext: '1',      // plain text, no HTML
    inprop:   'url',
    ppprop:   'wikibase_item',
    origin:   '*',         // CORS browser'iui
  })

  try {
    const res = await withTimeout(
      fetch(`https://${lang}.wikipedia.org/w/api.php?${params}`, { headers: COMMON_HEADERS }),
      timeoutMs,
    )
    if (!res.ok) {
      return {
        extract: '', url: null, title: null, pageid: null, wikidataId: null,
        found: false, error: `HTTP ${res.status}`,
      }
    }
    const json = await res.json()
    const page = Object.values(json.query?.pages ?? {})[0]
    if (!page || page.missing !== undefined) {
      return { extract: '', url: null, title: null, pageid: null, wikidataId: null, found: false }
    }
    const extract = page.extract ?? ''
    const hasRealContent = extract.length >= MIN_EXTRACT_CHARS
    return {
      extract,
      url: page.fullurl ?? null,
      title: page.title ?? null,
      pageid: page.pageid ?? null,
      wikidataId: page.pageprops?.wikibase_item ?? null,
      found: hasRealContent,
    }
  } catch (e) {
    return {
      extract: '', url: null, title: null, pageid: null, wikidataId: null,
      found: false, error: e?.message ?? String(e),
    }
  }
}

// ── 2. Wikipedia thumbnail (photo) ─────────────────────────────

/**
 * Fetch Wikipedia thumbnail + original photo URL.
 *
 * @param {string} latinName
 * @param {string} lang       'en' default (didžiausia foto coverage)
 * @param {object} opts
 * @param {number} opts.thumbSize  Thumbnail width px (default 600)
 * @param {number} opts.timeoutMs
 * @returns {Promise<{
 *   url: string|null,
 *   width: number|null,
 *   height: number|null,
 *   original: string|null,
 *   found: boolean,
 *   error?: string,
 * }>}
 */
export async function fetchWikiPhoto(latinName, lang = 'en', opts = {}) {
  const { thumbSize = 600, timeoutMs = DEFAULT_TIMEOUT_MS } = opts

  if (!latinName) {
    return { url: null, width: null, height: null, original: null, found: false }
  }

  const params = new URLSearchParams({
    action:     'query',
    format:     'json',
    titles:     latinName,
    redirects:  '1',
    prop:       'pageimages',
    piprop:     'thumbnail|original',
    pithumbsize: String(thumbSize),
    origin:     '*',
  })

  try {
    const res = await withTimeout(
      fetch(`https://${lang}.wikipedia.org/w/api.php?${params}`, { headers: COMMON_HEADERS }),
      timeoutMs,
    )
    if (!res.ok) {
      return { url: null, width: null, height: null, original: null, found: false, error: `HTTP ${res.status}` }
    }
    const json = await res.json()
    const page = Object.values(json.query?.pages ?? {})[0]
    if (!page?.thumbnail) {
      return { url: null, width: null, height: null, original: null, found: false }
    }
    return {
      url: page.thumbnail.source,
      width: page.thumbnail.width,
      height: page.thumbnail.height,
      original: page.original?.source ?? null,
      found: true,
    }
  } catch (e) {
    return {
      url: null, width: null, height: null, original: null,
      found: false, error: e?.message ?? String(e),
    }
  }
}

// ── 3. Wikidata "instance of" plant gate ──────────────────────

/**
 * Plant taxonomy hierarchy iš Wikidata.
 *
 * P31 = "instance of"
 *
 * Plant taxonomic hierarchy:
 *   Q756       plant (any)
 *   Q16521     taxon (rūšis ar pan.)
 *   Q23038290  fossil taxon (paleobotany)
 *   Q3672092   variety of plant
 *
 * Non-plant (apsaugai nuo "keptuvė"):
 *   Q1198681   cooking utensil
 *   Q11050     food
 *   Q11173     chemical compound
 *   Q467454    consumer product
 *   ...
 *
 * Idėja: jei Wikipedia page'as turi Wikidata QID, klausiam — ar tai
 * augalas? Jei ne → blokuojam AI fallback'ą.
 *
 * @param {string} wikidataId  e.g. "Q189414"
 * @param {object} opts
 * @returns {Promise<{
 *   isPlant: boolean,        // ar P31 reikšmė priklauso plant hierarchijai
 *   isTaxon: boolean,        // ar tai taxonomy entity (genus/species/...)
 *   instanceOf: string[],    // visi P31 QID'ai
 *   labels: { lt?: string, en?: string },
 *   found: boolean,
 *   error?: string,
 * }>}
 */
export async function fetchWikidataIsPlant(wikidataId, opts = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS } = opts

  if (!wikidataId || !/^Q\d+$/.test(wikidataId)) {
    return { isPlant: false, isTaxon: false, instanceOf: [], labels: {}, found: false }
  }

  // wbgetentities — gauk visus P31 + labels vienu call'u
  const params = new URLSearchParams({
    action:   'wbgetentities',
    format:   'json',
    ids:      wikidataId,
    props:    'claims|labels',
    languages:'lt|en',
    origin:   '*',
  })

  try {
    const res = await withTimeout(
      fetch(`https://www.wikidata.org/w/api.php?${params}`, { headers: COMMON_HEADERS }),
      timeoutMs,
    )
    if (!res.ok) {
      return {
        isPlant: false, isTaxon: false, instanceOf: [], labels: {},
        found: false, error: `HTTP ${res.status}`,
      }
    }
    const json = await res.json()
    const entity = json.entities?.[wikidataId]
    if (!entity || entity.missing !== undefined) {
      return { isPlant: false, isTaxon: false, instanceOf: [], labels: {}, found: false }
    }

    // Surink visus P31 QID'us
    const p31Claims = entity.claims?.P31 ?? []
    const instanceOf = p31Claims
      .map(c => c.mainsnak?.datavalue?.value?.id)
      .filter(Boolean)

    // Plant hierarchijos QID'ai (verified Wikidata Q'siai)
    const PLANT_QIDS = new Set([
      'Q756',       // plant
      'Q16521',     // taxon
      'Q23038290',  // fossil taxon
      'Q3672092',   // variety of plant
      'Q502895',    // common name
      'Q2382443',   // monocotyledon
      'Q25266',     // pteridophyte
      'Q121656',    // gymnosperm
    ])
    const TAXON_QIDS = new Set([
      'Q16521',     // taxon
      'Q34740',     // genus
      'Q7432',      // species
      'Q23038290',  // fossil taxon
      'Q855769',    // variety
      'Q4886',      // cultivar
      'Q68947',     // subspecies
      'Q3978005',   // strain
    ])

    // STRICT: tik augalų hierarchijos QID'ai (Q756 / Q3672092 / monocot...)
    const isPlant = instanceOf.some(qid => PLANT_QIDS.has(qid))
    // PERMISSIVE: bet kuris taxonomy entity (gali būti augalas, grybas, gyvūnas)
    const isTaxon = instanceOf.some(qid => TAXON_QIDS.has(qid))

    const labels = {}
    if (entity.labels?.lt) labels.lt = entity.labels.lt.value
    if (entity.labels?.en) labels.en = entity.labels.en.value

    // NB: caller'is sprendžia gate griežtumą. Default rekomendacija:
    //   passesGate = isPlant || isTaxon   (permissive — tik blokuoja "keptuvė")
    //
    // Griežtesnis variantas: tik isPlant. Bet tada blokuoji ir augalus, kurių
    // Wikidata P31 nustatytas kaip generic Q16521 (taxon) be Plantae P171 chain.
    // Realybėje daugumai augalų P31=Q16521 vienintelis claim — todėl griežtas
    // tik isPlant gate'as duotų daug false negatives.
    return {
      isPlant,
      isTaxon,
      instanceOf,
      labels,
      found: true,
    }
  } catch (e) {
    return {
      isPlant: false, isTaxon: false, instanceOf: [], labels: {},
      found: false, error: e?.message ?? String(e),
    }
  }
}
