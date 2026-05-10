import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X, ChevronUp, ChevronDown, ChevronLeft, Trash2, Plus, Settings } from 'lucide-react'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { useDetailHost } from '../contexts/DetailHostContext'

// ── Zone form (name only now) ──────────────────────────────────

function ZoneForm({ initial, onSave, onCancel, submitLabel = 'Išsaugoti' }) {
  const [name, setName] = useState(initial?.name ?? '')
  const valid = name.trim().length > 0

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
          Zonos pavadinimas
        </label>
        <input
          type="text"
          placeholder="pvz. Virtuvės oranžerija"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
          className="w-full bg-surface rounded-2xl px-4 py-3 text-sm outline-none border border-transparent focus:border-sage-300 transition-colors"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 py-3 rounded-2xl text-sm text-gray-500 bg-surface-2">
          Atšaukti
        </button>
        <button onClick={() => valid && onSave({ name: name.trim() })} disabled={!valid}
          className="flex-1 py-3 rounded-2xl text-sm font-semibold text-white bg-sage-500 disabled:opacity-40">
          {submitLabel}
        </button>
      </div>
    </div>
  )
}

// ── Zone manager sheet ─────────────────────────────────────────

export function ZoneManagerSheet({ zones, plants = [], onAdd, onUpdate, onDelete, onReorder, onClose, zIndex = 90 }) {
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState(null)

  return (
    <div className="fixed inset-0 flex items-end justify-center" style={{ zIndex }}>
      <motion.div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }} onPointerDown={onClose}
      />
      <motion.div
        className="relative w-full max-w-[430px] bg-white rounded-t-4xl px-4 pt-3 pb-10 max-h-[85dvh] overflow-y-auto"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        onPointerDown={e => e.stopPropagation()}
      >
        <div className="flex justify-center pb-3">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900">Zonos</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2 mb-4">
          {zones.map((zone, i) => {
            const plantCount = plants.filter(p => p.zonaId === zone.id).length

            return editingId === zone.id ? (
              <div key={zone.id} className="bg-surface rounded-2xl p-4">
                <ZoneForm
                  initial={zone}
                  onSave={data => { onUpdate(zone.id, data); setEditingId(null) }}
                  onCancel={() => setEditingId(null)}
                  submitLabel="Atnaujinti"
                />
              </div>
            ) : (
              <div key={zone.id} className="bg-surface rounded-2xl px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{zone.name}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{plantCount} augal{plantCount === 1 ? 'as' : 'ai'}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => onReorder(zone.id, 'up')} disabled={i === 0}
                    className="w-7 h-7 flex items-center justify-center text-gray-400 disabled:opacity-20">
                    <ChevronUp size={14} />
                  </button>
                  <button onClick={() => onReorder(zone.id, 'down')} disabled={i === zones.length - 1}
                    className="w-7 h-7 flex items-center justify-center text-gray-400 disabled:opacity-20">
                    <ChevronDown size={14} />
                  </button>
                  <button onClick={() => setEditingId(zone.id)} className="text-xs text-sage-500 font-medium px-2 py-1">
                    Keisti
                  </button>
                  <button onClick={() => onDelete(zone.id)}
                    className="w-7 h-7 flex items-center justify-center text-red-300 active:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}

          {zones.length === 0 && !creating && (
            <p className="text-sm text-gray-400 text-center py-4">Dar nėra zonų. Sukurkite pirmą!</p>
          )}
        </div>

        {creating ? (
          <div className="bg-surface rounded-2xl p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Nauja zona</p>
            <ZoneForm
              onSave={data => { onAdd(data); setCreating(false) }}
              onCancel={() => setCreating(false)}
              submitLabel="Pridėti"
            />
          </div>
        ) : (
          <button onClick={() => setCreating(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold text-sage-600 bg-sage-50 hover:bg-sage-100 transition-colors">
            <Plus size={16} />
            Nauja zona
          </button>
        )}
      </motion.div>
    </div>
  )
}

// ── Zone + spot picker for PlantDetail ────────────────────────

export function ZonePicker({ zones, plants = [], currentZoneId, onSelect, onClose, onAddZone, onUpdateZone, onDeleteZone, onReorderZones }) {
  const [showManager, setShowManager] = useState(false)
  const canManage = onAddZone && onUpdateZone && onDeleteZone && onReorderZones

  // Desktop split panel: portal į RightPanel container'į (sub-modal ant
  // PlantDetail viršaus, slide-in iš dešinės). Mobile lieka full-screen.
  const isDesktop = useIsDesktop()
  const host = useDetailHost()
  const useDesktopPanel = isDesktop && !!host?.container

  useEffect(() => {
    if (!useDesktopPanel || !host) return
    host.open()
    return () => host.close()
  }, [useDesktopPanel]) // eslint-disable-line react-hooks/exhaustive-deps

  const tree = (
    <div className={useDesktopPanel
      ? "absolute inset-0 z-[5] flex items-end justify-center"
      : "fixed inset-0 z-[95] flex items-end justify-center"}>
      {/* Backdrop — tik mobile (desktop'e panel uždangstomas pačios ZonePicker'io kortelės) */}
      {!useDesktopPanel && (
        <motion.div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }} onPointerDown={onClose}
        />
      )}
      <motion.div
        className={useDesktopPanel
          ? "relative w-full h-full bg-white px-4 pt-3 pb-6 overflow-y-auto"
          : "relative w-full max-w-[430px] bg-white rounded-t-4xl px-4 pt-3 pb-10"}
        {...(useDesktopPanel
          ? { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } }
          : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } })}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        onPointerDown={e => e.stopPropagation()}
      >
        {/* Mobile — drag handle pill; desktop — back button (be backdrop'o nebūtų kaip uždaryti) */}
        {useDesktopPanel ? (
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1 px-2 py-1 -ml-1 rounded-lg text-sage-700 hover:bg-sage-50 transition-colors"
            >
              <ChevronLeft size={16} />
              <span className="text-sm font-medium">Atgal</span>
            </button>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Pasirinkti zoną
            </p>
            <span className="w-[64px]" />
          </div>
        ) : (
          <>
            <div className="flex justify-center pb-3">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-center mb-3">
              Pasirinkti zoną
            </p>
          </>
        )}
        <div className="space-y-2">
          <button
            onClick={() => { onSelect(null); onClose() }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors ${
              !currentZoneId ? 'bg-sage-50 text-sage-700' : 'bg-surface-2 text-gray-500'
            }`}
          >
            <span className="text-sm font-medium">Nepriskirta</span>
            {!currentZoneId && <span className="ml-auto text-sage-500 text-xs font-bold">✓</span>}
          </button>
          {zones.map(zone => (
            <button
              key={zone.id}
              onClick={() => { onSelect(zone.id); onClose() }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors ${
                currentZoneId === zone.id ? 'bg-sage-50 text-sage-700' : 'bg-surface-2 text-gray-600'
              }`}
            >
              <span className="text-sm font-medium flex-1 text-left">{zone.name}</span>
              {currentZoneId === zone.id && <span className="text-sage-500 text-xs font-bold">✓</span>}
            </button>
          ))}
          {canManage && (
            <button
              onClick={() => setShowManager(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium text-gray-500 bg-surface hover:bg-surface-2 transition-colors mt-2"
            >
              <Settings size={14} />
              Tvarkyti zonas
            </button>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {showManager && canManage && (
          <ZoneManagerSheet
            key="zone-manager-sheet"
            zones={zones}
            plants={plants}
            onAdd={onAddZone}
            onUpdate={onUpdateZone}
            onDelete={onDeleteZone}
            onReorder={onReorderZones}
            onClose={() => setShowManager(false)}
            zIndex={100}
          />
        )}
      </AnimatePresence>
    </div>
  )

  if (useDesktopPanel) return createPortal(tree, host.container)
  return tree
}

