import { useState, memo } from 'react'
import { Sun, Droplets, Star, Leaf, Moon, Sprout, Snowflake, Skull, House, ShoppingCart, Ghost, FileText } from 'lucide-react'
import { getFertilizingForecast } from '../utils/fertilizingForecast'
import { getDormancyForecast } from '../utils/dormancyForecast'

function DotScore({ value, max = 3, color }) {
  return (
    <div className="flex gap-[3px] items-center">
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < value ? color : 'bg-gray-300'}`} />
      ))}
    </div>
  )
}

const PlantCard = memo(function PlantCard({ plant, section, onTap, cardBg = 'bg-white', showDashboardBadge = false }) {
  const [imgError, setImgError] = useState(false)

  const status    = plant.status ?? 'healthy'
  const hasImage  = plant.image && !imgError
  const noteCount = plant.uzrasai?.length ?? (plant.komentaras?.trim() ? 1 : 0)
  const fertFC      = section === 'auginama' ? getFertilizingForecast(plant) : null
  const fertOverdue = fertFC?.isOverdue ?? false
  const dormFC      = section === 'auginama' ? getDormancyForecast(plant) : null

  const bgClass = section === 'history' ? 'bg-surface-2'
    : section === 'nori'    ? 'bg-blush-50'
    : 'bg-sage-50'

  return (
    <div
      className={`${cardBg} rounded-2xl overflow-hidden shadow-ios-card active:scale-95 transition-transform duration-100 cursor-pointer`}
      onClick={onTap}
    >
      {/* Image area */}
      <div className={`relative aspect-square overflow-hidden select-none ${!hasImage ? bgClass : ''}`}>
        {hasImage ? (
          <img src={plant.image} alt={plant.lietuviškas}
            className="w-full h-full object-cover pointer-events-none"
            onError={() => setImgError(true)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">
            {plant.emoji ?? '🌿'}
          </div>
        )}

        {/* Status dot */}
        <div className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm ${
          status === 'healthy'    ? 'bg-green-400'  :
          status === 'sick'       ? 'bg-orange-400' :
          status === 'quarantine' ? 'bg-red-500'    :
                                   'bg-green-400'
        }`} />

        {/* Right-side badge column */}
        {(showDashboardBadge || plant.pirkinys || section === 'istorija' || noteCount > 0) && (
          <div className="absolute top-6 right-1.5 flex flex-col gap-1 items-center">
            {showDashboardBadge && (
              <div className="bg-sage-500/90 backdrop-blur-sm rounded-md p-0.5">
                <House size={10} className="text-white" />
              </div>
            )}
            {plant.pirkinys && (
              <div className="bg-orange-500/90 backdrop-blur-sm rounded-md p-0.5">
                <ShoppingCart size={10} className="text-white" />
              </div>
            )}
            {section === 'istorija' && (
              <div className="bg-black/50 backdrop-blur-sm rounded-md p-0.5">
                <Ghost size={10} className="text-white" />
              </div>
            )}
            {noteCount > 0 && (
              <div className="bg-gray-500/80 backdrop-blur-sm rounded-md px-1 py-0.5 flex items-center gap-0.5">
                <FileText size={8} className="text-white" />
                <span className="text-[8px] text-white font-bold leading-none">{noteCount}</span>
              </div>
            )}
          </div>
        )}

        {/* Toxic badge */}
        {plant.toksiskas && (
          <div className="absolute top-2 left-2 bg-red-500/90 backdrop-blur-sm rounded-lg px-1.5 py-0.5">
            <span className="flex items-center gap-0.5 text-[9px] text-white font-bold"><Skull size={9} /> TOKSIŠKA</span>
          </div>
        )}

        {/* Fertilizing overdue badge */}
        {fertOverdue && (
          <div className="absolute bottom-2 right-2 bg-orange-500/90 backdrop-blur-sm rounded-lg px-1.5 py-0.5">
            <span className="flex items-center gap-0.5 text-[9px] text-white font-bold"><Leaf size={9} /> +{Math.abs(fertFC.daysUntil)}d</span>
          </div>
        )}

        {/* Dormancy badge */}
        {dormFC && (
          <div className={`absolute bottom-2 left-2 backdrop-blur-sm rounded-lg px-1.5 py-0.5 ${
            dormFC.window === 'active' ? 'bg-blue-500/90' :
            dormFC.window === 'waking' ? 'bg-green-500/90' :
                                         'bg-amber-500/90'
          }`}>
            <span className="flex items-center gap-0.5 text-[9px] text-white font-bold">
              {dormFC.window === 'active'
                ? <><Moon size={9} /> Miega</>
                : dormFC.window === 'waking'
                  ? <><Sprout size={9} /> Žadinti</>
                  : <><Snowflake size={9} /> Ruoštis</>}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-2.5 pt-2 pb-2.5">
        <h3 className="text-[13px] font-bold text-gray-950 leading-tight line-clamp-2">
          {plant.lietuviškas}
        </h3>
        <p className="text-[10px] text-gray-600 italic mt-0.5 truncate">{plant.lotyniskas}</p>

        <div className="flex items-center gap-2.5 mt-2">
          {plant.sviesa?.taskai != null && (
            <div className="flex items-center gap-1">
              <Sun size={12} className="text-amber-400" />
              <DotScore value={plant.sviesa.taskai} color="bg-amber-400" />
              {plant.sviesa?.ppfd && (
                <span className="text-[9px] text-amber-500 font-medium leading-none">
                  {plant.sviesa.ppfd.min}–{plant.sviesa.ppfd.max}
                </span>
              )}
            </div>
          )}
          {plant.vanduo?.taskai != null && (
            <div className="flex items-center gap-1">
              <Droplets size={12} className="text-blue-400" />
              <DotScore value={plant.vanduo.taskai} color="bg-blue-400" />
            </div>
          )}
          {plant.sunkumas != null && (
            <div className="flex items-center gap-1">
              <Star size={11} className="text-amber-400 fill-amber-400" />
              <span className="text-[10px] font-semibold text-gray-700">{plant.sunkumas}/5</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

export default PlantCard
