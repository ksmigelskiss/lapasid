import { motion } from 'framer-motion'
import { TriangleAlert, Ghost, MoveRight } from 'lucide-react'

/**
 * section === 'auginama'  → asks WHY (numirė / kita)
 * section === 'library'   → simple "are you sure?"
 */
export default function DeleteModal({ plant, section, onDied, onMoveToLibrary, onDeleteForever, onClose }) {
  const isDashboard = section === 'auginama'

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center">
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onPointerDown={onClose}
      />

      {/* Sheet */}
      <motion.div
        className="relative w-full max-w-[430px] bg-bone-50 rounded-t-3xl px-5 pt-4 pb-8 safe-bottom border-t border-bone-400/40"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        onPointerDown={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 bg-bone-400/60 rounded-full" />
        </div>

        {isDashboard ? (
          <>
            <p className="font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.18em] text-center mb-1.5">
              {plant.emoji ?? '🌿'} {plant.lietuviškas}
            </p>
            <h3 className="font-display text-lg font-semibold tracking-tight text-forest-800 text-center mb-5">Kodėl šalini augalą?</h3>

            <div className="space-y-2">
              <button
                onClick={onDied}
                className="w-full flex items-center gap-3 bg-bone-300/40 hover:bg-bone-300/70 rounded-2xl px-4 py-4 transition-colors text-left"
              >
                <span className="w-9 h-9 rounded-xl bg-bone-300 flex items-center justify-center flex-shrink-0">
                  <Ghost size={18} className="text-forest-500" />
                </span>
                <div>
                  <p className="font-display text-sm font-semibold tracking-tight text-forest-800">Numirė</p>
                  <p className="text-xs text-forest-500 mt-0.5">Įrašysime į istoriją su priežastimi</p>
                </div>
              </button>

              <button
                onClick={onMoveToLibrary}
                className="w-full flex items-center gap-3 bg-bone-300/40 hover:bg-bone-300/70 rounded-2xl px-4 py-4 transition-colors text-left"
              >
                <span className="w-9 h-9 rounded-xl bg-bone-300 flex items-center justify-center flex-shrink-0">
                  <MoveRight size={18} className="text-forest-500" />
                </span>
                <div>
                  <p className="font-display text-sm font-semibold tracking-tight text-forest-800">Kita priežastis</p>
                  <p className="text-xs text-forest-500 mt-0.5">Augalas lieka bibliotekoje kaip įrašas</p>
                </div>
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-center mb-3">
              <span className="w-12 h-12 rounded-2xl bg-terracotta-50 border border-terracotta-200/60 flex items-center justify-center">
                <TriangleAlert size={22} className="text-terracotta" />
              </span>
            </div>
            <h3 className="font-display text-base font-semibold tracking-tight text-forest-800 text-center mb-1">Ištrinti augalą?</h3>
            <p className="text-sm text-forest-500 text-center mb-6">
              {plant.emoji ?? '🌿'} <span className="font-medium text-forest-700">{plant.lietuviškas}</span> bus ištrintas visam laikui.
            </p>

            <button
              onClick={onDeleteForever}
              className="w-full h-12 rounded-btn font-display text-sm font-semibold text-bone bg-terracotta hover:bg-terracotta-500 transition-colors mb-2"
            >
              Ištrinti
            </button>
          </>
        )}

        <button
          onClick={onClose}
          className="w-full h-12 rounded-btn font-display text-sm font-semibold text-forest-600 bg-bone-300/60 hover:bg-bone-400/50 transition-colors mt-1"
        >
          Atšaukti
        </button>
      </motion.div>
    </div>
  )
}
