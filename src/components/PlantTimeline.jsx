import React, { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Droplets, FlaskConical, Sprout, Stethoscope, FileText, Trash2, RefreshCw, Leaf, Thermometer, ShieldAlert, Ghost, ImageIcon, MapPin, X, Check } from 'lucide-react'
import { makeId, today } from '../utils/plantTransform'
export { AddEventSheet, FAB } from './AddEventSheet'

// ── Helpers ────────────────────────────────────────────────────

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('lt-LT', { month: 'long', day: 'numeric' })
}

function formatDateShort(iso) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('lt-LT', { month: 'short', day: 'numeric' })
}

function daysBetween(newerIso, olderIso) {
  const a = new Date(newerIso + 'T00:00:00')
  const b = new Date(olderIso + 'T00:00:00')
  return Math.round((a - b) / (1000 * 60 * 60 * 24))
}

function formatDays(n) {
  // po 1 dienos / po 2 dienų (Lithuanian genitive)
  const form = (n % 10 === 1 && n % 100 !== 11) ? 'dienos' : 'dienų'
  return `po ${n} ${form}`
}

function formatDaysRelative(daysFromNow) {
  if (daysFromNow === 0)  return { label: 'šiandien',                     overdue: false }
  if (daysFromNow === 1)  return { label: 'rytoj',                        overdue: false }
  if (daysFromNow === -1) return { label: 'vėluoja 1 dieną',              overdue: true  }
  if (daysFromNow > 1)    return { label: formatDays(daysFromNow),        overdue: false }
  return { label: `vėluoja ${formatDays(-daysFromNow).replace('po ', '')}`, overdue: true }
}

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// Returns predictions for types with ≥ 2 events
function computePredictions(events) {
  const PREDICTABLE = ['watering', 'fertilizing', 'repotting']
  const byType = {}

  for (const e of events) {
    if (!PREDICTABLE.includes(e.type)) continue
    ;(byType[e.type] = byType[e.type] ?? []).push(e)
  }

  const todayIso = today()
  const predictions = []

  for (const [type, list] of Object.entries(byType)) {
    if (list.length < 2) continue

    // Average interval (list is newest-first)
    const gaps = []
    for (let i = 0; i < list.length - 1; i++) {
      gaps.push(daysBetween(list[i].date, list[i + 1].date))
    }
    const avgInterval = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)
    if (avgInterval === 0) continue
    const predictedDate = addDays(list[0].date, avgInterval)
    const daysFromNow = daysBetween(predictedDate, todayIso)

    predictions.push({ type, predictedDate, daysFromNow, avgInterval })
  }

  // Overdue first, then soonest future
  return predictions.sort((a, b) => a.daysFromNow - b.daysFromNow)
}

// For each event (newest-first array), find gap in days from previous same-type event
function computeGaps(events) {
  const gaps = {}
  for (let i = 0; i < events.length; i++) {
    for (let j = i + 1; j < events.length; j++) {
      if (events[j].type === events[i].type) {
        gaps[events[i].id] = daysBetween(events[i].date, events[j].date)
        break
      }
    }
  }
  return gaps
}

// Brandbook v1.0 — visi events tik forest + terracotta + bone tonais.
// Water=forest (gyvybė), fert/repot/treatment=terracotta (žemė/warmth),
// note/photo/move/inspection=neutral bone+forest.
const EVENT_META = {
  watering:     { icon: <Droplets size={13} />,     label: 'Laistymas',    color: 'bg-forest-50',     border: 'border-forest-100',     text: 'text-forest-600' },
  fertilizing:  { icon: <FlaskConical size={13} />, label: 'Trąšos',       color: 'bg-terracotta-50', border: 'border-terracotta-100', text: 'text-terracotta-600' },
  repotting:    { icon: <Sprout size={13} />,       label: 'Persodinimas', color: 'bg-terracotta-50', border: 'border-terracotta-100', text: 'text-terracotta-600' },
  treatment:    { icon: <Stethoscope size={13} />,  label: 'Gydymas',      color: 'bg-terracotta-50', border: 'border-terracotta-200', text: 'text-terracotta-600' },
  note:         { icon: <FileText size={13} />,     label: 'Pastaba',      color: 'bg-bone-300/40',   border: 'border-bone-400/40',    text: 'text-forest-600' },
  photo:        { icon: <Camera size={13} />,       label: 'Nuotrauka',    color: 'bg-forest-50',     border: 'border-forest-100',     text: 'text-forest-600' },
  statusChange: { icon: <RefreshCw size={13} />,    label: 'Būsena',       color: 'bg-bone-300/40',   border: 'border-bone-400/40',    text: 'text-forest-500' },
  move:         { icon: <MapPin size={13} />,       label: 'Perkėlimas',   color: 'bg-forest-50',     border: 'border-forest-100',     text: 'text-forest-600' },
  inspection:   { icon: <Check size={13} />,        label: 'Patikrinta',   color: 'bg-forest-50',     border: 'border-forest-100',     text: 'text-forest-700' },
}

// Status periods — sick (terracotta light) vs quarantine (terracotta solid).
const STATUS_PERIOD_META = {
  sick:       { line: 'bg-terracotta-200', bg: 'bg-terracotta-50/40', border: 'border-terracotta-200/60' },
  quarantine: { line: 'bg-terracotta',     bg: 'bg-terracotta-50/60', border: 'border-terracotta/40' },
}

// Status changes — healthy=forest (good), sick=terracotta light, quarantine=terracotta solid.
const STATUS_CHANGE_META = {
  healthy:    { icon: <Leaf size={13} />,        label: 'Pasveiko',   bg: 'bg-forest-50',     border: 'border-forest-200',     text: 'text-forest-700',     line: 'bg-forest-300' },
  sick:       { icon: <Thermometer size={13} />, label: 'Dėmesio',    bg: 'bg-terracotta-50', border: 'border-terracotta-200', text: 'text-terracotta-600', line: 'bg-terracotta-200' },
  quarantine: { icon: <ShieldAlert size={13} />, label: 'Karantinas', bg: 'bg-terracotta-50', border: 'border-terracotta/40',  text: 'text-terracotta-600', line: 'bg-terracotta' },
}

// Compute period status for each event (newest-first array)
// Returns map: eventId → status that was active at that point in time
function computeEventPeriods(events) {
  // events is newest→oldest; iterate oldest→newest so we know the active
  // status before each event is added, not after
  const isSickOrQ = s => s === 'sick' || s === 'quarantine'
  const periods = {}
  let currentStatus = 'healthy'
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]
    if (e.type === 'statusChange') {
      // Transition OUT of sick/quarantine → assign to fromStatus so the
      // "Pasveiko" / "Sveika" banner stays inside the colored block
      if (isSickOrQ(e.fromStatus) && !isSickOrQ(e.toStatus)) {
        periods[e.id] = e.fromStatus
      } else {
        periods[e.id] = e.toStatus
      }
      currentStatus = e.toStatus
    } else {
      periods[e.id] = currentStatus
    }
  }
  return periods
}

// ── Ghost event (prediction) ──────────────────────────────────

function GhostEvent({ prediction }) {
  const meta = EVENT_META[prediction.type]
  const { label: timeLabel, overdue } = formatDaysRelative(prediction.daysFromNow)

  return (
    <motion.div
      className="relative pl-10 mb-3"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      {/* Pulsing ghost node */}
      <div className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-7 h-7 rounded-full border-2 border-dashed flex items-center justify-center text-sm
        animate-pulse ${overdue ? 'border-terracotta/60 bg-terracotta-50' : 'border-bone-400 bg-bone'}`}
      >
        {meta.icon}
      </div>

      {/* Ghost pill */}
      <div className={`flex items-center gap-2 border border-dashed rounded-xl px-3 py-2 opacity-70
        ${overdue
          ? 'bg-terracotta-50/60 border-terracotta-200'
          : 'bg-bone-300/40 border-bone-400/60'
        }`}
      >
        <span className={`text-xs font-semibold ${overdue ? 'text-terracotta-600' : 'text-forest-500'}`}>
          {meta.label}
        </span>
        <span className={`text-xs ${overdue ? 'text-terracotta-500' : 'text-forest-400'}`}>
          · {timeLabel}
        </span>
        <span className="font-mono text-[10px] text-forest-400 ml-auto">
          ~kas {prediction.avgInterval} d.
        </span>
      </div>
    </motion.div>
  )
}

// ── Status change banner ──────────────────────────────────────

function StatusChangeEvent({ event, index, inPeriod }) {
  const meta = STATUS_CHANGE_META[event.toStatus] ?? STATUS_CHANGE_META.healthy
  const fromMeta = STATUS_CHANGE_META[event.fromStatus]

  return (
    <motion.div
      className="relative pl-10 mb-3"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: 'easeOut' }}
    >
      {/* Node */}
      <div className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-7 h-7 rounded-full flex items-center justify-center text-sm border-2 border-white shadow-sm z-10 ${meta.bg}`}>
        {meta.icon}
      </div>
      {/* Banner — no own bg when inside a period wrapper */}
      <div className={inPeriod ? 'px-3 py-2' : `${meta.bg} border ${meta.border} rounded-xl px-3 py-2`}>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${meta.text}`}>{meta.label}</span>
          {fromMeta && <span className="font-mono text-[10px] text-forest-400">← {fromMeta.label}</span>}
          <span className="font-mono text-[10px] text-forest-400 ml-auto">{formatDateShort(event.date)}</span>
        </div>
        {(event.disease || event.issue) && (
          <p className="text-[11px] text-forest-600 mt-0.5">{event.disease || event.issue}</p>
        )}
        {event.isolated != null && (
          <p className="text-[10px] text-forest-500 mt-0.5">{event.isolated ? '✓ Izoliuotas' : '✗ Neizoliuotas'}</p>
        )}
      </div>
    </motion.div>
  )
}

// ── Death event banner ────────────────────────────────────────

function DeathEvent({ event, index }) {
  return (
    <motion.div
      className="relative pl-10 mb-4"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: 'easeOut' }}
    >
      {/* Node — forest INK (final, gravity) */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-7 h-7 rounded-full bg-forest-800 flex items-center justify-center border-2 border-bone shadow-sm z-10 text-bone">
        <Ghost size={13} />
      </div>
      {/* Wide banner — Forest INK, like brandbook Cover */}
      <div className="bg-forest-800 rounded-2xl px-4 py-3.5">
        <div className="flex items-center justify-between mb-1">
          <span className="font-display text-sm font-bold text-bone tracking-tight">Augalas numirė</span>
          <span className="font-mono text-[10px] text-bone/55 uppercase tracking-[0.14em]">{formatDateShort(event.date)}</span>
        </div>
        {event.deathReason && (
          <p className="text-xs text-bone/75 leading-snug">
            <span className="font-mono text-[10px] text-bone/55 uppercase tracking-[0.14em]">Priežastis: </span>{event.deathReason}
          </p>
        )}
        {event.lesson && (
          <p className="text-xs text-bone/75 mt-1 leading-snug">
            <span className="font-mono text-[10px] text-bone/55 uppercase tracking-[0.14em]">Pamoka: </span>{event.lesson}
          </p>
        )}
      </div>
    </motion.div>
  )
}

// ── Tooltip (Apple Maps style) ─────────────────────────────────

function Tooltip({ event, onDelete, zones = [] }) {
  const meta = EVENT_META[event.type] ?? EVENT_META.note
  return (
    <motion.div
      className="w-52"
      initial={{ opacity: 0, scale: 0.88, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.88, y: -6 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      style={{ originY: 0, originX: 0 }}
    >
      {/* Arrow pointing UP toward the node */}
      <div className="flex justify-start pl-2.5 -mb-px">
        <div className={`w-3 h-3 rotate-45 ${meta.color} border-t border-l ${meta.border}`} />
      </div>
      <div className={`${meta.color} border ${meta.border} rounded-2xl px-3 py-2.5 shadow-lg`}>
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className={`text-[11px] font-bold uppercase tracking-wide ${meta.text}`}>
            {meta.icon} {meta.label}
          </span>
          <button
            onClick={onDelete}
            className="text-forest-400 hover:text-terracotta-500 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
        <p className="font-mono text-[10px] text-forest-500 uppercase tracking-[0.14em]">{formatDate(event.date)}</p>
        {event.note && <p className="text-xs text-forest-700 mt-1 leading-snug">{event.note}</p>}
        {event.type !== 'watering' && event.amount && <p className="text-xs text-forest-600 mt-0.5">{event.amount}</p>}
        {event.fertilizer && <p className="text-xs text-forest-600 mt-0.5">🧪 {event.fertilizer}</p>}
        {event.potSize && <p className="text-xs text-forest-600 mt-0.5">📏 {event.potSize}</p>}
        {event.preparatas && <p className="text-xs text-forest-600 mt-0.5">💊 {event.preparatas}</p>}
        {event.tikslas && <p className="text-xs text-forest-600 mt-0.5">🎯 {event.tikslas}</p>}
        {event.metodas && <p className="text-xs text-gray-600 mt-0.5">🔧 {event.metodas}</p>}
        {event.disease && <p className="text-xs text-gray-600 mt-0.5">🦠 {event.disease}</p>}
        {event.issue && <p className="text-xs text-gray-600 mt-0.5">⚠️ {event.issue}</p>}
        {event.isolated != null && (
          <p className="text-xs text-gray-600 mt-0.5">{event.isolated ? '✓ Izoliuotas' : '✗ Neizoliuotas'}</p>
        )}
        {event.type === 'move' && (
          <p className="text-xs text-forest-700 mt-1">
            {event.fromZoneId ? (zones.find(z => z.id === event.fromZoneId)?.name ?? '?') : 'Nepriskirta'}
            {' → '}
            {event.toZoneId ? (zones.find(z => z.id === event.toZoneId)?.name ?? '?') : 'Nepriskirta'}
          </p>
        )}
      </div>
    </motion.div>
  )
}

// ── Timeline event nodes ───────────────────────────────────────

const NO_CALLOUT = { WebkitTouchCallout: 'none', userSelect: 'none' }

function PhotoEvent({ event, index, daysSince, showTooltip, onToggle, onDelete, onSetAsProfile, inPeriod }) {
  const [imgError, setImgError] = useState(false)
  const [setAsProfileDone, setSetAsProfileDone] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  const longPressTimer = useRef(null)
  const startPos       = useRef(null)
  const didLongPress   = useRef(false)

  const onPressStart = (e) => {
    didLongPress.current = false
    startPos.current = { x: e.clientX, y: e.clientY }
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      setZoomed(true)
      navigator.vibrate?.(30)
    }, 450)
  }
  const onPressMove = (e) => {
    if (!longPressTimer.current) return
    const dx = e.clientX - (startPos.current?.x ?? e.clientX)
    const dy = e.clientY - (startPos.current?.y ?? e.clientY)
    if (dx * dx + dy * dy > 100) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
  }
  const onPressEnd = () => { clearTimeout(longPressTimer.current); longPressTimer.current = null }
  const handleCardClick = () => { if (didLongPress.current) return; onToggle() }

  const handleSetAsProfile = (e) => {
    e.stopPropagation()
    onSetAsProfile?.(event.imageUrl)
    setSetAsProfileDone(true)
    setTimeout(() => setSetAsProfileDone(false), 2000)
  }

  return (
    <>
    <motion.div
      className="relative pl-10 mb-4"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: 'easeOut' }}
    >
      {/* Node on the line */}
      <button
        onClick={onToggle}
        className="absolute left-0 top-4 w-7 h-7 bg-white border-2 border-forest-300 rounded-full flex items-center justify-center shadow-sm z-10 -translate-x-3 text-forest-500"
      >
        <Camera size={13} />
      </button>

      {/* Tooltip — vertically centered on the card */}
      <AnimatePresence>
        {showTooltip && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 mt-0 z-20">
            <Tooltip
              event={event}
              onDelete={() => { onDelete(event.id); onToggle() }}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Photo card */}
      {event.imageUrl && !imgError ? (
        <div
          className="rounded-2xl overflow-hidden shadow-sm border border-warm-border aspect-[4/3] cursor-pointer relative"
          onClick={handleCardClick}
          onPointerDown={onPressStart}
          onPointerMove={onPressMove}
          onPointerUp={onPressEnd}
          onPointerCancel={onPressEnd}
          onContextMenu={e => e.preventDefault()}
          style={NO_CALLOUT}
        >
          <img
            src={event.imageUrl}
            alt="augalo nuotrauka"
            className="w-full h-full object-cover pointer-events-none"
            style={NO_CALLOUT}
            onError={() => setImgError(true)}
          />
          {/* Bottom overlay row */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-2 py-1.5 bg-gradient-to-t from-black/40 to-transparent">
            {daysSince != null && (
              <span className="text-[11px] text-white/90 font-medium">{formatDays(daysSince)}</span>
            )}
            {onSetAsProfile && (
              <button
                onClick={handleSetAsProfile}
                className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                  setAsProfileDone
                    ? 'bg-forest-500 text-white'
                    : 'bg-black/40 text-white/90 active:bg-black/60'
                }`}
              >
                <ImageIcon size={10} />
                {setAsProfileDone ? 'Nustatyta!' : 'Profilis'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          className="bg-forest-50 border border-forest-100 rounded-2xl px-4 py-3 cursor-pointer"
          onClick={onToggle}
        >
          <p className="text-sm text-forest-600 font-medium">
            Nuotrauka{daysSince != null && <span className="text-forest-400 font-normal"> ({formatDays(daysSince)})</span>}
          </p>
          {event.note && <p className="text-xs text-gray-500 mt-0.5">{event.note}</p>}
        </div>
      )}
    </motion.div>

    {/* Full-screen zoom portal */}
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
              src={event.imageUrl}
              alt="augalo nuotrauka"
              className="max-w-full max-h-[80dvh] object-contain pointer-events-none"
              style={NO_CALLOUT}
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.88, opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            />
            {event.note && (
              <div className="absolute bottom-16 left-0 right-0 text-center px-6 pointer-events-none">
                <p className="text-white/70 text-sm leading-snug">{event.note}</p>
              </div>
            )}
            <button
              className="absolute top-14 right-4 w-9 h-9 rounded-btn bg-white/10 flex items-center justify-center"
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
}

function ActionEvent({ event, index, daysSince, showTooltip, onToggle, onDelete, inPeriod, zones = [] }) {
  const meta = EVENT_META[event.type] ?? EVENT_META.note
  const isToday = event.date === today()

  // Pill stilius: today highlight (forest) > period wrapper > default (bone)
  const pillClass = isToday
    ? 'bg-forest-50 border border-forest-200'
    : inPeriod
      ? 'bg-transparent'
      : 'bg-bone border border-bone-400/40'

  // Node border'as: today → forest
  const nodeBorder = isToday ? 'border-forest-300' : 'border-bone-400/60'

  return (
    <motion.div
      className="relative pl-10 mb-3"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: 'easeOut' }}
    >
      {/* Node */}
      <button
        onClick={onToggle}
        className={`absolute left-0 top-1/2 -translate-y-1/2 w-7 h-7 bg-bone border-2 ${nodeBorder} rounded-full flex items-center justify-center text-sm shadow-sm z-10 -translate-x-3 active:scale-90 transition-transform ${meta.text}`}
      >
        {meta.icon}
      </button>

      {/* Tooltip — vertically centered on the pill */}
      <AnimatePresence>
        {showTooltip && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 z-20">
            <Tooltip
              event={event}
              onDelete={() => { onDelete(event.id); onToggle() }}
              zones={zones}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Pill */}
      <div
        className={`flex items-center gap-2 rounded-xl px-3 py-2 cursor-pointer active:opacity-70 transition-opacity ${pillClass}`}
        onClick={onToggle}
      >
        <span className={`text-xs font-semibold ${meta.text}`}>
          {meta.icon} {meta.label}
          {daysSince != null && (
            <span className="font-normal ml-1 text-forest-400">({formatDays(daysSince)})</span>
          )}
        </span>
        {event.amount && <span className="text-xs text-forest-400">· {event.amount}</span>}
        {event.fertilizer && <span className="text-xs text-forest-400">· {event.fertilizer}</span>}
        {event.potSize && <span className="text-xs text-forest-400">· {event.potSize}</span>}
        {event.preparatas && <span className="text-xs text-forest-400">· {event.preparatas}</span>}
        {event.tikslas && !event.preparatas && <span className="text-xs text-forest-400">· {event.tikslas}</span>}
        {event.type === 'move' && (
          <span className="text-xs text-forest-400 truncate max-w-[140px]">
            · {event.fromZoneId ? (zones.find(z => z.id === event.fromZoneId)?.name ?? '?') : '—'}
            {' → '}
            {event.toZoneId ? (zones.find(z => z.id === event.toZoneId)?.name ?? '?') : '—'}
          </span>
        )}
        {event.note && !event.amount && !event.fertilizer && !event.potSize && !event.preparatas && event.type !== 'move' && (
          <span className="text-xs text-forest-400 truncate max-w-[120px]">· {event.note}</span>
        )}
      </div>
    </motion.div>
  )
}

// ── Watering run grouping ─────────────────────────────────────
// Groups consecutive watering-only events (same period, separated only by
// date separators) into a collapsible wateringRun meta-item.

function groupWaterings(rendered, eventPeriods) {
  const result = []
  let runItems = null   // items in current run (seps + event items interleaved)
  let runPeriod = null
  let pendingSeps = []  // seps buffered between events

  const flushRun = () => {
    if (!runItems) return
    const evItems = runItems.filter(i => i.kind === 'event')
    if (evItems.length >= 2) {
      result.push({
        kind: 'wateringRun',
        items: runItems,
        period: runPeriod,
        key: 'wrun-' + evItems[0].key,
        dateNewest: evItems[0].event.date,
        dateOldest: evItems[evItems.length - 1].event.date,
        count: evItems.length,
      })
    } else {
      // Single watering — emit its buffered seps + the event normally
      runItems.forEach(i => result.push(i))
    }
    runItems = null
    runPeriod = null
  }

  for (const item of rendered) {
    if (item.kind === 'separator') {
      pendingSeps.push(item)
      continue
    }
    const period = eventPeriods[item.event.id] ?? 'healthy'
    if (item.event.type === 'watering') {
      if (runItems && runPeriod === period) {
        // Continue existing run — absorb buffered seps
        pendingSeps.forEach(s => runItems.push(s))
        pendingSeps = []
        runItems.push(item)
      } else {
        // Different period or no run yet — flush and start fresh
        flushRun()
        pendingSeps.forEach(s => result.push(s))
        pendingSeps = []
        runItems = []
        runPeriod = period
        runItems.push(item)
      }
    } else {
      // Non-watering event breaks the run
      flushRun()
      pendingSeps.forEach(s => result.push(s))
      pendingSeps = []
      result.push(item)
    }
  }
  flushRun()
  pendingSeps.forEach(s => result.push(s))
  return result
}

// ── WateringRun component ─────────────────────────────────────

function WateringRun({ run, expanded, onToggle, gaps, activeTooltip, onTooltipToggle, onDeleteEvent, inPeriod }) {
  const pill = (content) => (
    <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${inPeriod ? 'bg-transparent' : 'bg-bone border border-bone-400/40'}`}>
      {content}
    </div>
  )

  if (!expanded) {
    return (
      <motion.div
        className="relative pl-10 mb-3"
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-7 h-7 bg-bone border-2 border-bone-400/60 rounded-full flex items-center justify-center text-sm shadow-sm z-10 text-forest-600">
          <Droplets size={13} />
        </div>
        <button className="w-full text-left" onClick={onToggle}>
          {pill(
            <>
              <span className="text-xs font-semibold text-forest-600">
                <Droplets size={11} className="inline mr-1 align-text-bottom" /> Laistymas
                <span className="font-normal text-forest-400 ml-1">
                  · {formatDateShort(run.dateOldest)} – {formatDateShort(run.dateNewest)} · {run.count}×
                </span>
              </span>
              <span className="ml-auto text-forest-400 text-xs">▾</span>
            </>
          )}
        </button>
      </motion.div>
    )
  }

  // Expanded — render all individual items + a collapse link
  return (
    <div>
      {run.items.map(item => {
        if (item.kind === 'separator') {
          return (
            <motion.div key={item.key} className="relative pl-10 mb-2 mt-4"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
              <span className="font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.18em]">
                {formatDateShort(item.date)}
              </span>
            </motion.div>
          )
        }
        return (
          <ActionEvent
            key={item.key}
            event={item.event}
            index={item.index}
            daysSince={gaps[item.event.id]}
            showTooltip={activeTooltip === item.event.id}
            onToggle={() => onTooltipToggle(item.event.id)}
            onDelete={onDeleteEvent}
            inPeriod={inPeriod}
          />
        )
      })}
      <div className="relative pl-10 mb-3">
        <button onClick={onToggle} className="font-mono text-[10px] text-forest-400 hover:text-forest-600 uppercase tracking-[0.14em] transition-colors">
          ▴ Sutraukti
        </button>
      </div>
    </div>
  )
}

// ── Main timeline component ────────────────────────────────────

export default function PlantTimeline({ plant, onAddEvent, onDeleteEvent, onSetAsProfilePhoto, zones = [] }) {
  const [activeTooltip, setActiveTooltip] = useState(null) // one at a time
  const [runExpanded, setRunExpanded]     = useState({})   // runKey → bool override
  const [photosOnly, setPhotosOnly]       = useState(false)
  const allEvents = plant.timeline ?? []
  const events = photosOnly ? allEvents.filter(e => e.type === 'photo') : allEvents
  const gaps = computeGaps(events)
  const predictions = computePredictions(events)
  const eventPeriods = computeEventPeriods(events)

  const toggleTooltip = (id) =>
    setActiveTooltip(prev => (prev === id ? null : id))

  // Group events by date for separators
  const rendered = []
  let lastDate = null

  events.forEach((event, i) => {
    if (event.date !== lastDate) {
      rendered.push({ kind: 'separator', date: event.date, key: `sep-${event.date}-${i}` })
      lastDate = event.date
    }
    rendered.push({ kind: 'event', event, key: event.id, index: i })
  })

  return (
    <div className="relative min-h-full flex flex-col">
      {events.length === 0 ? (
        /* Empty state */
        <div className="flex-1 flex flex-col items-center justify-center py-16 px-8 text-center gap-3">
          <Sprout size={48} className="text-forest-300" />
          <div>
            <p className="font-display text-base font-bold text-forest-700 tracking-tight">Istorija tuščia</p>
            <p className="text-sm text-forest-500 mt-1 leading-snug">
              Pradėkite nuo persodinimo — paspauskite <span className="font-semibold text-forest-600">+</span> apačioje
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 px-5 pt-4 pb-6 relative">
          {/* Photo filter toggle */}
          {allEvents.some(e => e.type === 'photo') && (
            <div className="flex justify-end mb-3">
              <button
                onClick={() => setPhotosOnly(v => !v)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                  photosOnly ? 'bg-forest-600 text-bone' : 'bg-bone-300/60 text-forest-600'
                }`}
              >
                <Camera size={12} />
                Tik nuotraukos
              </button>
            </div>
          )}

          {/* Vertical timeline line */}
          <div className="absolute left-8 top-0 bottom-0 w-px bg-forest-100" />

          {/* ── Ghost events (predictions) ── */}
          {predictions.length > 0 && (
            <>
              <div className="relative pl-10 mb-2">
                <span className="font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.18em]">
                  ✦ Prognozė
                </span>
              </div>
              {predictions.map(p => (
                <GhostEvent key={p.type} prediction={p} />
              ))}
              {/* "Today" divider */}
              <div className="relative pl-10 mt-3 mb-4 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-forest-500 absolute left-0 -translate-x-[3px]" />
                <span className="font-mono text-[10px] font-medium text-forest-600 uppercase tracking-[0.18em]">
                  Šiandien
                </span>
                <div className="flex-1 h-px bg-forest-200/60" />
              </div>
            </>
          )}

          {(() => {
            // Pre-group consecutive watering events into collapsible runs,
            // then buffer separators inside period groups for visual continuity.
            const grouped = groupWaterings(rendered, eventPeriods)

            const segments = []
            let currentGroup = null  // { period, items[] }
            let pendingSep   = null  // buffered separator waiting for next event

            const flushGroup = () => {
              if (currentGroup) {
                segments.push({ kind: 'group', period: currentGroup.period, items: currentGroup.items })
                currentGroup = null
              }
            }

            for (const item of grouped) {
              if (item.kind === 'separator') {
                pendingSep = item
                continue
              }

              // wateringRun items carry their own .period; event items use eventPeriods map
              const period = item.kind === 'wateringRun'
                ? item.period
                : (eventPeriods[item.event.id] ?? 'healthy')

              if (currentGroup && currentGroup.period === period) {
                if (pendingSep) { currentGroup.items.push(pendingSep); pendingSep = null }
                currentGroup.items.push(item)
              } else {
                flushGroup()
                currentGroup = { period, items: [] }
                if (pendingSep) { currentGroup.items.push(pendingSep); pendingSep = null }
                currentGroup.items.push(item)
              }
            }
            if (pendingSep && currentGroup) currentGroup.items.push(pendingSep)
            flushGroup()

            // Find first (most-recent) wateringRun key — it defaults to expanded
            let firstRunKey = null
            outer: for (const seg of segments) {
              for (const item of seg.items) {
                if (item.kind === 'wateringRun') { firstRunKey = item.key; break outer }
              }
            }

            const PERIOD_WRAP = {
              sick:       'bg-terracotta-50/40 border border-terracotta-200/50 rounded-2xl -mx-1 px-1 pt-3 mb-3',
              quarantine: 'bg-terracotta-50/60 border border-terracotta/30 rounded-2xl -mx-1 px-1 pt-3 mb-3',
            }

            const renderSeparator = (sep) => (
              <motion.div
                key={sep.key}
                className="relative pl-10 mb-2 mt-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
              >
                <span className="font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.18em]">
                  {formatDateShort(sep.date)}
                </span>
              </motion.div>
            )

            return segments.map((seg, si) => {
              const { period, items } = seg
              const wrapClass = PERIOD_WRAP[period]
              const inPeriod = !!wrapClass

              const nodes = items.map(item => {
                if (item.kind === 'separator') return renderSeparator(item)

                if (item.kind === 'wateringRun') {
                  const isFirst = item.key === firstRunKey
                  const expanded = runExpanded[item.key] !== undefined ? runExpanded[item.key] : isFirst
                  return (
                    <WateringRun
                      key={item.key}
                      run={item}
                      expanded={expanded}
                      onToggle={() => setRunExpanded(prev => ({ ...prev, [item.key]: !expanded }))}
                      gaps={gaps}
                      activeTooltip={activeTooltip}
                      onTooltipToggle={toggleTooltip}
                      onDeleteEvent={onDeleteEvent}
                      inPeriod={inPeriod}
                    />
                  )
                }

                const { event, index } = item
                if (event.type === 'death') {
                  return <DeathEvent key={item.key} event={event} index={index} />
                }
                if (event.type === 'statusChange') {
                  return <StatusChangeEvent key={item.key} event={event} index={index} inPeriod={inPeriod} />
                }
                if (event.type === 'photo') {
                  return (
                    <PhotoEvent key={item.key} event={event} index={index}
                      daysSince={gaps[event.id]}
                      showTooltip={activeTooltip === event.id}
                      onToggle={() => toggleTooltip(event.id)}
                      onDelete={onDeleteEvent}
                      onSetAsProfile={onSetAsProfilePhoto}
                      inPeriod={inPeriod}
                    />
                  )
                }
                return (
                  <ActionEvent key={item.key} event={event} index={index}
                    daysSince={gaps[event.id]}
                    showTooltip={activeTooltip === event.id}
                    onToggle={() => toggleTooltip(event.id)}
                    onDelete={onDeleteEvent}
                    inPeriod={inPeriod}
                    zones={zones}
                  />
                )
              })

              if (wrapClass) {
                return <div key={`group-${si}`} className={wrapClass}>{nodes}</div>
              }
              return <React.Fragment key={`group-${si}`}>{nodes}</React.Fragment>
            })
          })()}
        </div>
      )}

    </div>
  )
}
