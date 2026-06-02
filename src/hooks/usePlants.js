import { useState, useCallback, useEffect, useRef } from 'react'
import { getDoc, getDocs, setDoc, deleteDoc, doc, collection as fsCol, onSnapshot } from 'firebase/firestore'
import { db } from '../utils/firebase'
import { fromAIResult, ensureArray, makeId as _makeId, today as _today } from '../utils/plantTransform'
import { migrate, LEGACY_KEYS } from '../utils/dataMigration'
import { saveToCatalog, snapshotPlantRef } from '../utils/catalog'
import { isMockMode, MOCK_DATA } from '../utils/mockData'
import { deleteImageByUrl } from '../utils/imageService'

export { fromAIResult }

// localStorage NEBESTANDA cache'inti augalų — Firestore SDK persistence
// (firebase.js) per IndexedDB tvarko offline cache'ą + write queue'ą +
// invalidaciją. Mūsų manualus localStorage layer'is buvo bug'ų šaltinis
// (cross-device delete resurrection per safeguard'ą, tombstones'us, etc).
//
// Vienintelis liekantis localStorage naudojimas augalams — vienkartinė
// migracija seniems vartotojams, kurių plant'ai TIK localStorage'e
// (offline-added, niekada nepasiekė server'io). Po sėkmingos migracijos —
// flag'as `geliu-db-${cid}-migrated-v2` užstabdo pakartotinį push'ą.
function storageKey(collectionId) {
  return collectionId ? `geliu-db-${collectionId}` : 'geliu-db'
}
function migrationFlagKey(cid) {
  return cid ? `geliu-db-${cid}-migrated-v2` : null
}

/**
 * Rekursyviai pašalina `undefined` lauks iš objekto. Firebase setDoc()
 * KERTA su `Unsupported field value: undefined`, todėl visi save path'ai
 * praeina pro šitą helper'į. Null vertės paliekamos — Firebase jas priima.
 *
 * Dažniausia undefined priežastis: slim TOOL_PREVIEW (admin'o use case'as)
 * negrąžina pilno care info — laistymasIntervalas/tresimas/dormancyInfo
 * gali būti undefined po fromAIResult. fromAIResult dabar grąžina null
 * vietoj undefined, bet šitas helper'is — defense in depth ateičiai.
 */
function stripUndefined(obj) {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(stripUndefined)
  if (typeof obj !== 'object') return obj
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue
    out[k] = stripUndefined(v)
  }
  return out
}
function isLocalMigrationDone(cid) {
  const key = migrationFlagKey(cid)
  if (!key) return true
  try { return localStorage.getItem(key) === '1' } catch { return false }
}
function markLocalMigrationDone(cid) {
  const key = migrationFlagKey(cid)
  if (!key) return
  try { localStorage.setItem(key, '1') } catch {}
}

function loadLocal(colId) {
  const key = storageKey(colId)
  try {
    const stored = localStorage.getItem(key)
    if (stored) return migrate(JSON.parse(stored))

    // Pirmasis prisijungimas šiame įrenginyje — bandome senąjį raktą (migracijos duomenys)
    const legacy = localStorage.getItem('geliu-db')
    if (legacy) return migrate(JSON.parse(legacy))

    for (const k of LEGACY_KEYS) {
      const old = localStorage.getItem(k)
      if (old) return migrate(JSON.parse(old))
    }
  } catch {}
  return { plants: [], zinynas: [], zones: [], settings: {} }
}

const makeId = _makeId
const today  = _today


export function usePlants(collectionId, viewerToken = null) {
  // MOCK MODE — desktop-ux branch preview'ams (žr. utils/mockData.js).
  // Inicializuojama iš MOCK_DATA, mutators tik atnaujina state (jokių DB rašymų).
  const [data, setData] = useState(() => isMockMode() ? MOCK_DATA : loadLocal(collectionId))

  // Stable refs — leidžia useCallback nepriklausyti nuo collectionId
  const colIdRef = useRef(collectionId)
  useEffect(() => { colIdRef.current = collectionId })

  const viewerTokenRef = useRef(viewerToken)
  useEffect(() => { viewerTokenRef.current = viewerToken })

  // Legacy migration guard'as — `meta.plants[]` cleanup'as fire'ina TIK kartą
  // per kolekcijos sesiją. Be jo onSnapshot'as gali retry'inti cleanup'ą
  // kiekvienam snapshot'ui (jei pirmasis async setDoc'as dar nepraėjo).
  const migrationDoneRef = useRef(new Set()) // Set<colId>: kuriose kolekcijose jau išvalyta

  // 2026-06-02 — Sync layer = PER-DOC reconciliacija (žr. listener'ius žemiau).
  // Firestore SDK PATS daro optimistic latency compensation (local write iškart
  // matomas snapshot'e su hasPendingWrites). Tad NEREIKIA rankinio pending guard'o,
  // incomplete-snapshot guard'o ar viso state'o perrašymo — jie tik kompensavo
  // whole-state-replace sukurtą race'ą (foto dingdavo). Audito sprendimas: ištrinti.

  // Optimistic local update + write į Firestore. SDK su persistence
  // (firebase.js) queues offline writes į IndexedDB ir auto-flush'ina kai
  // network atsigauna. Jokio manualaus localStorage caching'o — server
  // (per onSnapshot) yra single source of truth.
  const update = useCallback((updater) => {
    if (viewerTokenRef.current) return // viewers — no writes via this path
    if (isMockMode()) {
      setData(prev => {
        const safe = { plants: [], zinynas: [], zones: [], settings: {}, ...prev }
        return updater(safe)
      })
      return
    }
    setData(prev => {
      const safe = { plants: [], zinynas: [], zones: [], settings: {}, ...prev }
      const next = updater(safe)
      const cid = colIdRef.current
      if (!cid) return next

      // Plants → subkolekcija (rašome tik pakeistus pagal reference equality).
      // SDK su persistence queue'ina writes IDB'oje — jei offline, write'as
      // pereis kai network atsigaus (be jokio mūsų retry logikos).
      const prevMap = new Map(safe.plants.map(p => [p.id, p]))
      const nextMap = new Map(next.plants.map(p => [p.id, p]))

      for (const [id, plant] of nextMap) {
        if (prevMap.get(id) !== plant) {
          setDoc(doc(db, 'collections', cid, 'plants', id), stripUndefined(plant))
            .catch(e => console.warn('[firestore] plant write:', e))
        }
      }
      for (const id of prevMap.keys()) {
        if (!nextMap.has(id)) {
          deleteDoc(doc(db, 'collections', cid, 'plants', id))
            .catch(e => console.warn('[firestore] plant delete:', e))
        }
      }

      // Metadata → pagrindinis doc (tik jei pasikeitė)
      if (next.zones !== safe.zones || next.zinynas !== safe.zinynas || next.settings !== safe.settings) {
        setDoc(doc(db, 'collections', cid), {
          zones:    next.zones    ?? [],
          zinynas:  next.zinynas  ?? [],
          settings: next.settings ?? {},
        }, { merge: true }).catch(e => console.warn('[firestore] meta write:', e))
      }

      return next
    })
  }, []) // stabilus — naudoja ref viduje

  // Vienkartinės legacy migracijos — NE realtime snapshot path'e (anksčiau jos
  // vykdydavosi kiekvienam snapshot'ui → write churn). Paleidžiama VIENĄ kartą per
  // kolekciją, kai pirmas plants+meta load baigtas (žr. listener maybeMigrate).
  //   1. localStorage → Firestore (seni device'ai prieš persistence).
  //   2. legacy meta.plants[] → subCol + meta.plants cleanup.
  const runMigrationsOnce = useCallback((cid, meta, plantIds) => {
    if (!isLocalMigrationDone(cid)) {
      try {
        const localRaw = localStorage.getItem(storageKey(cid))
        if (localRaw) {
          const local = JSON.parse(localRaw)
          let pushed = 0
          ;(local.plants ?? []).forEach(p => {
            if (p?.id && !plantIds.has(p.id)) {
              setDoc(doc(db, 'collections', cid, 'plants', p.id), stripUndefined(p))
                .catch(e => console.warn('[migrate] push failed:', e))
              if (p.lotyniskas) saveToCatalog(p).catch(() => {})
              pushed++
            }
          })
          if (pushed > 0) console.log(`[migrate] pushed ${pushed} orphan plants from localStorage`)
        }
      } catch (e) { console.warn('[migrate]', e) }
      markLocalMigrationDone(cid)
    }

    if (meta?.plants?.length > 0) {
      meta.plants.forEach(p => {
        if (p?.id && !plantIds.has(p.id)) {
          setDoc(doc(db, 'collections', cid, 'plants', p.id), stripUndefined(p))
            .catch(e => console.warn('[migrate-meta] push failed:', e))
          if (p.lotyniskas) saveToCatalog(p).catch(() => {})
        }
      })
      const { plants: _drop, ...cleanMeta } = meta
      setDoc(doc(db, 'collections', cid), cleanMeta)
        .catch(e => console.warn('[migrate-meta] cleanup failed:', e))
    }
  }, [])

  // ── Real-time onSnapshot listener'iai (Etapas B) ─────────────────────
  // Pakeičia polling-based sync'ą — server'is yra single source of truth,
  // UI auto-update'inasi kai pokyčiai įvyksta. Mock'ams ir viewer'iams —
  // skip (viewer'is naudoja /api/viewer polling'ą per syncFromRemote).
  useEffect(() => {
    if (isMockMode() || !collectionId || viewerToken) return
    const cid = collectionId
    const DEFAULTS = { plants: [], zinynas: [], zones: [], settings: {} }
    let metaLoaded = false, plantsLoaded = false
    let latestMeta = {}, latestPlantIds = new Set()

    const maybeMigrate = () => {
      if (metaLoaded && plantsLoaded && !migrationDoneRef.current.has(cid)) {
        migrationDoneRef.current.add(cid)
        runMigrationsOnce(cid, latestMeta, latestPlantIds)
      }
    }

    // META doc — zones/zinynas/settings (atskiras slice nuo plants; neperrašo plants).
    const unsubMeta = onSnapshot(
      doc(db, 'collections', cid),
      snap => {
        const m = snap.exists() ? snap.data() : {}
        latestMeta = m
        metaLoaded = true
        setData(prev => ({ ...DEFAULTS, ...prev, zinynas: m.zinynas ?? [], zones: m.zones ?? [], settings: m.settings ?? {} }))
        maybeMigrate()
      },
      e => console.warn('[snapshot] meta error:', e)
    )

    // PLANTS subcol — PER-DOC reconciliacija per snap.docChanges(). SDK įtraukia
    // local pending mutations (hasPendingWrites) → optimistinis write matomas IŠKART
    // ir NIEKAD neperrašomas stale full-read'u (liečiam tik pakeistus doc'us).
    // Jokio whole-state replace, jokių guard'ų.
    const unsubPlants = onSnapshot(
      fsCol(db, 'collections', cid, 'plants'),
      snap => {
        setData(prev => {
          const safe = { ...DEFAULTS, ...prev }
          const byId = new Map(safe.plants.map(p => [p.id, p]))
          snap.docChanges().forEach(ch => {
            const d = ch.doc.data()
            if (ch.type === 'removed') byId.delete(d.id)
            else byId.set(d.id, d)  // added | modified
          })
          return { ...safe, plants: [...byId.values()] }
        })
        latestPlantIds = new Set(snap.docs.map(d => d.id))
        plantsLoaded = true
        maybeMigrate()
      },
      e => console.warn('[snapshot] plants error:', e)
    )

    return () => { unsubMeta(); unsubPlants() }
  }, [collectionId, viewerToken, runMigrationsOnce])

  // Vienkartinis refresh — pull-to-refresh + viewer polling. Listener'iai
  // jau handle'ina realtime case'us, bet šis backup'as naudingas kai network
  // atsigauna ar user'is force'ina manual refresh.
  const syncFromRemote = useCallback(() => {
    if (isMockMode()) return
    const cid = colIdRef.current
    if (!cid) return

    // Viewer — fetch via server API (jokio Firebase auth'o, tad jokio listener'io).
    // Viewer'iai naudoja /api/viewer polling'ą (Admin SDK) vietoj Firestore
    // client'o, todėl persistence layer'is neegzistuoja. State'as held in
    // memory; nepasaugomas localStorage'e (sesijos lygis tik).
    if (viewerTokenRef.current) {
      fetch(`/api/viewer?token=${encodeURIComponent(viewerTokenRef.current)}`)
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(({ plants, zones }) => {
          setData({ plants: plants ?? [], zinynas: [], zones: zones ?? [], settings: {} })
        })
        .catch(e => console.warn('[viewer] fetch failed:', e))
      return
    }

    // Explicit pull-to-refresh — whole-set iš serverio (vartotojas nori fresh).
    Promise.all([
      getDoc(doc(db, 'collections', cid)),
      getDocs(fsCol(db, 'collections', cid, 'plants')),
    ]).then(([metaSnap, plantsSnap]) => {
      const meta = metaSnap.exists() ? metaSnap.data() : {}
      const byId = new Map(plantsSnap.docs.map(d => [d.id, d.data()]))
      if (meta.plants?.length) meta.plants.forEach(p => { if (p?.id && !byId.has(p.id)) byId.set(p.id, p) })
      setData({ plants: [...byId.values()], zinynas: meta.zinynas ?? [], zones: meta.zones ?? [], settings: meta.settings ?? {} })
    }).catch(e => console.warn('[firestore] load failed:', e))
  }, [])

  // (Pašalintas visibilitychange handler'is — su onSnapshot listener'iais
  // Firebase SDK pats auto-reconnect'ina po network/PWA wake. Manual refresh
  // lieka prieinamas per pull-to-refresh.)

  // Viewer polling — re-sync every 60s
  useEffect(() => {
    if (!viewerToken) return
    const id = setInterval(syncFromRemote, 60_000)
    return () => clearInterval(id)
  }, [viewerToken, syncFromRemote])

  const updatePlant = useCallback((id, patch) => {
    update(prev => ({
      ...prev,
      plants: prev.plants.map(p => p.id === id ? { ...p, ...patch } : p),
    }))
  }, [update])

  // Filtered views
  const plants     = data.plants ?? []
  const dashboard  = plants.filter(p => p.kategorija === 'auginama')
  const wishlist   = plants.filter(p => p.kategorija === 'nori')
  const history    = plants.filter(p => p.kategorija === 'istorija')
  const library    = plants                                          // visi (Dashboard search'ui)
  const archive    = plants.filter(p => p.kategorija !== 'auginama') // Bibliotekai (be aktyvių)
  const zinynas    = data.zinynas  ?? []
  const zones      = data.zones   ?? []
  const settings   = data.settings ?? {}

  // Grąžinam naujai sukurtą plant'ą su id'u — caller (App.jsx) gali iš karto
  // openDetail'inti jį, vietoj rendering'o tuščio Biblioteka/Augalai tab'o,
  // kuris kartais būna stale dėl React render timing'o.
  const addToDashboard = useCallback((aiResult) => {
    const plant = { ...fromAIResult(aiResult), kategorija: 'auginama' }
    console.log('[usePlants] addToDashboard', { id: plant.id, name: plant.lietuviškas, kategorija: plant.kategorija })
    update(prev => {
      const next = { ...prev, plants: [plant, ...prev.plants] }
      console.log('[usePlants] addToDashboard NEXT', { plantCount: next.plants.length, firstId: next.plants[0]?.id })
      return next
    })
    return plant
  }, [update])

  const addToWishlist = useCallback((aiResult) => {
    const plant = { ...fromAIResult(aiResult), kategorija: 'nori' }
    console.log('[usePlants] addToWishlist', { id: plant.id, name: plant.lietuviškas, kategorija: plant.kategorija })
    update(prev => {
      const next = { ...prev, plants: [plant, ...prev.plants] }
      console.log('[usePlants] addToWishlist NEXT', { plantCount: next.plants.length, firstId: next.plants[0]?.id })
      return next
    })
    return plant
  }, [update])

  const markAsDied = useCallback((id, deathReason, lesson) => {
    update(prev => {
      const plant = prev.plants.find(p => p.id === id)
      if (!plant) return prev
      const deathEvent = {
        id: makeId(),
        type: 'death',
        date: today(),
        deathReason: deathReason ?? '',
        lesson: lesson ?? '',
      }
      return {
        ...prev,
        plants: prev.plants.map(p => p.id === id ? {
          ...p,
          kategorija: 'istorija',
          status: 'healthy',
          diedDate: today(),
          deathReason: deathReason ?? '',
          lesson: lesson ?? '',
          timeline: [deathEvent, ...(p.timeline ?? [])],
          // Freeze-on-death: užšaldom rūšinį snapshot'ą (live-resolved) ir
          // atjungiam nuo catalog → istorinis įrašas lieka KOKS BUVO mirties metu.
          ref: snapshotPlantRef(p),
          refFrozen: true,
        } : p),
      }
    })
  }, [update])

  const moveToDashboard = useCallback((id) => {
    updatePlant(id, {
      kategorija: 'auginama',
      data_prideta: today(),
      status: 'healthy',
      timeline: [],
      diedDate: null,
      deathReason: '',
      lesson: '',
      zonaId: null,
      refFrozen: false,   // grąžinus iš istorijos — vėl live catalog resolve
    })
  }, [updatePlant])

  const clearTimeline = useCallback((id) => {
    updatePlant(id, { timeline: [] })
  }, [updatePlant])

  const updateComment = useCallback((id, komentaras) => {
    updatePlant(id, { komentaras })
  }, [updatePlant])

  const updateUzrasai = useCallback((id, uzrasai) => {
    updatePlant(id, { uzrasai })
  }, [updatePlant])

  // 2026-06-01 — refreshPlantFromAIResult pašalintas. Buvo broken F1 world'e
  // (rašė tik į user plant doc, bet catalog overlay'us per resolvePlantView
  // perdengia su catalog reikšmėmis). Single source of truth dabar —
  // reEnrichPlant (PlantDetail) → POST /api/save-plant → pilna server-side
  // Phase 2 pipeline su deriveToxicityFromSourcesServer + Sonnet narrative +
  // Gemini hero regen + catalog write (F1 auto-propagacija į VISUS plants).

  const toggleZinynasStarred = useCallback((id) => {
    update(prev => ({
      ...prev,
      zinynas: (prev.zinynas ?? []).map(e => e.id === id ? { ...e, starred: !e.starred } : e),
    }))
  }, [update])

  // Title field gali būti tuščias — tada UI fallback'inasi į auto-extract'ą iš
  // pirmos eilutės. Vartotojas gali jį override'inti per Žinynas detail pane'ę.
  const updateZinynasTitle = useCallback((id, title) => {
    update(prev => ({
      ...prev,
      zinynas: (prev.zinynas ?? []).map(e =>
        e.id === id ? { ...e, title: title?.trim() || null } : e
      ),
    }))
  }, [update])

  const updateImage = useCallback((id, image, _fromHistory = false, imageThumb = null) => {
    // updateImage = "PRISEGTI konkrečią nuotrauką kaip profilį" (manual pick:
    // galerija / istorija / set-as-profile / fetchAllImages). VISADA pin'ina:
    // 2026-06-02 — useHistoryPhoto:false KONSISTENTIŠKAI (anksčiau istorijos
    //   pick palikdavo auto on → naujesnė augimo foto persirašydavo pasirinkimą).
    //   Capture (camera/upload) eina per addTimelineEvent (NE čia) → auto-follow.
    // 2026-06-02 — imageThumb LOCKSTEP su image (net null → PlantImage rodo
    //   pilną image, niekada stale wrong thumb).
    updatePlant(id, { image, imageThumb, useHistoryPhoto: false })
  }, [updatePlant])

  const updateStatus = useCallback((id, newStatus, meta = {}) => {
    update(prev => {
      const plant = prev.plants.find(p => p.id === id)
      const fromStatus = plant?.status ?? 'healthy'
      if (fromStatus === newStatus) return prev
      const statusEvent = { id: makeId(), type: 'statusChange', date: today(), fromStatus, toStatus: newStatus, ...meta }
      return {
        ...prev,
        plants: prev.plants.map(p => p.id === id
          ? { ...p, status: newStatus, timeline: [statusEvent, ...(p.timeline ?? [])] }
          : p
        ),
      }
    })
  }, [update])

  const deletePlant = useCallback((id) => {
    update(prev => ({ ...prev, plants: prev.plants.filter(p => p.id !== id) }))
  }, [update])

  const addTimelineEvent = useCallback((plantId, event) => {
    // Viewer — only watering is allowed, via server API
    if (viewerTokenRef.current) {
      if (event.type !== 'watering') return
      const token = viewerTokenRef.current
      // Optimistic local update
      setData(prev => ({
        ...prev,
        plants: prev.plants.map(p => p.id !== plantId ? p : { ...p, timeline: [event, ...(p.timeline ?? [])] }),
      }))
      fetch('/api/viewer/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, plantId, event }),
      }).catch(e => console.warn('[viewer/water]', e))
      return
    }
    update(prev => ({
      ...prev,
      plants: prev.plants.map(p => {
        if (p.id !== plantId) return p
        const updated = { ...p, timeline: [event, ...(p.timeline ?? [])] }
        // Auto-set profile photo when useHistoryPhoto is on (default true) or plant has no image yet.
        // 2026-06-01 — dual upload: kartu kopijuojam event.imageUrlThumb į plant.imageThumb
        // (jei event'as turi thumb URL'ą). Dashboard kortelės skaitys plant.imageThumb (mažas
        // file → no resize flash); PlantDetail hero skaitys plant.image.
        if (event.type === 'photo' && event.imageUrl && (p.useHistoryPhoto !== false || !p.image)) {
          updated.image = event.imageUrl
          if (event.imageUrlThumb) updated.imageThumb = event.imageUrlThumb
        }
        return updated
      }),
    }))
  }, [update])

  const updateChat = useCallback((plantId, messages) => {
    updatePlant(plantId, { chat: messages })
  }, [updatePlant])

  const addToZinynas = useCallback((entry) => {
    update(prev => ({
      ...prev,
      zinynas: [{ id: makeId(), date: today(), ...entry }, ...(prev.zinynas ?? [])],
    }))
  }, [update])

  const deleteFromZinynas = useCallback((id) => {
    update(prev => ({
      ...prev,
      zinynas: (prev.zinynas ?? []).filter(e => e.id !== id),
    }))
  }, [update])

  const movePlantToZone = useCallback((plantId, newZoneId) => {
    update(prev => {
      const plant = prev.plants.find(p => p.id === plantId)
      if (!plant) return prev
      if (plant.zonaId === newZoneId) return prev
      const moveEvent = {
        id: makeId(),
        type: 'move',
        date: today(),
        fromZoneId: plant.zonaId ?? null,
        toZoneId: newZoneId ?? null,
      }
      return {
        ...prev,
        plants: prev.plants.map(p =>
          p.id === plantId
            ? { ...p, zonaId: newZoneId ?? null, timeline: [moveEvent, ...(p.timeline ?? [])] }
            : p
        ),
      }
    })
  }, [update])

  const addZone = useCallback((zone) => {
    const id = makeId()
    update(prev => ({
      ...prev,
      zones: [...(prev.zones ?? []), { ...zone, id }],
    }))
    return id
  }, [update])

  const updateZone = useCallback((id, patch) => {
    update(prev => ({
      ...prev,
      zones: (prev.zones ?? []).map(z => z.id === id ? { ...z, ...patch } : z),
    }))
  }, [update])

  const deleteZone = useCallback((id) => {
    update(prev => ({
      ...prev,
      zones: (prev.zones ?? []).filter(z => z.id !== id),
      plants: prev.plants.map(p => p.zonaId === id ? { ...p, zonaId: null } : p),
    }))
  }, [update])

  const reorderZones = useCallback((id, direction) => {
    update(prev => {
      const arr = [...(prev.zones ?? [])]
      const idx = arr.findIndex(z => z.id === id)
      if (idx < 0) return prev
      const swap = direction === 'up' ? idx - 1 : idx + 1
      if (swap < 0 || swap >= arr.length) return prev
      ;[arr[idx], arr[swap]] = [arr[swap], arr[idx]]
      return { ...prev, zones: arr }
    })
  }, [update])

  const updateSettings = useCallback((patch) => {
    update(prev => ({ ...prev, settings: { ...(prev.settings ?? {}), ...patch } }))
  }, [update])

  const deleteTimelineEvent = useCallback((plantId, eventId) => {
    update(prev => ({
      ...prev,
      plants: prev.plants.map(p => {
        if (p.id !== plantId) return p
        const removed  = (p.timeline ?? []).find(e => e.id === eventId)
        const timeline = (p.timeline ?? []).filter(e => e.id !== eventId)
        // Storage cleanup — pašalinam foto failą (fire-and-forget), kad nekauptume
        // šiukšlių. deleteImageByUrl skip'ina external/ne-mūsų URL'us.
        if (removed?.type === 'photo') {
          deleteImageByUrl(removed.imageUrl)
          deleteImageByUrl(removed.imageUrlThumb)
        }
        const next = { ...p, timeline }
        // 2026-06-02 — jei ištrinta foto BUVO dabartinis profilis (plant.image),
        // perskaičiuojam (anksčiau likdavo orphaned image → hero/widget rodė
        // ištrintą foto). Auto → kita naujausia istorijos foto; nėra / pinned →
        // išvalom (grįžta į iliustraciją).
        if (removed?.type === 'photo' && removed.imageUrl === p.image) {
          const newestPhoto = timeline.find(e => e.type === 'photo' && e.imageUrl)
          if (p.useHistoryPhoto !== false && newestPhoto) {
            next.image = newestPhoto.imageUrl
            next.imageThumb = newestPhoto.imageUrlThumb ?? null
          } else {
            next.image = null
            next.imageThumb = null
          }
        }
        return next
      }),
    }))
  }, [update])

  return {
    syncFromRemote,
    dashboard, wishlist, history,
    addToDashboard, addToWishlist,
    markAsDied, moveToDashboard,
    updateComment, updateImage, updateStatus, updatePlant, deletePlant,
    addTimelineEvent, deleteTimelineEvent, clearTimeline, updateChat,
    library, archive,
    zinynas, addToZinynas, deleteFromZinynas, toggleZinynasStarred, updateZinynasTitle,
    updateUzrasai,
    zones, addZone, updateZone, deleteZone, reorderZones, movePlantToZone,
    settings, updateSettings,
  }
}
