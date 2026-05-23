// Build Wikipedia LT extracts cache for curated-300 plants
//
// Purpose: Pre-fetch Wikipedia LT description'us + opening paragraphs
// curated-300 augalams, kad Phase 2 enrichment'as (Variant B save flow,
// ~/lapasid/api/save-plant.js) galėtų greitai gauti LT description'ą
// be runtime Wikipedia fetch'o (~2-3s per augalą).
//
// Source: ~/lapasid/data/curated-300.json (300 entries su latinName + ltName)
// Output: ~/lapasid/data/wiki-lt-cache.json
//
// Strategy:
//   1. Try LT name first (entry.ltName) — exact match against lt.wikipedia.org
//   2. Fallback to latin name (entry.latinName) jeigu LT name 404'ina
//   3. Mark found:false jeigu abu fail'ina
//
// Rate limit: 500ms polite delay (Wikipedia anonymous = ~50 req/s OK)
// User-Agent: PURE ASCII (em-dash sukelia ByteString convert error — patikrinta su PFAF)
// Incremental save: kas 25 entries (crash safety)

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CURATED = join(__dirname, '..', 'data', 'curated-300.json')
const OUT = join(__dirname, '..', 'data', 'wiki-lt-cache.json')

const USER_AGENT = 'geliu-db-wiki-lt-cache/1.0 (kestutis@okone.lt; one-time curated-300 cache build)'
const RATE_DELAY_MS = 500
const SAVE_EVERY = 25
const EXTRACT_MAX_CHARS = 500

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Normalize title for Wikipedia REST API:
// - trim
// - first letter uppercase
// - spaces → underscores
function normalizeTitle(raw) {
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const firstUpper = trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  return firstUpper.replace(/\s+/g, '_')
}

async function fetchWikiSummary(title, maxAttempts = 4) {
  const normalized = normalizeTitle(title)
  if (!normalized) return { status: 'invalid' }
  const url = `https://lt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(normalized)}`

  let backoff = 5000
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
        },
      })

      if (res.status === 404) {
        return { status: 'not_found' }
      }

      if (res.status === 429 || res.status === 503) {
        if (attempt === maxAttempts - 1) {
          return { status: 'error', error: `HTTP ${res.status} after ${maxAttempts} attempts` }
        }
        console.log(`    [retry] HTTP ${res.status}, backing off ${backoff}ms (attempt ${attempt + 1}/${maxAttempts})`)
        await sleep(backoff)
        backoff *= 2
        continue
      }

      if (!res.ok) {
        return { status: 'error', error: `HTTP ${res.status}` }
      }

      const data = await res.json()

      // Disambiguation or "no extract" guard
      if (data.type === 'disambiguation') {
        return { status: 'disambiguation', data }
      }

      return { status: 'ok', data }
    } catch (err) {
      if (attempt === maxAttempts - 1) {
        return { status: 'error', error: err?.message ?? String(err) }
      }
      console.log(`    [retry] fetch error: ${err?.message}, backing off ${backoff}ms`)
      await sleep(backoff)
      backoff *= 2
    }
  }
  return { status: 'error', error: 'exhausted retries' }
}

function buildEntryFromWiki(data, queried, matched) {
  const extract = typeof data.extract === 'string' ? data.extract : ''
  return {
    queried,
    matched,
    title: data.title ?? null,
    extract: extract.length > EXTRACT_MAX_CHARS ? extract.slice(0, EXTRACT_MAX_CHARS) + '...' : extract,
    thumbnail: data.thumbnail?.source ?? null,
    wikiUrl: data.content_urls?.desktop?.page ?? null,
    found: true,
  }
}

// ── Main ─────────────────────────────────────────────────────
console.log('[wiki-lt-cache] loading curated-300...')
const curated = JSON.parse(readFileSync(CURATED, 'utf-8'))
const entries = curated.entries
const latinKeys = Object.keys(entries)
console.log(`[wiki-lt-cache] total entries to process: ${latinKeys.length}`)

// Resume support: load existing cache if present
let cache = { generatedAt: null, totalEntries: latinKeys.length, totalFound: 0, entries: {} }
if (existsSync(OUT)) {
  try {
    const existing = JSON.parse(readFileSync(OUT, 'utf-8'))
    if (existing?.entries && typeof existing.entries === 'object') {
      cache.entries = existing.entries
      const resumeCount = Object.keys(cache.entries).length
      console.log(`[wiki-lt-cache] resuming — found ${resumeCount} existing entries`)
    }
  } catch {
    console.log('[wiki-lt-cache] existing cache unreadable, starting fresh')
  }
}

function saveCache() {
  cache.generatedAt = new Date().toISOString()
  cache.totalFound = Object.values(cache.entries).filter((e) => e.found).length
  writeFileSync(OUT, JSON.stringify(cache, null, 2), 'utf-8')
}

let processed = 0
let foundCount = 0
let notFoundCount = 0
let errorCount = 0
const startTs = Date.now()

for (const latinKey of latinKeys) {
  processed += 1

  // Skip if already cached (resume)
  if (cache.entries[latinKey]) {
    if (cache.entries[latinKey].found) foundCount += 1
    else notFoundCount += 1
    continue
  }

  const entry = entries[latinKey]
  const ltName = entry.ltName?.trim() || null
  const latinName = entry.latinName?.trim() || latinKey

  const queried = []
  let result = null
  let matched = null

  // 1) Try LT name first
  if (ltName) {
    queried.push(ltName)
    const r = await fetchWikiSummary(ltName)
    if (r.status === 'ok') {
      result = r
      matched = ltName
    } else if (r.status === 'disambiguation') {
      // disambiguation == not a clean hit; try latin fallback
      console.log(`  [${processed}/${latinKeys.length}] ${latinKey}: LT '${ltName}' disambiguation, falling back to latin`)
    } else if (r.status === 'error') {
      // hard error — record and skip latin fallback
      cache.entries[latinKey] = {
        queried,
        matched: null,
        found: false,
        error: r.error,
      }
      errorCount += 1
      console.log(`  [${processed}/${latinKeys.length}] ${latinKey}: ERROR (${r.error})`)
      await sleep(RATE_DELAY_MS)
      if (processed % SAVE_EVERY === 0) saveCache()
      continue
    }
  }

  // 2) Fallback to latin name if no result yet
  if (!result && latinName && latinName !== ltName) {
    queried.push(latinName)
    await sleep(RATE_DELAY_MS)
    const r = await fetchWikiSummary(latinName)
    if (r.status === 'ok') {
      result = r
      matched = latinName
    } else if (r.status === 'error') {
      cache.entries[latinKey] = {
        queried,
        matched: null,
        found: false,
        error: r.error,
      }
      errorCount += 1
      console.log(`  [${processed}/${latinKeys.length}] ${latinKey}: ERROR latin fallback (${r.error})`)
      await sleep(RATE_DELAY_MS)
      if (processed % SAVE_EVERY === 0) saveCache()
      continue
    }
  }

  if (result) {
    cache.entries[latinKey] = buildEntryFromWiki(result.data, queried, matched)
    foundCount += 1
    if (processed <= 10 || processed % 25 === 0) {
      console.log(`  [${processed}/${latinKeys.length}] ${latinKey}: OK (matched='${matched}', title='${cache.entries[latinKey].title}')`)
    }
  } else {
    cache.entries[latinKey] = {
      queried,
      matched: null,
      found: false,
    }
    notFoundCount += 1
    if (processed <= 10 || processed % 25 === 0) {
      console.log(`  [${processed}/${latinKeys.length}] ${latinKey}: NOT FOUND (tried: ${queried.join(', ')})`)
    }
  }

  await sleep(RATE_DELAY_MS)
  if (processed % SAVE_EVERY === 0) {
    saveCache()
    const elapsedMin = ((Date.now() - startTs) / 60000).toFixed(1)
    console.log(`  [save] checkpoint — found=${foundCount}, notFound=${notFoundCount}, errors=${errorCount}, elapsed=${elapsedMin}min`)
  }
}

// Final save
saveCache()

// ── Final report ─────────────────────────────────────────────
const elapsedMin = ((Date.now() - startTs) / 60000).toFixed(1)
console.log('')
console.log('=== Wikipedia LT Cache Build Report ===')
console.log(`Total entries:  ${cache.totalEntries}`)
console.log(`Found:          ${cache.totalFound}`)
console.log(`Not found:      ${notFoundCount}`)
console.log(`Errors:         ${errorCount}`)
console.log(`Elapsed:        ${elapsedMin} min`)
console.log(`Output:         ${OUT}`)
console.log('')

// Sample matched (first 10 found)
const matchedSamples = Object.entries(cache.entries)
  .filter(([, v]) => v.found)
  .slice(0, 10)
  .map(([k, v]) => `  ${k}  →  ${v.title}  (via '${v.matched}')`)
console.log('Sample matched (first 10 found):')
console.log(matchedSamples.join('\n'))
console.log('')

// Sample missing (first 20 not found)
const missingSamples = Object.entries(cache.entries)
  .filter(([, v]) => !v.found)
  .slice(0, 20)
  .map(([k, v]) => `  ${k}  (tried: ${(v.queried ?? []).join(', ')})`)
console.log('Sample missing (first 20):')
console.log(missingSamples.join('\n'))
