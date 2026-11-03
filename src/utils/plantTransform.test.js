// Testai: src/utils/plantTransform.js — AI tool_use atsakymo normalizavimas.
//
// Šios funkcijos sėdi PRIE AI BOUNDARY (api/save-plant.js processPlant,
// scripts/batch-enrich-catalog.mjs, client fetchDetails). Anthropic tool_use
// neapsaugo strict validation'u → AI grąžina array'us kaip JSON-string'us,
// `savybes` kaip string'ą, self-wrapped laukus. Klaida čia korumpuoja catalog
// dokumentą (toksiškumo struktūrą!) arba crash'ina Firestore setDoc.
//
// Padengiamos dokumentuotos regresijos:
//   • savybes-as-string (Dracaena 2026-05-27)
//   • self-wrapped substratas (Pilea 2026-05-29)
//   • present-only normalize (sinonimų perrašymas į [], regresija 5527a4e)

import { describe, it, expect } from 'vitest'
import {
  ensureArray,
  normalizeAIResponse,
  normalizeSavybes,
  stripUndefinedDeep,
} from './plantTransform.js'

describe('ensureArray', () => {
  it('array → passthrough', () => {
    expect(ensureArray(['a', 'b'])).toEqual(['a', 'b'])
  })
  it('JSON-string array → parsed', () => {
    expect(ensureArray('["a","b"]')).toEqual(['a', 'b'])
  })
  it('plain string (be skliaustų) → single-element array', () => {
    expect(ensureArray('vienas faktas')).toEqual(['vienas faktas'])
  })
  it('non-string, non-array → []', () => {
    expect(ensureArray(null)).toEqual([])
    expect(ensureArray(undefined)).toEqual([])
    expect(ensureArray(42)).toEqual([])
  })
  it('tuščias string → []', () => {
    expect(ensureArray('   ')).toEqual([])
  })
})

describe('normalizeAIResponse — present-only normalize', () => {
  it('praleidžia NEESANČIUS laukus (undefined lieka undefined, ne [])', () => {
    // Regresija 5527a4e: refresh path perrašydavo esamus sinonimus į [].
    const out = normalizeAIResponse({ idomybes: ['x'] })
    expect(out.idomybes).toEqual(['x'])
    expect('sinonimai' in out).toBe(false)
    expect(out.sinonimai).toBeUndefined()
  })

  it('normalizuoja ESANTĮ array lauką iš JSON-string\'o', () => {
    const out = normalizeAIResponse({ idomybes: '["f1","f2"]' })
    expect(out.idomybes).toEqual(['f1', 'f2'])
  })

  it('non-object įvestis → grąžina kaip yra', () => {
    expect(normalizeAIResponse(null)).toBeNull()
    expect(normalizeAIResponse('str')).toBe('str')
  })
})

describe('normalizeAIResponse — savybes defensyvumas (Dracaena incident)', () => {
  it('savybes kaip JSON-string → parsed į object\'ą', () => {
    const out = normalizeAIResponse({ savybes: '{"pavojai":[],"pavojingumas":{"yra":false}}' })
    expect(typeof out.savybes).toBe('object')
    expect(Array.isArray(out.savybes)).toBe(false)
    expect(out.savybes.pavojingumas.yra).toBe(false)
  })

  it('savybes kaip malformed string → {} (ne crash)', () => {
    const out = normalizeAIResponse({ savybes: '{bad json' })
    expect(out.savybes).toEqual({})
  })

  it('savybes kaip array → {} (apsauga nuo numeric-key spread\'o)', () => {
    const out = normalizeAIResponse({ savybes: ['x'] })
    expect(out.savybes).toEqual({})
  })

  it('nested pavojai string → array', () => {
    const out = normalizeAIResponse({ savybes: { pavojai: '[{"tipas":"toksiskas"}]' } })
    expect(Array.isArray(out.savybes.pavojai)).toBe(true)
    expect(out.savybes.pavojai[0].tipas).toBe('toksiskas')
  })
})

describe('normalizeAIResponse — self-wrapped laukai (Pilea incident) + clamp', () => {
  it('unwrap\'ina {"substratas":"tekstas"} objektą', () => {
    const out = normalizeAIResponse({ substratas: { substratas: 'Purus substratas' } })
    expect(out.substratas).toBe('Purus substratas')
  })
  it('unwrap\'ina self-wrapped JSON-string\'ą', () => {
    const out = normalizeAIResponse({ aprasymas: '{"aprasymas":"Gražus augalas"}' })
    expect(out.aprasymas).toBe('Gražus augalas')
  })
  it('laistymasIntervalas clamp — absurdiškai mažas → min 2 d.', () => {
    const out = normalizeAIResponse({ laistymasIntervalas: { vasara: 0, ziema: 1, metodas: 'x' } })
    expect(out.laistymasIntervalas.vasara).toBe(2)
    expect(out.laistymasIntervalas.ziema).toBe(2)
  })
  it('laistymasIntervalas clamp — absurdiškai didelis → max', () => {
    const out = normalizeAIResponse({ laistymasIntervalas: { vasara: 999, ziema: 999, metodas: 'x' } })
    expect(out.laistymasIntervalas.vasara).toBe(40)
    expect(out.laistymasIntervalas.ziema).toBe(90)
  })
})

describe('normalizeSavybes — safety-critical toksiškumo struktūra', () => {
  it('tuščia įvestis → saugus default (pavojingumas.yra:false)', () => {
    const s = normalizeSavybes(null)
    expect(s.pavojai).toEqual([])
    expect(s.pavojingumas).toEqual({ yra: false, lygis: null, detales: '' })
    expect(s.valgomumas.statusas).toBe('none')
    expect(s.vaistinis.statusas).toBe('none')
  })

  it('atmeta nevalidžius pavojai įrašus (blogas enum)', () => {
    const s = normalizeSavybes({
      pavojai: [
        { tipas: 'toksiskas', target: 'gyvunams', severity: 'stiprus' }, // validus
        { tipas: 'XXX', target: 'gyvunams', severity: 'stiprus' },        // blogas tipas
        { tipas: 'toksiskas', target: 'marsiečiams', severity: 'stiprus' }, // blogas target
      ],
    })
    expect(s.pavojai).toHaveLength(1)
    expect(s.pavojai[0]).toEqual({ tipas: 'toksiskas', target: 'gyvunams', severity: 'stiprus' })
  })

  it('legacy toksiskas boolean (be savybes) → pavojingumas saugiklis', () => {
    const s = normalizeSavybes(null, true, 'Nuodinga nurijus')
    expect(s.pavojingumas.yra).toBe(true)
    expect(s.pavojingumas.detales).toBe('Nuodinga nurijus')
  })

  it('INFERENCE — pavojai tuščia + pavojingumas.yra → išveda iš detales', () => {
    // „šunims ir katėms" → gyvunams; „dirgina" → dirginantis
    const s = normalizeSavybes({
      pavojai: [],
      pavojingumas: { yra: true, lygis: 'vidutinis', detales: 'Sultys dirgina šunims ir katėms burną.' },
    })
    expect(s.pavojai.length).toBeGreaterThanOrEqual(1)
    const gyv = s.pavojai.find(p => p.target === 'gyvunams')
    expect(gyv).toBeTruthy()
    expect(gyv.tipas).toBe('dirginantis')
    expect(gyv.severity).toBe('vidutinis')
  })

  it('normalizuoja nevalidų pavojingumas.lygis į null', () => {
    const s = normalizeSavybes({ pavojingumas: { yra: true, lygis: 'KATASTROFA', detales: '' } })
    expect(s.pavojingumas.lygis).toBeNull()
  })
})

describe('stripUndefinedDeep — Firestore setDoc apsauga', () => {
  it('pašalina undefined raktus (įsk. nested)', () => {
    expect(stripUndefinedDeep({ a: 1, b: undefined, c: { d: undefined, e: 2 } }))
      .toEqual({ a: 1, c: { e: 2 } })
  })
  it('pašalina undefined array elementus', () => {
    expect(stripUndefinedDeep([1, undefined, 2])).toEqual([1, 2])
  })
  it('null PALIEKAMAS (Firestore validuoja null)', () => {
    expect(stripUndefinedDeep({ a: null })).toEqual({ a: null })
  })
  it('Date (ne plain object) paliekama intact', () => {
    const d = new Date('2026-01-01')
    expect(stripUndefinedDeep({ at: d }).at).toBe(d)
  })
})
