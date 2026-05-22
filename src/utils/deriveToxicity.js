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

let aspcaCache = null
let pfafCache = null
let aspcaGenusMapCache = null

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

  // VIDUTINIS — significant symptoms (Monstera, Aglaonema, kalcio oksalatai)
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

  if (aspcaEntry) {
    result.hasToxicity = true
    result.sources.push('aspca')

    const severity = aspcaEntry.confidence === 'high' ? 'vidutinis' : 'silpnas'
    const targets = aspcaEntry.toxicTo ?? []

    // VIENAS pavojai entry per UNIQUE tipas+target+severity kombinaciją.
    // ASPCA targets (cats/dogs/horses) visi yra 'gyvunams' Lithuanian'ai,
    // todėl nepridedam 3 dublikuotų badge'ų UI'e. Detales sujungia visus
    // pet category'us kaip žmogiškai skaitomas list'as.
    // (2026-05-22 dedupe fix po user test #12 — anksčiau Monstera rodė
    // "TOKSIŠKA TOKSIŠKA TOKSIŠKA" — 3 vienodi badge'ai.)
    if (targets.length > 0) {
      result.pavojai.push({
        tipas: 'toksiskas',
        target: 'gyvunams',
        severity,
        detales: `${targets.join(', ')} (ASPCA)`,
      })
    }

    result.pavojingumas = {
      yra: true,
      lygis: severity,
      detales: `ASPCA: toksiškas ${targets.join(', ')}. Konsultuokitės su veterinaru. Šaltinis: ${aspcaEntry.matchedEntries?.[0]?.detailUrl ?? 'https://www.aspca.org/pet-care/animal-poison-control'}`,
    }
  }

  // ── 2. PFAF knownHazards (genus or species level) ─────────
  const pfaf = await loadPfaf()
  // Bandom species first, tada genus fallback
  const pfafEntry = pfaf.results?.[latinName] ?? pfaf.results?.[genus]

  if (pfafEntry?.knownHazards) {
    const severity = derivePfafSeverity(pfafEntry.knownHazards)
    if (severity) {
      result.hasToxicity = true
      if (!result.sources.includes('pfaf')) result.sources.push('pfaf')

      // Pridėti pavojai entry per žmones (PFAF kontekstas dažniausiai apie žmones,
      // ne pet'us — ASPCA tvarko gyvūnus, PFAF tvarko bendrą toxicity).
      // Dedupe — jei jau yra entry su tipas=toksiskas+target=zmonems, neperpildom.
      const alreadyHasHuman = result.pavojai.some(
        p => p.tipas === 'toksiskas' && p.target === 'zmonems'
      )
      if (!alreadyHasHuman) {
        result.pavojai.push({
          tipas: 'toksiskas',
          target: 'zmonems',
          severity,
          detales: 'PFAF botaninis šaltinis nurodo toksiškumą',
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
      : severity === 'vidutinis' ? 'Toksiškas augalas — venkite nurijimo ir kontakto su sultimis. Kreipkitės į veterinarą jei įvyko apsinuodijimas.'
      : 'Augalas gali sukelti dirginimą — venkite kontakto su sultimis.'

      const pfafCitation = `\n\nŠaltinis (PFAF, anglų k.): "${pfafEntry.knownHazards.slice(0, 300)}${pfafEntry.knownHazards.length > 300 ? '...' : ''}"`

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
