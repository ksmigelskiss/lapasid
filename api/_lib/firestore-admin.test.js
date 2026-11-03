// Testai: api/_lib/firestore-admin.js → verifyAuthToken.
//
// SAUGUMO KONTEKSTAS (P0-1 fix, 2026-06-02): senasis `uidFromToken` tik
// base64-decode'ino JWT payload'ą BE parašo verifikacijos → bet kas galėjo
// suforguoti token'ą su norimu UID ir bypass'inti auth (įsk. admin escalation
// per save-plant admin mode). verifyAuthToken naudoja
// admin.auth().verifyIdToken() — kriptografinė verifikacija.
//
// Elgsenos kontraktas, kurį prikalame:
//   • validus token'as  → uid
//   • invalidus/expired → null (verifyIdToken meta → catch → null)
//   • ne-string įvestis  → null (be jokio call'o)
//   • NIEKADA nemeta — caller'is tik tikrina `if (!uid) return 401`.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// verifyIdToken mock'as — pasiekiamas iš testų per hoisted ref.
const verifyIdToken = vi.hoisted(() => vi.fn())

vi.mock('firebase-admin', () => ({
  default: {
    // apps.length > 0 → initAdmin() short-circuit'ina (be cert / initializeApp).
    apps: [{ name: '[DEFAULT]' }],
    auth: () => ({ verifyIdToken }),
    firestore: () => ({}),
    credential: { cert: vi.fn() },
    initializeApp: vi.fn(),
  },
}))

const { verifyAuthToken } = await import('./firestore-admin.js')

beforeEach(() => {
  verifyIdToken.mockReset()
})

describe('verifyAuthToken', () => {
  it('validus token\'as → grąžina uid', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'user-123' })
    expect(await verifyAuthToken('valid.jwt.token')).toBe('user-123')
    expect(verifyIdToken).toHaveBeenCalledWith('valid.jwt.token')
  })

  it('invalidus token\'as (verifyIdToken meta) → null, nemeta', async () => {
    verifyIdToken.mockRejectedValue(new Error('Firebase ID token has expired'))
    await expect(verifyAuthToken('expired.token')).resolves.toBeNull()
  })

  it('null įvestis → null be verifyIdToken call\'o', async () => {
    expect(await verifyAuthToken(null)).toBeNull()
    expect(verifyIdToken).not.toHaveBeenCalled()
  })

  it('tuščias string → null be verifyIdToken call\'o', async () => {
    expect(await verifyAuthToken('')).toBeNull()
    expect(verifyIdToken).not.toHaveBeenCalled()
  })

  it('ne-string įvestis (number) → null be call\'o', async () => {
    expect(await verifyAuthToken(12345)).toBeNull()
    expect(verifyIdToken).not.toHaveBeenCalled()
  })

  it('decoded be uid → null (optional chaining ?? null)', async () => {
    verifyIdToken.mockResolvedValue({})
    expect(await verifyAuthToken('token.without.uid')).toBeNull()
  })
})
