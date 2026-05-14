import { initializeApp } from 'firebase/app'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
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

// Firestore SU IndexedDB persistence — pakeičia mūsų manualų localStorage
// caching layer'į. SDK pats užkrauna IDB cache'ą, queues offline writes
// (cross-app-close persistence), ir invalidates cache'ą kai server sako
// kad doc'as ištrintas (cross-device delete propagacija veikia natūraliai).
//
// persistentMultipleTabManager — multi-tab koordinacija (lyderio rinkimas
// write'ams, kad du tab'ai nekonkurentuotų dėl IDB locks). Browser'iuose,
// kurie IDB nepalaiko (Safari private mode), SDK auto-fallback'ina į
// memory cache su warning'u.
let _db
try {
  _db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  })
} catch (e) {
  // initializeFirestore gali throw'inti jei jau buvo getFirestore call'inta
  // (race condition module load'e). Fallback'inu į regular getFirestore'ą.
  console.warn('[firestore] persistence init failed, falling back:', e)
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
