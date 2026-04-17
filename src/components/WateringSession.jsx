import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Droplets, FlaskConical, CheckCircle2, MapPin, ShieldAlert, Settings2, Leaf } from 'lucide-react'
import { getWateringForecast } from '../utils/wateringForecast'
import { getFertilizingForecast } from '../utils/fertilizingForecast'
import { makeId, today } from '../utils/plantTransform'

import { ZoneManagerSheet } from './ZoneManager'

function daysSince(dateStr) {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr + 'T00:00:00')) / 86400000)
}

function PlantTile({ plant, checked, onToggle, onLongPress }) {
  const wc = getWateringForecast(plant)
  const fc = getFertilizingForecast(plant)
  const waterDays = wc.lastDate ? daysSince(wc.lastDate) : null
  const fertLastDate = (plant.timeline ?? [])
    .filter(e => e.type === 'fertilizing')
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0]?.date
  const fertDays = fertLastDate ? daysSince(fertLastDate) : null

  const timerRef = useRef(null)

  const startPress = () => {
    timerRef.current = setTimeout(() => onLongPress(plant), 400)
  }
  const cancelPress = () => clearTimeout(timerRef.current)

  return (
    <button
      onClick={onToggle}
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      className={`relative rounded-2xl overflow-hidden aspect-square w-full transition-opacity ${
        checked ? 'opacity-100' : 'opacity-70'
      }`}
    >
      {/* Photo */}
      <div className="absolute inset-0 bg-surface-2">
        {plant.image
          ? <img src={plant.image} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-2xl">{plant.emoji ?? '🌿'}</div>
        }
      </div>

      {/* Bottom gradient + name */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-2 pt-6 pb-2 text-center">
        <p className="text-[13px] font-semibold text-white leading-tight">
          {plant.lietuviškas || plant.lotyniskas}
        </p>
        {plant.lotyniskas && plant.lietuviškas && (
          <p className="text-[10px] text-white/60 italic leading-tight mt-0.5 truncate">
            {plant.lotyniskas}
          </p>
        )}
      </div>

      {/* Top-right: selection circle */}
      <div className="absolute top-2 right-2">
        {checked
          ? <div className="w-6 h-6 rounded-full bg-sky-400 flex items-center justify-center shadow-md">
              <Droplets size={14} className="text-white" />
            </div>
          : <div className="w-6 h-6 rounded-full bg-black/30 border-2 border-white/80" />
        }
      </div>

      {/* Top-left: forecast icons */}
      <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
        <div className="flex items-center gap-0.5 bg-black/30 backdrop-blur-sm rounded-md px-1 py-0.5">
          <Droplets size={9} className={wc.isOverdue ? 'text-sky-300 fill-sky-300' : 'text-white/60'} />
          {waterDays != null && (
            <span className={`text-[8px] font-semibold leading-none ${wc.isOverdue ? 'text-sky-200' : 'text-white/60'}`}>
              {waterDays}d
            </span>
          )}
        </div>
        {fc?.intervalDays != null && (
          <div className="flex items-center gap-0.5 bg-black/30 backdrop-blur-sm rounded-md px-1 py-0.5">
            <FlaskConical size={9} className={fc.isOverdue ? 'text-amber-300 fill-amber-300' : 'text-white/60'} />
            {fertDays != null && (
              <span className={`text-[8px] font-semibold leading-none ${fc.isOverdue ? 'text-amber-200' : 'text-white/60'}`}>
                {fertDays}d
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  )
}

function PlantPreview({ plant, onClose }) {
  return (
    <motion.div
      className="fixed inset-0 z-[150] flex items-center justify-center p-8"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onPointerUp={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div
        className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        initial={{ scale: 0.85 }} animate={{ scale: 1 }} exit={{ scale: 0.85 }}
        transition={{ type: 'spring', damping: 22, stiffness: 300 }}
      >
        {plant.image
          ? <img src={plant.image} alt="" className="w-full aspect-square object-cover" />
          : <div className="w-full aspect-square bg-surface-2 flex items-center justify-center text-7xl">{plant.emoji ?? '🌿'}</div>
        }
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pt-10 pb-4">
          <p className="text-base font-bold text-white">{plant.lietuviškas || plant.lotyniskas}</p>
          {plant.lotyniskas && plant.lietuviškas && (
            <p className="text-xs text-white/60 italic mt-0.5">{plant.lotyniskas}</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function ZoneGroup({ label, plants, checked, onToggle, onLongPress, quarantine = false }) {
  const allOn = plants.every(p => checked[p.id])
  const toggleZone = () => {
    const next = !allOn
    plants.forEach(p => onToggle(p.id, next))
  }

  const headerColor = quarantine ? 'text-red-500' : label ? 'text-gray-600' : 'text-gray-400'
  const toggleColor = quarantine
    ? (allOn ? 'text-red-400' : 'text-red-300')
    : (allOn ? 'text-sky-400' : 'text-gray-400')

  return (
    <div className={quarantine ? 'bg-red-50 rounded-2xl p-3' : ''}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          {quarantine
            ? <><ShieldAlert size={11} className="text-red-400" /><p className={`text-xs font-bold uppercase tracking-wide ${headerColor}`}>Karantinas</p></>
            : label
              ? <><MapPin size={11} className="text-sage-400" /><p className={`text-xs font-bold uppercase tracking-wide ${headerColor}`}>{label}</p></>
              : <p className={`text-xs font-bold uppercase tracking-wide ${headerColor}`}>Nepriskirti</p>
          }
        </div>
        <button
          onClick={toggleZone}
          className={`text-[11px] font-semibold transition-colors ${toggleColor}`}
        >
          {allOn ? 'Atžymėti' : 'Žymėti visus'}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {plants.map(plant => (
          <PlantTile
            key={plant.id}
            plant={plant}
            checked={!!checked[plant.id]}
            onToggle={() => onToggle(plant.id, !checked[plant.id])}
            onLongPress={onLongPress}
          />
        ))}
      </div>
    </div>
  )
}

export default function WateringSession({ plants, zones, onAddTimelineEvent, onAddZone, onUpdateZone, onDeleteZone, onReorderZones, onClose }) {
  const activePlants = plants.filter(p => p.kategorija === 'auginama')

  const [checked, setChecked] = useState(() =>
    Object.fromEntries(activePlants.map(p => [p.id, false]))
  )
  const [done, setDone] = useState(null) // null | 'watering' | 'fertilizing'
  const [showZones, setShowZones] = useState(false)
  const [previewPlant, setPreviewPlant] = useState(null)

  const setOne = (id, val) => setChecked(prev => ({ ...prev, [id]: val }))

  const checkedCount = Object.values(checked).filter(Boolean).length

  const handleWater = () => {
    const todayStr = today()
    activePlants.forEach(p => {
      if (!checked[p.id]) return
      onAddTimelineEvent(p.id, { id: makeId(), type: 'watering', date: todayStr })
    })
    setDone('watering')
    setTimeout(onClose, 1400)
  }

  const handleFertilize = () => {
    const todayStr = today()
    activePlants.forEach(p => {
      if (!checked[p.id]) return
      onAddTimelineEvent(p.id, { id: makeId(), type: 'watering',    date: todayStr })
      onAddTimelineEvent(p.id, { id: makeId(), type: 'fertilizing', date: todayStr })
    })
    setDone('fertilizing')
    setTimeout(onClose, 1400)
  }

  // Quarantine separate
  const quarantinePlants = activePlants.filter(p => p.status === 'quarantine')
  const mainPlants = activePlants.filter(p => p.status !== 'quarantine')

  // Group main plants by zone
  const groups = []
  zones.forEach(zone => {
    const zp = mainPlants.filter(p => p.zonaId === zone.id)
    if (zp.length > 0) groups.push({ label: zone.name, plants: zp })
  })
  const unzoned = mainPlants.filter(p => !p.zonaId)
  if (unzoned.length > 0) groups.push({ label: null, plants: unzoned })

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center">
      <motion.div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }} onPointerDown={onClose}
      />
      <motion.div
        className="relative w-full max-w-[430px] bg-white rounded-t-4xl pt-3 pb-10 flex flex-col"
        style={{ maxHeight: '88dvh' }}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        onPointerDown={e => e.stopPropagation()}
      >
        <div className="flex justify-center pb-2">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 mb-4">
          <div className="flex items-center gap-2">
            <Leaf size={18} className="text-sage-500" />
            <h2 className="text-base font-bold text-gray-900">Priežiūros seansas</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowZones(true)}
              className="flex items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Settings2 size={14} />
              <span className="text-[11px] font-medium">Zonos</span>
            </button>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-gray-400">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-5">
          {quarantinePlants.length > 0 && (
            <ZoneGroup
              quarantine
              label={null}
              plants={quarantinePlants}
              checked={checked}
              onToggle={setOne}
              onLongPress={setPreviewPlant}
            />
          )}
          {groups.map(({ label, plants: gp }, gi) => (
            <ZoneGroup
              key={gi}
              label={label}
              plants={gp}
              checked={checked}
              onToggle={setOne}
              onLongPress={setPreviewPlant}
            />
          ))}
        </div>

        <div className="px-4 pt-3">
          <AnimatePresence mode="wait">
            {done ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 ${
                  done === 'fertilizing' ? 'bg-amber-50' : 'bg-sky-50'
                }`}
              >
                <CheckCircle2 size={18} className={done === 'fertilizing' ? 'text-amber-500' : 'text-sky-400'} />
                <span className={`text-sm font-semibold ${done === 'fertilizing' ? 'text-amber-700' : 'text-sky-600'}`}>
                  {done === 'fertilizing' ? 'Laistymas + trąšos' : 'Laistymas'} — {checkedCount} augal{checkedCount === 1 ? 'as' : 'ai'}!
                </span>
              </motion.div>
            ) : (
              <motion.div key="btns" className="flex gap-2">
                <button
                  onClick={handleWater}
                  disabled={checkedCount === 0}
                  className="flex-1 py-4 rounded-2xl text-sm font-bold text-white bg-sky-400 disabled:opacity-40 flex items-center justify-center gap-2 active:bg-sky-500 transition-colors"
                >
                  <Droplets size={16} />
                  Laistyti{checkedCount > 0 ? ` ${checkedCount}` : ''}
                </button>
                <button
                  onClick={handleFertilize}
                  disabled={checkedCount === 0}
                  className="flex-1 py-4 rounded-2xl text-sm font-bold text-white bg-amber-500 disabled:opacity-40 flex items-center justify-center gap-2 active:bg-amber-600 transition-colors"
                >
                  <FlaskConical size={16} />
                  Tręšti{checkedCount > 0 ? ` ${checkedCount}` : ''}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <AnimatePresence>
        {showZones && (
          <ZoneManagerSheet
            key="zones"
            zones={zones}
            plants={plants}
            onAdd={onAddZone}
            onUpdate={onUpdateZone}
            onDelete={onDeleteZone}
            onReorder={onReorderZones}
            onClose={() => setShowZones(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {previewPlant && (
          <PlantPreview
            key="preview"
            plant={previewPlant}
            onClose={() => setPreviewPlant(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
