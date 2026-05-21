// ASPCA toxic plants scraper — pirma greitai sukatalogizuojam (3 list pages).
//
// Strategija:
//   1) Fetch /cats-plant-list, /dogs-plant-list, /horse-plant-list — 3 requests
//      (kiekvienas tu sąrašų turi ~700-985 augalų, kurie yra TOXIC tai gyvūnai)
//   2) Iš kiekvieno sąrašo ištraukiame plant_slug + display_name
//   3) Cross-merge: kiekvienam unikaliam plant'ui pažymime kuriem gyvūnam toks
//
// Per-plant detail pages (su Latin name, simptomais, etc.) NEFETCHIN'iam šitame
// stage — robots.txt nurodo Crawl-delay: 10s, kas atimtų ~2.7 valandos. Vietoj
// to per-plant detail page'us scrape'isime TIK pre-DB top-N populiariausiems
// plant'ams atskirame žingsnyje, jei reikės.
//
// Įvestis: nothing (3 hardcoded URL)
// Išvestis: data/aspca-toxicity.json
//   {
//     "aloe": {
//       slug: "aloe",
//       displayName: "Aloe",
//       toxicTo: ["cats", "dogs", "horses"],
//       detailUrl: "/pet-care/animal-poison-control/toxic-and-non-toxic-plants/aloe"
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

function extractPlantsFromList(html) {
  // Pattern: <a href="/pet-care/.../toxic-and-non-toxic-plants/{slug}">{Display Name}</a>
  // Note: there are also non-toxic plant variants on these pages — but these pages
  // are FILTERED to "toxic to <animal>" only, so all links here = toxic.
  const re = /<a href="\/pet-care\/(?:aspca-poison-control|animal-poison-control)\/toxic-and-non-toxic-plants\/([^"]+)"[^>]*>([^<]+)<\/a>/g
  const out = new Map()
  for (const m of html.matchAll(re)) {
    const slug = m[1]
    const name = m[2].trim()
    if (!out.has(slug)) out.set(slug, name)
  }
  return out
}

// ── Main ──────────────────────────────────────────────────────

console.log('[aspca] fetching 3 toxicity lists...')

const listData = {}
for (const [animal, url] of Object.entries(LISTS)) {
  console.log(`[aspca]   fetching ${animal} list...`)
  const html = await fetchUrl(url)
  const plants = extractPlantsFromList(html)
  console.log(`[aspca]     ${plants.size} plants toxic to ${animal}`)
  listData[animal] = plants
}

// ── Build unified toxicity matrix ─────────────────────────────

const matrix = new Map() // slug → { slug, displayName, toxicTo: Set, detailUrl }

for (const [animal, plants] of Object.entries(listData)) {
  for (const [slug, displayName] of plants) {
    if (!matrix.has(slug)) {
      matrix.set(slug, {
        slug,
        displayName,
        toxicTo: new Set(),
        detailUrl: `https://www.aspca.org/pet-care/animal-poison-control/toxic-and-non-toxic-plants/${slug}`,
      })
    }
    matrix.get(slug).toxicTo.add(animal)
  }
}

// Serialize Sets to arrays
const output = {}
for (const [slug, entry] of matrix) {
  output[slug] = {
    ...entry,
    toxicTo: [...entry.toxicTo].sort(),
  }
}

// ── Stats ─────────────────────────────────────────────────────

const totalUnique = Object.keys(output).length
const toCatsOnly = Object.values(output).filter(p => p.toxicTo.length === 1 && p.toxicTo[0] === 'cats').length
const toDogsOnly = Object.values(output).filter(p => p.toxicTo.length === 1 && p.toxicTo[0] === 'dogs').length
const toAll3 = Object.values(output).filter(p => p.toxicTo.length === 3).length

console.log()
console.log('=== ASPCA TOXICITY MATRIX ===')
console.log(`Unique toxic plants:         ${totalUnique}`)
console.log(`  Toxic to ALL 3 (cats+dogs+horses): ${toAll3}`)
console.log(`  Toxic to cats only:         ${toCatsOnly}`)
console.log(`  Toxic to dogs only:         ${toDogsOnly}`)
console.log()

// Sample popular houseplants check
const sampleSlugs = ['aloe', 'monstera-deliciosa', 'philodendron', 'pothos-or-devils-ivy',
                     'sago-palm', 'tulip', 'azalea', 'oleander', 'lily', 'dieffenbachia',
                     'sansevieria-trifasciata', 'zz-plant', 'pilea', 'snake-plant']
console.log('=== POPULAR HOUSEPLANT TOXICITY CHECK ===')
for (const slug of sampleSlugs) {
  const entry = output[slug]
  if (entry) {
    console.log(`  ⚠️  ${entry.displayName.padEnd(30)} toxic to: ${entry.toxicTo.join(', ')}`)
  } else {
    console.log(`  ✓ ${slug.padEnd(30)} NOT in toxic list (likely safe or not in DB)`)
  }
}

// Write output
const final = {
  generatedAt: new Date().toISOString(),
  source: 'ASPCA Animal Poison Control — toxic plant lists per animal',
  url: 'https://www.aspca.org/pet-care/animal-poison-control/toxic-and-non-toxic-plants',
  totalUniquePlants: totalUnique,
  toxicity: output,
}

writeFileSync(OUTPUT, JSON.stringify(final, null, 2))
console.log(`\n[aspca] wrote ${OUTPUT}`)
