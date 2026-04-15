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
        className="relative w-full max-w-[430px] bg-white rounded-t-3xl px-5 pt-4 pb-8 safe-bottom"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        onPointerDown={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {isDashboard ? (
          <>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-center mb-1">
              {plant.emoji ?? '🌿'} {plant.lietuviškas}
            </p>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-5">Kodėl šalini augalą?</h3>

            <div className="space-y-2">
              <button
                onClick={onDied}
                className="w-full flex items-center gap-3 bg-surface hover:bg-surface-2 active:bg-surface-2 rounded-2xl px-4 py-4 transition-colors text-left"
              >
                <span className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Ghost size={18} className="text-gray-500" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Numirė</p>
                  <p className="text-xs text-gray-400">Įrašysime į istoriją su priežastimi</p>
                </div>
              </button>

              <button
                onClick={onMoveToLibrary}
                className="w-full flex items-center gap-3 bg-surface hover:bg-surface-2 active:bg-surface-2 rounded-2xl px-4 py-4 transition-colors text-left"
              >
                <span className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <MoveRight size={18} className="text-gray-500" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Kita priežastis</p>
                  <p className="text-xs text-gray-400">Augalas lieka bibliotekoje kaip įrašas</p>
                </div>
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-center mb-3">
              <span className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
                <TriangleAlert size={22} className="text-red-400" />
              </span>
            </div>
            <h3 className="text-base font-bold text-gray-900 text-center mb-1">Ištrinti augalą?</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              {plant.emoji ?? '🌿'} <span className="font-medium">{plant.lietuviškas}</span> bus ištrintas visam laikui.
            </p>

            <button
              onClick={onDeleteForever}
              className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 active:bg-red-600 transition-colors mb-2"
            >
              Ištrinti
            </button>
          </>
        )}

        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-2xl text-sm font-medium text-gray-500 bg-surface-2 mt-1"
        >
          Atšaukti
        </button>
      </motion.div>
    </div>
  )
}
