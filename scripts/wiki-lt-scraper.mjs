// Wikipedia LT batch scraper — randa LT names visiems pre-DB gentyms.
//
// Naudoja Wikipedia MediaWiki API:
//   https://lt.wikipedia.org/w/api.php?action=query&titles=A|B|C&redirects=1
//
// Batching: iki 50 titles per request (API limit). 1676 gentys / 50 = ~34 requests.
// Su 1s rate limit between batches ≈ 35 sekundžių pilnam scan'ui.
//
// Įvestis: data/pre-db.json (gentys iš `genera` map)
// Išvestis: data/lt-names-wiki.json
//
// Resumable: jei jau yra output failas, įkrauna ir tęsia trūkstamus.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname  = dirname(fileURLToPath(import.meta.url))
const PRE_DB     = join(__dirname, '..', 'data', 'pre-db.json')
const OUTPUT     = join(__dirname, '..', 'data', 'lt-names-wiki.json')

const USER_AGENT = 'geliu-db-pre-db-builder/1.0 (kestutis@okone.lt; one-time research scrape)'
const API_URL    = 'https://lt.wikipedia.org/w/api.php'
const BATCH_SIZE = 50
const RATE_DELAY_MS = 1000

// ── Convert ALL-CAPS genus → ProperCase (Wikipedia uses proper case) ──
function properCase(g) {
  return g.charAt(0).toUpperCase() + g.slice(1).toLowerCase()
}

// ── Load pre-DB genera ────────────────────────────────────────
const preDb = JSON.parse(readFileSync(PRE_DB, 'utf-8'))
const allGenera = Object.keys(preDb.genera).map(properCase)
console.log(`[wiki-lt] pre-DB has ${allGenera.length} unique genera`)

// ── Load existing output (for resume) ─────────────────────────
let results = {}
if (existsSync(OUTPUT)) {
  const existing = JSON.parse(readFileSync(OUTPUT, 'utf-8'))
  results = existing.results ?? {}
  console.log(`[wiki-lt] resuming — ${Object.keys(results).length} genera already done`)
}

// Filter to only NOT-YET-DONE
const pending = allGenera.filter(g => !(g in results))
console.log(`[wiki-lt] pending: ${pending.length} genera`)

if (pending.length === 0) {
  console.log('[wiki-lt] nothing to do — all genera already queried')
  process.exit(0)
}

// ── Batch query Wikipedia ─────────────────────────────────────

/**
 * Query Wikipedia LT API for up to 50 titles. Returns map: title → result.
 *
 * Result shape:
 *   { exists, ltName, redirectedFrom, fullUrl, categories, wikidataId, missing }
 */
async function queryBatch(titles) {
  const params = new URLSearchParams({
    action:     'query',
    format:     'json',
    titles:     titles.join('|'),
    redirects:  '1',
    prop:       'info|categories|pageprops',
    inprop:     'url',
    cllimit:    'max',
    ppprop:     'wikibase_item',
  })

  const url = `${API_URL}?${params}`
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()

  // Build redirect map: original → final title
  const redirectMap = new Map()
  if (json.query.redirects) {
    for (const r of json.query.redirects) {
      redirectMap.set(r.from, r.to)
    }
  }
  // Normalized titles map (e.g. case normalization)
  const normalizedMap = new Map()
  if (json.query.normalized) {
    for (const n of json.query.normalized) {
      normalizedMap.set(n.from, n.to)
    }
  }

  // Build title → page-data map
  const titleToPage = new Map()
  for (const page of Object.values(json.query.pages)) {
    titleToPage.set(page.title, page)
  }

  // For each requested title, find its result
  const out = {}
  for (const title of titles) {
    // Apply normalization → redirect chain
    let finalTitle = normalizedMap.get(title) ?? title
    while (redirectMap.has(finalTitle)) {
      finalTitle = redirectMap.get(finalTitle)
    }

    const page = titleToPage.get(finalTitle)
    if (!page || 'missing' in page) {
      out[title] = { exists: false, queried: title }
    } else {
      out[title] = {
        exists: true,
        queried: title,
        ltName: page.title,
        redirectedFrom: finalTitle !== title ? title : null,
        fullUrl: page.fullurl,
        categories: (page.categories ?? []).map(c => c.title),
        wikidataId: page.pageprops?.wikibase_item ?? null,
      }
    }
  }
  return out
}

// ── Main loop ─────────────────────────────────────────────────

const SAVE_EVERY = 5 // save after every N batches (resilient to crashes)
let batchIdx = 0
const startTime = Date.now()

for (let i = 0; i < pending.length; i += BATCH_SIZE) {
  const batch = pending.slice(i, i + BATCH_SIZE)
  batchIdx++

  try {
    const batchResults = await queryBatch(batch)
    Object.assign(results, batchResults)

    const found = batch.filter(t => batchResults[t]?.exists).length
    const pct = ((Object.keys(results).length / allGenera.length) * 100).toFixed(1)
    console.log(`[wiki-lt] batch ${batchIdx}/${Math.ceil(pending.length / BATCH_SIZE)}: ${found}/${batch.length} found (total: ${Object.keys(results).length}/${allGenera.length}, ${pct}%)`)
  } catch (e) {
    console.error(`[wiki-lt] batch ${batchIdx} failed:`, e.message)
    // Mark batch as errored (will retry next run)
    for (const t of batch) {
      if (!(t in results)) results[t] = { exists: false, queried: t, error: e.message }
    }
  }

  // Save periodically
  if (batchIdx % SAVE_EVERY === 0) {
    writeFileSync(OUTPUT, JSON.stringify(buildOutput(), null, 2))
  }

  // Rate limit
  if (i + BATCH_SIZE < pending.length) {
    await new Promise(r => setTimeout(r, RATE_DELAY_MS))
  }
}

// Final save
writeFileSync(OUTPUT, JSON.stringify(buildOutput(), null, 2))

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
console.log(`[wiki-lt] done in ${elapsed}s — wrote ${OUTPUT}`)

// ── Stats ─────────────────────────────────────────────────────

const total       = Object.keys(results).length
const found       = Object.values(results).filter(r => r.exists).length
const redirected  = Object.values(results).filter(r => r.exists && r.redirectedFrom).length
const withWikidata = Object.values(results).filter(r => r.exists && r.wikidataId).length

console.log()
console.log('=== WIKIPEDIA LT COVERAGE ===')
console.log(`Total queried:    ${total}`)
console.log(`Has LT page:      ${found} (${(found/total*100).toFixed(1)}%)`)
console.log(`Redirected:       ${redirected} (Latin→LT name)`)
console.log(`With Wikidata Q:  ${withWikidata}`)

// Sample matches
const sampleMatches = Object.values(results)
  .filter(r => r.exists && r.redirectedFrom)
  .slice(0, 15)
console.log('\nSample Latin → LT redirects:')
sampleMatches.forEach(r => console.log(`  ${r.redirectedFrom.padEnd(20)} → ${r.ltName}`))

// Sample misses
const sampleMisses = Object.entries(results)
  .filter(([, r]) => !r.exists)
  .slice(0, 10)
  .map(([k]) => k)
console.log('\nSample misses (no LT page):')
sampleMisses.forEach(g => console.log(`  ❌ ${g}`))

// ── Output structure ──────────────────────────────────────────

function buildOutput() {
  return {
    generatedAt: new Date().toISOString(),
    source: 'Wikipedia LT API (lt.wikipedia.org/w/api.php)',
    totalQueried: Object.keys(results).length,
    totalFound: Object.values(results).filter(r => r.exists).length,
    results,
  }
}
