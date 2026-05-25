/**
 * Server-side deriveToxicity — MIRROR of src/utils/deriveToxicity.js.
 *
 * VAIDMUO: Phase 2 post-AI backfill — jei AI grąžino tuščią pavojai[]
 * BET mūsų sources (ASPCA + PFAF) turi toxicity → automatic backfill.
 *
 * BEHAVIORAL CONTRACT — IDENTIŠKAS client'o variantui:
 *   • derivePfafSeverity() — TIKSLIAI tas pats heuristic'as
 *   • deriveToxicityFromSources() — same return shape, same priority
 *     (ASPCA verified veterinary > PFAF botanical hazards text)
 *   • isPavojaiEmpty() — identical
 *
 * KAS SKIRIASI nuo client'o:
 *   • loadJson() iš dataLoader-server.js vietoj fetch'o
 *   • Cache'as gyvena module scope'e (Fluid Compute Function instance'as
 *     persi-naudoja tarp request'ų)
 */
import { loadJson } from './dataLoader-server.js'

async function loadAspca() {
  try {
    return await loadJson('aspca-toxicity.json')
  } catch { return { toxicity: {} } }
}

async function loadPfaf() {
  try {
    return await loadJson('pfaf.json')
  } catch { return { results: {} } }
}

async function loadAspcaGenusMap() {
  try {
    const data = await loadJson('aspca-genus-map.json')
    return data.toxicityByGenus ?? {}
  } catch { return {} }
}

async function loadAnimalTerms() {
  try {
    const data = await loadJson('aspca-animals-lt.json')
    return data.terms ?? {}
  } catch { return {} }
}

// Strip PFAF reference markers like [311], [301], etc. — clean text for display
function stripPfafMarkers(text) {
  if (!text) return text
  return text.replace(/\s*\[\s*\d+\s*\]/g, '').replace(/\s+/g, ' ').trim()
}

// Smart truncation — cuts at last sentence boundary BEFORE maxLen, ne raw char.
// Prevents „...kruo..." mid-word cuts (user feedback 2026-05-25).
function smartTruncate(text, maxLen = 600) {
  if (!text || text.length <= maxLen) return text
  const slice = text.slice(0, maxLen)
  // Find last sentence end (period + space or period + end)
  const lastDot = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('.'),
  )
  if (lastDot > maxLen * 0.6) {
    // Sentence end found in reasonable position — cut there clean
    return slice.slice(0, lastDot + 1)
  }
  // No sentence break — fall back to word boundary
  const lastSpace = slice.lastIndexOf(' ')
  return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice) + '...'
}

// Translate ASPCA animal terms array → LT comma-separated string
function translateAnimalTargets(targets, terms) {
  if (!targets || targets.length === 0) return ''
  return targets.map(t => terms[t.toLowerCase()] ?? t).join(', ')
}

// ── Severity heuristic iš PFAF knownHazards textą ─────────────
// MIRROR src/utils/deriveToxicity.js derivePfafSeverity() — IDENTIŠKAS.

function derivePfafSeverity(hazardsText) {
  if (!hazardsText || typeof hazardsText !== 'string') return null
  const text = hazardsText.toLowerCase()

  // STIPRUS — life-threatening evidence
  if (/\b(death|fatal|lethal|deadly|kills|fatality)\b/.test(text)) {
    return 'stiprus'
  }
  if (/\b(highly toxic|extremely toxic|very toxic|highly poisonous|extremely poisonous)\b/.test(text)
      && /\b(nerve|nervous|paraly)/.test(text)) {
    return 'stiprus'
  }
  if (/\b(cardiac|heart)\b/.test(text)
      && /\b(arrest|failure|stop|disturbance)/.test(text)) {
    return 'stiprus'
  }
  if (/\b(nerve centres?|central nervous)/.test(text)
      && /\b(paraly[sz]|paralys)/.test(text)) {
    return 'stiprus'
  }

  // VIDUTINIS — significant symptoms
  if (/\b(paraly[sz]|vomit|nause|burning|diarrho?e|severe|cardiac|nerve|seizur|convuls)\b/.test(text)) {
    return 'vidutinis'
  }
  // SILPNAS — mild reactions
  if (/\b(irritat|rash|skin contact|mild|topical)\b/.test(text)) {
    return 'silpnas'
  }
  // Generic toxic/poison without specific severity → vidutinis (safer default)
  if (/\b(toxic|poison|hazard|harmful)\b/.test(text)) {
    return 'vidutinis'
  }
  return null
}

// ── PFAF tipas heuristic (Step 6d) — MIRROR src/utils/deriveToxicity.js ─
// Priority: severity first, then text pattern (systemic > irritation > allergy).
function derivePfafTipas(hazardsText, severity) {
  if (severity === 'stiprus') return 'toksiskas'
  if (severity === 'silpnas') return 'dirginantis'
  if (!hazardsText || typeof hazardsText !== 'string') return 'toksiskas'
  const text = hazardsText.toLowerCase()
  // No trailing \b — kad "irritation"/"paralyzed"/"allergic" matched'intų
  if (/\b(paraly[sz]|vomit|naus|cardiac arrest|cardiac failure|seizur|convuls|death|fatal|lethal|deadly|kill)/.test(text)) {
    return 'toksiskas'
  }
  if (/\b(irritat|rash|topical|skin contact)/.test(text)) {
    return 'dirginantis'
  }
  if (/\b(allerg|hypersens|anaphyla)/.test(text)) {
    return 'alergiskas'
  }
  return 'toksiskas'
}

/**
 * MIRROR src/utils/deriveToxicity.js deriveToxicityFromSources().
 * Grąžina structured toxicity info iš ASPCA + PFAF.
 *
 * @param {string} latinName
 * @returns {Promise<{ hasToxicity, pavojai, pavojingumas, sources }>}
 */
export async function deriveToxicityFromSourcesServer(latinName) {
  const empty = {
    hasToxicity: false,
    pavojai: [],
    pavojingumas: { yra: false, lygis: null, detales: '' },
    sources: [],
  }
  if (!latinName) return empty

  const result = {
    hasToxicity: false,
    pavojai: [],
    pavojingumas: { yra: false, lygis: null, detales: '' },
    sources: [],
  }

  const genus = latinName.trim().split(/\s+/)[0]
  const genusKey = genus.toUpperCase()

  // ── 1. ASPCA via genus map ───────────────────────────────────
  const aspcaMap = await loadAspcaGenusMap()
  const aspcaEntry = aspcaMap[genusKey]
  const animalTerms = await loadAnimalTerms()

  if (aspcaEntry) {
    result.hasToxicity = true
    result.sources.push('aspca')

    const severity = aspcaEntry.confidence === 'high' ? 'vidutinis' : 'silpnas'
    const targets = aspcaEntry.toxicTo ?? []
    const targetsLt = translateAnimalTargets(targets, animalTerms)

    if (targets.length > 0) {
      result.pavojai.push({
        tipas: 'toksiskas',
        target: 'gyvunams',
        severity,
        detales: `${targetsLt} (ASPCA)`,
      })
    }

    result.pavojingumas = {
      yra: true,
      lygis: severity,
      detales: `ASPCA: toksiškas ${targetsLt}. Konsultuokitės su veterinaru. Šaltinis: ${aspcaEntry.matchedEntries?.[0]?.detailUrl ?? 'https://www.aspca.org/pet-care/animal-poison-control'}`,
    }
  }

  // ── 2. PFAF knownHazards (genus or species level) ─────────
  const pfaf = await loadPfaf()
  const pfafEntry = pfaf.results?.[latinName] ?? pfaf.results?.[genus]

  if (pfafEntry?.knownHazards) {
    const severity = derivePfafSeverity(pfafEntry.knownHazards)
    if (severity) {
      result.hasToxicity = true
      if (!result.sources.includes('pfaf')) result.sources.push('pfaf')

      // Step 6d — tipas iš severity + hazardsText (Monstera-style irritation
      // gauna 'dirginantis', Aconitum-style systemic lieka 'toksiskas')
      const tipas = derivePfafTipas(pfafEntry.knownHazards, severity)
      const alreadyHasHuman = result.pavojai.some(p => p.target === 'zmonems')
      if (!alreadyHasHuman) {
        result.pavojai.push({
          tipas,
          target: 'zmonems',
          severity,
          detales: tipas === 'dirginantis'
            ? 'PFAF: dirginantis (vietinis kontaktas, ne sisteminis)'
            : tipas === 'alergiskas'
            ? 'PFAF: alergiškas (jautrumo reakcija)'
            : 'PFAF botaninis šaltinis nurodo toksiškumą',
        })
      }

      const ltPlaceholder =
        severity === 'stiprus' ? 'Stipriai toksiškas. Kreipkitės į veterinarą ar Pet Poison Helpline nelaimei.'
      : severity === 'vidutinis' ? 'Toksiškas augalas — venkite nurijimo ir kontakto su sultimis. Kreipkitės į veterinarą jei įvyko apsinuodijimas.'
      : 'Augalas gali sukelti dirginimą — venkite kontakto su sultimis.'

      // 2026-05-25 — prefer LT pre-translated knownHazardsLt if available,
      // kitaip strip EN markers + truncate. Smart truncation cuts at sentence
      // boundary (no „...kruo..." mid-word cuts — user feedback).
      const hazardText = pfafEntry.knownHazardsLt
        ? pfafEntry.knownHazardsLt
        : stripPfafMarkers(pfafEntry.knownHazards)
      const hazardTruncated = smartTruncate(hazardText, 600)
      const lang = pfafEntry.knownHazardsLt ? '' : ', anglų k.'
      const pfafCitation = `\n\nŠaltinis (PFAF${lang}): "${hazardTruncated}"`

      if (!result.pavojingumas.yra) {
        result.pavojingumas = {
          yra: true,
          lygis: severity,
          detales: ltPlaceholder + pfafCitation,
        }
      } else {
        result.pavojingumas.detales += pfafCitation
      }
    }
  }

  return result
}

/** MIRROR src/utils/deriveToxicity.js isPavojaiEmpty(). */
export function isPavojaiEmptyServer(savybes) {
  if (!savybes || typeof savybes !== 'object') return true
  const pavojai = Array.isArray(savybes.pavojai) ? savybes.pavojai : []
  return pavojai.length === 0
}
