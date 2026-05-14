import { useState, useCallback, useEffect, useRef } from 'react'
import { getDoc, getDocs, setDoc, deleteDoc, doc, collection as fsCol, onSnapshot } from 'firebase/firestore'
import { db } from '../utils/firebase'
import { fromAIResult, normalizeSavybes, makeId as _makeId, today as _today } from '../utils/plantTransform'
import { migrate, LEGACY_KEYS } from '../utils/dataMigration'
import { saveToCatalog, catalogDocId } from '../utils/catalog'
import { isMockMode, MOCK_DATA } from '../utils/mockData'

export { fromAIResult }

// localStorage key namespaced by collectionId — keli vartotojai viename įrenginyje
function storageKey(collectionId) {
  return collectionId ? `geliu-db-${collectionId}` : 'geliu-db'
}

// Tombstones — lokaliai ištrintų augalų ID rinkinys. Naudojama kad
// `syncFromRemote` neatgaivintų augalų, kuriuos `deleteDoc` dar nespėjo
// nubrukt į Firestore (pvz. ad-blocker'is blokuoja Write/channel, network
// down, race condition'as su parallel sync'u). Kiekvieno sync'o metu —
// retry deleteDoc, sėkmingai ištrynus — pašalinam iš tombstones.
function tombstoneKey(cid) {
  return cid ? `geliu-db-${cid}-tombs` : null
}
function loadTombstones(cid) {
  const key = tombstoneKey(cid)
  if (!key) return new Set()
  try {
    const raw = localStorage.getItem(key)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}
function saveTombstones(cid, set) {
  const key = tombstoneKey(cid)
  if (!key) return
  try { localStorage.setItem(key, JSON.stringify([...set])) } catch {}
}
function addTombstone(cid, id) {
  const t = loadTombstones(cid)
  t.add(id)
  saveTombstones(cid, t)
}
function removeTombstone(cid, id) {
  const t = loadTombstones(cid)
  if (t.delete(id)) saveTombstones(cid, t)
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
  // Nauji vartotojai gauna tuščią kolekciją — initialData tik legacy fallback
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

  // Išsaugo į localStorage + Firestore (fire-and-forget)
  const update = useCallback((updater) => {
    if (viewerTokenRef.current) return // viewers — no writes via this path
    // Mock mode — atnaujina tik in-memory state, jokių DB rašymų
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

      // localStorage (visada — greitas fallback)
      try { localStorage.setItem(storageKey(colIdRef.current), JSON.stringify(next)) } catch {}

      const cid = colIdRef.current
      if (!cid) return next

      // Plants → subkolekcija (rašome tik pakeistus, pagal reference equality)
      const prevMap = new Map(safe.plants.map(p => [p.id, p]))
      const nextMap = new Map(next.plants.map(p => [p.id, p]))

      for (const [id, plant] of nextMap) {
        if (prevMap.get(id) !== plant) {
          // Re-add'as ID, kuris buvo tombstone'e (kraštinis atvejis) — atstatom
          removeTombstone(cid, id)
          setDoc(doc(db, 'collections', cid, 'plants', id), plant)
            .catch(e => console.warn('[firestore] plant write:', e))
        }
      }
      for (const id of prevMap.keys()) {
        if (!nextMap.has(id)) {
          // Pridedam tombstone'ą PRIEŠ deleteDoc — jei jis fail'ina (ad-blocker
          // blokuoja Write/channel), syncFromRemote neatgaivins augalo iš
          // Firestore'o, ir kitą kartą retry'sim deleteDoc.
          addTombstone(cid, id)
          deleteDoc(doc(db, 'collections', cid, 'plants', id))
            .then(() => removeTombstone(cid, id))
            .catch(e => console.warn('[firestore] plant delete (queued for retry):', e))
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

  // Suliejame `meta` + `subPlants` į lokalų state'ą. Bendras kelias
  // tiek real-time onSnapshot listener'iui (Etapas B), tiek vienkartiniam
  // syncFromRemote (pull-to-refresh / viewer polling).
  const applySnapshot = useCallback((meta, subPlants) => {
    const cid = colIdRef.current
    if (!cid) return

    const safeMeta = meta ?? {}
    const tombs    = loadTombstones(cid)
    const subIds   = new Set(subPlants.map(p => p.id))

    // Tombstone retry — jei serveris vis dar turi įrašą, retry'nam delete.
    // Jei serveris jau švarus — pašalinam tombstone'ą (cleanup).
    for (const id of tombs) {
      if (subIds.has(id)) {
        deleteDoc(doc(db, 'collections', cid, 'plants', id))
          .then(() => removeTombstone(cid, id))
          .catch(() => {}) // bus retry'inta kitą snapshot'ą
      } else {
        removeTombstone(cid, id)
      }
    }

    const liveSub = subPlants.filter(p => !tombs.has(p.id))

    // Suliejame: meta.plants[] (legacy) + subkolekcija. Tombstones'ai
    // jau išfiltruoti iš liveSub.
    const byId = new Map()
    if (safeMeta.plants?.length > 0) {
      safeMeta.plants.forEach(p => { if (!tombs.has(p.id)) byId.set(p.id, p) })
    }
    liveSub.forEach(p => byId.set(p.id, p))

    // Offline-write saugiklis: localStorage gali turėti augalų, kurių
    // setDoc dar nepraėjo į Firestore (network down). Tombstone'ai
    // prideda apsaugą — neatgaivinsim ištrintų. Pridedam tik LOKALIUS
    // augalus, kurių nėra nei byId, nei tombstones'e.
    try {
      const local = JSON.parse(localStorage.getItem(storageKey(cid)) || '{}')
      ;(local.plants ?? []).forEach(p => {
        if (!byId.has(p.id) && !tombs.has(p.id)) byId.set(p.id, p)
      })
    } catch {}

    const plants = [...byId.values()]
    const next   = { plants, zinynas: safeMeta.zinynas ?? [], zones: safeMeta.zones ?? [], settings: safeMeta.settings ?? {} }
    setData(next)
    try { localStorage.setItem(storageKey(cid), JSON.stringify(next)) } catch {}

    // Augalai, kurių dar nėra subkolekcijoje (legacy meta.plants[] arba
    // pending-upload iš local) — push'inam. Tombstones'us jau išfiltravom.
    const missing = plants.filter(p => !subIds.has(p.id))
    if (missing.length > 0) {
      console.log('[sync] pushing', missing.length, 'plants to subcollection')
      missing.forEach(p => {
        setDoc(doc(db, 'collections', cid, 'plants', p.id), p)
          .catch(e => console.warn('[sync] plant push failed:', e))
        if (p.lotyniskas) saveToCatalog(p).catch(() => {})
      })
    }

    // Seną plants[] iš pagrindinio doc trinkame kai visi augalai jau subkolekcijoje.
    // Ref-guard'as — paleidžiam TIK kartą per kolekciją (kitaip onSnapshot'as
    // gali retry'inti tą patį setDoc'ą prieš tą asnnchroninį save'ą praeinant).
    if (
      safeMeta.plants?.length > 0 &&
      missing.length === 0 &&
      !migrationDoneRef.current.has(cid)
    ) {
      migrationDoneRef.current.add(cid)
      const { plants: _, ...cleanMeta } = safeMeta
      setDoc(doc(db, 'collections', cid), cleanMeta)
        .catch(e => {
          console.warn('[sync] cleanup failed:', e)
          migrationDoneRef.current.delete(cid) // retry kitą snapshot'ą
        })
      console.log('[sync] migration complete — plants[] removed from main doc')
    }
  }, [])

  // ── Real-time onSnapshot listener'iai (Etapas B) ─────────────────────
  // Pakeičia polling-based sync'ą — server'is yra single source of truth,
  // UI auto-update'inasi kai pokyčiai įvyksta. Mock'ams ir viewer'iams —
  // skip (viewer'is naudoja /api/viewer polling'ą per syncFromRemote).
  useEffect(() => {
    if (isMockMode() || !collectionId || viewerToken) return
    const cid = collectionId

    let currentMeta      = null
    let currentSubPlants = null
    let metaLoaded       = false
    let plantsLoaded     = false

    // applySnapshot triggerinamas tik kai abu listener'iai bent kartą fire'ino —
    // antraip pirmasis snapshot'as overwrite'intų state'ą be plants/meta dalies.
    const tryApply = () => {
      if (metaLoaded && plantsLoaded) {
        applySnapshot(currentMeta, currentSubPlants)
      }
    }

    const unsubMeta = onSnapshot(
      doc(db, 'collections', cid),
      snap => {
        currentMeta = snap.exists() ? snap.data() : {}
        metaLoaded  = true
        tryApply()
      },
      e => console.warn('[snapshot] meta error:', e)
    )

    const unsubPlants = onSnapshot(
      fsCol(db, 'collections', cid, 'plants'),
      snap => {
        currentSubPlants = snap.docs.map(d => d.data())
        plantsLoaded     = true
        tryApply()
      },
      e => console.warn('[snapshot] plants error:', e)
    )

    return () => {
      unsubMeta()
      unsubPlants()
    }
  }, [collectionId, viewerToken, applySnapshot])

  // Vienkartinis refresh — pull-to-refresh + viewer polling. Listener'iai
  // jau handle'ina realtime case'us, bet šis backup'as naudingas kai network
  // atsigauna ar user'is force'ina manual refresh.
  const syncFromRemote = useCallback(() => {
    if (isMockMode()) return
    const cid = colIdRef.current
    if (!cid) return

    // Viewer — fetch via server API (jokio Firebase auth'o, tad jokio listener'io)
    if (viewerTokenRef.current) {
      fetch(`/api/viewer?token=${encodeURIComponent(viewerTokenRef.current)}`)
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(({ plants, zones }) => {
          const remote = { plants: plants ?? [], zinynas: [], zones: zones ?? [], settings: {} }
          setData(remote)
          try { localStorage.setItem(storageKey(cid), JSON.stringify(remote)) } catch {}
        })
        .catch(e => console.warn('[viewer] fetch failed:', e))
      return
    }

    Promise.all([
      getDoc(doc(db, 'collections', cid)),
      getDocs(fsCol(db, 'collections', cid, 'plants')),
    ]).then(([metaSnap, plantsSnap]) => {
      const meta      = metaSnap.exists() ? metaSnap.data() : {}
      const subPlants = plantsSnap.docs.map(d => d.data())
      applySnapshot(meta, subPlants)
    }).catch(e => console.warn('[firestore] load failed:', e))
  }, [applySnapshot])

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

  const addToDashboard = useCallback((aiResult) => {
    const plant = { ...fromAIResult(aiResult), kategorija: 'auginama' }
    update(prev => ({ ...prev, plants: [plant, ...prev.plants] }))
  }, [update])

  const addToWishlist = useCallback((aiResult) => {
    const plant = { ...fromAIResult(aiResult), kategorija: 'nori' }
    update(prev => ({ ...prev, plants: [plant, ...prev.plants] }))
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

  // „Atnaujinti per AI" — perpildo statinę plant info iš naujausio AI rezultato.
  // Vartotojo daiktai (timeline, image, uzrasai, zonaId, status, kategorija,
  // data_prideta, id, lietuviškas/lotyniskas) išsaugomi. Likę laukai (savybes,
  // aprasymas, kilme, sviesa, vanduo, prieziura, idomybes ir t.t.) perrašomi.
  const refreshPlantFromAIResult = useCallback((id, aiData) => {
    // Whitelist'as laukų, kurie ATEINA iš AI ir perrašo esamus.
    const aiFields = [
      'tipas', 'augimo_greitis', 'sunkumas',
      'toksiskas', 'toksiskumo_info',  // backward compat
      'aprasymas', 'kilme',
      'sviesa', 'vanduo', 'idomybes',
    ]
    const patch = {}
    for (const k of aiFields) {
      if (aiData[k] !== undefined) patch[k] = aiData[k]
    }
    // Savybes — normalizuojam per tą pačią funkciją kaip fromAIResult, kad
    // nesaugotume raw AI struktūros (gali turėti netinkamus enum'us).
    if (aiData.savybes !== undefined) {
      patch.savybes = normalizeSavybes(aiData.savybes, aiData.toksiskas, aiData.toksiskumo_info)
    }
    updatePlant(id, patch)
  }, [updatePlant])

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

  const updateImage = useCallback((id, image, fromHistory = false) => {
    updatePlant(id, { image, ...(fromHistory ? {} : { useHistoryPhoto: false }) })
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
        // Auto-set profile photo when useHistoryPhoto is on (default true) or plant has no image yet
        if (event.type === 'photo' && event.imageUrl && (p.useHistoryPhoto !== false || !p.image)) {
          updated.image = event.imageUrl
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
      plants: prev.plants.map(p => p.id === plantId
        ? { ...p, timeline: (p.timeline ?? []).filter(e => e.id !== eventId) }
        : p
      ),
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
    refreshPlantFromAIResult,
    zones, addZone, updateZone, deleteZone, reorderZones, movePlantToZone,
    settings, updateSettings,
  }
}
