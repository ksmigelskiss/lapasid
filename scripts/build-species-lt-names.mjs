// Build SPECIES-level LT vardų indeksą iš data/plants.json (5786 LT plant vardų,
// scrape'inta iš LT portalų). lt-names.json yra GENUS-keyed — todėl species
// vardai („Stambialapis fikusas" Ficus elastica) buvo prarasti, ir resolveLt
// grąžindavo tik gentį → genus-fallback name bug.
//
// Output: data/species-lt-names.json = { "<latin lowercased>": "<LT name>" }
// TIK multi-word (species/cultivar) latin'ams — gentį palieka lt-names.json
// (curated, teisingas „Alokazija" spelling). Naudoja resolveLt (client+server).
//
// USAGE: node scripts/build-species-lt-names.mjs

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dirname, '..', 'data')

const plants = JSON.parse(readFileSync(join(DATA, 'plants.json'), 'utf-8'))
// 2026-06-01 — overrides nuo lt-names-overrides.json species section'os.
// Naudojama curated fix'ams kur plants.json silent'as ar klaidingas (e.g.
// 2017 Sansevieria→Dracaena reclassification — plants.json scrape'inta tuo
// metu kai Sansevieria dar buvo atskira gentis, todėl Dracaena trifasciata
// nėra; overrides užpildo gap'ą).
const overrides = JSON.parse(readFileSync(join(DATA, 'lt-names-overrides.json'), 'utf-8'))
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

// 2026-06-01 — sanitize Latvian-style macrons (ā, ē, ī, ō) kurie patenka
// iš plants.json scrape'o klaidingo source'o (Latvian-LT mixed page, OCR
// errors). LT alphabet'e tokie chars NĖRA — tik ū (charCode 363) yra validus.
// 22 entries plants.json'e turi šitokias corruptions (Canna, Hoya carnosa,
// Hosta, Iris chamaeiris, etc.) — sanitize'inam į plain a/e/i/o.
function sanitizeLtMacrons(s) {
  if (!s || typeof s !== 'string') return s
  return s
    .replace(/ā/g, 'a').replace(/Ā/g, 'A')
    .replace(/ē/g, 'e').replace(/Ē/g, 'E')
    .replace(/ī/g, 'i').replace(/Ī/g, 'I')
    .replace(/ō/g, 'o').replace(/Ō/g, 'O')
}

const map = {}
let speciesSeen = 0
let dupes = 0
for (const e of plants) {
  if (!e?.latin || !e?.lithuanian) continue
  const latin = e.latin.trim()
  if (latin.split(/\s+/).length < 2) continue // tik species/cultivar (multi-word)
  speciesSeen++
  const key = latin.toLowerCase()
  if (key in map) { dupes++; continue } // first wins
  map[key] = sanitizeLtMacrons(cap(e.lithuanian.trim()))
}

// Apply curated overrides LAST (highest priority — overwrite plants.json
// duomenis kur reikia). Skip _comment_* meta keys.
let overrideCount = 0
let overrideAdded = 0
for (const [key, value] of Object.entries(overrides.species ?? {})) {
  if (key.startsWith('_')) continue
  const wasNew = !(key in map)
  map[key] = cap(value)
  overrideCount++
  if (wasNew) overrideAdded++
}

const sorted = Object.fromEntries(Object.keys(map).sort().map((k) => [k, map[k]]))
writeFileSync(join(DATA, 'species-lt-names.json'), JSON.stringify(sorted) + '\n')

console.log(`[build-species-lt] plants.json entries:   ${plants.length}`)
console.log(`[build-species-lt] multi-word (species):  ${speciesSeen}`)
console.log(`[build-species-lt] curated overrides:     ${overrideCount} (added: ${overrideAdded}, replaced: ${overrideCount - overrideAdded})`)
console.log(`[build-species-lt] unique species keys:   ${Object.keys(sorted).length} (dupes skipped: ${dupes})`)
console.log(`[build-species-lt] → data/species-lt-names.json`)
