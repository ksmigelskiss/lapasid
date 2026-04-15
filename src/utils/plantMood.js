import { shouldShowWateringAlert } from './wateringForecast'
import { getFertilizingForecast } from './fertilizingForecast'
import { getDormancyForecast } from './dormancyForecast'

// Priority (highest first):
//  quarantine → sick → sleeping → waking → thirsty → sad → happy

export function getPlantMood(plant) {
  const status = plant.status ?? 'healthy'

  if (status === 'quarantine') return { mood: 'quarantine', label: 'karantinas' }
  if (status === 'sick')       return { mood: 'sick',       label: 'serga' }

  const df = getDormancyForecast(plant)
  if (df?.window === 'active')  return { mood: 'sleeping', label: 'miega' }
  if (df?.window === 'waking')  return { mood: 'waking',   label: 'žadinasi' }

  const fc = getFertilizingForecast(plant)
  if (shouldShowWateringAlert(plant)) return { mood: 'thirsty', label: 'trokšta' }
  if (fc?.isOverdue)                  return { mood: 'sad',     label: 'liūdnas' }

  return { mood: 'happy', label: 'laimingas' }
}

export function getPersonalityKey(plant) {
  const tipas   = (plant.tipas          ?? '').toLowerCase()
  const greitis = (plant.augimo_greitis ?? '').toLowerCase()
  if (tipas.includes('sulting') || tipas.includes('kaudeks')) return 'sultingas'
  if (tipas.includes('papart')  || tipas.includes('epifiti')) return 'papartis'
  if (greitis === 'greitas')                                   return 'greitas'
  return 'default'
}
