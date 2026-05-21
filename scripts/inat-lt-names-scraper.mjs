// iNaturalist API batch scraper — fetches LT vernacular names for pre-DB genera.
//
// iNat API: 60 req/min for unauthenticated. We use 1.2s rate = ~50 req/min (safe).
// For 1655 genera × 1.2s = ~33 min.
//
// Per genus, we get:
//   - taxonId (iNat stable identifier)
//   - preferredLtName (community-curated LT name)
//   - ltNames[] (all LT synonyms iš community)
//   - englishNames[] (EN common names)
//
// Adds 6th source to lt-names.json.
//
// Idempotent + resumable.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PRE_DB = join(__dirname, '..', 'data', 'pre-db.json')
const OUTPUT = join(__dirname, '..', 'data', 'inat-names.json')

const USER_AGENT = 'geliu-db-pre-db-builder/1.0 (kestutis@okone.lt; LT vernacular names from iNat)'
const RATE_DELAY_MS = 1200 // 50/min, safe under iNat's 60/min limit
const SAVE_EVERY = 25

async function fetchUrl(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': USER_AGENT } })
  if (!res.ok) {
    const e = new Error(`HTTP ${res.status}`)
    e.statusCode = res.status
    throw e
  }
  return res.json()
}

// Fetch taxon + its LT/EN names. Two API calls — search then detail.
async function fetchInatGenus(latinGenus) {
  // 1. Search by Latin name at GENUS rank
  const searchUrl = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(latinGenus)}&rank=genus&locale=lt&limit=3`
  let search
  try {
    search = await fetchUrl(searchUrl)
  } catch (e) {
    return { found: false, error: `search: ${e.message}` }
  }

  // Prefer EXACT name match (case-insensitive)
  const target = latinGenus.toLowerCase()
  const taxon = search.results?.find(t => t.name?.toLowerCase() === target) ?? search.results?.[0]
  if (!taxon) return { found: false }

  // 2. Detail call for all names per locale
  await new Promise(r => setTimeout(r, 500)) // small inter-call delay
  const detailUrl = `https://api.inaturalist.org/v1/taxa/${taxon.id}?locale=lt`
  let detail
  try {
    detail = await fetchUrl(detailUrl)
  } catch (e) {
    // Return partial data from search
    return {
      found: true,
      taxonId: taxon.id,
      preferredLtName: taxon.preferred_common_name ?? null,
      ltNames: [],
      englishNames: [],
      iconicTaxon: taxon.iconic_taxon_name,
      detailError: e.message,
    }
  }

  const names = detail.results?.[0]?.names ?? []
  const preferredLtName = taxon.preferred_common_name ?? null
  const ltNames = names
    .filter(n => n.locale === 'lt' && n.name !== preferredLtName)
    .map(n => n.name)
  const englishNames = names
    .filter(n => n.locale === 'en')
    .map(n => n.name)
    .slice(0, 5) // cap

  return {
    found: true,
    taxonId: taxon.id,
    preferredLtName,
    ltNames,
    englishNames,
    iconicTaxon: taxon.iconic_taxon_name,
    rank: taxon.rank,
    parentId: taxon.parent_id,
  }
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  const preDb = JSON.parse(readFileSync(PRE_DB, 'utf-8'))
  const genera = Object.keys(preDb.genera).map(g => g.charAt(0) + g.slice(1).toLowerCase()).sort()
  console.log(`[inat] ${genera.length} genera from pre-DB`)

  let results = {}
  if (existsSync(OUTPUT)) {
    const prev = JSON.parse(readFileSync(OUTPUT, 'utf-8'))
    results = prev.results ?? {}
    console.log(`[inat] resuming — ${Object.keys(results).length} already done`)
  }

  const pending = genera.filter(g => !(g in results))
  const eta = Math.ceil(pending.length * (RATE_DELAY_MS + 500) / 1000 / 60)
  console.log(`[inat] pending: ${pending.length} (estimated ${eta} min)`)

  let idx = 0
  let foundCount = 0
  let withLtName = 0
  for (const genus of pending) {
    idx++
    try {
      const data = await fetchInatGenus(genus)
      results[genus] = { ...data, queried: genus, scrapedAt: new Date().toISOString() }
      if (data.found) {
        foundCount++
        if (data.preferredLtName) {
          withLtName++
          if (idx % 25 === 0 || withLtName <= 10) {
            console.log(`[inat] ${idx}/${pending.length} ${genus.padEnd(22)} → ${data.preferredLtName}${data.ltNames.length > 0 ? ` + ${data.ltNames.length} syn` : ''}`)
          }
        } else if (idx % 50 === 0) {
          console.log(`[inat] ${idx}/${pending.length} ${genus} (found taxon ${data.taxonId} but no LT name)`)
        }
      }
    } catch (e) {
      console.warn(`[inat] FAIL ${genus}: ${e.message}`)
      results[genus] = { queried: genus, error: e.message }
    }

    if (idx % SAVE_EVERY === 0) {
      writeFileSync(OUTPUT, JSON.stringify({ results }, null, 2))
    }
    if (idx < pending.length) {
      await new Promise(r => setTimeout(r, RATE_DELAY_MS))
    }
  }

  // Stats
  const all = Object.values(results)
  const totalFound = all.filter(r => r.found).length
  const totalWithLt = all.filter(r => r.found && r.preferredLtName).length
  const totalWithSynonyms = all.filter(r => r.found && r.ltNames?.length > 0).length

  console.log()
  console.log('=== iNAT LT NAMES RESULTS ===')
  console.log(`Total queried:           ${all.length}`)
  console.log(`Taxon found in iNat:     ${totalFound} (${(totalFound/all.length*100).toFixed(0)}%)`)
  console.log(`With LT preferred name:  ${totalWithLt}`)
  console.log(`With LT synonyms:        ${totalWithSynonyms}`)

  // Final output
  writeFileSync(OUTPUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: 'iNaturalist API (api.inaturalist.org)',
    totalQueried: all.length,
    totalFound,
    totalWithLtName: totalWithLt,
    results,
  }, null, 2))
  console.log(`\n[inat] wrote ${OUTPUT}`)
}

main().catch(e => {
  console.error('[inat] FATAL:', e)
  process.exit(1)
})
