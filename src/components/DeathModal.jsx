import { useState } from 'react'
import { motion, useDragControls, useMotionValue, animate } from 'framer-motion'
import { Ghost, Lightbulb } from 'lucide-react'

export default function DeathModal({ plant, onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  const [lesson, setLesson] = useState('')

  const dragControls = useDragControls()
  const y = useMotionValue(0)

  const handleDragEnd = (_, info) => {
    if (info.velocity.y > 400 || info.offset.y > 100) {
      onClose()
    } else {
      animate(y, 0, { type: 'spring', stiffness: 400, damping: 30 })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <motion.div
        className="absolute inset-0 bg-forest-800/55 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={onClose}
      />

      <motion.div
        className="relative w-full max-w-[430px] bg-white/55 backdrop-blur-xl rounded-t-4xl px-5 py-6 space-y-5 border-t border-bone-400/40"
        style={{ y }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0, bottom: 0.25 }}
        onDragEnd={handleDragEnd}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
      >
        {/* Handle */}
        <div
          onPointerDown={e => dragControls.start(e)}
          className="absolute top-0 left-0 right-0 flex justify-center pt-2.5 pb-2 cursor-grab active:cursor-grabbing select-none"
          style={{ touchAction: 'none' }}
        >
          <div className="w-10 h-1 bg-bone-400/60 rounded-full" />
        </div>

        <div className="text-center pt-2">
          <p className="font-mono text-[10px] font-medium text-terracotta-600 uppercase tracking-[0.18em] mb-1.5">
            Numirė
          </p>
          <h2 className="font-display text-lg font-semibold tracking-tight text-forest-800">
            {plant.lietuviškas ?? plant.name}
          </h2>
          <p className="text-sm text-forest-500 mt-1.5">Užfiksuokite priežastį ir pamoką ateičiai</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="font-mono text-[10px] font-medium text-terracotta-600 uppercase tracking-[0.16em] mb-1.5 flex items-center gap-1.5">
              <Ghost size={12} /> Kodėl numirė?
            </label>
            <textarea
              className="w-full bg-bone-50 rounded-2xl px-4 py-3 text-sm text-forest-700 placeholder-forest-400 outline-none resize-none border border-bone-400/40 focus:border-terracotta/40 transition-colors"
              rows={2}
              placeholder="Pvz. Perlaisčiau, sušalo šaknys..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.16em] mb-1.5 flex items-center gap-1.5">
              <Lightbulb size={12} /> Pamoka ateičiai
            </label>
            <textarea
              className="w-full bg-bone-50 rounded-2xl px-4 py-3 text-sm text-forest-700 placeholder-forest-400 outline-none resize-none border border-bone-400/40 focus:border-forest-400/50 transition-colors"
              rows={2}
              placeholder="Pvz. Žiemą laistyti rečiau..."
              value={lesson}
              onChange={e => setLesson(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-12 rounded-btn font-display text-sm font-semibold text-forest-600 bg-bone-300/60 hover:bg-bone-400/50 transition-colors"
          >
            Atšaukti
          </button>
          <button
            onClick={() => onConfirm(reason, lesson)}
            className="flex-1 h-12 rounded-btn font-display text-sm font-semibold text-bone bg-forest-800 hover:bg-forest-900 transition-colors"
          >
            Patvirtinti
          </button>
        </div>
      </motion.div>
    </div>
  )
}
