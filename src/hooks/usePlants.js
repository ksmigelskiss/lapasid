import { useState, useCallback, useEffect, useRef } from 'react'
import { getDoc, getDocs, setDoc, deleteDoc, doc, collection as fsCol } from 'firebase/firestore'
import { db } from '../utils/firebase'
import { fromAIResult, makeId as _makeId, today as _today } from '../utils/plantTransform'
import { migrate, LEGACY_KEYS } from '../utils/dataMigration'
import { saveToCatalog, catalogDocId } from '../utils/catalog'

export { fromAIResult }

// localStorage key namespaced by collectionId — keli vartotojai viename įrenginyje
function storageKey(collectionId) {
  return collectionId ? `geliu-db-${collectionId}` : 'geliu-db'
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
  const [data, setData] = useState(() => loadLocal(collectionId))

  // Stable refs — leidžia useCallback nepriklausyti nuo collectionId
  const colIdRef = useRef(collectionId)
  useEffect(() => { colIdRef.current = collectionId })

  const viewerTokenRef = useRef(viewerToken)
  useEffect(() => { viewerTokenRef.current = viewerToken })

  // Išsaugo į localStorage + Firestore (fire-and-forget)
  const update = useCallback((updater) => {
    if (viewerTokenRef.current) return // viewers — no writes via this path
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
          setDoc(doc(db, 'collections', cid, 'plants', id), plant)
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

  // Nuskaito iš Firestore — sulieja visus šaltinius (stabilus — naudoja ref)
  const syncFromRemote = useCallback(() => {
    const cid = colIdRef.current
    if (!cid) return

    // Viewer — fetch via server API
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

      // Suliejame visus šaltinius į vieną Map (subkolekcija turi aukščiausią prioritetą)
      const byId = new Map()
      if (meta.plants?.length > 0) meta.plants.forEach(p => byId.set(p.id, p)) // senas formatas
      subPlants.forEach(p => byId.set(p.id, p))                                  // subkolekcija

      // Saugiklis: localStorage gali turėti augalų dar nesinchronizuotų su Firestore
      try {
        const local = JSON.parse(localStorage.getItem(storageKey(cid)) || '{}')
        if ((local.plants?.length ?? 0) > byId.size) {
          local.plants.forEach(p => { if (!byId.has(p.id)) byId.set(p.id, p) })
        }
      } catch {}

      const plants = [...byId.values()]
      const remote = { plants, zinynas: meta.zinynas ?? [], zones: meta.zones ?? [], settings: meta.settings ?? {} }
      setData(remote)
      try { localStorage.setItem(storageKey(cid), JSON.stringify(remote)) } catch {}

      // Augalai, kurių dar nėra subkolekcijoje — įrašome
      const subIds = new Set(subPlants.map(p => p.id))
      const missing = plants.filter(p => !subIds.has(p.id))
      if (missing.length > 0) {
        console.log('[sync] pushing', missing.length, 'plants to subcollection')
        missing.forEach(p => {
          setDoc(doc(db, 'collections', cid, 'plants', p.id), p)
            .catch(e => console.warn('[sync] plant push failed:', e))
          if (p.lotyniskas) saveToCatalog(p).catch(() => {})
        })
      }

      // Seną plants[] iš pagrindinio doc trinkame kai visi augalai jau subkolekcijoje
      if (meta.plants?.length > 0 && missing.length === 0) {
        const { plants: _, ...cleanMeta } = meta
        setDoc(doc(db, 'collections', cid), cleanMeta)
          .catch(e => console.warn('[sync] cleanup failed:', e))
        console.log('[sync] migration complete — plants[] removed from main doc')
      }
    }).catch(e => console.warn('[firestore] load failed:', e))
  }, []) // stabilus — naudoja ref viduje

  // Sinchronizacija kai collectionId tampa prieinamas (po auth) arba pasikeičia
  const prevColId = useRef(null)
  useEffect(() => {
    if (collectionId && collectionId !== prevColId.current) {
      prevColId.current = collectionId
      syncFromRemote()
    }
  }, [collectionId, syncFromRemote])

  // Grįžus iš fono — re-sync jei praėjo > 60s (iOS PWA)
  useEffect(() => {
    let hiddenAt = null
    const handle = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
      } else if (document.visibilityState === 'visible') {
        const away = hiddenAt ? Date.now() - hiddenAt : Infinity
        hiddenAt = null
        if (away > 60_000) syncFromRemote()
      }
    }
    document.addEventListener('visibilitychange', handle)
    return () => document.removeEventListener('visibilitychange', handle)
  }, [syncFromRemote])

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
  const library    = plants
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
      pirkinys: false,
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

  const toggleZinynasStarred = useCallback((id) => {
    update(prev => ({
      ...prev,
      zinynas: (prev.zinynas ?? []).map(e => e.id === id ? { ...e, starred: !e.starred } : e),
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

  const togglePirkinys = useCallback((id) => {
    update(prev => ({
      ...prev,
      plants: prev.plants.map(p => p.id === id ? { ...p, pirkinys: !p.pirkinys } : p),
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
    library, togglePirkinys,
    zinynas, addToZinynas, deleteFromZinynas, toggleZinynasStarred,
    updateUzrasai,
    zones, addZone, updateZone, deleteZone, reorderZones, movePlantToZone,
    settings, updateSettings,
  }
}
