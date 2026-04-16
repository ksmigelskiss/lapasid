// Watering forecast utility
// Uses plant-specific intervals (from AI) when available,
// otherwise falls back to category-based defaults.

import { getSeason, getSeasonStart } from './fertilizingForecast'

function getCategory(plant) {
  const tipas  = (plant.tipas  ?? '').toLowerCase()
  const greitis = (plant.augimo_greitis ?? '').toLowerCase()
  if ((tipas.includes('sulting') && !tipas.includes('pusiau')) || tipas.includes('kaudeks')) return 'sultingas'
  if (tipas.includes('papart') || tipas.includes('epifiti')) return 'papartis'
  if (greitis === 'greitas') return 'greitas'
  return 'vidutinis'
}

// Default intervals (days) when no plant-specific data available
const DEFAULTS = {
  sultingas: { vasara: 18, žiema: 42 },
  papartis:  { vasara: 5,  žiema: 10 },
  greitas:   { vasara: 7,  žiema: 14 },
  vidutinis: { vasara: 10, žiema: 21 },
}

function addDays(dateStr, days) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function getWateringForecast(plant) {
  const today    = new Date().toISOString().slice(0, 10)
  const now      = new Date()
  const season   = getSeason(now)
  const category = getCategory(plant)

  // Plant-specific intervals take priority
  const specificV = plant.laistymasIntervalas?.vasara
  const specificZ = plant.laistymasIntervalas?.ziema   // null = skip watering
  const hasSpecific = specificV != null

  const intervalDays = hasSpecific
    ? (season === 'vasara' ? specificV : specificZ)
    : DEFAULTS[category][season]

  const skipsWinter = hasSpecific
    ? specificZ === null
    : false   // all plant categories water at least rarely in winter

  const metodas = plant.laistymasIntervalas?.metodas ?? null

  // Watering events sorted newest → oldest
  const timeline = plant.timeline ?? []
  const waterings = [...timeline]
    .filter(e => e.type === 'watering')
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  const lastEvent = waterings[0] ?? null
  const lastDate  = lastEvent?.date ?? plant.data_prideta ?? today
  const lastType  = lastEvent ? 'watering' : 'repotting'

  // Compute actual interval from last 3 events (min 2 gaps needed)
  // Falls back to AI/default interval if not enough history
  let resolvedInterval = intervalDays
  if (waterings.length >= 3) {
    const gaps = []
    for (let i = 0; i < Math.min(waterings.length - 1, 3); i++) {
      const gap = Math.round(
        (new Date(waterings[i].date) - new Date(waterings[i + 1].date)) / 86400000
      )
      if (gap > 0) gaps.push(gap)
    }
    if (gaps.length >= 2) {
      resolvedInterval = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length)
    }
  } else if (waterings.length === 2) {
    const gap = Math.round(
      (new Date(waterings[0].date) - new Date(waterings[1].date)) / 86400000
    )
    if (gap > 0) resolvedInterval = gap
  }

  if (!resolvedInterval) {
    return {
      season, category, lastDate, lastType,
      intervalDays: null, nextDate: null, daysUntil: null,
      isOverdue: false, skipSeason: true, metodas,
    }
  }

  // Season-reset for plants that explicitly skip winter watering
  let baseDate = lastDate
  if (skipsWinter) {
    const seasonStart = getSeasonStart(now)
    if (lastDate < seasonStart) baseDate = seasonStart
  }

  const nextDate  = addDays(baseDate, resolvedInterval)
  const daysUntil = Math.round((new Date(nextDate) - new Date(today)) / 86400000)

  return {
    season, category, lastDate, lastType,
    intervalDays: resolvedInterval,
    nextDate, daysUntil,
    isOverdue: daysUntil < 0,
    skipSeason: false,
    metodas,
  }
}

// Show watering alert only when:
// 1. At least one watering has been recorded (lastType === 'watering')
// 2. Overdue by less than 3x the interval (data is recent enough to be reliable)
export function shouldShowWateringAlert(plant) {
  const wc = getWateringForecast(plant)
  if (!wc.isOverdue) return false
  if (wc.lastType !== 'watering') return false
  if (wc.intervalDays && Math.abs(wc.daysUntil) > wc.intervalDays * 3) return false
  return true
}
