import { useState, useEffect } from 'react'

// Vilniaus koordinatės. Galima parametrizuoti, jei vėliau prireiks kitų miestų.
const VILNIUS = { lat: 54.6872, lon: 25.2797, name: 'Vilnius' }

// Open-Meteo WMO weather code → LT human-readable string + ar saulėta.
// Spec: https://open-meteo.com/en/docs (weather_code section)
function describeWeatherCode(code) {
  if (code === 0)              return { text: 'Saulėta', sunny: true }
  if (code <= 2)               return { text: 'Beveik giedra', sunny: true }
  if (code === 3)              return { text: 'Debesuota', sunny: false }
  if (code >= 45 && code <= 48) return { text: 'Rūkas', sunny: false }
  if (code >= 51 && code <= 57) return { text: 'Dulksna', sunny: false }
  if (code >= 61 && code <= 67) return { text: 'Lietus', sunny: false }
  if (code >= 71 && code <= 77) return { text: 'Sniegas', sunny: false }
  if (code >= 80 && code <= 82) return { text: 'Lietūs', sunny: false }
  if (code >= 85 && code <= 86) return { text: 'Sniego liūtys', sunny: false }
  if (code >= 95 && code <= 99) return { text: 'Audra', sunny: false }
  return { text: '—', sunny: false }
}

// Augalų patarimas pagal orų sąlygas — paprasta euristika.
function buildPlantTip({ tempC, humidityPct, isSunny }) {
  if (tempC == null) return null
  if (tempC >= 26)              return 'Karšta — augalams reikės daugiau drėgmės. Patikrink lapus.'
  if (tempC >= 22 && humidityPct < 45) return 'Šilta ir sausa — purkšk lapus, drėkink orą.'
  if (tempC <= 5)               return 'Šalta — neperšaldyk augalų prie lango.'
  if (humidityPct < 35)         return 'Sausas oras — augalams reikia papildomo drėgmės.'
  if (isSunny && tempC >= 18)   return 'Šilta saulėta diena — naudinga gryno oro skyriams atviram lange.'
  return 'Komfortabilios sąlygos — augalai turėtų jaustis gerai.'
}

/**
 * useWeather — fetchina Vilniaus orą iš Open-Meteo (free, be API key).
 * Grąžina null kol kraunasi arba jei klaida; kitu atveju { tempC, conditions,
 * humidityPct, uvIndex, windMs, plantTip, location, fetchedAt }.
 *
 * Cache'inasi sessionStorage'e 30min, kad neapkrautume API per page reload'us.
 */
export function useWeather() {
  const [weather, setWeather] = useState(() => {
    try {
      const cached = sessionStorage.getItem('lapasid:weather')
      if (cached) {
        const { data, ts } = JSON.parse(cached)
        if (Date.now() - ts < 30 * 60 * 1000) return data
      }
    } catch {}
    return null
  })

  useEffect(() => {
    if (weather) return // cache'as galioja, neperkrauti
    let cancelled = false
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${VILNIUS.lat}&longitude=${VILNIUS.lon}` +
      `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,uv_index&timezone=auto`
    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const c = data?.current
        if (!c) return
        const desc = describeWeatherCode(c.weather_code)
        const result = {
          tempC: Math.round(c.temperature_2m),
          conditions: desc.text,
          isSunny: desc.sunny,
          humidityPct: Math.round(c.relative_humidity_2m),
          uvIndex: Math.round(c.uv_index ?? 0),
          windMs: Math.round(c.wind_speed_10m),
          plantTip: buildPlantTip({
            tempC: c.temperature_2m,
            humidityPct: c.relative_humidity_2m,
            isSunny: desc.sunny,
          }),
          location: VILNIUS.name,
          fetchedAt: new Date().toISOString(),
        }
        setWeather(result)
        try {
          sessionStorage.setItem('lapasid:weather', JSON.stringify({ data: result, ts: Date.now() }))
        } catch {}
      })
      .catch(() => { /* tylus fail — UI parodo loading state */ })
    return () => { cancelled = true }
  }, []) // mount-only

  return weather
}
