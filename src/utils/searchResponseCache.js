// Query → AI response cache (48h TTL, localStorage backed).
//
// Vieta cache layer'ių piramidėje:
//   1. Catalog fuzzy match (library-first short-circuit) — ~100ms, 100% admin curated
//   2. ŠITAS — query response cache — 0ms, ankstesnio AI atsakymo replay'as
//   3. AI slim preview (Sonnet + web_search) — 30-60s
//
// Cache'inam tik medium+ confidence — low-confidence rezultatus neverta
// cache'inti, nes user'is vis tiek norėjo geresnio (kitą kartą tegul AI
// pabando iš naujo, gal padarys geriau).
//
// Įrašai 48h TTL — pakanka admin'o tipiniam darbo flow'ui (vakaras → kitas
// vakaras), bet neleidžia per stale info'ai užsibūt savaitėmis. Bust'inam
// taip pat kai admin'as edit'ina catalog'ą / taxonGroups (žiūr. AdminPanel
// saveCatalogEntry / deleteCatalogEntry / etc.).

const KEY = 'search-response-cache-v1'
const TTL = 48 * 60 * 60 * 1000  // 48h
const MAX_ENTRIES = 100           // localStorage bloat apsauga (LRU trim)

function normalize(q) {
  return (q ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function loadMap() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveMap(m) {
  try { localStorage.setItem(KEY, JSON.stringify(m)) } catch {}
}

/**
 * Grąžina cache'intą rezultatą jei rastas ir dar galiojantis.
 * Lazy expiry — užklausus expired'o, ištrina'm jį iš map'o.
 */
export function getCachedSearchResponse(query) {
  const k = normalize(query)
  if (!k || k.length < 2) return null
  const m = loadMap()
  const entry = m[k]
  if (!entry) return null
  if (Date.now() - entry.at > TTL) {
    delete m[k]
    saveMap(m)
    return null
  }
  return entry.result
}

/**
 * Įrašo rezultatą į cache'ą. Tik medium ar high confidence rezultatai
 * cache'inami — low confidence neverta replay'inti.
 *
 * @param {string} query — original user query (bus normalize'intas)
 * @param {object} result — FINAL result object (kas yra setResult'inta — su
 *                          enriched image, Wikidata verification, candidates)
 * @param {string} confidence — 'high' | 'medium' | 'low'
 */
export function setCachedSearchResponse(query, result, confidence) {
  if (confidence === 'low') return  // low-confidence neverta cache'inti

  // Medium confidence + tuščia candidates = AI nedirbo gerai. Tai dažniausiai
  // „dunno" atsakymas su uncertaintyReason'u, bet be sąrašo pasirinkimui.
  // Cache'inus tokį — vartotojas niekada nepamatys naujo bandymo. Skip'iname.
  if (confidence === 'medium' && (!result?.candidates || result.candidates.length === 0)) {
    console.log('[cache] skipping low-quality result (medium conf, empty candidates) —', query)
    return
  }

  const k = normalize(query)
  if (!k || k.length < 2) return
  const m = loadMap()
  m[k] = { result, at: Date.now() }

  // LRU-style trim — paliekam naujausius MAX_ENTRIES, dropinam senesnius
  const keys = Object.keys(m)
  if (keys.length > MAX_ENTRIES) {
    const sorted = keys.sort((a, b) => m[a].at - m[b].at)
    for (const old of sorted.slice(0, keys.length - MAX_ENTRIES)) delete m[old]
  }
  saveMap(m)
}

/**
 * Visiškai išvalo cache'ą. Naudojama kai admin'as edit'ina catalog'ą — kad
 * cache'as neslėptų atnaujintos info už senų AI atsakymų.
 */
export function bustSearchResponseCache() {
  try { localStorage.removeItem(KEY) } catch {}
}
