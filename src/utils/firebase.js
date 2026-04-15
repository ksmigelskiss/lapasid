import { initializeApp } from 'firebase/app'
import { getFirestore, doc } from 'firebase/firestore'
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey:            'AIzaSyCrmPG0svbkL8irAwsRutwZURnpqgqieds',
  authDomain:        'geliu-db.firebaseapp.com',
  projectId:         'geliu-db',
  storageBucket:     'geliu-db.firebasestorage.app',
  messagingSenderId: '429930306781',
  appId:             '1:429930306781:web:a652d688e921bc5267cf34',
}

const app  = initializeApp(firebaseConfig)
export const db      = getFirestore(app)
export const auth    = getAuth(app)
export const storage = getStorage(app)

const UID = 'HdAOoLtEzUXqU2px2h3YmzLygCp1'
export const DATA_DOC = doc(db, 'users', UID)

// Resolves when authenticated (persisted session or fresh sign-in)
export const authReady = new Promise((resolve) => {
  const unsub = onAuthStateChanged(auth, (user) => {
    unsub()
    if (user) {
      resolve(user)
    } else {
      signInWithEmailAndPassword(
        auth,
        import.meta.env.VITE_FB_EMAIL,
        import.meta.env.VITE_FB_PASSWORD,
      ).then(c => resolve(c.user)).catch(() => resolve(null))
    }
  })
})
