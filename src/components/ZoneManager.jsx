import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X, ChevronUp, ChevronDown, Trash2, Plus, Settings, Check } from 'lucide-react'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { useDetailHost } from '../contexts/DetailHostContext'

// ── Zone form (name only now) ──────────────────────────────────

function ZoneForm({ initial, onSave, onCancel, submitLabel = 'Išsaugoti' }) {
  const [name, setName] = useState(initial?.name ?? '')
  const valid = name.trim().length > 0

  return (
    <div className="space-y-4">
      <div>
        <label className="font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.18em] block mb-1.5">
          Zonos pavadinimas
        </label>
        <input
          type="text"
          placeholder="pvz. Virtuvės oranžerija"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
          className="w-full bg-bone-50 rounded-2xl px-4 py-3 text-sm text-forest-700 placeholder-forest-400 outline-none border border-bone-400/40 focus:border-forest-400/60 transition-colors"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 h-11 rounded-btn font-display text-sm font-semibold text-forest-600 bg-bone-300/60 hover:bg-bone-400/50 transition-colors">
          Atšaukti
        </button>
        <button onClick={() => valid && onSave({ name: name.trim() })} disabled={!valid}
          className="flex-1 h-11 rounded-btn font-display text-sm font-semibold text-bone bg-forest-700 hover:bg-forest-800 disabled:opacity-40 transition-colors">
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
        className="absolute inset-0 bg-forest-800/55 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }} onPointerDown={onClose}
      />
      <motion.div
        className="relative w-full max-w-[430px] bg-white/55 backdrop-blur-xl rounded-t-4xl px-4 pt-3 pb-10 max-h-[85dvh] overflow-y-auto border-t border-bone-400/40"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        onPointerDown={e => e.stopPropagation()}
      >
        <div className="flex justify-center pb-3">
          <div className="w-10 h-1 bg-bone-400/60 rounded-full" />
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-base font-semibold tracking-tight text-forest-800">Zonos</h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-btn bg-bone-300/60 hover:bg-bone-400/60 text-forest-700 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2 mb-4">
          {zones.map((zone, i) => {
            const plantCount = plants.filter(p => p.zonaId === zone.id).length

            return editingId === zone.id ? (
              <div key={zone.id} className="bg-bone-300/40 border border-bone-400/40 rounded-2xl p-4">
                <ZoneForm
                  initial={zone}
                  onSave={data => { onUpdate(zone.id, data); setEditingId(null) }}
                  onCancel={() => setEditingId(null)}
                  submitLabel="Atnaujinti"
                />
              </div>
            ) : (
              <div key={zone.id} className="bg-bone-300/40 border border-bone-400/40 rounded-2xl px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-display text-sm font-semibold tracking-tight text-forest-800 truncate">{zone.name}</p>
                  <p className="font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.14em] mt-0.5">{plantCount} augal{plantCount === 1 ? 'as' : 'ai'}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => onReorder(zone.id, 'up')} disabled={i === 0}
                    className="w-7 h-7 flex items-center justify-center text-forest-400 disabled:opacity-20 hover:text-forest-700 transition-colors">
                    <ChevronUp size={14} />
                  </button>
                  <button onClick={() => onReorder(zone.id, 'down')} disabled={i === zones.length - 1}
                    className="w-7 h-7 flex items-center justify-center text-forest-400 disabled:opacity-20 hover:text-forest-700 transition-colors">
                    <ChevronDown size={14} />
                  </button>
                  <button onClick={() => setEditingId(zone.id)} className="font-mono text-[10px] font-medium text-forest-600 uppercase tracking-[0.14em] px-2 py-1 hover:text-forest-800 transition-colors">
                    Keisti
                  </button>
                  <button onClick={() => onDelete(zone.id)}
                    className="w-7 h-7 flex items-center justify-center text-terracotta-300 hover:text-terracotta-600 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}

          {zones.length === 0 && !creating && (
            <p className="text-sm text-forest-400 text-center py-4">Dar nėra zonų. Sukurkite pirmą!</p>
          )}
        </div>

        {creating ? (
          <div className="bg-bone-300/40 border border-bone-400/40 rounded-2xl p-4">
            <p className="font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.18em] mb-3">Nauja zona</p>
            <ZoneForm
              onSave={data => { onAdd(data); setCreating(false) }}
              onCancel={() => setCreating(false)}
              submitLabel="Pridėti"
            />
          </div>
        ) : (
          <button onClick={() => setCreating(true)}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-btn font-display text-sm font-semibold text-forest-700 border border-bone-400/50 hover:bg-bone-300/40 transition-colors">
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

  // ESC keyboard shortcut — uždaryti ZonePicker (sub-modal); jei tuo pat metu
  // PlantDetail atvertas, jis savo handler'yje patikrina sub-modal state ir
  // nesireaguoja, tad ESC uždaro tik šitą.
  useEffect(() => {
    if (!useDesktopPanel) return
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [useDesktopPanel, onClose])

  const tree = (
    <div className={useDesktopPanel
      ? "absolute inset-0 z-[5] flex items-end justify-center"
      : "fixed inset-0 z-[95] flex items-end justify-center"}>
      {/* Backdrop — forest INK; desktop'e covers only the panel, mobile'e full screen */}
      <motion.div
        className="absolute inset-0 bg-forest-800/55 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }} onPointerDown={onClose}
      />
      {/* Sheet — bottom sheet pattern abu (desktop + mobile), unifikuotas su
          Delete/Death/Duplicate/Photo modalais. Atgal arrow nebenaudojamas — X close. */}
      <motion.div
        className="relative w-full max-w-[430px] bg-white/55 backdrop-blur-xl rounded-t-4xl px-5 pt-3 pb-8 border-t border-bone-400/40"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        onPointerDown={e => e.stopPropagation()}
      >
        {/* Handle (mobile-ish, bet ir desktop'e palaikom konsistenciją) */}
        <div className="flex justify-center pb-3">
          <div className="w-10 h-1 bg-bone-400/60 rounded-full" />
        </div>
        <p className="font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.18em] text-center mb-4">
          Pasirinkti zoną
        </p>

        {/* Zone list */}
        <div className="space-y-1.5">
          <button
            onClick={() => { onSelect(null); onClose() }}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-colors ${
              !currentZoneId
                ? 'bg-forest-100 text-forest-700'
                : 'hover:bg-bone-300/50 text-forest-500'
            }`}
          >
            <span className="font-display text-sm font-semibold tracking-tight flex-1 text-left">Nepriskirta</span>
            {!currentZoneId && <Check size={14} className="text-forest-700" />}
          </button>
          {zones.map(zone => (
            <button
              key={zone.id}
              onClick={() => { onSelect(zone.id); onClose() }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-colors ${
                currentZoneId === zone.id
                  ? 'bg-forest-100 text-forest-700'
                  : 'hover:bg-bone-300/50 text-forest-700'
              }`}
            >
              <span className="font-display text-sm font-semibold tracking-tight flex-1 text-left">{zone.name}</span>
              {currentZoneId === zone.id && <Check size={14} className="text-forest-700" />}
            </button>
          ))}
        </div>

        {/* Tvarkyti zonas — atskirtas hairline'u */}
        {canManage && (
          <>
            <div className="h-px bg-bone-400/40 my-4" />
            <button
              onClick={() => setShowManager(true)}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-btn font-display text-sm font-semibold text-forest-700 border border-bone-400/50 hover:bg-bone-300/40 transition-colors"
            >
              <Settings size={14} />
              Tvarkyti zonas
            </button>
          </>
        )}
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

