import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Droplets, CheckCircle2, MapPin, ShieldAlert, Settings2 } from 'lucide-react'
import { getWateringForecast } from '../utils/wateringForecast'
import { ZoneManagerSheet } from './ZoneManager'

function daysSince(dateStr) {
  if (!dateStr) return null
  return Math.floor((new Date() - new Date(dateStr)) / 86400000)
}

function PlantTile({ plant, checked, onToggle }) {
  const wc = getWateringForecast(plant)
  const days = wc.lastDate ? daysSince(wc.lastDate) : null
  const overdue = wc.isOverdue

  return (
    <button
      onClick={onToggle}
      className={`relative rounded-2xl overflow-hidden aspect-square w-full transition-opacity ${
        checked ? 'opacity-100' : 'opacity-70'
      }`}
    >
      {/* Photo fills entire card */}
      <div className="absolute inset-0 bg-surface-2">
        {plant.image
          ? <img src={plant.image} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-2xl">{plant.emoji ?? '🌿'}</div>
        }
      </div>

      {/* Gradient overlay at bottom */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-2 pt-6 pb-2 text-center">
        <p className="text-[13px] font-semibold text-white leading-tight">
          {plant.lietuviškas || plant.lotyniskas}
        </p>
        <p className={`text-[11px] leading-tight mt-0.5 ${overdue ? 'text-orange-300 font-semibold' : 'text-white/70'}`}>
          {days == null
            ? '—'
            : overdue
              ? `+${Math.abs(wc.daysUntil)}d`
              : days === 0 ? 'šiandien' : `${days}d`
          }
        </p>
      </div>

      {/* Watering indicator */}
      <div className="absolute top-2 right-2">
        {checked
          ? <div className="w-6 h-6 rounded-full bg-sky-400 flex items-center justify-center shadow-md">
              <Droplets size={14} className="text-white" />
            </div>
          : <div className="w-6 h-6 rounded-full bg-black/30 border-2 border-white/80" />
        }
      </div>
    </button>
  )
}

function ZoneGroup({ label, plants, checked, onToggle, quarantine = false }) {
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
          />
        ))}
      </div>
    </div>
  )
}

export default function WateringSession({ plants, zones, onAddTimelineEvent, onAddZone, onUpdateZone, onDeleteZone, onReorderZones, onClose }) {
  const today = new Date().toISOString().slice(0, 10)
  const makeId = () => Math.random().toString(36).slice(2, 10)

  const activePlants = plants.filter(p => p.kategorija === 'auginama')

  const [checked, setChecked] = useState(() =>
    Object.fromEntries(activePlants.map(p => [p.id, false]))
  )
  const [done, setDone] = useState(false)
  const [showZones, setShowZones] = useState(false)

  const setOne = (id, val) => setChecked(prev => ({ ...prev, [id]: val }))

  const checkedCount = Object.values(checked).filter(Boolean).length

  const handleConfirm = () => {
    activePlants.forEach(p => {
      if (!checked[p.id]) return
      onAddTimelineEvent(p.id, { id: makeId(), type: 'watering', date: today })
    })
    setDone(true)
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
            <Droplets size={18} className="text-sky-400" />
            <h2 className="text-base font-bold text-gray-900">Laistymo seansas</h2>
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
            />
          )}
          {groups.map(({ label, plants: gp }, gi) => (
            <ZoneGroup
              key={gi}
              label={label}
              plants={gp}
              checked={checked}
              onToggle={setOne}
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
                className="w-full py-4 rounded-2xl bg-sky-50 flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} className="text-sky-400" />
                <span className="text-sm font-semibold text-sky-600">
                  Įrašyta {checkedCount} augal{checkedCount === 1 ? 'as' : 'ai'}!
                </span>
              </motion.div>
            ) : (
              <motion.button
                key="btn"
                onClick={handleConfirm}
                disabled={checkedCount === 0}
                className="w-full py-4 rounded-2xl text-sm font-bold text-white bg-sky-400 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Droplets size={16} />
                Laistyti {checkedCount > 0 ? `${checkedCount} augal${checkedCount === 1 ? 'ą' : 'us'}` : ''}
              </motion.button>
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
    </div>
  )
}
