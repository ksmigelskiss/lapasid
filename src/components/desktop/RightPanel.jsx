import T4Icon from '../brand/T4Icon'
import T4Word from '../brand/T4Word'
import { useDetailHost } from '../../contexts/DetailHostContext'
import { useWeather } from '../../hooks/useWeather'
import { aggregateCareGrid } from '../../utils/careWeekStats'
import WeatherWidget from '../widgets/WeatherWidget'
import CareHeatmapWidget from '../widgets/CareHeatmapWidget'
import ShopWidget from '../widgets/ShopWidget'

/**
 * RightPanel — desktop split layout dešinė panelė (430px fixed).
 *
 * Brand'as (logo + LapasID + tag) yra ABSOLUTE pozicija, centre, kaip
 * background image. Widget'ai sklendžia virš jo — jie permatomi (frosted
 * glass) tad brand'as „prasimato" pro juos.
 */
export default function RightPanel({ plantsForChart = [] }) {
  const host = useDetailHost()
  const isActive = host?.isActive ?? false
  const weather = useWeather()
  // 8 savaičių (~2 mėn) heatmap — kompiūtinama visada (kad widgetai nedingtų
  // staiga DOM'e kai modal'as atsidaro — slide animacija reikalinga uždedant
  // ant background'o, ne pakeičiant turinį).
  const heatmapData = aggregateCareGrid(plantsForChart, 8)

  return (
    <aside className="w-[430px] flex-shrink-0 border-l border-gray-200 bg-bone relative overflow-hidden flex flex-col">
      <>
        {/* Leaf decor */}
        <svg className="absolute -top-5 -right-8 w-44 h-44 text-sage-100 pointer-events-none" viewBox="0 0 200 200" fill="currentColor">
          <path d="M40 160 C 40 60, 100 30, 180 20 C 170 100, 130 160, 40 160 Z" />
        </svg>
        <svg className="absolute -bottom-10 -left-8 w-40 h-40 text-sage-100 pointer-events-none" viewBox="0 0 200 200" fill="currentColor">
          <path d="M180 40 C 180 140, 120 170, 40 180 C 50 100, 90 40, 180 40 Z" />
        </svg>

        {/* Brand center — T4Icon (standard: forest mark on bone square) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
          <T4Icon size={140} ink="#1c3a2a" paper="#f1ebdd" />
          <T4Word size={32} className="text-forest-700 mt-5" />
          <p className="text-sm text-forest-500 mt-2 opacity-70">tavo augalų dienoraštis</p>
        </div>

        {/* Widgets — flex column, layer'inasi virš brand'o. Tarpas viduryje
            (flex-1 spacer) leidžia brand'ui matytis. */}
        <div className="relative z-10 flex flex-col gap-3 px-4 py-4 overflow-y-auto scrollbar-none h-full">
          <WeatherWidget weather={weather} />
          <div className="flex-1" />
          <CareHeatmapWidget data={heatmapData} />
          <ShopWidget />
        </div>
      </>

      {/* Portal target — modal'ai portal'inasi į šią vietą su slide-in
          animacija. Užvažiuoja virš background widget'ų, neslėpdami DOM'e. */}
      <div
        ref={(node) => host?.setContainer(node)}
        className="absolute inset-0 z-20"
        style={{ pointerEvents: isActive ? 'auto' : 'none' }}
      />
    </aside>
  )
}
