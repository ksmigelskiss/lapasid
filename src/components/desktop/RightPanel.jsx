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
 * Brand'as (logo + LapasID + tag) yra ABSOLUTE pozicija, centre, kaip
 * background image. Widget'ai sklendžia virš jo — jie permatomi (frosted
 * glass) tad brand'as „prasimato" pro juos.
 */
export default function RightPanel({ plantsForChart = [], onAddToWishlist, onBuy }) {
  const host = useDetailHost()
  const isActive = host?.isActive ?? false
  const weather = useWeather()
  const weekData = isActive ? [] : aggregateCareWeek(plantsForChart)

  return (
    <aside className="w-[430px] flex-shrink-0 border-l border-gray-200 bg-app-warm relative overflow-hidden flex flex-col">
      {!isActive && (
        <>
          {/* Leaf decor */}
          <svg className="absolute -top-5 -right-8 w-44 h-44 text-sage-100 pointer-events-none" viewBox="0 0 200 200" fill="currentColor">
            <path d="M40 160 C 40 60, 100 30, 180 20 C 170 100, 130 160, 40 160 Z" />
          </svg>
          <svg className="absolute -bottom-10 -left-8 w-40 h-40 text-sage-100 pointer-events-none" viewBox="0 0 200 200" fill="currentColor">
            <path d="M180 40 C 180 140, 120 170, 40 180 C 50 100, 90 40, 180 40 Z" />
          </svg>

          {/* Brand center — ABSOLUTE pozicija, kaip background image. Didelis
              logo, widgetai sluoksnyje virš jo. pointer-events:none — clicks
              pereina pro brand'ą į widget'us. */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
            <div className="w-28 h-28 rounded-[2rem] bg-sage-500 flex items-center justify-center shadow-[0_8px_32px_rgba(46,125,82,0.25)]">
              <Leaf size={56} className="text-white" />
            </div>
            <h2 className="text-3xl font-extrabold text-sage-700 tracking-tight mt-4">LapasID</h2>
            <p className="text-sm text-sage-600 mt-1">tavo augalų dienoraštis</p>
          </div>

          {/* Widgets — flex column, layer'inasi virš brand'o. Tarpas viduryje
              (flex-1 spacer) leidžia brand'ui matytis. */}
          <div className="relative z-10 flex flex-col gap-3 px-4 py-4 overflow-y-auto scrollbar-none h-full">
            <WeatherWidget weather={weather} />
            <div className="flex-1" />
            <CareChartWidget weekData={weekData} />
            <ShopWidget onAddToWishlist={onAddToWishlist} onBuy={onBuy} />
          </div>
        </>
      )}

      {/* Portal target */}
      <div
        ref={(node) => host?.setContainer(node)}
        className="absolute inset-0 z-20"
        style={{ pointerEvents: isActive ? 'auto' : 'none' }}
      />
    </aside>
  )
}
