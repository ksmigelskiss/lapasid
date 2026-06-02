/**
 * Maps a Claude API search result → internal plant structure.
 * Single source of truth for the plant data model.
 */

export function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

export function today() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Robust array parser. Anthropic tool_use API neapsaugo strict validation'u,
 * todėl AI gali grąžinti `type: 'array'` lauką kaip JSON-formatuotą STRING'ą.
 * Be to, AI generuoja string'us su lietuviškomis curly quotes („"), kurios
 * nesusimaišo su ASCII JSON delimiter'iais — bet kartais maišo, ir tada
 * JSON.parse fail'ina.
 *
 * Strategija — three-tier:
 *   1. Jei jau array → grąžinam (happy path)
 *   2. Jei string su [...] shape → strict JSON.parse
 *   3. Jei JSON.parse fail'ina → lenient regex split (find `","` boundaries,
 *      strip outer brackets+quotes)
 *   4. Jei nieks nepavyko → []
 *
 * Lenient regex'as konkrečiai sprendžia case'ą:
 *   '[„fact1." + nelogičnos kabutės content'e, "fact2"]'
 *   → ['„fact1."', '"fact2"'] — ne idealu, bet recover'ina pakankamai.
 */
export function ensureArray(value) {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []
  const trimmed = value.trim()
  if (!trimmed) return []

  // Bandyk strict JSON.parse jei [...] shape
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return parsed.map(v => typeof v === 'string' ? v : v)
    } catch { /* fall through to lenient */ }

    // LENIENT — strip outer brackets, split by `","` (ASCII closing+comma+opening),
    // ir clean'inam liekanas. Naudojama kai AI sumaišė LT curly quotes su
    // ASCII JSON delimiter'iais ir strict parse fail'ino.
    const inner = trimmed.slice(1, -1).trim()
    if (inner) {
      // Split by `","` su tolerancija whitespace'ui ir LT quote types
      const splitPattern = /["»"]\s*,\s*[«""]/  // ASCII or LT quote pairs
      const parts = inner.split(splitPattern)
      if (parts.length >= 2) {
        // Strip leading/trailing quote chars iš pirmo ir paskutinio elemento
        return parts.map((p, i) => {
          let cleaned = p.trim()
          if (i === 0) cleaned = cleaned.replace(/^["«„""]/, '')
          if (i === parts.length - 1) cleaned = cleaned.replace(/["»"]$/, '')
          return cleaned.trim()
        }).filter(Boolean)
      }
      // Single string in brackets — strip outer quotes
      const single = inner.replace(/^["«„""]/, '').replace(/["»"]$/, '').trim()
      if (single) return [single]
    }
    return []
  }

  // Plain string (no brackets) — wrap'inam single-element (geriau vienas fact'as nei nieko)
  return [trimmed]
}

/**
 * normalizeAIResponse(rawDetails) — vieta vienoje vietoje sutvarko AI
 * tool_use atsakymą. Naudojama TIK PRIE BOUNDARY (fetchDetails post-AI,
 * refreshPlantFromAI merge).
 *
 * Normalize'ina TIK PRESENT array laukus — t.y., tuos, kurie iš tiesų
 * yra rawDetails objekte. Jei AI negrąžino kažkurio lauko (undefined),
 * NEPADIDINAME jo į []. Anksciau (regressija 5527a4e) buvo overwritinami
 * esami sinonimai į [] refresh path'e, nes AI Phase 2 negrąžina sinonimai
 * bet normalize defaults'indavo į []. Refresh patch laikė tai kaip
 * „filled" ir perrašydavo plant doc'o esamus duomenis.
 *
 * Rule: jei key'as YRA rawDetails objekte (`'idomybes' in rawDetails`),
 * normalizuojam (parse JSON-string ir t.t.). Jei NĖRA — paliekam undefined
 * kad downstream patch logika praleistų tą lauką.
 */
const ARRAY_FIELDS_FOR_NORMALIZE = [
  'idomybes', 'dauginimas', 'problemos', 'sources',
  'sinonimai', 'englishNames', 'photos', 'candidates',
]

/** Unwrap'ina AI „self-wrapped" lauką: {"field":"text"} / '{"field":"text"}' → "text". */
function unwrapSelfWrapped(value, fieldName) {
  let v = value
  if (typeof v === 'string') {
    const t = v.trim()
    if (t.startsWith('{') && t.includes(`"${fieldName}"`)) {
      try { v = JSON.parse(t) } catch { return value }  // ne JSON → originalas
    }
  }
  if (v && typeof v === 'object' && !Array.isArray(v) && typeof v[fieldName] === 'string') {
    return v[fieldName]
  }
  return value  // niekas nepasikeitė → originalas
}

export function normalizeAIResponse(rawDetails) {
  if (!rawDetails || typeof rawDetails !== 'object') return rawDetails

  const out = { ...rawDetails }

  // Normalize tik PRESENT array laukus — undefined liekai undefined
  for (const k of ARRAY_FIELDS_FOR_NORMALIZE) {
    if (k in rawDetails) {
      out[k] = ensureArray(rawDetails[k])
    }
  }

  // Defensive — AI kartais grąžina `savybes` kaip JSON-formatuotą string'ą
  // (schema confusion; Dracaena 2026-05-27 incident'as). Be šito downstream
  // spread'as `{ ...details.savybes }` (api/save-plant.js, taxonGroups merge'as)
  // sukurtų korumpuotą doc'ą su numeric-key chars (`{0:'{', 1:'"', ...}`).
  // Array atveju — tas pats spread'as sukurtų numeric-key map'ą iš element'ų.
  // Abu atvejus normalizuojam į saugų plain object'ą PRIES bet kokį mutate'ą.
  if ('savybes' in rawDetails) {
    if (typeof out.savybes === 'string') {
      try {
        out.savybes = JSON.parse(out.savybes)
      } catch {
        out.savybes = {}
      }
    }
    if (!out.savybes || typeof out.savybes !== 'object' || Array.isArray(out.savybes)) {
      out.savybes = {}
    }
  }

  // Nested pavojai struktūroje — tik jei savybes egzistuoja
  if (out.savybes && typeof out.savybes === 'object' && 'pavojai' in out.savybes) {
    out.savybes = {
      ...out.savybes,
      pavojai: ensureArray(out.savybes.pavojai),
    }
  }

  // Self-wrapped string laukai — AI kartais grąžina lauką apvyniotą į savo paties
  // raktą: substratas = {"substratas":"tekstas"} arba '{"substratas":"tekstas"}'.
  // Be unwrap'o UI rodo žalią JSON (Pilea substratas incident'as 2026-05-29).
  for (const k of ['aprasymas', 'kilme', 'substratas', 'persodinimas', 'ziemojimas']) {
    if (k in out) out[k] = unwrapSelfWrapped(out[k], k)
  }

  // Laistymo intervalo plausibility clamp — apsauga nuo absurdiškų AI reikšmių
  // (root rot jei <2 d., perdžiūvimas jei >40 d. vasarą). SĄMONINGAI NEverčiam
  // ziema≥vasara — žiemą-aktyvūs augalai (Schlumbergera) teisėtai laistomi
  // dažniau žiemą; tos krypties neclobortume.
  if (out.laistymasIntervalas && typeof out.laistymasIntervalas === 'object' && !Array.isArray(out.laistymasIntervalas)) {
    const li = { ...out.laistymasIntervalas }
    if (typeof li.vasara === 'number') li.vasara = Math.max(2, Math.min(40, Math.round(li.vasara)))
    if (typeof li.ziema  === 'number') li.ziema  = Math.max(2, Math.min(90, Math.round(li.ziema)))
    out.laistymasIntervalas = li
  }

  return out
}

/**
 * stripUndefinedDeep(value) — rekursinis undefined šalintojas.
 *
 * NAUDOJIMAS: PRIE BOUNDARY su Firestore. Firebase setDoc REJECT'ina
 * undefined su `Function setDoc() called with invalid data. Unsupported
 * field value: undefined` (kelias kelyje, pvz. `tresimas.tipas`).
 *
 * Šis helper'is rekursyviai walk'ina objektą + array'us:
 *   • Object key'as su `undefined` → key'as pašalinamas
 *   • Array element'as `undefined` → element'as pašalinamas
 *   • null → paliekamas (Firestore validates null fine)
 *   • Primitives → passthrough
 *
 * NE'naikinama `normalizeAIResponse` undefined logika — ji sąmoningai
 * palaiko undefined kaip „skip this field" signal'ą. stripUndefinedDeep
 * tik PRIES setDoc paskutiniam pasiruošimui.
 *
 * @example
 *   stripUndefinedDeep({ a: 1, b: undefined, c: { d: undefined, e: 2 } })
 *   // → { a: 1, c: { e: 2 } }
 *
 *   stripUndefinedDeep([1, undefined, 2])
 *   // → [1, 2]
 */
export function stripUndefinedDeep(value) {
  if (value === undefined) return undefined
  if (value === null) return null
  if (Array.isArray(value)) {
    return value
      .map(stripUndefinedDeep)
      .filter(v => v !== undefined)
  }
  if (typeof value === 'object') {
    // Firebase Timestamp, Date, Geopoint etc. — leave intact
    if (value.constructor && value.constructor !== Object) return value

    const out = {}
    for (const [k, v] of Object.entries(value)) {
      const cleaned = stripUndefinedDeep(v)
      if (cleaned !== undefined) out[k] = cleaned
    }
    return out
  }
  return value  // primitive (string, number, boolean)
}

// Normalizuoja AI grąžintą savybes objektą į saugią formą. Bet kuris laukas
// gali būti undefined — saugiai užpildom default'ais. UI naudoja granuliarius
// `pavojai[]` pirmiausia; jei tuščia, krenta į saugiklį `pavojingumas.yra`.
export function normalizeSavybes(s, legacyToksiskas, legacyInfo) {
  const empty = {
    pavojai: [],
    pavojingumas: { yra: false, lygis: null, detales: '' },
    valgomumas:   { statusas: 'none', dalys: '', detales: '' },
    vaistinis:    { statusas: 'none', naudojama: '', detales: '' },
  }
  if (!s || typeof s !== 'object') {
    // Backward compat — senas plant'as su toksiskas boolean'u, savybes nėra.
    // Krename legacy info'ą į saugiklį, kad UI parodytų bent „Atsargiai".
    if (legacyToksiskas) {
      return {
        ...empty,
        pavojingumas: { yra: true, lygis: null, detales: legacyInfo || '' },
      }
    }
    return empty
  }
  const cleanPavojai = ensureArray(s.pavojai).filter(p =>
    p && ['toksiskas','alergiskas','dirginantis'].includes(p.tipas)
      && ['zmonems','gyvunams'].includes(p.target)
      && ['silpnas','vidutinis','stiprus'].includes(p.severity)
  )
  const pavojingumas = {
    yra:    !!s.pavojingumas?.yra,
    lygis:  ['silpnas','vidutinis','stiprus'].includes(s.pavojingumas?.lygis) ? s.pavojingumas.lygis : null,
    detales: s.pavojingumas?.detales ?? '',
  }

  // INFERENCE — kai AI užpildė pavojingumas saugiklį (yra=true + detales),
  // bet PALIKO pavojai[] tuščią, deterministiškai išvedame granuliarų
  // entry iš detales narrative'o. Tai sprendžia recurring AI compliance
  // bug'ą (Hosta saponinai, Monstera oxalates, Calathea atvejai) kai AI
  // pasirenka saugesnį pavojingumas safeguard'ą vietoj eksplicitiškų
  // pavojai array įrašų — nors detales narrative aiškiai apibūdina tipas,
  // target ir severity.
  //
  // Patterns'ai (case-insensitive Lithuanian):
  //   tipas    — „nuoding/toks[iįę]š" → toksiskas
  //              „alerg/odos reakc"   → alergiskas
  //              „dirgin"             → dirginantis
  //   target   — „šun/kat/gyvūn"      → gyvunams
  //              „žmon/vaik"          → zmonems
  //   severity — iš pavojingumas.lygis (jei AI užpildė) arba „vidutinis" default
  //
  // Jei narrative neaiškus (nei tipas, nei target nepasirenkamas) — paliekam
  // pavojai tuščią. Saugesnis fallback.
  const inferredPavojai = cleanPavojai.length === 0 && pavojingumas.yra
    ? inferPavojaiFromDetales(pavojingumas.detales, pavojingumas.lygis)
    : cleanPavojai

  return {
    pavojai: inferredPavojai,
    pavojingumas,
    valgomumas: {
      statusas: ['none','dalinai','pilnai'].includes(s.valgomumas?.statusas) ? s.valgomumas.statusas : 'none',
      dalys:    s.valgomumas?.dalys ?? '',
      detales:  s.valgomumas?.detales ?? '',
    },
    vaistinis: {
      statusas:  ['none','tradicine','moksline'].includes(s.vaistinis?.statusas) ? s.vaistinis.statusas : 'none',
      naudojama: s.vaistinis?.naudojama ?? '',
      detales:   s.vaistinis?.detales ?? '',
    },
  }
}

/**
 * inferPavojaiFromDetales(detales, lygis) — heuristinis išvedimas pavojai
 * array'aus iš narrative teksto. Naudojama, kai AI praleido eksplicitišką
 * pavojai pildymą bet užpildė pavojingumas safeguard'ą.
 *
 * Grąžina array su 1-2 entries (po vieną per target: gyvunams + zmonems).
 * Tuščia jei nei tipas, nei target neaiškus.
 */
function inferPavojaiFromDetales(detales, lygis) {
  if (!detales || typeof detales !== 'string') return []
  const text = detales.toLowerCase()

  // Tipas — pirmenybė toksiskas > dirginantis > alergiskas (saugumo dėlei)
  let tipas = null
  if (/nuoding|toks[iįę]š|toks[iįę]nu|nuod[ėe]/i.test(text)) tipas = 'toksiskas'
  else if (/dirgin|sudirgin/i.test(text))                   tipas = 'dirginantis'
  else if (/alerg/i.test(text))                             tipas = 'alergiskas'
  if (!tipas) return []

  // Target — gali būti abu (žmonėms IR gyvūnams)
  const targetsAnimals = /gyv[ūu]nams|šun[iīymsui]?|kat[eė][ms]?|šuni|kat[eė]/i.test(text)
  const targetsHumans  = /žmon[eė][msi]?|vaik[amsīIi]?/i.test(text)

  const severity = ['silpnas','vidutinis','stiprus'].includes(lygis) ? lygis : 'vidutinis'

  const result = []
  if (targetsAnimals) result.push({ tipas, target: 'gyvunams', severity })
  if (targetsHumans)  result.push({ tipas, target: 'zmonems',  severity })
  // Jei nei vienas target ne'pasirinktas — default both (saugu)
  if (result.length === 0) {
    result.push({ tipas, target: 'gyvunams', severity })
    result.push({ tipas, target: 'zmonems',  severity })
  }
  return result
}

export function fromAIResult(aiResult) {
  // Verification status — visi AI rezultatai pradžioje yra `unverified`.
  // Vėliau admin / botanikas gali pažymėti `expert-verified` (per admin panel).
  // aiConfidence + aiMatchLevel + aiUncertaintyReason — užfiksuojam, kodėl
  // ši būsena susidarė, kad galėtume rodyti UI badge'ą ir filtruoti admin'e.
  //
  // fallbackInfo — kai AI grąžino aukštesnį lygį nei vartotojas paklausė
  // (cultivar→species). Saugom, kad UI galėtų rodyti banner'į „čia ne tai,
  // ko prašei, bet…" ir vartotojas suprastų kodėl.
  // cultivarsExist — eksplicitinis flag'as ar yra kultivarų / sub-taksonų.
  // Pildoma admin'o veliau, kai admin'as su atstovaujamais kultivarais
  // dirba. Šaltinis — AI's `cultivarsExist` field'as.
  const aiConfidence = aiResult.confidence ?? null
  const verificationStatus = aiConfidence === 'high' && !aiResult.fallbackInfo
    ? 'auto-verified'
    : 'unverified'

  return {
    // Honor aiResult.id jei pre-set (e.g. Variant B dual-write — klientas
    // generuoja plantId iš anksto, perduoda į addToDashboard ir POST
    // /api/save-plant ta pati ID, kad serverio merge:true enrichment'as
    // patektų į TĄ PATĮ doc'ą, ne kurtų antrą). Default'ai į naują makeId()
    // kai id nepateiktas — visi senesni call site'ai.
    id: aiResult.id ?? makeId(),
    // Variant B Step 6g — propagate enrichmentStartedAt jei pre-set caller'io.
    // Client'as SaveButton flag-on path'e sets'ina ISO timestamp save click
    // metu. Server'is NIEKADA šio field'o nelies (rašo savą phase2CompletedAt
    // + enrichmentError per merge:true). Atskiri laukai = joko race.
    //
    // KODĖL ATSKIRAS NUO data_prideta:
    // data_prideta yra YYYY-MM-DD (tik data, ne tikslus laikas) — naudojama
    // UI date label'ams. Mums reikia tiksli ISO timestamp'a kad galėtumėm
    // skaičiuoti 90s timing window'ą enrichment state'ui.
    ...(aiResult.enrichmentStartedAt ? { enrichmentStartedAt: aiResult.enrichmentStartedAt } : {}),
    // Step 6t — propagate server'io enrichment completion + error markers.
    // ROOT CAUSE rastas testuojant Kalateja re-enrich (logs rodė
    // completedAt: undefined nors phase2 data buvo):
    //   • Server'io processPlant fullPlant include'a phase2CompletedAt + null
    //   • saveUserPlantServer calls fromAIResult(fullPlant)
    //   • fromAIResult buvo nepropaguodavo šių lauks → setDoc merge:true
    //     RAŠĖ visą care info BET NE completion marker'į
    //   • Klient'as matydavo startedAt set + completedAt missing → 'failed'
    //     per 90s timeout — false negative
    //
    // enrichmentError naudoja `!== undefined` (ne truthy) kad galėtų patekti
    // explicit null (server'io success path: enrichmentError: null clear'ina
    // ankstesnį error'ą).
    ...(aiResult.phase2CompletedAt ? { phase2CompletedAt: aiResult.phase2CompletedAt } : {}),
    ...(aiResult.enrichmentError !== undefined ? { enrichmentError: aiResult.enrichmentError } : {}),
    ...(aiResult.aprasymasSource ? { aprasymasSource: aiResult.aprasymasSource } : {}),
    // 2026-05-24 — propagate auginimas kategorija (#37) + infoConfidence
    // Pamoka: schema required + AI generuoja BET fromAIResult turi
    // explicit propagation. Auto-spread NĖRA — žinome iš Step 6t bug'o.
    ...(aiResult.auginimas ? { auginimas: aiResult.auginimas } : { auginimas: 'kambarinis' }),
    ...(aiResult.infoConfidence ? { infoConfidence: aiResult.infoConfidence } : {}),
    verificationStatus,
    aiConfidence,
    aiMatchLevel: aiResult.matchLevel ?? null,
    aiUncertaintyReason: aiResult.uncertaintyReason ?? null,
    aiFallbackInfo: aiResult.fallbackInfo ?? null,
    aiCultivarsExist: aiResult.cultivarsExist ?? null,
    aiVerifiedAt: new Date().toISOString(),
    lotyniskas:  aiResult.latinName ?? '',
    // 2026-05-25 fix: Phase 2 AI gali generuoti species-qualified LT name
    // (aiResult.lietuviskas) per TOOL_DETAILS schema rule. Tas override'ina
    // Phase 1 baseResult.name (genus-only iš lt-names.json). Jei AI nesugeneravo
    // (Phase 1 baseResult arba slim AI mode), fallback'inam į aiResult.name.
    // Pavyzdys: aiResult.lietuviskas = "Dracena trijuostė"
    //          aiResult.name = "Dracena" (Phase 1 genus-only)
    //          → lietuviškas = "Dracena trijuostė" (species-qualified wins)
    lietuviškas: aiResult.lietuviskas ?? aiResult.name ?? '',
    emoji:       aiResult.emoji ?? '🌿',
    tipas:       aiResult.tipas ?? '',
    augimo_greitis: aiResult.augimo_greitis ?? '',
    sunkumas:    aiResult.sunkumas ?? 2,
    // Backward compat — senas toksiskas boolean'as paliktas; UI fallback'ina į
    // jį, kol per „Atnaujinti per AI" mygtuką nepradedam pildyti savybes.
    toksiskas:      aiResult.toksiskas ?? aiResult.savybes?.pavojingumas?.yra ?? false,
    toksiskumo_info: aiResult.toksiskumo_info ?? aiResult.savybes?.pavojingumas?.detales ?? '',
    savybes: normalizeSavybes(aiResult.savybes, aiResult.toksiskas, aiResult.toksiskumo_info),
    aprasymas:   aiResult.aprasymas ?? aiResult.aiDescription ?? '',
    kilme:       aiResult.kilme ?? aiResult.origin ?? '',
    sviesa: aiResult.sviesa ?? {
      lygis:  aiResult.lightLevel ?? 'vidutinė',
      taskai: aiResult.lightScore ?? 2,
      ...(aiResult.ppfd?.min != null ? { ppfd: { min: aiResult.ppfd.min, max: aiResult.ppfd.max } } : {}),
    },
    vanduo: aiResult.vanduo ?? { lygis: 'vidutiniškai', taskai: 2 },
    // Firebase NEPRIIMA undefined — visada null, kai AI'us nepateikė (slim
    // preview'as gali šių field'ų net negrąžinti). Anksčiau buvo `: undefined`
    // ir tai sukėlė setDoc crash'ą 2026-05 po slim mode refaktoro.
    laistymasIntervalas: aiResult.laistymasIntervalas ?? (aiResult.watering?.intervalVasara != null ? {
      vasara:  aiResult.watering.intervalVasara,
      ziema:   aiResult.watering.intervalZiema ?? null,
      metodas: aiResult.watering.metodas ?? '',
    } : null),
    tresimas: aiResult.tresimas ?? (aiResult.fertilizing?.intervalVasara != null ? {
      intervalVasara: aiResult.fertilizing.intervalVasara,
      intervalZiema:  aiResult.fertilizing.intervalZiema ?? null,
      tipas:          aiResult.fertilizing.tipas ?? '',
    } : null),
    dormancyInfo: aiResult.dormancyInfo ?? (aiResult.dormancy?.reikia != null ? {
      reikia: aiResult.dormancy.reikia,
      tipas:  aiResult.dormancy.tipas ?? null,
    } : null),
    prieziura: aiResult.prieziura ?? {
      sviesa:      aiResult.care?.light ?? '',
      laistymas:   aiResult.care?.water ?? '',
      temperatura: aiResult.care?.temperature ?? '',
      dregme:      aiResult.care?.humidity ?? '',
    },
    substratas:   aiResult.substratas ?? aiResult.care?.soil ?? '',
    persodinimas: aiResult.persodinimas ?? '',
    ziemojimas:   aiResult.ziemojimas ?? '',
    dauginimas:   ensureArray(aiResult.dauginimas),
    problemos:    ensureArray(aiResult.problemos),
    idomybes:     ensureArray(aiResult.idomybes),
    kategorija:   'auginama',
    komentaras:   '',
    data_prideta: today(),
    // 2026-06-02 — ŠVARUS MODELIS: plant.image = TIK user pasirinkta/įkelta foto.
    // Stock (iNat/Wiki) NEBEdedam į image (anksčiau → watercolor flicker, nes
    // heroIsDefaultFor painiojo stock vs user). image=null → heroIsDefaultFor
    // grąžina watercolor (default). Stock lieka galerijoje (photos[]) — user
    // gali jį pasirinkti per „Pakeisti nuotrauką".
    image:        null,
    imageThumb:   null,
    // Discovery photos array iš search'o (Brave + iNat + Wikidata + Wikipedia
    // + Commons) + stock image priekyje. PlantDetail hero gallery + PhotoSheet
    // galerija. Limit 10 — saugumo dėlei nuo bloated plant doc'o.
    photos:       [aiResult.image, ...ensureArray(aiResult.photos)]
                    .filter(Boolean)
                    .filter((u, i, a) => a.indexOf(u) === i)
                    .slice(0, 10),
    status:       'healthy',
    inatLtName:   aiResult.inatLtName   ?? null,
    inatTaxonId:  aiResult.inatTaxonId  ?? null,
    // LT colloq/vernacular names (e.g. "Uošvės liežuvis" for Sansevieria)
    sinonimai:    ensureArray(aiResult.sinonimai),
    englishNames: ensureArray(aiResult.englishNames),
    // NEW (Stage B schema extension):
    // Latin taxonomic synonyms — atskirti nuo LT colloq pavadinimų.
    // Pavyzdys: Sansevieria trifasciata → lotyniskiSinonimai = ['Dracaena trifasciata']
    // Stage B Phase 2 RAG context'as ekstraktuoja iš PFAF latinSynonyms.
    lotyniskiSinonimai: ensureArray(aiResult.lotyniskiSinonimai),
    // Source provenance per field — naudojama UI source badges + AI prompt context.
    // Schema: { fieldName: 'src1+src2', ... }
    // Pavyzdys: { lietuviškas: 'wiki+plants+inat', toxicity: 'aspca+pfaf' }
    // Old plants neturės šito field'o — defaults to {} on read.
    sources:      typeof aiResult.sources === 'object' && aiResult.sources !== null
                    ? aiResult.sources
                    : {},
    // Schema version — leidžia future migrations tracking. v1 = pre-Stage B,
    // v2 = post-Stage B (turi sources + lotyniskiSinonimai).
    schemaVersion: aiResult.schemaVersion ?? 2,
  }
}
