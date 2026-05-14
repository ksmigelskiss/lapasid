import { motion } from 'framer-motion'
import Mascot from './brand/Mascot'

/**
 * Toast po care mode bulk action — minimalus reward'as.
 * Atsiranda viršuje, fade-out po ~3s.
 *
 * Filosofija: trumpas „taškų gavimas" + sistema patobulėjo. Visa breakdown
 * info perkelta į session summary (kuris atsiranda išėjus iš care mode).
 *
 * Plant mascot (`happy` state) — visual reward'as: augalas pradžiunga
 * po sėkmingo veiksmo. Body bounces taller, sprout perks up.
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
      className="bg-bone-50 rounded-2xl shadow-xl border border-bone-400/60 px-4 py-3 flex items-center gap-3"
    >
      <Mascot type="plant" state="happy" size={44} blink={false} className="flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-[20px] font-extrabold text-forest-700 tabular-nums leading-none">
          +{deltaPct}%
        </span>
        <p className="text-[13px] font-medium text-forest-600 leading-tight mt-0.5">
          {phrase}
        </p>
      </div>
    </motion.div>
  )
}
