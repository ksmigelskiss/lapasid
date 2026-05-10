// Bucket'inimo logika pagal `daysUntil` (tikslumas vs prognozė).
// Vienas šaltinis tiek single-plant, tiek bulk care reward'ams.
//
// Tonas: NIEKADA „pamiršai" / „vėlavai". Vartotojo atsakomybė riboja
// tik prognozės lyginimui, bet ne kaltinimui — sąlygos galėjo pasikeisti,
// arba inspection event'as patvirtino sąmoningą pauzę.

import { getWateringForecast } from './wateringForecast'

export const BUCKETS = {
  PERFECT: 'perfect',
  EARLY:   'early',
  LATE:    'late',
  WAYLATE: 'waylate',
}

// daysUntil > 0  → liko dienų iki prognozės (anksti)
// daysUntil = 0  → tiksliai šiandien
// daysUntil < 0  → augalas po prognozės (po pauzės)
export function bucketByDays(daysUntil) {
  if (daysUntil == null) return null
  if (Math.abs(daysUntil) <= 1) return BUCKETS.PERFECT
  if (daysUntil >= 2)            return BUCKETS.EARLY
  if (daysUntil >= -5)           return BUCKETS.LATE
  return BUCKETS.WAYLATE
}

// Suskaičiuoja kiek augalų į kurį bucket'ą per masinį veiksmą
export function bucketCounts(items) {
  const counts = { perfect: 0, early: 0, late: 0, waylate: 0 }
  for (const days of items) {
    const b = bucketByDays(days)
    if (b) counts[b]++
  }
  return counts
}

// Bendra rezultato „nuotaika" pagal bucket counts — naudojama bulk antraštei
export function moodFromCounts(counts) {
  const total = counts.perfect + counts.early + counts.late + counts.waylate
  if (total === 0) return 'mixed'
  if (counts.perfect / total >= 0.5) return 'mostlyPerfect'
  if (counts.waylate / total >= 0.5) return 'manyLate'
  return 'mixed'
}

// Confidence aggregate per visus augalus (vidurkis)
export function aggregateConfidence(forecasts) {
  if (!forecasts || forecasts.length === 0) return 0
  const sum = forecasts.reduce((acc, f) => acc + (f?.confidence ?? 0), 0)
  return sum / forecasts.length
}

// Confidence į labelio key (none / low / high)
export function confidenceLabel(conf) {
  if (conf < 0.33) return 'none'
  if (conf < 0.66) return 'low'
  return 'high'
}

// Apskaičiuoja aggregate confidence delta nuo watering veiksmo,
// simuliuojant naują event'ą plant.timeline atminty (be DB).
// Confidence skaičiuoja tik watering events, todėl tik kind='watering'
// realiai prideda. Kitiems return 0.
export function computeWateringDelta(actedPlants, allPlantsCount, eventType, todayIso) {
  if (eventType !== 'watering' || allPlantsCount === 0 || actedPlants.length === 0) return 0
  let sumPlantDelta = 0
  for (const p of actedPlants) {
    const before = getWateringForecast(p).confidence ?? 0
    const simPlant = {
      ...p,
      timeline: [{ id: 'sim', type: 'watering', date: todayIso }, ...(p.timeline ?? [])],
    }
    const after = getWateringForecast(simPlant).confidence ?? 0
    sumPlantDelta += (after - before)
  }
  return sumPlantDelta / allPlantsCount
}
