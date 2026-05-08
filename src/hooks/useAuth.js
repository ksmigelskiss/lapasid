import { useState, useEffect } from 'react'
import {
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from '../utils/firebase'
import { migrate, LEGACY_KEYS } from '../utils/dataMigration'

// UID iš senos vieno vartotojo sistemos — naudojamas migracijai
const LEGACY_UID = 'HdAOoLtEzUXqU2px2h3YmzLygCp1'

// Pirmojo prisijungimo migracija:
// 1. Pirma bandome nuskaityti iš Firestore senojo doc (tiksliausi duomenys)
// 2. Fallback: localStorage (jei Firestore neprieinama arba teisių nėra)
// 3. Sukuriame naują collections/{colId} su tais duomenimis
// 4. Sukuriame users/{uid} dokumentą
async function runMigration(uid) {
  let legacyData = null

  // 1. Firestore senasis doc — patikimiausi duomenys
  // Email/password vartotojas turi teisę skaityti savo doc.
  // Google vartotojas negaus teisės (catch) ir grįš į localStorage.
  try {
    const legacySnap = await getDoc(doc(db, 'users', LEGACY_UID))
    if (legacySnap.exists()) {
      const d = legacySnap.data()
      // Naudojame tik jei tai senojo formato doc (turi plants[], neturi members[])
      if (Array.isArray(d.plants) && !d.members) legacyData = d
    }
  } catch {}

  // 2. Fallback: localStorage
  if (!legacyData) {
    try {
      const stored = localStorage.getItem('geliu-db')
      if (stored) legacyData = migrate(JSON.parse(stored))
    } catch {}
  }

  // 3. Fallback: legacy versioned keys
  if (!legacyData) {
    try {
      for (const key of LEGACY_KEYS) {
        const old = localStorage.getItem(key)
        if (old) { legacyData = migrate(JSON.parse(old)); break }
      }
    } catch {}
  }

  const data = legacyData ?? { plants: [], zinynas: [], zones: [], settings: {} }
  const collectionId = `col_${uid.slice(0, 8)}`

  // Sukuriame collections dokumentą
  await setDoc(doc(db, 'collections', collectionId), {
    plants:   data.plants   ?? [],
    zinynas:  data.zinynas  ?? [],
    zones:    data.zones    ?? [],
    settings: data.settings ?? {},
    members:  [uid],
    ownerId:  uid,
    createdAt: new Date().toISOString(),
  })

  // Sukuriame users dokumentą
  await setDoc(doc(db, 'users', uid), {
    primaryCollection: collectionId,
    collections:       [collectionId],
    beta:              true,                  // pirmieji vartotojai — beta
    aiUsage:           { searches: 0, chats: 0, fbPosts: 0 },
    subscription:      { plan: 'free', validUntil: null, stripeCustomerId: null },
    displayName:       '',
    email:             '',
    createdAt:         new Date().toISOString(),
  })

  return collectionId
}

// Grąžina collectionId pagal vartotojo profilį arba sukuria naują
async function getOrCreateCollection(uid) {
  const userSnap = await getDoc(doc(db, 'users', uid))
  if (userSnap.exists() && userSnap.data().primaryCollection) {
    // Naujas formatas — grąžiname collectionId
    return userSnap.data().primaryCollection
  }
  // Senasis doc formatas (turi plants[], bet ne primaryCollection) arba doc neegzistuoja
  // → paleidžiame migraciją
  return runMigration(uid)
}

/**
 * useAuth — Google Sign-In hook
 * Grąžina: { user, collectionId, loading, signIn, signOut }
 */
export function useAuth() {
  const [state, setState] = useState({ user: null, collectionId: null, loading: true })

  useEffect(() => {
    // Tvarko iOS PWA redirect po Google Sign-In
    getRedirectResult(auth).catch(console.error)

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ user: null, collectionId: null, loading: false })
        return
      }

      try {
        const collectionId = await getOrCreateCollection(user.uid)
        setState({ user, collectionId, loading: false })
      } catch (e) {
        console.error('[useAuth] profile error:', e)
        setState({ user, collectionId: null, loading: false })
      }
    })

    return unsub
  }, [])

  const signIn  = () => signInWithRedirect(auth, googleProvider)
  const signOut = () => firebaseSignOut(auth)

  return { ...state, signIn, signOut }
}
