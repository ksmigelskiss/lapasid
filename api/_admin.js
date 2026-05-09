import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

export function adminDb() {
  if (!getApps().length) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}')
    initializeApp({ credential: cert(sa) })
  }
  return getFirestore()
}
