import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// Schema-test toksiškumo klasių referencijai. Saugumui kritiški duomenys —
// struktūra prikalama, kad klaida (trūkstamas laukas, blogas enum) lūžtų CI,
// ne tyliai pasiektų medikų kortelę.

const __dirname = dirname(fileURLToPath(import.meta.url))
const data = JSON.parse(readFileSync(join(__dirname, '../../data/toxin-classes.json'), 'utf-8'))
const { _meta, ...classes } = data
const genusMap = JSON.parse(readFileSync(join(__dirname, '../../data/genus-toxin-map.json'), 'utf-8'))

const MECHANISM = ['lokalus_dirgiklis', 'sisteminis', 'fototoksinis']
const CEILING = ['silpnas', 'vidutinis', 'sunkus', 'mirtinas']
const SENSITIVITY = ['nera', 'silpnas', 'vidutinis', 'sunkus', 'mirtinas', null]
const CONFIDENCE = ['AUKSTAS', 'VIDUTINIS', 'ZEMAS']
const SPECIES = ['zmogus', 'kate', 'suo', 'paukstis', 'grauzikas']

describe('toxin-classes.json — struktūra', () => {
  it('turi _meta su enumais', () => {
    expect(_meta).toBeTruthy()
    expect(_meta.enumai).toBeTruthy()
  })

  it('turi bent 15 klasių', () => {
    expect(Object.keys(classes).length).toBeGreaterThanOrEqual(15)
  })

  const ids = Object.keys(classes)
  for (const id of ids) {
    describe(`klasė: ${id}`, () => {
      const c = classes[id]

      it('privalomi tekstiniai laukai', () => {
        for (const f of ['vardas_lt', 'vardas_en', 'simptomai_lt', 'medikui_lt']) {
          expect(typeof c[f], `${id}.${f}`).toBe('string')
          expect(c[f].length, `${id}.${f} netuščias`).toBeGreaterThan(0)
        }
      })

      it('mechanizmo_tipas validus enum', () => {
        expect(MECHANISM, `${id}.mechanizmo_tipas`).toContain(c.mechanizmo_tipas)
      })

      it('sunkumo_lubos validus enum', () => {
        expect(CEILING, `${id}.sunkumo_lubos`).toContain(c.sunkumo_lubos)
      })

      it('patikimumas validus enum', () => {
        expect(CONFIDENCE, `${id}.patikimumas`).toContain(c.patikimumas)
      })

      it('doze_priklausomas yra boolean', () => {
        expect(typeof c.doze_priklausomas, `${id}.doze_priklausomas`).toBe('boolean')
      })

      it('rusies_jautrumas turi visas 5 rūšis su validžiomis reikšmėmis', () => {
        expect(c.rusies_jautrumas, `${id}.rusies_jautrumas`).toBeTruthy()
        for (const sp of SPECIES) {
          expect(Object.keys(c.rusies_jautrumas), `${id} turi ${sp}`).toContain(sp)
          expect(SENSITIVITY, `${id}.rusies_jautrumas.${sp}`).toContain(c.rusies_jautrumas[sp])
        }
      })

      it('aprasymai yra objektas (pildomas konvejeriu)', () => {
        expect(typeof c.aprasymai, `${id}.aprasymai`).toBe('object')
      })

      it('saltiniai — netuščias masyvas su URL', () => {
        expect(Array.isArray(c.saltiniai), `${id}.saltiniai`).toBe(true)
        expect(c.saltiniai.length, `${id}.saltiniai netuščias`).toBeGreaterThan(0)
        for (const url of c.saltiniai) expect(url).toMatch(/^https?:\/\//)
      })
    })
  }
})

describe('genus-toxin-map.json — referencinis vientisumas', () => {
  const genera = Object.keys(genusMap).filter(k => k !== '_meta')

  it('turi gentis', () => {
    expect(genera.length).toBeGreaterThanOrEqual(50)
  })

  it('visos klases[].id rodo į esamą toxin-class', () => {
    const validIds = new Set(Object.keys(classes))
    for (const g of genera) {
      for (const k of (genusMap[g].klases ?? [])) {
        expect(validIds, `${g} → ${k.id}`).toContain(k.id)
      }
    }
  })

  it('kiekviena gentis turi saugus(bool) + tier(1-3)', () => {
    for (const g of genera) {
      expect(typeof genusMap[g].saugus, `${g}.saugus`).toBe('boolean')
      expect([1, 2, 3], `${g}.tier`).toContain(genusMap[g].tier)
    }
  })
})
