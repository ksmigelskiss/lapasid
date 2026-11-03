/**
 * toxinClasses — namų rizikos resolveris (household-aware toksiškumas).
 *
 * VAIDMUO: sujungia struktūruotą toksinų-klasių sluoksnį (data/toxin-classes.json +
 * data/genus-toxin-map.json) su namų profiliu ({ vaikai, gyvunai }) ir grąžina
 * kortelėms paruoštą struktūrą + išdėstymo rekomendaciją. Tai `resolveToxinProfile`
 * kontrakto (docs/toksiskumo-integracija.md) implementacija + namų rizikos sluoksnis.
 *
 * SAUGUMO PRINCIPAI (iš tasks/konsiliumas-2026-06/45-*, 46-sinteze):
 *   • JOKIO balo — grąžinam rizikų SĄRAŠĄ, ne skaičių „92/100".
 *   • JOKIO triage — faktai + kontaktai, niekada ne „skambink / palauk" sprendimas.
 *   • „NĖRA DUOMENŲ ≠ SAUGU" — trūkstamą gentį/klasę žymim `nezinoma`, NE `saugu`.
 *   • Sunkumo gradacija privaloma — lokalus dirgiklis (oksalatai) ≠ sisteminis nuodas.
 *     Dieffenbachia nerodom kaip oleandro.
 *   • Sunkumas IŠVEDAMAS iš klasė × rūšis, ne priskiriamas laisvai.
 *
 * Rizikos logika PERSKIRIAMA nuo DOM/Firebase — gryna funkcija, testuojama Vitest'u
 * (src/utils/toxinClasses.test.js).
 */

import TOXIN_CLASSES from '../../data/toxin-classes.json'
import GENUS_MAP from '../../data/genus-toxin-map.json'

// ── Enumai (sutampa su data/_meta.enumai) ──────────────────────
export const SPECIES = ['zmogus', 'kate', 'suo', 'paukstis', 'grauzikas']
export const GYVUNAI = ['kate', 'suo', 'paukstis', 'grauzikas']

// Sunkumo tvarka — null tvarkomas atskirai (null = „nepakanka duomenų", NE „saugu").
const SUNKUMAS_RANK = { nera: 0, silpnas: 1, vidutinis: 2, sunkus: 3, mirtinas: 4 }

// Žmogiškos etiketės + tonai (UI komponentai verčia tonus į Tailwind klases).
export const SUNKUMAS_META = {
  mirtinas:  { label: 'Mirtinas',     tonas: 'kritinis' },
  sunkus:    { label: 'Sunkus',       tonas: 'kritinis' },
  vidutinis: { label: 'Vidutinis',    tonas: 'vidutinis' },
  silpnas:   { label: 'Lengvas',      tonas: 'zemas' },
  nera:      { label: 'Netoksiškas',  tonas: 'saugu' },
}

export const AUDITORIJA_META = {
  zmogus:    { label: 'Žmonėms',   trumpas: 'Žmonės' },
  vaikai:    { label: 'Vaikams',   trumpas: 'Vaikai' },
  kate:      { label: 'Katėms',    trumpas: 'Katė' },
  suo:       { label: 'Šunims',    trumpas: 'Šuo' },
  paukstis:  { label: 'Paukščiams', trumpas: 'Paukštis' },
  grauzikas: { label: 'Graužikams', trumpas: 'Graužikas' },
}

// ── Genties ekstrakcija ────────────────────────────────────────
export function genusOf(latinName) {
  if (!latinName || typeof latinName !== 'string') return null
  // Praleidžiam hibrido daugybos ženklą (× Fatshedera lizei → Fatshedera).
  const tokens = latinName.trim().split(/\s+/).filter(t => t && t !== '×' && t !== '✕' && t !== 'x' && t !== 'X')
  const first = tokens[0]
  if (!first) return null
  // Pašalinam ne raidinius simbolius (hibrido ženklas priekyje, „sp." ir pan.)
  const clean = first.replace(/[^\p{L}-]/gu, '')
  return clean ? clean.toUpperCase() : null
}

// ── Namų profilio normalizacija ────────────────────────────────
// Kanoninis modelis (GDPR-saugus — jokios tikslios vaiko amžiaus/vardo info,
// tik coarse band'as kaip rizikos modifikatorius; žr. 45-liability-redteam §3.6):
//   { vaikai: bool, vaikuAmzius: 'mazi'|'vidutiniai'|'paaugliai'|null, gyvunai: string[], kitiGyvunai: bool }
export const VAIKU_AMZIUS = ['mazi', 'vidutiniai', 'paaugliai']
export const VAIKU_AMZIUS_META = {
  mazi:       { label: '0–3 m. (ropoja, deda į burną)', trumpas: 'maži (0–3 m.)' },
  vidutiniai: { label: '4–6 m.',                        trumpas: '4–6 m.' },
  paaugliai:  { label: '7 m. ir vyresni',               trumpas: '7+ m.' },
}

export function normalizeHousehold(raw) {
  const h = raw && typeof raw === 'object' ? raw : {}
  const gyvunai = Array.isArray(h.gyvunai) ? h.gyvunai.filter(g => GYVUNAI.includes(g)) : []
  return {
    vaikai: h.vaikai === true,
    vaikuAmzius: VAIKU_AMZIUS.includes(h.vaikuAmzius) ? h.vaikuAmzius : null,
    gyvunai,
    kitiGyvunai: h.kitiGyvunai === true,
  }
}

export function isHouseholdEmpty(household) {
  const h = normalizeHousehold(household)
  return !h.vaikai && h.gyvunai.length === 0 && !h.kitiGyvunai
}

// Auditorijos, kurioms SKAIČIUOJAM sunkumą (turim duomenis).
// Vaikai → žmogaus jautrumas (spec v1: „vaikai ~ žmogaus dirgiklis, mažesnė dozė").
function audiencesForHousehold(household) {
  const h = normalizeHousehold(household)
  const auds = []
  if (h.vaikai) auds.push({ key: 'vaikai', species: 'zmogus' })
  for (const g of h.gyvunai) auds.push({ key: g, species: g })
  return auds
}

// ── Sunkumo helper'iai ─────────────────────────────────────────
function maxSunkumas(a, b) {
  if (a == null) return b
  if (b == null) return a
  return SUNKUMAS_RANK[a] >= SUNKUMAS_RANK[b] ? a : b
}

// ── Audience aprašymo parinkimas (spec) ────────────────────────
function pickAprasymai(aprasymai, household) {
  if (!aprasymai || typeof aprasymai !== 'object') return []
  const h = normalizeHousehold(household)
  const out = []
  if (h.vaikai && aprasymai.vaikai) out.push({ auditorija: 'vaikai', tekstas: aprasymai.vaikai })
  if (h.gyvunai.length && aprasymai.gyvunai) out.push({ auditorija: 'gyvunai', tekstas: aprasymai.gyvunai })
  // Default suaugęs žmogus — jei household tuščias ARBA niekas kitas netiko.
  if (out.length === 0 && aprasymai.suauge_zmones) {
    out.push({ auditorija: 'suauge_zmones', tekstas: aprasymai.suauge_zmones })
  }
  return out
}

// ── Pagrindinis: resolveToxinProfile(plant, household, data?) ──
/**
 * @param {object} plant — turi `lotyniskas` (ar `latinName`).
 * @param {object} household — { vaikai, vaikuAmzius, gyvunai[], kitiGyvunai }.
 * @param {object} [data] — { classes, genusMap } injekcijai (testams); default — bundled.
 * @returns {{
 *   status:'toksiska'|'saugu'|'nezinoma',
 *   genus:string|null, tier:1|2|3|null, saugus:boolean|null,
 *   klases: Array<object>,                 // kortelei paruoštos klasės su sunkumas_man
 *   perAuditorija: Array<object>,          // „TAVO katei / vaikams" eilutės
 *   sunkumasMax: string|null,              // blogiausias sunkumas per household auditorijas
 *   kritineVeliava: boolean,               // bent viena klasė mirtina relevant auditorijai
 *   specialios: string[],                  // iš specialios_veliavos (jei duomenys turės)
 *   dataGaps: string[],                    // sąžiningi duomenų trūkumai
 *   pastaba: string|null,
 * }}
 */
export function resolveToxinProfile(plant, household = {}, data) {
  const classes = (data && data.classes) || stripMeta(TOXIN_CLASSES)
  const genusMap = (data && data.genusMap) || stripMeta(GENUS_MAP)
  const h = normalizeHousehold(household)

  const latin = plant?.lotyniskas || plant?.latinName || ''
  const genus = genusOf(latin)

  const base = {
    status: 'nezinoma',
    genus,
    tier: null,
    saugus: null,
    klases: [],
    perAuditorija: [],
    sunkumasMax: null,
    kritineVeliava: false,
    specialios: [],
    dataGaps: [],
    pastaba: null,
  }

  if (!genus) {
    base.dataGaps.push('Nenurodytas lotyniškas pavadinimas — negalime nustatyti genties.')
    return base
  }

  const entry = genusMap[genus]
  if (!entry) {
    // Genties nėra žemėlapyje → SĄŽININGAI „nezinoma" (NE „saugu").
    base.dataGaps.push(`Genties „${capitalize(genus)}" nėra toksiškumo žemėlapyje — duomenų nėra.`)
    return base
  }

  base.tier = entry.tier ?? null
  base.saugus = entry.saugus === true
  base.specialios = Array.isArray(entry.specialios_veliavos) ? entry.specialios_veliavos.slice() : []
  if (entry.pastaba) base.pastaba = entry.pastaba

  const klasesRefs = Array.isArray(entry.klases) ? entry.klases : []

  // „Saugus" gentis (ASPCA/botanika netoksiška) BE klasių → status 'saugu'.
  if (base.saugus && klasesRefs.length === 0) {
    base.status = 'saugu'
    return base
  }
  // Toksiška, bet klasė nenustatyta (saugus:false, tuščias klases[]) → review.
  if (!base.saugus && klasesRefs.length === 0) {
    base.status = 'toksiska'
    base.dataGaps.push(`„${capitalize(genus)}" žymimas toksišku, bet cheminė junginių klasė dar nenustatyta — sunkumas nežinomas.`)
    return base
  }

  const auds = audiencesForHousehold(h)

  // Surenkam klases su household-specifiniu sunkumu.
  for (const ref of klasesRefs) {
    const c = classes[ref.id]
    if (!c) {
      base.dataGaps.push(`Klasė „${ref.id}" nerasta referencijoje.`)
      continue
    }
    let sunkumasMan = null
    let turejoNull = false
    if (auds.length === 0) {
      // Household tuščias → rodom klasės bendrą „lubą" (sunkumo_lubos).
      sunkumasMan = c.sunkumo_lubos ?? null
    } else {
      for (const a of auds) {
        const v = c.rusies_jautrumas ? c.rusies_jautrumas[a.species] : undefined
        if (v === null || v === undefined) { turejoNull = true; continue }
        sunkumasMan = maxSunkumas(sunkumasMan, v)
      }
    }

    base.klases.push({
      id: ref.id,
      vardas_lt: c.vardas_lt,
      vardas_en: c.vardas_en,
      mechanizmo_tipas: c.mechanizmo_tipas,
      organas: c.organas ?? null,
      sunkumo_lubos: c.sunkumo_lubos,
      antidotas: c.antidotas ?? null,
      dalis: ref.dalis ?? 'visos',
      simptomai_lt: c.simptomai_lt,
      medikui_lt: c.medikui_lt,
      patikimumas: c.patikimumas,
      saltiniai: Array.isArray(c.saltiniai) ? c.saltiniai : [],
      rusies_jautrumas: c.rusies_jautrumas ?? {},
      sunkumas_man: sunkumasMan,
      sunkumas_trukstaDuomenu: turejoNull && sunkumasMan == null,
      aprasymai: pickAprasymai(c.aprasymai, h),
    })

    if (sunkumasMan != null) base.sunkumasMax = maxSunkumas(base.sunkumasMax, sunkumasMan)
  }

  base.status = 'toksiska'

  // Kritinė vėliava — bent viena klasė mirtina RELEVANT auditorijai.
  base.kritineVeliava = base.sunkumasMax === 'mirtinas'

  // Per-auditorija breakdown („TAVO katei: MIRTINA / TAVO šuniui: lengvas").
  base.perAuditorija = buildPerAuditorija(base.klases, h, auds)

  // Specialios vėliavos → žmogiškas tekstas (jei duomenys jų turės ateity).
  if (base.specialios.length) {
    base.dataGaps.push(...[]) // placeholder — tekstus tvarko UI
  }

  // Jei household turi „kitų gyvūnų" — sąžiningai pažymim, kad jiems duomenų nėra.
  if (h.kitiGyvunai) {
    base.dataGaps.push('Kitiems gyvūnams (ne katė/šuo/paukštis/graužikas) toksiškumo duomenų neturime.')
  }

  return base
}

// Per-auditorija eilutės (katei/šuniui/vaikams atskirai) — vet doc'o „auksas".
function buildPerAuditorija(klases, household, auds) {
  if (auds.length === 0) return []
  const rows = []
  for (const a of auds) {
    let sunkumas = null
    let turejoNull = false
    for (const k of klases) {
      const v = k.rusies_jautrumas ? k.rusies_jautrumas[a.species] : undefined
      if (v === null || v === undefined) { turejoNull = true; continue }
      sunkumas = maxSunkumas(sunkumas, v)
    }
    rows.push({
      auditorija: a.key,
      species: a.species,
      label: AUDITORIJA_META[a.key]?.label ?? a.key,
      sunkumas,                                  // null = nepakanka duomenų
      trukstaDuomenu: turejoNull && sunkumas == null,
    })
  }
  return rows
}

// ── Namų rizikos / išdėstymo rekomendacija ─────────────────────
// Grąžina SĄRAŠO-draugišką objektą, NE balą. Tekstai — informaciniai
// („daug žmonių laiko nepasiekiamoje vietoje"), NE garantijos
// („pastatyk čia ir būsi saugus") — žr. 45-liability-redteam §1 (#3).
export const REKOMENDACIJA = {
  ne_namuose:          'ne_namuose',
  aukstai:             'aukstai',
  ant_zemes:           'ant_zemes',
  atsargiai_nezinoma:  'atsargiai_nezinoma',
  saugu:               'saugu',
}

const AUDITORIJOS_FRAZE = (household) => {
  const h = normalizeHousehold(household)
  const dalys = []
  if (h.vaikai) dalys.push('vaikams')
  const gyv = h.gyvunai.map(g => AUDITORIJA_META[g]?.label?.toLowerCase()).filter(Boolean)
  dalys.push(...gyv)
  if (dalys.length === 0) return 'namų nariams'
  if (dalys.length === 1) return dalys[0]
  return dalys.slice(0, -1).join(', ') + ' ir ' + dalys[dalys.length - 1]
}

/**
 * assessHouseholdRisk(plant, household) — pilnas namų rizikos vertinimas vienam augalui.
 * @returns {{ profile, rekomendacija, tonas, antraste, tekstas, perAuditorija, kritineVeliava, maziVaikaiPastaba }}
 */
export function assessHouseholdRisk(plant, household = {}, data) {
  const h = normalizeHousehold(household)
  const profile = resolveToxinProfile(plant, h, data)
  const fraze = AUDITORIJOS_FRAZE(h)

  let rekomendacija = REKOMENDACIJA.atsargiai_nezinoma
  let tonas = 'nezinoma'
  let antraste = 'Trūksta duomenų'
  let tekstas = ''

  if (profile.status === 'nezinoma') {
    rekomendacija = REKOMENDACIJA.atsargiai_nezinoma
    tonas = 'nezinoma'
    antraste = 'Trūksta duomenų'
    tekstas = `Šio augalo toksiškumo duomenų neturime. „Nėra duomenų" ≠ „saugu" — kol nepatikrinta, laikyk ${fraze} nepasiekiamoje vietoje ir elkis atsargiai.`
  } else if (profile.status === 'saugu') {
    rekomendacija = REKOMENDACIJA.saugu
    tonas = 'saugu'
    antraste = 'Pavojų nematyti'
    tekstas = `Pagal turimus duomenis (ASPCA / botanika) šis augalas ${fraze} nelaikomas toksišku. Vis tiek stebėk — duomenys gali būti nepilni.`
  } else {
    // toksiska — remkimės household-specifiniu blogiausiu sunkumu.
    const s = profile.sunkumasMax
    if (s == null) {
      // Toksiška, bet sunkumo relevant auditorijai neišvedėm (null duomenys / klasė TBD).
      rekomendacija = REKOMENDACIJA.atsargiai_nezinoma
      tonas = 'nezinoma'
      antraste = 'Toksiška — sunkumas nežinomas'
      tekstas = `Augalas žymimas toksišku, bet sunkumo ${fraze} patikimai nustatyti negalime. Laikyk nepasiekiamoje vietoje ir elkis atsargiai.`
    } else if (s === 'mirtinas' || s === 'sunkus') {
      rekomendacija = REKOMENDACIJA.ne_namuose
      tonas = 'kritinis'
      antraste = s === 'mirtinas' ? 'Geriau ne namuose' : 'Didelė rizika'
      tekstas = `Gali būti ${s === 'mirtinas' ? 'mirtinai pavojingas' : 'sunkiai pavojingas'} ${fraze}. Daugelis tokiais atvejais renkasi šio augalo nelaikyti ten, kur gyvena ${fraze}. Jei laikai — tik visiškai nepasiekiamoje vietoje.`
    } else if (s === 'vidutinis') {
      rekomendacija = REKOMENDACIJA.aukstai
      tonas = 'vidutinis'
      antraste = 'Laikyti aukštai'
      tekstas = `Toksiškas ${fraze} prarijus ar sąlytyje. Daug žmonių tokius augalus laiko aukštai ar pakabintus — nepasiekiamoje vietoje. Atmink ir nuokritas (krentantys lapai, uogos pasiekiami net jei augalas aukštai).`
    } else {
      // silpnas
      rekomendacija = REKOMENDACIJA.ant_zemes
      tonas = 'zemas'
      antraste = 'Maža rizika'
      tekstas = `Pagal turimus duomenis — mažos rizikos ${fraze} (dažniausiai lokalus burnos/odos dirginimas, praeina savaime). Įprastų atsargumo priemonių paprastai pakanka.`
    }
  }

  // Mažų vaikų (0–3 m.) ekspozicijos modifikatorius — kelia pasiekiamumo svarbą,
  // NE patį sunkumą (jokio melagingo tikslumo). 71% ekspozicijų ≤5 m. (45-pediatras).
  let maziVaikaiPastaba = null
  if (h.vaikai && h.vaikuAmzius === 'mazi' &&
      (rekomendacija === REKOMENDACIJA.ant_zemes || rekomendacija === REKOMENDACIJA.aukstai)) {
    maziVaikaiPastaba = 'Namuose maži vaikai (0–3 m.) — jie viską deda į burną, todėl pasiekiamumas svarbesnis nei vidutiniškai. Verčiau laikyk aukščiau.'
  }

  return {
    profile,
    rekomendacija,
    tonas,
    antraste,
    tekstas,
    perAuditorija: profile.perAuditorija,
    kritineVeliava: profile.kritineVeliava,
    maziVaikaiPastaba,
  }
}

// ── Util'ai ────────────────────────────────────────────────────
function stripMeta(obj) {
  if (!obj || typeof obj !== 'object') return {}
  const { _meta, ...rest } = obj
  return rest
}

function capitalize(s) {
  if (!s) return s
  return s.charAt(0) + s.slice(1).toLowerCase()
}
