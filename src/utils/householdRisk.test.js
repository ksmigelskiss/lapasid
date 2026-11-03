import { describe, it, expect } from 'vitest'
import {
  genusOf,
  normalizeHousehold,
  isHouseholdEmpty,
  resolveToxinProfile,
  assessHouseholdRisk,
  REKOMENDACIJA,
} from './toxinClasses.js'

// Namų rizikos logikos testai. Saugumui kritiška logika — sunkumas IŠVEDAMAS
// (ne priskiriamas), „nėra duomenų" NIEKADA nevirsta „saugu", rūšies
// diferenciacija (katė ≠ šuo) tikrinama eksplicitiškai. Jei logika regresuotų,
// medikų/namų kortelė meluotų → CI lūžis.
//
// Dalis testų naudoja realius bundled duomenis (MONSTERA, KALANCHOE...), dalis —
// injekuotus fixture'us (sintetinės klasės), kad logika būtų tikrinama
// nepriklausomai nuo duomenų drift'o.

// ── Sintetiniai fixture'ai (dependency injection) ──────────────
const FIXTURE_CLASSES = {
  mirtinas_katei: {
    vardas_lt: 'Testinė mirtina klasė',
    vardas_en: 'Test lethal class',
    mechanizmo_tipas: 'sisteminis',
    organas: 'sirdis',
    sunkumo_lubos: 'mirtinas',
    doze_priklausomas: true,
    antidotas: 'TestAntidotas',
    rusies_jautrumas: { zmogus: 'vidutinis', kate: 'mirtinas', suo: 'silpnas', paukstis: null, grauzikas: null },
    simptomai_lt: 'Testiniai simptomai.',
    medikui_lt: 'Testinė info medikui.',
    patikimumas: 'AUKSTAS',
    saltiniai: ['https://example.org/test'],
    aprasymai: { vaikai: 'Vaikams tekstas.', suauge_zmones: 'Suaugusiems tekstas.', gyvunai: 'Gyvūnams tekstas.' },
  },
  visi_null: {
    vardas_lt: 'Testinė be duomenų klasė',
    vardas_en: 'Test no-data class',
    mechanizmo_tipas: 'sisteminis',
    organas: null,
    sunkumo_lubos: 'sunkus',
    doze_priklausomas: true,
    antidotas: null,
    rusies_jautrumas: { zmogus: null, kate: null, suo: null, paukstis: null, grauzikas: null },
    simptomai_lt: 'Nežinoma.',
    medikui_lt: 'Nežinoma.',
    patikimumas: 'ZEMAS',
    saltiniai: ['https://example.org/unknown'],
    aprasymai: {},
  },
}
const FIXTURE_GENUS = {
  TESTGENTIS:    { klases: [{ id: 'mirtinas_katei', dalis: 'visos' }], tier: 1, saugus: false, specialios_veliavos: ['testine_veliava'] },
  NULLGENTIS:    { klases: [{ id: 'visi_null', dalis: 'visos' }], tier: 3, saugus: false },
  SAUGIGENTIS:   { klases: [], tier: 1, saugus: true },
  TBDGENTIS:     { klases: [], tier: 3, saugus: false, pastaba: 'junginys nenustatytas' },
}
const DATA = { classes: FIXTURE_CLASSES, genusMap: FIXTURE_GENUS }
const plantOf = (latin) => ({ lotyniskas: latin })

// ── genusOf ────────────────────────────────────────────────────
describe('genusOf — genties ekstrakcija', () => {
  it('ima pirmą žodį didžiosiomis', () => {
    expect(genusOf('Monstera deliciosa')).toBe('MONSTERA')
    expect(genusOf('epipremnum aureum')).toBe('EPIPREMNUM')
  })
  it('praleidžia hibrido × ženklą', () => {
    expect(genusOf('× Fatshedera lizei')).toBe('FATSHEDERA')
  })
  it('grąžina null be pavadinimo', () => {
    expect(genusOf('')).toBeNull()
    expect(genusOf(null)).toBeNull()
    expect(genusOf(undefined)).toBeNull()
  })
})

// ── normalizeHousehold ─────────────────────────────────────────
describe('normalizeHousehold — namų profilio normalizacija', () => {
  it('nufiltruoja nežinomas gyvūnų rūšis', () => {
    const h = normalizeHousehold({ vaikai: true, gyvunai: ['kate', 'zebra', 'suo'], vaikuAmzius: 'mazi', kitiGyvunai: true })
    expect(h.gyvunai).toEqual(['kate', 'suo'])
    expect(h.vaikai).toBe(true)
    expect(h.vaikuAmzius).toBe('mazi')
    expect(h.kitiGyvunai).toBe(true)
  })
  it('tuščias objektas → saugūs default\'ai', () => {
    const h = normalizeHousehold({})
    expect(h).toEqual({ vaikai: false, vaikuAmzius: null, gyvunai: [], kitiGyvunai: false })
  })
  it('blogas vaikuAmzius → null', () => {
    expect(normalizeHousehold({ vaikai: true, vaikuAmzius: 'xxx' }).vaikuAmzius).toBeNull()
  })
  it('isHouseholdEmpty teisingai', () => {
    expect(isHouseholdEmpty({})).toBe(true)
    expect(isHouseholdEmpty({ vaikai: true })).toBe(false)
    expect(isHouseholdEmpty({ gyvunai: ['kate'] })).toBe(false)
  })
})

// ── resolveToxinProfile: realūs duomenys ───────────────────────
describe('resolveToxinProfile — lokalus dirgiklis (Monstera, oksalatai)', () => {
  it('vaikams → toksiška, bet tik LENGVAS sunkumas (ne panika)', () => {
    const p = resolveToxinProfile(plantOf('Monstera deliciosa'), { vaikai: true })
    expect(p.status).toBe('toksiska')
    expect(p.genus).toBe('MONSTERA')
    expect(p.klases).toHaveLength(1)
    expect(p.klases[0].id).toBe('ca_oxalate_insoluble')
    expect(p.klases[0].sunkumas_man).toBe('silpnas') // zmogus = silpnas
    expect(p.sunkumasMax).toBe('silpnas')
    expect(p.kritineVeliava).toBe(false)
    expect(p.perAuditorija).toEqual([
      expect.objectContaining({ auditorija: 'vaikai', sunkumas: 'silpnas', trukstaDuomenu: false }),
    ])
  })

  it('graužikui → „nėra duomenų" (null), NE „saugu"', () => {
    const p = resolveToxinProfile(plantOf('Monstera deliciosa'), { gyvunai: ['grauzikas'] })
    expect(p.klases[0].sunkumas_man).toBeNull()
    expect(p.klases[0].sunkumas_trukstaDuomenu).toBe(true)
    expect(p.sunkumasMax).toBeNull()
    expect(p.perAuditorija[0]).toMatchObject({ auditorija: 'grauzikas', sunkumas: null, trukstaDuomenu: true })
  })

  it('paukščiui → vidutinis (ryklės edema)', () => {
    const p = resolveToxinProfile(plantOf('Monstera deliciosa'), { gyvunai: ['paukstis'] })
    expect(p.sunkumasMax).toBe('vidutinis')
  })
})

describe('resolveToxinProfile — sisteminis (Kalanchoe, kardiak. glikozidai)', () => {
  it('katei → MIRTINAS + kritinė vėliava', () => {
    const p = resolveToxinProfile(plantOf('Kalanchoe blossfeldiana'), { gyvunai: ['kate'] })
    expect(p.status).toBe('toksiska')
    expect(p.klases[0].id).toBe('cardiac_glycosides')
    expect(p.klases[0].antidotas).toMatch(/DigiFab/)
    expect(p.sunkumasMax).toBe('mirtinas')
    expect(p.kritineVeliava).toBe(true)
  })
})

describe('resolveToxinProfile — rūšies diferenciacija (Cycas: katė ≠ šuo)', () => {
  it('katei sunkus, šuniui mirtinas — tas pats augalas, skirtingi verdiktai', () => {
    const p = resolveToxinProfile(plantOf('Cycas revoluta'), { gyvunai: ['kate', 'suo'] })
    const byAud = Object.fromEntries(p.perAuditorija.map(r => [r.auditorija, r.sunkumas]))
    expect(byAud.kate).toBe('sunkus')
    expect(byAud.suo).toBe('mirtinas')
    expect(p.sunkumasMax).toBe('mirtinas')
    expect(p.kritineVeliava).toBe(true)
  })
})

describe('resolveToxinProfile — saugios ir nežinomos gentys', () => {
  it('Calathea (saugus gentis) → status „saugu"', () => {
    const p = resolveToxinProfile(plantOf('Calathea orbifolia'), { gyvunai: ['kate'] })
    expect(p.status).toBe('saugu')
    expect(p.klases).toHaveLength(0)
  })

  it('nepažįstama gentis (Lilium — nėra žemėlapyje) → „nezinoma", NE „saugu"', () => {
    const p = resolveToxinProfile(plantOf('Lilium longiflorum'), { gyvunai: ['kate'] })
    expect(p.status).toBe('nezinoma')
    expect(p.genus).toBe('LILIUM')
    expect(p.dataGaps.length).toBeGreaterThan(0)
  })

  it('Crassula (toksiška, klasė nenustatyta) → „toksiska" + duomenų spraga, sunkumas null', () => {
    const p = resolveToxinProfile(plantOf('Crassula ovata'), {})
    expect(p.status).toBe('toksiska')
    expect(p.klases).toHaveLength(0)
    expect(p.sunkumasMax).toBeNull()
    expect(p.dataGaps.some(g => /nenustatyta/i.test(g))).toBe(true)
  })
})

describe('resolveToxinProfile — tuščias household → bendra klasės „luba"', () => {
  it('Kalanchoe be profilio → rodo sunkumo_lubos (mirtinas)', () => {
    const p = resolveToxinProfile(plantOf('Kalanchoe blossfeldiana'), {})
    expect(p.klases[0].sunkumas_man).toBe('mirtinas') // sunkumo_lubos
    expect(p.sunkumasMax).toBe('mirtinas')
    expect(p.perAuditorija).toHaveLength(0) // nėra konkrečių narių
  })
})

describe('resolveToxinProfile — injekuoti fixture\'ai (logika be duomenų drift\'o)', () => {
  it('max per auditorijas: katei mirtinas, šuniui silpnas → max mirtinas', () => {
    const p = resolveToxinProfile(plantOf('Testgentis testine'), { gyvunai: ['kate', 'suo'] }, DATA)
    expect(p.sunkumasMax).toBe('mirtinas')
    expect(p.kritineVeliava).toBe(true)
    expect(p.specialios).toEqual(['testine_veliava'])
  })

  it('visi null jautrumai → sunkumas null + trūksta duomenų (NE saugu)', () => {
    const p = resolveToxinProfile(plantOf('Nullgentis testine'), { gyvunai: ['kate', 'suo'] }, DATA)
    expect(p.status).toBe('toksiska')
    expect(p.sunkumasMax).toBeNull()
    expect(p.klases[0].sunkumas_trukstaDuomenu).toBe(true)
  })

  it('audience aprašymas parenkamas pagal household', () => {
    const pVaikai = resolveToxinProfile(plantOf('Testgentis'), { vaikai: true }, DATA)
    expect(pVaikai.klases[0].aprasymai.map(a => a.auditorija)).toContain('vaikai')
    const pGyv = resolveToxinProfile(plantOf('Testgentis'), { gyvunai: ['kate'] }, DATA)
    expect(pGyv.klases[0].aprasymai.map(a => a.auditorija)).toContain('gyvunai')
    const pTuscias = resolveToxinProfile(plantOf('Testgentis'), {}, DATA)
    expect(pTuscias.klases[0].aprasymai.map(a => a.auditorija)).toContain('suauge_zmones')
  })
})

// ── assessHouseholdRisk: rekomendacijų žemėlapis ───────────────
describe('assessHouseholdRisk — išdėstymo rekomendacija', () => {
  it('mirtinas/sunkus → „geriau ne namuose" + kritinis tonas', () => {
    const r = assessHouseholdRisk(plantOf('Kalanchoe blossfeldiana'), { gyvunai: ['kate'] })
    expect(r.rekomendacija).toBe(REKOMENDACIJA.ne_namuose)
    expect(r.tonas).toBe('kritinis')
    expect(r.kritineVeliava).toBe(true)
  })

  it('vidutinis → „laikyti aukštai"', () => {
    const r = assessHouseholdRisk(plantOf('Monstera deliciosa'), { gyvunai: ['paukstis'] })
    expect(r.rekomendacija).toBe(REKOMENDACIJA.aukstai)
    expect(r.tonas).toBe('vidutinis')
  })

  it('silpnas → „galima ant žemės" (maža rizika)', () => {
    const r = assessHouseholdRisk(plantOf('Monstera deliciosa'), { vaikai: true })
    expect(r.rekomendacija).toBe(REKOMENDACIJA.ant_zemes)
    expect(r.tonas).toBe('zemas')
  })

  it('saugi gentis → „pavojų nematyti" (bet niekada absoliutaus „saugu")', () => {
    const r = assessHouseholdRisk(plantOf('Calathea orbifolia'), { gyvunai: ['kate'] })
    expect(r.rekomendacija).toBe(REKOMENDACIJA.saugu)
    expect(r.tekstas).not.toMatch(/visiškai saug/i)
  })

  it('nepažįstama gentis → „atsargiai / trūksta duomenų" (NE saugu)', () => {
    const r = assessHouseholdRisk(plantOf('Lilium longiflorum'), { gyvunai: ['kate'] })
    expect(r.rekomendacija).toBe(REKOMENDACIJA.atsargiai_nezinoma)
    expect(r.tekstas).toMatch(/nėra duomenų/i)
  })

  it('toksiška be išvedamo sunkumo → atsargiai, ne saugu', () => {
    const r = assessHouseholdRisk(plantOf('Crassula ovata'), { gyvunai: ['kate'] })
    expect(r.rekomendacija).toBe(REKOMENDACIJA.atsargiai_nezinoma)
  })

  it('maži vaikai (0–3 m.) → ekspozicijos pastaba (kelia pasiekiamumo svarbą, ne sunkumą)', () => {
    const r = assessHouseholdRisk(plantOf('Monstera deliciosa'), { vaikai: true, vaikuAmzius: 'mazi' })
    expect(r.rekomendacija).toBe(REKOMENDACIJA.ant_zemes) // sunkumas NEpakeltas
    expect(r.maziVaikaiPastaba).toBeTruthy()
  })

  it('be mažų vaikų pastabos (paaugliai) — nekelia', () => {
    const r = assessHouseholdRisk(plantOf('Monstera deliciosa'), { vaikai: true, vaikuAmzius: 'paaugliai' })
    expect(r.maziVaikaiPastaba).toBeNull()
  })
})
