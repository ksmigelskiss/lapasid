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
