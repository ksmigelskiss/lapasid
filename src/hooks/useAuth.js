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
import { doc, getDoc, setDoc, updateDoc, getDocs, collection, query, limit } from 'firebase/firestore'
import { auth, db, googleProvider, facebookProvider } from '../utils/firebase'
import { migrate, LEGACY_KEYS } from '../utils/dataMigration'
import { acceptInvite } from '../components/ProfileSheet'
import { isMockMode, MOCK_USER, MOCK_COLLECTION_ID, MOCK_COLLECTION_NAME } from '../utils/mockData'

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

// Nuskaito pending invite iš URL arba localStorage (tik member invitams, ne viewer)
async function processPendingInvite(uid) {
  const urlParams = new URLSearchParams(window.location.search)
  const urlToken  = urlParams.get('invite')
  const urlRole   = urlParams.get('role')
  if (urlToken) window.history.replaceState({}, '', window.location.pathname)

  // Viewer invitai tvarkomi useAuth viewer check bloke — čia praleisti
  if (urlToken && urlRole === 'viewer') return null

  const token = urlToken || localStorage.getItem('pending-invite')
  if (!token) return null
  localStorage.removeItem('pending-invite')

  try {
    const invSnap = await getDoc(doc(db, 'invites', token))
    if (!invSnap.exists()) { console.warn('[invite] token not found:', token); return null }

    // Skip viewer invites (stored in localStorage as pending-invite)
    if (invSnap.data().role === 'viewer') return null

    const { colId } = invSnap.data()

    // Jei vartotojas jau yra šioje kolekcijoje — nesiprocessinam invite
    // (apsauga nuo accidental role downgrade jei owner atidaro savo invite nuorodą)
    if (colId) {
      const colSnap = await getDoc(doc(db, 'collections', colId))
      if (colSnap.exists() && (colSnap.data().members ?? []).includes(uid)) {
        console.log('[invite] user already in collection, skipping invite:', colId)
        return null
      }
    }

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

// Nuskaito visų vartotojo kolekcijų sąrašą su vardais, rolėmis ir augalų egzistavimu
async function loadAllCollections(uid, colIds) {
  const results = await Promise.all(colIds.map(async id => {
    try {
      const [snap, plantsSnap] = await Promise.all([
        getDoc(doc(db, 'collections', id)),
        getDocs(query(collection(db, 'collections', id, 'plants'), limit(1))),
      ])
      if (!snap.exists()) return null
      const d = snap.data()
      const inferredRole = d.roles?.[uid] ?? (d.ownerId === uid ? 'owner' : 'member')
      const hasPlants = plantsSnap.docs.length > 0 || (d.plants?.length ?? 0) > 0
      const name = (!d.name || d.name === 'Kolekcija') ? 'Mano augalai' : d.name
      return { id, name, role: inferredRole, ownerId: d.ownerId, hasPlants }
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

        // Fix: atstatome owner rolę jei:
        // (a) sena kolekcija su legacy ownerId, arba
        // (b) owner atsitiktinai pats sau priėmė viewer/member invite ir save downgradeino
        if (role !== 'owner' && (cd.ownerId === uid || cd.ownerId === LEGACY_UID)) {
          role = 'owner'
          setDoc(doc(db, 'collections', activeColId), {
            ownerId:              uid,
            [`roles.${uid}`]:     'owner',
          }, { merge: true }).catch(() => {})
        }
      }
    }

    // Atnaujinti memberProfiles + vardą
    const name  = auth.currentUser?.displayName || ''
    const email = auth.currentUser?.email || ''
    setDoc(doc(db, 'collections', activeColId), {
      [`memberProfiles.${uid}`]: { displayName: name, email },
    }, { merge: true }).catch(() => {})
    // Atnaujinam users/{uid} jei trūksta arba displayName, arba email
    // (anksčiau condition'as tikrindavo TIK displayName, todėl seni narių
    // dokumentai su tuščiu email niekada neatsinaujindavo).
    if ((!d.displayName || !d.email) && (name || email)) {
      const patch = {}
      if (!d.displayName && name)  patch.displayName = name
      if (!d.email       && email) patch.email       = email
      if (Object.keys(patch).length) {
        setDoc(doc(db, 'users', uid), patch, { merge: true }).catch(() => {})
      }
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
    viewerToken: null,
  })

  useEffect(() => {
    // ── MOCK MODE (Vercel preview iš desktop-ux branch) ─────────────
    // Aktyvuojama per VITE_USE_MOCK_USER=true env. Skip Firebase auth,
    // grąžina fake user'į. Plant duomenys ateina iš mockData.js per usePlants.
    if (isMockMode()) {
      setState({
        user: MOCK_USER,
        collectionId: MOCK_COLLECTION_ID,
        role: 'owner',
        ownCollectionId: MOCK_COLLECTION_ID,
        allCollections: [{ id: MOCK_COLLECTION_ID, name: MOCK_COLLECTION_NAME, hasPlants: true }],
        loading: false,
        authError: null,
        loadingMessage: null,
        viewerToken: null,
      })
      return
    }
    // ─────────────────────────────────────────────────────────────────

    const urlParams      = new URLSearchParams(window.location.search)

    // ── Viewer token check — BEFORE Firebase auth ──────────────────
    // URL parametrai NĖRA trinami — URL yra prieigos raktas (kaip Notion/Google Docs share)
    const inviteToken      = urlParams.get('invite')
    const inviteRole       = urlParams.get('role')
    const savedViewerToken = localStorage.getItem('viewer-token')
    const rawViewerToken   = (inviteToken && inviteRole === 'viewer') ? inviteToken : savedViewerToken

    // Prisijungęs vartotojas visada turi prioritetą prieš viewer tokeną
    const viewerToken = rawViewerToken && !auth.currentUser ? rawViewerToken : null

    if (viewerToken) {
      localStorage.setItem('viewer-token', viewerToken) // cache refresh'ams be URL

      // Token validacija per /api/viewer (Admin SDK), nes Firestore rules
      // reikalauja request.auth != null, o viewer'is NĖRA Firebase auth'intas.
      // Endpoint'as grąžina { colId } jeigu token aktyvus + neexpired,
      // arba 4xx/5xx status'ą jei revoked/expired/invalid.
      fetch(`/api/viewer?token=${encodeURIComponent(viewerToken)}`)
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(({ colId }) => {
          if (!colId) {
            localStorage.removeItem('viewer-token')
            setState(s => ({ ...s, loading: false }))
            return
          }
          setState({
            user: null, collectionId: colId, role: 'viewer',
            ownCollectionId: null, allCollections: [], loading: false,
            authError: null, loadingMessage: null, viewerToken,
          })
        })
        .catch(e => {
          console.warn('[viewer] token validation failed:', e)
          localStorage.removeItem('viewer-token')
          setState(s => ({ ...s, loading: false }))
        })

      return // Skip Firebase auth entirely for viewers
    }
    // ── End viewer check ───────────────────────────────────────────

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
        // authError paliekame — gali būti jau užpildytas signInWithCredential/.catch bloke
        setState(s => ({ ...s, user: null, collectionId: null, role: 'owner', ownCollectionId: null, allCollections: [], loading: false, loadingMessage: null }))
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
        // authError paliekame — gali būti jau užpildytas signInWithCredential/.catch bloke
        if (!auth.currentUser) setState(s => ({ ...s, user: null, collectionId: null, role: 'owner', ownCollectionId: null, allCollections: [], loading: false, loadingMessage: null }))
      })

    return unsub
  }, [])

  // Generic provider sign-in (Google, Facebook).
  // iOS PWA standalone mode'e signInWithPopup throw'ina `auth/internal-error`
  // (Safari standalone'e window.open restricted), todėl prieš popup'ą
  // detect'inam display-mode ir iškart einam į redirect'ą. Browser'iuose +
  // Android PWA — popup veikia normaliai, fallback į redirect kai popup
  // blokuotas/uždarytas (+ `auth/internal-error` kaip ekstra safety net'as).
  const signInWithProvider = async (provider) => {
    setState(s => ({ ...s, authError: null }))

    // iOS PWA detect: navigator.standalone (Safari-specific) ARBA matchMedia
    // display-mode: standalone (Chrome/Edge installed PWA spec'as).
    const isStandalonePWA =
      window.navigator?.standalone === true ||
      window.matchMedia?.('(display-mode: standalone)').matches === true

    if (isStandalonePWA) {
      return signInWithRedirect(auth, provider)
    }

    try {
      await signInWithPopup(auth, provider)
    } catch (e) {
      const popupFallback = [
        'auth/popup-blocked',
        'auth/popup-closed-by-user',
        'auth/cancelled-popup-request',
        'auth/internal-error', // iOS Safari standalone edge case'as
      ]
      if (popupFallback.includes(e?.code)) return signInWithRedirect(auth, provider)
      setState(s => ({ ...s, authError: e?.message ?? 'Prisijungimo klaida' }))
    }
  }

  const signInGoogle   = () => signInWithProvider(googleProvider)
  const signInFacebook = () => signInWithProvider(facebookProvider)

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

  const signOut = () => {
    if (state.viewerToken) {
      localStorage.removeItem('viewer-token')
      setState({
        user: null, collectionId: null, role: 'owner',
        ownCollectionId: null, allCollections: [],
        loading: false, authError: null, loadingMessage: null, viewerToken: null,
      })
      return
    }
    return firebaseSignOut(auth)
  }

  return { ...state, signInGoogle, signInFacebook, signOut, switchCollection, renameCollection }
}
