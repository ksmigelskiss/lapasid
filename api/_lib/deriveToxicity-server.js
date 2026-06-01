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

// ── IRRITANT-ONLY GENERA (2026-06-01) ─────────────────────────
// Genera kur „toxic" ženklas reiškia LOKALŲ dirginimą (kalcio oksalato
// rafidės arba saponinai), ne sisteminį nuodingumą. Botanically:
//   • Araceae (Monstera, Philodendron, Dieffenbachia, etc.) →
//     insoluble Ca-oxalate raphides → burnos/gerklės degimą, seilėtekis
//     (skausminga, bet ne mirtina, neabsorbuojama į kraują)
//   • Asparagaceae (Sansevieria, Dracaena, Yucca) → saponinai →
//     mild GI upset (poorly absorbed by mammals)
//   • Araliaceae (Schefflera) → tos pačios oxalate raphides
//
// ASPCA ir PFAF įrašo šias gentis kaip „toxic" be diferenciacijos tarp
// local irritation vs systemic poisoning. Mes override'inam tipas →
// 'dirginantis' kad UI rodytų tikslesnį pavojaus pobūdį — botaniškai
// teisingas badge (≠ Aconitum/Nerium/Taxus kurie tikrai sisteminiai).
//
// MIRROR src/utils/deriveToxicity.js IRRITANT_ONLY_GENERA.
const IRRITANT_ONLY_GENERA = new Set([
  // Araceae — calcium oxalate raphides (local mouth/throat irritation)
  'AGLAONEMA', 'ALOCASIA', 'ANTHURIUM', 'ARISAEMA', 'ARUM',
  'CALADIUM', 'CALLA', 'COLOCASIA', 'DIEFFENBACHIA', 'EPIPREMNUM',
  'MONSTERA', 'PHILODENDRON', 'PISTIA', 'POTHOS', 'SCINDAPSUS',
  'SPATHIPHYLLUM', 'SYNGONIUM', 'XANTHOSOMA', 'ZANTEDESCHIA',
  // Asparagaceae — saponinai (mild GI upset)
  'SANSEVIERIA', 'DRACAENA', 'YUCCA',
  // Araliaceae — oxalate raphides
  'SCHEFFLERA',
])

function isIrritantOnlyGenus(genus) {
  if (!genus) return false
  return IRRITANT_ONLY_GENERA.has(genus.toUpperCase())
}

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

  // STIPRUS — life-threatening evidence (NE de-escalate)
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

  // SEVERITY ≠ TIPAS (2026-05-29, MIRROR client): sunkumas ir tipas — atskiros
  // ašys. Dirginimas gali būti VIDUTINIS (Euphorbia), ne automatiškai silpnas.
  let baseSeverity = null
  if (/\b(paraly[sz]|vomit|nause|burning|diarrho?e|severe|cardiac|nerve|seizur|convuls)\b/.test(text)) {
    baseSeverity = 'vidutinis'
  }
  // SILPNAS — TIK eksplicitiškai švelnu.
  else if (/\b(mild|minor|slight|trivial)\b/.test(text)) {
    baseSeverity = 'silpnas'
  }
  // Dirginimas/kontaktas/latex be „mild" → vidutinis (dirginantis). De-escalation
  // (žemiau) nuleidžia į silpnas oksalato dietiniam caution'ui.
  else if (/\b(irritat|rash|skin contact|topical|latex|sap|blister)\b/.test(text)) {
    baseSeverity = 'vidutinis'
  }
  else if (/\b(toxic|poison|hazard|harmful)\b/.test(text)) {
    baseSeverity = 'vidutinis'
  } else {
    return null
  }

  // ── DE-ESCALATION (2026-05-25, per user feedback) ─────────────
  // Kai EN/LT text aiškiai sako, kad junginys NESISTEMINIS žmogui
  // („poorly absorbed", „pass through without harm" tipo nuance),
  // drop'iname severity nuo vidutinis į silpnas. Sansevieria atvejis:
  // „saponins ... poorly absorbed by the human body" = mild risk
  // realiai, NE vidutinis-toksiška.
  //
  // STIPRUS lygis NIEKADA ne de-escalate'inamas (life-threatening
  // claims preserved net jei kažkur sako „rarely fatal").
  if (baseSeverity === 'vidutinis') {
    const deEscalationCues = [
      // EN cues
      /poorly absorbed/i,
      /pass through without harm/i,
      /not in fatal amounts/i,
      /rarely (cause|fatal|toxic)/i,
      /small (amounts|quantities).*safe/i,
      /usually harmless/i,
      // Oksalato dietinis „atsargumo" boilerplate (PFAF prideda daugeliui augalų —
      // mild „jautriems žmonėms" pastaba, NE ūmus toksiškumas). Tikrai pavojingi
      // oksalatai → stiprus, čia nepatenka. Dieffenbachia „burning/swelling" → step
      // 2 vidutinis, šių frazių neturi → lieka vidutinis (saugu).
      /especial caution/i,
      /aggravate (their|the) condition/i,
      // LT equivalents (jei naudojama knownHazardsLt)
      /prastai (pasisavin|įsisavin|absorbuojam)/i,
      /pereina be žalos/i,
      /mažais kiekiais (saugu|nepavojinga)/i,
      /retai sukelia/i,
      /turėtų būti atsarg/i,
    ]
    for (const cue of deEscalationCues) {
      if (cue.test(text)) {
        return 'silpnas'  // de-escalated
      }
    }
  }
  return baseSeverity
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

    // SAUGUMAS (under-report fix, MIRROR client): ASPCA buvimas = realus pet
    // pavojus. Crosswalk `confidence` ≠ toksiškumo sunkumas — nebe-downgrade'inam
    // į `silpnas`. Floor'inam į `vidutinis` (saugus default pet-toksiškam).
    const severity = 'vidutinis'
    const targets = aspcaEntry.toxicTo ?? []
    const targetsLt = translateAnimalTargets(targets, animalTerms)

    // 2026-06-01 — Araceae/Asparagaceae oxalate/saponin override: ASPCA
    // įrašo lokalų dirginimą kaip „toxic" be diferenciacijos. Mes mark'inam
    // tipas='dirginantis' šioms genčiams (botanically tikslesnis pavojaus
    // pobūdis). Severity lieka 'vidutinis' — real irritation, ne minor.
    const isIrritant = isIrritantOnlyGenus(genus)
    const tipasAspca = isIrritant ? 'dirginantis' : 'toksiskas'

    if (targets.length > 0) {
      result.pavojai.push({
        tipas: tipasAspca,
        target: 'gyvunams',
        severity,
        detales: isIrritant
          ? `Dirgina burną/virškinimą: ${targetsLt} (ASPCA)`
          : `${targetsLt} (ASPCA)`,
      })
    }

    result.pavojingumas = {
      yra: true,
      lygis: severity,
      // 2026-05-25 layout cleanup — drop "ASPCA:" prefix (badges jau rodo
      // source) + drop "Konsultuokitės su veterinaru" boilerplate (Phase 2
      // voice narrative pateikia tiksliau, severity-aware).
      detales: isIrritant
        ? `Dirgina ${targetsLt} — kalcio oksalato kristalai arba saponinai sukelia lokalų burnos/virškinimo dirginimą, ne sisteminį nuodingumą. ${aspcaEntry.matchedEntries?.[0]?.detailUrl ?? 'https://www.aspca.org/pet-care/animal-poison-control'}`
        : `Toksiška ${targetsLt}. ${aspcaEntry.matchedEntries?.[0]?.detailUrl ?? 'https://www.aspca.org/pet-care/animal-poison-control'}`,
    }
  }

  // ── 2. PFAF knownHazards (genus or species level) ─────────
  const pfaf = await loadPfaf()
  const pfafEntry = pfaf.results?.[latinName] ?? pfaf.results?.[genus]

  if (pfafEntry?.knownHazards) {
    // 2026-05-25 — paduodam ABU (EN base + LT supplemental) kad
    // de-escalation cues veiktų tiek angliškame, tiek lietuviškame text'e.
    const combinedText = [pfafEntry.knownHazards, pfafEntry.knownHazardsLt]
      .filter(Boolean).join(' ')
    const severity = derivePfafSeverity(combinedText)
    if (severity) {
      result.hasToxicity = true
      if (!result.sources.includes('pfaf')) result.sources.push('pfaf')

      // Step 6d — tipas iš severity + hazardsText (Monstera-style irritation
      // gauna 'dirginantis', Aconitum-style systemic lieka 'toksiskas')
      let tipas = derivePfafTipas(pfafEntry.knownHazards, severity)
      // 2026-06-01 — Araceae/Asparagaceae override: jei genus žinomai
      // lokalus dirgiklis (oksalato rafidės/saponinai) ir PFAF nemini
      // mirties/stipraus toksiškumo (severity !== 'stiprus'), force
      // 'dirginantis'. Apsaugo nuo PFAF text generic „toxic" wording'o
      // kuris klaidina derivePfafTipas → 'toksiskas' default'an.
      if (tipas === 'toksiskas' && severity !== 'stiprus' && isIrritantOnlyGenus(genus)) {
        tipas = 'dirginantis'
      }
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
      : (severity === 'vidutinis' && tipas === 'dirginantis')
          ? 'Sultyse yra kalcio oksalato kristalų arba saponinų — nurijus dirgina burną ir gerklę, kontaktas gali dirginti odą. Lokalus poveikis, ne sisteminis nuodingumas.'
      : severity === 'vidutinis' ? 'Toksiškas augalas — venkite nurijimo ir kontakto su sultimis. Kreipkitės į veterinarą jei įvyko apsinuodijimas.'
      : 'Augalas gali sukelti dirginimą — venkite kontakto su sultimis.'

      // 2026-05-25 layout cleanup — drop "Šaltinis (PFAF, anglų k.):"
      // verbose prefix. Just quote + PFAF URL on new line (renderWithLinks
      // converts URL into "PFAF ↗" hyperlink).
      const hazardText = pfafEntry.knownHazardsLt
        ? pfafEntry.knownHazardsLt
        : stripPfafMarkers(pfafEntry.knownHazards)
      const hazardTruncated = smartTruncate(hazardText, 600)
      const pfafUrl = `https://pfaf.org/user/Plant.aspx?LatinName=${encodeURIComponent(latinName)}`
      const pfafCitation = `\n\n"${hazardTruncated}" ${pfafUrl}`

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
