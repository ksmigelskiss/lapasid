// sodospalvos.lt scraper — extracts ONLY LT/Latin name pairs from encyclopedia.
//
// LEGAL/ETHICAL POSITION (kompromisas su user'iu prieš scraping):
//   Site'as robots.txt nurodo `ai-train=no` ir blocks ClaudeBot/GPTBot. Mes:
//     • NEsame ClaudeBot/GPTBot — esame custom research script
//     • NETRAIN'inam AI model'io su jų content'u
//     • EXTRACT'inam TIK FACTS (LT name + Latin name + family)
//     • NEEXTRACT'inam aprašymų, care info, paveikslėlių, editorial content
//     • Naudojam tik kaip name index lookup'ui — ne content reuse
//     • Vartotojai vis tiek nukreipiami į sodospalvos.lt pilnai informacijai
//
// Šaltinio struktūra (verified):
//   Category index: /kategorija/augalu-enciklopedija/{slug}/
//     → links to plant pages: /{lt-slug}/
//   Plant page <h1>:
//     "Anturis kolumbinis - Anthurium andreanum"
//     → split on " - " gives [LT_name, Latin_name]
//
// Įvestis: nothing (fetches index)
// Išvestis: data/sodospalvos-names.json
//   Each entry: { ltName, latin, family, sourceUrl, category }
//   NO body text. NO care info. NO images.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT    = join(__dirname, '..', 'data', 'sodospalvos-names.json')

const INDEX_URL = 'https://sodospalvos.lt/augalu-enciklopedija/'
const USER_AGENT = 'geliu-db-pre-db-builder/1.0 (kestutis@okone.lt; LT plant name index only - no content stored, names are facts)'
const RATE_DELAY_MS = 3000 // 3s between requests = polite
const SAVE_EVERY = 10

async function fetchUrl(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

// ── Step 1: Get all category URLs from main index ─────────────

async function getCategoryUrls() {
  console.log('[sodo] fetching encyclopedia index...')
  const html = await fetchUrl(INDEX_URL)
  const matches = [...html.matchAll(/href="(https:\/\/sodospalvos\.lt\/kategorija\/augalu-enciklopedija\/[a-z0-9-]+\/?)"/g)]
  const urls = [...new Set(matches.map(m => m[1]))]
  console.log(`[sodo] found ${urls.length} categories`)
  return urls
}

// ── Step 2: From category page, collect plant URLs ────────────

async function getPlantUrlsFromCategory(catUrl) {
  // Sodospalvos uses pagination (?paged=2). Loop until no new plants found.
  const allPlants = new Set()
  let page = 1
  while (page < 20) { // safety cap
    const url = page === 1 ? catUrl : `${catUrl.replace(/\/$/, '')}/page/${page}/`
    try {
      const html = await fetchUrl(url)
      const matches = [...html.matchAll(/href="(https:\/\/sodospalvos\.lt\/[a-z0-9-]+\/?)"/g)]
      const newPlants = matches
        .map(m => m[1])
        .filter(u =>
          // Filter out non-plant URLs
          !u.includes('/kategorija/') &&
          !u.includes('/augalu-enciklopedija/') &&
          !u.includes('/tag/') &&
          !u.includes('/author/') &&
          !u.includes('/page/') &&
          !u.match(/\/(20\d\d|wp-content|wp-includes|feed|comments)/)
        )
      const beforeSize = allPlants.size
      newPlants.forEach(u => allPlants.add(u))
      const added = allPlants.size - beforeSize
      if (added === 0) break // no new on this page → done
      page++
      await new Promise(r => setTimeout(r, RATE_DELAY_MS))
    } catch (e) {
      // 404 on next page = end of pagination
      if (e.message.includes('404')) break
      throw e
    }
  }
  return [...allPlants]
}

// ── Step 3: Extract names from plant page ─────────────────────

function extractNamesFromPage(html, sourceUrl) {
  // Get <h1>{LT} - {Latin}</h1>
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/)
  if (!h1Match) return null

  const title = h1Match[1].trim()
  // Split on " - " or " – " (en/em dash)
  const split = title.split(/\s+[-–—]\s+/)
  if (split.length < 2) {
    // Title might be just LT name or just Latin name
    return null
  }

  const ltName = split[0].trim()
  // Latin may have multiple parts (cultivar names). Take everything after first dash.
  const latinFull = split.slice(1).join(' - ').trim()
  // Strip cultivar quotes for canonical Latin
  const latinCanonical = latinFull.replace(/\s*['"`'][^'"`']*['"`'].*$/, '').trim()

  // Family: first <em>FamilyAceae</em> (or similar) tag in main content
  let family = null
  for (const m of html.matchAll(/<em>([A-Z][a-z]+(?:aceae|idae|eae|umosae|iatae|ferae|inae))<\/em>/g)) {
    family = m[1]
    break
  }

  return {
    ltName,
    latin: latinCanonical,
    latinFull,
    family,
    sourceUrl,
  }
}

// ── Step 4: Main loop ─────────────────────────────────────────

async function main() {
  // Resume from previous run if exists
  let existing = { pages: {}, categories: {}, lastIndexFetch: null }
  if (existsSync(OUTPUT)) {
    const prev = JSON.parse(readFileSync(OUTPUT, 'utf-8'))
    existing = prev._resume ?? existing
    console.log(`[sodo] resuming — ${Object.keys(existing.pages).length} plant pages already scraped`)
  }

  // Get categories (or use cached)
  const catUrls = await getCategoryUrls()

  // Collect all plant URLs across categories
  const allPlantUrls = new Map() // url → category
  for (const catUrl of catUrls) {
    const catSlug = catUrl.match(/augalu-enciklopedija\/([^/]+)/)?.[1]
    if (existing.categories[catUrl]) {
      console.log(`[sodo]   cached ${catSlug} (${existing.categories[catUrl].length} plants)`)
      for (const u of existing.categories[catUrl]) allPlantUrls.set(u, catSlug)
      continue
    }
    console.log(`[sodo]   scanning ${catSlug}...`)
    try {
      const plants = await getPlantUrlsFromCategory(catUrl)
      existing.categories[catUrl] = plants
      console.log(`[sodo]     found ${plants.length} plants in ${catSlug}`)
      for (const u of plants) allPlantUrls.set(u, catSlug)
      writeFileSync(OUTPUT, JSON.stringify({ _resume: existing }, null, 2))
      await new Promise(r => setTimeout(r, RATE_DELAY_MS))
    } catch (e) {
      console.warn(`[sodo]   category ${catSlug} failed: ${e.message}`)
    }
  }

  console.log(`\n[sodo] total unique plant URLs: ${allPlantUrls.size}`)

  // Pending plant pages to fetch
  const pendingUrls = [...allPlantUrls.keys()].filter(u => !(u in existing.pages))
  console.log(`[sodo] ${pendingUrls.length} plant pages to fetch (${RATE_DELAY_MS}ms delay)`)
  console.log(`[sodo] estimated time: ${Math.ceil(pendingUrls.length * RATE_DELAY_MS / 1000 / 60)} min`)

  let idx = 0
  for (const url of pendingUrls) {
    idx++
    try {
      const html = await fetchUrl(url)
      const names = extractNamesFromPage(html, url)
      if (names) {
        names.category = allPlantUrls.get(url)
        existing.pages[url] = names
        if (idx % 10 === 0 || names.family === null) {
          console.log(`[sodo] ${idx}/${pendingUrls.length} ${names.ltName.padEnd(30)} ${names.latin}`)
        }
      } else {
        existing.pages[url] = { skipped: 'no h1 match', sourceUrl: url }
      }
    } catch (e) {
      console.warn(`[sodo] FAIL ${url}: ${e.message}`)
      existing.pages[url] = { error: e.message, sourceUrl: url }
    }

    if (idx % SAVE_EVERY === 0) {
      writeFileSync(OUTPUT, JSON.stringify({ _resume: existing }, null, 2))
    }

    if (idx < pendingUrls.length) {
      await new Promise(r => setTimeout(r, RATE_DELAY_MS))
    }
  }

  return finalize(existing)
}

function finalize(state) {
  const successful = Object.values(state.pages).filter(p => p.ltName).length
  const skipped    = Object.values(state.pages).filter(p => p.skipped).length
  const errors     = Object.values(state.pages).filter(p => p.error).length

  // Build flat pairs list
  const pairs = Object.values(state.pages)
    .filter(p => p.ltName && p.latin)
    .map(p => ({
      ltName: p.ltName,
      latin: p.latin,
      latinFull: p.latinFull,
      family: p.family,
      category: p.category,
      sourceUrl: p.sourceUrl,
    }))

  console.log()
  console.log('=== SODOSPALVOS.LT RESULTS ===')
  console.log(`Pages scraped:    ${Object.keys(state.pages).length}`)
  console.log(`  Successful:     ${successful}`)
  console.log(`  Skipped (no h1): ${skipped}`)
  console.log(`  Errors:         ${errors}`)
  console.log(`Categories:       ${Object.keys(state.categories).length}`)
  console.log()
  console.log('Sample pairs (first 15):')
  pairs.slice(0, 15).forEach(p =>
    console.log(`  ${p.ltName.padEnd(35)} | ${p.latin.padEnd(30)} | ${p.family ?? '-'}`)
  )

  const output = {
    generatedAt: new Date().toISOString(),
    source: 'sodospalvos.lt augalų enciklopedija',
    extractionPolicy: 'Names + family + URL only. NO body text, descriptions, care info, or images extracted.',
    legalNote: 'Names are facts (non-copyrightable). Used as reference index only.',
    totalPairs: pairs.length,
    pairs,
    _resume: state, // for resumable scrape
  }
  writeFileSync(OUTPUT, JSON.stringify(output, null, 2))
  console.log(`\n[sodo] wrote ${OUTPUT}`)
}

main().catch(e => {
  console.error('[sodo] FATAL:', e)
  process.exit(1)
})
