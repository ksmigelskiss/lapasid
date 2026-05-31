/* eslint-disable */
// Audit-only script (READ-ONLY). Quantifies cross-species and cross-genus
// pollution in data/lt-names.json `ltAllForms` arrays.
//
// Klasifikacija per kiekvieną ltAllForms entry kiekvienam genus įrašui:
//   • clean         — variant/transliteration of genus ltName (vienažodis, normalized form ~= genus)
//   • species-pol   — atrodo kaip species-level LT pavadinimas (>=2 žodžiai, antras = descriptor adjective)
//   • cross-genus   — atitinka KITO genus įrašo ltName (reverse-map collision)
//   • unknown       — neatitinka nei vieno aukščiau (ambiguous)
//
// Naudojimas:
//   node scripts/audit-lt-names-pollution.mjs
//
// Tik JSON parsing — nereikalauja network'o, idempotent.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LT_NAMES = join(__dirname, '..', 'data', 'lt-names.json')

// ── Normalizacija (lygtai tokia pati kaip build-lt-names.mjs) ──
function normalizeForCompare(name) {
  if (!name) return ''
  let n = name.toLowerCase()
    .replace(/[āîī]/g, 'i')
    .replace(/ū/g, 'u')
    .replace(/[ąa]/g, 'a')
    .replace(/[ęe]/g, 'e')
    .replace(/[ėè]/g, 'e')
    .replace(/[čć]/g, 'c')
    .replace(/[šś]/g, 's')
    .replace(/[žź]/g, 'z')
    .replace(/\s+/g, '')
  n = n.replace(/(es|ai|iai|os)$/, m => {
    switch (m) {
      case 'es':  return 'e'
      case 'ai':  return 'a'
      case 'iai': return 'is'
      case 'os':  return 'a'
      default:    return m
    }
  })
  return n
}

// LT descriptor adjective endings (singular + plural).
// Real species names follow pattern "[noun] [adjective]" e.g. „sansevjera trijuostė",
// „aspidistra aukštoji", „kaktusas kalėdinis".
const DESCRIPTOR_SUFFIXES = [
  // Adjective endings (singular)
  /(asis|oji|inis|inė|asis|asis|aus|usis)$/i,
  // Direct common adjective endings
  /(uotas|uota|uotė|uotis|astas|asta|tinis|tinė)$/i,
  // Lithuanian generic adj endings: -as -is -us masc, -a -ė fem (after at least 4 chars)
  // (saugu naudot tik kai jau yra 2+ žodžiai – pirmas žodis = genus noun)
]

function looksLikeSpeciesAdjective(word) {
  if (!word || word.length < 4) return false
  if (DESCRIPTOR_SUFFIXES.some(re => re.test(word))) return true
  // Fallback: bet kuris žodis su LT diacritic ar ilgesnis nei 5 raidės
  // ir su tipišku adjective ending — labai daug false positives, todėl konservatyviai:
  return false
}

// ── Load ────────────────────────────────────────────────────────
const root = JSON.parse(readFileSync(LT_NAMES, 'utf-8'))
const ltNames = root.ltNames

// ── Build genus-name reverse map (normalized → latin genus) ────
const genusNameMap = new Map() // normalized form → Set(Latin genus key)
for (const [latin, entry] of Object.entries(ltNames)) {
  if (!entry.ltName) continue
  const norm = normalizeForCompare(entry.ltName)
  if (!norm) continue
  if (!genusNameMap.has(norm)) genusNameMap.set(norm, new Set())
  genusNameMap.get(norm).add(latin)
}

// ── Classification ─────────────────────────────────────────────
function classify(form, genusLatin, genusLtName) {
  if (!form) return 'unknown'
  const trimmed = form.trim()
  const words = trimmed.split(/\s+/)
  const normForm = normalizeForCompare(trimmed)
  const normGenusLt = normalizeForCompare(genusLtName || '')

  // Single-word forms: likely transliteration variant of genus name.
  // If normalized = normalized genus name → definitely clean.
  if (words.length === 1) {
    if (normForm === normGenusLt) return 'clean'
    // Check cross-genus: ar normForm sutampa su KITO genus ltName?
    const owners = genusNameMap.get(normForm)
    if (owners && !owners.has(genusLatin)) return 'cross-genus'
    // Single word but skirtingas — verting clean (alternative LT genus name)
    return 'clean'
  }

  // 2+ words: tikrai patikrint cross-genus pirmiausia
  const owners = genusNameMap.get(normForm)
  if (owners && !owners.has(genusLatin)) return 'cross-genus'

  // 2 words: tipinis species LT name pattern „[genus noun] [adj]"
  // arba „[adj] [genus noun]". Jei vienas iš žodžių yra adjective-shape
  // ir kitas atitinka genus name normalized formą → SPECIES POLLUTED.
  if (words.length >= 2) {
    // Pažiūrim ar yra žodis, kuris (po normalizacijos) atitinka genus ltName
    const matchesGenusWord = words.some(w => {
      const wn = normalizeForCompare(w)
      return wn && wn === normGenusLt
    })
    const hasAdjectiveWord = words.some(w => looksLikeSpeciesAdjective(w))
    if (matchesGenusWord && hasAdjectiveWord) return 'species-polluted'
    // Even if no clear adjective match, 2-word form that CONTAINS genus name + descriptor
    // is highly suspicious for species pollution.
    if (matchesGenusWord && words.length >= 2) return 'species-polluted'
    // 2-word form that doesn't contain genus root and isn't cross-genus → unknown
    return 'unknown'
  }
  return 'unknown'
}

// ── Iteracija per visas entries ────────────────────────────────
const perEntry = []
let totalGenera = 0
let withAllForms = 0
let entriesSpeciesPolluted = 0
let entriesCrossGenus = 0
let entriesUnknown = 0

let totalForms = 0
let totalClean = 0
let totalSpecies = 0
let totalCross = 0
let totalUnknown = 0

for (const [latin, entry] of Object.entries(ltNames)) {
  totalGenera++
  const forms = entry.ltAllForms ?? []
  if (forms.length === 0) continue
  withAllForms++

  const classifications = forms.map(f => ({
    form: f,
    class: classify(f, latin, entry.ltName),
  }))

  const speciesPol = classifications.filter(c => c.class === 'species-polluted')
  const crossGen   = classifications.filter(c => c.class === 'cross-genus')
  const unknown    = classifications.filter(c => c.class === 'unknown')

  totalForms     += forms.length
  totalClean     += classifications.filter(c => c.class === 'clean').length
  totalSpecies   += speciesPol.length
  totalCross     += crossGen.length
  totalUnknown   += unknown.length

  const pollutionCount = speciesPol.length + crossGen.length
  if (speciesPol.length > 0) entriesSpeciesPolluted++
  if (crossGen.length > 0)   entriesCrossGenus++
  if (unknown.length > 0)    entriesUnknown++

  perEntry.push({
    latin,
    ltName: entry.ltName,
    forms,
    classifications,
    pollutionCount,
    sources: entry.sources,
    confidence: entry.confidence,
  })
}

// ── Sort + top offenders ───────────────────────────────────────
perEntry.sort((a, b) => b.pollutionCount - a.pollutionCount)
const polluted = perEntry.filter(e => e.pollutionCount > 0)

console.log('=== LT-NAMES.JSON POLLUTION AUDIT ===\n')
console.log(`Total genera entries:                   ${totalGenera}`)
console.log(`Entries with ltAllForms (non-empty):    ${withAllForms}`)
console.log()
console.log(`Total ltAllForms entries (across all):  ${totalForms}`)
console.log(`  clean (genus variant):                ${totalClean}   (${(totalClean/totalForms*100).toFixed(1)}%)`)
console.log(`  species-polluted:                     ${totalSpecies}   (${(totalSpecies/totalForms*100).toFixed(1)}%)`)
console.log(`  cross-genus:                          ${totalCross}   (${(totalCross/totalForms*100).toFixed(1)}%)`)
console.log(`  unknown / ambiguous:                  ${totalUnknown}   (${(totalUnknown/totalForms*100).toFixed(1)}%)`)
console.log()
console.log(`Entries with >=1 species-polluted:      ${entriesSpeciesPolluted}`)
console.log(`Entries with >=1 cross-genus:           ${entriesCrossGenus}`)
console.log(`Entries with >=1 unknown:               ${entriesUnknown}`)
console.log(`Entries with ANY pollution:             ${polluted.length}`)
console.log()

console.log('=== TOP 20 WORST OFFENDER GENERA ===\n')
for (const e of polluted.slice(0, 20)) {
  const polClasses = e.classifications
    .filter(c => c.class !== 'clean')
    .map(c => `${c.form} [${c.class}]`)
  console.log(`${e.latin.padEnd(22)} ltName=${(e.ltName ?? '∅').padEnd(20)} pollution=${e.pollutionCount}`)
  for (const p of polClasses) {
    console.log(`    • ${p}`)
  }
}
console.log()

console.log('=== EXAMPLE SPECIES-POLLUTION CASES (first 30) ===\n')
const speciesCases = perEntry
  .filter(e => e.classifications.some(c => c.class === 'species-polluted'))
  .slice(0, 30)
for (const e of speciesCases) {
  const sp = e.classifications.filter(c => c.class === 'species-polluted').map(c => c.form)
  console.log(`  ${e.latin.padEnd(22)} → ${sp.join(' | ')}`)
}
console.log()

console.log('=== EXAMPLE CROSS-GENUS CASES (first 30) ===\n')
const crossCases = perEntry
  .filter(e => e.classifications.some(c => c.class === 'cross-genus'))
  .slice(0, 30)
for (const e of crossCases) {
  const xs = e.classifications.filter(c => c.class === 'cross-genus').map(c => {
    const owners = genusNameMap.get(normalizeForCompare(c.form))
    const ownerList = owners ? [...owners].filter(o => o !== e.latin).join(',') : '?'
    return `${c.form} (=${ownerList})`
  })
  console.log(`  ${e.latin.padEnd(22)} → ${xs.join(' | ')}`)
}
console.log()
