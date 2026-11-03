// Testai: api/_firestore.js → checkLimit + FREE_LIMITS.
//
// checkLimit yra laisvojo tier'o VARTAI, saugantys AI išlaidas: jis sprendžia,
// ar leisti dar vieną AI call'ą (paiešką / pokalbį / FB įrašą), ar grąžinti
// 403 limit_reached (žr. api/claude.js, api/claude/stream.js). Klaida čia =
// arba nemokami vartotojai neribotai degina AI biudžetą, arba mokami/beta
// vartotojai klaidingai blokuojami. Grynoji funkcija → idealus unit testas.

import { describe, it, expect } from 'vitest'
import { checkLimit, FREE_LIMITS } from './_firestore.js'

const FUTURE = new Date(Date.now() + 86_400_000).toISOString() // +1 diena
const PAST   = new Date(Date.now() - 86_400_000).toISOString() // -1 diena

describe('FREE_LIMITS', () => {
  it('turi laukiamus laisvojo tier\'o limitus', () => {
    expect(FREE_LIMITS).toEqual({ searches: 5, chats: 5, fbPosts: 2 })
  })
})

describe('checkLimit — leidimas (grąžina false)', () => {
  it('leidžia kai naudojimas žemiau limito', () => {
    const user = { aiUsage: { searches: 3 } }
    expect(checkLimit(user, 'searches')).toBe(false)
  })

  it('leidžia kai aiUsage apskritai nėra (pirmas naudojimas)', () => {
    expect(checkLimit({}, 'searches')).toBe(false)
  })

  it('leidžia kai limitType nenurodytas', () => {
    expect(checkLimit({ aiUsage: { searches: 99 } }, null)).toBe(false)
  })

  it('leidžia kai user null (be user — nėra ką riboti čia; auth tikrinamas atskirai)', () => {
    expect(checkLimit(null, 'searches')).toBe(false)
  })

  it('nežinomam limitType — limitas Infinity → leidžia', () => {
    expect(checkLimit({ aiUsage: { kazkas: 9999 } }, 'kazkas')).toBe(false)
  })
})

describe('checkLimit — blokavimas (grąžina limitType)', () => {
  it('blokuoja kai naudojimas lygus limitui', () => {
    const user = { aiUsage: { searches: 5 } }
    expect(checkLimit(user, 'searches')).toBe('searches')
  })

  it('blokuoja kai naudojimas viršija limitą', () => {
    const user = { aiUsage: { chats: 10 } }
    expect(checkLimit(user, 'chats')).toBe('chats')
  })

  it('blokuoja fbPosts ties 2', () => {
    expect(checkLimit({ aiUsage: { fbPosts: 2 } }, 'fbPosts')).toBe('fbPosts')
  })
})

describe('checkLimit — beta ir prenumeratos aplinkkeliai', () => {
  it('beta vartotojas niekada neblokuojamas (net viršijus)', () => {
    const user = { beta: true, aiUsage: { searches: 999 } }
    expect(checkLimit(user, 'searches')).toBe(false)
  })

  it('galiojanti mokama prenumerata (validUntil ateityje) → leidžia', () => {
    const user = { subscription: { plan: 'pro', validUntil: FUTURE }, aiUsage: { searches: 999 } }
    expect(checkLimit(user, 'searches')).toBe(false)
  })

  it('pasibaigusi prenumerata → krenta atgal į laisvojo tier\'o limitą → blokuoja', () => {
    const user = { subscription: { plan: 'pro', validUntil: PAST }, aiUsage: { searches: 5 } }
    expect(checkLimit(user, 'searches')).toBe('searches')
  })

  it('plan: "free" nėra mokamas → galioja limitas', () => {
    const user = { subscription: { plan: 'free', validUntil: FUTURE }, aiUsage: { searches: 5 } }
    expect(checkLimit(user, 'searches')).toBe('searches')
  })

  it('mokamas planas be validUntil → NEpraleidžia (nėra galiojimo įrodymo) → blokuoja', () => {
    const user = { subscription: { plan: 'pro' }, aiUsage: { searches: 5 } }
    expect(checkLimit(user, 'searches')).toBe('searches')
  })
})
