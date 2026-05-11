import { motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { useDetailHost } from '../contexts/DetailHostContext'

/**
 * section === 'auginama'  → asks WHY (numirė / kita)
 * section === 'library'   → simple "are you sure?"
 *
 * Context-aware portal: jei PlantDetail panel atviras desktop'e — modal'as
 * iškyla kortelės viduje. Kitaip — fullscreen overlay.
 */
export default function DeleteModal({ plant, section, onDied, onMoveToLibrary, onDeleteForever, onClose }) {
  const isDashboard = section === 'auginama'
  const isDesktop = useIsDesktop()
  const host = useDetailHost()
  const useDesktopPanel = isDesktop && !!host?.container

  const tree = (
    <div className={useDesktopPanel
      ? "absolute inset-0 z-[90] flex items-end justify-center"
      : "fixed inset-0 z-[90] flex items-end justify-center"}>
      {/* Backdrop — forest INK (brand) */}
      <motion.div
        className="absolute inset-0 bg-forest-800/55 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onPointerDown={onClose}
      />

      {/* Sheet — glass card (kaip PlantDetail) */}
      <motion.div
        className="relative w-full max-w-[430px] bg-white/55 backdrop-blur-xl rounded-t-3xl px-5 pt-4 pb-8 safe-bottom border-t border-bone-400/40"
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

        {/* Unifikuotas header pattern abiem variantam:
            mono caps subtitle (kontekstas + plant name) → Bricolage title */}
        <p className={`font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-center mb-1.5 ${
          isDashboard ? 'text-forest-500' : 'text-terracotta-600'
        }`}>
          {isDashboard
            ? plant.lietuviškas
            : <>Pavojinga · {plant.lietuviškas}</>
          }
        </p>
        <h3 className="font-display text-lg font-semibold tracking-tight text-forest-800 text-center mb-5">
          {isDashboard ? 'Kodėl šalini augalą?' : 'Ištrinti augalą?'}
        </h3>

        {isDashboard ? (
          <div className="space-y-2">
            <button
              onClick={onDied}
              className="w-full bg-bone-50 hover:bg-bone-300 rounded-2xl px-4 py-4 transition-colors text-left"
            >
              <p className="font-display text-sm font-semibold tracking-tight text-forest-800">Numirė</p>
              <p className="text-xs text-forest-500 mt-0.5">Įrašysime į istoriją su priežastimi</p>
            </button>

            <button
              onClick={onMoveToLibrary}
              className="w-full bg-bone-50 hover:bg-bone-300 rounded-2xl px-4 py-4 transition-colors text-left"
            >
              <p className="font-display text-sm font-semibold tracking-tight text-forest-800">Kita priežastis</p>
              <p className="text-xs text-forest-500 mt-0.5">Augalas lieka bibliotekoje kaip įrašas</p>
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-forest-500 text-center mb-5">
              Bus ištrintas visam laikui — istorija ir užrašai dings.
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
          className="w-full h-12 rounded-btn font-display text-sm font-semibold text-forest-600 bg-bone-300 hover:bg-bone-400/70 transition-colors mt-1"
        >
          Atšaukti
        </button>
      </motion.div>
    </div>
  )

  if (useDesktopPanel) return createPortal(tree, host.container)
  return tree
}
