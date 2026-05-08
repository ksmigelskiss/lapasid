import { useState, useEffect } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  GoogleAuthProvider,
  getRedirectResult,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { auth, db, googleProvider, signInAnonymously, updateProfile } from '../utils/firebase'
import { migrate, LEGACY_KEYS } from '../utils/dataMigration'
import { acceptInvite } from '../components/ProfileSheet'

const LEGACY_UID = 'HdAOoLtEzUXqU2px2h3YmzLygCp1'

// Sukuria naują asmeninę kolekciją ir users/{uid} dokumentą (pirmasis prisijungimas)
async function runMigration(uid) {
  let legacyData = null
  try {
    const legacySnap = await getDoc(doc(db, 'users', LEGACY_UID))
    if (legacySnap.exists()) {
      const d = legacySnap.data()
      if (Array.isArray(d.plants) && !d.members) legacyData = d
    }
  } catch {}
  if (!legacyData) {
    try {
      const stored = localStorage.getItem('geliu-db')
      if (stored) legacyData = migrate(JSON.parse(stored))
    } catch {}
  }
  if (!legacyData) {
    try {
      for (const key of LEGACY_KEYS) {
        const old = localStorage.getItem(key)
        if (old) { legacyData = migrate(JSON.parse(old)); break }
      }
    } catch {}
  }

  const data         = legacyData ?? { plants: [], zinynas: [], zones: [], settings: {} }
  const collectionId = `col_${uid.slice(0, 8)}`

  await setDoc(doc(db, 'collections', collectionId), {
    plants:    data.plants   ?? [],
    zinynas:   data.zinynas  ?? [],
    zones:     data.zones    ?? [],
    settings:  data.settings ?? {},
    members:   [uid],
    ownerId:   uid,
    roles:     { [uid]: 'owner' },
    name:      'Mano augalai',
    createdAt: new Date().toISOString(),
  })

  await setDoc(doc(db, 'users', uid), {
    primaryCollection: collectionId,
    ownCollection:     collectionId,
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

// Nuskaito pending invite iš URL arba localStorage
async function processPendingInvite(uid) {
  const urlParams = new URLSearchParams(window.location.search)
  const urlToken  = urlParams.get('invite')
  if (urlToken) window.history.replaceState({}, '', window.location.pathname)

  const token = urlToken || localStorage.getItem('pending-invite')
  if (!token) return null
  localStorage.removeItem('pending-invite')

  try {
    const invSnap = await getDoc(doc(db, 'invites', token))
    if (!invSnap.exists()) { console.warn('[invite] token not found:', token); return null }

    const guestName = localStorage.getItem('guest-name')
    const profile = {
      displayName: auth.currentUser?.displayName || guestName || '',
      email:       auth.currentUser?.email || '',
    }
    if (guestName) localStorage.removeItem('guest-name')

    return await acceptInvite(uid, token, invSnap.data(), profile)
  } catch (e) {
    console.warn('[invite] accept failed:', e)
    return null
  }
}

// Nuskaito visų vartotojo kolekcijų sąrašą su vardais ir rolėmis
async function loadAllCollections(uid, colIds) {
  const results = await Promise.all(colIds.map(async id => {
    try {
      const snap = await getDoc(doc(db, 'collections', id))
      if (!snap.exists()) return null
      const d = snap.data()
      const inferredRole = d.roles?.[uid] ?? (d.ownerId === uid ? 'owner' : 'member')
      return { id, name: d.name || 'Kolekcija', role: inferredRole, ownerId: d.ownerId }
    } catch { return null }
  }))
  return results.filter(Boolean)
}

// Grąžina aktyvios kolekcijos info arba sukuria naują
async function getOrCreateCollection(uid) {
  // Invite turi pirmenybę — net jei vartotojas jau egzistuoja
  const inviteColId = await processPendingInvite(uid)

  const userSnap = await getDoc(doc(db, 'users', uid))

  if (inviteColId) {
    const colSnap  = await getDoc(doc(db, 'collections', inviteColId))
    const colData  = colSnap.data() ?? {}
    const role     = colData.roles?.[uid] ?? (colData.ownerId === uid ? 'owner' : 'member')
    const colIds   = userSnap.exists() ? (userSnap.data().collections ?? [inviteColId]) : [inviteColId]
    const allCols  = await loadAllCollections(uid, [...new Set([...colIds, inviteColId])])
    return { colId: inviteColId, role, ownColId: userSnap.data()?.ownCollection ?? null, allCollections: allCols }
  }

  if (userSnap.exists() && userSnap.data().primaryCollection) {
    const d         = userSnap.data()
    const colId     = d.primaryCollection
    const ownColId  = d.ownCollection ?? colId

    // Nuskaityti kolekciją — lazy detection + role
    const colSnap = await getDoc(doc(db, 'collections', colId))
    let activeColId = colId
    let role        = 'owner'

    if (colSnap.exists()) {
      const members = colSnap.data().members ?? []
      if (!members.includes(uid)) {
        // Pašalintas iš kolekcijos — grįžta į asmeninę
        console.log('[auth] removed from collection, switching to own:', ownColId)
        activeColId = ownColId
        await setDoc(doc(db, 'users', uid), { primaryCollection: ownColId }, { merge: true })
      } else {
        const cd = colSnap.data()
        role = cd.roles?.[uid] ?? (cd.ownerId === uid ? 'owner' : 'member')
      }
    }

    // Atnaujinti memberProfiles + vardą
    const name  = auth.currentUser?.displayName || ''
    const email = auth.currentUser?.email || ''
    setDoc(doc(db, 'collections', activeColId), {
      [`memberProfiles.${uid}`]: { displayName: name, email },
    }, { merge: true }).catch(() => {})
    if (!d.displayName && name) {
      setDoc(doc(db, 'users', uid), { displayName: name, email }, { merge: true }).catch(() => {})
    }

    const colIds  = d.collections ?? [activeColId]
    const allCols = await loadAllCollections(uid, [...new Set(colIds)])
    return { colId: activeColId, role, ownColId, allCollections: allCols }
  }

  // Naujas vartotojas — migracija
  const colId   = await runMigration(uid)
  const allCols = [{ id: colId, name: 'Mano augalai', role: 'owner', ownerId: uid }]
  return { colId, role: 'owner', ownColId: colId, allCollections: allCols }
}

/**
 * useAuth — autentifikacijos hook
 * Grąžina: { user, collectionId, role, ownCollectionId, allCollections,
 *            loading, authError, loadingMessage,
 *            signIn, signInAsGuest, signOut, switchCollection, renameCollection }
 */
export function useAuth() {
  const [state, setState] = useState({
    user: null, collectionId: null, role: 'owner',
    ownCollectionId: null, allCollections: [],
    loading: true, authError: null, loadingMessage: null,
  })

  useEffect(() => {
    const urlParams      = new URLSearchParams(window.location.search)
    const googleIdToken  = urlParams.get('googleIdToken')
    const authErrorParam = urlParams.get('authError')

    if (googleIdToken) {
      window.history.replaceState({}, '', window.location.pathname)
      signInWithCredential(auth, GoogleAuthProvider.credential(googleIdToken))
        .catch(e => setState(s => ({ ...s, loading: false, authError: e.message ?? 'Prisijungimo klaida' })))
    }
    if (authErrorParam) {
      window.history.replaceState({}, '', window.location.pathname)
      setState(s => ({ ...s, loading: false, authError: decodeURIComponent(authErrorParam) }))
    }

    let redirectDone = false

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user && !redirectDone) return
      if (!user) {
        setState({ user: null, collectionId: null, role: 'owner', ownCollectionId: null, allCollections: [], loading: false, authError: null, loadingMessage: null })
        return
      }
      setState(s => ({ ...s, loading: true, loadingMessage: 'Ruošiama kolekcija…' }))
      try {
        const { colId, role, ownColId, allCollections } = await getOrCreateCollection(user.uid)
        setState({ user, collectionId: colId, role, ownCollectionId: ownColId, allCollections, loading: false, authError: null, loadingMessage: null })
      } catch (e) {
        console.error('[useAuth] profile error:', e)
        setState({ user, collectionId: null, role: 'owner', ownCollectionId: null, allCollections: [], loading: false, authError: null, loadingMessage: null })
      }
    })

    getRedirectResult(auth)
      .then(result => { if (result?.user) console.log('[auth] redirect:', result.user.email) })
      .catch(e => { if (e?.code !== 'auth/null-user') setState(s => ({ ...s, authError: e?.message ?? 'Prisijungimo klaida' })) })
      .finally(() => {
        redirectDone = true
        if (!auth.currentUser) setState({ user: null, collectionId: null, role: 'owner', ownCollectionId: null, allCollections: [], loading: false, authError: null, loadingMessage: null })
      })

    return unsub
  }, [])

  const signIn = async () => {
    setState(s => ({ ...s, authError: null }))
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
    if (isStandalone) { window.location.href = '/api/auth/google-start'; return }
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (e) {
      const fallbackCodes = ['auth/popup-blocked', 'auth/popup-closed-by-user', 'auth/cancelled-popup-request']
      if (fallbackCodes.includes(e?.code)) return signInWithRedirect(auth, googleProvider)
      setState(s => ({ ...s, authError: e?.message ?? 'Prisijungimo klaida' }))
    }
  }

  // Anoniminis prisijungimas — viewer invitams (be Google)
  const signInAsGuest = async (displayName) => {
    setState(s => ({ ...s, authError: null }))
    const name = displayName?.trim() || 'Prižiūrėtojas'
    if (name) localStorage.setItem('guest-name', name)
    try {
      const { user } = await signInAnonymously()
      if (name) await updateProfile(user, { displayName: name }).catch(() => {})
    } catch (e) {
      setState(s => ({ ...s, authError: e?.message ?? 'Klaida' }))
    }
  }

  // Perjungia aktyvią kolekciją
  const switchCollection = async (colId) => {
    const { user, allCollections } = state
    if (!user || !colId) return
    await setDoc(doc(db, 'users', user.uid), { primaryCollection: colId }, { merge: true })
    const col  = allCollections.find(c => c.id === colId)
    const role = col?.role ?? 'member'
    setState(s => ({ ...s, collectionId: colId, role }))
  }

  // Pervardina kolekciją (tik owner)
  const renameCollection = async (colId, name) => {
    if (!name?.trim()) return
    await setDoc(doc(db, 'collections', colId), { name: name.trim() }, { merge: true })
    setState(s => ({
      ...s,
      allCollections: s.allCollections.map(c => c.id === colId ? { ...c, name: name.trim() } : c),
    }))
  }

  const signOut = () => firebaseSignOut(auth)

  return { ...state, signIn, signInAsGuest, signOut, switchCollection, renameCollection }
}
