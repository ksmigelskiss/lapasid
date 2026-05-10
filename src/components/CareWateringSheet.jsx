import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useDragControls, useMotionValue, animate } from 'framer-motion'
import { Droplets, FlaskConical, Check, X, MapPin } from 'lucide-react'
import { getWateringForecast } from '../utils/wateringForecast'
import { getFertilizingForecast } from '../utils/fertilizingForecast'
import PostFertilizePrompt from './PostFertilizePrompt'

/**
 * CareWateringSheet — single-plant care kortelė.
 *
 * Atsiranda paspaudus augalą iš Priežiūros santraukos arba long-press
 * Dashboard care mode'e. Full-screen sheet pagal DESIGN.md "Full-screen
 * sheet pattern" konvenciją (drag handle viršuje, hero su nuotrauka,
 * X mygtukas kampe, action bar apačioje).
 *
 * 3 veiksmai:
 * - Laistyti → onAddEvent('watering') → close
 * - Tręšti → onAddEvent('fertilizing') → post-fert prompt → Palaisčiau/Nelaisčiau
 * - Patikrinau (snooze) → onAddEvent('inspection') → close (rodoma tik
 *   kai watering vėluoja)
 *
 * Props:
 *   plant      — augalo objektas
 *   zones      — visos zonos (zone chip rendering'ui)
 *   onClose    — uždarymas
 *   onAddEvent — (type, extra) => void; type ∈ {watering, fertilizing, inspection}
 */
export default function CareWateringSheet({ plant, zones = [], onClose, onAddEvent }) {
  const wc = getWateringForecast(plant)
  const hasImg = !!plant.image
  const intervals = plant.laistymasIntervalas
  const desc = plant.prieziura?.laistymas
  const hasFert = getFertilizingForecast(plant).intervalDays != null
  const showInspect = wc.isOverdue && wc.lastType === 'watering'
  const currentZone = zones.find(z => z.id === plant.zonaId)
  const [postFert, setPostFert] = useState(false)

  const onWater     = () => { onAddEvent('watering');     onClose() }
  const onFertilize = () => { onAddEvent('fertilizing'); setPostFert(true) }
  const onInspect   = () => { onAddEvent('inspection');   onClose() }
  const onPalasciau = () => { onAddEvent('watering', { komentaras: 'Laistyta po tręšimo' }); onClose() }
  const onNelasciau = () => { onClose() }

  const fmtDate = iso => iso
    ? new Date(iso + 'T00:00:00').toLocaleDateString('lt-LT', { month: 'short', day: 'numeric' })
    : null
  const daysSince = iso => iso
    ? Math.floor((Date.now() - new Date(iso + 'T00:00:00')) / 86400000)
    : null

  const dragControls = useDragControls()
  const y = useMotionValue(0)
  const handleDragEnd = (_, info) => {
    if (info.velocity.y > 400 || info.offset.y > 120) onClose()
    else animate(y, 0, { type: 'spring', stiffness: 400, damping: 30 })
  }

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end justify-center">
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={onClose}
      />

      {/* Sheet — full-screen mobile width, identiška PlantDetail struktūrai */}
      <motion.div
        className="relative w-full max-w-[430px] bg-app flex flex-col"
        style={{ height: '100dvh', y }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0, bottom: 0.25 }}
        onDragEnd={handleDragEnd}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
      >
        {/* Drag handle — pill viršuje, su safe-area pad */}
        <div className="absolute top-0 left-0 right-0 z-20 flex justify-center pb-2 pointer-events-none select-none" style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}>
          <div
            onPointerDown={e => dragControls.start(e)}
            className="px-8 py-1 cursor-grab active:cursor-grabbing pointer-events-auto"
            style={{ touchAction: 'none' }}
          >
            <div className="w-10 h-1 bg-black/15 rounded-full" />
          </div>
        </div>

        {/* ── Hero ── identiška PlantDetail */}
        {hasImg ? (
          <div className="relative flex-shrink-0 overflow-hidden" style={{ height: 'calc(17rem + env(safe-area-inset-top))' }}>
            <img src={plant.image} alt={plant.lietuviškas} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
            <div className="absolute right-4 z-30" style={{ top: 'max(1rem, env(safe-area-inset-top))' }}>
              <button
                onClick={onClose}
                className="w-11 h-11 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4">
              {currentZone && (
                <div className="inline-flex items-center gap-1 mb-1 px-2 py-0.5 rounded-lg bg-white/20">
                  <MapPin size={9} className="text-white/80" />
                  <span className="text-[10px] text-white/90 font-medium">{currentZone.name}</span>
                </div>
              )}
              <h2 className="text-xl font-bold text-white leading-tight">{plant.lietuviškas}</h2>
              {plant.lotyniskas && (
                <p className="text-xs text-white/70 italic mt-0.5">{plant.lotyniskas}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="relative flex-shrink-0 px-5 pb-4 bg-sage-50" style={{ paddingTop: 'max(1.75rem, env(safe-area-inset-top))' }}>
            <div className="flex items-center justify-end mb-3">
              <button
                onClick={onClose}
                className="w-11 h-11 bg-white/60 rounded-full flex items-center justify-center text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-white/80 rounded-2xl flex items-center justify-center text-3xl shadow-ios flex-shrink-0">
                {plant.emoji ?? '🌿'}
              </div>
              <div className="flex-1 min-w-0">
                {currentZone && (
                  <div className="inline-flex items-center gap-1 mb-1 px-2 py-0.5 rounded-lg bg-sage-100">
                    <MapPin size={9} className="text-sage-600" />
                    <span className="text-[10px] text-sage-700 font-medium">{currentZone.name}</span>
                  </div>
                )}
                <h2 className="text-lg font-bold text-gray-900 leading-tight">{plant.lietuviškas}</h2>
                {plant.lotyniskas && (
                  <p className="text-xs text-gray-500 italic mt-0.5">{plant.lotyniskas}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 pt-4 pb-4 space-y-4">

          {/* Description */}
          {desc ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Droplets size={15} className="text-sky-500" />
                <p className="text-sm font-bold text-gray-800">Laistymas</p>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Droplets size={15} className="text-sky-500" />
              <p className="text-sm font-bold text-gray-800">Laistymas</p>
            </div>
          )}

          {/* Method */}
          {wc.metodas && (
            <div className="bg-gray-50 rounded-2xl px-4 py-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Metodas</p>
              <p className="text-sm text-gray-700">{wc.metodas}</p>
            </div>
          )}

          {/* Current status */}
          <div className={`rounded-2xl px-4 py-3 ${wc.isOverdue ? 'bg-sky-50 border border-sky-100' : wc.isSnoozed ? 'bg-green-50 border border-green-100' : 'bg-gray-50'}`}>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">Dabar</p>
            <div className="space-y-2">
              {wc.lastDate && (
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-sm text-gray-500 flex-shrink-0">Paskutinis</span>
                  <span className="text-sm font-semibold text-gray-800 text-right">
                    {fmtDate(wc.lastDate)}
                    {daysSince(wc.lastDate) != null && (
                      <span className="text-gray-400 font-normal"> · {daysSince(wc.lastDate)} d. atgal</span>
                    )}
                  </span>
                </div>
              )}
              {(intervals?.vasara != null || wc.intervalDays != null) && (
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-sm text-gray-500 flex-shrink-0">Rekomenduojama</span>
                  <span className="text-sm font-semibold text-gray-800 text-right">
                    {intervals?.vasara != null
                      ? `vasarą kas ${intervals.vasara} d.`
                      : `kas ${wc.intervalDays} d.`}
                    {intervals && (
                      <span className="text-gray-400 font-normal">
                        {' · '}
                        {intervals.ziema === null
                          ? 'žiemą neskaistoma'
                          : intervals.ziema != null
                            ? `žiemą kas ${intervals.ziema} d.`
                            : ''}
                      </span>
                    )}
                  </span>
                </div>
              )}
              {wc.daysUntil != null && (
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-sm text-gray-500 flex-shrink-0">
                    {wc.isOverdue ? 'Galimai vėluoja' : 'Kitas'}
                  </span>
                  <span className={`text-sm font-bold text-right ${wc.isOverdue ? 'text-sky-600' : 'text-gray-800'}`}>
                    {wc.isOverdue
                      ? `${Math.abs(wc.daysUntil)} d.`
                      : `po ${wc.daysUntil} d.${wc.nextDate ? ` · ${fmtDate(wc.nextDate)}` : ''}`}
                  </span>
                </div>
              )}
              {wc.isSnoozed && wc.snoozedUntil && (
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-sm text-gray-500 flex-shrink-0">Patikrinta</span>
                  <span className="text-sm font-semibold text-green-700 text-right">
                    {fmtDate(wc.lastInspectionDate)} · ramybė iki {fmtDate(wc.snoozedUntil)}
                  </span>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Action bar — float apačioje, su safe-area pad */}
        <div className="flex-shrink-0 px-4 pt-3 border-t border-gray-100 bg-white" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          {postFert ? (
            <PostFertilizePrompt
              count={1}
              onPalasciau={onPalasciau}
              onNelasciau={onNelasciau}
            />
          ) : (
            <>
              <div className="flex gap-2 items-center">
                <button
                  onClick={onWater}
                  className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-xl bg-sky-500 active:bg-sky-600 transition-colors"
                >
                  <Droplets size={16} className="text-white" />
                  <span className="text-sm font-bold text-white">Laistyti</span>
                </button>
                {hasFert && (
                  <button
                    onClick={onFertilize}
                    className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 active:bg-amber-600 transition-colors"
                  >
                    <FlaskConical size={16} className="text-white" />
                    <span className="text-sm font-bold text-white">Tręšti</span>
                  </button>
                )}
              </div>
              {showInspect && (
                <button
                  onClick={onInspect}
                  className="mt-2 w-full h-10 flex items-center justify-center gap-1.5 rounded-xl bg-green-500 active:bg-green-600 transition-colors"
                >
                  <Check size={16} className="text-white" />
                  <span className="text-sm font-bold text-white">Patikrinau — viskas tvarkoj</span>
                </button>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  )
}
