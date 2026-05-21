// gaspadorius.lt DETAIL scraper — fetches plant article pages to extract
// Latin name from article body.
//
// LEGAL: robots.txt Crawl-delay 10s. STRICTLY respected (we use 11s).
// EXTRACT ONLY:
//   - Latin name from <em>...</em> tags in article body
//   - Latin synonyms (when "sin. <em>X</em>" pattern present)
//   - Article URL (for attribution)
// NO body text. NO care info. NO images.
//
// Input:  data/gaspadorius-names.json (entries from catalog)
// Output: data/gaspadorius-detail.json (entries with Latin name resolved)
//
// Idempotent + resumable: skips already-fetched URLs.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname    = dirname(fileURLToPath(import.meta.url))
const CATALOG_PATH = join(__dirname, '..', 'data', 'gaspadorius-names.json')
const OUTPUT       = join(__dirname, '..', 'data', 'gaspadorius-detail.json')

const USER_AGENT = 'geliu-db-pre-db-builder/1.0 (kestutis@okone.lt; LT plant name index only - no content stored)'
const RATE_DELAY_MS = 11000 // robots.txt: Crawl-delay 10, add 1s buffer
const SAVE_EVERY = 5

async function fetchUrl(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

// ── Extract Latin name from article HTML ──────────────────────
//
// Patterns seen:
//   1. <p>Plant_LT (<em>Latin genus</em>) ...
//   2. <p>Plant_LT (<em>Latin genus species</em>) ...
//   3. <em>Latin1</em>, sin. <em>Latin2</em>     ← synonyms
//   4. Latin1 (sin. Latin2)
//
// Strategy: find FIRST few <em>...</em> in body, filter to Latin-looking
// (Capitalized first letter, looks like binomial).

function extractLatinFromArticle(html) {
  // Get article body
  let body = html
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
  if (articleMatch) body = articleMatch[1]

  // Strip ALL HTML tags from body, keep text
  const text = body
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8216;|&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/\s+/g, ' ')

  // gaspadorius.lt convention: article body starts with `LT_name (Latin)` near top.
  // E.g. "Adijantas Adijantas Leave a Comment / By Jonas Gilys / 2011/02/21 Adijantas (Adiantum) Visos..."
  //
  // Look for first `(Capitalized_Word)` or `(Capitalized_word species)` in first 1500 chars.
  // Latin word = 4+ chars, starts with capital, only ASCII letters.
  const head = text.slice(0, 1500)

  // Pattern: "(Latin)" — Latin is genus or genus+species or with var./subsp.
  const latinParensRe = /\(([A-Z][a-z]{3,}(?:\s+[a-z][a-z-]+)?(?:\s+(?:var|subsp|f|x)\.?\s+[a-z][a-z-]+)?)\)/g
  const candidates = []

  // Words that LOOK Latin-ish (capitalized, Latin letters) but are actually
  // Lithuanian common nouns appearing in article-body parens.
  const LT_FALSE_POSITIVES = new Set([
    // Article section headers (auto-capitalized)
    'Poreikiai', 'Auginimas', 'Sprendimai', 'Priežiūra', 'Sodinimas',
    'Dauginimas', 'Tręšimas', 'Laistymas', 'Persodinimas',
    'Sodininkystės', 'Augalas', 'Augalai', 'Augintojui', 'Augalų',
    'Pasaulyje', 'Lietuvoje',
    // Months / dates
    'Lietuvos', 'Pasaulio', 'Žemaičių', 'Vasario', 'Liepos', 'Kovo',
    'Sausio', 'Rugsejo', 'Spalio', 'Gegužės', 'Birželio', 'Rugpjūčio',
    'Lapkričio', 'Gruodžio',
    // Common English/colloq false positives
    'Coral', 'Money', 'Silver', 'Golden', 'Tree', 'Indoor',
  ])

  for (const m of head.matchAll(latinParensRe)) {
    const latin = m[1].trim()
    // Skip family names
    if (/aceae$/i.test(latin)) continue
    const firstWord = latin.split(/\s+/)[0]
    if (LT_FALSE_POSITIVES.has(firstWord)) continue
    // Reject if contains Lithuanian-specific diacritics (not Latin letters)
    if (/[ąęįųėčšž]/i.test(latin)) continue
    candidates.push({
      full: latin,
      genus: firstWord,
      species: latin.split(/\s+/)[1] ?? null,
    })
  }

  // Also collect synonyms from "sin. <Latin>" or italic em tags throughout body
  const emRe = /<em>([A-Z][a-z]+(?:\s+[a-z][a-z-]+)?)<\/em>/g
  for (const m of html.matchAll(emRe)) {
    const latin = m[1].trim()
    if (/aceae$/i.test(latin)) continue
    candidates.push({
      full: latin,
      genus: latin.split(/\s+/)[0],
      species: latin.split(/\s+/)[1] ?? null,
    })
  }

  if (candidates.length === 0) return null

  // Primary = first parens match. Synonyms = others (deduped).
  const primary = candidates[0]
  const synonyms = []
  const seen = new Set([primary.full.toLowerCase()])
  for (const c of candidates.slice(1, 8)) {
    if (!seen.has(c.full.toLowerCase())) {
      synonyms.push(c.full)
      seen.add(c.full.toLowerCase())
    }
  }

  return {
    latin: primary.full,
    latinGenus: primary.genus,
    latinSpecies: primary.species,
    latinSynonyms: synonyms,
  }
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  // Load catalog
  if (!existsSync(CATALOG_PATH)) {
    throw new Error('Run gaspadorius-scraper.mjs first to get catalog entries')
  }
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf-8'))
  console.log(`[gasp-detail] catalog has ${catalog.entries.length} entries`)

  // Load existing detail data (for resume)
  let existing = { results: {} }
  if (existsSync(OUTPUT)) {
    existing = JSON.parse(readFileSync(OUTPUT, 'utf-8'))
    console.log(`[gasp-detail] resuming — ${Object.keys(existing.results).length} already fetched`)
  }

  // Pending = entries not yet fetched
  const pending = catalog.entries.filter(e => !(e.sourceUrl in existing.results))
  console.log(`[gasp-detail] pending: ${pending.length} (estimated ${Math.ceil(pending.length * RATE_DELAY_MS / 1000 / 60)} min at ${RATE_DELAY_MS}ms rate)`)

  let idx = 0
  let withLatin = 0
  for (const entry of pending) {
    idx++
    try {
      const html = await fetchUrl(entry.sourceUrl)
      const latinData = extractLatinFromArticle(html)
      existing.results[entry.sourceUrl] = {
        ...entry,
        ...(latinData || {}),
        extracted: !!latinData,
        scrapedAt: new Date().toISOString(),
      }
      if (latinData) {
        withLatin++
        if (idx % 5 === 0 || withLatin <= 10) {
          console.log(`[gasp-detail] ${idx}/${pending.length} ${entry.ltName.padEnd(30)} → ${latinData.latin}${latinData.latinSynonyms.length ? ' (syn: ' + latinData.latinSynonyms.join(', ') + ')' : ''}`)
        }
      } else {
        if (idx % 10 === 0) {
          console.log(`[gasp-detail] ${idx}/${pending.length} (no Latin) ${entry.ltName}`)
        }
      }
    } catch (e) {
      console.warn(`[gasp-detail] FAIL ${entry.sourceUrl}: ${e.message}`)
      existing.results[entry.sourceUrl] = { ...entry, error: e.message }
    }

    if (idx % SAVE_EVERY === 0) {
      writeFileSync(OUTPUT, JSON.stringify({ results: existing.results }, null, 2))
    }

    if (idx < pending.length) {
      await new Promise(r => setTimeout(r, RATE_DELAY_MS))
    }
  }

  // Final stats
  const all = Object.values(existing.results)
  const success = all.filter(r => r.extracted).length
  const noLatin = all.filter(r => !r.extracted && !r.error).length
  const errors  = all.filter(r => r.error).length

  console.log()
  console.log('=== GASPADORIUS DETAIL RESULTS ===')
  console.log(`Total processed:    ${all.length}`)
  console.log(`  With Latin:       ${success} (${(success/all.length*100).toFixed(1)}%)`)
  console.log(`  No Latin found:   ${noLatin}`)
  console.log(`  Errors:           ${errors}`)

  // Final output
  const finalOut = {
    generatedAt: new Date().toISOString(),
    source: 'gaspadorius.lt — augalų katalogai (detail page Latin extraction)',
    totalProcessed: all.length,
    withLatin: success,
    pairs: all.filter(r => r.extracted).map(r => ({
      ltName: r.ltName,
      ltSynonyms: r.ltSynonyms ?? [],
      latin: r.latin,
      latinGenus: r.latinGenus,
      latinSpecies: r.latinSpecies,
      latinSynonyms: r.latinSynonyms ?? [],
      sourceUrl: r.sourceUrl,
      catalog: r.catalog,
    })),
    results: existing.results,
  }
  writeFileSync(OUTPUT, JSON.stringify(finalOut, null, 2))
  console.log(`\n[gasp-detail] wrote ${OUTPUT}`)
}

main().catch(e => {
  console.error('[gasp-detail] FATAL:', e)
  process.exit(1)
})
