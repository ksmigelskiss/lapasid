// Darryl Cheng — "The New Plant Parent" (2019) EPUB → structured JSON.
//
// Įvestis: data/cheng-epub/ops/xhtml/ch12.html .. ch30.html
// Išvestis: data/cheng.json
//
// Knygos struktūra: 19 atskirų augalų profilių (ch12..ch30), kiekvienas su:
//   <h2 class="h2ab"> — Plant Title (Common Name)
//   <p>...narrative intro...</p>
//   <strong>Survival strategy</strong> + paragraph(s)
//   <strong>Growth strategy</strong> + paragraph(s)
//   <strong>Subjective life span</strong> + paragraph(s)
//   <h3>Observations from X Parenthood</h3>
//   <p class="noindentta">...photo captions with detailed observations...</p>
//   (Kai kuriuose pridėtas „NATURAL LIGHT / GROW LIGHT" su intensity/duration)
//
// Cheng = unikalu, nes:
//   1. Įtraukia POST-2010 trendy augalus (ZZ Plant, Pilea peperomioides),
//      kurių AHS ir Beckett'as neturi
//   2. Realūs foot-candle šviesos matavimai (vietoj abstrakčių "low/medium")
//   3. „Survival vs Growth" konceptas — atskiria minimum nuo optimum
//   4. „Subjective life span" — kiek kartų augalas atlaikys vidutinį
//      vartotoją; būna „weeks", „months", „years" kategorijos

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const XHTML_DIR = join(__dirname, '..', 'data', 'cheng-epub', 'ops', 'xhtml')
const OUTPUT    = join(__dirname, '..', 'data', 'cheng.json')

// Augalų profilių skyriai
const PLANT_CHAPTERS = [
  'ch12', 'ch13', 'ch14', 'ch15', 'ch16', 'ch17', 'ch18', 'ch19', 'ch20',
  'ch21', 'ch22', 'ch23', 'ch24', 'ch25', 'ch26', 'ch27', 'ch28', 'ch29', 'ch30',
]

// Manual mapping common name → Latin name. Cheng knygoje Latin names dažnai
// tik italics formoje (kursyvu), bet jos NĖRA visada chapter pradžioj.
// Surašiau iš knygos turinio + standartinės taxonomy'os.
const PLANT_LATIN_MAP = {
  'Dracaena': { genus: 'Dracaena', species: null, notes: 'Multiple species: marginata, fragrans, deremensis cultivars' },
  'Jade Plant': { genus: 'Crassula', species: 'ovata', notes: null },
  'Kangaroo Paw Fern': { genus: 'Microsorum', species: 'diversifolium', notes: null },
  'Marimo Moss Ball': { genus: 'Aegagropila', species: 'linnaei', notes: 'Filamentous green algae, often kept in water' },
  'Money Tree': { genus: 'Pachira', species: 'aquatica', notes: null },
  'Monstera': { genus: 'Monstera', species: 'deliciosa', notes: 'Swiss cheese plant' },
  'Mother of Thousands': { genus: 'Kalanchoe', species: 'daigremontiana', notes: 'syn. Bryophyllum daigremontianum' },
  'Mother of Thousands (Kalanchoe)': { genus: 'Kalanchoe', species: 'daigremontiana', notes: 'syn. Bryophyllum daigremontianum' },
  'Oxalis': { genus: 'Oxalis', species: 'triangularis', notes: 'Purple shamrock; most common species' },
  'Peace Lily': { genus: 'Spathiphyllum', species: 'wallisii', notes: 'Most common species' },
  'Philodendron Vines': { genus: 'Philodendron', species: 'hederaceum', notes: 'Heartleaf philodendron, syn. P. scandens, P. oxycardium' },
  'Pilea': { genus: 'Pilea', species: 'peperomioides', notes: 'Chinese money plant' },
  'Ponytail Palm': { genus: 'Beaucarnea', species: 'recurvata', notes: 'Not a true palm' },
  'Pothos': { genus: 'Epipremnum', species: 'aureum', notes: 'Devil\'s ivy, syn. Scindapsus aureus' },
  'Prayer Plant': { genus: 'Maranta', species: 'leuconeura', notes: null },
  'Rabbit\'s Foot Fern': { genus: 'Davallia', species: 'fejeensis', notes: null },
  'Rabbit’s Foot Fern': { genus: 'Davallia', species: 'fejeensis', notes: null },
  'Snake Plant': { genus: 'Sansevieria', species: 'trifasciata', notes: 'syn. Dracaena trifasciata (recent reclassification)' },
  'Staghorn Fern': { genus: 'Platycerium', species: 'bifurcatum', notes: 'Most common species' },
  'String of Hearts': { genus: 'Ceropegia', species: 'woodii', notes: null },
  'ZZ Plant': { genus: 'Zamioculcas', species: 'zamiifolia', notes: 'Eternity plant' },
}

// ── Utility: clean HTML to plain text (preserving paragraph structure) ──

function htmlToParagraphs(html) {
  // Split into block elements first
  const blocks = []

  // Find h2, h3, p elements with their class & content
  const blockRe = /<(h[1-3]|p|li)[^>]*?(?:class="([^"]*)")?[^>]*>([\s\S]*?)<\/\1>/gi
  let m
  while ((m = blockRe.exec(html)) !== null) {
    const tag = m[1].toLowerCase()
    const cls = m[2] ?? ''
    let text = m[3]
    // Strip nested tags but preserve strong-marked text
    const strongs = []
    text = text.replace(/<strong[^>]*>([^<]+)<\/strong>/g, (_, s) => {
      strongs.push(s.trim())
      return s
    })
    // Strip remaining HTML
    text = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    // Decode entities
    text = text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#8217;|&rsquo;/g, "'")
      .replace(/&#8216;|&lsquo;/g, "'")
      .replace(/&#8220;|&ldquo;/g, '"')
      .replace(/&#8221;|&rdquo;/g, '"')
      .replace(/&#8211;|&ndash;/g, '–')
      .replace(/&#8212;|&mdash;/g, '—')
      .replace(/&nbsp;/g, ' ')
    if (text) {
      blocks.push({ tag, cls, text, leadingStrong: strongs[0] ?? null })
    }
  }
  return blocks
}

// ── Parse a single plant chapter ────────────────────────────────

function parseChapter(filepath) {
  const html = readFileSync(filepath, 'utf-8')
  const blocks = htmlToParagraphs(html)

  // Find title (h2 with class h2ab usually has the plant name in <strong>)
  const titleBlock = blocks.find(b => b.tag === 'h2')
  const title = titleBlock?.text?.trim() ?? null

  // Walk blocks, building sections.
  //
  // Section detection:
  //   - If <p> starts with strong text matching "Survival strategy" / "Growth strategy"
  //     / "Subjective life span" — new section begins; current paragraph is the
  //     header label.
  //   - Following non-section <p> blocks belong to current section.
  //   - <h3> "Observations from X Parenthood" — new section "observations".
  //   - Photo caption blocks (class="figcap" or "noindentta") under observations
  //     section = list of observation entries.

  const sections = {
    intro: [],
    survival: [],
    growth: [],
    lifeSpan: [],
    observations: [],
    captions: [],
  }
  let currentSection = 'intro'
  let pastH3Observations = false

  for (const b of blocks) {
    // Skip title itself
    if (b.tag === 'h2') continue

    // H3 = Observations section start
    if (b.tag === 'h3') {
      if (/observation/i.test(b.text)) {
        currentSection = 'observations'
        pastH3Observations = true
      }
      continue
    }

    // Detect section headers via leading <strong>
    const strong = b.leadingStrong
    if (strong) {
      if (/^survival\s+strategy/i.test(strong)) {
        currentSection = 'survival'
        // The paragraph text starts with "Survival strategy" — strip that
        const stripped = b.text.replace(/^Survival strategy\s*/i, '').trim()
        if (stripped) sections.survival.push(stripped)
        continue
      }
      if (/^growth\s+strategy/i.test(strong)) {
        currentSection = 'growth'
        const stripped = b.text.replace(/^Growth strategy\s*/i, '').trim()
        if (stripped) sections.growth.push(stripped)
        continue
      }
      if (/^subjective\s+life\s+span/i.test(strong)) {
        currentSection = 'lifeSpan'
        const stripped = b.text.replace(/^Subjective life span\s*/i, '').trim()
        if (stripped) sections.lifeSpan.push(stripped)
        continue
      }
    }

    // Caption blocks under observations = separate list
    if (pastH3Observations && /caption|noindentta|image/i.test(b.cls)) {
      if (b.text.length > 20) sections.captions.push(b.text)
      continue
    }

    // figcap (figure caption) = caption regardless of section
    if (b.cls === 'figcap') {
      sections.captions.push(b.text)
      continue
    }

    // Regular paragraph — add to current section
    if (b.tag === 'p' && b.text.length > 10) {
      // Skip pure page anchors and short label text
      if (/^\s*$/.test(b.text)) continue
      sections[currentSection].push(b.text)
    }
  }

  return { title, sections }
}

// ── Run parser ─────────────────────────────────────────────────

console.log('[cheng] parsing plant profile chapters...')
const profiles = []

for (const ch of PLANT_CHAPTERS) {
  const filepath = join(XHTML_DIR, `${ch}.html`)
  try {
    const parsed = parseChapter(filepath)
    if (!parsed.title) {
      console.warn(`[cheng] ${ch}: NO TITLE found`)
      continue
    }

    const latinInfo = PLANT_LATIN_MAP[parsed.title] ?? null

    profiles.push({
      chapter: ch,
      commonName: parsed.title,
      latin: latinInfo ? {
        genus: latinInfo.genus,
        species: latinInfo.species,
        latinName: latinInfo.species
          ? `${latinInfo.genus} ${latinInfo.species}`
          : latinInfo.genus,
        notes: latinInfo.notes,
      } : null,
      intro: parsed.sections.intro.join('\n\n').slice(0, 1500),
      survivalStrategy: parsed.sections.survival.join('\n\n'),
      growthStrategy: parsed.sections.growth.join('\n\n'),
      subjectiveLifeSpan: parsed.sections.lifeSpan.join('\n\n'),
      observations: parsed.sections.observations,
      captions: parsed.sections.captions,
      sectionCounts: {
        survival: parsed.sections.survival.length,
        growth: parsed.sections.growth.length,
        lifeSpan: parsed.sections.lifeSpan.length,
        observations: parsed.sections.observations.length,
        captions: parsed.sections.captions.length,
      },
    })
  } catch (e) {
    console.error(`[cheng] ${ch}: ERROR`, e.message)
  }
}

console.log(`[cheng] parsed ${profiles.length} plant profiles`)

// Stats
const withAllSections = profiles.filter(
  p => p.survivalStrategy && p.growthStrategy && p.subjectiveLifeSpan
).length
const withLatin = profiles.filter(p => p.latin).length

console.log()
console.log('=== CHENG PROFILE STATS ===')
console.log(`Total profiles:           ${profiles.length}`)
console.log(`With all 3 strategies:    ${withAllSections}`)
console.log(`With Latin name mapping:  ${withLatin}`)

// Average lengths
const avgSurvival = profiles.reduce((s, p) => s + p.survivalStrategy.length, 0) / profiles.length
const avgGrowth = profiles.reduce((s, p) => s + p.growthStrategy.length, 0) / profiles.length
const avgLifeSpan = profiles.reduce((s, p) => s + p.subjectiveLifeSpan.length, 0) / profiles.length
const totalObservations = profiles.reduce((s, p) => s + p.observations.length, 0)
const totalCaptions = profiles.reduce((s, p) => s + p.captions.length, 0)
console.log(`Avg survival strategy:    ${Math.round(avgSurvival)} chars`)
console.log(`Avg growth strategy:      ${Math.round(avgGrowth)} chars`)
console.log(`Avg life span:            ${Math.round(avgLifeSpan)} chars`)
console.log(`Total observation paras:  ${totalObservations}`)
console.log(`Total photo captions:     ${totalCaptions}`)

// Output
const output = {
  source: 'Cheng, Darryl (2019). The New Plant Parent: Develop Your Green Thumb and Care for Your House-Plant Family. Abrams',
  extractedAt: new Date().toISOString(),
  profileCount: profiles.length,
  profiles,
}

writeFileSync(OUTPUT, JSON.stringify(output, null, 2), 'utf-8')
console.log(`\n[cheng] wrote ${OUTPUT}`)
