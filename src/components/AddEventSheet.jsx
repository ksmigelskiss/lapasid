import { useState, useRef } from 'react'
import { motion, AnimatePresence, useDragControls, useMotionValue, animate } from 'framer-motion'
import { Camera, Droplets, FlaskConical, Sprout, Stethoscope, FileText } from 'lucide-react'
import { resizeImage } from '../utils/imageService'
import { makeId, today } from '../utils/plantTransform'

const EVENT_LABELS = {
  watering:    { icon: <Droplets size={13} />,    label: 'Laistymas' },
  fertilizing: { icon: <FlaskConical size={13} />, label: 'Trąšos' },
  repotting:   { icon: <Sprout size={13} />,      label: 'Persodinimas' },
  treatment:   { icon: <Stethoscope size={13} />, label: 'Gydymas' },
  note:        { icon: <FileText size={13} />,    label: 'Užrašas' },
  photo:       { icon: <Camera size={13} />,      label: 'Nuotrauka' },
}

// ── Add Event Bottom Sheet ─────────────────────────────────────

export function AddEventSheet({ type, onSave, onClose }) {
  const meta = EVENT_LABELS[type] ?? EVENT_LABELS.note
  const [note, setNote]             = useState('')
  const [amount, setAmount]         = useState('')
  const [fertilizer, setFert]       = useState('')
  const [potSize, setPotSize]       = useState('')
  const [preparatas, setPreparatas] = useState('')
  const [tikslas, setTikslas]       = useState('')
  const [metodas, setMetodas]       = useState('')
  const [imageUrl, setImageUrl]     = useState(null)
  const fileRef                     = useRef()

  const dragControls = useDragControls()
  const y = useMotionValue(0)

  const handleDragEnd = (_, info) => {
    if (info.velocity.y > 400 || info.offset.y > 100) onClose()
    else animate(y, 0, { type: 'spring', stiffness: 400, damping: 30 })
  }

  const handleFile = async (file) => {
    if (!file) return
    try {
      const url = await resizeImage(file, 600, 0.80)
      setImageUrl(url)
    } catch {}
  }

  const handleSave = () => {
    const autoNote = type === 'watering' ? 'Laistyta individualiai'
      : type === 'fertilizing' ? 'Trešta individualiai'
      : note.trim()
    onSave({
      id: makeId(),
      type,
      date: today(),
      note: autoNote,
      ...(type === 'fertilizing' && { fertilizer: fertilizer.trim(), amount: amount.trim() }),
      ...(type === 'repotting'   && { potSize: potSize.trim() }),
      ...(type === 'treatment'   && { preparatas: preparatas.trim(), tikslas: tikslas.trim(), metodas: metodas.trim() }),
      ...(type === 'photo'       && { imageUrl }),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <motion.div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />
      <motion.div
        className="relative w-full max-w-[430px] bg-white rounded-t-4xl px-5 pb-8 pt-3 space-y-4"
        style={{ y }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0, bottom: 0.25 }}
        onDragEnd={handleDragEnd}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
      >
        {/* Handle */}
        <div
          onPointerDown={e => dragControls.start(e)}
          className="flex justify-center pb-1 cursor-grab active:cursor-grabbing select-none"
          style={{ touchAction: 'none' }}
        >
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-2xl">{meta.icon}</span>
          <h3 className="text-base font-bold text-gray-900">{meta.label}</h3>
        </div>

        {/* Type-specific fields */}

        {type === 'fertilizing' && (
          <div className="space-y-2">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">Trąšų pavadinimas</label>
              <input
                type="text" placeholder="pvz. NPK 5-5-5"
                value={fertilizer} onChange={e => setFert(e.target.value)}
                className="w-full bg-surface rounded-2xl px-4 py-3 text-sm outline-none border border-transparent focus:border-purple-200"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">Kiekis</label>
              <input
                type="text" placeholder="pvz. 100ml"
                value={amount} onChange={e => setAmount(e.target.value)}
                className="w-full bg-surface rounded-2xl px-4 py-3 text-sm outline-none border border-transparent focus:border-purple-200"
              />
            </div>
          </div>
        )}

        {type === 'repotting' && (
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">Naujo vazonėlio dydis</label>
            <input
              type="text" placeholder="pvz. 14cm"
              value={potSize} onChange={e => setPotSize(e.target.value)}
              className="w-full bg-surface rounded-2xl px-4 py-3 text-sm outline-none border border-transparent focus:border-amber-200"
              autoFocus
            />
          </div>
        )}

        {type === 'treatment' && (
          <div className="space-y-2">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">Preparatas</label>
              <input
                type="text" placeholder="pvz. Aktara, Neem aliejus"
                value={preparatas} onChange={e => setPreparatas(e.target.value)}
                className="w-full bg-surface rounded-2xl px-4 py-3 text-sm outline-none border border-transparent focus:border-red-200"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">Problema / tikslas</label>
              <input
                type="text" placeholder="pvz. erkutės, šaknų puvinys"
                value={tikslas} onChange={e => setTikslas(e.target.value)}
                className="w-full bg-surface rounded-2xl px-4 py-3 text-sm outline-none border border-transparent focus:border-red-200"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">Metodas</label>
              <input
                type="text" placeholder="pvz. purškimas, mirkymas"
                value={metodas} onChange={e => setMetodas(e.target.value)}
                className="w-full bg-surface rounded-2xl px-4 py-3 text-sm outline-none border border-transparent focus:border-red-200"
              />
            </div>
          </div>
        )}

        {type === 'photo' && (
          <div>
            {imageUrl ? (
              <div className="relative rounded-2xl overflow-hidden aspect-[4/3]">
                <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => setImageUrl(null)}
                  className="absolute top-2 right-2 w-7 h-7 bg-black/40 rounded-btn-sm flex items-center justify-center text-white text-xs"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full aspect-[4/3] bg-surface border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-2"
              >
                <span className="text-3xl">📷</span>
                <span className="text-sm text-gray-400">Pasirinkti nuotrauką</span>
              </button>
            )}
            <input
              ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { handleFile(e.target.files[0]); e.target.value = '' }}
            />
          </div>
        )}

        {/* Note — hidden for watering/fertilizing (auto-comment added) */}
        {type !== 'watering' && type !== 'fertilizing' && (
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">Užrašas (nebūtina)</label>
            <textarea
              placeholder="Papildoma informacija..."
              value={note} onChange={e => setNote(e.target.value)}
              rows={2}
              className="w-full bg-surface rounded-2xl px-4 py-3 text-sm outline-none resize-none border border-transparent focus:border-sage-200"
              autoFocus={type === 'note'}
            />
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-3.5 rounded-2xl text-sm font-medium text-gray-500 bg-surface-2">
            Atšaukti
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3.5 rounded-2xl text-sm font-medium text-white bg-sage-500"
          >
            Išsaugoti
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── FAB ───────────────────────────────────────────────────────

const FAB_ACTIONS = [
  { type: 'photo',       Icon: Camera,        label: 'Nuotrauka' },
  { type: 'watering',    Icon: Droplets,      label: 'Laistymas' },
  { type: 'fertilizing', Icon: FlaskConical,  label: 'Trąšos' },
  { type: 'repotting',   Icon: Sprout,        label: 'Persodinimas' },
  { type: 'treatment',   Icon: Stethoscope,   label: 'Gydymas' },
  { type: 'note',        Icon: FileText,      label: 'Užrašas' },
]

export function FAB({ onSelect }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="absolute bottom-5 right-4 z-20 flex flex-col items-end gap-2">
      {/* Action items */}
      <AnimatePresence>
        {open && FAB_ACTIONS.map((action, i) => (
          <motion.button
            key={action.type}
            onClick={() => { onSelect(action.type); setOpen(false) }}
            className="flex items-center gap-2 bg-white rounded-2xl px-3 py-2.5 shadow-lg border border-warm-border"
            initial={{ opacity: 0, y: 12, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.85 }}
            transition={{ type: 'spring', damping: 22, stiffness: 300, delay: i * 0.04 }}
          >
            <action.Icon size={18} className="text-gray-500 flex-shrink-0" />
            <span className="text-sm font-medium text-gray-700">{action.label}</span>
          </motion.button>
        ))}
      </AnimatePresence>

      {/* Main FAB button */}
      <motion.button
        onClick={() => setOpen(v => !v)}
        className="w-13 h-13 bg-sage-500 rounded-btn flex items-center justify-center shadow-lg text-white text-2xl"
        style={{ width: 52, height: 52 }}
        animate={{ rotate: open ? 45 : 0 }}
        transition={{ type: 'spring', damping: 18, stiffness: 280 }}
        whileTap={{ scale: 0.9 }}
      >
        +
      </motion.button>
    </div>
  )
}
