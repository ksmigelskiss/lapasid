// Combine AHS + Beckett + Cheng → data/pre-db.json
//
// Trijų šaltinių unifikuotas plant registry:
//   • AHS (2011) — encyclopedic breadth (1466 genčių)
//   • Beckett (1995) — tropical houseplant + fern depth (667 genčių)
//   • Cheng (2019) — 19 modern trendy houseplant profiles su deep care info
//
// SCHEMA:
//   {
//     PHILODENDRON: {
//       genus: "PHILODENDRON",
//       family: "ARACEAE",            ← derived (priority: ahs > beckett)
//       commonName: "Heartleaf Philodendron",  ← from Cheng arba derived
//       origin: "Tropical Central and South America",
//       kind: "evergreen shrubs and climbers",
//       inSources: ["ahs", "beckett", "cheng"],
//       species: {
//         hederaceum: {
//           latinName: "Philodendron hederaceum",
//           commonName: "Heartleaf Philodendron",
//           synonyms: ["P. scandens", "P. oxycardium"],
//           zones: { usdaMin, usdaMax, ahsMin, ahsMax },
//           dimensions: { heightImp, heightMetric, ... },
//           description: "...",
//           sources: ["ahs", "cheng"]
//         },
//         ...
//       },
//       speciesCount: 23,
//       chengProfile: { ... }  ← TIK kai Cheng turi šitą gentį (premium care)
//     }
//   }
//
// MERGE TAISYKLĖS:
//   • Family — priority: ahs (modern taxonomy) > beckett (older)
//   • Common name — priority: cheng > ahs > beckett
//   • Description — concatenate all sources (mark provenance)
//   • Species merge — union by species epithet; synonyms collected
//   • Cheng profile — atached kaip atskiras `chengProfile` field, NEPERSURE'inant
//                     baseline duomenų (kad downstream RAG'as galėtų tiek
//                     AHS/Beckett encyclopedic data, tiek Cheng experiential
//                     panaudoti atskirai)

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const AHS_PATH     = join(__dirname, '..', 'data', 'ahs.json')
const BECKETT_PATH = join(__dirname, '..', 'data', 'beckett.json')
const CHENG_PATH   = join(__dirname, '..', 'data', 'cheng.json')
const OUTPUT       = join(__dirname, '..', 'data', 'pre-db.json')

// ── Load sources ──────────────────────────────────────────────

console.log('[combine] loading sources...')
const ahs     = JSON.parse(readFileSync(AHS_PATH, 'utf-8'))
const beckett = JSON.parse(readFileSync(BECKETT_PATH, 'utf-8'))
const cheng   = JSON.parse(readFileSync(CHENG_PATH, 'utf-8'))

console.log(`[combine]   AHS:     ${ahs.genera.length} genera, ${ahs.entryCount} entries`)
console.log(`[combine]   Beckett: ${beckett.genera.length} genera, ${beckett.speciesCount} species`)
console.log(`[combine]   Cheng:   ${cheng.profileCount} profiles`)

// ── Build genus-level merged registry ─────────────────────────

/**
 * Canonical genus key normalization. Both AHS and Beckett use uppercase, so
 * direct match works.
 */
function genusKey(genus) {
  return genus.toUpperCase().trim()
}

/**
 * Canonical species epithet from latinAbbrev "G. species" or "G. 'Cultivar'".
 * Returns the species part or cultivar string.
 */
function speciesKeyFromAhs(latinAbbrev) {
  // "G. hederaceum" → "hederaceum"
  // "G. 'Pink Princess'" → "'Pink Princess'"
  const m = latinAbbrev.match(/^[A-Z]\.\s+(.+)$/)
  return m ? m[1].trim() : latinAbbrev
}

function speciesKeyFromBeckett(latinAbbrev) {
  // Same format: "P. hederaceum"
  const m = latinAbbrev.match(/^[A-Z]\.\s+(.+)$/)
  return m ? m[1].trim() : latinAbbrev
}

const registry = new Map() // genusKey → merged entry

function ensureGenus(genus) {
  const key = genusKey(genus)
  if (!registry.has(key)) {
    registry.set(key, {
      genus: key,
      family: null,
      familySource: null,
      commonName: null,
      commonNameSource: null,
      origin: null,
      kind: null,
      etymology: null,
      introText: null,
      inSources: new Set(),
      species: new Map(), // speciesKey → species entry
      chengProfile: null,
    })
  }
  return registry.get(key)
}

// ── Pass 1: AHS (primary source for modern taxonomy + breadth) ──

console.log('[combine] merging AHS...')
for (const g of ahs.genera) {
  const entry = ensureGenus(g.genus)
  entry.inSources.add('ahs')

  // Family — AHS is primary (modern taxonomy)
  if (!entry.family && g.family) {
    entry.family = g.family
    entry.familySource = 'ahs'
  }

  // Intro text — store from AHS
  if (!entry.introText && g.introText) {
    entry.introText = g.introText
  }

  // Species — add each AHS entry
  for (const e of g.entries) {
    const sk = speciesKeyFromAhs(e.latinAbbrev)
    if (!sk) continue

    if (!entry.species.has(sk)) {
      entry.species.set(sk, {
        speciesKey: sk,
        latinName: `${g.genus.charAt(0)}${g.genus.slice(1).toLowerCase()} ${sk}`,
        species: e.species,
        cultivar: e.cultivar,
        commonName: e.commonName,
        synonyms: new Set(e.synonyms ?? []),
        zones: e.zones,
        dimensions: e.dimensions,
        minTemp: e.minTemp,
        seeRef: e.seeRef,
        illusPage: e.illusPage,
        description: e.description,
        sources: new Set(['ahs']),
      })
    } else {
      // Merge into existing
      const sp = entry.species.get(sk)
      sp.sources.add('ahs')
      if (e.synonyms) for (const s of e.synonyms) sp.synonyms.add(s)
      // Prefer AHS zones if present
      if (e.zones && !sp.zones) sp.zones = e.zones
      if (e.dimensions && !sp.dimensions) sp.dimensions = e.dimensions
    }
  }
}

// ── Pass 2: Beckett (fallback + tropical depth) ───────────────

console.log('[combine] merging Beckett...')
for (const g of beckett.genera) {
  const entry = ensureGenus(g.genus)
  entry.inSources.add('beckett')

  // Family — only if AHS didn't have it
  if (!entry.family && g.family) {
    entry.family = g.family
    entry.familySource = 'beckett'
  }

  // Origin / kind / etymology — Beckett often has these
  if (!entry.origin && g.origin) entry.origin = g.origin
  if (!entry.kind && g.kind) entry.kind = g.kind
  if (!entry.etymology && g.etymology) entry.etymology = g.etymology
  if (!entry.introText && g.introText) entry.introText = g.introText

  // Species — add Beckett entries
  for (const s of g.species) {
    const sk = speciesKeyFromBeckett(s.latinAbbrev)
    if (!sk) continue

    const genusProperCase = `${g.genus.charAt(0)}${g.genus.slice(1).toLowerCase()}`

    if (!entry.species.has(sk)) {
      entry.species.set(sk, {
        speciesKey: sk,
        latinName: `${genusProperCase} ${sk}`,
        species: s.species,
        cultivar: null,
        commonName: null,
        synonyms: new Set(s.synonyms ?? []),
        zones: null,
        dimensions: null,
        minTemp: null,
        seeRef: null,
        illusPage: null,
        description: s.description,
        beckettTemperature: s.temperature, // Beckett-specific: Cool/Temperate/Tropical
        beckettCultivars: s.cultivars ?? [],
        sources: new Set(['beckett']),
      })
    } else {
      const sp = entry.species.get(sk)
      sp.sources.add('beckett')
      if (s.synonyms) for (const syn of s.synonyms) sp.synonyms.add(syn)
      // Add Beckett-specific fields if AHS didn't have them
      if (s.temperature && !sp.beckettTemperature) sp.beckettTemperature = s.temperature
      if (s.cultivars?.length > 0 && !sp.beckettCultivars) sp.beckettCultivars = s.cultivars
      // Append Beckett description if more detailed
      if (s.description && s.description.length > (sp.description?.length ?? 0)) {
        sp.beckettDescription = s.description // preserve both
      }
    }
  }
}

// Manual family fixups — for genera that ONLY exist in Cheng (which doesn't
// store family info). Without these the genus would have family=null, which
// breaks downstream taxonGroup logic.
const CHENG_FAMILY_OVERRIDES = {
  MICROSORUM:   'Polypodiaceae',
  AEGAGROPILA:  'Pithophoraceae', // green algae, not actually a "plant" but lives in tanks
  PACHIRA:      'Malvaceae',
  ZAMIOCULCAS:  'Araceae',
}

// ── Pass 3: Cheng (premium care overlay for 19 plants) ────────

console.log('[combine] overlaying Cheng profiles...')
let chengMatched = 0
let chengSpeciesAttached = 0

for (const profile of cheng.profiles) {
  if (!profile.latin) continue

  const genus = profile.latin.genus.toUpperCase()
  const entry = ensureGenus(genus)
  entry.inSources.add('cheng')
  chengMatched++

  // Common name (Cheng has the user-friendly "Pothos", "ZZ Plant")
  if (!entry.commonName || entry.commonNameSource !== 'cheng') {
    entry.commonName = profile.commonName
    entry.commonNameSource = 'cheng'
  }

  // Family fallback for Cheng-only genera (otherwise null breaks downstream)
  if (!entry.family && CHENG_FAMILY_OVERRIDES[genus]) {
    entry.family = CHENG_FAMILY_OVERRIDES[genus]
    entry.familySource = 'manual-cheng-fix'
  }

  // Attach the full Cheng profile (premium care info)
  // Will be used downstream as RAG context for AI augmentation
  entry.chengProfile = {
    commonName: profile.commonName,
    chapter: profile.chapter,
    intro: profile.intro,
    survivalStrategy: profile.survivalStrategy,
    growthStrategy: profile.growthStrategy,
    subjectiveLifeSpan: profile.subjectiveLifeSpan,
    observationsCount: profile.observations.length,
    observations: profile.observations,
    notes: profile.latin.notes,
  }

  // If Cheng specifies a particular species (e.g. Pilea peperomioides),
  // also attach the profile to that species entry — and CREATE the species
  // entry if AHS/Beckett didn't have it.
  if (profile.latin.species) {
    const sk = profile.latin.species
    const genusProperCase = `${genus.charAt(0)}${genus.slice(1).toLowerCase()}`

    if (!entry.species.has(sk)) {
      // NEW species — Cheng covers Zamioculcas zamiifolia, Pilea peperomioides
      // that AHS/Beckett miss
      entry.species.set(sk, {
        speciesKey: sk,
        latinName: `${genusProperCase} ${sk}`,
        species: sk,
        cultivar: null,
        commonName: profile.commonName,
        synonyms: new Set(),
        zones: null,
        dimensions: null,
        minTemp: null,
        seeRef: null,
        illusPage: null,
        description: profile.intro?.slice(0, 800) ?? null,
        sources: new Set(['cheng']),
      })
      chengSpeciesAttached++
    } else {
      const sp = entry.species.get(sk)
      sp.sources.add('cheng')
      // Set common name from Cheng if not already set
      if (!sp.commonName) sp.commonName = profile.commonName
    }
  }
}

console.log(`[combine] Cheng: ${chengMatched} profiles matched to genera, ${chengSpeciesAttached} new species created`)

// ── Serialize for output (convert Sets/Maps to arrays/objects) ──

const generaOut = {}
for (const [key, entry] of registry.entries()) {
  const speciesObj = {}
  for (const [sk, sp] of entry.species.entries()) {
    speciesObj[sk] = {
      ...sp,
      synonyms: [...sp.synonyms],
      sources: [...sp.sources],
    }
  }
  generaOut[key] = {
    ...entry,
    inSources: [...entry.inSources],
    species: speciesObj,
    speciesCount: entry.species.size,
  }
}

// ── Audit / stats ─────────────────────────────────────────────

const generaArr = Object.values(generaOut)
const totalSpecies = generaArr.reduce((s, g) => s + g.speciesCount, 0)

// Source coverage
const onlyAhs       = generaArr.filter(g => g.inSources.length === 1 && g.inSources[0] === 'ahs').length
const onlyBeckett   = generaArr.filter(g => g.inSources.length === 1 && g.inSources[0] === 'beckett').length
const onlyCheng     = generaArr.filter(g => g.inSources.length === 1 && g.inSources[0] === 'cheng').length
const inMultiple    = generaArr.filter(g => g.inSources.length >= 2).length
const inAll3        = generaArr.filter(g => g.inSources.length === 3).length
const withCheng     = generaArr.filter(g => g.chengProfile).length

console.log()
console.log('=== COMBINED PRE-DB AUDIT ===')
console.log()
console.log(`Total unique genera:       ${generaArr.length}`)
console.log(`Total species/cultivars:   ${totalSpecies}`)
console.log()
console.log(`Source coverage:`)
console.log(`  AHS only:           ${onlyAhs}`)
console.log(`  Beckett only:       ${onlyBeckett}`)
console.log(`  Cheng only:         ${onlyCheng}`)
console.log(`  ≥2 sources:         ${inMultiple}`)
console.log(`  All 3 sources:      ${inAll3}`)
console.log(`  With Cheng profile: ${withCheng}`)
console.log()

// Family quality
const withFamily = generaArr.filter(g => g.family).length
console.log(`With family:             ${withFamily} (${Math.round(withFamily/generaArr.length*100)}%)`)

// Zone coverage
let speciesWithZones = 0
let speciesWithDims = 0
for (const g of generaArr) {
  for (const sk in g.species) {
    if (g.species[sk].zones) speciesWithZones++
    if (g.species[sk].dimensions) speciesWithDims++
  }
}
console.log(`Species with USDA zones: ${speciesWithZones} (${Math.round(speciesWithZones/totalSpecies*100)}%)`)
console.log(`Species with dimensions: ${speciesWithDims} (${Math.round(speciesWithDims/totalSpecies*100)}%)`)

// Houseplant top-100 coverage check
console.log()
console.log('=== POPULAR LT HOUSEPLANT COVERAGE CHECK ===')
const popularPlants = [
  // Trendy modern
  ['ZAMIOCULCAS', 'zamiifolia', 'ZZ Plant'],
  ['PILEA', 'peperomioides', 'Chinese money plant'],
  ['MONSTERA', 'deliciosa', 'Swiss cheese plant'],
  ['EPIPREMNUM', 'aureum', 'Pothos'],
  ['SANSEVIERIA', 'trifasciata', 'Snake plant'],
  ['SPATHIPHYLLUM', 'wallisii', 'Peace lily'],
  // Classic houseplants
  ['FICUS', 'lyrata', 'Fiddle leaf fig'],
  ['FICUS', 'benjamina', 'Weeping fig'],
  ['DRACAENA', 'marginata', 'Madagascar dragon tree'],
  ['CHLOROPHYTUM', 'comosum', 'Spider plant'],
  ['BEAUCARNEA', 'recurvata', 'Ponytail palm'],
  // Foliage
  ['CALATHEA', 'lancifolia', 'Rattlesnake plant'],
  ['MARANTA', 'leuconeura', 'Prayer plant'],
  ['PHILODENDRON', 'hederaceum', 'Heartleaf philodendron'],
  ['ANTHURIUM', 'andraeanum', 'Flamingo flower'],
  ['ALOCASIA', 'amazonica', 'Polly'],
  ['SYNGONIUM', 'podophyllum', 'Arrowhead'],
  // Succulents
  ['CRASSULA', 'ovata', 'Jade plant'],
  ['ECHEVERIA', 'elegans', 'Mexican snowball'],
  ['HAWORTHIA', 'fasciata', 'Zebra plant'],
  ['ALOE', 'vera', 'Aloe vera'],
  ['KALANCHOE', 'blossfeldiana', 'Flaming katy'],
  ['EUPHORBIA', 'trigona', 'African milk tree'],
  // Ferns
  ['NEPHROLEPIS', 'exaltata', 'Boston fern'],
  ['ADIANTUM', 'raddianum', 'Delta maidenhair'],
  ['PLATYCERIUM', 'bifurcatum', 'Staghorn fern'],
  // Begonias + flowering
  ['BEGONIA', 'rex', 'Rex begonia'],
  ['SAINTPAULIA', 'ionantha', 'African violet'],
  ['CYCLAMEN', 'persicum', 'Persian cyclamen'],
  ['STREPTOCARPUS', 'rexii', 'Cape primrose'],
]

let foundGenus = 0, foundSpecies = 0
for (const [genus, species, label] of popularPlants) {
  const g = generaOut[genus]
  if (!g) {
    console.log(`  ❌ ${label.padEnd(30)} ${genus.padEnd(15)} — GENUS NOT FOUND`)
    continue
  }
  foundGenus++
  const sp = g.species[species]
  const status = sp
    ? `✓ (${[...sp.sources].join(', ')})${sp.zones ? ' +zones' : ''}${sp.dimensions ? ' +dims' : ''}`
    : `~ genus only (${g.inSources.join(', ')})`
  if (sp) foundSpecies++
  console.log(`  ${sp ? '✅' : '🟡'} ${label.padEnd(30)} ${(genus+' '+species).padEnd(28)} ${status}`)
}
console.log()
console.log(`Top-${popularPlants.length} coverage: genus ${foundGenus}/${popularPlants.length} (${Math.round(foundGenus/popularPlants.length*100)}%), species ${foundSpecies}/${popularPlants.length} (${Math.round(foundSpecies/popularPlants.length*100)}%)`)

// ── Output ────────────────────────────────────────────────────

const output = {
  generatedAt: new Date().toISOString(),
  sources: {
    ahs:     { name: ahs.source,     genera: ahs.genera.length,     entries: ahs.entryCount },
    beckett: { name: beckett.source, genera: beckett.genera.length, entries: beckett.speciesCount },
    cheng:   { name: cheng.source,   profiles: cheng.profileCount },
  },
  stats: {
    totalGenera: generaArr.length,
    totalSpecies,
    speciesWithZones,
    speciesWithDimensions: speciesWithDims,
    withChengProfile: withCheng,
    inMultipleSources: inMultiple,
    inAll3Sources: inAll3,
  },
  genera: generaOut,
}

writeFileSync(OUTPUT, JSON.stringify(output, null, 2), 'utf-8')
const sizeMB = (JSON.stringify(output).length / 1024 / 1024).toFixed(1)
console.log(`\n[combine] wrote ${OUTPUT} (${sizeMB} MB)`)
