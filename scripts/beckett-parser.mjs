// Beckett 1995 — "The Encyclopedia of House Plants" PDF → structured JSON.
//
// Įvestis: data/beckett-clean.txt (extracted with `pdftotext -raw`)
// Išvestis: data/beckett.json
//
// Naudoja paprastą state machine'ą:
//   SCAN → IN_GENUS_HEADER → IN_GENUS_INTRO → IN_SPECIES_LIST
//
// Beckett'o A-Z formato struktūra:
//   GENUS                          ← uppercase, atskira eilutė
//   Familyaceae                    ← šeima, baigiasi -aceae (arba -ae)
//   Origin: <text>. A genus of X species of <kind> ...
//   ... general genus description ...
//   Species cultivated             ← header (kartais praleidžiamas)
//   A. species_name (synonym) Common name Geography
//   ... description ...
//   Cool. / Temperate. / Tropical. ← temperatūros klasė
//   'Cultivar Name', ...           ← kultivarai (jeigu yra)

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const INPUT = join(__dirname, '..', 'data', 'beckett-clean.txt')
const OUTPUT = join(__dirname, '..', 'data', 'beckett.json')

// ── Header blacklist — non-genus all-caps lines ───────────────
const HEADER_BLACKLIST = new Set([
  'ABOVE', 'BELOW', 'RIGHT', 'LEFT', 'TOP', 'BOTTOM',
  'COOL', 'TEMPERATE', 'TROPICAL', 'HARDY',
  'CULTIVATION', 'CONTAINERS', 'PROPAGATION', 'LIGHT',
  'INTRODUCTION', 'GLOSSARY', 'ACKNOWLEDGMENTS', 'CONTENTS',
  'BROMELIADS', 'ORCHIDS', 'FERNS', 'PALMS', 'CACTI', 'SUCCULENTS',
  'BULBS', 'TUBERS', 'RHIZOMES', 'AROIDS', 'ANNUALS', 'BIENNIALS',
  'CLIMBERS', 'HERBS', 'SHRUBS', 'PERENNIALS', 'TREES', 'TREE', 'FERN',
  'SPECIES', 'AND', 'THE', 'OR', 'FOR', 'ALL', 'ARE', 'NEW', 'RHS',
  'TYPE', 'TIPS', 'END', 'SIDE', 'HOUSE', 'PLANTS', 'COME', 'FROM',
  // OCR artifacts that look like uppercase tokens
  'OE', 'AMM', 'BAL', 'BAR', 'BOS', 'MEN', 'THU', 'TUS', 'TAR', 'TSI',
  'TRIE', 'XYZ', 'SSSS', 'ADA', // ADA is Beckett genus but only 2 letters elsewhere – keep it later
  'SULTIVATION', 'BROMORKES', 'BARNES', 'ANTHEMUM',
  'SPECIAL', 'GROUPS', 'AQUATIC', 'GARDENING',
])

// ADA is actually a real orchid genus in Beckett — un-blacklist via explicit re-add
HEADER_BLACKLIST.delete('ADA')

// ── Family detector: ends in -aceae or OCR-mangled variant, OR -idae/-eae ───
//
// Beckett OCR is noisy — same family appears as:
//   "Apocynaceae" (correct), "Apocynaceag", "Aracede" (Araceae),
//   "Agavaceae (Liliaceae)" (alternate family in parens)
//
// So we accept anything that:
//   - Starts uppercase
//   - Ends with -ace[ae]+[gd]? (handles "aceae", "acea", "aceag", "acede")
//   - OR ends with -idae / -aeae
//   - OR has "(...)" suffix with alternate family
const FAMILY_RE = /^[A-Z][a-z]+(ace[ade]g?|acede|idae|aeae)(\s*\([^)]+\))?$/

// ── Species entry: "A. species_name ..." ──────────────────────
// Captures: abbrev (one letter + dot), species name, rest of line
//
// Tolerates leading OCR punctuation like ".S. soleirolii" or "|S. cernuus"
const SPECIES_RE = /^[.,;:|`'"\s]*([A-Z])\.\s+([a-zA-Z]+(?:[\s-][a-z]+)?)\s*(.*)$/

// ── Cultivar entry: "'Cultivar Name', description" ────────────
const CULTIVAR_RE = /^['‘]([^'’]+)[''’],?\s*(.*)$/

// ── Temperature class: standalone "Cool." / "Temperate." / "Tropical." / "Cool to temperate." ─
const TEMP_RE = /^(Cool|Temperate|Tropical|Hardy)(\s+to\s+(cool|temperate|tropical|hardy))?\.?\s*$/i

// ── Section markers ───────────────────────────────────────────
const SPECIES_CULTIVATED_RE = /^Species cultivated\s*$/i

// ── Load + clean ──────────────────────────────────────────────
const raw = readFileSync(INPUT, 'utf-8')
const lines = raw.split('\n').map(l => l.trim())

console.log(`[beckett] loaded ${lines.length} lines`)

// ── Pass 1: Detect genus block boundaries ─────────────────────
//
// A line is a genus header if:
//   - it's all uppercase (3+ chars, letters only)
//   - not in blacklist
//   - the NEXT meaningful line either matches FAMILY_RE OR is followed within
//     ~5 lines by a line starting with "Origin:"
//
// We collect blocks: { genus, family, startLine, endLine }

// Genus header patterns we accept:
//   1. "GENUS"                       — alone on line (most common)
//   2. "GENUS Familyaceae"           — fused with family on same line (e.g. HOYA)
//   3. "GENUS X. species ..."        — column-merge OCR (e.g. PHILODENDRON)
//
// Returns the bare genus name or null.
function isGenusHeader(line) {
  if (!line) return null

  // Case 1: alone
  const aloneMatch = line.match(/^([A-Z]{3,})$/)
  if (aloneMatch && !HEADER_BLACKLIST.has(aloneMatch[1])) return aloneMatch[1]

  // Case 2: GENUS + family on same line
  const fusedMatch = line.match(/^([A-Z]{3,})\s+([A-Z][a-z]+ace[ade]g?)/)
  if (fusedMatch && !HEADER_BLACKLIST.has(fusedMatch[1])) return fusedMatch[1]

  // Case 3: GENUS + species column-merge
  const colMatch = line.match(/^([A-Z]{3,})\s+[A-Z]\.\s+[a-z]/)
  if (colMatch && !HEADER_BLACKLIST.has(colMatch[1])) return colMatch[1]

  return null
}

function looksLikeFamily(line) {
  return FAMILY_RE.test(line)
}

// Find genus blocks
//
// PRIMARY anchor: uppercase genus header followed by "Origin:" within 12 lines.
// Family detection is secondary — many real genera have OCR-mangled family
// (e.g. Adiantum → "A diantu Cie", Philodendron → "ithcola"). We don't reject
// the block when family is unrecognizable, just store raw line as family hint.
const blocks = []
for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  const genusName = isGenusHeader(line)
  if (!genusName) continue

  // PRIMARY: find "Origin" (with or without colon) within 12 lines.
  // Some Beckett entries lost the colon to OCR (e.g. ADIANTUM → "Origin Cosmopolitan").
  let originIdx = -1
  for (let j = i + 1; j < Math.min(i + 13, lines.length); j++) {
    if (/^Origin[:\s]/i.test(lines[j])) {
      originIdx = j
      break
    }
  }

  if (originIdx === -1) continue // running header / continuation, not main entry

  // SECONDARY: try to find family line between genus header and Origin
  let familyLine = null
  let familyIdx = -1
  for (let j = i + 1; j < originIdx; j++) {
    const candidate = lines[j]
    if (!candidate) continue
    if (looksLikeFamily(candidate)) {
      familyLine = candidate
      familyIdx = j
      break
    }
  }
  // Fallback: just use first non-empty line after genus header as raw family hint
  if (!familyLine) {
    for (let j = i + 1; j < originIdx; j++) {
      if (lines[j] && !/^(ABOVE|BELOW|RIGHT|LEFT|TOP|BOTTOM)\b/.test(lines[j])) {
        familyLine = lines[j] // raw, possibly OCR-mangled
        familyIdx = j
        break
      }
    }
  }

  blocks.push({
    genus: genusName,
    family: familyLine,
    familyConfident: looksLikeFamily(familyLine ?? ''),
    startLine: i,
    familyLine: familyIdx,
    originLine: originIdx,
    originDistance: originIdx - i,
  })
}

// ── Resolve Origin conflicts ──────────────────────────────────
//
// When OCR garbage (e.g. "OBOE" inside care-symbol row) appears between a real
// genus header and the next genus's Origin: line, our 12-line lookahead matches
// the WRONG Origin. Dedup by originLine — keep the closest header (smallest
// distance) for each Origin.
const originOwners = new Map() // originLine → block with smallest distance
for (const b of blocks) {
  const existing = originOwners.get(b.originLine)
  if (!existing || b.originDistance < existing.originDistance) {
    originOwners.set(b.originLine, b)
  }
}
const dedupedBlocks = [...originOwners.values()].sort((a, b) => a.startLine - b.startLine)
console.log(`[beckett] after Origin dedup: ${dedupedBlocks.length} blocks (was ${blocks.length})`)
blocks.length = 0
blocks.push(...dedupedBlocks)

console.log(`[beckett] detected ${blocks.length} genus block candidates`)

// Set endLine of each block = startLine of next block - 1, last block runs to EOF
for (let i = 0; i < blocks.length; i++) {
  blocks[i].endLine = (i + 1 < blocks.length) ? blocks[i + 1].startLine - 1 : lines.length - 1
}

// ── Pass 2: Merge duplicate genus blocks (same genus, e.g. POLYPODIUM appears 3×) ─
const mergedMap = new Map()
for (const b of blocks) {
  if (!mergedMap.has(b.genus)) {
    mergedMap.set(b.genus, { ...b, segments: [[b.startLine, b.endLine]] })
  } else {
    mergedMap.get(b.genus).segments.push([b.startLine, b.endLine])
  }
}
const mergedBlocks = [...mergedMap.values()]
console.log(`[beckett] merged into ${mergedBlocks.length} unique genera`)

// ── Pass 3: Parse each genus block into structured entry ──────

/**
 * Extract genus introduction (origin, count, etymology) from the lines BEFORE
 * first species entry.
 */
function parseGenusIntro(blockLines) {
  // Collect lines until first species entry, "Species cultivated" header, or end
  const introLines = []
  for (const line of blockLines) {
    if (SPECIES_RE.test(line)) break
    if (SPECIES_CULTIVATED_RE.test(line)) break
    introLines.push(line)
  }

  const introText = introLines.join(' ').replace(/\s+/g, ' ').trim()

  // Try to extract: "Origin: <countries>. A genus of <N> species of <kind>..."
  let origin = null
  let speciesCount = null
  let kind = null
  let etymology = null

  // Origin may appear with or without colon (OCR may strip it).
  const originMatch = introText.match(/Origin[:\s]+([^.]+)\./i)
  if (originMatch) origin = originMatch[1].trim()

  const countMatch = introText.match(/A genus of (?:about\s+)?(\d+(?:[-–]\d+)?|one|two|three|four|five|six|several|many|few)\s+species\s+of\s+([^.,]+)/i)
  if (countMatch) {
    speciesCount = countMatch[1]
    kind = countMatch[2].trim()
  }

  // Etymology often at end: "<Genus> derives from the Greek/Latin <word>, meaning..."
  const etyMatch = introText.match(/([A-Z][a-z]+\s+derives\s+from[^.]*\.[^.]*?\.?)/i)
  if (etyMatch) etymology = etyMatch[1].trim()

  return { introText, origin, speciesCount, kind, etymology }
}

/**
 * Parse a single species entry. Lines are: the species header line + all
 * following description lines until the next species or cultivar list.
 */
function parseSpecies(headerLine, descLines) {
  const m = headerLine.match(SPECIES_RE)
  if (!m) return null
  const [, abbrev, species, rest] = m

  // rest = "(synonym) Common name Geography" — try to split
  // Patterns:
  //   "Common Name Country, Country"  (rare)
  //   "(A. synonym) Common name Country"
  //   "Country to Country"  (no common name)
  //   ""  (geography is on next line)
  //
  // Cheap heuristic: synonym in parens → strip; remaining = common name + geography
  // We don't try to perfectly split common name from geography — store rest as `header_rest`.

  let synonyms = []
  let header_rest = rest
  const synMatch = rest.match(/^\(([^)]+)\)\s*(.*)$/)
  if (synMatch) {
    // Synonym block: "(A. cuneatum, A. aemulum)" — split by comma
    synonyms = synMatch[1].split(/,\s*/).map(s => s.trim())
    header_rest = synMatch[2].trim()
  }

  // Description = all lines below header until end of block
  const fullDesc = descLines.join(' ').replace(/\s+/g, ' ').trim()

  // Extract temperature class (Cool. / Temperate. / Tropical. — usually at end)
  let temperature = null
  const tempMatch = fullDesc.match(/\b(Cool|Temperate|Tropical|Hardy)(\s+to\s+(?:cool|temperate|tropical|hardy))?\.\s*$/i)
  if (tempMatch) temperature = tempMatch[0].replace(/\.$/, '').trim()

  // Extract cultivars: list of 'Name', desc OR 'Name' (Synonym), desc
  // We look for lines that start with quote-name-quote inside fullDesc — collected
  // independently in next pass below.

  return {
    latinAbbrev: `${abbrev}. ${species}`,
    species,
    synonyms,
    headerRest: header_rest,  // contains common name + geography mashed together
    description: fullDesc,
    temperature,
  }
}

// Manual family fixups — for genera where OCR completely destroyed the family
// line, but we know the canonical family with certainty. Only well-known +
// horticulturally important genera. Sources: APG IV + Beckett's table of
// contents groupings.
const FAMILY_OVERRIDES = {
  ACTINIOPTERIS: 'Pteridaceae',
  ADIANTUM: 'Pteridaceae',
  ANISODONTEA: 'Malvaceae',
  ARCHONTOPHOENIX: 'Arecaceae',
  ARIOCARPUS: 'Cactaceae',
  ARISAEMA: 'Araceae',
  ARISARUM: 'Araceae',
  ARISTEA: 'Iridaceae',
  ARUNDO: 'Poaceae',
  CHAMAERANTHEMUM: 'Acanthaceae',
  CORDYLINE: 'Asparagaceae',
  CYRTOMIUM: 'Dryopteridaceae',
  DICKSONIA: 'Dicksoniaceae',
  DIETES: 'Iridaceae',
  DROSANTHEMUM: 'Aizoaceae',
  ECHINOCEREUS: 'Cactaceae',
  FELICIA: 'Asteraceae',
  FREMONTODENDRON: 'Malvaceae',
  HOYA: 'Apocynaceae',
  LAVANDULA: 'Lamiaceae',
  MACROZAMIA: 'Zamiaceae',
  MALPIGHIA: 'Malpighiaceae',
  MOMORDICA: 'Cucurbitaceae',
  MONSTERA: 'Araceae',
  MORAEA: 'Iridaceae',
  MUSA: 'Musaceae',
  MUTISIA: 'Asteraceae',
  MYOSOTIS: 'Boraginaceae',
  MYRIOPHYLLUM: 'Haloragaceae',
  NAUTILOCALYX: 'Gesneriaceae',
  NELUMBO: 'Nelumbonaceae',
  NEMATANTHUS: 'Gesneriaceae',
  NIEREMBERGIA: 'Solanaceae',
  OXALIS: 'Oxalidaceae',
  PHILODENDRON: 'Araceae',
  PHRAGMIPEDIUM: 'Orchidaceae',
  PHYLLOSTACHYS: 'Poaceae',
  REINWARDTIA: 'Linaceae',
  RHAPHIDOPHORA: 'Araceae',
  RIVINA: 'Phytolaccaceae',
  TAPEINOCHEILOS: 'Costaceae',
  OSCULARIA: 'Aizoaceae',
  EPISCIA: 'Gesneriaceae', // raw was "Uesnenaceae"
  AMOMUM: 'Zingiberaceae',
  ODONTON: 'Acanthaceae', // OCR-truncated from ODONTONEMA (intro confirms)
  CLUSIA: 'Clusiaceae',   // modern; older name Guttiferae also valid
}

// Genus renames — for entries where OCR truncated the genus name. The etymology
// or context confirms the correct full name.
const GENUS_RENAMES = {
  ODONTON: 'ODONTONEMA',
}

// Clean family string: trim parens, drop "Species cultivated" if accidentally
// captured, normalize OCR variants (acea → aceae, aceag → aceae).
function cleanFamily(raw) {
  if (!raw) return null
  // Drop trailing "(...)" alternate
  let f = raw.replace(/\s*\([^)]*\)\s*$/, '').trim()
  // Drop trailing garbage after family word
  const m = f.match(/^([A-Z][a-z]+(?:aceae|idae|eae|aceag|acea|acede))/)
  if (m) f = m[1]
  // Normalize OCR endings
  f = f.replace(/acea(g|d)?$/, 'aceae')
  // Bail on obvious non-families
  if (/^(Species|Stems|Leaves|Origin)/i.test(f)) return null
  if (f.length > 40) return null
  return f
}

function parseGenusBlock(blockData, lines) {
  const { genus, family, segments } = blockData

  // Concatenate all segments into one flat line array
  const blockLines = []
  for (const [start, end] of segments) {
    for (let i = start; i <= end; i++) {
      blockLines.push(lines[i])
    }
  }

  // Skip the genus header line itself (and family line) when parsing
  // First non-header content starts at genus name + 1
  // Family line index is anywhere within first few lines — we keep all
  const contentLines = blockLines.filter(l => l && l !== genus)

  // Find first species entry index
  let firstSpeciesIdx = contentLines.length
  for (let i = 0; i < contentLines.length; i++) {
    if (SPECIES_RE.test(contentLines[i])) {
      firstSpeciesIdx = i
      break
    }
  }

  // Intro = everything before first species entry
  const introLines = contentLines.slice(0, firstSpeciesIdx)
  const intro = parseGenusIntro(introLines)

  // Walk species entries
  const speciesList = []
  let currentSpecies = null
  let currentDescLines = []
  let currentCultivars = []

  const flushSpecies = () => {
    if (!currentSpecies) return
    const parsed = parseSpecies(currentSpecies, currentDescLines)
    if (parsed) {
      parsed.cultivars = currentCultivars
      speciesList.push(parsed)
    }
    currentSpecies = null
    currentDescLines = []
    currentCultivars = []
  }

  for (let i = firstSpeciesIdx; i < contentLines.length; i++) {
    const line = contentLines[i]
    if (SPECIES_RE.test(line)) {
      flushSpecies()
      currentSpecies = line
    } else if (currentSpecies) {
      // Check if cultivar line
      const cm = line.match(CULTIVAR_RE)
      if (cm) {
        currentCultivars.push({ name: cm[1].trim(), description: cm[2].trim() })
      } else {
        currentDescLines.push(line)
      }
    }
  }
  flushSpecies()

  const cleaned = cleanFamily(family)
  const finalFamily = FAMILY_OVERRIDES[genus] ?? cleaned
  const finalGenus = GENUS_RENAMES[genus] ?? genus

  return {
    genus: finalGenus,
    genusRaw: genus !== finalGenus ? genus : undefined,
    family: finalFamily,
    familyRaw: family,
    familySource: FAMILY_OVERRIDES[genus] ? 'manual' : (cleaned ? 'ocr' : 'missing'),
    origin: intro.origin,
    speciesCountRaw: intro.speciesCount,
    kind: intro.kind,
    etymology: intro.etymology,
    introText: intro.introText.length > 1500
      ? intro.introText.slice(0, 1500) + '...'
      : intro.introText,
    species: speciesList,
    speciesCount: speciesList.length,
  }
}

// ── Run parser ────────────────────────────────────────────────
const parsed = mergedBlocks.map(b => parseGenusBlock(b, lines))

// Filter blocks that have no species (probably misdetections) — but keep if has intro
const valid = parsed.filter(g => g.species.length > 0 || (g.introText && g.introText.length > 100))

console.log(`[beckett] parsed ${parsed.length} blocks, ${valid.length} valid`)

const totalSpecies = valid.reduce((sum, g) => sum + g.speciesCount, 0)
const totalCultivars = valid.reduce(
  (sum, g) => sum + g.species.reduce((s, sp) => s + (sp.cultivars?.length ?? 0), 0),
  0
)
console.log(`[beckett] total species: ${totalSpecies}, total cultivars: ${totalCultivars}`)

// ── Output ────────────────────────────────────────────────────
const output = {
  source: 'Beckett, Kenneth A. (1995). The Encyclopedia of House Plants',
  extractedAt: new Date().toISOString(),
  genusCount: valid.length,
  speciesCount: totalSpecies,
  cultivarCount: totalCultivars,
  genera: valid,
}

writeFileSync(OUTPUT, JSON.stringify(output, null, 2), 'utf-8')
console.log(`[beckett] wrote ${OUTPUT}`)
