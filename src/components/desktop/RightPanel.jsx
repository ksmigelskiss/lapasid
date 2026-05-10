import { Leaf } from 'lucide-react'
import { useDetailHost } from '../../contexts/DetailHostContext'
import { useWeather } from '../../hooks/useWeather'
import { aggregateCareWeek } from '../../utils/careWeekStats'
import WeatherWidget from '../widgets/WeatherWidget'
import CareChartWidget from '../widgets/CareChartWidget'
import ShopWidget from '../widgets/ShopWidget'

/**
 * RightPanel — desktop split layout dešinė panelė (430px fixed).
 *
 * Dvi būsenos:
 *  - default: brand center + 3 widget'ai (Weather viršuj, Chart + Shop apačioj).
 *    Brand'as lieka matomas, widget'ai uždedami kortelėmis ant cream/leaf bg.
 *  - portal target: modal'ai (PlantDetail, CareWateringSheet, ...) per createPortal
 *    į `<div ref=...>` (žr. DetailHostContext)
 *
 * Props:
 *   plantsForChart — augalų sąrašas iš App (perduodamas dashboard ar library);
 *                    naudojamas šios savaitės care chart'ui agreguoti
 *   onAddToWishlist — (offer) => void; ShopWidget CTA. Jei neperduotas, CTA
 *                    paslepiamas
 */
export default function RightPanel({ plantsForChart = [], onAddToWishlist }) {
  const host = useDetailHost()
  const isActive = host?.isActive ?? false

  // Weather — hook (cache'inasi 30min sessionStorage'e). Loading fall-through
  // į WeatherWidget skeleton state.
  const weather = useWeather()
  // Care chart agreguojam tik default state'e (nereikalingos compute resources
  // kai widget'ai paslėpti)
  const weekData = isActive ? [] : aggregateCareWeek(plantsForChart)

  return (
    <aside className="w-[430px] flex-shrink-0 border-l border-gray-200 bg-app-warm relative overflow-hidden flex flex-col">
      {/* Default brand state — paslepti kai modal'as atidarytas */}
      {!isActive && (
        <>
          {/* Subtle leaf decor — designer'io stilius, sage-100 colored, partial off-canvas */}
          <svg
            className="absolute -top-5 -right-8 w-44 h-44 text-sage-100 pointer-events-none"
            viewBox="0 0 200 200"
            fill="currentColor"
          >
            <path d="M40 160 C 40 60, 100 30, 180 20 C 170 100, 130 160, 40 160 Z" />
          </svg>
          <svg
            className="absolute -bottom-10 -left-8 w-40 h-40 text-sage-100 pointer-events-none"
            viewBox="0 0 200 200"
            fill="currentColor"
          >
            <path d="M180 40 C 180 140, 120 170, 40 180 C 50 100, 90 40, 180 40 Z" />
          </svg>

          {/* Sandwich layout: Weather → Brand center → Chart → Shop.
              Scroll'inasi jei viewport per žemas (1080+ telpa be scroll'o). */}
          <div className="flex-1 flex flex-col gap-3 px-4 py-4 overflow-y-auto scrollbar-none relative z-10">
            <WeatherWidget weather={weather} />

            {/* Brand center — neutral spacer, leaf bg shines through */}
            <div className="flex flex-col items-center justify-center gap-2 py-6 flex-shrink-0">
              <div className="w-14 h-14 rounded-2xl bg-sage-500 flex items-center justify-center shadow-md">
                <Leaf size={28} className="text-white" />
              </div>
              <h2 className="text-xl font-extrabold text-sage-700 tracking-tight">LapasID</h2>
              <p className="text-xs text-sage-600">tavo augalų dienoraštis</p>
            </div>

            <CareChartWidget weekData={weekData} />
            <ShopWidget onAddToWishlist={onAddToWishlist} />
          </div>
        </>
      )}

      {/* Portal target — modal'ai per createPortal render'inasi į šią vietą.
          Pilnas panelės plotas (absolute inset-0). Pointer-events:none kai
          neaktyvus, kad praleistų klick'us per default brand layer. */}
      <div
        ref={(node) => host?.setContainer(node)}
        className="absolute inset-0 z-20"
        style={{ pointerEvents: isActive ? 'auto' : 'none' }}
      />
    </aside>
  )
}
