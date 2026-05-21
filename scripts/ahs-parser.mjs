// AHS Encyclopedia of Plants and Flowers (Brickell/DK, 3rd ed 2011) → JSON.
//
// Įvestis: data/ahs-epub/EPUB/page_<N>.html (Plant Dictionary section ~498..724)
// Išvestis: data/ahs.json
//
// Šaltinio struktūra (per puslapį):
//   GENUS_NAME                          ← running header
//   GENUS_NAME [common name(s)] FAMILY  ← genus block start
//   ~                                   ← separator
//   Genus of <kind>, grown for ...      ← intro
//   <care text> Propagate by ...
//   A. species_name. <Description>. H <num>(<unit>), S <num>(<unit>). Z<n>-<n> H<n>-<n>.
//   A. species_name, syn. <syn>, illus. p.<N>. <Description>...
//   A. species_name. See <ref>.         ← cross-reference (no description)
//   A. 'Cultivar Name'. <Description>. Z..-..
//
// Visi puslapiai sukoncatenuojami į vieną tekstą, parser nuskaito linijai
// genčių ir įrašų transitijos.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PAGES_DIR = join(__dirname, '..', 'data', 'ahs-epub', 'EPUB')
const OUTPUT    = join(__dirname, '..', 'data', 'ahs.json')

// Dictionary ribos (sample'inta žiūrint puslapius)
const DICT_START = 498
const DICT_END   = 724

// ── Step 1: Load + concatenate dictionary pages ────────────────

function extractPageText(filepath) {
  const html = readFileSync(filepath, 'utf-8')
  // Get content between <p> and </p>
  const match = html.match(/<p>([\s\S]*?)<\/p>/)
  if (!match) return ''
  let text = match[1]
  // Strip ANY HTML tags (img, span, k-pseudo-tags from OCR garbage)
  text = text.replace(/<[^>]+>/g, ' ')
  // Decode HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim()
  return text
}

console.log(`[ahs] reading pages ${DICT_START}..${DICT_END}`)
const pageTexts = []
for (let p = DICT_START; p <= DICT_END; p++) {
  const path = join(PAGES_DIR, `page_${p}.html`)
  try {
    const text = extractPageText(path)
    if (text) pageTexts.push({ page: p, text })
  } catch {
    // skip missing
  }
}
console.log(`[ahs] loaded ${pageTexts.length} dictionary pages`)

// Concatenate all dictionary text. Insert page markers for debugging.
let fullText = pageTexts.map(p => p.text).join(' ')

// Normalize common OCR digit-for-letter swaps in genus/family headers.
// AHS OCR frequently reads "I" as "1" in ALL-CAPS context, e.g.:
//   "IRIS 1RIDACEAE" → "IRIS IRIDACEAE"
// We do a targeted swap: digit "1" preceded by uppercase letters/space and
// followed by uppercase letters → swap to "I".
fullText = fullText.replace(/\b1([A-Z]{3,})/g, 'I$1')
console.log(`[ahs] total text length: ${fullText.length} chars`)

// ── Step 2: Split into genus blocks ────────────────────────────
//
// Genus blocks start with: `GENUS_NAME [optional common name] FAMILY_NAME ~`
// Where:
//   GENUS_NAME = all caps, 3+ chars (may be split mid-word by running header
//                duplication, e.g. "ACAENA ACAENA")
//   FAMILY = ends in ACEAE, IDAE, or one of compound legacy names

// Family detector (all-caps in dictionary)
const FAMILY_RE = /\b([A-Z]{3,}(?:\/[A-Z]{3,})?(?:ACEAE|IDAE|EAE)|LEGUMINOSAE|CRUCIFERAE|COMPOSITAE|UMBELLIFERAE|LABIATAE|PALMAE|GRAMINEAE|GUTTIFERAE|ASTERACEAE)\b/

// Find genus block START positions.
//
// Format variations seen in AHS dictionary:
//   "ACAENA ACAENA New Zealand burr ROSACEAE ~ Genus of..."
//   "ACALYPHA EUPHORBIACEAE Genus of..."
//   "ACANTHUS Bear's breeches ACANTHACEAE Genus of..."
//   "ACER Maple ACERACEAE/SAPINDACEAE Genus of..."
//   "CICERBITA syn. MULGEDIUM COMPOSITAE/ASTERACEAE ~ Genus of..."
//   "FASCICULARIA FASCICULARIA BROMELIACEAE Genus of..."
//
// Strategy: find "~? Genus of" anchor, then walk BACK through preceding text
// to find FAMILY (all-caps -ACEAE/-IDAE/legacy), then walk further back to find
// GENUS (first all-caps token after a period or sentence end).
const ANCHOR_RE = /\s+~?\s*Genus of\b/g
// Family detection — single word matching family suffixes.
const FAMILY_TOKEN_RE = /[A-Z]+(?:\/[A-Z]+)?(?:ACEAE|IDAE|EAE)|LEGUMINOSAE|CRUCIFERAE|COMPOSITAE|UMBELLIFERAE|LABIATAE|PALMAE|GRAMINEAE|GUTTIFERAE/

// Known family-suffix fragments that appear when OCR splits a compound name.
// These are NOT real families — when we see one, look back for a prefix to
// merge with it (e.g. "AMARYLLI" + " DACEAE" → "AMARYLLIDACEAE").
const FAMILY_SUFFIX_FRAGMENTS = new Set([
  'DACEAE',     // AMARYLLI + DACEAE → AMARYLLIDACEAE
  'IACEAE',     // GERAN + IACEAE → GERANIACEAE
  'RIDACEAE',   // I + RIDACEAE → IRIDACEAE
  'ACEAE',      // MAGNOLI + ACEAE → MAGNOLIACEAE
])

const anchorMatches = [...fullText.matchAll(ANCHOR_RE)]
console.log(`[ahs] detected ${anchorMatches.length} "Genus of" anchors`)

// For each anchor, walk back to find FAMILY then GENUS
const blocks = []
for (const am of anchorMatches) {
  const anchorPos = am.index
  // Look at the 250 chars BEFORE anchor for family+genus
  const lookback = fullText.slice(Math.max(0, anchorPos - 250), anchorPos)

  // Find LAST family-like token in lookback
  const familyMatches = [...lookback.matchAll(new RegExp(FAMILY_TOKEN_RE.source, 'g'))]
  if (familyMatches.length === 0) continue
  const familyMatch = familyMatches[familyMatches.length - 1]
  let family = familyMatch[0]
  let familyStartInLookback = familyMatch.index

  // OCR split-family fix: if the matched family is a known suffix fragment,
  // glue it to the preceding all-caps word.
  //   "AMARYLLI DACEAE"  → "AMARYLLIDACEAE"  (genus = AMARYLLIS)
  //   "GERAN IACEAE"     → "GERANIACEAE"     (genus = GERANIUM)
  //   "I RIDACEAE"       → "IRIDACEAE"       (genus = IRIS)
  if (FAMILY_SUFFIX_FRAGMENTS.has(family)) {
    const before = lookback.slice(0, familyStartInLookback).trimEnd()
    const prevWordMatch = before.match(/\b([A-Z]+)\s*$/)
    if (prevWordMatch) {
      family = prevWordMatch[1] + family
      familyStartInLookback = before.length - prevWordMatch[1].length
    }
  }

  // Now look BEFORE family for the genus token. Genus = all-caps word, 3+ chars,
  // NOT being itself a family token. May appear duplicated (running header).
  // Also need to skip "syn." section: e.g. "SCHEFFLERA syn. BRASSAIA, HEPTAPLEURUM ARALIACEAE"
  // — BRASSAIA and HEPTAPLEURUM are synonyms, NOT the genus.
  let beforeFamily = lookback.slice(0, familyStartInLookback)

  // If "GENUS syn." pattern appears (all-caps genus + syn keyword), the syn.
  // section contains synonyms not the real genus — truncate to keep only the
  // genus name.
  //
  // BUT: "syn." is also used INSIDE species entries (e.g. "P. carnea, syn. P. lanceolata")
  // — those don't have all-caps genus immediately before. So we ONLY truncate
  // when "syn." is preceded by an all-caps 3+ letter word.
  const synGenusMatch = beforeFamily.match(/\b([A-Z]{3,})\s+syn\.\s+/g)
  if (synGenusMatch && synGenusMatch.length > 0) {
    // Find the LAST occurrence of "[GENUS] syn." pattern
    const lastSyn = synGenusMatch[synGenusMatch.length - 1]
    const synStart = beforeFamily.lastIndexOf(lastSyn) + lastSyn.length - 5 // back up to "syn."
    beforeFamily = beforeFamily.slice(0, synStart)
  }

  // Find all all-caps tokens (3+ chars) that are NOT family tokens
  const upperRe = /\b([A-Z]{3,})\b/g
  const upperTokens = [...beforeFamily.matchAll(upperRe)]
    .map(m => ({ token: m[1], idx: m.index }))
    .filter(t => !FAMILY_TOKEN_RE.test(t.token))

  if (upperTokens.length === 0) continue

  // Genus = LAST all-caps token before family (closest one)
  const lastTok = upperTokens[upperTokens.length - 1]
  // If the previous token is the same word (running header dup), use it once
  let genus = lastTok.token

  // Block start = position of genus in fullText.
  // anchorPos - 250 is the lookback start in fullText; lookback.indexOf gives
  // offset within lookback. Clamp to >=0 since early dictionary pages may have
  // anchorPos < 250.
  const lookbackStartInFull = Math.max(0, anchorPos - 250)
  const blockStart = lookbackStartInFull + Math.max(0, lookback.indexOf(genus, upperTokens[0].idx))

  blocks.push({
    genus,
    family,
    rawHeader: beforeFamily.slice(lastTok.idx) + family,
    start: blockStart,
    end: -1,
  })
}

// Sort by position and dedup overlapping detections
blocks.sort((a, b) => a.start - b.start)
console.log(`[ahs] detected ${blocks.length} genus blocks`)

// End = start of next block, or end of text
for (let i = 0; i < blocks.length; i++) {
  blocks[i].end = i + 1 < blocks.length ? blocks[i + 1].start : fullText.length
}

// ── Step 3: Parse each genus block ─────────────────────────────

// Species entry start: `G. species_name` or `G. 'Cultivar'`
// Captured: abbrev (1 letter), then either lowercase species OR quoted cultivar
const SPECIES_ENTRY_RE = /\b([A-Z])\.\s+([a-z][a-z-]+(?:\s+(?:var|subsp|f|x)\.?\s+[a-z][a-z-]+)?|['"`'][^'"`']+['"`'])(?=[\s,.])/g

// Zone code: Z<num>-<num> H<num>-<num>
const ZONE_RE = /\bZ(\d+)-(\d+)\s*H(\d+)-(\d+)/

// Height/Spread dimensions
const HS_RE = /\bH\s*(?:and\s+S\s+)?([\d/\-.]+(?:in|ft|cm|m))\s*(?:\(([^)]+)\))?(?:,?\s*S\s*([\d/\-.]+(?:in|ft|cm|m))\s*(?:\(([^)]+)\))?)?/

// Min temp (tender plants)
const MIN_TEMP_RE = /\bMin\.\s+(-?\d+)°F\s*\((-?\d+)°C\)/

// Cross-reference: ends with "See <ref>"
const SEE_REF_RE = /\bSee\s+([A-Z][^.]+?)\./

// Synonym: ", syn. <other>"
const SYN_RE = /,\s*syn\.\s+([A-Z][^,.]+?)(?:,|\.)/g

// Illustration ref: ", illus. p.<NNN>"
const ILLUS_RE = /,\s*illus\.\s*p\.\s*(\d+)/

function parseSpeciesEntry(text) {
  // text starts with "X. species_name..." and ends before next entry
  //
  // Species name forms accepted:
  //   "G. species"                       → just species name
  //   "G. species var. variety"          → with variety
  //   "G. species subsp. subspecies"     → with subspecies
  //   "G. species f. form"               → with form
  //   "G. x hybrid"                      → hybrid notation
  //   "G. 'Cultivar Name'"               → cultivar (quoted)
  //
  // Do NOT match trailing "and other species" / "and related forms" — those
  // are descriptive text, not part of the binomial.
  const headerMatch = text.match(/^([A-Z])\.\s+(['"`'][^'"`']+['"`']|[a-z][a-z-]+(?:\s+(?:var|subsp|f|x)\.?\s+[a-z][a-z-]+)?)/)
  if (!headerMatch) return null

  const abbrev = headerMatch[1]
  let nameOrCv = headerMatch[2]
  let isCultivar = false

  if (/^['"`']/.test(nameOrCv)) {
    isCultivar = true
    nameOrCv = nameOrCv.replace(/^['"`']|['"`']$/g, '')
  }

  // Collect description after header
  const restText = text.slice(headerMatch[0].length)

  // Extract synonyms
  const synonyms = []
  let syn
  const synRe = /,\s*syn\.\s+([A-Z][^,.]+?)(?:,|\.)/g
  while ((syn = synRe.exec(restText)) !== null) {
    synonyms.push(syn[1].trim())
  }

  // Common name in parens: "(Common Name)"
  //
  // Skip parens containing:
  //   - See / illus → cross-refs and illustrations
  //   - Pure dimensions like "5cm", "10°C"
  //   - Lowercase-only single words (likely measurements, e.g. "5m")
  let commonName = null
  const cnMatch = restText.match(/^[,.\s]*(?:syn\.\s+[A-Z][^,.]+?,?\s*)?\s*\(([^)]+)\)/)
  if (cnMatch) {
    const candidate = cnMatch[1].trim()
    const isMeasurement = /^[\d\s.,°/Fc°Ccm-]+$/.test(candidate)
    const isRef = /See|illus|p\./.test(candidate)
    if (!isMeasurement && !isRef && candidate.length > 1) {
      commonName = candidate
    }
  }

  // Zones
  const zoneMatch = restText.match(ZONE_RE)
  const zones = zoneMatch ? {
    usdaMin: +zoneMatch[1],
    usdaMax: +zoneMatch[2],
    ahsMin: +zoneMatch[3],
    ahsMax: +zoneMatch[4],
  } : null

  // Dimensions
  const hsMatch = restText.match(HS_RE)
  const dimensions = hsMatch ? {
    heightImp: hsMatch[1] ?? null,
    heightMetric: hsMatch[2] ?? null,
    spreadImp: hsMatch[3] ?? null,
    spreadMetric: hsMatch[4] ?? null,
  } : null

  // Min temp
  const minTempMatch = restText.match(MIN_TEMP_RE)
  const minTemp = minTempMatch ? {
    fahrenheit: +minTempMatch[1],
    celsius: +minTempMatch[2],
  } : null

  // Cross-reference
  const seeMatch = restText.match(SEE_REF_RE)
  const seeRef = seeMatch ? seeMatch[1].trim() : null

  // Illustration ref
  const illusMatch = restText.match(ILLUS_RE)
  const illusPage = illusMatch ? +illusMatch[1] : null

  // Description = restText, cleaned, truncated
  const description = restText
    .replace(/^\s*,?\s*syn\.\s+[A-Z][^,.]+?[,.]\s*/, '')
    .replace(/^\s*\([^)]+\)\s*/, '')
    .replace(/^\s*illus\.\s*p\.\s*\d+\.?\s*/, '')
    .trim()

  return {
    latinAbbrev: isCultivar ? `${abbrev}. '${nameOrCv}'` : `${abbrev}. ${nameOrCv}`,
    species: isCultivar ? null : nameOrCv,
    cultivar: isCultivar ? nameOrCv : null,
    commonName,
    synonyms,
    seeRef,
    illusPage,
    zones,
    dimensions,
    minTemp,
    description: description.length > 800 ? description.slice(0, 800) + '...' : description,
  }
}

function parseGenusBlock(block) {
  const { genus, family, start, end } = block
  const blockText = fullText.slice(start, end)

  // Find intro: everything after `Genus of` until first species entry
  const introMatch = blockText.match(/Genus of([\s\S]*?)(?=\s+[A-Z]\.\s+(?:['"`']|[a-z]))/)
  const introText = introMatch ? introMatch[1].trim() : null

  // Find species entries — split by `\b[A-Z]\. ` occurrences
  const entries = []
  const entryRe = /\b([A-Z])\.\s+(['"`'][^'"`']+['"`']|[a-z][a-z-]+(?:\s+[a-z-]+)?)\b/g
  const positions = []
  let m
  while ((m = entryRe.exec(blockText)) !== null) {
    positions.push(m.index)
  }
  // For each position, extract text until next position
  for (let i = 0; i < positions.length; i++) {
    const sliceStart = positions[i]
    const sliceEnd = i + 1 < positions.length ? positions[i + 1] : blockText.length
    const entryText = blockText.slice(sliceStart, sliceEnd)
    const parsed = parseSpeciesEntry(entryText)
    if (parsed) entries.push(parsed)
  }

  return {
    genus,
    family,
    introText: introText && introText.length > 1200 ? introText.slice(0, 1200) + '...' : introText,
    entries,
    entryCount: entries.length,
  }
}

const parsedBlocks = blocks.map(parseGenusBlock)

// Filter blocks with at least 1 entry (drop misdetections)
const valid = parsedBlocks.filter(b => b.entryCount > 0)
console.log(`[ahs] parsed ${parsedBlocks.length} blocks, ${valid.length} have entries`)

// ── Step 4: Merge duplicate genera (running headers across pages) ──
const merged = new Map()
for (const b of valid) {
  if (!merged.has(b.genus)) {
    merged.set(b.genus, b)
  } else {
    // Merge entries (dedup by latinAbbrev)
    const existing = merged.get(b.genus)
    const seenAbbrevs = new Set(existing.entries.map(e => e.latinAbbrev))
    for (const e of b.entries) {
      if (!seenAbbrevs.has(e.latinAbbrev)) {
        existing.entries.push(e)
        seenAbbrevs.add(e.latinAbbrev)
      }
    }
    existing.entryCount = existing.entries.length
  }
}

const finalBlocks = [...merged.values()].sort((a, b) => a.genus.localeCompare(b.genus))
console.log(`[ahs] after dedup: ${finalBlocks.length} unique genera`)

// Statistics
const totalEntries = finalBlocks.reduce((s, b) => s + b.entryCount, 0)
const entriesWithZones = finalBlocks.reduce(
  (s, b) => s + b.entries.filter(e => e.zones).length, 0
)
const entriesWithDims = finalBlocks.reduce(
  (s, b) => s + b.entries.filter(e => e.dimensions).length, 0
)
const entriesWithMinTemp = finalBlocks.reduce(
  (s, b) => s + b.entries.filter(e => e.minTemp).length, 0
)
const crossRefs = finalBlocks.reduce(
  (s, b) => s + b.entries.filter(e => e.seeRef).length, 0
)

console.log()
console.log('=== AHS DICTIONARY STATS ===')
console.log(`Genera:         ${finalBlocks.length}`)
console.log(`Total entries:  ${totalEntries}`)
console.log(`  with zones:     ${entriesWithZones} (${Math.round(entriesWithZones/totalEntries*100)}%)`)
console.log(`  with dims:      ${entriesWithDims} (${Math.round(entriesWithDims/totalEntries*100)}%)`)
console.log(`  with min temp:  ${entriesWithMinTemp} (${Math.round(entriesWithMinTemp/totalEntries*100)}%)`)
console.log(`  cross-refs:     ${crossRefs} (${Math.round(crossRefs/totalEntries*100)}%)`)

// ── Output ────────────────────────────────────────────────────
const output = {
  source: 'Brickell, Christopher (ed.) (2011). AHS Encyclopedia of Plants and Flowers, 3rd ed. DK Publishing',
  extractedAt: new Date().toISOString(),
  dictionaryPages: `${DICT_START}-${DICT_END}`,
  genusCount: finalBlocks.length,
  entryCount: totalEntries,
  genera: finalBlocks,
}

writeFileSync(OUTPUT, JSON.stringify(output, null, 2), 'utf-8')
console.log(`\n[ahs] wrote ${OUTPUT}`)
