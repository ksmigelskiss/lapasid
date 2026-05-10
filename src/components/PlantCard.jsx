import { useState, useRef, memo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sun, Droplets, Star, Leaf, Moon, Sprout, Snowflake, Skull, House, Ghost, FileText, MapPin, FlaskConical, Check, X } from 'lucide-react'
import { getFertilizingForecast } from '../utils/fertilizingForecast'
import { getDormancyForecast } from '../utils/dormancyForecast'
import { getWateringForecast } from '../utils/wateringForecast'

// Designer'io PlantPhoto gradient pool (paimta iš /tmp/geliai-design styles.css `.pp-*`).
// Hash from plant.id deterministiškai parinka vieną iš 12 gradient'ų.
const PLANT_GRADIENTS = [
  'linear-gradient(135deg, #1f4d36 0%, #3a8a5a 60%, #5fae7c 100%)',  // monstera
  'linear-gradient(150deg, #2d4a32 0%, #4a7549 50%, #8aa861 100%)',  // sansevieria
  'linear-gradient(140deg, #6a3a4d 0%, #c2647a 50%, #e8a5b5 100%)',  // pelargonia
  'linear-gradient(150deg, #335a3a 0%, #5a8a4a 70%, #a4c878 100%)',  // bazilikas
  'linear-gradient(160deg, #4a6b3f 0%, #82a55a 60%, #c5d49a 100%)',  // aloe
  'linear-gradient(140deg, #4d2a5a 0%, #8a4ea0 50%, #c490d0 100%)',  // orchid
  'linear-gradient(135deg, #1a3a26 0%, #2f6644 60%, #4d9268 100%)',  // filodend
  'linear-gradient(160deg, #2c5a3f 0%, #5a8a5a 60%, #c8d8a4 100%)',  // pakalnute
  'linear-gradient(150deg, #2a5040 0%, #4a8a6a 60%, #94c4a4 100%)',  // metos
  'linear-gradient(140deg, #804020 0%, #c8704a 50%, #ec9c80 100%)',  // begonija
  'linear-gradient(155deg, #4a3a6a 0%, #8a7ab0 50%, #c4b8d8 100%)',  // levanda
  'linear-gradient(140deg, #2a4030 0%, #4a7050 60%, #7fa07f 100%)',  // ficus
]

// Stabilus djb2-style hash iš string'o → gradient index.
function gradientForPlant(id) {
  const s = String(id ?? '')
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return PLANT_GRADIENTS[Math.abs(h) % PLANT_GRADIENTS.length]
}

// Diagonal stripes overlay (designer'io .plant-photo .stripes pattern)
const STRIPES_BG = 'repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 8px, rgba(0,0,0,0.04) 8px, rgba(0,0,0,0.04) 16px)'

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
  const baseSize = 'w-7 h-7 rounded-full border-2 shadow-md'
  const single   = `${baseSize} flex items-center justify-center`

  // BOTH overdue — kapsulė su split border'iu. Kiekvienas pusinis turi
  // savo border'ą atitinkančia spalvą (sky kairė, amber dešinė) + ikoną.
  if (waterOverdue && fertOverdue) {
    return (
      <div className="w-12 h-7 rounded-full shadow-md flex">
        <div className={`w-1/2 flex items-center justify-center border-2 border-r-0 rounded-l-full ${checked ? 'bg-sky-400 border-sky-400' : 'bg-sky-400/30 border-sky-400'}`}>
          <Droplets size={11} className={checked ? 'text-white' : 'text-sky-500'} />
        </div>
        <div className={`w-1/2 flex items-center justify-center border-2 border-l-0 rounded-r-full ${checked ? 'bg-amber-400 border-amber-400' : 'bg-amber-400/30 border-amber-400'}`}>
          <FlaskConical size={11} className={checked ? 'text-white' : 'text-amber-500'} />
        </div>
      </div>
    )
  }

  // Single overdue (fert ARBA water ARBA nei) su ikonomis
  if (checked) {
    if (fertOverdue)  return <div className={`${single} bg-amber-400 border-amber-400`}><FlaskConical size={14} className="text-white" /></div>
    if (waterOverdue) return <div className={`${single} bg-sky-400 border-sky-400`}><Droplets size={14} className="text-white" /></div>
    return <div className={`${single} bg-sage-400 border-sage-400`}><Check size={13} className="text-white" /></div>
  }
  if (fertOverdue)  return <div className={`${single} border-amber-400 bg-amber-400/20`}><FlaskConical size={12} className="text-amber-400" /></div>
  if (waterOverdue) return <div className={`${single} border-sky-400 bg-sky-400/20`}><Droplets size={12} className="text-sky-400" /></div>
  return <div className={`${single} border-white/80 bg-black/30`} />
}

const PlantCard = memo(function PlantCard({
  plant, section, onTap, cardBg = 'bg-white',
  showDashboardBadge = false, zoneName,
  careMode = false, checked = false, onToggle, onCareInfo,
}) {
  const [imgError, setImgError] = useState(false)
  const [zoomed,   setZoomed]   = useState(false)
  const longPressTimer = useRef(null)
  const startPos       = useRef(null)
  const didLongPress   = useRef(false)

  const status   = plant.status ?? 'healthy'
  const hasImage = plant.image && !imgError

  const onPressStart = (e) => {
    didLongPress.current = false
    startPos.current = { x: e.clientX, y: e.clientY }
    if (careMode) {
      longPressTimer.current = setTimeout(() => {
        didLongPress.current = true
        onCareInfo?.()
        navigator.vibrate?.(30)
      }, 450)
    } else {
      if (!hasImage) return
      longPressTimer.current = setTimeout(() => {
        didLongPress.current = true
        setZoomed(true)
        navigator.vibrate?.(30)
      }, 450)
    }
  }
  const onPressMove = (e) => {
    if (!longPressTimer.current) return
    const dx = e.clientX - (startPos.current?.x ?? e.clientX)
    const dy = e.clientY - (startPos.current?.y ?? e.clientY)
    if (dx * dx + dy * dy > 100) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
  }
  const onPressEnd = () => { clearTimeout(longPressTimer.current); longPressTimer.current = null }
  const noteCount = plant.uzrasai?.length ?? (plant.komentaras?.trim() ? 1 : 0)
  const fertFC      = section === 'auginama' ? getFertilizingForecast(plant) : null
  const fertOverdue = fertFC?.isOverdue ?? false
  const dormFC      = section === 'auginama' ? getDormancyForecast(plant) : null
  const waterFC     = section === 'auginama' ? getWateringForecast(plant) : null
  const waterOverdue = waterFC?.isOverdue ?? false
  const waterDays   = waterFC?.lastType === 'watering' ? daysSinceDate(waterFC.lastDate) : null
  const fertLastDate = fertFC ? (plant.timeline ?? []).filter(e => e.type === 'fertilizing').sort((a,b) => new Date(b.date)-new Date(a.date))[0]?.date : null
  const fertDays    = fertLastDate ? daysSinceDate(fertLastDate) : null

  // Designer'io glass-pill rodo „dienos iki kito veiksmo" countdown (abs reikšmė).
  // null jei intervalas neskaičiuojamas.
  const waterDaysUntil = waterFC?.daysUntil != null ? Math.abs(waterFC.daysUntil) : null
  const fertDaysUntil  = fertFC?.daysUntil  != null ? Math.abs(fertFC.daysUntil)  : null

  const bgClass = section === 'history' ? 'bg-surface-2'
    : section === 'nori'    ? 'bg-blush-50'
    : 'bg-sage-50'

  const todayStr = new Date().toISOString().slice(0, 10)
  const doneToday = careMode && (
    waterFC?.lastDate === todayStr ||
    fertLastDate === todayStr
  )

  const handleClick = () => { if (didLongPress.current) return; careMode ? onToggle?.() : onTap?.() }

  return (
    <>
    <div
      className={`${cardBg} rounded-2xl overflow-hidden shadow-ios-card active:scale-95 transition-transform duration-100 cursor-pointer ${doneToday ? 'opacity-50' : ''}`}
      onClick={handleClick}
      onPointerDown={careMode ? onPressStart : undefined}
      onPointerMove={careMode ? onPressMove : undefined}
      onPointerUp={careMode ? onPressEnd : undefined}
      onPointerCancel={careMode ? onPressEnd : undefined}
      onContextMenu={careMode ? e => e.preventDefault() : undefined}
      style={careMode ? { WebkitTouchCallout: 'none', userSelect: 'none' } : undefined}
    >
      {/* Image area */}
      <div
        className="relative aspect-square overflow-hidden select-none"
        style={!hasImage ? { background: gradientForPlant(plant.id) } : undefined}
        onPointerDown={!careMode ? onPressStart : undefined}
        onPointerMove={!careMode ? onPressMove : undefined}
        onPointerUp={!careMode ? onPressEnd : undefined}
        onPointerCancel={!careMode ? onPressEnd : undefined}
        onContextMenu={!careMode ? e => e.preventDefault() : undefined}
      >
        {hasImage ? (
          <img src={plant.image} alt={plant.lietuviškas}
            className="w-full h-full object-cover pointer-events-none"
            style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
            onError={() => setImgError(true)} />
        ) : (
          <>
            {/* Diagonal stripes overlay (designer'io .stripes pattern) */}
            <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: STRIPES_BG }} />
            {/* Augalo emoji centruotas, baltas su minkšta opacity (ne dominuoja) */}
            <div className="absolute inset-0 flex items-center justify-center text-5xl opacity-90 mix-blend-luminosity">
              {plant.emoji ?? '🌿'}
            </div>
          </>
        )}

        {/* Status dot (non-auginama only) */}
        {section !== 'auginama' && (
          <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full border-2 border-white/60 bg-transparent shadow-sm" />
        )}

        {/* Forecast glass pills (auginama only) — designer'io glass-pill stilius:
            tamsus pusiau permatomas bg + blur, color-tinted ikonos, countdown „Xd" */}
        {section === 'auginama' && (
          <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 items-end z-[2]">
            <div className={`inline-flex items-center gap-1.5 backdrop-blur-md rounded-full px-2.5 py-1 ${
              waterOverdue ? 'bg-red-500/70' : 'bg-black/55'
            }`}>
              <Droplets size={12} className={waterOverdue ? 'text-white' : 'text-sky-300'} />
              {waterDaysUntil != null && (
                <span className="text-[11.5px] font-semibold leading-none text-white tracking-tight">
                  {waterDaysUntil}d
                </span>
              )}
            </div>
            {fertFC?.intervalDays != null && (
              <div className={`inline-flex items-center gap-1.5 backdrop-blur-md rounded-full px-2.5 py-1 ${
                fertOverdue ? 'bg-red-500/70' : 'bg-black/55'
              }`}>
                <FlaskConical size={12} className={fertOverdue ? 'text-white' : 'text-amber-300'} />
                {fertDaysUntil != null && (
                  <span className="text-[11.5px] font-semibold leading-none text-white tracking-tight">
                    {fertDaysUntil}d
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Right-side badge column */}
        {(showDashboardBadge || section === 'istorija' || noteCount > 0) && (
          <div className={`absolute ${section === 'auginama' ? 'top-[68px]' : 'top-2'} right-2 flex flex-col gap-1 items-center`}>
            {showDashboardBadge && (
              <div className="bg-sage-500/90 backdrop-blur-sm rounded-lg p-1">
                <House size={14} className="text-white" />
              </div>
            )}
            {section === 'istorija' && (
              <div className="bg-black/55 backdrop-blur-sm rounded-lg p-1">
                <Ghost size={14} className="text-white" />
              </div>
            )}
            {noteCount > 0 && (
              <div className="bg-gray-700/75 backdrop-blur-sm rounded-lg px-1.5 py-1 flex items-center gap-0.5">
                <FileText size={12} className="text-white" />
                <span className="text-[10px] text-white font-bold leading-none">{noteCount}</span>
              </div>
            )}
          </div>
        )}

        {/* Toxic pill — designer'io spec: red full-pill, white uppercase, bold, soft shadow */}
        {plant.toksiskas && (
          <div className="absolute top-2.5 left-2.5 z-[2]">
            <span className="inline-flex items-center gap-1 bg-red-500 text-white text-[10.5px] font-extrabold uppercase tracking-[0.06em] rounded-full px-2.5 py-1 shadow-[0_2px_8px_rgba(239,68,68,0.35)]">
              <Skull size={11} /> Toksiška
            </span>
          </div>
        )}

        {/* Care mode: selection circle — bottom-right */}
        {careMode && section === 'auginama' && (
          <div className="absolute bottom-2 right-2">
            <CareCircle checked={checked} waterOverdue={waterOverdue} fertOverdue={fertOverdue} />
          </div>
        )}

        {/* Bottom-left badges: zone (location glass-pill su mint pin) + dormancy */}
        {(zoneName || dormFC) && (
          <div className="absolute bottom-2.5 left-2.5 flex flex-col gap-1.5 items-start z-[2]">
            {zoneName && (
              <span className="inline-flex items-center gap-1.5 bg-black/55 backdrop-blur-md rounded-full px-2.5 py-1">
                <MapPin size={11} className="text-emerald-300 flex-shrink-0" />
                <span className="text-[11.5px] text-white font-semibold tracking-tight leading-none">{zoneName}</span>
              </span>
            )}
            {dormFC && (
              <span className={`inline-flex items-center gap-1.5 backdrop-blur-md rounded-full px-2.5 py-1 ${
                dormFC.window === 'active' ? 'bg-blue-500/85' :
                dormFC.window === 'waking' ? 'bg-green-500/85' :
                                             'bg-amber-500/85'
              }`}>
                {dormFC.window === 'active'
                  ? <><Moon size={11} className="text-white" /><span className="text-[11px] text-white font-bold leading-none">Miega</span></>
                  : dormFC.window === 'waking'
                    ? <><Sprout size={11} className="text-white" /><span className="text-[11px] text-white font-bold leading-none">Žadinti</span></>
                    : <><Snowflake size={11} className="text-white" /><span className="text-[11px] text-white font-bold leading-none">Ruoštis</span></>}
              </span>
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

        {/* Water meter — care mode'e, vietoj generic dot-scores rodom realią būklę */}
        {careMode && section === 'auginama' && waterFC?.intervalDays > 0 && (
          (() => {
            const daysSince = waterDays ?? 0
            const daysRemaining = waterFC.intervalDays - daysSince
            const pctFull = Math.max(8, Math.min(100, Math.round((daysRemaining / waterFC.intervalDays) * 100)))
            const urgent = waterOverdue || daysRemaining <= 1
            return (
              <div className="flex items-center gap-1.5 mt-2">
                <Droplets size={11} className={urgent ? 'text-red-500' : 'text-sky-400'} />
                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${urgent ? 'bg-red-400' : 'bg-sky-400'}`}
                    style={{ width: `${pctFull}%` }}
                  />
                </div>
                <span className={`text-[10px] font-semibold ${urgent ? 'text-red-500' : 'text-gray-600'}`}>
                  {daysRemaining >= 0 ? `${daysRemaining}d` : `+${Math.abs(daysRemaining)}d`}
                </span>
              </div>
            )
          })()
        )}

        <div className="flex items-center gap-2.5 mt-2">
          {plant.sviesa?.taskai != null && (
            <div className="flex items-center gap-1">
              <Sun size={12} className="text-amber-400" />
              <DotScore value={plant.sviesa.taskai} color="bg-amber-400" />
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

    {/* Full-screen photo zoom portal */}
    {createPortal(
      <AnimatePresence>
        {zoomed && (
          <motion.div
            className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-black/95"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onPointerDown={() => setZoomed(false)}
          >
            <motion.img
              src={plant.image}
              alt={plant.lietuviškas}
              className="max-w-full max-h-[80dvh] object-contain pointer-events-none select-none"
              style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.88, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            />
            <div className="absolute bottom-16 left-0 right-0 text-center px-6 pointer-events-none">
              <p className="text-white font-bold text-base leading-tight">{plant.lietuviškas}</p>
              {plant.lotyniskas && <p className="text-white/50 text-sm italic mt-0.5">{plant.lotyniskas}</p>}
            </div>
            <button
              className="absolute top-14 right-4 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
              onPointerDown={e => { e.stopPropagation(); setZoomed(false) }}
            >
              <X size={16} className="text-white" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )}
    </>
  )
})

export default PlantCard
