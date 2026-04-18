import { useState, memo } from 'react'
import { Sun, Droplets, Star, Leaf, Moon, Sprout, Snowflake, Skull, House, ShoppingCart, Ghost, FileText, MapPin, FlaskConical, Check } from 'lucide-react'
import { getFertilizingForecast } from '../utils/fertilizingForecast'
import { getDormancyForecast } from '../utils/dormancyForecast'
import { getWateringForecast } from '../utils/wateringForecast'

function daysSinceDate(iso) {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso + 'T00:00:00')) / 86400000)
}

function DotScore({ value, max = 3, color }) {
  return (
    <div className="flex gap-[3px] items-center">
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < value ? color : 'bg-gray-300'}`} />
      ))}
    </div>
  )
}

function CareCircle({ checked, waterOverdue, fertOverdue }) {
  const base = 'w-7 h-7 rounded-full flex items-center justify-center border-2 shadow-md'
  if (checked) {
    if (fertOverdue)  return <div className={`${base} bg-amber-400 border-amber-400`}><FlaskConical size={14} className="text-white" /></div>
    if (waterOverdue) return <div className={`${base} bg-sky-400 border-sky-400`}><Droplets size={14} className="text-white" /></div>
    return <div className={`${base} bg-sage-400 border-sage-400`}><Check size={13} className="text-white" /></div>
  }
  if (fertOverdue)  return <div className={`${base} border-amber-400 bg-amber-400/20`}><FlaskConical size={12} className="text-amber-400" /></div>
  if (waterOverdue) return <div className={`${base} border-sky-400 bg-sky-400/20`}><Droplets size={12} className="text-sky-400" /></div>
  return <div className={`${base} border-white/80 bg-black/30`} />
}

const PlantCard = memo(function PlantCard({
  plant, section, onTap, cardBg = 'bg-white',
  showDashboardBadge = false, zoneName,
  careMode = false, checked = false, onToggle,
}) {
  const [imgError, setImgError] = useState(false)

  const status    = plant.status ?? 'healthy'
  const hasImage  = plant.image && !imgError
  const noteCount = plant.uzrasai?.length ?? (plant.komentaras?.trim() ? 1 : 0)
  const fertFC      = section === 'auginama' ? getFertilizingForecast(plant) : null
  const fertOverdue = fertFC?.isOverdue ?? false
  const dormFC      = section === 'auginama' ? getDormancyForecast(plant) : null
  const waterFC     = section === 'auginama' ? getWateringForecast(plant) : null
  const waterOverdue = waterFC?.isOverdue ?? false
  const waterDays   = waterFC?.lastType === 'watering' ? daysSinceDate(waterFC.lastDate) : null
  const fertLastDate = fertFC ? (plant.timeline ?? []).filter(e => e.type === 'fertilizing').sort((a,b) => new Date(b.date)-new Date(a.date))[0]?.date : null
  const fertDays    = fertLastDate ? daysSinceDate(fertLastDate) : null

  const bgClass = section === 'history' ? 'bg-surface-2'
    : section === 'nori'    ? 'bg-blush-50'
    : 'bg-sage-50'

  const handleClick = careMode ? onToggle : onTap

  return (
    <div
      className={`${cardBg} rounded-2xl overflow-hidden shadow-ios-card active:scale-95 transition-transform duration-100 cursor-pointer`}
      onClick={handleClick}
    >
      {/* Image area */}
      <div className={`relative aspect-square overflow-hidden select-none ${!hasImage ? bgClass : ''}`}>
        {hasImage ? (
          <img src={plant.image} alt={plant.lietuviškas}
            className="w-full h-full object-cover pointer-events-none"
            loading="lazy"
            onError={() => setImgError(true)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">
            {plant.emoji ?? '🌿'}
          </div>
        )}

        {/* Care mode: selection circle (top-right, replaces forecast icons) */}
        {careMode && section === 'auginama' && (
          <div className="absolute top-2 right-2">
            <CareCircle checked={checked} waterOverdue={waterOverdue} fertOverdue={fertOverdue} />
          </div>
        )}

        {/* Status dot (non-auginama, non-careMode only) */}
        {!careMode && section !== 'auginama' && (
          <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full border-2 border-white/60 bg-transparent shadow-sm" />
        )}

        {/* Forecast icons (auginama only) */}
        {section === 'auginama' && (
          <div className={`absolute ${careMode ? 'top-2 left-2' : 'top-2 right-2'} flex flex-col gap-0.5 items-end`}>
            <div className="flex items-center gap-0.5 bg-black/30 backdrop-blur-sm rounded-md px-1 py-0.5">
              <Droplets size={9} className={waterOverdue ? 'text-sky-300 fill-sky-300' : 'text-white/50'} />
              {waterDays != null && (
                <span className={`text-[8px] font-semibold leading-none ${waterOverdue ? 'text-sky-200' : 'text-white/50'}`}>
                  {waterDays}d
                </span>
              )}
            </div>
            {fertFC?.intervalDays != null && (
              <div className="flex items-center gap-0.5 bg-black/30 backdrop-blur-sm rounded-md px-1 py-0.5">
                <FlaskConical size={9} className={fertOverdue ? 'text-amber-300 fill-amber-300' : 'text-white/50'} />
                {fertDays != null && (
                  <span className={`text-[8px] font-semibold leading-none ${fertOverdue ? 'text-amber-200' : 'text-white/50'}`}>
                    {fertDays}d
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Right-side badge column */}
        {(showDashboardBadge || plant.pirkinys || section === 'istorija' || noteCount > 0) && (
          <div className={`absolute ${section === 'auginama' ? 'top-12' : 'top-6'} right-1.5 flex flex-col gap-1 items-center`}>
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

        {/* Bottom-left badge column: zone + dormancy */}
        {(zoneName || dormFC) && (
          <div className="absolute bottom-2 left-2 flex flex-col gap-1 items-start">
            {zoneName && (
              <div className="bg-black/40 backdrop-blur-sm rounded-lg px-1.5 py-0.5">
                <span className="flex items-center gap-0.5 text-[9px] text-white font-medium">
                  <MapPin size={8} className="flex-shrink-0" />{zoneName}
                </span>
              </div>
            )}
            {dormFC && (
              <div className={`backdrop-blur-sm rounded-lg px-1.5 py-0.5 ${
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
