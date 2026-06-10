import { describe, it, expect } from 'vitest'
import { derivePfafSeverity, derivePfafTipas, isPavojaiEmpty } from './deriveToxicity'

// Saugumui kritiškiausia logika app'e: neteisingas severity/tipas = įtikinama,
// bet klaidinga saugumo informacija vartotojui. Atvejai — iš realių PFAF tekstų
// pattern'ų, dokumentuotų pačiame deriveToxicity.js (Aconitum, Monstera, Digitalis).

describe('derivePfafSeverity — STIPRUS (gyvybei pavojinga)', () => {
  it('explicit death/fatal', () => {
    expect(derivePfafSeverity('Ingestion can cause death')).toBe('stiprus')
    expect(derivePfafSeverity('All parts are deadly poisonous')).toBe('stiprus')
  })
  it('Aconitum pattern: highly toxic + nervų sistema', () => {
    expect(derivePfafSeverity('The plant is highly toxic, affecting the nervous system')).toBe('stiprus')
  })
  it('Digitalis/Nerium pattern: cardiac + failure/arrest', () => {
    expect(derivePfafSeverity('Can cause cardiac arrest in large doses')).toBe('stiprus')
  })
})

describe('derivePfafSeverity — VIDUTINIS', () => {
  it('vėmimas/pykinimas', () => {
    expect(derivePfafSeverity('Causes vomiting and diarrhoea if eaten')).toBe('vidutinis')
  })
  it('dirginimas BE "mild" modifikatoriaus → vidutinis (Euphorbia realybė)', () => {
    expect(derivePfafSeverity('Skin contact with the sap can cause irritation')).toBe('vidutinis')
  })
  it('generic "poisonous" be specifikos → vidutinis (saugesnis default)', () => {
    expect(derivePfafSeverity('The plant is poisonous')).toBe('vidutinis')
  })
})

describe('derivePfafSeverity — SILPNAS', () => {
  it('eksplicitiškai mild', () => {
    expect(derivePfafSeverity('May cause mild skin irritation in sensitive people')).toBe('silpnas')
  })
  it('de-eskalacija: poorly absorbed → silpnas (oksalato dietinis boilerplate)', () => {
    expect(derivePfafSeverity('The plant is poisonous but poorly absorbed by the body')).toBe('silpnas')
  })
  it('de-eskalacija: rarely toxic', () => {
    expect(derivePfafSeverity('Plants in this genus are rarely toxic to humans')).toBe('silpnas')
  })
})

describe('derivePfafSeverity — trailing \\b regresija (taisyta 3eb3081, regresavo c3db196)', () => {
  // Kamienai (nause/seizur/irritat/poison) PRIVALO match'inti žodžių formas.
  // Su trailing \b jie nematch'ina NIEKO → severity null → toksiškumas tyliai
  // numetamas (under-report — pavojingoji kryptis). Šitie testai prikala fix'ą.
  it('„nausea" / „vomiting" → vidutinis', () => {
    expect(derivePfafSeverity('Causes nausea if ingested')).toBe('vidutinis')
    expect(derivePfafSeverity('May result in vomiting')).toBe('vidutinis')
  })
  it('„seizures" / „convulsions" → vidutinis', () => {
    expect(derivePfafSeverity('Large doses cause seizures and convulsions')).toBe('vidutinis')
  })
  it('„irritation" / „irritant" → vidutinis (oksalatų atvejis)', () => {
    expect(derivePfafSeverity('The sap is an irritant')).toBe('vidutinis')
    expect(derivePfafSeverity('Causes irritation to the mouth and throat')).toBe('vidutinis')
  })
  it('„mildew" NĖRA „mild" — silpnas regex saugiklis lieka su \\b', () => {
    expect(derivePfafSeverity('Mildew may form on the leaves')).toBeNull()
  })
})

describe('derivePfafSeverity — nieko', () => {
  it('tuščia / nekaltas tekstas → null', () => {
    expect(derivePfafSeverity('')).toBeNull()
    expect(derivePfafSeverity(null)).toBeNull()
    expect(derivePfafSeverity('A lovely easy houseplant')).toBeNull()
  })
})

describe('derivePfafTipas — tipas ≠ severity (atskiros ašys)', () => {
  it('stiprus → VISADA toksiskas (gyvybei pavojinga = sisteminis)', () => {
    expect(derivePfafTipas('whatever', 'stiprus')).toBe('toksiskas')
  })
  it('silpnas → dirginantis (lokalus poveikis)', () => {
    expect(derivePfafTipas('whatever', 'silpnas')).toBe('dirginantis')
  })
  it('vidutinis + sisteminiai simptomai → toksiskas', () => {
    expect(derivePfafTipas('causes vomiting if ingested', 'vidutinis')).toBe('toksiskas')
  })
  it('Monstera v2 fix: irritation prioritetas prieš allergy mišriame tekste', () => {
    // Anksčiau "skin irritation OR allergic reaction" klaidingai grąžindavo alergiskas
    expect(derivePfafTipas('may cause skin irritation or an allergic reaction', 'vidutinis')).toBe('dirginantis')
  })
  it('grynas alergiškumas → alergiskas', () => {
    expect(derivePfafTipas('allergic reactions have been reported', 'vidutinis')).toBe('alergiskas')
  })
  it('be teksto / generic → toksiskas (saugus default)', () => {
    expect(derivePfafTipas(null, 'vidutinis')).toBe('toksiskas')
    expect(derivePfafTipas('generally poisonous', 'vidutinis')).toBe('toksiskas')
  })
})

describe('isPavojaiEmpty — backfill trigger guard', () => {
  it('tuščia/nėra → true', () => {
    expect(isPavojaiEmpty(null)).toBe(true)
    expect(isPavojaiEmpty({})).toBe(true)
    expect(isPavojaiEmpty({ pavojai: [] })).toBe(true)
  })
  it('yra pavojų → false', () => {
    expect(isPavojaiEmpty({ pavojai: [{ tipas: 'toksiskas' }] })).toBe(false)
  })
})
