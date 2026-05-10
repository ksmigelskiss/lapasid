import { Leaf } from 'lucide-react'

/**
 * RightPanel — desktop split layout dešinė panelė (430px fixed).
 *
 * Default state: brand logo + tag + subtle leaf decor.
 * Modal'ai (PlantDetail, CareWateringSheet, etc.) bus render'inami čia
 * per portal context — bus pridėta Etapas 2.
 *
 * Etapas 4-6: WeatherWidget, WeeklyChart, TipWidget — vėliau atskirai.
 */
export default function RightPanel() {
  return (
    <aside className="w-[430px] flex-shrink-0 border-l border-gray-200 bg-app-warm relative overflow-hidden flex flex-col">
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

      {/* Brand center */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 relative z-10">
        <div className="w-16 h-16 rounded-2xl bg-sage-500 flex items-center justify-center shadow-md">
          <Leaf size={32} className="text-white" />
        </div>
        <h2 className="text-2xl font-extrabold text-sage-700 tracking-tight">LapasID</h2>
        <p className="text-sm text-sage-600">tavo augalų dienoraštis</p>
      </div>

      {/* Widget zone footer placeholder — vėliau Weather/Chart/Tip */}
      <div className="px-5 py-4 text-center relative z-10">
        <p className="text-[11px] text-gray-400 italic">
          Pasirink augalą iš sąrašo
        </p>
      </div>
    </aside>
  )
}
