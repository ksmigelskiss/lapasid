// Fertilizing forecast utility
// Season: April–September = vasara (active growth), October–March = žiema (dormancy)
//
// Interval resolution priority:
//   1. Same-season history (weighted blend with theoretical by confidence)
//   2. AI-specific interval for current season
//   3. Category default for current season

import { getSeason, getSeasonStart, computeNextDate } from './forecastBase'
export { getSeason, getSeasonStart }

function getCategory(plant) {
  const tipas   = (plant.tipas ?? '').toLowerCase()
  const greitis = (plant.augimo_greitis ?? '').toLowerCase()
  const latin   = (plant.lotyniskas ?? plant.latinName ?? '').toLowerCase()
  // Mėsėdžiai — NETRĘŠTI (saugumui kritiška: trąšos žaloja šaknis). Detektuojam
  // iš tipas arba genties (AI gali nepažymėti tipas'e).
  if (tipas.includes('mėsėd') || tipas.includes('carnivor') ||
      /\b(nepenthes|dionaea|drosera|sarracenia|pinguicula|utricularia|cephalotus|heliamphora)\b/.test(latin))
    return 'mesedis'
  // Orchidėjos — silpna dozė dažniau.
  if (tipas.includes('orchid') || /\b(orchid|phalaenopsis|cattleya|dendrobium|oncidium|paphiopedilum|vanda)\b/.test(latin))
    return 'orchideja'
  if ((tipas.includes('sulting') && !tipas.includes('pusiau')) || tipas.includes('kaudeks')) return 'sultingas'
  if (tipas.includes('papart') || tipas.includes('epifiti')) return 'papartis'
  if (greitis === 'greitas') return 'greitas'
  return 'vidutinis'
}

// intervalDays: null = do not fertilize this season.
// KONSERVATYVŪS intervalai (2026-05-29, patvirtinta): vazonų kultūroje per-feeding
// degina šaknis / kaupia druskas, under-feeding nekenkia → linkstam į ilgesnius.
const INTERVALS = {
  vidutinis: { vasara: 28, žiema: null },  // lapiniai tropiniai, ½ dozės
  greitas:   { vasara: 21, žiema: null },  // heavy feeders / greiti augintojai
  sultingas: { vasara: 45, žiema: null },  // sukulentai/kaktusai/kaudeksiniai
  papartis:  { vasara: 35, žiema: null },  // paparčiai/epifitai
  orchideja: { vasara: 21, žiema: null },  // silpna dozė + praplovimas
  mesedis:   { vasara: null, žiema: null },// NETRĘŠTI
}

export const CATEGORY_LABELS = {
  vidutinis: 'Vidutinis tropinis',
  greitas:   'Greitai augantis',
  sultingas: 'Sultingas / kaudeksinis',
  papartis:  'Papartis / epifitas',
  orchideja: 'Orchidėja',
  mesedis:   'Mėsėdis',
}

export const FERTILIZER_TIPS = {
  vidutinis: 'Universalios skystos trąšos (NPK 15-15-15), ½ dozės',
  greitas:   'Universalios skystos trąšos (NPK 20-20-20), ½–pilna dozė',
  sultingas: 'Kaktusų / sukulentų trąšos (mažai azoto), ¼–½ dozės',
  papartis:  'Skystos trąšos paparčiams arba universalios ¼ dozės',
  orchideja: 'Orchidėjų trąšos, silpna dozė; kartą per mėnesį praplauti šaknis vandeniu',
  mesedis:   'Netręšti — mėsėdžiai maistą gauna iš grobio; trąšos žaloja šaknis',
}

export function getFertilizingForecast(plant) {
  const now      = new Date()
  const season   = getSeason(now)
  const category = getCategory(plant)

  // Tręšimas — KATEGORIJOS lentelė AUTORITETINĖ. AI dieną-skaičiaus (`tresimas`)
  // nebenaudojam — jis būdavo nepagrįstas (RAG neturi tręšimo skaičių → AI
  // haliucinuodavo). Kategorija išvedama iš `tipas`/`augimo_greitis` (AI tai
  // klasifikuoja patikimai). Istorijos blend (žemiau) gali pakoreguoti pagal
  // realią praktiką. tipas tekstas irgi iš FERTILIZER_TIPS → jokio konflikto.
  const theoreticalInterval = INTERVALS[category][season]
  const skipsWinter = INTERVALS[category].žiema === null
  const fertilizerTip = FERTILIZER_TIPS[category]

  const timeline = plant.timeline ?? []
  const fertilizings = [...timeline]
    .filter(e => e.type === 'fertilizing')
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  const lastFertEvent = fertilizings[0] ?? null
  const lastDate = lastFertEvent?.date ?? plant.data_prideta ?? now.toISOString().slice(0, 10)
  const lastType = lastFertEvent ? 'fertilizing' : 'repotting'

  if (!theoreticalInterval) {
    return {
      season, category, lastDate, lastType,
      intervalDays: null, nextDate: null, daysUntil: null,
      isOverdue: false, skipSeason: true,
      fertilizerTip,
    }
  }

  // ── Same-season gap analysis ──────────────────────────────────
  // Only count gaps where BOTH events are in the current season.
  const sameSeasonGaps = []
  for (let i = 0; i < Math.min(fertilizings.length - 1, 5); i++) {
    const a = fertilizings[i].date
    const b = fertilizings[i + 1].date
    if (getSeason(new Date(a)) !== season) continue
    if (getSeason(new Date(b)) !== season) continue
    const gap = Math.round((new Date(a) - new Date(b)) / 86400000)
    if (gap > 0) sameSeasonGaps.push(gap)
  }

  // Filter outlier gaps (> 3× theoretical = likely skipped / forgotten)
  const outlierCap = theoreticalInterval * 3
  const validGaps  = sameSeasonGaps.filter(g => g <= outlierCap)

  // Weighted blend: confidence 0→1 as we accumulate 0→3 same-season gaps
  let resolvedInterval = theoreticalInterval
  if (validGaps.length > 0) {
    const historicalAvg = Math.round(validGaps.reduce((s, g) => s + g, 0) / validGaps.length)
    const confidence    = Math.min(validGaps.length / 3, 1)
    resolvedInterval    = Math.round(historicalAvg * confidence + theoreticalInterval * (1 - confidence))
  }

  const { nextDate, daysUntil, isOverdue } = computeNextDate({
    lastDate, intervalDays: resolvedInterval, skipsWinter, now,
  })

  return {
    season, category, lastDate, lastType,
    intervalDays: resolvedInterval,
    nextDate, daysUntil, isOverdue,
    skipSeason: false,
    fertilizerTip,
  }
}
