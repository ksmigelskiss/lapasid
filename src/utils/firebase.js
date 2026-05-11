import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
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

export const db       = getFirestore(app)
export const auth     = getAuth(app)
export const storage  = getStorage(app)
export const googleProvider   = new GoogleAuthProvider()
export const facebookProvider = new FacebookAuthProvider()
facebookProvider.addScope('email')

// Explicit localStorage persistence — apsaugo nuo redirect session praradimo mobile
setPersistence(auth, browserLocalPersistence).catch(() => {})

export const signInAnonymously = () => _signInAnonymously(auth)
export { updateProfile }
