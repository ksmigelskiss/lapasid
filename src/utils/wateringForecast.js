// Watering forecast utility
// Uses plant-specific intervals (from AI) when available,
// otherwise falls back to category-based defaults.
//
// Interval resolution priority:
//   1. Same-season history (weighted blend with theoretical by confidence)
//   2. AI-specific interval for current season
//   3. Category default for current season

import { getSeason, getSeasonStart, computeNextDate } from './forecastBase'

function getCategory(plant) {
  const tipas   = (plant.tipas ?? '').toLowerCase()
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

export function getWateringForecast(plant) {
  const now      = new Date()
  const season   = getSeason(now)
  const category = getCategory(plant)

  const specificV   = plant.laistymasIntervalas?.vasara
  const specificZ   = plant.laistymasIntervalas?.ziema   // null = skip watering
  const hasSpecific = specificV != null

  // Theoretical interval for current season (AI or default)
  const theoreticalInterval = hasSpecific
    ? (season === 'vasara' ? specificV : specificZ)
    : DEFAULTS[category][season]

  const skipsWinter = hasSpecific ? specificZ === null : false
  const metodas     = plant.laistymasIntervalas?.metodas ?? null

  const timeline  = plant.timeline ?? []
  const waterings = [...timeline]
    .filter(e => e.type === 'watering')
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  const lastEvent = waterings[0] ?? null
  const lastDate  = lastEvent?.date ?? plant.data_prideta ?? now.toISOString().slice(0, 10)
  const lastType  = lastEvent ? 'watering' : 'repotting'

  // ── Same-season gap analysis ──────────────────────────────────
  // Only count gaps where BOTH events are in the current season.
  // Cross-season gaps (e.g. Sep→Nov) are ambiguous and discarded.
  const sameSeasonGaps = []
  for (let i = 0; i < Math.min(waterings.length - 1, 5); i++) {
    const a = waterings[i].date
    const b = waterings[i + 1].date
    if (getSeason(new Date(a)) !== season) continue
    if (getSeason(new Date(b)) !== season) continue
    const gap = Math.round((new Date(a) - new Date(b)) / 86400000)
    if (gap > 0) sameSeasonGaps.push(gap)
  }

  // Filter outlier gaps (> 3× theoretical = likely vacation / forgotten)
  const outlierCap = theoreticalInterval ? theoreticalInterval * 3 : Infinity
  const validGaps  = sameSeasonGaps.filter(g => g <= outlierCap)

  // Weighted blend: confidence 0→1 as we accumulate 0→3 same-season gaps
  let resolvedInterval = theoreticalInterval
  if (validGaps.length > 0) {
    const historicalAvg = Math.round(validGaps.reduce((s, g) => s + g, 0) / validGaps.length)
    const confidence    = Math.min(validGaps.length / 3, 1)
    resolvedInterval    = Math.round(historicalAvg * confidence + theoreticalInterval * (1 - confidence))
  }

  if (!resolvedInterval) {
    return {
      season, category, lastDate, lastType,
      intervalDays: null, nextDate: null, daysUntil: null,
      isOverdue: false, skipSeason: true, metodas,
    }
  }

  const { nextDate, daysUntil, isOverdue } = computeNextDate({
    lastDate, intervalDays: resolvedInterval, skipsWinter, now,
  })

  return {
    season, category, lastDate, lastType,
    intervalDays: resolvedInterval,
    nextDate, daysUntil, isOverdue,
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
