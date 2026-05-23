// Focused PFAF re-scrape — 2026-05-24
//
// Target: entries kurios turi medicinalRating>=1 ARBA edibilityRating>=1
// BET text laukai (medicinalUses / edibleUses) null. Tai parser bug victims
// (medicinalUses regex was matching nav links, not h2 sections — fixed
// in d692d78 — bet re-scrape reikalingas, kad gautume rich content).
//
// Strategija: re-scrape only relevant entries (NE full 9895). Effort
// estimate: ~1540 medicinal + ~733 edibility unique = ~2000 entries × 3s
// = ~1.7 hours. Su SAVE_EVERY=20.
//
// User'is davė pusdienį — šitas vyrauja iš tikrųjų svarbesnių laukų.
// Po re-scrape: curated-300 medicinal/edible coverage smarkiai pagerės.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PFAF_DATA = join(__dirname, '..', 'data', 'pfaf.json')
const OUT = PFAF_DATA  // overwrite in place

// Identify targets BEFORE scraping (deterministic)
console.log('[pfaf-rescrape] loading current data...')
const data = JSON.parse(readFileSync(PFAF_DATA, 'utf-8'))

// Build target list: found:true + rating>=1 + text missing
const targets = []
for (const [latin, entry] of Object.entries(data.results)) {
  if (!entry.found) continue
  const needsMedicinal = entry.medicinalRating >= 1 && !entry.medicinalUses
  const needsEdible = entry.edibilityRating >= 1 && !entry.edibleUses
  if (needsMedicinal || needsEdible) {
    targets.push({ latin, needsMedicinal, needsEdible })
  }
}
console.log(`[pfaf-rescrape] target entries: ${targets.length} (parser bug victims)`)
console.log(`  medicinalUses missing: ${targets.filter(t => t.needsMedicinal).length}`)
console.log(`  edibleUses missing: ${targets.filter(t => t.needsEdible).length}`)

// ── Re-scrape parser (copied + adapted iš pfaf-scraper.mjs) ───
// Reikia tik dviejų funkcijų: medicinalUses + edibleUses extraction
// su naujomis (fix'intomis) regex'omis.

function extractMedicinalUses(html) {
  // H2-anchored (fix'inta 2026-05-24)
  const m = html.match(/<h2[^>]*>Medicinal Uses<\/h2>([\s\S]*?)(?:<h2|<div\s+class=["']subhead)/i)
  if (!m) return null
  let v = m[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
  if (!v) return null
  if (v.length > 800) v = v.slice(0, 800) + '...'
  return v
}

function extractEdibleUses(html) {
  const m = html.match(/Edible Uses:\s*(?:<br\s*\/?>)?([\s\S]*?)(?:Medicinal Uses|Other Uses|Cultivation details|<h2|<div\s+class=["']subhead)/i)
  if (!m) return null
  let v = m[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
  // Strip "References More on Edible Uses" suffix
  v = v.replace(/\s*References\s+More on Edible Uses\s*$/i, '').trim()
  if (!v) return null
  if (v.length > 800) v = v.slice(0, 800) + '...'
  return v
}

function extractMedicinalRating(html) {
  // Count active stars in Medicinal Rating block
  const medMatch = html.match(/Medicinal Rating[\s\S]{0,3500}?(?=Care|Habitats|Other Possible|Edible Parts|Medicinal Uses|Cultivation)/i)
  if (!medMatch) return 0
  return (medMatch[0].match(/PFAF_searchV1b_\d+\.gif/g) ?? []).length
}

// ── Fetch with retry + polite delay ──────────────────────────
// Pure ASCII — em-dash (—) sukelia "Cannot convert to ByteString" error
const USER_AGENT = 'geliu-db-pre-db-stuburas/1.0 (kestutis@okone.lt; targeted re-scrape, parser bug fix)'
const RATE_DELAY_MS = 3000

async function fetchUrl(url, maxAttempts = 3) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
      if (res.status === 404) return null
      if (!res.ok) {
        const e = new Error(`HTTP ${res.status}`)
        e.statusCode = res.status
        throw e
      }
      return await res.text()
    } catch (e) {
      const retryable = e.statusCode === 429 || e.statusCode === 503 ||
                        e.code === 'ETIMEDOUT' || e.code === 'ECONNRESET'
      if (!retryable || attempt === maxAttempts - 1) throw e
      const backoff = 5000 * Math.pow(2, attempt)
      console.warn(`[pfaf-rescrape] retry ${attempt + 1} after ${backoff / 1000}s`)
      await new Promise(r => setTimeout(r, backoff))
    }
  }
}

// ── Main loop ────────────────────────────────────────────────
const SAVE_EVERY = 20
let processed = 0
let updated = 0
let unchanged = 0
let failed = 0
const startTime = Date.now()

for (const t of targets) {
  const entry = data.results[t.latin]
  if (!entry?.pfafUrl) continue

  try {
    const html = await fetchUrl(entry.pfafUrl)
    if (!html) {
      failed++
      console.log(`[pfaf-rescrape] ${processed + 1}/${targets.length} ${t.latin} — 404`)
      processed++
      continue
    }

    let changed = false
    if (t.needsMedicinal) {
      const newMed = extractMedicinalUses(html)
      if (newMed) {
        entry.medicinalUses = newMed
        changed = true
      }
    }
    if (t.needsEdible) {
      const newEd = extractEdibleUses(html)
      if (newEd) {
        entry.edibleUses = newEd
        changed = true
      }
    }
    if (changed) {
      entry._reScrapedAt = new Date().toISOString()
      updated++
    } else {
      unchanged++
    }
  } catch (e) {
    failed++
    console.warn(`[pfaf-rescrape] ${t.latin} failed:`, e.message)
  }

  processed++

  if (processed % SAVE_EVERY === 0) {
    writeFileSync(OUT, JSON.stringify(data, null, 2))
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
    const rate = processed / ((Date.now() - startTime) / 1000)
    const eta = ((targets.length - processed) / rate / 60).toFixed(1)
    console.log(`[pfaf-rescrape] ${processed}/${targets.length} | updated=${updated}, failed=${failed} | elapsed=${elapsed}m, ETA=${eta}m`)
  }

  await new Promise(r => setTimeout(r, RATE_DELAY_MS))
}

// Final save
writeFileSync(OUT, JSON.stringify(data, null, 2))

const totalMin = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
console.log('')
console.log('=== TARGETED RE-SCRAPE DONE ===')
console.log(`Processed: ${processed}/${targets.length}`)
console.log(`Updated:   ${updated}`)
console.log(`Unchanged: ${unchanged}`)
console.log(`Failed:    ${failed}`)
console.log(`Total time: ${totalMin} min`)
console.log('')
console.log('[pfaf-rescrape] wrote ' + OUT)
