import { Check } from 'lucide-react'
import { motion } from 'framer-motion'

/**
 * Zone circuit toast — atsiranda kai care mode bulk veiksmas išvalo
 * paskutinį todo augalą zonoje. Reiškia: "ši zona pilnai pasirūpinta".
 *
 * Vizualas: sage-500 bg + Check ikona — celebration moment'as, skiriasi
 * nuo balto delta toast'o.
 *
 * Props:
 *   message: string — formatted iš CARE_COPY.circuit
 *            (pvz. "Virtuvė — viskas vietose")
 */
export default function CareCircuitToast({ message }) {
  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -20, opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 320 }}
      className="bg-sage-500 rounded-2xl shadow-xl px-4 py-3 flex items-center gap-2.5"
    >
      <Check size={20} className="text-white flex-shrink-0" />
      <span className="text-[15px] font-bold text-white leading-tight">{message}</span>
    </motion.div>
  )
}
