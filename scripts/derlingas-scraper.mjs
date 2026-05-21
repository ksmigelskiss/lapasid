// derlingas.lt scraper — randa LT/Latin name pairs iš augalų straipsnių.
//
// Šaltinis: https://derlingas.lt (Lithuanian gardening website)
// Robots.txt allows all except /wp-admin/.
//
// Sitemap'as turi ~2000 įrašų, iš jų ~700 plant-related (kategorijos: geles,
// kambarines-geles, medziai, krumai, prieskoniai-ir-vaistazoles, uogos,
// vaisiai). Kiekviename straipsnyje vidutiniškai 5-40 LT/Latin name pairs
// formatu "ltname (<em>Latin</em>)".
//
// Įvestis: nothing (fetches sitemap)
// Išvestis: data/derlingas-pairs.json
//
// Idempotent + resumable: skip'ina jau scrape'intus URL.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT    = join(__dirname, '..', 'data', 'derlingas-pairs.json')

const SITEMAP_URLS = [
  'https://derlingas.lt/post-sitemap.xml',
  'https://derlingas.lt/post-sitemap2.xml',
]
// Focus on houseplant + flower categories (most relevant for indoor app).
// Other categories (medziai, krumai, darzoves) cover outdoor garden — can be
// added later if needed but blow up scrape time.
const PLANT_CATEGORIES = ['kambarines-geles', 'geles']
const USER_AGENT = 'geliu-db-pre-db-builder/1.0 (kestutis@okone.lt; one-time research scrape; respectful rate limit)'
const RATE_DELAY_MS = 2500 // be POLITE: 2.5s between requests = ~24/min (was 1.5s, server rate-limited)
const SAVE_EVERY = 10

// ── Helpers: HTTPS fetch w/ self-signed cert ignore ───────────
import https from 'node:https'

function fetchUrlOnce(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      rejectUnauthorized: false,
    }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        if (res.statusCode !== 200) {
          const err = new Error(`HTTP ${res.statusCode}`)
          err.statusCode = res.statusCode
          reject(err)
        } else {
          resolve(data)
        }
      })
    }).on('error', reject)
  })
}

// Fetch with retry on rate-limit-like errors (429, 503, network errors).
// Exponential backoff: 5s → 15s → 45s. Throws after final attempt.
async function fetchUrl(url, maxAttempts = 4) {
  let lastErr
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fetchUrlOnce(url)
    } catch (e) {
      lastErr = e
      const isRetryable = e.statusCode === 429 || e.statusCode === 503 ||
                          e.statusCode === 504 || e.statusCode === 502 ||
                          e.code === 'ETIMEDOUT' || e.code === 'ECONNRESET'
      if (!isRetryable || attempt === maxAttempts - 1) throw e
      const backoffMs = 5000 * Math.pow(3, attempt) // 5s, 15s, 45s
      console.warn(`[derlingas]   retry ${attempt + 1}/${maxAttempts} after ${backoffMs / 1000}s (${e.message})`)
      await new Promise(r => setTimeout(r, backoffMs))
    }
  }
  throw lastErr
}

// ── Step 1: Collect all plant-related URLs from sitemap ──────

async function collectUrls() {
  const allUrls = []
  for (const sm of SITEMAP_URLS) {
    console.log(`[derlingas] fetching sitemap ${sm}`)
    const xml = await fetchUrl(sm)
    const urls = [...xml.matchAll(/<loc><!\[CDATA\[([^\]]+)\]\]><\/loc>/g)].map(m => m[1])
    allUrls.push(...urls)
  }
  // Filter to plant categories
  const plantUrls = allUrls.filter(url => {
    return PLANT_CATEGORIES.some(cat =>
      url.startsWith(`https://derlingas.lt/${cat}/`)
    )
  })
  console.log(`[derlingas] total URLs: ${allUrls.length}, plant URLs: ${plantUrls.length}`)
  return plantUrls
}

// ── Step 2: Extract LT/Latin pairs from a single page ─────────

const FILLER_WORDS = new Set([
  'yra', 'tokie', 'kaip', 'tai', 'kuriems', 'priklauso', 'galima',
  'nepabijoti', 'auginti', 'lauke', 'kur', 'puikiai', 'žinomas',
  'gėrimas', 'sukulentai', 'kai', 'kurios', 'arba', 'dažniausiai',
  'auginami', 'gausu', 'iš', 'taip', 'pat', 'visa', 'ši', 'šis',
  'gerai', 'pažįstami', 'įdomių', 'augalų', 'lietuvoje', 'pavyzdžiui',
  'tokia', 'tokios', 'šios', 'šio', 'tarp', 'jų', 'kiti', 'kitos',
  'rūšys', 'rūšis', 'tos', 'ta', 'tas', 'pvz', 'pavyzdžiui',
  'augalas', 'gėlė', 'medis', 'krūmas', 'žolė', 'gentis', 'šeimos',
])

function extractPairs(html) {
  // Strip HTML except <em>/<i> tags (which wrap Latin names — some posts use <i>)
  let clean = html.replace(/<(?!\/?(em|i)\b)[^>]+>/g, ' ')
  // Normalize <i> → <em> for unified regex
  clean = clean.replace(/<\/?i>/g, m => m === '<i>' ? '<em>' : '</em>')
  clean = clean.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  clean = clean.replace(/\s+/g, ' ')

  // Match: <up_to_50_chars_of_lt_text> (<em>Latin</em>)
  // Latin = Capitalized word, optionally with species name (lowercase second word)
  const re = /([A-Za-ząęįųūėčšžŠŽČĖĮŪĄ ]{3,50}?)\s*\(<em>([A-Z][a-zA-Z]+(?:\s+[a-z][a-z-]+)?)<\/em>\)/g
  const matches = [...clean.matchAll(re)]

  const pairs = []
  for (const m of matches) {
    const ltRaw = m[1].trim().replace(/^[,.;:\-–—\s]+|[,.;:\-–—\s]+$/g, '')
    const latin = m[2].trim()

    // Handle "A arba B" → split into both
    const parts = ltRaw.split(/\s+arba\s+/i)
    for (const part of parts) {
      let words = part.split(/\s+/)

      // Drop leading filler words
      while (words.length > 0 && FILLER_WORDS.has(words[0].toLowerCase())) {
        words.shift()
      }
      // Drop trailing filler words
      while (words.length > 0 && FILLER_WORDS.has(words[words.length - 1].toLowerCase())) {
        words.pop()
      }
      // Keep last 1-3 words (LT genus or genus+adjective for species)
      if (words.length > 3) words = words.slice(-3)
      if (words.length === 0) continue

      const lt = words.join(' ')
      if (lt.length < 4 || lt.length > 50) continue
      // Must contain a LT word (4+ lowercase chars OR diacritic)
      if (!/[ąęįųūėčšž]|[a-z]{4,}/.test(lt)) continue
      // Reject if mostly uppercase (probably a heading fragment)
      const upperRatio = (lt.match(/[A-Z]/g) || []).length / lt.length
      if (upperRatio > 0.4) continue

      pairs.push({ lt, latin })
    }
  }

  // Dedup within page
  const seen = new Set()
  return pairs.filter(p => {
    const key = `${p.lt.toLowerCase()}|${p.latin.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ── Step 3: Main loop ─────────────────────────────────────────

async function main() {
  // Load existing output for resume
  let existing = { generatedAt: null, pages: {} }
  if (existsSync(OUTPUT)) {
    existing = JSON.parse(readFileSync(OUTPUT, 'utf-8'))
    console.log(`[derlingas] resuming — ${Object.keys(existing.pages).length} pages already scraped`)
  }

  const urls = await collectUrls()
  const pendingUrls = urls.filter(u => !(u in existing.pages))
  console.log(`[derlingas] ${pendingUrls.length} pages to scrape (${RATE_DELAY_MS}ms delay)`)

  if (pendingUrls.length === 0) {
    console.log('[derlingas] nothing to do')
    return finalize(existing)
  }

  console.log(`[derlingas] estimated time: ${Math.ceil(pendingUrls.length * RATE_DELAY_MS / 1000 / 60)} min`)

  let idx = 0
  for (const url of pendingUrls) {
    idx++
    try {
      const html = await fetchUrl(url)
      const pairs = extractPairs(html)
      existing.pages[url] = { pairs, count: pairs.length, scrapedAt: new Date().toISOString() }

      if (idx % 5 === 0 || pairs.length > 10) {
        const totalPairs = Object.values(existing.pages).reduce((s, p) => s + p.count, 0)
        console.log(`[derlingas] ${idx}/${pendingUrls.length} (${pairs.length} pairs, total: ${totalPairs}) ${url.split('/').pop()}`)
      }
    } catch (e) {
      console.warn(`[derlingas] FAIL ${url}: ${e.message}`)
      existing.pages[url] = { error: e.message, scrapedAt: new Date().toISOString() }
    }

    // Save periodically
    if (idx % SAVE_EVERY === 0) {
      writeFileSync(OUTPUT, JSON.stringify(existing, null, 2))
    }

    // Rate limit
    if (idx < pendingUrls.length) {
      await new Promise(r => setTimeout(r, RATE_DELAY_MS))
    }
  }

  return finalize(existing)
}

function finalize(data) {
  // Build flat unique-pairs registry
  const pairCounts = new Map() // "lt|latin" → {lt, latin, occurrences, sources[]}
  for (const [url, page] of Object.entries(data.pages)) {
    if (page.error) continue
    for (const { lt, latin } of (page.pairs ?? [])) {
      const key = `${lt.toLowerCase()}|${latin.toLowerCase()}`
      if (!pairCounts.has(key)) {
        pairCounts.set(key, { lt, latin, occurrences: 0, sourceUrls: [] })
      }
      const entry = pairCounts.get(key)
      entry.occurrences++
      if (!entry.sourceUrls.includes(url)) entry.sourceUrls.push(url)
    }
  }

  const allPairs = [...pairCounts.values()].sort((a, b) => b.occurrences - a.occurrences)

  const successPages = Object.values(data.pages).filter(p => !p.error).length
  const errorPages   = Object.values(data.pages).filter(p => p.error).length

  console.log()
  console.log('=== DERLINGAS.LT SCRAPER RESULTS ===')
  console.log(`Pages scraped:    ${Object.keys(data.pages).length}`)
  console.log(`  Successful:     ${successPages}`)
  console.log(`  Errors:         ${errorPages}`)
  console.log(`Unique pairs:     ${allPairs.length}`)
  console.log(`Avg pairs/page:   ${(allPairs.reduce((s, p) => s + p.occurrences, 0) / Math.max(successPages, 1)).toFixed(1)}`)
  console.log()
  console.log('Top 20 most-occurring pairs:')
  allPairs.slice(0, 20).forEach(p =>
    console.log(`  ${p.lt.padEnd(25)} | ${p.latin.padEnd(25)} (${p.occurrences}×)`)
  )

  const output = {
    generatedAt: new Date().toISOString(),
    source: 'derlingas.lt',
    pagesScraped: Object.keys(data.pages).length,
    uniquePairs: allPairs.length,
    pages: data.pages,
    pairs: allPairs,
  }
  writeFileSync(OUTPUT, JSON.stringify(output, null, 2))
  console.log(`\n[derlingas] wrote ${OUTPUT}`)
}

main().catch(e => {
  console.error('[derlingas] FATAL:', e)
  process.exit(1)
})
