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


export function usePlants(collectionId) {
  const [data, setData] = useState(() => loadLocal(collectionId))

  // Stable refs — leidžia useCallback nepriklausyti nuo collectionId
  const colIdRef = useRef(collectionId)
  useEffect(() => { colIdRef.current = collectionId })

  // Vienkartinė migracija: plants[] iš pagrindinio doc → subkolekcija + katalogas
  const migrateToSubcollection = useCallback(async (cid, plants) => {
    console.log('[migration] plants[] → subcollection, n=', plants.length)
    await Promise.all(plants.map(p =>
      setDoc(doc(db, 'collections', cid, 'plants', p.id), p)
    ))
    // Katalogo užpildymas iš esamų augalų (fire-and-forget, nekartojame jei jau yra)
    plants.forEach(p => { if (p.lotyniskas) saveToCatalog(p).catch(() => {}) })
    // Pašaliname plants[] iš pagrindinio doc (paliekame tik metadata)
    const snap = await getDoc(doc(db, 'collections', cid))
    if (snap.exists()) {
      const { plants: _removed, ...meta } = snap.data()
      await setDoc(doc(db, 'collections', cid), meta)
    }
    console.log('[migration] subcollection migration done')
  }, [])

  // Išsaugo į localStorage + Firestore (fire-and-forget)
  const update = useCallback((updater) => {
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

  // Nuskaito iš Firestore (stabilus — naudoja ref)
  const syncFromRemote = useCallback(() => {
    const cid = colIdRef.current
    if (!cid) return

    Promise.all([
      getDoc(doc(db, 'collections', cid)),
      getDocs(fsCol(db, 'collections', cid, 'plants')),
    ]).then(([metaSnap, plantsSnap]) => {
      const meta   = metaSnap.exists() ? metaSnap.data() : {}
      const plants = plantsSnap.docs.map(d => d.data())

      // Sena struktūra aptikta: plants[] vis dar pagrindiniame doc, subkolekcija tuščia
      if (meta.plants?.length > 0 && plants.length === 0) {
        const legacy = {
          plants:   meta.plants,
          zinynas:  meta.zinynas  ?? [],
          zones:    meta.zones    ?? [],
          settings: meta.settings ?? {},
        }
        setData(legacy)
        try { localStorage.setItem(storageKey(cid), JSON.stringify(legacy)) } catch {}
        migrateToSubcollection(cid, meta.plants).catch(console.error)
        return
      }

      const remote = { plants, zinynas: meta.zinynas ?? [], zones: meta.zones ?? [], settings: meta.settings ?? {} }
      setData(remote)
      try { localStorage.setItem(storageKey(cid), JSON.stringify(remote)) } catch {}
    }).catch(e => console.warn('[firestore] load failed:', e))
  }, [migrateToSubcollection]) // stabilus — naudoja ref viduje

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
