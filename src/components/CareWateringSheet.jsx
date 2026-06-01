import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, useDragControls, useMotionValue, animate } from 'framer-motion'
import { Droplets, FlaskConical, Check, X, MapPin, ChevronLeft, ChevronRight, Leaf } from 'lucide-react'
import { getWateringForecast } from '../utils/wateringForecast'
import { getFertilizingForecast } from '../utils/fertilizingForecast'
import PostFertilizePrompt from './PostFertilizePrompt'
import { useIsDesktop } from '../hooks/useIsDesktop'
import PlantImage from './brand/PlantImage'
import { useDetailHost } from '../contexts/DetailHostContext'

/**
 * CareWateringSheet — single-plant care kortelė.
 *
 * Brandbook v1.0 editorial layout:
 * - Clean photo 3:2 (be dark overlay)
 * - Title block ant bone canvas
 * - LAISTYMAS + TRĘŠIMAS editorial sekcijos su StatusBlock (mono caps header,
 *   border-l accent rows label/value)
 * - Action bar apačioje: Laistyti (forest) + Tręšti (terracotta) + opc.
 *   Patikrinau (inspection snooze)
 * - Nav arrows (prev/next per priežiūros santrauką) — kompaktiškos top
 *   header'e, ne overlay'us ant photo
 *
 * Props:
 *   plant, zones, onClose, onAddEvent (type, extra), onAfterAction,
 *   onPrev, onNext, navIndex, navTotal
 */

function fmtDate(iso) {
  if (!iso) return null
  return new Date(iso + 'T00:00:00').toLocaleDateString('lt-LT', { month: 'short', day: 'numeric' })
}

function daysSince(iso) {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso + 'T00:00:00')) / 86400000)
}

// ── Compact status block — action-focused care decision view (2026-06-01) ──
//
// Decluttered layout su 3 vertikaliomis linijomis (vs anksčiau 6+ label/value
// rows + full narrative):
//
//   💧 Laistymas
//      Vėluoja 7 d.                        ← primary signal (BOLD overdue)
//      Paskutinis 05-18 · kas 7 d.         ← secondary context (small)
//      💡 Iš apačios, venk žiedų centro    ← optional method tip (subtle)
//
// Drop'inta: ilgas description narrative'as (duplikatas iš PlantDetail) +
// daugkartinės METODAS/PASKUTINIS/REKOMENDUOJAMA/VĖLUOJA/KITAS row'os.
// Action-focused: vartotojas šitame sheet'e turi greitai matyti „ar reikia
// laistyti dabar" — ne mokytis apie augalą.

function StatusBlock({ icon, title, methodHint, lastDate, intervalLabel, nextDate, daysUntil, isOverdue, isSnoozed, tone, snoozedUntil, lastInspectionDate }) {
  // tone: 'forest' (water) | 'terracotta' (fert)
  const accentColor = isOverdue
    ? 'border-terracotta'
    : isSnoozed
      ? 'border-forest-400/60'
      : 'border-bone-400/60'
  const titleColor = tone === 'terracotta' ? 'text-terracotta-600' : 'text-forest-700'
  const iconColor  = tone === 'terracotta' ? 'text-terracotta-500' : 'text-forest-500'

  // Primary signal — vienoje linijoje rodom „ką dabar daryti"
  let primarySignal = null
  let primaryClass = 'text-forest-700'
  if (isSnoozed && snoozedUntil) {
    primarySignal = `Ramybė iki ${fmtDate(snoozedUntil)}`
    primaryClass = 'text-forest-600'
  } else if (isOverdue && daysUntil != null) {
    primarySignal = `Vėluoja ${Math.abs(daysUntil)} d.`
    primaryClass = 'text-terracotta-600 font-bold'
  } else if (daysUntil === 0) {
    primarySignal = 'Šiandien'
    primaryClass = 'text-forest-700 font-bold'
  } else if (daysUntil != null && daysUntil > 0) {
    primarySignal = `Po ${daysUntil} d.${nextDate ? ` · ${fmtDate(nextDate)}` : ''}`
  } else if (intervalLabel) {
    primarySignal = `Kas ${intervalLabel.replace(/^kas /, '')}`
  }

  // Secondary context — compact „Paskutinis X · kas Y d."
  const since = daysSince(lastDate)
  const contextParts = []
  if (lastDate) {
    contextParts.push(`Paskutinis ${fmtDate(lastDate)}${since != null ? ` (${since} d.)` : ''}`)
  }
  if (intervalLabel && !primarySignal?.startsWith('Kas')) {
    contextParts.push(intervalLabel)
  }

  return (
    <section className="space-y-1.5">
      <div className="flex items-center gap-2">
        <div className={iconColor}>{icon}</div>
        <h3 className={`font-display text-base font-semibold tracking-tight ${titleColor}`}>{title}</h3>
      </div>

      <div className={`pl-3 border-l-2 ${accentColor} space-y-1`}>
        {primarySignal && (
          <p className={`text-base tabular-nums ${primaryClass}`}>{primarySignal}</p>
        )}
        {contextParts.length > 0 && (
          <p className="text-xs text-forest-500 tabular-nums">{contextParts.join(' · ')}</p>
        )}
        {isSnoozed && lastInspectionDate && !isOverdue && (
          <p className="text-xs text-forest-500">Patikrinta {fmtDate(lastInspectionDate)}</p>
        )}
        {methodHint && (
          <p className="text-xs text-forest-400 italic leading-snug pt-0.5">
            <span aria-hidden>💡</span> {methodHint}
          </p>
        )}
      </div>
    </section>
  )
}

export default function CareWateringSheet({
  plant, zones = [], onClose, onAddEvent,
  onAfterAction, onPrev, onNext, navIndex, navTotal,
}) {
  // Desktop split panel — portal į RightPanel container'į.
  const isDesktop = useIsDesktop()
  const host = useDetailHost()
  const useDesktopPanel = isDesktop && !!host?.container

  useEffect(() => {
    if (!useDesktopPanel || !host) return
    host.open()
    return () => host.close()
  }, [useDesktopPanel]) // eslint-disable-line react-hooks/exhaustive-deps

  // ESC keyboard shortcut
  useEffect(() => {
    if (!useDesktopPanel) return
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [useDesktopPanel, onClose])

  const afterAction = onAfterAction || onClose
  const wc = getWateringForecast(plant)
  const fc = getFertilizingForecast(plant)
  const hasImg = !!plant.image
  const intervals = plant.laistymasIntervalas
  const hasFert = fc.intervalDays != null || fc.lastDate
  const showInspect = wc.isOverdue && wc.lastType === 'watering'

  // Hero collapse on scroll (2026-06-01) — MIRROR PlantDetail pattern'ą.
  // ~60px scroll'o link žemyn → hero susikrečia iš aspect-3/2 į aspect-3/1
  // → status block'ai gauna ~33% papildomos vertikalios erdvės. Hysteresis
  // 40/60 saugo nuo flicker'io ties threshold'u.
  const scrollContainerRef = useRef(null)
  const [heroCollapsed, setHeroCollapsed] = useState(false)
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    let raf = null
    const handler = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = null
        const y = el.scrollTop
        setHeroCollapsed(prev => prev ? y > 40 : y > 60)
      })
    }
    el.addEventListener('scroll', handler, { passive: true })
    return () => {
      el.removeEventListener('scroll', handler)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  // Plant change → reset scroll + hero expanded
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    el.scrollTop = 0
    setHeroCollapsed(false)
  }, [plant.id])
  const currentZone = zones.find(z => z.id === plant.zonaId)
  const [postFert, setPostFert] = useState(false)

  // Stable key per-Dashboard'o sheet'as gyvuoja keletą augalų — reset'inam
  // internal state'ą kai keičiasi plant.id (kitaip postFert prompt'as
  // persistina iš ankstesnio augalo).
  useEffect(() => {
    setPostFert(false)
  }, [plant.id])

  // Actions
  const onWater     = () => { onAddEvent('watering');     afterAction() }
  const onFertilize = () => { onAddEvent('fertilizing'); setPostFert(true) }
  const onInspect   = () => { onAddEvent('inspection');   afterAction() }
  const onPalasciau = () => { onAddEvent('watering', { komentaras: 'Laistyta po tręšimo' }); afterAction() }
  const onNelasciau = () => { afterAction() }

  // Watering status block data
  const waterIntervalLabel = intervals?.vasara != null
    ? `vasarą kas ${intervals.vasara} d.${intervals.ziema === null ? ' · žiemą nelaistoma' : intervals.ziema != null ? ` · žiemą kas ${intervals.ziema} d.` : ''}`
    : wc.intervalDays != null
      ? `kas ${wc.intervalDays} d.`
      : null

  // Fertilizing status block data
  const fertIntervalLabel = fc.intervalDays != null ? `kas ${fc.intervalDays} d.` : null

  const dragControls = useDragControls()
  const y = useMotionValue(0)
  const handleDragEnd = (_, info) => {
    if (info.velocity.y > 400 || info.offset.y > 120) onClose()
    else animate(y, 0, { type: 'spring', stiffness: 400, damping: 30 })
  }

  // Horizontal swipe nav ant photo area — supplementinis prev/next gesture.
  // Aptinkam pan'ą tik horizontalų (|x| > |y|), kad nesimaišytų su parent
  // sheet'o vertical drag-to-close. Threshold'as 60px arba velocity 300.
  const handlePhotoPanEnd = (_, info) => {
    const dx = info.offset.x
    const dy = info.offset.y
    const vx = info.velocity.x
    // Pirma — patikriname kryptį: horizontalus pan'as (kitaip ignoruojam,
    // gali būti netyčia uz dėl vertical drag'o ant kito element'o).
    if (Math.abs(dx) <= Math.abs(dy)) return
    // Threshold'as — paslinkti 60px arba greitas swipe'as (vx > 300).
    const enoughSwipe = Math.abs(dx) > 60 || Math.abs(vx) > 300
    if (!enoughSwipe) return
    // Kryptis: kairėn → next, dešinėn → prev (kaip carousels'uose).
    if (dx < 0 && onNext) onNext()
    else if (dx > 0 && onPrev) onPrev()
  }

  return createPortal(
    <div className={useDesktopPanel
      ? "absolute inset-0 flex flex-col"
      : "fixed inset-0 z-[110] flex items-end justify-center"}>
      {/* Backdrop — tik mobile */}
      {!useDesktopPanel && (
        <motion.div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
        />
      )}

      {/* Sheet — desktop'e glass card (kaip PlantDetail), mobile'e solid bone */}
      <motion.div
        className={useDesktopPanel
          ? "relative w-full h-full bg-bone-50 flex flex-col"
          : "relative w-full max-w-[430px] bg-app flex flex-col"}
        style={useDesktopPanel ? { height: '100%' } : { height: '100dvh', y }}
        {...(useDesktopPanel ? {
          initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' },
        } : {
          drag: 'y',
          dragControls,
          dragListener: false,
          dragConstraints: { top: 0 },
          dragElastic: { top: 0, bottom: 0.25 },
          onDragEnd: handleDragEnd,
          initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' },
        })}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
      >
        {/* Drag handle — tik mobile */}
        {!useDesktopPanel && (
          <div className="absolute top-0 left-0 right-0 z-20 flex justify-center pb-2 pointer-events-none select-none" style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}>
            <div
              onPointerDown={e => dragControls.start(e)}
              className="px-8 py-1 cursor-grab active:cursor-grabbing pointer-events-auto"
              style={{ touchAction: 'none' }}
            >
              <div className="w-10 h-1 bg-black/15 rounded-full" />
            </div>
          </div>
        )}

        {/* ── Top toolbar — kompaktiškas nav pager + close ── */}
        <div
          className="flex items-center gap-3 px-4 pb-2 flex-shrink-0"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          {/* Pager — kompaktiškas „‹ 2 / 5 ›" vietoj side overlay arrows */}
          {(onPrev || onNext) && (
            <div className="inline-flex items-center gap-1 bg-bone-300/50 rounded-full p-0.5">
              <button
                onClick={onPrev}
                disabled={!onPrev}
                className="w-7 h-7 flex items-center justify-center rounded-full text-forest-600 disabled:opacity-30 active:bg-bone-400/50 transition-colors"
                aria-label="Ankstesnis"
              >
                <ChevronLeft size={14} />
              </button>
              {navIndex != null && navTotal != null && navTotal > 1 && (
                <span className="font-mono text-[10px] font-medium text-forest-600 uppercase tracking-[0.14em] px-1.5 tabular-nums">
                  {navIndex + 1} / {navTotal}
                </span>
              )}
              <button
                onClick={onNext}
                disabled={!onNext}
                className="w-7 h-7 flex items-center justify-center rounded-full text-forest-600 disabled:opacity-30 active:bg-bone-400/50 transition-colors"
                aria-label="Sekantis"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}

          {/* Zone — clickable indicator */}
          {currentZone && (
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-forest-500">
              <MapPin size={11} className="text-forest-400" />
              <span className="truncate">{currentZone.name}</span>
            </span>
          )}

          <button
            onClick={onClose}
            className="ml-auto w-10 h-10 bg-bone-300/60 hover:bg-bone-400/60 rounded-btn flex items-center justify-center text-forest-700 transition-colors flex-shrink-0"
            aria-label="Uždaryti"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Photo — clean 3:2 + horizontal swipe nav ──
            motion.div su onPanEnd aptinka horizontalų swipe'ą
            (kairėn → next, dešinėn → prev). Vertical drag'as nereaguoja
            čia — ignore'inam jei |y| > |x|, kad nesimaišytų su parent
            sheet'o swipe-down-to-close.
            Chevron'ai ant edge'ų — visual hint'as + backup tap target'ai
            (iOS Photos.app pattern'as). */}
        {(onPrev || onNext) ? (
          <motion.div
            className="relative w-full overflow-hidden bg-bone-300 flex-shrink-0 cursor-grab active:cursor-grabbing"
            onPanEnd={handlePhotoPanEnd}
            style={{ touchAction: 'pan-y' }}
            initial={false}
            animate={{ aspectRatio: heroCollapsed ? '3 / 1' : '3 / 2' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {hasImg ? (
              <PlantImage url={plant.image} alt={plant.lietuviškas} size="detail" eager className="w-full h-full object-cover pointer-events-none select-none" draggable={false} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-8xl pointer-events-none select-none">
                {plant.emoji ?? '🌿'}
              </div>
            )}
            {/* Edge chevron'ai — fade'inasi opacity-70, pakelia į 100 ant
                hover/active. Tap'as iškviečia onPrev/onNext (backup'as
                jei vartotojas neaptiko swipe). */}
            {onPrev && (
              <button
                onClick={onPrev}
                aria-label="Ankstesnis"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 inline-flex items-center justify-center rounded-full bg-black/35 backdrop-blur-sm text-white opacity-70 hover:opacity-100 active:scale-90 transition-all"
              >
                <ChevronLeft size={16} strokeWidth={2.5} />
              </button>
            )}
            {onNext && (
              <button
                onClick={onNext}
                aria-label="Sekantis"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 inline-flex items-center justify-center rounded-full bg-black/35 backdrop-blur-sm text-white opacity-70 hover:opacity-100 active:scale-90 transition-all"
              >
                <ChevronRight size={16} strokeWidth={2.5} />
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div
            className="w-full overflow-hidden bg-bone-300 flex-shrink-0"
            initial={false}
            animate={{ aspectRatio: heroCollapsed ? '3 / 1' : '3 / 2' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {hasImg ? (
              <PlantImage url={plant.image} alt={plant.lietuviškas} size="detail" eager className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-8xl">
                {plant.emoji ?? '🌿'}
              </div>
            )}
          </motion.div>
        )}

        {/* ── Scrollable content ── */}
        <div ref={scrollContainerRef} className="overflow-y-auto flex-1 px-5 pt-4 pb-4 space-y-6">
          {/* Title block */}
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-forest-800 leading-tight">
              {plant.lietuviškas}
            </h2>
            {plant.lotyniskas && (
              <p className="text-sm text-forest-500 italic mt-1">{plant.lotyniskas}</p>
            )}
          </div>

          {/* LAISTYMAS sekcija */}
          <StatusBlock
            icon={<Droplets size={18} />}
            title="Laistymas"
            methodHint={wc.metodas}
            lastDate={wc.lastDate}
            intervalLabel={waterIntervalLabel}
            nextDate={wc.nextDate}
            daysUntil={wc.daysUntil}
            isOverdue={wc.isOverdue}
            isSnoozed={wc.isSnoozed}
            snoozedUntil={wc.snoozedUntil}
            lastInspectionDate={wc.lastInspectionDate}
            tone="forest"
          />

          {/* TRĘŠIMAS sekcija — rodoma tik jei augalas tręšiamas */}
          {hasFert && (
            <StatusBlock
              icon={<Leaf size={18} />}
              title="Tręšimas"
              methodHint={fc.fertilizerTip}
              lastDate={fc.lastDate}
              intervalLabel={fertIntervalLabel}
              nextDate={fc.nextDate}
              daysUntil={fc.daysUntil}
              isOverdue={fc.isOverdue}
              tone="terracotta"
            />
          )}
        </div>

        {/* ── Action bar — sticky bottom ── */}
        <div className="flex-shrink-0 px-4 pt-3 border-t border-bone-400/40 bg-bone-50" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
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
                  className="flex-1 h-11 flex items-center justify-center gap-1.5 rounded-2xl bg-forest-600 active:bg-forest-700 transition-colors"
                >
                  <Droplets size={16} className="text-bone" />
                  <span className="text-sm font-bold text-bone">Laistyti</span>
                </button>
                {hasFert && (
                  <button
                    onClick={onFertilize}
                    className="flex-1 h-11 flex items-center justify-center gap-1.5 rounded-2xl bg-terracotta active:bg-terracotta-500 transition-colors"
                  >
                    <FlaskConical size={16} className="text-bone" />
                    <span className="text-sm font-bold text-bone">Tręšti</span>
                  </button>
                )}
              </div>
              {showInspect && (
                <button
                  onClick={onInspect}
                  className="mt-2 w-full h-10 flex items-center justify-center gap-1.5 rounded-2xl border border-forest-300 text-forest-700 active:bg-forest-50 transition-colors"
                >
                  <Check size={16} />
                  <span className="text-sm font-semibold">Patikrinau — viskas tvarkoj</span>
                </button>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>,
    useDesktopPanel ? host.container : document.body
  )
}
