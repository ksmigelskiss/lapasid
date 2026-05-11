import { motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { useDetailHost } from '../contexts/DetailHostContext'

export default function DuplicateBuyModal({ plant, onAddAnother, onViewExisting, onClose }) {
  const isDesktop = useIsDesktop()
  const host = useDetailHost()
  const useDesktopPanel = isDesktop && !!host?.container

  const tree = (
    <div className={useDesktopPanel
      ? "absolute inset-0 z-[90] flex items-end justify-center"
      : "fixed inset-0 z-[90] flex items-end justify-center"}>
      <motion.div
        className="absolute inset-0 bg-forest-800/55 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onPointerDown={onClose}
      />
      <motion.div
        className="relative w-full max-w-[430px] bg-white/55 backdrop-blur-xl rounded-t-3xl px-5 pt-4 pb-8 safe-bottom border-t border-bone-400/40"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        onPointerDown={e => e.stopPropagation()}
      >
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 bg-bone-400/60 rounded-full" />
        </div>

        <div className="flex justify-center mb-3">
          <span className="text-4xl">{plant.emoji ?? '🌿'}</span>
        </div>
        <h3 className="font-display text-base font-semibold tracking-tight text-forest-800 text-center mb-1">Jau augini šį augalą</h3>
        <p className="text-sm text-forest-500 text-center mb-6">
          <span className="font-medium text-forest-700">{plant.lietuviškas ?? plant.lotyniskas}</span> jau yra kolekcijoje.
          Pridėti antrą egzempliorių?
        </p>

        <div className="space-y-2">
          <button
            onClick={onAddAnother}
            className="w-full h-12 rounded-btn font-display text-sm font-semibold text-bone bg-forest-700 hover:bg-forest-800 transition-colors"
          >
            Pridėti dar vieną
          </button>
          <button
            onClick={onViewExisting}
            className="w-full h-12 rounded-btn font-display text-sm font-semibold text-forest-700 bg-bone-300 hover:bg-bone-400/70 transition-colors"
          >
            Peržiūrėti esamą
          </button>
          <button
            onClick={onClose}
            className="w-full h-12 rounded-btn font-display text-sm font-semibold text-forest-500 bg-transparent hover:bg-bone-300 transition-colors"
          >
            Atšaukti
          </button>
        </div>
      </motion.div>
    </div>
  )

  if (useDesktopPanel) return createPortal(tree, host.container)
  return tree
}
