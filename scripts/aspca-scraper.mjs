// ASPCA toxic plants scraper — pirma greitai sukatalogizuojam (3 list pages).
//
// Strategija:
//   1) Fetch /cats-plant-list, /dogs-plant-list, /horse-plant-list — 3 requests
//   2) KIEKVIENAS sąrašo page'as turi DVI sekcijas (BUG FIX 2026-05-24):
//      - <h2>Plants Toxic to {Animal}</h2> ... links ...
//      - <h2>Plants Non-Toxic to {Animal}</h2> ... links ...
//      Pirminis scraper'is naudojo vieną regex per visą page'ą, pa'imdamas IR
//      non-toxic entries. Tas false-positive'ino safe plants kaip African
//      Violet (Saintpaulia) ir Spider Plant (Chlorophytum) kaip toksiškus.
//   3) Iš KIEKVIENOS sekcijos atskirai išgaunam plant_slug + display_name,
//      kiekvienam tag'uojam `safetyStatus: 'toxic' | 'non-toxic'`.
//   4) Cross-merge: per-plant kiekvienam gyvūnui pažymim toxic/non-toxic.
//      Edge case: plant gali būti toxic vienam gyvūnui ir non-toxic kitam
//      (rare — eg. retas augalas šuniui safe, katei toxic). Handle'inam
//      su per-animal status, ne global flag.
//
// Per-plant detail pages NEFETCHIN'iam (robots.txt Crawl-delay: 10s).
//
// Įvestis: nothing (3 hardcoded URL)
// Išvestis: data/aspca-toxicity.json
//   {
//     "aloe": {
//       slug: "aloe",
//       displayName: "Aloe",
//       toxicTo: ["cats", "dogs", "horses"],
//       nonToxicTo: [],
//       safetyStatus: "toxic",   // overall — toxic to AT LEAST one animal
//       detailUrl: "..."
//     },
//     "african-violet": {
//       slug: "african-violet",
//       displayName: "African Violet",
//       toxicTo: [],
//       nonToxicTo: ["cats", "dogs", "horses"],
//       safetyStatus: "non-toxic",
//       detailUrl: "..."
//     },
//     ...
//   }

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT    = join(__dirname, '..', 'data', 'aspca-toxicity.json')

const LISTS = {
  cats:   'https://www.aspca.org/pet-care/animal-poison-control/cats-plant-list',
  dogs:   'https://www.aspca.org/pet-care/animal-poison-control/dogs-plant-list',
  horses: 'https://www.aspca.org/pet-care/animal-poison-control/horse-plant-list',
}

const USER_AGENT = 'geliu-db-toxicity-research/1.0 (kestutis@okone.lt; one-time aspca catalog scrape)'

async function fetchUrl(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

/**
 * Extract plant links iš HTML section — naudojama tiek toxic, tiek non-toxic
 * section'ams atskirai. Returns Map<slug, displayName>.
 */
function extractPlantsFromSection(html) {
  const re = /<a href="\/pet-care\/(?:aspca-poison-control|animal-poison-control)\/toxic-and-non-toxic-plants\/([^"]+)"[^>]*>([^<]+)<\/a>/g
  const out = new Map()
  for (const m of html.matchAll(re)) {
    const slug = m[1]
    const name = m[2].trim()
    if (!out.has(slug)) out.set(slug, name)
  }
  return out
}

/**
 * Split HTML į TWO sections pagal H2 headers:
 *   <h2>Plants Toxic to {Animal}</h2> ... <h2>Plants Non-Toxic to {Animal}</h2>
 *
 * Returns { toxic: Map<slug,name>, nonToxic: Map<slug,name> }.
 * Throws jei page'as neturi šito struktūros (sanity check — page format
 * gali pasikeisti, ne tylom return'inam tuščia).
 */
function extractPlantsFromList(html) {
  // Detect section boundaries via H2 headers (case-insensitive)
  // Pattern toleruoja whitespace + nested HTML inside H2
  const toxicHeaderRe = /<h2[^>]*>\s*Plants Toxic to[^<]*<\/h2>/i
  const nonToxicHeaderRe = /<h2[^>]*>\s*Plants Non-Toxic to[^<]*<\/h2>/i

  const toxicMatch = html.match(toxicHeaderRe)
  const nonToxicMatch = html.match(nonToxicHeaderRe)

  if (!toxicMatch || !nonToxicMatch) {
    throw new Error(
      `ASPCA page struktūra neaptikta — Toxic header found: ${!!toxicMatch}, ` +
      `Non-Toxic header found: ${!!nonToxicMatch}. ` +
      `Galimai page'as restruktūrizuotas — atnaujink regex'us.`,
    )
  }

  const toxicStart = toxicMatch.index + toxicMatch[0].length
  const nonToxicStart = nonToxicMatch.index

  if (toxicStart > nonToxicStart) {
    throw new Error('ASPCA page section order unexpected — Non-Toxic header appears before Toxic.')
  }

  const toxicHtml = html.slice(toxicStart, nonToxicStart)
  const nonToxicHtml = html.slice(nonToxicStart + nonToxicMatch[0].length)

  return {
    toxic: extractPlantsFromSection(toxicHtml),
    nonToxic: extractPlantsFromSection(nonToxicHtml),
  }
}

// ── Main ──────────────────────────────────────────────────────

console.log('[aspca] fetching 3 toxicity lists (with non-toxic section split)...')

const listData = {}
for (const [animal, url] of Object.entries(LISTS)) {
  console.log(`[aspca]   fetching ${animal} list...`)
  const html = await fetchUrl(url)
  const { toxic, nonToxic } = extractPlantsFromList(html)
  console.log(`[aspca]     ${toxic.size} toxic + ${nonToxic.size} non-toxic plants to ${animal}`)
  listData[animal] = { toxic, nonToxic }
}

// ── Build unified toxicity matrix ─────────────────────────────
// Each plant slug gets tracked across BOTH sections:
//   • toxicTo: Set of animals where listed in "Plants Toxic to X" section
//   • nonToxicTo: Set of animals where listed in "Plants Non-Toxic to X" section
// Edge case: same plant may appear in BOTH sections for different animals
// (rare but documented — eg. plant safe for one species, toxic for another).

const matrix = new Map() // slug → { slug, displayName, toxicTo: Set, nonToxicTo: Set, detailUrl }

function ensureEntry(slug, displayName) {
  if (!matrix.has(slug)) {
    matrix.set(slug, {
      slug,
      displayName,
      toxicTo: new Set(),
      nonToxicTo: new Set(),
      detailUrl: `https://www.aspca.org/pet-care/animal-poison-control/toxic-and-non-toxic-plants/${slug}`,
    })
  }
  return matrix.get(slug)
}

for (const [animal, { toxic, nonToxic }] of Object.entries(listData)) {
  for (const [slug, displayName] of toxic) {
    ensureEntry(slug, displayName).toxicTo.add(animal)
  }
  for (const [slug, displayName] of nonToxic) {
    ensureEntry(slug, displayName).nonToxicTo.add(animal)
  }
}

// Serialize Sets to arrays + derive safetyStatus
//   • 'toxic' — listed as toxic to AT LEAST ONE animal (conservative — single
//     toxic animal triggers warning, even if other species show as safe)
//   • 'non-toxic' — listed exclusively in Non-Toxic sections (no toxic animal)
const output = {}
for (const [slug, entry] of matrix) {
  const toxicTo = [...entry.toxicTo].sort()
  const nonToxicTo = [...entry.nonToxicTo].sort()
  output[slug] = {
    slug: entry.slug,
    displayName: entry.displayName,
    toxicTo,
    nonToxicTo,
    safetyStatus: toxicTo.length > 0 ? 'toxic' : 'non-toxic',
    detailUrl: entry.detailUrl,
  }
}

// ── Stats ─────────────────────────────────────────────────────

const allEntries = Object.values(output)
const totalUnique = allEntries.length
const toxicCount = allEntries.filter(p => p.safetyStatus === 'toxic').length
const nonToxicCount = allEntries.filter(p => p.safetyStatus === 'non-toxic').length
const toAll3 = allEntries.filter(p => p.toxicTo.length === 3).length

console.log()
console.log('=== ASPCA TOXICITY MATRIX (post-fix) ===')
console.log(`Unique plants:                       ${totalUnique}`)
console.log(`  Toxic to at least one animal:      ${toxicCount}`)
console.log(`  Non-toxic (all animals):           ${nonToxicCount}`)
console.log(`  Toxic to ALL 3 (cats+dogs+horses): ${toAll3}`)
console.log()

// Sample popular houseplants check — sanity verification post-fix
const sampleSlugs = ['aloe', 'monstera-deliciosa', 'philodendron', 'pothos-or-devils-ivy',
                     'sago-palm', 'tulip', 'azalea', 'oleander', 'lily', 'dieffenbachia',
                     'sansevieria-trifasciata', 'zz-plant', 'pilea', 'snake-plant',
                     // Critical regression checks — these MUST be 'non-toxic':
                     'african-violet', 'spider-plant', 'boston-fern', 'phalaenopsis-spp']
console.log('=== POPULAR HOUSEPLANT TOXICITY CHECK ===')
for (const slug of sampleSlugs) {
  const entry = output[slug]
  if (entry) {
    const marker = entry.safetyStatus === 'toxic' ? '⚠️ ' : '✓ '
    const status = entry.safetyStatus === 'toxic'
      ? `TOXIC to: ${entry.toxicTo.join(', ')}`
      : `NON-TOXIC (all ${entry.nonToxicTo.length} animals)`
    console.log(`  ${marker} ${entry.displayName.padEnd(30)} ${status}`)
  } else {
    console.log(`  · ${slug.padEnd(30)} NOT IN ASPCA DB`)
  }
}

// Write output
const final = {
  generatedAt: new Date().toISOString(),
  source: 'ASPCA Animal Poison Control — toxic + non-toxic plant lists per animal',
  url: 'https://www.aspca.org/pet-care/animal-poison-control/toxic-and-non-toxic-plants',
  totalUniquePlants: totalUnique,
  totalToxic: toxicCount,
  totalNonToxic: nonToxicCount,
  schemaVersion: 2, // v2 = split toxic/non-toxic sections (2026-05-24 bug fix)
  toxicity: output,
}

writeFileSync(OUTPUT, JSON.stringify(final, null, 2))
console.log(`\n[aspca] wrote ${OUTPUT}`)
