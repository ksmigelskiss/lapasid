import { initializeApp } from 'firebase/app'
import { getFirestore, doc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            'AIzaSyCrmPG0svbkL8irAwsRutwZURnpqgqieds',
  authDomain:        'geliu-db.firebaseapp.com',
  projectId:         'geliu-db',
  storageBucket:     'geliu-db.firebasestorage.app',
  messagingSenderId: '429930306781',
  appId:             '1:429930306781:web:a652d688e921bc5267cf34',
}

const app = initializeApp(firebaseConfig)
export const db  = getFirestore(app)
export const DATA_DOC = doc(db, 'geliu-db', 'data')
