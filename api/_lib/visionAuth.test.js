// Testai: api/_lib/visionAuth.js → tokenFor + PEPPER.
//
// Šis algoritmas yra vision-doc gate'o pamatas: api/vision-unlock.js uždeda
// cookie = tokenFor(VISION_PASSWORD), o middleware.js įleidžia tik jei
// pateiktas cookie === tokenFor(VISION_PASSWORD). Jei algoritmas pasikeistų
// vienoje pusėje ir ne kitoje — gate arba atsivertų visiems, arba užsidarytų
// visiems. Dabar jis vienoje vietoje; šie testai „prikala" jo elgseną.

import { describe, it, expect } from 'vitest'
import { tokenFor, PEPPER } from './visionAuth.js'

describe('PEPPER', () => {
  it('yra fiksuota reikšmė (keisti = invaliduoti visus esamus cookie)', () => {
    expect(PEPPER).toBe('lapasid-vision-v1')
  })
})

describe('tokenFor', () => {
  it('grąžina 64 simbolių hex (SHA-256)', async () => {
    const t = await tokenFor('slaptas')
    expect(t).toMatch(/^[0-9a-f]{64}$/)
  })

  it('deterministinis — tas pats slaptažodis → tas pats token\'as', async () => {
    const a = await tokenFor('slaptas')
    const b = await tokenFor('slaptas')
    expect(a).toBe(b)
  })

  it('skirtingi slaptažodžiai → skirtingi token\'ai (saugumo savybė)', async () => {
    const a = await tokenFor('slaptas')
    const b = await tokenFor('slaptas2')
    expect(a).not.toBe(b)
  })

  it('žinomas vektorius — SHA-256("lapasid-vision-v1:slaptas")', async () => {
    // Nepriklausomai apskaičiuota reikšmė (pins the exact algorithm):
    const { createHash } = await import('node:crypto')
    const expected = createHash('sha256').update(`${PEPPER}:slaptas`).digest('hex')
    expect(await tokenFor('slaptas')).toBe(expected)
  })

  it('PEPPER įskaičiuojamas — token(password) ≠ grynas SHA-256(password)', async () => {
    const { createHash } = await import('node:crypto')
    const bareHash = createHash('sha256').update('slaptas').digest('hex')
    expect(await tokenFor('slaptas')).not.toBe(bareHash)
  })
})
