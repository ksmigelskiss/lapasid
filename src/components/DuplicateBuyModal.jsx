import { motion } from 'framer-motion'

export default function DuplicateBuyModal({ plant, onAddAnother, onViewExisting, onClose }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center">
      <motion.div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onPointerDown={onClose}
      />
      <motion.div
        className="relative w-full max-w-[430px] bg-white rounded-t-3xl px-5 pt-4 pb-8 safe-bottom"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        onPointerDown={e => e.stopPropagation()}
      >
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="flex justify-center mb-3">
          <span className="text-4xl">{plant.emoji ?? '🌿'}</span>
        </div>
        <h3 className="text-base font-bold text-gray-900 text-center mb-1">Jau augini šį augalą</h3>
        <p className="text-sm text-gray-500 text-center mb-6">
          <span className="font-medium">{plant.lietuviškas ?? plant.lotyniskas}</span> jau yra kolekcijoje.
          Pridėti antrą egzempliorių?
        </p>

        <div className="space-y-2">
          <button
            onClick={onAddAnother}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white bg-sage-500 active:bg-sage-600 transition-colors"
          >
            Pridėti dar vieną
          </button>
          <button
            onClick={onViewExisting}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold text-gray-700 bg-surface active:bg-surface-2 transition-colors"
          >
            Peržiūrėti esamą
          </button>
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-2xl text-sm font-medium text-gray-400 bg-surface-2"
          >
            Atšaukti
          </button>
        </div>
      </motion.div>
    </div>
  )
}
