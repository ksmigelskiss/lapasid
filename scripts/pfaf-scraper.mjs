// PFAF (Plants For A Future) scraper — toxicity + edibility + medicinal.
//
// PFAF — autoritetinga 7000+ augalų DB su:
//   • Known Hazards (toksiškumo aprašymas tekstu)
//   • Edibility Rating (0-5 žvaigždutės)
//   • Edible Parts + Uses (kuri augalo dalis valgoma + kaip)
//   • Medicinal Rating (0-5 žvaigždutės)
//   • Medicinal Uses (aprašymas tekstu)
//
// PFAF mums duoda TĄ PATĮ duomenis ką ASPCA bei papildomai edible/medicinal —
// vartotojo balansas: NE tik "toksiškas katėms" bet ir "kaip vaistinis žmogui".
//
// Įvestis: pre-db.json — iš jo extract'inam Latin binomials (skip cultivars)
// Išvestis: data/pfaf.json
//   Each entry: {
//     latin: "Aloe vera",
//     edibilityRating: 1,        // 0-5 stars
//     medicinalRating: 3,
//     edibleParts: ["Leaves", "Seed"],
//     edibleUses: "...",
//     medicinalUses: "...",
//     knownHazards: "...",
//     habit: "Evergreen Perennial",
//     pfafUrl: "...",
//     scrapedAt: "..."
//   }
//
// PFAF URL: https://pfaf.org/user/Plant.aspx?LatinName=Genus+species
// Many pre-DB species won't be in PFAF (404 or empty page). Track misses.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PRE_DB = join(__dirname, '..', 'data', 'pre-db.json')
const OUTPUT = join(__dirname, '..', 'data', 'pfaf.json')

const USER_AGENT = 'geliu-db-pre-db-builder/1.0 (kestutis@okone.lt; plant toxicity + edibility research)'
const RATE_DELAY_MS = 3000 // 3s = polite, ~20/min
const SAVE_EVERY = 20

async function fetchUrl(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`)
    err.statusCode = res.statusCode
    throw err
  }
  return res.text()
}

// Retry on transient errors
async function fetchUrlRetry(url, maxAttempts = 3) {
  let lastErr
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fetchUrl(url)
    } catch (e) {
      lastErr = e
      const retryable = e.statusCode === 429 || e.statusCode === 503 ||
                        e.code === 'ETIMEDOUT' || e.code === 'ECONNRESET'
      if (!retryable || attempt === maxAttempts - 1) throw e
      const backoff = 5000 * Math.pow(2, attempt)
      console.warn(`[pfaf]   retry ${attempt + 1} after ${backoff / 1000}s`)
      await new Promise(r => setTimeout(r, backoff))
    }
  }
  throw lastErr
}

// ── Extract structured data from PFAF HTML page ───────────────

function extractPfafData(html, latin, url) {
  // Empty page check (PFAF returns 200 for missing plants — empty form)
  if (!/Edibility Rating|Medicinal Rating|Known Hazards/.test(html)) {
    return { latin, found: false, pfafUrl: url }
  }

  // Star ratings — active = `PFAF_searchV1b_NN.gif`, grey = `..._NNGrey.gif`
  function countStars(blockHtml) {
    return (blockHtml.match(/PFAF_searchV1b_\d+\.gif/g) ?? []).length
  }

  // ── Helper: extract simple `<b>Label</b> ... <text> ... </td>` field ──
  // Reads short label values (Family, USDA hardiness, Range, etc.)
  function extractLabelValue(label, maxLen = 200) {
    // PFAF labels often have trailing whitespace: `<b>Edibility Rating </b>` or
    // `<b>Family\n</b>`. Tolerate \s* before </b>.
    const re = new RegExp(`<b>${label}\\s*</b>([\\s\\S]{0,800}?)(?=<b>|</tr>|</table>)`, 'i')
    const m = html.match(re)
    if (!m) return null
    let v = m[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
    if (!v) return null
    if (v.length > maxLen) v = v.slice(0, maxLen)
    return v
  }

  // ── Helper: extract <span id="ContentPlaceHolder1_lblX">...</span> ──
  function extractLblSpan(spanId, maxLen = 800) {
    const re = new RegExp(`lbl${spanId}[^>]*>([\\s\\S]*?)</span>`, 'i')
    const m = html.match(re)
    if (!m) return null
    let v = m[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
    if (!v) return null
    if (v.length > maxLen) v = v.slice(0, maxLen) + '...'
    return v
  }

  // ── Ratings (0-5 stars each) ──────────────────────────────
  let edRating = 0
  const edMatch = html.match(/Edibility Rating[\s\S]{0,3500}?(?=Other Uses|Medicinal Rating|Habit\b)/i)
  if (edMatch) edRating = countStars(edMatch[0])

  let medRating = 0
  const medMatch = html.match(/Medicinal Rating[\s\S]{0,3500}?(?=Care|Habitats|Other Possible|Edible Parts|Medicinal Uses|Cultivation)/i)
  if (medMatch) medRating = countStars(medMatch[0])

  // NEW: Other Uses rating (industrial/cosmetic/dye/fiber/soap/etc.)
  // Label has trailing whitespace: `<b>Other Uses </b>`
  let otherUsesRating = 0
  const otherMatch = html.match(/<b>Other Uses\s*<\/b>[\s\S]{0,3500}?(?=Weed Potential|Medicinal Rating)/i)
  if (otherMatch) otherUsesRating = countStars(otherMatch[0])

  // ── Header info fields ────────────────────────────────────
  const commonNameEn  = extractLabelValue('Common Name')
  const family        = extractLabelValue('Family', 60)
  const usdaHardiness = extractLabelValue('USDA hardiness', 30)
  const habitats      = extractLabelValue('Habitats', 200)
  const range         = extractLabelValue('Range', 200)
  const weedPotential = extractLabelValue('Weed Potential', 20)

  // ── Hazards + descriptive text fields ─────────────────────
  const knownHazards = extractLblSpan('KnownHazards', 800)

  // Care icons — PFAF uses icon titles instead of text:
  //   <img title='Frost Hardy'/>      → hardiness category
  //   <img title='Full sun'/>          → light requirements
  //   <img title='Well drained soil'/> → soil drainage
  //   <img title='Moist Soil'/>        → moisture
  // We extract all titles from the Care table.
  let careIcons = []
  const careMatch = html.match(/<b>Care\s*<\/b>[\s\S]{0,2000}?<table id="ContentPlaceHolder1_tblIcons">([\s\S]*?)<\/table>/i)
  if (careMatch) {
    careIcons = [...careMatch[1].matchAll(/title=['"]([^'"]+)['"]/g)].map(m => m[1].trim())
  }

  // ── Edible Parts + Uses ────────────────────────────────────
  let edibleParts = []
  const ediblePartsMatch = html.match(/Edible Parts:([\s\S]{0,500}?)(?:Edible Uses:|<br><br>|Medicinal Uses)/i)
  if (ediblePartsMatch) {
    edibleParts = [...ediblePartsMatch[1].matchAll(/glossary=(\w+)/g)].map(m => m[1])
  }

  let edibleUses = null
  const edibleUsesMatch = html.match(/Edible Uses:\s*(?:<br\s*\/?>)?([\s\S]*?)(?:Medicinal Uses|Other Uses|Cultivation details|<h2|<div\s+class=["']subhead)/i)
  if (edibleUsesMatch) {
    edibleUses = edibleUsesMatch[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
    if (edibleUses.length > 800) edibleUses = edibleUses.slice(0, 800) + '...'
    if (!edibleUses) edibleUses = null
  }

  // ── Medicinal Uses ────────────────────────────────────────
  let medicinalUses = null
  const medUsesMatch = html.match(/Medicinal Uses[\s\S]*?(?:<br\s*\/?>)?([\s\S]*?)(?:Other Uses|Cultivation details|<h2|<div\s+class=["']subhead)/i)
  if (medUsesMatch) {
    medicinalUses = medUsesMatch[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
    if (medicinalUses.length > 800) medicinalUses = medicinalUses.slice(0, 800) + '...'
    if (!medicinalUses) medicinalUses = null
  }

  // ── Other Uses descriptive text (NEW) ─────────────────────
  let otherUses = null
  const otherUsesMatch = html.match(/Other Uses:\s*(?:<br\s*\/?>)?([\s\S]*?)(?:Cultivation details|Propagation|<h2|<div\s+class=["']subhead)/i)
  if (otherUsesMatch) {
    otherUses = otherUsesMatch[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
    if (otherUses.length > 600) otherUses = otherUses.slice(0, 600) + '...'
    if (!otherUses) otherUses = null
  }

  // ── Major H2 sections — Physical Characteristics, Cultivation, Propagation, Synonyms ──
  function extractH2Section(name, maxLen = 600) {
    const pat = new RegExp(`<h2[^>]*>${name}<\\/h2>([\\s\\S]*?)(?:<h2|<div class=["']subhead)`, 'i')
    const m = html.match(pat)
    if (!m) return null
    let t = m[1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
    // PFAF placeholder "If available other names are mentioned here" → null
    if (/^If available/i.test(t)) return null
    if (!t) return null
    return t.length > maxLen ? t.slice(0, maxLen) + '...' : t
  }

  const physicalCharacteristics = extractH2Section('Physical Characteristics', 700)
  const cultivationDetails      = extractH2Section('Cultivation details', 700)
  const plantPropagation        = extractH2Section('Plant Propagation', 600)

  // ── Synonyms (Latin) — e.g. "Aloe barbadensis, Aloe vulgaris" ──
  let latinSynonyms = []
  const synSec = extractH2Section('Synonyms', 400)
  if (synSec) {
    // Synonyms section may have multiple comma-separated Latin names
    latinSynonyms = synSec
      .split(/[,;]/)
      .map(s => s.trim())
      .filter(s => /^[A-Z][a-z]+(?:\s+[a-z]+)?(?:\s+\S+)?$/.test(s)) // looks like Latin binomial
      .slice(0, 10) // safety cap
  }

  // ── Conservation Status (extinct/threatened/etc.) ─────────
  const conservationStatus = extractH2Section('Conservation Status', 200)

  return {
    latin,
    found: true,
    // Identity
    commonNameEn,
    family,
    latinSynonyms,             // NEW: ['Aloe barbadensis', 'Aloe vulgaris']
    // Hardiness + habitat
    usdaHardiness,
    habitats,
    range,
    weedPotential,
    conservationStatus,        // NEW
    // Care (structured icons)
    careIcons,                 // ['Frost Hardy', 'Full sun', 'Well drained soil', ...]
    // Ratings
    edibilityRating: edRating,
    medicinalRating: medRating,
    otherUsesRating,
    // Detailed usage prose
    edibleParts,
    edibleUses,
    medicinalUses,
    otherUses,
    knownHazards,
    // Big content sections (NEW)
    physicalCharacteristics,   // size, flowering, soil pref, wildlife attraction
    cultivationDetails,        // landscape uses, position, soil prep, frost protection
    plantPropagation,          // seed sowing, timing, germination temps
    pfafUrl: url,
    scrapedAt: new Date().toISOString(),
  }
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  // Load pre-DB and extract all unique Latin binomials
  const preDb = JSON.parse(readFileSync(PRE_DB, 'utf-8'))
  const latinBinomials = new Set()

  for (const [gKey, g] of Object.entries(preDb.genera)) {
    const genusProper = gKey.charAt(0) + gKey.slice(1).toLowerCase()
    // Add genus-only entry
    latinBinomials.add(genusProper)
    // Add each species (skip cultivars marked by quotes)
    for (const [sk, sp] of Object.entries(g.species)) {
      if (sp.cultivar) continue // skip cultivars
      if (sk.startsWith("'") || sk.startsWith('"') || sk.startsWith('‘')) continue
      // sk is the species epithet (e.g. "deliciosa") or "species var. variety"
      // Build full Latin binomial. Take just first 2 words if multi-word.
      const cleanedSk = sk.replace(/\s+(?:var|subsp|f|x)\.?\s+/, ' ').split(/\s+/).slice(0, 2).join(' ')
      latinBinomials.add(`${genusProper} ${cleanedSk}`)
    }
  }

  const allLatin = [...latinBinomials].sort()
  console.log(`[pfaf] extracted ${allLatin.length} unique Latin names from pre-DB`)

  // Load existing output for resume
  let results = {}
  if (existsSync(OUTPUT)) {
    const prev = JSON.parse(readFileSync(OUTPUT, 'utf-8'))
    results = prev.results ?? {}
    console.log(`[pfaf] resuming — ${Object.keys(results).length} entries already done`)
  }

  const pending = allLatin.filter(l => !(l in results))
  console.log(`[pfaf] pending: ${pending.length} (estimated ${Math.ceil(pending.length * RATE_DELAY_MS / 1000 / 3600 * 10) / 10} hours at ${RATE_DELAY_MS}ms rate)`)

  let idx = 0
  let foundCount = 0
  let notFoundCount = 0
  for (const latin of pending) {
    idx++
    const url = `https://pfaf.org/user/Plant.aspx?LatinName=${encodeURIComponent(latin)}`
    try {
      const html = await fetchUrlRetry(url)
      const data = extractPfafData(html, latin, url)
      results[latin] = data
      if (data.found) {
        foundCount++
        if (idx % 20 === 0 || data.edibilityRating >= 3 || data.medicinalRating >= 3) {
          const rating = `ed=${data.edibilityRating} med=${data.medicinalRating}`
          console.log(`[pfaf] ${idx}/${pending.length} ${latin.padEnd(35)} ${rating}${data.knownHazards ? ' ⚠️' : ''}`)
        }
      } else {
        notFoundCount++
        if (idx % 50 === 0) {
          console.log(`[pfaf] ${idx}/${pending.length} (found ${foundCount}, miss ${notFoundCount}) latest: ${latin}`)
        }
      }
    } catch (e) {
      console.warn(`[pfaf] FAIL ${latin}: ${e.message}`)
      results[latin] = { latin, error: e.message, pfafUrl: url }
    }

    if (idx % SAVE_EVERY === 0) {
      writeFileSync(OUTPUT, JSON.stringify({ results }, null, 2))
    }
    if (idx < pending.length) {
      await new Promise(r => setTimeout(r, RATE_DELAY_MS))
    }
  }

  // Finalize
  const found = Object.values(results).filter(r => r.found).length
  const notFound = Object.values(results).filter(r => !r.found && !r.error).length
  const errors = Object.values(results).filter(r => r.error).length
  const withHazards = Object.values(results).filter(r => r.found && r.knownHazards).length
  const withEdible = Object.values(results).filter(r => r.found && r.edibilityRating >= 1).length
  const withMedicinal = Object.values(results).filter(r => r.found && r.medicinalRating >= 1).length
  const highEdible = Object.values(results).filter(r => r.found && r.edibilityRating >= 3).length
  const highMedicinal = Object.values(results).filter(r => r.found && r.medicinalRating >= 3).length

  console.log()
  console.log('=== PFAF SCRAPER RESULTS ===')
  console.log(`Total queried:        ${Object.keys(results).length}`)
  console.log(`  Found in PFAF:      ${found} (${(found / Object.keys(results).length * 100).toFixed(1)}%)`)
  console.log(`  Not in PFAF:        ${notFound}`)
  console.log(`  Errors:             ${errors}`)
  console.log()
  console.log(`Data dimensions:`)
  console.log(`  With Known Hazards: ${withHazards}`)
  console.log(`  With edible rating: ${withEdible}`)
  console.log(`  With med rating:    ${withMedicinal}`)
  console.log(`  Highly edible (3+): ${highEdible}`)
  console.log(`  Highly medicinal:   ${highMedicinal}`)

  writeFileSync(OUTPUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: 'PFAF — Plants For A Future (pfaf.org)',
    totalQueried: Object.keys(results).length,
    found,
    notFound,
    results,
  }, null, 2))
  console.log(`\n[pfaf] wrote ${OUTPUT}`)
}

main().catch(e => {
  console.error('[pfaf] FATAL:', e)
  process.exit(1)
})
