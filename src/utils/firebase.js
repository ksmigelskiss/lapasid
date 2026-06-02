import { initializeApp } from 'firebase/app'
import {
  initializeFirestore,
  memoryLocalCache,
  getFirestore,
} from 'firebase/firestore'
import { getAuth, GoogleAuthProvider, FacebookAuthProvider, setPersistence, browserLocalPersistence, signInAnonymously as _signInAnonymously, updateProfile } from 'firebase/auth'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey:            'AIzaSyCrmPG0svbkL8irAwsRutwZURnpqgqieds',
  authDomain:        'geliu-db.firebaseapp.com',
  projectId:         'geliu-db',
  storageBucket:     'geliu-db.firebasestorage.app',
  messagingSenderId: '429930306781',
  appId:             '1:429930306781:web:a652d688e921bc5267cf34',
}

const app = initializeApp(firebaseConfig)

// 2026-06-02 — MEMORY cache (anksčiau persistentLocalCache + IndexedDB multi-tab).
// IndexedDB persistence sugadindavo (multi-tab lock contention + „database
// connection is closing" klaidos ypač po cache clear) → onSnapshot listener'is
// serveuodavo STALE cached duomenis: nauja foto/write nepasiekdavo UI live, tik
// page reload (fresh server read) parodydavo. Memory cache:
//   • write'ai atsispindi iškart (in-memory latency compensation),
//   • listener'is fresh iš serverio (jokio stale IDB cache),
//   • jokio IDB corruption / „connection closing" klaidų.
// Kaina: nėra cross-session offline cache (app re-fetch'ina load'e per onSnapshot)
// + offline write queue (app online-first: auth/AI/catalog reikia tinklo).
let _db
try {
  _db = initializeFirestore(app, { localCache: memoryLocalCache() })
} catch (e) {
  console.warn('[firestore] cache init failed, falling back:', e)
  _db = getFirestore(app)
}
export const db = _db
export const auth     = getAuth(app)
export const storage  = getStorage(app)
export const googleProvider   = new GoogleAuthProvider()
export const facebookProvider = new FacebookAuthProvider()
facebookProvider.addScope('email')

// Explicit localStorage persistence — apsaugo nuo redirect session praradimo mobile.
// (Match'ina geliu-db, kur tas pats nustatymas veikia iOS PWA'e.)
setPersistence(auth, browserLocalPersistence).catch(() => {})

export const signInAnonymously = () => _signInAnonymously(auth)
export { updateProfile }
