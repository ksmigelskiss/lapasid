/**
 * Build RAG context for AI Phase 2 — assembles all verified facts about a plant
 * from our scraped DB into a structured prompt context.
 *
 * USAGE:
 *   import { buildPlantRagContext } from './buildPlantRagContext'
 *
 *   const context = await buildPlantRagContext('Monstera deliciosa')
 *   // Inject into AI prompt:
 *   const aiResult = await claudeCall({
 *     system: PLANT_SYSTEM + '\n\n' + context,
 *     messages: [{ role: 'user', content: '...' }]
 *   })
 *
 * GOAL: AI's job is TRANSLATE + STRUCTURE, not GENERATE from memory.
 * Hallucination risk drops dramatically when AI receives verified facts.
 *
 * SOURCES included:
 *   • pre-db (genus + species — AHS, Beckett family/origin)
 *   • lt-names (LT name + synonyms, confidence + sources)
 *   • aspca-toxicity (verified pet toxicity matrix)
 *   • pfaf (toxicity hazards, edibility, medicinal, care, cultivation)
 *   • cheng profile (premium care for 19 plants)
 *   • latin-synonyms-reverse (taxonomy migrations)
 *
 * OUTPUT: formatted plain-text context (~400-800 tokens), ready to prepend
 * to AI system prompt.
 */

import { lookupPlant, getRawDb } from './preDb.js'
import { resolveLt } from './ltDictionary.js'

// Lazy loaders for other DB files
let pfafCache = null
let aspcaCache = null

async function loadPfaf() {
  if (pfafCache) return pfafCache
  const url = new URL('../../data/pfaf.json', import.meta.url)
  const res = await fetch(url)
  if (!res.ok) return { results: {} }
  pfafCache = await res.json()
  return pfafCache
}

async function loadAspca() {
  if (aspcaCache) return aspcaCache
  const url = new URL('../../data/aspca-toxicity.json', import.meta.url)
  const res = await fetch(url)
  if (!res.ok) return { toxicity: {} }
  aspcaCache = await res.json()
  return aspcaCache
}

// ── Helpers ───────────────────────────────────────────────────

/**
 * Try to match ASPCA slug from common/scientific name.
 * ASPCA slugs follow: "Aloe Vera" → "aloe", "Heartleaf Philodendron" → "heartleaf-philodendron"
 */
function guessAspcaSlugs(latinName, commonName) {
  const slugs = []
  if (commonName) {
    slugs.push(commonName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
  }
  if (latinName) {
    // Try full Latin
    slugs.push(latinName.toLowerCase().replace(/\s+/g, '-'))
    // Try just genus
    slugs.push(latinName.split(/\s+/)[0].toLowerCase())
  }
  return [...new Set(slugs)]
}

async function findAspcaEntry(latinName, commonName) {
  const aspca = await loadAspca()
  const slugs = guessAspcaSlugs(latinName, commonName)
  for (const slug of slugs) {
    if (aspca.toxicity?.[slug]) return aspca.toxicity[slug]
  }
  return null
}

// ── Main builder ──────────────────────────────────────────────

/**
 * Build verified-facts context for a plant.
 *
 * @param {string} latinName — e.g. "Monstera deliciosa" or just "Monstera"
 * @param {object} options
 * @param {boolean} options.includeCheng — include premium Cheng profile (default true)
 * @param {boolean} options.includePropagation — include propagation prose (default true)
 * @param {number} options.maxLen — cap output length (default 4000 chars)
 * @returns {Promise<{ context: string, sources: string[], confidence: 'high'|'mid'|'low' }>}
 */
export async function buildPlantRagContext(latinName, options = {}) {
  const {
    includeCheng = true,
    includePropagation = true,
    maxLen = 4000,
  } = options

  const sections = []
  const sourcesUsed = new Set()

  // ── IDENTITY (always) ───────────────────────────────────────
  const plant = await lookupPlant(latinName)
  const ltEntry = await resolveLt(latinName)

  sections.push(`=== VERIFIED FACTS about ${latinName} ===\n`)

  const idLines = []
  idLines.push(`Latin: ${latinName}`)
  if (plant?.genus?.family) {
    idLines.push(`Family: ${plant.genus.family} [sources: ${plant.genus.inSources.join(', ')}]`)
    plant.genus.inSources.forEach(s => sourcesUsed.add(s))
  }
  if (ltEntry?.ltName) {
    const synStr = ltEntry.ltSynonyms.length > 0 ? `, syn: ${ltEntry.ltSynonyms.join(', ')}` : ''
    idLines.push(`LT name: ${ltEntry.ltName}${synStr} [${ltEntry.sources.join('+')}, ${ltEntry.confidence}]`)
    ltEntry.sources.forEach(s => sourcesUsed.add(s))
  }
  if (plant?.species?.synonyms?.length > 0) {
    idLines.push(`Latin synonyms: ${plant.species.synonyms.join(', ')}`)
  }
  sections.push('📚 IDENTITY\n' + idLines.map(l => `  • ${l}`).join('\n'))

  // ── ORIGIN ──────────────────────────────────────────────────
  const origin = plant?.genus?.origin
  if (origin) {
    sections.push('📚 ORIGIN\n  • ' + origin + ' [source: ' + plant.genus.familySource + ']')
  }

  // ── PFAF data ───────────────────────────────────────────────
  const pfaf = await loadPfaf()
  const pfafEntry = pfaf.results?.[latinName]
                  ?? pfaf.results?.[latinName.split(/\s+/)[0]]  // genus fallback

  if (pfafEntry?.found) {
    sourcesUsed.add('pfaf')

    // Physical characteristics
    if (pfafEntry.physicalCharacteristics) {
      sections.push('📚 PHYSICAL (PFAF)\n  ' + pfafEntry.physicalCharacteristics.slice(0, 400))
    }
    if (pfafEntry.usdaHardiness) {
      sections.push(`📚 HARDINESS\n  • USDA zone: ${pfafEntry.usdaHardiness} (PFAF)`)
    }
    if (pfafEntry.range) {
      sections.push(`📚 RANGE\n  • ${pfafEntry.range} (PFAF)`)
    }
    if (pfafEntry.habitats) {
      sections.push(`📚 HABITATS\n  • ${pfafEntry.habitats} (PFAF)`)
    }

    // Care icons (structured care signals)
    if (pfafEntry.careIcons?.length > 0) {
      sections.push(`📚 CARE SIGNALS (PFAF icons)\n  • ${pfafEntry.careIcons.join(', ')}`)
    }

    // Toxicity hazards
    if (pfafEntry.knownHazards) {
      sections.push(`⚠️ KNOWN HAZARDS (PFAF — VERBATIM, do not paraphrase mechanism)\n  ${pfafEntry.knownHazards.slice(0, 600)}`)
    }

    // Ratings
    const ratings = []
    if (pfafEntry.edibilityRating > 0) ratings.push(`Edibility: ${pfafEntry.edibilityRating}/5`)
    if (pfafEntry.medicinalRating > 0) ratings.push(`Medicinal: ${pfafEntry.medicinalRating}/5`)
    if (pfafEntry.otherUsesRating > 0) ratings.push(`Other uses: ${pfafEntry.otherUsesRating}/5`)
    if (pfafEntry.weedPotential) ratings.push(`Weed potential: ${pfafEntry.weedPotential}`)
    if (ratings.length > 0) {
      sections.push('📚 PFAF RATINGS\n  • ' + ratings.join('\n  • '))
    }

    // Edibility detail
    if (pfafEntry.edibleParts?.length > 0 || pfafEntry.edibleUses) {
      const eLines = []
      if (pfafEntry.edibleParts?.length > 0) eLines.push(`Parts: ${pfafEntry.edibleParts.join(', ')}`)
      if (pfafEntry.edibleUses) eLines.push(`Uses: ${pfafEntry.edibleUses.slice(0, 300)}`)
      sections.push('📚 EDIBILITY (PFAF)\n  • ' + eLines.join('\n  • '))
    }

    // Medicinal detail
    if (pfafEntry.medicinalUses) {
      sections.push('📚 MEDICINAL (PFAF)\n  • ' + pfafEntry.medicinalUses.slice(0, 400))
    }

    // Cultivation
    if (pfafEntry.cultivationDetails) {
      sections.push('📚 CULTIVATION (PFAF)\n  ' + pfafEntry.cultivationDetails.slice(0, 400))
    }

    // Propagation
    if (includePropagation && pfafEntry.plantPropagation) {
      sections.push('📚 PROPAGATION (PFAF)\n  ' + pfafEntry.plantPropagation.slice(0, 400))
    }
  }

  // ── ASPCA toxicity (high authority) ─────────────────────────
  const aspcaEntry = await findAspcaEntry(latinName, pfafEntry?.commonNameEn)
  if (aspcaEntry) {
    sourcesUsed.add('aspca')
    sections.push(`⚠️ ASPCA TOXICITY (VERIFIED — authoritative)\n  • Toxic to: ${aspcaEntry.toxicTo.join(', ')}\n  • Display name: ${aspcaEntry.displayName}\n  • Details: ${aspcaEntry.detailUrl}`)
  }

  // ── Cheng premium care (19 plants only) ─────────────────────
  if (includeCheng && plant?.genus?.chengProfile) {
    sourcesUsed.add('cheng')
    const cp = plant.genus.chengProfile
    const chengLines = []
    if (cp.survivalStrategy) chengLines.push(`Survival strategy: ${cp.survivalStrategy.slice(0, 500)}`)
    if (cp.growthStrategy)   chengLines.push(`Growth strategy: ${cp.growthStrategy.slice(0, 500)}`)
    if (cp.subjectiveLifeSpan) chengLines.push(`Subjective life span: ${cp.subjectiveLifeSpan.slice(0, 300)}`)
    if (cp.observationsCount > 0) chengLines.push(`Has ${cp.observationsCount} parenthood observations (Cheng author personal notes)`)
    sections.push('⭐ PREMIUM CARE (Cheng "House Plant Journal")\n  ' + chengLines.join('\n  '))
  }

  // ── Genus intro (AHS/Beckett) — fallback context ────────────
  if (plant?.genus?.introText && !pfafEntry?.cultivationDetails) {
    sourcesUsed.add('encyclopedia')
    sections.push('📚 GENUS INFO (AHS/Beckett)\n  ' + plant.genus.introText.slice(0, 400))
  }

  // NB: anksčiau čia buvo „=== INSTRUCTIONS FOR AI ===" sekcija su
  // „Use ONLY these verified facts" / „DO NOT invent" / „If not in facts,
  // respond 'neturim info'". 2026-05-21 user test pamatė, kad ši instrukcija
  // KONFLIKTAVO su stage2Constants.js RAG_PRIORITY_INSTRUCTION („RAG = anchor
  // + EXPAND"). AI'us prioritetavo restrictive ("Use ONLY") → praleisdavo
  // toxicity narrative net su rich PFAF knownHazards RAG'e.
  //
  // Sprendimas: vienas šaltinis instrukcijų — stage2Constants.js. Šis modulis
  // grąžina TIK FAKTUS, ne instrukcijas. Caller'is (fetchDetails) injectina
  // RAG_PRIORITY_INSTRUCTION atskirai.

  let context = sections.join('\n\n')
  if (context.length > maxLen) {
    context = context.slice(0, maxLen) + '\n...[truncated]'
  }

  // Confidence assessment
  let confidence = 'low'
  if (sourcesUsed.size >= 4 || sourcesUsed.has('cheng')) confidence = 'high'
  else if (sourcesUsed.size >= 2) confidence = 'mid'

  return {
    context,
    sources: [...sourcesUsed].sort(),
    confidence,
    hasIdentityData: !!plant?.genus,
    hasLtName: !!ltEntry?.ltName,
    hasToxicity: !!(aspcaEntry || pfafEntry?.knownHazards),
    hasCare: !!(pfafEntry?.cultivationDetails || pfafEntry?.careIcons?.length || plant?.genus?.chengProfile),
    hasCheng: !!plant?.genus?.chengProfile,
  }
}

/**
 * Lightweight context for Stage 1 (slim search) — just essentials.
 * Faster, cheaper, ~200 tokens. Used when full Stage 2 not needed yet.
 */
export async function buildSlimRagContext(latinName) {
  const plant = await lookupPlant(latinName)
  const ltEntry = await resolveLt(latinName)
  const aspcaEntry = await findAspcaEntry(latinName, null)

  const lines = []
  lines.push(`SLIM CONTEXT for ${latinName}:`)
  if (plant?.genus?.family) lines.push(`Family: ${plant.genus.family}`)
  if (ltEntry?.ltName) lines.push(`LT: ${ltEntry.ltName} [${ltEntry.confidence}]`)
  if (aspcaEntry) lines.push(`Toxic to: ${aspcaEntry.toxicTo.join(', ')} (ASPCA)`)
  if (plant?.genus?.origin) lines.push(`Origin: ${plant.genus.origin}`)

  return lines.join('\n')
}
