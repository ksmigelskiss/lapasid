import { Leaf } from 'lucide-react'
import { useDetailHost } from '../../contexts/DetailHostContext'

/**
 * RightPanel — desktop split layout dešinė panelė (430px fixed).
 *
 * Dvi būsenos:
 *  - default: brand logo + tag + leaf decor (kai jokio modal'o nėra atidaryto)
 *  - portal target: modal'ai (PlantDetail, CareWateringSheet, ...) render'inami
 *    į `<div ref=...>` per createPortal (žr. DetailHostContext)
 *
 * Etapas 4-6: pridės WeatherWidget, WeeklyChart, TipWidget — vėliau atskirai.
 */
export default function RightPanel() {
  const host = useDetailHost()
  const isActive = host?.isActive ?? false

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
