// Kombinuoja TRIJŲ šaltinių LT names į vieną dataset su trust score.
//
// Įvestys:
//   data/lt-names-wiki.json    — Wikipedia LT API rezultatai (auto-redirect Latin→LT)
//   data/plants.json           — botanikos žodynas (~5786 entries, su corruption)
//   data/derlingas-pairs.json  — derlingas.lt scrape'inti LT/Latin pairs (PRAKTINIAI)
//   data/pre-db.json           — mūsų master gentis sąrašas
//
// Išvestis:
//   data/lt-names.json
//   {
//     "Monstera": {
//       latin: "Monstera",
//       ltName: "Monstera",
//       ltAlternatives: ["Filodendras"],   ← jei kita šaltinis siūlo kitokį
//       sources: ["wiki", "plants", "derlingas"],
//       confidence: "high",                ← 3 source agreement = highest
//       conflicts: null,
//       ...
//     }
//   }
//
// TRUST SCORING (atnaujinta):
//   high   — 3 šaltiniai sutampa, ARBA 2 sutampa (Wiki+derlingas yra geriausi)
//   mid    — vienas šaltinis (be conflict)
//   low    — šaltiniai konfliktuoja (saugiausia žmogų'ą peržiūrėti)
//
// PRIORITY (kai keli šaltiniai turi skirtingus pavadinimus):
//   derlingas (praktinis vartojimas LT) > wiki (akademinis) > plants.json (legacy)

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const WIKI_PATH        = join(__dirname, '..', 'data', 'lt-names-wiki.json')
const PLANTS_PATH      = join(__dirname, '..', 'data', 'plants.json')
const DERLINGAS_PATH   = join(__dirname, '..', 'data', 'derlingas-pairs.json')
const SODOSPALVOS_PATH = join(__dirname, '..', 'data', 'sodospalvos-names.json')
const GASPADORIUS_PATH        = join(__dirname, '..', 'data', 'gaspadorius-names.json')
const GASPADORIUS_DETAIL_PATH = join(__dirname, '..', 'data', 'gaspadorius-detail.json')
const INAT_PATH               = join(__dirname, '..', 'data', 'inat-names.json')
const PRE_DB_PATH      = join(__dirname, '..', 'data', 'pre-db.json')
const OUTPUT           = join(__dirname, '..', 'data', 'lt-names.json')

// ── Helpers (defined early because used during main loop) ─────

const GARBAGE_PREFIXES = [
  /^(ir paplitimas)\s+/i,
  /^(dar vadinamas|vadinamas|vadinama|vadinami|vadinamos)\s+/i,
  /^(apie|tarp|kuris|kuri|kurie|kurios|tas|tai|šie|šios)\s+\w+\s+/i,
  /^(specialiai paruoštas|specialiai paruošta|specialiai paruošti)\s+/i,
  /^(rekomenduojamas|rekomenduojama|rekomenduojami)\s+(video|paveikslas|nuotrauka|video apie)\s+/i,
  /^(žiūr\.|žr\.|kaip\s)/i,
]

// Words that should NEVER appear in a real LT plant name (sentence connectors,
// descriptors). If any of these words appear, the "name" is scraping garbage.
const FORBIDDEN_WORDS = new Set([
  'atrodo', 'jų', 'jos', 'jis', 'ji', 'tačiau', 'bet',
  'apie', 'tarp', 'iš', 'su', 'be', 'po',
  'kuris', 'kuri', 'kurie', 'kurios',
  'ir', 'ar', 'arba', 'taip', 'pat',
  'dar', 'kaip', 'kad', 'jau',
  'gausu', 'gausi', 'gausus', 'gausa',
  'romantika', 'paplitimas', 'video', 'nuotrauka',
  'paveikslas', 'rekomenduojamas', 'paruoštas',
  'vadinamas', 'vadinami', 'rudens', 'pavasaris', 'specialiai',
  'ši', 'šis', 'šie', 'šios', 'tos', 'tas', 'tai',
])

function cleanLtName(name) {
  if (!name) return null
  let n = name.trim()
  // Strip known garbage prefixes (iterate until stable, max 3 passes)
  for (let i = 0; i < 3; i++) {
    let changed = false
    for (const re of GARBAGE_PREFIXES) {
      const stripped = n.replace(re, '')
      if (stripped !== n) { n = stripped; changed = true }
    }
    if (!changed) break
  }
  // Deduplicate repeated words — Unicode-aware (Lithuanian diacritics ė ą ž etc.)
  n = n.replace(/(\p{L}+)(?:\s+\1)+/giu, '$1')
  // Trim punctuation
  n = n.replace(/^[,.;:\-–—\s]+|[,.;:\-–—\s]+$/g, '')
  if (n.length < 3) return null
  // Reject if too long (likely sentence fragment, not a plant name)
  // Real LT plant names are 1-3 words. Anything longer = scraping noise.
  const words = n.split(/\s+/)
  if (words.length > 4) return null
  // Reject if any word is a forbidden connector/descriptor (means it's garbage)
  for (const w of words) {
    if (FORBIDDEN_WORDS.has(w.toLowerCase())) return null
  }
  return n
}

function detectPlural(name) {
  if (!name) return false
  const lastWord = name.trim().split(/\s+/).pop().toLowerCase()
  if (/(?:ai|ės|os|iai)$/.test(lastWord) && lastWord.length >= 5) return true
  return false
}

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

function extractLtFamily(wikiResult) {
  if (!wikiResult?.exists || !wikiResult.categories) return null
  for (const cat of wikiResult.categories) {
    const name = cat.replace(/^Kategorija:/, '')
    if (/^Straipsniai|^Kambariniai|^Žemės|^Dekoraty|^Augalai|^Biologijos|^Vaisiniai|^Žolelės/.test(name)) continue
    if (/iai$/.test(name) && name.length > 4) {
      return name
    }
  }
  return null
}

// ── Load all sources ──────────────────────────────────────────

const wiki   = JSON.parse(readFileSync(WIKI_PATH, 'utf-8'))
const plants = JSON.parse(readFileSync(PLANTS_PATH, 'utf-8'))
const preDb  = JSON.parse(readFileSync(PRE_DB_PATH, 'utf-8'))

// derlingas may not exist yet (scraper still running) — graceful fallback
let derlingasPairs = []
if (existsSync(DERLINGAS_PATH)) {
  const d = JSON.parse(readFileSync(DERLINGAS_PATH, 'utf-8'))
  derlingasPairs = d.pairs ?? []
  console.log(`[lt-names] derlingas: ${derlingasPairs.length} unique pairs from ${d.pagesScraped} pages`)
} else {
  console.log('[lt-names] derlingas: not available yet (scrape in progress)')
}

// sodospalvos may not exist yet (scraper still running)
let sodoPairs = []
if (existsSync(SODOSPALVOS_PATH)) {
  const d = JSON.parse(readFileSync(SODOSPALVOS_PATH, 'utf-8'))
  sodoPairs = d.pairs ?? []
  console.log(`[lt-names] sodospalvos: ${sodoPairs.length} unique pairs`)
} else {
  console.log('[lt-names] sodospalvos: not available yet (scrape in progress)')
}

// gaspadorius — catalog of LT names + URL slugs (no Latin in catalog;
// SLUG_TO_LATIN_MAP below maps known slugs to Latin genus names)
let gaspEntries = []
if (existsSync(GASPADORIUS_PATH)) {
  const d = JSON.parse(readFileSync(GASPADORIUS_PATH, 'utf-8'))
  gaspEntries = d.entries ?? []
  console.log(`[lt-names] gaspadorius catalog: ${gaspEntries.length} entries`)
}

// gaspadorius DETAIL — full Latin name resolution from article pages (217 pairs)
let gaspDetailPairs = []
if (existsSync(GASPADORIUS_DETAIL_PATH)) {
  const d = JSON.parse(readFileSync(GASPADORIUS_DETAIL_PATH, 'utf-8'))
  gaspDetailPairs = d.pairs ?? []
  console.log(`[lt-names] gaspadorius detail: ${gaspDetailPairs.length} LT→Latin pairs`)
}

// iNat — 6th source, community-curated LT vernacular names
let inatResults = {}
if (existsSync(INAT_PATH)) {
  const d = JSON.parse(readFileSync(INAT_PATH, 'utf-8'))
  inatResults = d.results ?? {}
  const withLt = Object.values(inatResults).filter(r => r.preferredLtName).length
  console.log(`[lt-names] iNat: ${Object.keys(inatResults).length} queried, ${withLt} with LT name`)
}

// MANUAL OVERRIDES — for genera not in any scraped source.
// Verified by user via gaspadorius search or other authoritative LT sources.
const MANUAL_LT_OVERRIDES = {
  Beaucarnea: {
    ltName: 'Riestalapis nukaris',
    ltSynonyms: ['Nolinos', 'Dramblio koja', 'Arklio uodega', 'Butelinė palmė'],
    source: 'gaspadorius.lt (article: Beaucarnea recurvata)',
  },
  // Add more here as user provides
}

console.log(`[lt-names] loaded wiki(${Object.keys(wiki.results).length}) plants(${plants.length}) preDb(${Object.keys(preDb.genera).length})`)

// ── Build plants.json indexes ─────────────────────────────────

// By full Latin (genus + species)
const plantsByLatin = new Map()
// By genus only
const plantsByGenus = new Map()

for (const p of plants) {
  const latin = p.latin.trim()
  plantsByLatin.set(latin.toLowerCase(), p)

  const genus = latin.split(/\s+/)[0]
  if (!plantsByGenus.has(genus)) {
    plantsByGenus.set(genus, [])
  }
  plantsByGenus.get(genus).push(p)
}

// ── Build derlingas indexes ───────────────────────────────────
// Derlingas pairs come pre-aggregated as { lt, latin, occurrences, sourceUrls }
// — we index by Latin (case-insensitive). If multiple LT names map to same Latin,
// pick the one with most occurrences (most popular usage).

const derlingasByLatin = new Map()
for (const p of derlingasPairs) {
  const latin = p.latin.toLowerCase()
  const existing = derlingasByLatin.get(latin)
  if (!existing || p.occurrences > existing.occurrences) {
    derlingasByLatin.set(latin, p)
  }
}
console.log(`[lt-names] derlingas indexed: ${derlingasByLatin.size} unique Latin keys`)

// ── Build sodospalvos indexes ─────────────────────────────────
// Sodospalvos has unique LT names per Latin (encyclopedia format).
const sodospalvosByLatin = new Map()
for (const p of sodoPairs) {
  if (!p.latin) continue
  sodospalvosByLatin.set(p.latin.toLowerCase(), p)
}
console.log(`[lt-names] sodospalvos indexed: ${sodospalvosByLatin.size} unique Latin keys`)

// ── Gaspadorius slug → Latin mapping (manual + auto) ──────────
//
// Gaspadorius catalog only has LT names + URL slugs (no Latin). We need to
// connect them to pre-DB Latin names. Two strategies:
//
//   1. MANUAL — for popular known plants where slug strongly suggests genus
//   2. FUZZY — match gasp's ltName to existing pre-DB ltNames from other sources
//
// SLUG_TO_LATIN maps known gaspadorius slugs to Latin genus.
const GASP_SLUG_TO_LATIN = {
  // Tier 1 critical fills
  'davalija':              'Davallia',
  'kenguros-letena':       'Microsorum',
  'pachira':               'Pachira',
  'seflera':               'Schefflera',
  'skindapas-kambarine-gele': 'Epipremnum',
  // Plus other clear matches
  'achimene':              'Achimenes',
  'adijantas':             'Adiantum',
  'aeonium':               'Aeonium',
  'aglaonema':             'Aglaonema',
  'akolifa':               'Acalypha',
  'alamanda':              'Allamanda',
  'alavijas-alijosius':    'Aloe',
  'alefandra':             'Aphelandra',
  'alokazija':             'Alocasia',
  'anturis':               'Anthurium',
  'ananasas':              'Ananas',
  'araukarija':            'Araucaria',
  'azalija-rododendras':   'Rhododendron',
  'ardizija':              'Ardisia',
  'aukstoji-aspidistra':   'Aspidistra',
  'avortija':              'Haworthia',
  'asotenis':              'Nepenthes',
  'bambukas':              'Bambusa',
}

const gaspadoriusByLatin = new Map()

// Step 1: index from hardcoded SLUG_TO_LATIN (legacy, ~23 entries)
for (const e of gaspEntries) {
  const latin = GASP_SLUG_TO_LATIN[e.slug]
  if (!latin) continue
  gaspadoriusByLatin.set(latin.toLowerCase(), e)
}

// Step 2: ADD from gasp-detail.json (217 pairs with Latin auto-extracted)
// Take only the GENUS part (first word) since pre-DB indexed by genus
for (const p of gaspDetailPairs) {
  const latinGenus = p.latinGenus || p.latin?.split(/\s+/)[0]
  if (!latinGenus) continue
  const key = latinGenus.toLowerCase()
  if (gaspadoriusByLatin.has(key)) continue // don't overwrite manual mappings
  gaspadoriusByLatin.set(key, {
    ltName: p.ltName,
    ltSynonyms: p.ltSynonyms ?? [],
    family: p.family ?? null,
    category: p.catalog,
    sourceUrl: p.sourceUrl,
  })
}

console.log(`[lt-names] gaspadorius indexed: ${gaspadoriusByLatin.size} mapped Latin keys (manual ${Object.keys(GASP_SLUG_TO_LATIN).length} + auto ${gaspDetailPairs.length})`)

// ── plants.json corruption filter ─────────────────────────────

/**
 * Returns { valid, flags } — flags is empty array if no corruption.
 * Flags: 'too-short' | 'non-lt-chars' | 'looks-latin'
 */
function plantsJsonCorruptionFlags(p) {
  const lt = (p?.lithuanian ?? '').trim()
  const flags = []
  if (!lt) flags.push('empty')
  if (lt.length < 4) flags.push('too-short')
  // Lithuanian uses: ą ę į ų ū ė č š ž (plus latin letters)
  // Suspect if contains: ā ī ĉ ĝ ĥ ĵ ŝ ŭ è ì ò ù ÿ ć ń ś ź ż (non-LT diacritics)
  if (/[āīĉĝĥĵŝŭèìòùÿćńśźż]/.test(lt)) flags.push('non-lt-chars')
  // NOTE: removed "looks-latin" check — many valid LT plant names look Latin
  // ("dracena", "begonija", "monstera"). The "non-LT-diacritics" check is
  // enough to catch real corruption.
  return { valid: flags.length === 0, flags }
}

// ── Build combined LT names per pre-DB genus ──────────────────

const ltNames = {}

for (const gKey of Object.keys(preDb.genera)) {
  // Properly cased Latin (e.g., PHILODENDRON → Philodendron)
  const latin = gKey.charAt(0) + gKey.slice(1).toLowerCase()

  // Source 1: Wikipedia LT
  const wikiResult = wiki.results[latin]
  const wikiHas = wikiResult?.exists
  const wikiName = wikiHas ? wikiResult.ltName : null

  // Source 2: plants.json
  const plantsResult = plantsByGenus.get(latin)?.find(
    p => p.latin.toLowerCase() === latin.toLowerCase()
  )
  const plantsCheck = plantsResult ? plantsJsonCorruptionFlags(plantsResult) : null
  const plantsHas = plantsResult && plantsCheck.valid
  const plantsName = plantsHas ? plantsResult.lithuanian : null

  // Source 3: derlingas.lt
  const derlingasResult = derlingasByLatin.get(latin.toLowerCase())
  const derlingasName = derlingasResult?.lt ?? null

  // Source 4: sodospalvos.lt
  const sodoResult = sodospalvosByLatin.get(latin.toLowerCase())
  const sodoName = sodoResult?.ltName ?? null

  // Source 5: gaspadorius.lt
  const gaspResult = gaspadoriusByLatin.get(latin.toLowerCase())
  const gaspName = gaspResult?.ltName ?? null
  const gaspSynonyms = gaspResult?.ltSynonyms ?? []

  // Source 6: iNat — community-curated LT vernacular
  const inatResult = inatResults[latin]
  const inatName = inatResult?.preferredLtName ?? null
  const inatSynonyms = inatResult?.ltNames ?? []
  const inatTaxonId = inatResult?.taxonId ?? null

  // Source 7: MANUAL OVERRIDES (highest priority — verified by human)
  const manualOverride = MANUAL_LT_OVERRIDES[latin]

  // Collect all candidates from all sources (with name cleanup)
  const candidates = []
  if (wikiName) {
    const cleaned = cleanLtName(wikiName)
    if (cleaned) candidates.push({ name: cleaned, src: 'wiki', raw: wikiName })
  }
  if (plantsName) {
    const cleaned = cleanLtName(plantsName)
    if (cleaned) candidates.push({ name: cleaned, src: 'plants', raw: plantsName })
  }
  if (derlingasName) {
    const cleaned = cleanLtName(derlingasName)
    if (cleaned) candidates.push({ name: cleaned, src: 'derlingas', raw: derlingasName })
  }
  if (sodoName) {
    const cleaned = cleanLtName(sodoName)
    if (cleaned) candidates.push({ name: cleaned, src: 'sodospalvos', raw: sodoName })
  }
  if (gaspName) {
    const cleaned = cleanLtName(gaspName)
    if (cleaned) candidates.push({ name: cleaned, src: 'gaspadorius', raw: gaspName })
  }
  // Add gaspadorius synonyms (e.g. "Alavijas, alijošius" → both names)
  for (const syn of gaspSynonyms) {
    const cleaned = cleanLtName(syn)
    if (cleaned) candidates.push({ name: cleaned, src: 'gaspadorius', raw: syn })
  }
  // iNat — community-curated LT name
  if (inatName) {
    const cleaned = cleanLtName(inatName)
    if (cleaned) candidates.push({ name: cleaned, src: 'inat', raw: inatName })
  }
  for (const syn of inatSynonyms) {
    const cleaned = cleanLtName(syn)
    if (cleaned) candidates.push({ name: cleaned, src: 'inat', raw: syn })
  }
  // Manual override — pushed last but with highest priority via preferOrder
  if (manualOverride) {
    candidates.push({ name: manualOverride.ltName, src: 'manual', raw: manualOverride.ltName })
    for (const syn of (manualOverride.ltSynonyms ?? [])) {
      candidates.push({ name: syn, src: 'manual', raw: syn })
    }
  }

  // Group by normalized form (collapses plural/singular variants + diacritic OCR)
  const groups = new Map() // normForm → [{name, src, isPlural}]
  for (const c of candidates) {
    const norm = normalizeForCompare(c.name)
    if (!groups.has(norm)) groups.set(norm, [])
    groups.get(norm).push({
      ...c,
      isPlural: detectPlural(c.name),
    })
  }

  // ── Within each group: pick singular over plural ──
  // For each normalized group, all variants represent SAME name (just plural/
  // singular/spelling variants). Pick the SINGULAR form as canonical.
  // This eliminates "kraujažolės" in favor of "Kraujažolė".
  function pickCanonical(group) {
    const singulars = group.filter(c => !c.isPlural)
    const plurals   = group.filter(c => c.isPlural)
    // Priority: manual > gaspadorius > sodospalvos > derlingas > wiki > inat > plants
    // (inat after wiki because Wiki LT has stronger editorial; iNat is community)
    const preferOrder = ['manual', 'gaspadorius', 'sodospalvos', 'derlingas', 'wiki', 'inat', 'plants']
    if (singulars.length > 0) {
      return singulars.sort((a, b) =>
        preferOrder.indexOf(a.src) - preferOrder.indexOf(b.src)
      )[0]
    }
    return plurals.sort((a, b) =>
      preferOrder.indexOf(a.src) - preferOrder.indexOf(b.src)
    )[0]
  }

  // ── Determine primary name + synonyms ─────────────────────
  let ltName = null
  let confidence = null
  let conflicts = null
  let sources = []
  let synonyms = []        // genuinely DIFFERENT names (different groups)

  if (candidates.length === 0) {
    if (plantsResult && !plantsCheck.valid) {
      conflicts = `plants.json=${plantsResult.lithuanian} (flags: ${plantsCheck.flags.join(',')})`
    }
  } else if (groups.size === 1) {
    // All sources agree (only plural/diacritic differences)
    const [group] = [...groups.values()]
    const winner = pickCanonical(group)
    ltName = winner.name
    sources = [...new Set(group.map(c => c.src))]
    confidence = sources.length >= 2 ? 'high' : 'mid'
  } else {
    // Multiple normalized groups = genuinely different names → SYNONYMS preserved
    const sortedGroups = [...groups.values()].sort((a, b) => b.length - a.length)
    const winningGroup = sortedGroups[0]
    const otherGroups  = sortedGroups.slice(1)
    const winner = pickCanonical(winningGroup)
    ltName = winner.name
    sources = [...new Set(winningGroup.map(c => c.src))]
    confidence = winningGroup.length >= 2 ? 'high' : 'mid'
    // Synonyms = canonical form of each "loser" group
    synonyms = otherGroups.map(grp => pickCanonical(grp).name)
    // Conflicts string for audit (shows source per synonym)
    conflicts = otherGroups.map(grp =>
      grp.map(c => `${c.name} (${c.src})`).join('=')
    ).join(' | ')
  }

  // ── Build ltAllForms = canonical + synonyms (for search index) ──
  const ltAllForms = []
  if (ltName) ltAllForms.push(ltName)
  for (const syn of synonyms) {
    if (!ltAllForms.includes(syn)) ltAllForms.push(syn)
  }

  ltNames[latin] = {
    latin,
    ltName,                  // canonical (singular, preferred source)
    ltSynonyms: synonyms,    // genuinely different LT names (skirtingi normalized)
    ltAllForms,              // search index: ltName + ltSynonyms
    ltFamily: extractLtFamily(wikiResult),
    wikidataId: wikiResult?.wikidataId ?? null,
    wikiUrl: wikiResult?.fullUrl ?? null,
    sources,
    confidence,
    conflicts,
    inatTaxonId,
    raw: {
      wiki: wikiName,
      plantsJson: plantsResult?.lithuanian ?? null,
      plantsJsonFamily: plantsResult?.family ?? null,
      plantsJsonFlags: plantsCheck?.flags ?? [],
      derlingas: derlingasName,
      derlingasOccurrences: derlingasResult?.occurrences ?? 0,
      sodospalvos: sodoName,
      sodospalvosFamily: sodoResult?.family ?? null,
      sodospalvosCategory: sodoResult?.category ?? null,
      inat: inatName,
      inatSynonymsCount: inatSynonyms.length,
    },
  }
}

// ── Audit / stats ─────────────────────────────────────────────

const total = Object.keys(ltNames).length
const withName = Object.values(ltNames).filter(n => n.ltName).length
const high     = Object.values(ltNames).filter(n => n.confidence === 'high').length
const mid      = Object.values(ltNames).filter(n => n.confidence === 'mid').length
const noName   = Object.values(ltNames).filter(n => !n.ltName).length
const conflicts = Object.values(ltNames).filter(n => n.conflicts).length

const fromWiki        = Object.values(ltNames).filter(n => n.sources?.includes('wiki')).length
const fromPlants      = Object.values(ltNames).filter(n => n.sources?.includes('plants')).length
const fromDerlingas   = Object.values(ltNames).filter(n => n.sources?.includes('derlingas')).length
const fromSodospalvos = Object.values(ltNames).filter(n => n.sources?.includes('sodospalvos')).length
const fromGaspadorius = Object.values(ltNames).filter(n => n.sources?.includes('gaspadorius')).length
const fromInat        = Object.values(ltNames).filter(n => n.sources?.includes('inat')).length
const allFour         = Object.values(ltNames).filter(n => n.sources?.length === 4).length
const allFive         = Object.values(ltNames).filter(n => n.sources?.length === 5).length
const allSix          = Object.values(ltNames).filter(n => n.sources?.length >= 6).length
const withSynonyms    = Object.values(ltNames).filter(n => n.ltSynonyms?.length > 0).length
const totalSynonyms   = Object.values(ltNames).reduce((s, n) => s + (n.ltSynonyms?.length ?? 0), 0)

console.log()
console.log('=== COMBINED LT NAMES STATS ===')
console.log(`Total pre-DB genera:        ${total}`)
console.log(`With LT name:               ${withName} (${(withName/total*100).toFixed(1)}%)`)
console.log(`  HIGH confidence:          ${high} (2+ sources agree on same name)`)
console.log(`  MID confidence:           ${mid} (single source)`)
console.log(`Without LT name:            ${noName}`)
console.log(`With synonyms:              ${withSynonyms} (total ${totalSynonyms} synonyms)`)
console.log(`Conflicts → synonyms now:   ${conflicts}`)
console.log()
console.log(`Source coverage:`)
console.log(`  from wiki:                ${fromWiki}`)
console.log(`  from plants-json:         ${fromPlants}`)
console.log(`  from derlingas.lt:        ${fromDerlingas}`)
console.log(`  from sodospalvos.lt:      ${fromSodospalvos}`)
console.log(`  from gaspadorius.lt:      ${fromGaspadorius}`)
console.log(`  from iNat:                ${fromInat}`)
console.log(`  all 4 sources agree:      ${allFour}`)
console.log(`  all 5 sources agree:      ${allFive}`)
console.log(`  all 6 sources agree:      ${allSix}`)
console.log()

// Houseplant top-30 check
const popularHouseplants = [
  'Monstera','Pilea','Ficus','Spathiphyllum','Zamioculcas','Calathea','Sansevieria',
  'Dracaena','Philodendron','Begonia','Crassula','Echeveria','Aloe','Kalanchoe',
  'Adiantum','Hosta','Hedera','Anthurium','Alocasia','Saintpaulia','Streptocarpus',
  'Chlorophytum','Tradescantia','Euphorbia','Nephrolepis','Platycerium','Schefflera',
  'Maranta','Cyclamen','Pothos','Epipremnum','Beaucarnea','Pachira','Davallia',
]

console.log('=== POPULAR HOUSEPLANTS COVERAGE ===')
let found = 0
for (const latin of popularHouseplants) {
  const entry = ltNames[latin]
  if (!entry) {
    console.log(`  ❓ ${latin.padEnd(18)} not in pre-DB`)
    continue
  }
  if (entry.ltName) {
    found++
    const tag = entry.confidence === 'high' ? '✅' : entry.confidence === 'mid' ? '🟡' : '⚠️'
    const synInfo = entry.ltSynonyms.length > 0 ? ` + syn: [${entry.ltSynonyms.join(', ')}]` : ''
    console.log(`  ${tag} ${latin.padEnd(18)} → ${entry.ltName.padEnd(20)} [${entry.sources.join('+')}, ${entry.confidence}]${synInfo}`)
  } else {
    console.log(`  ❌ ${latin.padEnd(18)} → NO LT NAME ${entry.conflicts ? '('+entry.conflicts+')' : ''}`)
  }
}
console.log()
console.log(`Popular houseplant coverage: ${found}/${popularHouseplants.length} (${(found/popularHouseplants.length*100).toFixed(0)}%)`)

// Sample entries with synonyms
console.log('\n=== SAMPLE ENTRIES WITH MULTIPLE SYNONYMS (preserved, not dismissed) ===')
const synSamples = Object.values(ltNames)
  .filter(n => n.ltSynonyms?.length > 0)
  .sort((a, b) => b.ltSynonyms.length - a.ltSynonyms.length)
  .slice(0, 10)
synSamples.forEach(n =>
  console.log(`  ${n.latin.padEnd(20)} canonical: ${n.ltName.padEnd(20)} synonyms: [${n.ltSynonyms.join(', ')}]`)
)

// ── Output ────────────────────────────────────────────────────

const output = {
  generatedAt: new Date().toISOString(),
  sources: [
    'Wikipedia LT', 'plants.json botanikos žodynas',
    'derlingas.lt scrape', 'sodospalvos.lt augalų enciklopedija',
  ],
  schema: {
    ltName:      'Canonical LT name (singular form, highest-trust source)',
    ltSynonyms:  'Other valid LT names (different normalized form, kept for search)',
    ltAllForms:  'ltName + ltSynonyms — used as search index',
    sources:     'Which scraped sources contained this name (any variant)',
    confidence:  '"high" if 2+ sources agree on same normalized name, "mid" if single',
  },
  stats: {
    totalGenera: total,
    withLtName: withName,
    highConfidence: high,
    midConfidence: mid,
    withSynonyms,
    totalSynonyms,
    fromWiki,
    fromPlants,
    fromDerlingas,
    fromSodospalvos,
    allFourSourcesAgree: allFour,
  },
  ltNames,
}

writeFileSync(OUTPUT, JSON.stringify(output, null, 2))
console.log(`\n[lt-names] wrote ${OUTPUT}`)
