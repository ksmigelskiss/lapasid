/**
 * build-lt-names-v2.mjs — Clean rebuild of lt-names.json + species-lt-names.json
 *
 * VAIDMUO: rebuild architecture, kuri pakeičia originalų `build-lt-names.mjs`
 * fundamentaliai. Pagrindinė pokytis — STRIKT GENUS/SPECIES SEPARATION.
 *
 * Kodėl v2 reikia:
 *   • Originalus build script'as suplakdavo species-level LT vardus į genus
 *     entries (Gaspadorius latinSpecies==null check'as praleistas)
 *   • iNat preferredLtName cross-genus pollution (Streptocarpus → "Sanpaulija"
 *     nes tai populiariausias vernacular, BET tai kitos genties vardas)
 *   • genus entries' ltAllForms turėjo species/related-genus pavadinimus → UI
 *     synonym chips polluted
 *
 * Architektūra (5 phases):
 *   1. LOAD — visi šaltiniai į memory
 *   2. CLASSIFY — kiekvienam input candidate'ui priskirti kategoriją:
 *      GENUS_CLEAN | GENUS_CANDIDATE | SPECIES | REJECT
 *   3. BUILD outputs — du atskirus channels:
 *      → lt-names.json (TIK genus-level)
 *      → species-lt-names.json (binomial → LT name)
 *   4. VALIDATE — cross-genus pollution, multi-word genus whitelist
 *   5. WRITE — į .NEW files (atomic swap palieku admin'ui)
 *
 * Run:
 *   node scripts/build-lt-names-v2.mjs [--apply]
 *   (--apply overwrites real files; default writes to .NEW)
 *
 * Output:
 *   data/lt-names.json.NEW          — genus dict (clean ltAllForms)
 *   data/species-lt-names.json.NEW  — species lookup
 *   tasks/rebuild-lt-names-report-{date}.md — diff vs current
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data')
const TASKS_DIR = join(__dirname, '..', 'tasks')

const APPLY = process.argv.includes('--apply')

// ────────────────────────────────────────────────────────────────
// PHASE 0 — Constants / heuristics
// ────────────────────────────────────────────────────────────────

// Garbage patterns plants.json'e (LT placeholder text iš pradinio seed'inimo).
// Šios bus REJECT'inamos build script'e, taisymai eis per atskirą fix file'ą
// (žiūr. data/lt-names-overrides.json), kurį verify'ino AI agent + admin.
const PLACEHOLDER_GARBAGE_PATTERNS = [
  /vardas$/i,                       // "X augalo vardas"
  /^kažkok/i, /^kazkok/i,           // "kažkokės kvapaus..."
  /^anikš/i,                        // "anikštinio..."
  /^šio?\s/i, /^šios?\s/i,          // "šio augalo..."
  /priskirta gėlė/i,                // "priskirta gėlė X"
  /^primenanč/i,                    // "primenančios kamelijos"
]

// Garbage prefixes (Wikipedia/scraping leakage)
const GARBAGE_PREFIXES = [
  /^(ir paplitimas)\s+/i,
  /^(dar vadinamas|vadinamas|vadinama|vadinami|vadinamos)\s+/i,
  /^(apie|tarp|kuris|kuri|kurie|kurios|tas|tai|šie|šios)\s+\w+\s+/i,
  /^(specialiai paruoštas|specialiai paruošta|specialiai paruošti)\s+/i,
  /^(rekomenduojamas|rekomenduojama|rekomenduojami)\s+/i,
  /^(žiūr\.|žr\.|kaip\s)/i,
]

// Sentence connectors / descriptors that should NEVER appear in plant names
const FORBIDDEN_WORDS = new Set([
  'atrodo', 'jų', 'jos', 'jis', 'ji', 'tačiau', 'bet',
  'apie', 'tarp', 'iš', 'su', 'be', 'po',
  'kuris', 'kuri', 'kurie', 'kurios',
  'ir', 'ar', 'arba', 'taip', 'pat', 'bei',
  'dar', 'kaip', 'kad', 'jau',
  'gausu', 'gausi', 'gausus', 'gausa',
  'romantika', 'paplitimas', 'video', 'nuotrauka',
  'paveikslas', 'rekomenduojamas', 'paruoštas',
  'vadinamas', 'vadinami', 'rudens', 'pavasaris', 'specialiai',
  'ši', 'šis', 'šie', 'šios', 'tos', 'tas', 'tai',
  // Naujos 2026-05-31 (atradau verifying species channel changes):
  'yra', 'neteisingai', 'reklama', 'reklamą', 'reklamos',
  'mimozos', 'pavasariniai', 'ankstyvieji', 'vakar', 'dažnai',
])

// Multi-word genus whitelist — TIK šie LT names yra LEGIT genus-level
// nors juose yra erdvė ar parenteziai. Visi kiti multi-word LT names BUS
// klasifikuojami kaip species/REJECT. Generuotas iš plants.json + manual review.
//
// Format: latin → array of accepted multi-word LT name patterns
const MULTI_WORD_GENUS_WHITELIST = {
  'Nymphaea':   ['vandens lelija'],
  'Beaucarnea': ['Riestalapis nukaris', 'Dramblio koja', 'Arklio uodega', 'Butelinė palmė'],
  // Atviras review — agent + admin gali pridėti
}

// Manual overrides — legacy, MERGE'inu su naujomis overrides per data file
const LEGACY_MANUAL_OVERRIDES = {
  Beaucarnea: {
    ltName: 'Riestalapis nukaris',
    ltSynonyms: ['Nolinos', 'Dramblio koja', 'Arklio uodega', 'Butelinė palmė'],
    source: 'gaspadorius.lt (article: Beaucarnea recurvata)',
  },
}

// Family-level Latin suffixes — derlingas dažnai mažina į family level
// (e.g. "vėdryninių" → "Ranunculaceae"). Šitie NETINKA genus channel'ui.
const FAMILY_SUFFIXES = /(?:aceae|inae|oideae|ales)$/i

// ────────────────────────────────────────────────────────────────
// PHASE 0.5 — Helpers
// ────────────────────────────────────────────────────────────────

function looksLikePlaceholderGarbage(ltName) {
  if (!ltName) return true
  for (const re of PLACEHOLDER_GARBAGE_PATTERNS) if (re.test(ltName)) return true
  return false
}

// 2026-06-01 — sanitize Latvian-style macrons (ā, ē, ī, ō) iš plants.json
// scrape'o corrupted source'o. LT alphabet'e tokie chars NĖRA — tik ū yra
// validus (charCode 363). 22 plants.json entries turi šitokias corruptions
// (Canna→„kanā", Hoya carnosa→„storalāpė vaškūnė", etc.) — strip į plain.
function sanitizeLtMacrons(s) {
  if (!s || typeof s !== 'string') return s
  return s
    .replace(/ā/g, 'a').replace(/Ā/g, 'A')
    .replace(/ē/g, 'e').replace(/Ē/g, 'E')
    .replace(/ī/g, 'i').replace(/Ī/g, 'I')
    .replace(/ō/g, 'o').replace(/Ō/g, 'O')
}

function cleanLtName(name) {
  if (!name) return null
  let n = sanitizeLtMacrons(name.trim())
  for (let i = 0; i < 3; i++) {
    let changed = false
    for (const re of GARBAGE_PREFIXES) {
      const stripped = n.replace(re, '')
      if (stripped !== n) { n = stripped; changed = true }
    }
    if (!changed) break
  }
  // Strip Wikipedia-style "(augalas)" disambiguation suffix
  n = n.replace(/\s*\([^)]*\)\s*$/, '')
  // Dedupe consecutive identical WHOLE words (was regex bug: greedy match
  // collapsed "valgomasis svogūnas" → "valgomasisvogūnas" because trailing
  // 's' of word 1 matched leading 's' of word 2 as „repeated word"). Use
  // explicit split/dedupe instead.
  {
    const dedupedWords = []
    for (const w of n.split(/\s+/)) {
      if (dedupedWords[dedupedWords.length - 1]?.toLowerCase() !== w.toLowerCase()) {
        dedupedWords.push(w)
      }
    }
    n = dedupedWords.join(' ')
  }
  n = n.replace(/^[,.;:\-–—\s]+|[,.;:\-–—\s]+$/g, '')
  if (n.length < 3) return null
  const words = n.split(/\s+/)
  if (words.length > 4) return null
  for (const w of words) {
    if (FORBIDDEN_WORDS.has(w.toLowerCase())) return null
  }
  if (looksLikePlaceholderGarbage(n)) return null
  // Capitalize first letter (LT botanikos display convention — atitinka senesnės
  // species-lt-names.json + lt-names.json formatavimą). Source data turi
  // mišrų case'ą; čia normalizuojam.
  n = n[0].toUpperCase() + n.slice(1)
  return n
}

function normalizeForCompare(name) {
  if (!name) return ''
  return name.toLowerCase()
    .replace(/[āîī]/g, 'i')
    .replace(/ū/g, 'u')
    .replace(/[ąa]/g, 'a')
    .replace(/[ęe]/g, 'e')
    .replace(/[ėè]/g, 'e')
    .replace(/[čć]/g, 'c')
    .replace(/[šś]/g, 's')
    .replace(/[žź]/g, 'z')
    .replace(/\s+/g, '')
}

// Is this LT name plausibly a SINGLE genus-level name vs. multi-word species?
// Returns true if it's a single word or in the whitelist.
function isPlausibleGenusName(latin, ltName) {
  if (!ltName) return false
  const cleaned = ltName.trim()
  // Single word — always genus-level candidate
  if (!cleaned.includes(' ')) return true
  // Multi-word — check whitelist
  const whitelist = MULTI_WORD_GENUS_WHITELIST[latin]
  if (!whitelist) return false
  for (const allowed of whitelist) {
    if (normalizeForCompare(allowed) === normalizeForCompare(cleaned)) return true
  }
  return false
}

function capitalize(s) {
  if (!s) return s
  return s[0].toUpperCase() + s.slice(1)
}

// ────────────────────────────────────────────────────────────────
// PHASE 1 — Load sources
// ────────────────────────────────────────────────────────────────

console.log('[v2] Loading sources...')

const wiki        = JSON.parse(readFileSync(join(DATA_DIR, 'lt-names-wiki.json'), 'utf8'))
const plants      = JSON.parse(readFileSync(join(DATA_DIR, 'plants.json'), 'utf8'))
const derlingas   = JSON.parse(readFileSync(join(DATA_DIR, 'derlingas-pairs.json'), 'utf8'))
const sodospalvos = JSON.parse(readFileSync(join(DATA_DIR, 'sodospalvos-names.json'), 'utf8'))
const gaspadorius = JSON.parse(readFileSync(join(DATA_DIR, 'gaspadorius-detail.json'), 'utf8'))
const inat        = JSON.parse(readFileSync(join(DATA_DIR, 'inat-names.json'), 'utf8'))
const preDb       = JSON.parse(readFileSync(join(DATA_DIR, 'pre-db.json'), 'utf8'))

// Optional: overrides file (created by AI verify agent + admin review)
const OVERRIDES_PATH = join(DATA_DIR, 'lt-names-overrides.json')
const overrides = existsSync(OVERRIDES_PATH)
  ? JSON.parse(readFileSync(OVERRIDES_PATH, 'utf8'))
  : { genus: {}, species: {} }

console.log(`[v2] wiki(${Object.keys(wiki.results).length}) plants(${plants.length}) preDb(${Object.keys(preDb.genera).length}) overrides(genus:${Object.keys(overrides.genus).length}, species:${Object.keys(overrides.species).length})`)

// ────────────────────────────────────────────────────────────────
// PHASE 2 — Classify candidates
// ────────────────────────────────────────────────────────────────
//
// Per source, normalize each entry into a candidate:
//   { latin, ltName, level: 'genus'|'species', source, raw, rejectReason?: string }
//
// Levels:
//   - genus: latin is single word, ltName plausibly genus-level
//   - species: latin is binomial, ltName is species-specific
//   - REJECT: garbage, mis-classified, cross-genus pollution

const candidates = []  // flat list of all candidates
const stats = {
  loaded: 0,
  rejected: { garbage: 0, multiWordNotWhitelisted: 0, familyLevel: 0, nonLatinGenus: 0, crossGenus: 0, placeholder: 0 },
  classified: { genus: 0, species: 0 },
  bySource: {},
}

function recordSource(src) { stats.bySource[src] = (stats.bySource[src] || 0) + 1 }

function classify(latin, rawLtName, source, raw) {
  stats.loaded++
  recordSource(source)
  const ltName = cleanLtName(rawLtName)
  if (!ltName) {
    stats.rejected.garbage++
    return null
  }
  if (looksLikePlaceholderGarbage(ltName)) {
    stats.rejected.placeholder++
    return null
  }
  if (!latin || latin.length < 3) return null
  if (FAMILY_SUFFIXES.test(latin)) {
    stats.rejected.familyLevel++
    return null
  }
  // Latin genus MUST start with uppercase (real Latin convention)
  // Lowercase first char = scraper extraction bug (e.g. "raclicchio")
  if (!/^[A-Z]/.test(latin)) {
    stats.rejected.nonLatinGenus++
    return null
  }

  const words = latin.trim().split(/\s+/)
  const latinGenus = capitalize(words[0])

  // SPECIES level — latin has 2+ words
  if (words.length >= 2) {
    stats.classified.species++
    return {
      latin: words.slice(0, 2).join(' ').toLowerCase(),  // normalize binomial
      latinGenus,
      ltName,
      level: 'species',
      source,
      raw,
    }
  }

  // GENUS level — latin is single word
  if (!isPlausibleGenusName(latinGenus, ltName)) {
    // Multi-word LT name without whitelist entry → suspect, REJECT
    stats.rejected.multiWordNotWhitelisted++
    return null
  }

  stats.classified.genus++
  return {
    latin: latinGenus,
    latinGenus,
    ltName,
    level: 'genus',
    source,
    raw,
  }
}

// Plants.json — split source ID by level (species rows are MUCH cleaner
// than genus rows; treat them as different trust tiers).
for (const p of plants) {
  if (!p.latin || !p.lithuanian) continue
  const isSpecies = p.latin.trim().includes(' ')
  const src = isSpecies ? 'plants-species' : 'plants-genus'
  const c = classify(p.latin.trim(), p.lithuanian, src, p)
  if (c) candidates.push(c)
}

// SPECIES-INFERRED GENUS LT NAME (highest-trust source for genus channel)
//
// plants.json genus rows have known corruption (e.g. Aquilegia → "vanduo",
// Antennaria → "antena", Acer → "klevai" PLURAL). Bet SPECIES rows yra
// patikimesni — visi Aquilegia species'ai baigiasi "sinavadas", visi Acer
// species'ai baigiasi "klevas". Inferring from species consensus self-
// validates against data ir auto-fix'ina corruption.
//
// Algoritmas: per genus paimam paskutinį žodį iš kiekvienos species LT
// name'o, paskaičiuojam dažnius. Thresholds:
//   • 1 species + sanity check → use it
//   • 2 species → both must agree (100%)
//   • 3+ species → >= 70% consensus
{
  const speciesGenusGroups = new Map()  // latinGenus → [{lastWord, ltName}, ...]
  for (const p of plants) {
    if (!p.latin || !p.lithuanian || !p.latin.includes(' ')) continue
    const latinGenus = capitalize(p.latin.trim().split(/\s+/)[0])
    const ltWords = p.lithuanian.trim().split(/\s+/)
    if (ltWords.length < 2) continue  // species name is single word → can't infer
    const lastWord = ltWords[ltWords.length - 1].toLowerCase()
    if (!speciesGenusGroups.has(latinGenus)) speciesGenusGroups.set(latinGenus, [])
    speciesGenusGroups.get(latinGenus).push({ lastWord, ltName: p.lithuanian })
  }

  let inferredCount = 0
  for (const [latinGenus, items] of speciesGenusGroups) {
    if (items.length < 1) continue
    const freq = new Map()
    for (const it of items) freq.set(it.lastWord, (freq.get(it.lastWord) || 0) + 1)
    const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1])
    const [topWord, topCount] = sorted[0]
    const ratio = topCount / items.length
    // Threshold logic:
    //   • 1 species → use it (LT convention: species name = [adj] [genus noun])
    //                  PLUS sanity check (not all caps, not parenthetical)
    //   • 2 species → both must agree (100%)
    //   • 3+ species → >= 70% consensus
    const minRatio = items.length === 1 ? 1.0
                    : items.length === 2 ? 1.0
                    : 0.7
    if (ratio < minRatio) continue
    // Sanity check for single-species inference — skip if last word looks like
    // a descriptor adjective rather than a genus noun
    if (items.length === 1) {
      if (topWord.length < 4) continue                      // too short (likely typo)
      if (/[A-Z]{2,}/.test(items[0].ltName)) continue       // all-caps fragments
      if (items[0].ltName.includes('(')) continue           // parenthetical garbage
      if (topWord.endsWith('inis') || topWord.endsWith('inė') || topWord.endsWith('asis')) continue  // adjective ending
    }
    // We have a consensus — register as 'plants-species-inferred' source
    const c = classify(latinGenus, capitalize(topWord), 'plants-species-inferred', { latinGenus, ratio, samples: items.length })
    if (c) {
      candidates.push(c)
      inferredCount++
    }
  }
  console.log(`[v2] Species-inferred genus LT names: ${inferredCount}`)
}

// Gaspadorius — explicit genus vs species per latinSpecies field
for (const p of gaspadorius.pairs || []) {
  if (!p.latinGenus) continue
  const latin = p.latinSpecies ? `${p.latinGenus} ${p.latinSpecies}` : p.latinGenus
  const c = classify(latin, p.ltName, 'gaspadorius', p)
  if (c) candidates.push(c)
  // Synonyms — only register if main ltName succeeded
  if (c) {
    for (const syn of (p.ltSynonyms || [])) {
      const cs = classify(latin, syn, 'gaspadorius-syn', p)
      if (cs) candidates.push(cs)
    }
  }
}

// Wikipedia LT
for (const [latin, info] of Object.entries(wiki.results || {})) {
  if (!info?.ltName) continue
  const c = classify(latin, info.ltName, 'wiki', info)
  if (c) candidates.push(c)
}

// Derlingas
for (const p of derlingas.pairs || []) {
  if (!p.latin || !p.lt) continue
  const c = classify(p.latin, p.lt, 'derlingas', p)
  if (c) candidates.push(c)
}

// Sodospalvos
for (const [latin, info] of Object.entries(sodospalvos.results || sodospalvos || {})) {
  if (typeof info !== 'object' || !info?.ltName) continue
  const c = classify(latin, info.ltName, 'sodospalvos', info)
  if (c) candidates.push(c)
}

// iNat — TRICKIER: latinGenus is the key, value has preferredLtName.
// Apply STRICT cross-genus check downstream (in Phase 4).
for (const [latin, info] of Object.entries(inat)) {
  if (latin === 'generatedAt' || latin === 'source' || latin === 'totalQueried' || latin === 'totalFound') continue
  if (!info?.preferredLtName) continue
  const c = classify(latin, info.preferredLtName, 'inat', info)
  if (c) candidates.push(c)
}

// Manual overrides (legacy) → genus level
for (const [latin, ov] of Object.entries(LEGACY_MANUAL_OVERRIDES)) {
  const c = classify(latin, ov.ltName, 'manual-legacy', ov)
  if (c) candidates.push(c)
  for (const syn of (ov.ltSynonyms || [])) {
    const cs = classify(latin, syn, 'manual-legacy-syn', ov)
    if (cs) candidates.push(cs)
  }
}

// User-curated overrides (from AI verify + admin review)
for (const [latin, ov] of Object.entries(overrides.genus || {})) {
  const c = classify(latin, ov.ltName, 'override-user', ov)
  if (c) candidates.push(c)
  for (const syn of (ov.ltSynonyms || [])) {
    const cs = classify(latin, syn, 'override-user-syn', ov)
    if (cs) candidates.push(cs)
  }
}

console.log(`[v2] Loaded ${stats.loaded} raw candidates`)
console.log(`[v2] Rejected: garbage=${stats.rejected.garbage} placeholder=${stats.rejected.placeholder} multiWord=${stats.rejected.multiWordNotWhitelisted} family=${stats.rejected.familyLevel} nonLatin=${stats.rejected.nonLatinGenus}`)
console.log(`[v2] Classified: genus=${stats.classified.genus} species=${stats.classified.species}`)
console.log(`[v2] By source:`, stats.bySource)

// ────────────────────────────────────────────────────────────────
// PHASE 3 — Group by latin (genus channel + species channel)
// ────────────────────────────────────────────────────────────────

const genusGroups = new Map()    // latinGenus → { candidates: [...], variants: Map(normName → [c, ...]) }
const speciesGroups = new Map()  // binomial → { candidates: [...] }

for (const c of candidates) {
  if (c.level === 'genus') {
    if (!genusGroups.has(c.latinGenus)) genusGroups.set(c.latinGenus, { latinGenus: c.latinGenus, candidates: [] })
    genusGroups.get(c.latinGenus).candidates.push(c)
  } else if (c.level === 'species') {
    if (!speciesGroups.has(c.latin)) speciesGroups.set(c.latin, { binomial: c.latin, latinGenus: c.latinGenus, candidates: [] })
    speciesGroups.get(c.latin).candidates.push(c)
  }
}

console.log(`[v2] Grouped: ${genusGroups.size} genera, ${speciesGroups.size} species`)

// ────────────────────────────────────────────────────────────────
// PHASE 4 — Cross-genus pollution check + winner selection
// ────────────────────────────────────────────────────────────────

// Source priority (higher wins)
//
// 2026-05-31 reorder:
//   • plants-species (binomial rows) — HIGHEST for SPECIES channel (cleanest)
//   • plants-species-inferred — derived from species row consensus, GENUS channel
//   • plants-genus (single-word rows) — DEMOTED, known corruption (Aquilegia
//     → "vanduo", Acer → "klevai" plural, etc.)
//   • derlingas/wiki/etc — neighbor priorities below
//   • iNat — lowest in species channel (cross-genus pollution risk)
const SOURCE_PRIORITY = {
  'override-user':           100,
  'manual-legacy':            95,
  'plants-species':           92,  // SPECIES channel: clean binomials from plants.json
  'plants-species-inferred':  90,  // GENUS channel: inferred from species consensus
  'derlingas':                70,
  'plants-genus':             60,  // GENUS channel: known to have corruption
  'sodospalvos':              55,
  'wiki':                     50,
  'gaspadorius':              40,
  'inat':                     30,
  'gaspadorius-syn':          20,
  'manual-legacy-syn':        20,
  'override-user-syn':        20,
}

function pickPrimary(candidates) {
  // Sort by source priority desc
  const sorted = [...candidates].sort((a, b) => (SOURCE_PRIORITY[b.source] || 0) - (SOURCE_PRIORITY[a.source] || 0))
  return sorted[0]
}

// First, build canonical genus name map (genus → preferred ltName)
// Used for cross-genus pollution check below
const canonicalGenusName = new Map()  // latinGenus → ltName (normalized)
for (const [latinGenus, group] of genusGroups) {
  const primary = pickPrimary(group.candidates)
  group.primary = primary
  if (primary) {
    canonicalGenusName.set(latinGenus, normalizeForCompare(primary.ltName))
  }
}

// Reverse map: normalized LT name → set of latinGenera that claim it
const ltNameToGenera = new Map()
for (const [latinGenus, normName] of canonicalGenusName) {
  if (!ltNameToGenera.has(normName)) ltNameToGenera.set(normName, new Set())
  ltNameToGenera.get(normName).add(latinGenus)
}

// Strict cross-genus check: for each genus entry, reject any candidate whose
// ltName normalizes to a DIFFERENT genus's canonical name.
const crossGenusRejections = []
for (const [latinGenus, group] of genusGroups) {
  const ownNorm = canonicalGenusName.get(latinGenus)
  const filtered = []
  for (const c of group.candidates) {
    const norm = normalizeForCompare(c.ltName)
    const claimedBy = ltNameToGenera.get(norm)
    if (claimedBy && claimedBy.size === 1 && !claimedBy.has(latinGenus)) {
      // This LT name is canonical for a DIFFERENT genus → REJECT
      const otherGenus = [...claimedBy][0]
      crossGenusRejections.push({
        latinGenus,
        ltName: c.ltName,
        source: c.source,
        rejectReason: `canonical-of-${otherGenus}`,
      })
      stats.rejected.crossGenus++
      continue
    }
    filtered.push(c)
  }
  group.candidates = filtered
  // Re-pick primary after filtering
  group.primary = pickPrimary(group.candidates)
}

console.log(`[v2] Cross-genus rejections: ${crossGenusRejections.length}`)

// ────────────────────────────────────────────────────────────────
// PHASE 5 — Build outputs
// ────────────────────────────────────────────────────────────────

// 5a. Build lt-names.json (genus dict)
const ltNamesOutput = {
  generatedAt: new Date().toISOString(),
  generator: 'build-lt-names-v2.mjs',
  stats: {
    totalGenera: 0,
    bySource: {},
  },
  ltNames: {},
}

for (const [latinGenus, group] of genusGroups) {
  if (!group.primary) continue
  const primary = group.primary

  // ltAllForms = unique cleaned variants from THIS GENUS's candidates only.
  // Dedupe by NORMALIZED form (case + diacritic insensitive) to avoid
  // ["sansevjera", "Sansevjera"] type duplicates.
  // Keep ONLY non-pollution variants (cross-genus already filtered in Phase 4).
  const seenNorm = new Set()
  seenNorm.add(normalizeForCompare(primary.ltName))
  const ltSynonyms = []
  for (const c of group.candidates) {
    if (c === primary) continue
    const norm = normalizeForCompare(c.ltName)
    if (seenNorm.has(norm)) continue  // same name, different casing/spelling — skip
    // Accept if:
    //   - single-word alternative LT genus name (legit transliteration variant)
    //   - multi-word whitelisted
    if (!c.ltName.includes(' ')) {
      seenNorm.add(norm)
      ltSynonyms.push(c.ltName)
    } else {
      const whitelist = MULTI_WORD_GENUS_WHITELIST[latinGenus] || []
      if (whitelist.some(w => normalizeForCompare(w) === norm)) {
        seenNorm.add(norm)
        ltSynonyms.push(c.ltName)
      }
    }
  }
  const sources = [...new Set(group.candidates.map(c => c.source))]
  const confidence = sources.length >= 3 ? 'high'
                    : sources.length >= 2 ? 'mid'
                    : 'low'

  ltNamesOutput.ltNames[latinGenus] = {
    latin: latinGenus,
    ltName: primary.ltName,
    ltSynonyms,
    ltAllForms: [primary.ltName, ...ltSynonyms],
    ltFamily: null,  // TODO: enrich from plants.json family info if needed
    confidence,
    sources,
    primarySource: primary.source,
    conflicts: null,  // Cleaned up vs v1
  }
  ltNamesOutput.stats.totalGenera++
  for (const s of sources) ltNamesOutput.stats.bySource[s] = (ltNamesOutput.stats.bySource[s] || 0) + 1
}

// 5b. Build species-lt-names.json
const speciesOutput = {}
let speciesCount = 0
for (const [binomial, group] of speciesGroups) {
  const primary = pickPrimary(group.candidates)
  if (!primary) continue
  speciesOutput[binomial] = primary.ltName
  speciesCount++
}

// Apply species overrides
for (const [binomial, ltName] of Object.entries(overrides.species || {})) {
  speciesOutput[binomial.toLowerCase()] = ltName
}

console.log(`[v2] Output: ${ltNamesOutput.stats.totalGenera} genera, ${speciesCount} species`)

// ────────────────────────────────────────────────────────────────
// PHASE 6 — Write outputs
// ────────────────────────────────────────────────────────────────

const ltNamesOutPath = APPLY
  ? join(DATA_DIR, 'lt-names.json')
  : join(DATA_DIR, 'lt-names.json.NEW')

const speciesOutPath = APPLY
  ? join(DATA_DIR, 'species-lt-names.json')
  : join(DATA_DIR, 'species-lt-names.json.NEW')

writeFileSync(ltNamesOutPath, JSON.stringify(ltNamesOutput, null, 2))
writeFileSync(speciesOutPath, JSON.stringify(speciesOutput, null, 2))

console.log(`[v2] ✓ Wrote ${ltNamesOutPath}`)
console.log(`[v2] ✓ Wrote ${speciesOutPath}`)
console.log()
console.log(`[v2] STATS:`)
console.log(`  Raw candidates loaded:     ${stats.loaded}`)
console.log(`  Rejected (garbage):        ${stats.rejected.garbage}`)
console.log(`  Rejected (placeholder):    ${stats.rejected.placeholder}`)
console.log(`  Rejected (multi-word):     ${stats.rejected.multiWordNotWhitelisted}`)
console.log(`  Rejected (family-level):   ${stats.rejected.familyLevel}`)
console.log(`  Rejected (non-Latin):      ${stats.rejected.nonLatinGenus}`)
console.log(`  Rejected (cross-genus):    ${stats.rejected.crossGenus}`)
console.log(`  Final genera:              ${ltNamesOutput.stats.totalGenera}`)
console.log(`  Final species:             ${speciesCount}`)
console.log()
if (!APPLY) {
  console.log(`[v2] DRY RUN — wrote to .NEW files. To apply, re-run with --apply or:`)
  console.log(`  mv data/lt-names.json.NEW data/lt-names.json`)
  console.log(`  mv data/species-lt-names.json.NEW data/species-lt-names.json`)
}

// Write cross-genus rejection log for review
const rejLogPath = join(TASKS_DIR, 'rebuild-cross-genus-rejections.json')
writeFileSync(rejLogPath, JSON.stringify(crossGenusRejections, null, 2))
console.log(`[v2] Cross-genus rejection log: ${rejLogPath}`)
