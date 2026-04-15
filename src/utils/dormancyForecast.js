// Dormancy (žiemos miegas) forecast utility
// Dormancy window: October 1 – March 31
// Approaching warning: August 1 – September 30
// Wake-up reminder: April 1 – April 30

function hasDormancy(plant) {
  // Prefer AI-structured data when available
  if (plant.dormancyInfo?.reikia != null) return plant.dormancyInfo.reikia
  // Fallback: parse ziemojimas text
  const z = (plant.ziemojimas ?? '').toLowerCase()
  if (!z || z.includes('nėra ramybės')) return false
  return z.includes('ramybės periodas')
}

function getDormancyType(plant) {
  // Prefer AI-structured data when available
  if (plant.dormancyInfo?.tipas) return plant.dormancyInfo.tipas
  // Fallback: parse ziemojimas text
  const z = (plant.ziemojimas ?? '').toLowerCase()
  if (z.includes('pilnas') || z.includes('nelaistyti') || z.includes('gumbus')) return 'full'
  return 'partial'
}

// Returns: 'approaching' | 'active' | 'waking' | null
function getDormancyWindow() {
  const now = new Date()
  const m = now.getMonth() + 1
  const d = now.getDate()
  if (m === 8 || m === 9)          return 'approaching'
  if (m >= 10 || m <= 3)           return 'active'
  if (m === 4)                      return 'waking'
  return null
}

function daysUntilOct1() {
  const now = new Date()
  const oct = new Date(now.getFullYear(), 9, 1)
  return Math.round((oct - now) / 86400000)
}

const DORMANCY_ACTIONS = {
  full: {
    approaching: 'Palaipsniui mažinkite laistymą ir tręšimą. Paruoškite vėsesnę (10–15 °C) vietą.',
    active:      'Visiškai nelaistyti arba labai retai. Laikyti vėsioje, sausoje vietoje.',
    waking:      'Palaipsniui pradėkite laistyti, perkelkite į šviesą ir šilumą. Tręšimą pradėkite po 2–3 savaičių.',
  },
  partial: {
    approaching: 'Pradėkite mažinti laistymą ir tręšimą. Paruoškite vėsesnę (16–18 °C) vietą.',
    active:      'Laistyti retai (kas 4–6 sav.). Temperatūra 16–18 °C. Netręšti.',
    waking:      'Didinkite laistymą ir pradėkite tręšti. Perkelkite į šviesesnę vietą.',
  },
}

export function getDormancyForecast(plant) {
  if (!hasDormancy(plant)) return null
  const window = getDormancyWindow()
  if (!window) return null

  const type = getDormancyType(plant)
  const actions = DORMANCY_ACTIONS[type] ?? DORMANCY_ACTIONS.partial
  return {
    window,                                    // 'approaching' | 'active' | 'waking'
    type,                                      // 'full' | 'partial'
    action: actions[window],
    ziemojimas: plant.ziemojimas,
    daysUntilDormancy: window === 'approaching' ? daysUntilOct1() : null,
  }
}
