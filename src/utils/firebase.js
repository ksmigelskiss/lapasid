import { initializeApp } from 'firebase/app'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  CACHE_SIZE_UNLIMITED,
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

// 2026-06-03 — PERSISTENT IndexedDB cache (single-tab). GRĄŽINTA po to, kai
// 2026-06-02 buvo perjungta į memoryLocalCache dėl „stale listener" bug'o
// (onSnapshot serveuodavo seną cache, fresh server snapshot'as nepasiekdavo UI,
// tik page reload parodydavo). TIKROJI to bug'o priežastis NEBUVO IndexedDB —
// Service Worker cache'ino `firestore.googleapis.com` Listen stream'ą
// (NetworkFirst, 5s timeout nutraukdavo/perleisdavo stream'ą) → live server
// snapshot'as nepasiekdavo → listener'is likdavo užstrigęs ant cache. Plius
// multi-tab manager → „connection closing" lock'ai. Abu ištaisyti:
//   • vite.config.js — pašalintas SW firestore.googleapis.com caching (b815 + stream fix)
//   • čia — `persistentSingleTabManager` (ne multi-tab) → jokio lock contention
// Dabar geriausia iš abiejų: cold start INSTANT iš IndexedDB (offline-capable,
// duomenys lieka telefone, neperkrauna), o live snapshot'ai veikia (SW nebelaužo).
let _db
try {
  _db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentSingleTabManager(undefined),
      cacheSizeBytes: CACHE_SIZE_UNLIMITED,
    }),
  })
} catch (e) {
  console.warn('[firestore] persistent cache init failed, falling back to memory:', e)
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

// 2026-06-03 — iOS PWA eviction resistance. iOS/WebKit ištrina standalone PWA
// IndexedDB + CacheStorage po ~7 dienų be naudojimo. persist() paprašo „durable"
// storage → mažina tikimybę, kad cache (Firestore IDB + image cache) bus išvalytas.
if (typeof navigator !== 'undefined') {
  navigator.storage?.persist?.().catch(() => {})
}

export const signInAnonymously = () => _signInAnonymously(auth)
export { updateProfile }
