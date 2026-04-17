// Fertilizing forecast utility
// Season: April–September = vasara (active growth), October–March = žiema (dormancy)

import { getSeason, getSeasonStart, computeNextDate } from './forecastBase'
export { getSeason, getSeasonStart }

function getCategory(plant) {
  const tipas   = (plant.tipas ?? '').toLowerCase()
  const greitis = (plant.augimo_greitis ?? '').toLowerCase()
  if ((tipas.includes('sulting') && !tipas.includes('pusiau')) || tipas.includes('kaudeks')) return 'sultingas'
  if (tipas.includes('papart') || tipas.includes('epifiti')) return 'papartis'
  if (greitis === 'greitas') return 'greitas'
  return 'vidutinis'
}

// intervalDays: null = do not fertilize this season
const INTERVALS = {
  sultingas: { vasara: 28, žiema: null },
  papartis:  { vasara: 28, žiema: null },
  greitas:   { vasara: 14, žiema: 42  },
  vidutinis: { vasara: 21, žiema: 56  },
}

export const CATEGORY_LABELS = {
  sultingas: 'Sultingas / kaudeksinis',
  papartis:  'Papartis / epifitas',
  greitas:   'Greitai augantis',
  vidutinis: 'Vidutinis tropinis',
}

export const FERTILIZER_TIPS = {
  sultingas: 'Kaktusų / sukulentų trąšos (mažai azoto), ½ dozės',
  papartis:  'Skystos trąšos paparčiams arba universalios ¼ dozės',
  greitas:   'Universalios skystos trąšos (NPK 20-20-20), pilna dozė',
  vidutinis: 'Universalios skystos trąšos (NPK 15-15-15), ½–1 dozė',
}

export function getFertilizingForecast(plant) {
  const now      = new Date()
  const season   = getSeason(now)
  const category = getCategory(plant)

  const specificV   = plant.tresimas?.intervalVasara
  const specificZ   = plant.tresimas?.intervalZiema  // may be null = skip
  const hasSpecific = specificV != null

  const intervalDays = hasSpecific
    ? (season === 'vasara' ? specificV : specificZ)
    : INTERVALS[category][season]

  const skipsWinter = hasSpecific
    ? specificZ === null
    : INTERVALS[category].žiema === null

  const fertilizerTip = plant.tresimas?.tipas || FERTILIZER_TIPS[category]

  const timeline = plant.timeline ?? []
  const lastFertEvent = [...timeline]
    .filter(e => e.type === 'fertilizing')
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0]

  const lastDate = lastFertEvent?.date ?? plant.data_prideta ?? now.toISOString().slice(0, 10)
  const lastType = lastFertEvent ? 'fertilizing' : 'repotting'

  if (!intervalDays) {
    return {
      season, category, lastDate, lastType,
      intervalDays: null, nextDate: null, daysUntil: null,
      isOverdue: false, skipSeason: true,
      fertilizerTip,
    }
  }

  const { nextDate, daysUntil, isOverdue } = computeNextDate({ lastDate, intervalDays, skipsWinter, now })

  return {
    season, category, lastDate, lastType,
    intervalDays, nextDate, daysUntil, isOverdue,
    skipSeason: false,
    fertilizerTip,
  }
}
