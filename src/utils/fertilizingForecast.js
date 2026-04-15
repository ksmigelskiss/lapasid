// Fertilizing forecast utility
// Season: April–September = vasara (active growth), October–March = žiema (dormancy)

export function getSeason(date = new Date()) {
  const m = date.getMonth() + 1
  return m >= 4 && m <= 9 ? 'vasara' : 'žiema'
}

// Returns the ISO date string of the current season's start
export function getSeasonStart(date = new Date()) {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  if (m >= 4 && m <= 9) return `${y}-04-01`           // vasara: April 1
  if (m >= 10)          return `${y}-10-01`           // žiema: Oct 1 this year
  return `${y - 1}-10-01`                             // žiema: Oct 1 last year (Jan–Mar)
}

function getCategory(plant) {
  const tipas = (plant.tipas ?? '').toLowerCase()
  const greitis = (plant.augimo_greitis ?? '').toLowerCase()
  // Full succulents and caudex — no winter fertilizing
  if ((tipas.includes('sulting') && !tipas.includes('pusiau')) || tipas.includes('kaudeks')) return 'sultingas'
  // Ferns (including epiphytic) — no winter fertilizing
  if (tipas.includes('papart') || tipas.includes('epifiti')) return 'papartis'
  // Fast growers
  if (greitis === 'greitas') return 'greitas'
  // Default: semi-succulents, standard tropicals, etc.
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

function addDays(dateStr, days) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function getFertilizingForecast(plant) {
  const today    = new Date().toISOString().slice(0, 10)
  const now      = new Date()
  const season   = getSeason(now)
  const category = getCategory(plant)

  // Use plant-specific intervals when available (from AI structured data),
  // otherwise fall back to category-based defaults.
  const specificV = plant.tresimas?.intervalVasara
  const specificZ = plant.tresimas?.intervalZiema  // may be null = skip
  const hasSpecific = specificV != null

  const intervalDays = hasSpecific
    ? (season === 'vasara' ? specificV : specificZ)
    : INTERVALS[category][season]

  const skipsWinter = hasSpecific
    ? specificZ === null
    : INTERVALS[category].žiema === null

  const fertilizerTip = plant.tresimas?.tipas || FERTILIZER_TIPS[category]

  // Most recent fertilizing event in timeline
  const timeline = plant.timeline ?? []
  const lastFertEvent = [...timeline]
    .filter(e => e.type === 'fertilizing')
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0]

  // Fall back to plant add date — treated as repotting baseline
  const lastDate = lastFertEvent?.date ?? plant.data_prideta ?? today
  const lastType = lastFertEvent ? 'fertilizing' : 'repotting'

  // Winter: no fertilizing needed
  if (!intervalDays) {
    return {
      season, category, lastDate, lastType,
      intervalDays: null, nextDate: null, daysUntil: null,
      isOverdue: false, skipSeason: true,
      fertilizerTip,
    }
  }

  // For plants that skip winter: reset baseline to season start to avoid
  // false "overdue" when summer begins after a correctly skipped winter.
  let baseDate = lastDate
  if (skipsWinter) {
    const seasonStart = getSeasonStart(now)
    if (lastDate < seasonStart) baseDate = seasonStart
  }

  const nextDate  = addDays(baseDate, intervalDays)
  const daysUntil = Math.round((new Date(nextDate) - new Date(today)) / 86400000)

  return {
    season, category, lastDate, lastType,
    intervalDays, nextDate, daysUntil,
    isOverdue: daysUntil < 0,
    skipSeason: false,
    fertilizerTip,
  }
}
