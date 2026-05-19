/**
 * latinName — botanical scientific name parser.
 *
 * Parse'ina lotynišką augalo pavadinimą į struktūruotus komponentus:
 *   { genus, species, infraspecific, cultivar, rank }
 *
 * Tai vienas šaltinis (single source of truth) visur, kur reikia
 * atskirti rūšies užklausą nuo kultivaro užklausos (search specificity
 * gate, parent taxonGroup lookup, fuzzy match'as, autocomplete).
 *
 * Tikslas — atsisakyti trapaus quote regex'o (`/['"]/`), kuris klaidingai
 * apdorodavo cultivar pavadinimus be kabučių (pvz. „Rosa Knock Out"
 * ar AI grąžintus „Dionaea muscipula Akai Ryu").
 *
 * Algoritmas (heuristika, ne ICN parser'is):
 *   1. Pirmas žodis didžiąja → GENTIS (capitalized)
 *   2. Antras žodis mažąja (a-z arba ×) → RŪŠIS (epithet — lowercased)
 *   3. Po rūšies: `var.`, `subsp.`, `ssp.`, `f.` → INFRASPECIFIC marker
 *   4. Quote'uotas ('X', "X") arba `cv. X` arba paskutinis žodis
 *      didžiąja po rūšies/marker'o → KULTIVARAS
 *
 * Pavyzdžiai:
 *   „Dionaea muscipula"                    → { genus, species, rank: 'species' }
 *   „Dionaea muscipula 'Akai Ryu'"         → { genus, species, cultivar, rank: 'cultivar' }
 *   „Dionaea muscipula Akai Ryu"           → { genus, species, cultivar, rank: 'cultivar' }
 *   „Rosa Knock Out"                       → { genus, cultivar: 'Knock Out', rank: 'cultivar' }
 *   „Rosa 'KORnacapi'"                     → { genus, cultivar: 'KORnacapi', rank: 'cultivar' }
 *   „Clematis × jackmanii"                 → { genus, species: '× jackmanii', rank: 'hybrid' }
 *   „Acer palmatum var. dissectum"         → { genus, species, infraspecific, rank: 'variety' }
 *   „Hosta sieboldiana var. elegans 'Alba'"→ { genus, species, infraspecific, cultivar, rank: 'cultivar' }
 *   „Dionaea"                              → { genus, rank: 'genus' }
 */

// Trademark / komercinių simbolių valymas (kosmetinė normalizacija).
const TRADEMARK_RE = /[®™©]/g

// Infraspecific marker'iai (po rūšies, prieš variety/subspecies vardą).
const INFRA_MARKERS = new Set(['var.', 'var', 'subsp.', 'subsp', 'ssp.', 'ssp', 'f.', 'forma'])

// Cultivar marker (alternatyva quote'ams): „Genus species cv. Cultivar".
const CV_MARKERS = new Set(['cv.', 'cv'])

/**
 * Pirmykštis sanitization — naikiname trademark simbolius, normalize'inam
 * spaces, paliekam unicode kabutes ('') konvertuojam į ASCII apostrof'ą.
 */
function sanitize(raw) {
  if (!raw || typeof raw !== 'string') return ''
  return raw
    .replace(TRADEMARK_RE, '')
    .replace(/[‘’ʼ]/g, "'")  // curly single quotes → ASCII
    .replace(/[“”]/g, '"')        // curly double quotes → ASCII
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Capitalized? — pirmoji raidė didžioji ir likę mažosios arba mišri.
 * Naudojama atskirti specifinį epithet (mažąja) nuo cultivar (didžiąja).
 * `×` (Unicode multiplication) traktuojama kaip lowercase signal'as.
 */
function isCapitalized(word) {
  if (!word) return false
  if (word === '×' || word.startsWith('×')) return false
  return /^[A-Z]/.test(word)
}

/**
 * Lowercase epithet (rūšies pavadinimas) — visi mažaraidiai, gali turėti
 * defisą arba `×` prefix'ą hibridui. Skaičiai netinka.
 */
function looksLikeEpithet(word) {
  if (!word) return false
  return /^(×\s?)?[a-z][a-z\-]*$/.test(word)
}

/**
 * Ištraukia quote'uotą cultivar dalį, jei yra. Grąžina { cultivar, rest }
 * kur rest yra likęs string'as be quote'ų segmento.
 */
function extractQuotedCultivar(s) {
  const m = s.match(/['"]([^'"]+)['"]/)
  if (!m) return { cultivar: null, rest: s }
  const cultivar = m[1].trim()
  const rest = (s.slice(0, m.index) + s.slice(m.index + m[0].length)).trim()
  return { cultivar, rest }
}

/**
 * Parsing'as. Grąžina structured object'ą. Visi laukai gali būti null.
 *
 * `rank` reikšmės:
 *   - 'cultivar'     — turi cultivar dalį
 *   - 'variety'      — turi var./forma marker'į (ne cultivar)
 *   - 'subspecies'   — turi subsp./ssp. marker'į
 *   - 'hybrid'       — `×` ženklas tarp gentis ir epithet
 *   - 'species'      — pilnas binomial be infraspecific/cultivar
 *   - 'genus'        — tik gentis
 *   - 'unknown'      — nepavyko atpažinti
 */
export function parseLatinName(raw) {
  const s = sanitize(raw)
  if (!s) return { genus: null, species: null, infraspecific: null, cultivar: null, rank: 'unknown', raw: '' }

  // Pirmiausia išimam quote'uotą cultivar'ą — jei yra, daug paprasčiau
  // dirbti su likusiu string'u.
  const { cultivar: quotedCultivar, rest: restAfterQuotes } = extractQuotedCultivar(s)
  const tokens = restAfterQuotes.split(' ').filter(Boolean)

  if (tokens.length === 0) {
    return { genus: null, species: null, infraspecific: null, cultivar: quotedCultivar, rank: quotedCultivar ? 'cultivar' : 'unknown', raw: s }
  }

  // Token 0 — turi būti capitalized GENTIS, kitaip neatpažinta.
  const genusTok = tokens[0]
  if (!isCapitalized(genusTok)) {
    return { genus: null, species: null, infraspecific: null, cultivar: quotedCultivar, rank: quotedCultivar ? 'cultivar' : 'unknown', raw: s }
  }
  const genus = genusTok
  let idx = 1

  // Token 1 — galimai species epithet (lowercase) arba hybrid „×" sign.
  let species = null
  let isHybrid = false
  if (idx < tokens.length) {
    let t1 = tokens[idx]
    // Hybrid notation: „Genus × species" arba „Genus ×species"
    if (t1 === '×') {
      isHybrid = true
      idx += 1
      if (idx < tokens.length && looksLikeEpithet(tokens[idx])) {
        species = '× ' + tokens[idx]
        idx += 1
      }
    } else if (t1.startsWith('×') && looksLikeEpithet(t1)) {
      isHybrid = true
      species = t1
      idx += 1
    } else if (looksLikeEpithet(t1)) {
      species = t1
      idx += 1
    }
  }

  // Infraspecific marker (var./subsp./ssp./f.) + jo vardas.
  let infraspecific = null
  let infraRank = null
  if (idx < tokens.length) {
    const marker = tokens[idx].toLowerCase()
    if (INFRA_MARKERS.has(marker)) {
      idx += 1
      if (idx < tokens.length) {
        infraspecific = tokens[idx]
        idx += 1
      }
      if (marker.startsWith('var')) infraRank = 'variety'
      else if (marker.startsWith('subsp') || marker.startsWith('ssp')) infraRank = 'subspecies'
      else if (marker === 'f.' || marker === 'forma') infraRank = 'forma'
    }
  }

  // Cultivar marker (cv.) + jo vardas.
  if (idx < tokens.length) {
    const marker = tokens[idx].toLowerCase()
    if (CV_MARKERS.has(marker)) {
      idx += 1
      const rest = tokens.slice(idx).join(' ').trim()
      if (rest && !quotedCultivar) {
        // cv. marker'is grąžina visa, kas po jo (gali būti su tarpais).
        return {
          genus, species, infraspecific,
          cultivar: rest,
          rank: 'cultivar',
          raw: s,
        }
      }
    }
  }

  // Likę token'ai (be quote'o, be cv. marker'io) — jei capitalized, tai
  // tikriausiai cultivar pavadinimas be quote'ų (pvz. „Rosa Knock Out",
  // „Clematis Boulevard"). Sujungiam visus į cultivar string'ą.
  let unquotedCultivar = null
  if (idx < tokens.length) {
    const remaining = tokens.slice(idx)
    const allCapitalized = remaining.every(t => isCapitalized(t) || /^\d/.test(t))
    if (allCapitalized && !quotedCultivar) {
      unquotedCultivar = remaining.join(' ')
    }
    // Jei mišriai capitalized/lowercase — neaišku, geriau nepriskirti.
  }

  const cultivar = quotedCultivar ?? unquotedCultivar

  // Rank'as — pasirenkam smulkiausią identifikuotą lygmenį.
  let rank = 'unknown'
  if (cultivar) rank = 'cultivar'
  else if (infraRank) rank = infraRank
  else if (isHybrid && species) rank = 'hybrid'
  else if (species) rank = 'species'
  else if (genus) rank = 'genus'

  return { genus, species, infraspecific, cultivar, rank, raw: s }
}

/**
 * Helper — sukomponuoti species portion (gentis + rūšis) iš parsed objekto.
 * Naudojama parent taxonGroup lookup'ui ir specificity gate'ui.
 *
 * Grąžina null jei genus/species nepakanka.
 */
export function speciesPortion(parsed) {
  if (!parsed?.genus || !parsed?.species) return null
  return `${parsed.genus} ${parsed.species}`.trim()
}

/**
 * Helper — bool'inis check'as ar du parsed pavadinimai priklauso tai
 * pačiai rūšiai (genus + species sutampa).
 *
 * Naudojama: query rūšies lygiu („Dionaea muscipula") prieš catalog
 * entry kultivaro lygiu („Dionaea muscipula 'Akai Ryu'") — abi rodo į
 * tą pačią rūšį, todėl species portion match'ina.
 */
export function sameSpecies(parsedA, parsedB) {
  if (!parsedA?.genus || !parsedB?.genus) return false
  if (parsedA.genus.toLowerCase() !== parsedB.genus.toLowerCase()) return false
  // Vienas iš jų gali būti tik gentis (be species) — tada ne ta pati rūšis.
  if (!parsedA.species || !parsedB.species) return false
  return parsedA.species.toLowerCase() === parsedB.species.toLowerCase()
}

/**
 * Helper — query yra platesnio (ar lygaus) lygmens nei entry.
 * Naudojama specificity gate'ui:
 *   - query rank='species', entry rank='cultivar' → true (query platesnis)
 *   - query rank='genus',   entry rank='cultivar' → true
 *   - query rank='cultivar',entry rank='cultivar' → false (lygūs / specifiniai)
 *   - query rank='cultivar',entry rank='species'  → false (query siauresnis)
 */
const RANK_ORDER = { genus: 1, species: 2, hybrid: 2, subspecies: 3, variety: 3, forma: 3, cultivar: 4, unknown: 0 }

export function queryIsBroader(queryParsed, entryParsed) {
  const q = RANK_ORDER[queryParsed?.rank] ?? 0
  const e = RANK_ORDER[entryParsed?.rank] ?? 0
  if (!q || !e) return false
  return q < e
}
