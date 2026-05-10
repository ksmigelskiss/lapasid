import { Sun, Cloud, CloudRain, CloudSnow, Droplets, Wind } from 'lucide-react'

/**
 * WeatherWidget — orų kortelė dešinei panelei.
 *
 * Pure component: priima `weather` objektą iš useWeather hook'o (žr.
 * src/hooks/useWeather.js). Joks data fetch viduje — leidžia reuse'inti
 * mobile dashboard'e ar bet kur kitur su tuo pačiu data shape.
 *
 * Props:
 *   weather — { tempC, conditions, isSunny, humidityPct, uvIndex, windMs,
 *               plantTip, location, fetchedAt } | null (loading)
 */
export default function WeatherWidget({ weather }) {
  // Loading skeleton
  if (!weather) {
    return (
      <div className="bg-white/55 backdrop-blur-xl rounded-2xl shadow-[0_4px_24px_rgba(20,40,30,0.06)] border border-white/40 px-4 py-3.5">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-4 h-4 rounded-full bg-gray-200 animate-pulse" />
          <div className="w-20 h-3.5 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="w-32 h-8 bg-gray-200 rounded animate-pulse mb-1.5" />
        <div className="w-40 h-3 bg-gray-200 rounded animate-pulse" />
      </div>
    )
  }

  const Icon = weather.isSunny ? Sun
    : weather.conditions.toLowerCase().includes('liet') ? CloudRain
    : weather.conditions.toLowerCase().includes('snieg') ? CloudSnow
    : Cloud
  const iconColor = weather.isSunny ? 'text-amber-500' : 'text-sky-500'

  // Dabartinis laikas (HH:MM)
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')

  return (
    <div className="bg-white/55 backdrop-blur-xl rounded-2xl shadow-[0_4px_24px_rgba(20,40,30,0.06)] border border-white/40 px-4 py-3.5 space-y-2.5">
      {/* Header: location + time */}
      <div className="flex items-center justify-between text-[12px]">
        <span className="inline-flex items-center gap-1.5 font-semibold text-gray-700">
          <Icon size={14} className={iconColor} />
          {weather.location}
        </span>
        <span className="text-gray-400">Šiandien · {hh}:{mm}</span>
      </div>

      {/* Big temp + conditions */}
      <div className="flex items-baseline gap-3">
        <span className="text-[28px] font-extrabold text-gray-900 tracking-tight leading-none tabular-nums">
          {weather.tempC > 0 ? '+' : ''}{weather.tempC}°
        </span>
        <span className="text-sm text-gray-700 font-medium leading-tight">{weather.conditions}</span>
      </div>

      {/* Sub-stats */}
      <div className="flex items-center gap-3 text-[11.5px] text-gray-500 font-medium">
        <span className="inline-flex items-center gap-1">
          <Droplets size={11} className="text-sky-400" />{weather.humidityPct}%
        </span>
        <span className="text-gray-300">·</span>
        <span className="inline-flex items-center gap-1">
          <Sun size={11} className="text-amber-400" />UV {weather.uvIndex}
        </span>
        <span className="text-gray-300">·</span>
        <span className="inline-flex items-center gap-1">
          <Wind size={11} className="text-gray-400" />{weather.windMs} m/s
        </span>
      </div>

      {/* Plant tip */}
      {weather.plantTip && (
        <p className="text-[12px] text-sage-700 bg-sage-50 rounded-xl px-3 py-2 leading-snug">
          {weather.plantTip}
        </p>
      )}
    </div>
  )
}
