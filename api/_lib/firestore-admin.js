/**
 * Firebase Admin SDK initialization — server-side singleton.
 *
 * Mirror'as api/rehost-image.js'o init pattern'o, BET centralizuotas helper'is,
 * kad keli endpoint'ai (save-plant, rehost-image) reuse'intų tą pačią app
 * instance'ą.
 *
 * Vercel Functions instance'ai dažnai reuse'inami tarp request'ų (Fluid
 * Compute), todėl `admin.initializeApp()` būtina apsaugoti — kitaip
 * antras call'as meta „already exists" error'į.
 *
 * USAGE:
 *   import { adminFirestore } from './firestore-admin.js'
 *   const db = adminFirestore()
 *   await db.collection('catalog').doc(id).set(data, { merge: true })
 */
import admin from 'firebase-admin'

let _initialized = false

function initAdmin() {
  if (_initialized || admin.apps.length > 0) {
    _initialized = true
    return admin
  }

  let serviceAccount
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  } catch (e) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT JSON parse failed: ' + e.message)
  }

  // Vercel env gali saugot \n kaip literal backslash-n
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n')
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
  _initialized = true
  return admin
}

/** Lazy-initialized Firestore admin instance. */
export function adminFirestore() {
  initAdmin()
  return admin.firestore()
}

/** Server-side timestamp using Admin SDK. */
export function serverTimestamp() {
  initAdmin()
  return admin.firestore.FieldValue.serverTimestamp()
}

/**
 * 2026-06-02 (P0-1 security fix) — Firebase ID token VERIFICATION.
 *
 * Pakeičia seną `uidFromToken` (api/_firestore.js), kuris tik base64-decode'ino
 * JWT payload'ą BE parašo verifikacijos → bet kas galėjo forge'inti token'ą su
 * norimu UID ir bypass'inti visus auth check'us (įsk. admin escalation per
 * save-plant admin mode).
 *
 * `admin.auth().verifyIdToken()` kriptografiškai patikrina:
 *   • RS256 parašą prieš Google viešuosius raktus (auto key rotation)
 *   • `exp` (expiration) + `iat` (issued-at)
 *   • `aud` (= projekto ID) + `iss` (= securetoken.google.com/{project})
 *
 * Grąžina uid (string) jei token validus, arba null. Niekada nemeta — caller'is
 * tik tikrina `if (!uid) return 401`.
 *
 * NOTE: pirmas call'as per function instance'ą fetch'ina Google public keys
 * (cache'inama SDK viduje per key TTL). Cold-start cost ~100-300ms, bet
 * dominuojamas AI/Firestore latency šiuose endpoint'uose.
 */
export async function verifyAuthToken(token) {
  if (!token || typeof token !== 'string') return null
  try {
    initAdmin()
    const decoded = await admin.auth().verifyIdToken(token)
    return decoded?.uid ?? null
  } catch (e) {
    console.warn('[auth] ID token verification failed:', e?.message)
    return null
  }
}
