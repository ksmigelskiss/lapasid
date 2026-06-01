/**
 * deriveToxicity — deterministic toxicity derivation iš mūsų scraped sources.
 *
 * VAIDMUO: AI'us NEPATIKIMAS dėl toxicity field'o pildymo (po user testavimo
 * 2026-05-21 — Aconitum napellus, vienas iš nuodingiausių Europos augalų,
 * gavo pavojaiCount=0 nors PFAF knownHazards 300+ chars). Sprendimas —
 * NEPRIKLAUSOMA logika, kuri grąžina structured toxicity info'ą tiesiogiai
 * iš ASPCA + PFAF + pre-DB.
 *
 * NAUDOJIMAS (dvi vietos):
 *   1. Phase 0.3 preview (buildPreDbBaseResult) — toxicity badge'as iškart
 *      preview kortelėje, BE AI call'o
 *   2. Phase 2 backfill (fetchDetails post-AI) — jei AI grąžino tuščią
 *      pavojai[], BET mūsų sources turi toxicity → automatic backfill
 *
 * SOURCE PRIORITY:
 *   1. ASPCA (manual map + scraped) — verified veterinary authority
 *   2. PFAF knownHazards — narrative text, parsed for severity keywords
 *
 * SEVERITY DERIVATION iš PFAF text'o:
 *   • death/fatal/lethal/deadly → stiprus
 *   • paralys/vomit/nausea/burning/diarrhoea/severe → vidutinis
 *   • irritat/rash/skin contact/mild → silpnas
 *   • general "toxic"/"poisonous" be specific'o → vidutinis (saugesnis default)
 */

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
// MIRROR api/_lib/deriveToxicity-server.js IRRITANT_ONLY_GENERA.
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

let aspcaCache = null
let pfafCache = null
let aspcaGenusMapCache = null
let animalTermsCache = null

async function loadAnimalTerms() {
  if (animalTermsCache) return animalTermsCache
  try {
    const url = new URL('../../data/aspca-animals-lt.json', import.meta.url)
    const res = await fetch(url)
    if (!res.ok) return {}
    const data = await res.json()
    animalTermsCache = data.terms ?? {}
    return animalTermsCache
  } catch { return {} }
}

// Strip PFAF reference markers like [311], [301], etc.
function stripPfafMarkers(text) {
  if (!text) return text
  return text.replace(/\s*\[\s*\d+\s*\]/g, '').replace(/\s+/g, ' ').trim()
}

// Smart truncation — cuts at last sentence boundary BEFORE maxLen.
// Prevents mid-word cuts (user feedback 2026-05-25). MIRROR server.
function smartTruncate(text, maxLen = 600) {
  if (!text || text.length <= maxLen) return text
  const slice = text.slice(0, maxLen)
  const lastDot = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('.'))
  if (lastDot > maxLen * 0.6) {
    return slice.slice(0, lastDot + 1)
  }
  const lastSpace = slice.lastIndexOf(' ')
  return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice) + '...'
}

function translateAnimalTargets(targets, terms) {
  if (!targets || targets.length === 0) return ''
  return targets.map(t => terms[t.toLowerCase()] ?? t).join(', ')
}

async function loadAspca() {
  if (aspcaCache) return aspcaCache
  try {
    const url = new URL('../../data/aspca-toxicity.json', import.meta.url)
    const res = await fetch(url)
    if (!res.ok) return { toxicity: {} }
    aspcaCache = await res.json()
    return aspcaCache
  } catch {
    return { toxicity: {} }
  }
}

async function loadPfaf() {
  if (pfafCache) return pfafCache
  try {
    const url = new URL('../../data/pfaf.json', import.meta.url)
    const res = await fetch(url)
    if (!res.ok) return { results: {} }
    pfafCache = await res.json()
    return pfafCache
  } catch {
    return { results: {} }
  }
}

async function loadAspcaGenusMap() {
  if (aspcaGenusMapCache) return aspcaGenusMapCache
  try {
    const url = new URL('../../data/aspca-genus-map.json', import.meta.url)
    const res = await fetch(url)
    if (!res.ok) return {}
    const data = await res.json()
    aspcaGenusMapCache = data.toxicityByGenus ?? {}
    return aspcaGenusMapCache
  } catch {
    return {}
  }
}

// ── Severity heuristic iš PFAF knownHazards textą ─────────────

function derivePfafSeverity(hazardsText) {
  if (!hazardsText || typeof hazardsText !== 'string') return null
  const text = hazardsText.toLowerCase()

  // STIPRUS — life-threatening evidence
  // (2026-05-21 expanded: PFAF rarely uses "death/fatal" tiesiogiai.
  // Klasikiniai mirtinai pavojingi augalai (Aconitum, Digitalis, Conium, Cicuta)
  // identifikuojami per simptomus + intensity modifier'ius. Narrow patterns —
  // ne false positive Monstera/Pilea/Aglaonema tipams.)

  // 1a. Explicit death/fatal/lethal
  if (/\b(death|fatal|lethal|deadly|kills|fatality)\b/.test(text)) {
    return 'stiprus'
  }
  // 1b. "Highly/extremely toxic" + nervous system attack — Aconitum pattern
  if (/\b(highly toxic|extremely toxic|very toxic|highly poisonous|extremely poisonous)\b/.test(text)
      && /\b(nerve|nervous|paraly)/.test(text)) {
    return 'stiprus'
  }
  // 1c. Cardiac arrest / heart failure pattern — Digitalis, Nerium
  if (/\b(cardiac|heart)\b/.test(text)
      && /\b(arrest|failure|stop|disturbance)/.test(text)) {
    return 'stiprus'
  }
  // 1d. Hemlock-style nervous system paralysis
  if (/\b(nerve centres?|central nervous)/.test(text)
      && /\b(paraly[sz]|paralys)/.test(text)) {
    return 'stiprus'
  }

  // SEVERITY ≠ TIPAS (2026-05-29): sunkumas (silpnas/vidutinis/stiprus) ir tipas
  // (dirginantis/toksiskas) — atskiros ašys. Dirginimas gali būti VIDUTINIS
  // (Euphorbia pieno sultys realiai dirgina), ne automatiškai silpnas.
  let baseSeverity = null
  if (/\b(paraly[sz]|vomit|nause|burning|diarrho?e|severe|cardiac|nerve|seizur|convuls)\b/.test(text)) {
    baseSeverity = 'vidutinis'
  }
  // SILPNAS — TIK eksplicitiškai švelnu (mild/minor/slight/trivial).
  else if (/\b(mild|minor|slight|trivial)\b/.test(text)) {
    baseSeverity = 'silpnas'
  }
  // Dirginimas/kontaktas/latex BE „mild" modifikatoriaus → vidutinis (dirginantis).
  // De-escalation (žemiau) nuleidžia į silpnas oksalato dietiniam caution'ui.
  else if (/\b(irritat|rash|skin contact|topical|latex|sap|blister)\b/.test(text)) {
    baseSeverity = 'vidutinis'
  }
  else if (/\b(toxic|poison|hazard|harmful)\b/.test(text)) {
    baseSeverity = 'vidutinis'
  } else {
    return null
  }

  // ── DE-ESCALATION (2026-05-25 per user feedback) — MIRROR server ──
  if (baseSeverity === 'vidutinis') {
    const deEscalationCues = [
      /poorly absorbed/i, /pass through without harm/i, /not in fatal amounts/i,
      /rarely (cause|fatal|toxic)/i, /small (amounts|quantities).*safe/i,
      /usually harmless/i,
      // Oksalato dietinis „atsargumo" boilerplate (PFAF prideda daugeliui augalų —
      // mild „jautriems žmonėms" pastaba, NE ūmus toksiškumas). Tikrai pavojingi
      // oksalatai („fatal/poisonous") → stiprus, čia nepatenka (tik vidutinis).
      // Dieffenbachia-style „burning/swelling" → step 2 vidutinis, šių frazių
      // neturi → lieka vidutinis (saugu).
      /especial caution/i, /aggravate (their|the) condition/i,
      /prastai (pasisavin|įsisavin|absorbuojam)/i, /pereina be žalos/i,
      /mažais kiekiais (saugu|nepavojinga)/i, /retai sukelia/i,
      /turėtų būti atsarg/i,
    ]
    for (const cue of deEscalationCues) {
      if (cue.test(text)) return 'silpnas'
    }
  }
  return baseSeverity
}

// ── PFAF tipas heuristic (post user-test #14, refined) ───────
//
// Anksčiau visi PFAF entries gaudavo tipas='toksiskas' (hardcoded). User'is
// pastebėjo, kad Monstera rodė „TOKSIŠKA žmonėms" badge'ą — orange-alarm
// styling'as houseplant'e, kurio realybė yra MOUTH IRRITATION nuo kalcio
// oksalato (ne sisteminis nuodingumas). Schema enum'as turi 3 reikšmes:
// toksiskas | alergiskas | dirginantis — naudokim tinkamą pagal hazardsText.
//
// PRIORITY (post v2 fix — Monstera „skin irritation OR allergic reaction"
// text trigger'ino allergic check pirma vietoje, klaidingai grąžino
// alergiskas. Reorder'inta: severity sprendimas pirma, tada text pattern):
//
// 1. severity='stiprus' (death/paralys/highly toxic) → toksiskas
//    (life-threatening visada = systemic poisoning)
// 2. severity='silpnas' (mild/irritat/rash/topical) → dirginantis
//    (local irritation only)
// 3. severity='vidutinis' — mixed bag, naudoti text pattern priority:
//    systemic > irritation > allergy > default toksiskas
function derivePfafTipas(hazardsText, severity) {
  if (severity === 'stiprus') return 'toksiskas'
  if (severity === 'silpnas') return 'dirginantis'
  if (!hazardsText || typeof hazardsText !== 'string') return 'toksiskas'
  const text = hazardsText.toLowerCase()
  // No trailing \b — kad "irritation", "paralyzed", "allergic" matched'intų
  // su prefix match'u (\b prieš + prefix + bet kokia uodega).
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

// ── Main: derive toxicity from all sources ───────────────────

/**
 * Grąžina structured toxicity info'ą augalui iš visų mūsų sources.
 *
 * @param {string} latinName  e.g. "Aconitum napellus"
 * @returns {Promise<{
 *   hasToxicity: boolean,
 *   pavojai: Array<{tipas, target, severity, detales}>,
 *   pavojingumas: { yra, lygis, detales },
 *   sources: string[],   // kurie šaltiniai prisidėjo
 * }>}
 */
export async function deriveToxicityFromSources(latinName) {
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

  // ── 1. ASPCA via genus map (manual + scraped crosswalk) ──
  const aspcaMap = await loadAspcaGenusMap()
  const aspcaEntry = aspcaMap[genusKey]
  const animalTerms = await loadAnimalTerms()

  if (aspcaEntry) {
    result.hasToxicity = true
    result.sources.push('aspca')

    // SAUGUMAS (under-report fix): ASPCA buvimas = realus pet pavojus. Crosswalk
    // `confidence` (manual vs scraped) ≠ toksiškumo sunkumas — anksčiau low-conf
    // genus-match'as gaudavo `silpnas`, nors augalas realiai pavojingas. Floor'inam
    // į `vidutinis` (ASPCA negraduoja sunkumo; tai saugus default pet-toksiškam).
    const severity = 'vidutinis'
    const targets = aspcaEntry.toxicTo ?? []
    // 2026-05-25 — translate cats/dogs/horses → katėms/šunims/žirgams
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
      detales: isIrritant
        ? `Dirgina ${targetsLt} — kalcio oksalato kristalai arba saponinai sukelia lokalų burnos/virškinimo dirginimą, ne sisteminį nuodingumą. ${aspcaEntry.matchedEntries?.[0]?.detailUrl ?? 'https://www.aspca.org/pet-care/animal-poison-control'}`
        : `Toksiška ${targetsLt}. ${aspcaEntry.matchedEntries?.[0]?.detailUrl ?? 'https://www.aspca.org/pet-care/animal-poison-control'}`,
    }
  }

  // ── 2. PFAF knownHazards (genus or species level) ─────────
  const pfaf = await loadPfaf()
  // Bandom species first, tada genus fallback
  const pfafEntry = pfaf.results?.[latinName] ?? pfaf.results?.[genus]

  if (pfafEntry?.knownHazards) {
    // 2026-05-25 — paduodam ABU (EN base + LT supplemental) kad
    // de-escalation cues veiktų ir lietuviškame text'e. MIRROR server.
    const combinedText = [pfafEntry.knownHazards, pfafEntry.knownHazardsLt]
      .filter(Boolean).join(' ')
    const severity = derivePfafSeverity(combinedText)
    if (severity) {
      result.hasToxicity = true
      if (!result.sources.includes('pfaf')) result.sources.push('pfaf')

      // Tipas iš severity + hazardsText (6d refinement) — Monstera-style
      // irritation gauna 'dirginantis', Aconitum-style systemic lieka
      // 'toksiskas'.
      let tipas = derivePfafTipas(pfafEntry.knownHazards, severity)
      // 2026-06-01 — Araceae/Asparagaceae override: jei genus žinomai
      // lokalus dirgiklis (oksalato rafidės/saponinai) ir PFAF nemini
      // mirties/stipraus toksiškumo (severity !== 'stiprus'), force
      // 'dirginantis'. Apsaugo nuo PFAF text generic „toxic" wording'o
      // kuris klaidina derivePfafTipas → 'toksiskas' default'an.
      if (tipas === 'toksiskas' && severity !== 'stiprus' && isIrritantOnlyGenus(genus)) {
        tipas = 'dirginantis'
      }

      // Pridėti pavojai entry per žmones (PFAF kontekstas dažniausiai apie žmones,
      // ne pet'us — ASPCA tvarko gyvūnus, PFAF tvarko bendrą toxicity).
      // Dedupe pagal target tik — bet kuris tipas (toksiskas/alergiskas/dirginantis)
      // tam pačiam target'ui yra duplikatas.
      const alreadyHasHuman = result.pavojai.some(
        p => p.target === 'zmonems'
      )
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

      // pavojingumas.detales — LT placeholder + PFAF citation kaip raw evidence.
      // Anksčiau čia atsidurdavo PFAF knownHazards EN text TIESIOG (užterštos
      // pavojų sekcijos angliškai!). Dabar paliekam aiškų LT message kaip
      // safety net + EN evidence appended kaip „source citation". Tai būna
      // matoma TIK kai AI praleidžia field'o pildymą.
      //
      // TODO: ateityje pre-translate PFAF knownHazards į LT build-time.
      const ltPlaceholder =
        severity === 'stiprus' ? 'Stipriai toksiškas. Kreipkitės į veterinarą ar Pet Poison Helpline nelaimei.'
      : (severity === 'vidutinis' && tipas === 'dirginantis')
          ? 'Sultyse yra kalcio oksalato kristalų arba saponinų — nurijus dirgina burną ir gerklę, kontaktas gali dirginti odą. Lokalus poveikis, ne sisteminis nuodingumas.'
      : severity === 'vidutinis' ? 'Toksiškas augalas — venkite nurijimo ir kontakto su sultimis. Kreipkitės į veterinarą jei įvyko apsinuodijimas.'
      : 'Augalas gali sukelti dirginimą — venkite kontakto su sultimis.'

      // 2026-05-25 layout cleanup — quote + PFAF URL (renderWithLinks
      // konvertuoja į „PFAF ↗"). NEBE verbose „Šaltinis (PFAF, anglų k.):"
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
        // ASPCA jau pildė — pridėti PFAF citation prie esamų detales
        result.pavojingumas.detales += pfafCitation
      }
    }
  }

  return result
}

// ── Helper: ar pavojai[] tikrai užpildyta (validation guard) ──

/**
 * Check ar AI grąžintas savybes objektas turi reikšmingą pavojai info'ą.
 * Naudojama fetchDetails BACKFILL trigger'iui — jei FALSE BET mes turim
 * derivedToxicity.hasToxicity=true, reikia backfill'inti.
 */
export function isPavojaiEmpty(savybes) {
  if (!savybes || typeof savybes !== 'object') return true
  const pavojai = Array.isArray(savybes.pavojai) ? savybes.pavojai : []
  return pavojai.length === 0
}
