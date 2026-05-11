import { motion } from 'framer-motion'

/**
 * Toast po care mode bulk action — minimalus reward'as.
 * Atsiranda viršuje, fade-out po ~3s.
 *
 * Filosofija: trumpas „taškų gavimas" + sistema patobulėjo. Visa breakdown
 * info perkelta į session summary (kuris atsiranda išėjus iš care mode).
 *
 * Props:
 *   deltaPct: confidence prieaugis (procentais) — pagrindinis akcentas
 *   phrase:   atsitiktinė frazė iš CARE_COPY.delta („Mano pažinimas paaugo")
 */
export default function CareToast({ deltaPct, phrase }) {
  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -20, opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 320 }}
      className="bg-bone rounded-2xl shadow-xl border border-bone-400/60 px-4 py-3 flex items-center gap-3"
    >
      <span className="text-[24px] font-extrabold text-forest-600 tabular-nums leading-none flex-shrink-0">
        +{deltaPct}%
      </span>
      <span className="text-[14px] font-medium text-forest-700 leading-tight">
        {phrase}
      </span>
    </motion.div>
  )
}
