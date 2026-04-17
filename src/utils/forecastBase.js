// Shared base for watering, fertilizing, and dormancy forecasts

/** April–September = vasara (active growth), October–March = žiema */
export function getSeason(date = new Date()) {
  const m = date.getMonth() + 1
  return m >= 4 && m <= 9 ? 'vasara' : 'žiema'
}

/** ISO date string of the current season's start */
export function getSeasonStart(date = new Date()) {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  if (m >= 4 && m <= 9) return `${y}-04-01`
  if (m >= 10)          return `${y}-10-01`
  return `${y - 1}-10-01`
}

/** Add N days to an ISO date string, returns ISO date string */
export function addDays(dateStr, days) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Core interval forecast calculation.
 * Given a last-event date, interval and optional winter-skip flag,
 * returns { nextDate, daysUntil, isOverdue }.
 */
export function computeNextDate({ lastDate, intervalDays, skipsWinter = false, now = new Date() }) {
  const today = now.toISOString().slice(0, 10)
  let baseDate = lastDate

  if (skipsWinter) {
    const seasonStart = getSeasonStart(now)
    if (lastDate < seasonStart) baseDate = seasonStart
  }

  const nextDate  = addDays(baseDate, intervalDays)
  const daysUntil = Math.round((new Date(nextDate) - new Date(today)) / 86400000)

  return { nextDate, daysUntil, isOverdue: daysUntil < 0 }
}
