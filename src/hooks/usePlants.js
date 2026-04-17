import { useState, useCallback, useEffect } from 'react'
import { getDoc, setDoc } from 'firebase/firestore'
import { DATA_DOC, authReady } from '../utils/firebase'
import initialData from '../data/plants.json'
import { fromAIResult, makeId as _makeId, today as _today } from '../utils/plantTransform'

export { fromAIResult }

// v5 – PPFD values added to sviesa
const STORAGE_KEY = 'geliu-db-v5'

function loadLocal() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return initialData
}

function saveLocal(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

// Write to Firestore — waits for auth, fire and forget, never blocks UI
function saveRemote(data) {
  authReady.then(() => setDoc(DATA_DOC, data))
    .catch(e => console.warn('[firestore] save failed:', e))
}

const makeId = _makeId
const today  = _today


export function usePlants() {
  const [data, setData] = useState(loadLocal)

  // Fetch from Firestore and update state
  const syncFromRemote = useCallback(() => {
    authReady.then(() => getDoc(DATA_DOC)).then(snap => {
      if (snap.exists()) {
        const remote = snap.data()
        setData(remote)
        saveLocal(remote)
      } else {
        saveRemote(loadLocal())
      }
    }).catch(e => console.warn('[firestore] load failed:', e))
  }, [])

  // On mount: initial sync
  useEffect(() => { syncFromRemote() }, [syncFromRemote])

  // On visibility change: re-sync when app returns from background (iOS PWA)
  useEffect(() => {
    let hiddenAt = null
    const handle = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
      } else if (document.visibilityState === 'visible') {
        const away = hiddenAt ? Date.now() - hiddenAt : Infinity
        hiddenAt = null
        if (away > 60_000) syncFromRemote() // re-sync if away > 60s
      }
    }
    document.addEventListener('visibilitychange', handle)
    return () => document.removeEventListener('visibilitychange', handle)
  }, [syncFromRemote])

  const update = useCallback((updater) => {
    setData(prev => {
      const next = updater(prev)
      saveLocal(next)
      saveRemote(next)
      return next
    })
  }, [])

  const updatePlant = useCallback((id, patch) => {
    update(prev => ({
      ...prev,
      plants: prev.plants.map(p => p.id === id ? { ...p, ...patch } : p),
    }))
  }, [update])

  // Filtered views
  const dashboard  = data.plants.filter(p => p.kategorija === 'auginama')
  const wishlist   = data.plants.filter(p => p.kategorija === 'nori')
  const history    = data.plants.filter(p => p.kategorija === 'istorija')
  const library    = data.plants
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
