/**
 * Server-side RAG context builder — MIRROR of src/utils/buildPlantRagContext.js.
 *
 * VAIDMUO: assemble visus verified facts iš mūsų scraped DB (pre-DB +
 * LT names + ASPCA + PFAF + Cheng + latin synonyms) į structured prompt
 * context'ą Phase 2 AI call'ui.
 *
 * BEHAVIORAL CONTRACT — IDENTIŠKAS client'o variantui:
 *   • Sekcijų tvarka: IDENTITY → ORIGIN → PFAF physical/hardiness/range/habitats
 *     → PFAF care signals → PFAF toxicity → PFAF ratings → PFAF edibility
 *     → PFAF medicinal → PFAF cultivation → PFAF propagation → ASPCA toxicity
 *     → Cheng premium care → genus intro (fallback)
 *   • Toxicity prompt instrukcijos (D strict directive): IDENTIŠKAS text'as
 *     kaip client'o — kad AI grąžintų pavojai[] + pavojingumas.detales
 *     tame pačiame format'e (catalog consistency!)
 *
 * KAS SKIRIASI nuo client'o:
 *   • Imports iš `*-server.js` mirror'ų (lookupPlantServer, resolveLtServer)
 *   • Data load'inimas per dataLoader-server.js
 *   • Module-level cache vietoj `let xxxCache = null` global'ų — tas pats efektas
 */
import { lookupPlantServer } from './preDb-server.js'
import { resolveLtServer } from './ltDictionary-server.js'
import { loadJson } from './dataLoader-server.js'
import { resolveCanonicalServer, getReclassificationServer } from './latinResolver-server.js'

async function loadPfaf() {
  try {
    return await loadJson('pfaf.json')
  } catch { return { results: {} } }
}

async function loadAspca() {
  try {
    return await loadJson('aspca-toxicity.json')
  } catch { return { toxicity: {} } }
}

// ── Helpers ───────────────────────────────────────────────────
// MIRROR src/utils/buildPlantRagContext.js guessAspcaSlugs() — IDENTIŠKAS

function guessAspcaSlugs(latinName, commonName) {
  const slugs = []
  if (commonName) {
    slugs.push(commonName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
  }
  if (latinName) {
    slugs.push(latinName.toLowerCase().replace(/\s+/g, '-'))
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
 * MIRROR src/utils/buildPlantRagContext.js buildPlantRagContext().
 *
 * @param {string} latinName
 * @param {object} options
 * @returns {Promise<{ context, sources, confidence, hasIdentityData,
 *   hasLtName, hasToxicity, hasCare, hasCheng }>}
 */
export async function buildPlantRagContextServer(latinName, options = {}) {
  const {
    includeCheng = true,
    includePropagation = true,
    maxLen = 4000,
  } = options

  const sections = []
  const sourcesUsed = new Set()

  // ── TAXONOMY MIGRATION RESOLVE (2026-05-24) ──────────────────
  // MIRROR src/utils/buildPlantRagContext.js — TRY-ORIGINAL-FIRST pattern.
  // Reverse map turi major migrations: Sansevieria→Dracaena, Saintpaulia→Streptocarpus.
  const canonicalName = await resolveCanonicalServer(latinName)
  const reclassification = canonicalName !== latinName
    ? await getReclassificationServer(latinName)
    : null

  // Try original first; canonical fallback only if original missing
  let plant = await lookupPlantServer(latinName)
  let ltEntry = await resolveLtServer(latinName)
  let lookupName = latinName
  let usedCanonicalFallback = false

  if (!plant?.genus && reclassification) {
    plant = await lookupPlantServer(canonicalName)
    ltEntry = await resolveLtServer(canonicalName)
    lookupName = canonicalName
    usedCanonicalFallback = true
  }

  sections.push(`=== VERIFIED FACTS about ${latinName} ===\n`)

  const idLines = []
  idLines.push(`Latin: ${latinName}`)
  if (reclassification) {
    const note = usedCanonicalFallback
      ? `(originalui DB tylėjo — info paimta iš ${reclassification.canonical})`
      : `(mūsų DB turi originalą; ${reclassification.canonical} pažymėtas info)`
    idLines.push(`Taxonomy: reclassified → ${reclassification.canonical} ${note}`)
    sourcesUsed.add('taxonomy-migration')
  }
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
  // PFAF lookup — try original first, then canonical
  const pfafEntry = pfaf.results?.[latinName]
                  ?? pfaf.results?.[latinName.split(/\s+/)[0]]
                  ?? (reclassification ? pfaf.results?.[canonicalName] : null)
                  ?? (reclassification ? pfaf.results?.[canonicalName.split(/\s+/)[0]] : null)

  if (pfafEntry?.found) {
    sourcesUsed.add('pfaf')

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

    if (pfafEntry.careIcons?.length > 0) {
      sections.push(`📚 CARE SIGNALS (PFAF icons)\n  • ${pfafEntry.careIcons.join(', ')}`)
    }

    // Toxicity hazards — IDENTIŠKAS client side D strict directive.
    if (pfafEntry.knownHazards) {
      sections.push(
`TOXICITY DATA (PFAF) — PRIVALOMA pildyti AB schema laukus:

Source text: "${pfafEntry.knownHazards.slice(0, 600)}"

Action — užpildyk EXACTLY šitokia struktūra (ne tik tekstas):

  savybes.pavojai: [
    { tipas: "toksiskas", target: "zmonems",  severity: <stiprus|vidutinis|silpnas> },
    { tipas: "toksiskas", target: "gyvunams", severity: <stiprus|vidutinis|silpnas> },
    ... (pagal toxicity profilį, MIN 1 entry)
  ]
  savybes.pavojingumas.detales: <3-5 sakiniai LT su mechanism, simptomais, first-aid pointer>

Severity sprendimas: jei knownHazards mini „death", „fatal", „lethal", „paralyz",
„kills", arba augalas yra klasikinis toksikologijos pavyzdys → stiprus.
Jei „vomit", „nausea", „burning", „severe" → vidutinis.
Jei „irritate", „rash", „mild" → silpnas.

TUŠČIAS pavojai[] = SCHEMA KLAIDA šiam augalui (turi knownHazards data).`,
      )
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

    // Edibility
    if (pfafEntry.edibleParts?.length > 0 || pfafEntry.edibleUses) {
      const eLines = []
      if (pfafEntry.edibleParts?.length > 0) eLines.push(`Parts: ${pfafEntry.edibleParts.join(', ')}`)
      if (pfafEntry.edibleUses) eLines.push(`Uses: ${pfafEntry.edibleUses.slice(0, 300)}`)
      sections.push('📚 EDIBILITY (PFAF)\n  • ' + eLines.join('\n  • '))
    }

    // Medicinal
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
  // ASPCA lookup — try original first, then canonical
  let aspcaEntry = await findAspcaEntry(latinName, pfafEntry?.commonNameEn)
  if (!aspcaEntry && reclassification) {
    aspcaEntry = await findAspcaEntry(canonicalName, pfafEntry?.commonNameEn)
  }
  if (aspcaEntry) {
    sourcesUsed.add('aspca')
    sections.push(
      `PET TOXICITY DATA (ASPCA) — PRIVALOMA INTEGRUOTI Į savybes.pavojai[]:\n  • Toksiškas: ${aspcaEntry.toxicTo.join(', ')}\n  • Common name: ${aspcaEntry.displayName}\n  • Detail URL: ${aspcaEntry.detailUrl}\n\nAction: pridėti structured entry per target į savybes.pavojai[], pavojingumas.detales rašyti LT su mechanism (jei žinai) + simptomais + Pet Poison Helpline citation.`,
    )
  }

  // ── Cheng premium care ─────────────────────────────────────
  if (includeCheng && plant?.genus?.chengProfile) {
    sourcesUsed.add('cheng')
    const cp = plant.genus.chengProfile
    const chengLines = []
    if (cp.survivalStrategy)   chengLines.push(`Survival strategy: ${cp.survivalStrategy.slice(0, 500)}`)
    if (cp.growthStrategy)     chengLines.push(`Growth strategy: ${cp.growthStrategy.slice(0, 500)}`)
    if (cp.subjectiveLifeSpan) chengLines.push(`Subjective life span: ${cp.subjectiveLifeSpan.slice(0, 300)}`)
    if (cp.observationsCount > 0) chengLines.push(`Has ${cp.observationsCount} parenthood observations (Cheng author personal notes)`)
    sections.push('⭐ PREMIUM CARE (Cheng "House Plant Journal")\n  ' + chengLines.join('\n  '))
  }

  // ── Genus intro fallback ────────────────────────────────────
  if (plant?.genus?.introText && !pfafEntry?.cultivationDetails) {
    sourcesUsed.add('encyclopedia')
    sections.push('📚 GENUS INFO (AHS/Beckett)\n  ' + plant.genus.introText.slice(0, 400))
  }

  let context = sections.join('\n\n')
  if (context.length > maxLen) {
    context = context.slice(0, maxLen) + '\n...[truncated]'
  }

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
