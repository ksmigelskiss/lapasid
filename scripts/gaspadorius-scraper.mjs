// gaspadorius.lt scraper — naudoja 5 catalog pages + targeted detail fetches.
//
// LEGAL: robots.txt Crawl-delay: 10s. RESPECT IT. Catalog pages — light load
// (5 fetches). Detail pages — only for our Tier 1 missing plants.
//
// Output: data/gaspadorius-names.json
//   pairs: [{ ltName, latinGuess, sourceUrl, catalog }]
//
// Strategy:
//   Step 1: Fetch 5 catalog pages → extract <a href="...slug...">LT Name</a> pairs
//   Step 2: For each entry, GUESS Latin from slug OR fetch detail page (rate-limited)
//
// First pass: just catalogs (gives us ~200-500 LT names + URL slugs).

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT    = join(__dirname, '..', 'data', 'gaspadorius-names.json')

const USER_AGENT = 'geliu-db-pre-db-builder/1.0 (kestutis@okone.lt; LT plant name index only - no content stored)'
const RATE_DELAY_MS = 11000 // robots.txt says Crawl-delay: 10, add 1s buffer

const CATALOGS = [
  { name: 'geles-A-K',     url: 'https://www.gaspadorius.lt/geles-namams-ir-biurui-1-dalis' },
  { name: 'geles-L-Z',     url: 'https://www.gaspadorius.lt/geles-namams-ir-biurui-2-dalis' },
  { name: 'darzoves',      url: 'https://www.gaspadorius.lt/darzoves-sode' },
  { name: 'prieskoniai',   url: 'https://www.gaspadorius.lt/prieskonines-darzoves' },
  { name: 'vaistiniai',    url: 'https://www.gaspadorius.lt/vaistiniai-augalai' },
]

async function fetchUrl(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

// Extract plant entries from a catalog page.
// Pattern: <a href="https://www.gaspadorius.lt/{section}/{plant-slug}.htm">LT Name</a>
// Where section is namai/kambarines-geles, sodas/..., darzas/..., etc.
function decodeHtmlEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8220;|&#x201C;/g, '"')   // left double quote
    .replace(/&#8221;|&#x201D;/g, '"')   // right double quote
    .replace(/&#8216;|&#x2018;/g, "'")   // left single quote
    .replace(/&#8217;|&#x2019;/g, "'")   // right single quote
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#8212;|&mdash;/g, '—')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
}

function extractCatalogEntries(html, catalogName) {
  const re = /<a href="(https:\/\/www\.gaspadorius\.lt\/(?:namai|sodas|darzas|sveikata)\/[^"]+\.htm)">([^<]+)<\/a>/g
  const out = []
  const seen = new Set()
  for (const m of html.matchAll(re)) {
    const url = m[1]
    const ltText = decodeHtmlEntities(m[2]).trim().replace(/^["'(]+|["')]+$/g, '').trim()
    if (seen.has(url)) continue
    seen.add(url)
    // LT name may be "Primary, synonym" or "Primary plural" — split alts
    const parts = ltText.split(/[,;]\s*/)
    const primary = parts[0]
    const synonyms = parts.slice(1).filter(p => p.length > 2)
    out.push({
      ltName: primary,
      ltSynonyms: synonyms,
      sourceUrl: url,
      slug: url.split('/').pop().replace(/\.htm$/, ''),
      catalog: catalogName,
    })
  }
  return out
}

// ── Main ──────────────────────────────────────────────────────

console.log('[gasp] fetching 5 catalog pages (11s rate)...')

const allEntries = []

for (let i = 0; i < CATALOGS.length; i++) {
  const { name, url } = CATALOGS[i]
  console.log(`[gasp] [${i+1}/${CATALOGS.length}] ${name}...`)
  try {
    const html = await fetchUrl(url)
    const entries = extractCatalogEntries(html, name)
    console.log(`[gasp]   ${entries.length} entries`)
    allEntries.push(...entries)
  } catch (e) {
    console.warn(`[gasp]   FAIL ${name}: ${e.message}`)
  }
  // Rate limit between catalogs (except last)
  if (i < CATALOGS.length - 1) {
    await new Promise(r => setTimeout(r, RATE_DELAY_MS))
  }
}

// Dedup by URL (some plants may appear in multiple catalogs)
const byUrl = new Map()
for (const e of allEntries) {
  if (!byUrl.has(e.sourceUrl)) {
    byUrl.set(e.sourceUrl, e)
  }
}
const uniqueEntries = [...byUrl.values()]

console.log()
console.log('=== GASPADORIUS CATALOG RESULTS ===')
console.log(`Total entries:    ${allEntries.length}`)
console.log(`Unique URLs:      ${uniqueEntries.length}`)
console.log()

// Group by catalog
const byCat = {}
for (const e of uniqueEntries) {
  byCat[e.catalog] = (byCat[e.catalog] || 0) + 1
}
console.log('Per catalog:')
Object.entries(byCat).forEach(([k,v]) => console.log(`  ${k.padEnd(15)} ${v}`))

console.log()
console.log('Sample entries (first 15):')
uniqueEntries.slice(0, 15).forEach(e =>
  console.log(`  ${e.ltName.padEnd(30)} ${e.ltSynonyms.length ? '+syn:' + e.ltSynonyms.join(',') : ''}    [slug: ${e.slug}]`)
)

// Output (catalog entries only — no Latin names yet, requires detail page fetches)
const output = {
  generatedAt: new Date().toISOString(),
  source: 'gaspadorius.lt — augalų katalogai',
  catalogsFetched: CATALOGS.length,
  totalUniqueEntries: uniqueEntries.length,
  catalogStats: byCat,
  entries: uniqueEntries,
}

writeFileSync(OUTPUT, JSON.stringify(output, null, 2))
console.log(`\n[gasp] wrote ${OUTPUT}`)
console.log('[gasp] TIP: latin name extraction requires per-entry detail page fetch (10s each)')
console.log('[gasp] Run gaspadorius-detail-scraper.mjs for full Latin name resolution')
