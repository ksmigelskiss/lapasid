/**
 * Stage 1.5 — Wikipedia gap-fill (progressive enhancement after Stage 1).
 *
 * AFTER Stage 1 returns slim result iš pre-DB, this runs in background to
 * fill remaining gaps via Wikipedia. Updates UI progressively.
 *
 * KEY DESIGN:
 *   - NO AI hallucination (Wiki is direct quote with attribution)
 *   - Cached results write back (Firestore later, localStorage now)
 *   - Stage 2 LATER uses cached Wiki data as additional RAG context
 *
 * USAGE:
 *   import { augmentStage1WithWiki } from './searchStage1Augment'
 *
 *   const slim = await searchStage1(query)
 *   if (slim.found) {
 *     // Show slim immediately, augment in background
 *     augmentStage1WithWiki(slim).then(augmented => {
 *       updateUI(augmented)  // progressive enhancement
 *     })
 *   }
 *
 * RESPONSE: {
 *   ...originalSlim,
 *   wikiDescription: "Pilea peperomioides – daugiametis žolinis...",
 *   wikiUrl: "https://lt.wikipedia.org/...",
 *   wikiHistory: "Atvežė Espegren 1946 m...",
 *   sources: {
 *     ...originalSlim.sources,
 *     description: 'wiki-lt'  // or 'wiki-en+ai-translate'
 *   }
 * }
 */

import { fetchWikiExtract } from './wikiApi.js'

// Lazy load cache from localStorage (browser only)
const WIKI_CACHE_KEY = 'plant_wiki_cache_v1'
const WIKI_CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days

function loadWikiCache() {
  if (typeof localStorage === 'undefined') return new Map()
  try {
    const raw = localStorage.getItem(WIKI_CACHE_KEY)
    if (!raw) return new Map()
    const parsed = JSON.parse(raw)
    // Filter expired entries
    const now = Date.now()
    const fresh = Object.entries(parsed)
      .filter(([, v]) => v.ts && (now - v.ts) < WIKI_CACHE_TTL)
    return new Map(fresh)
  } catch {
    return new Map()
  }
}

function saveWikiCache(cache) {
  if (typeof localStorage === 'undefined') return
  try {
    const obj = Object.fromEntries(cache.entries())
    localStorage.setItem(WIKI_CACHE_KEY, JSON.stringify(obj))
  } catch {
    // localStorage full — silent fail
  }
}

// ── Wikipedia API ─────────────────────────────────────────────
// Vienetinis impl'as wikiApi.js'e — su User-Agent, anti-phantom filter.
// Vietinės wrapper funkcijos paliktos minimalios — tik shape adaptacija
// senesnio kodo callee'iams.

async function fetchWikiLt(latinName) {
  const r = await fetchWikiExtract(latinName, 'lt')
  return r.found ? { title: r.title, extract: r.extract, url: r.url, pageid: r.pageid } : null
}

async function fetchWikiEn(latinName) {
  const r = await fetchWikiExtract(latinName, 'en')
  return r.found ? { title: r.title, extract: r.extract, url: r.url, pageid: r.pageid } : null
}

// ── Main augmenter ────────────────────────────────────────────

/**
 * Augment Stage 1 slim result with Wikipedia data.
 *
 * Strategy:
 *   1. Check localStorage cache (instant if hit)
 *   2. Fetch LT + EN Wiki in parallel
 *   3. Choose best extract (LT preferred, EN fallback)
 *   4. Cache result
 *   5. Return augmented slim
 *
 * Does NOT call AI — pure Wikipedia data.
 *
 * @param {object} stage1Result
 * @param {object} options
 * @param {boolean} options.skipCache — force fresh fetch
 * @returns {Promise<object>} augmented slim result
 */
export async function augmentStage1WithWiki(stage1Result, options = {}) {
  if (!stage1Result?.found || !stage1Result.latin) {
    return stage1Result
  }

  const startTime = Date.now()
  const cacheKey = stage1Result.latin.toLowerCase()

  // 1. Cache check
  if (!options.skipCache) {
    const cache = loadWikiCache()
    if (cache.has(cacheKey)) {
      return mergeWikiIntoSlim(stage1Result, cache.get(cacheKey), { fromCache: true, elapsedMs: 0 })
    }
  }

  // 2. Parallel fetch
  const [wikiLt, wikiEn] = await Promise.all([
    fetchWikiLt(stage1Result.latin),
    fetchWikiEn(stage1Result.latin),
  ])

  // 3. Choose best content
  const augmentData = {
    wikiLt: wikiLt ? {
      title: wikiLt.title,
      extract: wikiLt.extract.slice(0, 800),
      url: wikiLt.url,
    } : null,
    wikiEn: wikiEn ? {
      title: wikiEn.title,
      extract: wikiEn.extract.slice(0, 800),
      url: wikiEn.url,
    } : null,
    ts: Date.now(),
  }

  // 4. Cache
  const cache = loadWikiCache()
  cache.set(cacheKey, augmentData)
  saveWikiCache(cache)

  // 5. Merge into slim
  return mergeWikiIntoSlim(stage1Result, augmentData, {
    fromCache: false,
    elapsedMs: Date.now() - startTime,
  })
}

function mergeWikiIntoSlim(slim, wikiData, meta) {
  const augmented = { ...slim }
  augmented.augmented = true
  augmented.augmentMs = meta.elapsedMs
  augmented.augmentFromCache = meta.fromCache

  // Choose description source — LT preferred for native display
  if (wikiData.wikiLt) {
    augmented.wikiDescription = wikiData.wikiLt.extract
    augmented.wikiDescriptionLang = 'lt'
    augmented.wikiUrl = wikiData.wikiLt.url
    augmented.sources = { ...augmented.sources, wikiDescription: 'wiki-lt' }
  } else if (wikiData.wikiEn) {
    augmented.wikiDescription = wikiData.wikiEn.extract
    augmented.wikiDescriptionLang = 'en'  // needs AI translation for display (Stage 2 will do)
    augmented.wikiUrl = wikiData.wikiEn.url
    augmented.sources = { ...augmented.sources, wikiDescription: 'wiki-en (needs translation)' }
  }

  // Preserve raw for Stage 2 RAG context
  augmented.wikiCachedData = wikiData

  return augmented
}

/**
 * Pre-warm cache for a list of Latin names (background prefetch).
 * Useful for "favorites" or "recently searched" lists.
 */
export async function prewarmWikiCache(latinNames, options = {}) {
  const { concurrency = 3, rateMs = 200 } = options
  const queue = [...latinNames]
  const results = []

  while (queue.length > 0) {
    const batch = queue.splice(0, concurrency)
    const batchResults = await Promise.all(
      batch.map(latin => augmentStage1WithWiki({ found: true, latin }))
    )
    results.push(...batchResults)
    if (queue.length > 0) await new Promise(r => setTimeout(r, rateMs))
  }
  return results
}

/**
 * Clear Wikipedia cache (debug/admin).
 */
export function clearWikiCache() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(WIKI_CACHE_KEY)
  }
}
