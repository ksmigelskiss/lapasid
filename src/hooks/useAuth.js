import { useState, useEffect } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from '../utils/firebase'
import { migrate, LEGACY_KEYS } from '../utils/dataMigration'
import { acceptInvite } from '../components/ProfileSheet'

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
    beta:              true,
    aiUsage:           { searches: 0, chats: 0, fbPosts: 0 },
    subscription:      { plan: 'free', validUntil: null, stripeCustomerId: null },
    displayName:       auth.currentUser?.displayName ?? '',
    email:             auth.currentUser?.email ?? '',
    createdAt:         new Date().toISOString(),
  })

  return collectionId
}

// Tikrina ar yra pending invite tokenas ir prisijungia prie kolekcijos
async function processPendingInvite(uid) {
  // Pirmiausia tikriname URL — apsaugo nuo race condition kai vartotojas jau prisijungęs
  const urlParams = new URLSearchParams(window.location.search)
  const urlToken  = urlParams.get('invite')
  if (urlToken) {
    // Išvalome URL iš karto kad nekartotų po reload
    window.history.replaceState({}, '', window.location.pathname)
  }

  const token = urlToken || localStorage.getItem('pending-invite')
  if (!token) return null
  localStorage.removeItem('pending-invite')

  try {
    const invSnap = await getDoc(doc(db, 'invites', token))
    if (!invSnap.exists()) {
      console.warn('[invite] token not found:', token)
      return null
    }
    return await acceptInvite(uid, token, invSnap.data(), {
      displayName: auth.currentUser?.displayName ?? '',
      email:       auth.currentUser?.email ?? '',
    })
  } catch (e) {
    console.warn('[invite] accept failed:', e)
    return null
  }
}

// Grąžina collectionId pagal vartotojo profilį arba sukuria naują
async function getOrCreateCollection(uid) {
  // Invite turi pirmenybę — net jei vartotojas jau egzistuoja
  const inviteColId = await processPendingInvite(uid)
  if (inviteColId) return inviteColId

  const userSnap = await getDoc(doc(db, 'users', uid))
  if (userSnap.exists() && userSnap.data().primaryCollection) {
    // Jei vardas/el. paštas dar neišsaugotas — atnaujinkime tyliai
    const d = userSnap.data()
    if (!d.displayName && auth.currentUser?.displayName) {
      setDoc(doc(db, 'users', uid), {
        displayName: auth.currentUser.displayName,
        email:       auth.currentUser.email ?? '',
      }, { merge: true }).catch(() => {})
    }
    return d.primaryCollection
  }
  // Senasis doc formatas (turi plants[], bet ne primaryCollection) arba doc neegzistuoja
  // → paleidžiame migraciją
  return runMigration(uid)
}

/**
 * useAuth — Google Sign-In hook
 * Grąžina: { user, collectionId, loading, authError, signIn, signOut }
 */
export function useAuth() {
  const [state, setState] = useState({ user: null, collectionId: null, loading: true, authError: null, loadingMessage: null })

  useEffect(() => {
    // redirectDone: true kai getRedirectResult jau išspręstas
    // Apsaugo nuo to kad onAuthStateChanged(null) anksti nutrauktų loading
    let redirectDone = false

    const unsub = onAuthStateChanged(auth, async (user) => {
      // Jei redirect dar neapdorotas ir nėra vartotojo — palaukiame
      if (!user && !redirectDone) return

      if (!user) {
        setState({ user: null, collectionId: null, loading: false, authError: null })
        return
      }

      // Iš karto rodyti spinner — kolekcijos kūrimas gali užtrukti kelias sekundes
      setState(s => ({ ...s, loading: true, loadingMessage: 'Ruošiama kolekcija…' }))

      try {
        const collectionId = await getOrCreateCollection(user.uid)
        setState({ user, collectionId, loading: false, authError: null, loadingMessage: null })
      } catch (e) {
        console.error('[useAuth] profile error:', e)
        setState({ user, collectionId: null, loading: false, authError: null, loadingMessage: null })
      }
    })

    // Apdorojame redirect rezultatą — po to leidžiame onAuthStateChanged veikti normaliai
    getRedirectResult(auth)
      .catch(e => { if (e?.code !== 'auth/null-user') console.error('[auth] redirect error:', e) })
      .finally(() => {
        redirectDone = true
        // Jei po redirect nėra vartotojo — rodom login ekraną
        if (!auth.currentUser) {
          setState({ user: null, collectionId: null, loading: false })
        }
      })

    return unsub
  }, [])

  const signIn = async () => {
    setState(s => ({ ...s, authError: null }))
    // PWA standalone mode — redirect is more reliable inside installed PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true
    if (isStandalone) {
      return signInWithRedirect(auth, googleProvider)
    }
    // Browser: popup first (works with Chrome 120+ third-party cookie restrictions)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (e) {
      const fallbackCodes = ['auth/popup-blocked', 'auth/popup-closed-by-user', 'auth/cancelled-popup-request']
      if (fallbackCodes.includes(e?.code)) {
        // User closed popup or it was blocked — try redirect
        return signInWithRedirect(auth, googleProvider)
      }
      console.error('[auth] signInWithPopup error:', e)
      setState(s => ({ ...s, authError: e?.message ?? 'Prisijungimo klaida' }))
    }
  }

  const signOut = () => firebaseSignOut(auth)

  return { ...state, signIn, signOut }
}
