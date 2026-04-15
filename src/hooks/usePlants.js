import { useState, useCallback } from 'react'
import initialData from '../data/plants.json'

// v5 – PPFD values added to sviesa
const STORAGE_KEY = 'geliu-db-v5'

function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return initialData
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

// Maps Claude API search result → new plant structure
export function fromAIResult(aiResult) {
  return {
    id: makeId(),
    lotyniskas:  aiResult.latinName ?? '',
    lietuviškas: aiResult.name ?? '',
    emoji:       aiResult.emoji ?? '🌿',
    tipas:       aiResult.tipas ?? '',
    augimo_greitis: aiResult.augimo_greitis ?? '',
    sunkumas:    aiResult.sunkumas ?? 2,
    toksiskas:      aiResult.toksiskas ?? false,
    toksiskumo_info: aiResult.toksiskumo_info ?? '',
    aprasymas:   aiResult.aprasymas ?? aiResult.aiDescription ?? '',
    kilme:       aiResult.kilme ?? aiResult.origin ?? '',
    sviesa: aiResult.sviesa ?? {
      lygis:  aiResult.lightLevel ?? 'vidutinė',
      taskai: aiResult.lightScore ?? 2,
      ...(aiResult.ppfd?.min != null ? { ppfd: { min: aiResult.ppfd.min, max: aiResult.ppfd.max } } : {}),
    },
    vanduo: aiResult.vanduo ?? { lygis: 'vidutiniškai', taskai: 2 },
    laistymasIntervalas: aiResult.laistymasIntervalas ?? (aiResult.watering?.intervalVasara != null ? {
      vasara:  aiResult.watering.intervalVasara,
      ziema:   aiResult.watering.intervalZiema ?? null,
      metodas: aiResult.watering.metodas ?? '',
    } : undefined),
    tresimas: aiResult.tresimas ?? (aiResult.fertilizing?.intervalVasara != null ? {
      intervalVasara: aiResult.fertilizing.intervalVasara,
      intervalZiema:  aiResult.fertilizing.intervalZiema ?? null,
      tipas:          aiResult.fertilizing.tipas ?? '',
    } : undefined),
    dormancyInfo: aiResult.dormancyInfo ?? (aiResult.dormancy?.reikia != null ? {
      reikia: aiResult.dormancy.reikia,
      tipas:  aiResult.dormancy.tipas ?? null,
    } : undefined),
    prieziura: aiResult.prieziura ?? {
      sviesa:     aiResult.care?.light ?? '',
      laistymas:  aiResult.care?.water ?? '',
      temperatura: aiResult.care?.temperature ?? '',
      dregme:     aiResult.care?.humidity ?? '',
    },
    substratas:   aiResult.substratas ?? aiResult.care?.soil ?? '',
    persodinimas: aiResult.persodinimas ?? '',
    ziemojimas:   aiResult.ziemojimas ?? '',
    dauginimas:   aiResult.dauginimas ?? [],
    problemos:    aiResult.problemos ?? [],
    idomybes:     aiResult.idomybes ?? [],
    kategorija:   'auginama',
    komentaras:   '',
    data_prideta: today(),
    image:        aiResult.image ?? null,
    status:       'healthy',
    inatLtName:   aiResult.inatLtName   ?? null,
    sinonimai:    aiResult.sinonimai    ?? [],
    englishNames: aiResult.englishNames ?? [],
  }
}

export function usePlants() {
  const [data, setData] = useState(loadData)

  const update = useCallback((updater) => {
    setData(prev => {
      const next = updater(prev)
      saveData(next)
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
  const zinynas    = data.zinynas ?? []

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
          diedDate: today(),
          deathReason: deathReason ?? '',
          lesson: lesson ?? '',
          timeline: [deathEvent, ...(p.timeline ?? [])],
        } : p),
      }
    })
  }, [update])

  const moveToDashboard = useCallback((id) => {
    updatePlant(id, { kategorija: 'auginama', data_prideta: today() })
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

  const updateImage = useCallback((id, image) => {
    updatePlant(id, { image })
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
      plants: prev.plants.map(p => p.id === plantId
        ? { ...p, timeline: [event, ...(p.timeline ?? [])] }
        : p
      ),
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
    dashboard, wishlist, history,
    addToDashboard, addToWishlist,
    markAsDied, moveToDashboard,
    updateComment, updateImage, updateStatus, updatePlant, deletePlant,
    addTimelineEvent, deleteTimelineEvent, updateChat,
    library, togglePirkinys,
    zinynas, addToZinynas, deleteFromZinynas, toggleZinynasStarred,
    updateUzrasai,
  }
}
