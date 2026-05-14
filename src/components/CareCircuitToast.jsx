import { motion } from 'framer-motion'
import Mascot from './brand/Mascot'

/**
 * Zone circuit toast — atsiranda kai care mode bulk veiksmas išvalo
 * paskutinį todo augalą zonoje. Reiškia: "ši zona pilnai pasirūpinta".
 *
 * Vizualas: forest-600 bg + plant happy mascot — celebration moment'as,
 * augalas su sprout'u perks up'inasi po circuit complete'inimo.
 * Forest fone bone-50 paper (inverted „antspaudas" style).
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
      className="bg-forest-600 rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3"
    >
      <Mascot type="plant" state="happy" size={36} blink={false} className="flex-shrink-0 text-bone" />
      <span className="text-[15px] font-bold text-bone leading-tight">{message}</span>
    </motion.div>
  )
}
