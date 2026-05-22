import { motion } from 'framer-motion'
import Mascot from './brand/Mascot'

/**
 * DiscoveryToast — Variant B Step 6i, reward UX po save'o.
 *
 * Triggerinama kai user'is prideda augalą per Phase 0.3+0.5 → Phase 2
 * enrichment (t.y. NEFAST PATH — naujas augalas catalog'ui). Užkalituoja
 * „atradai naują rūšį, ačiū" moment'ą, kad AI Phase 2 wait'as (kuriam UI
 * rodo forest-700 dimm + BrandLoader) jaustųsi kaip celebration, ne klaidą.
 *
 * Reward'as šiandien — DUMMY copy („+1 AI užklausa"). Ateityje pajungsim
 * į user.aiUsage quota system'ą (atskirta queue task'a).
 *
 * Vizualas: forest-600 toast su mascot plant happy. Atitinka CareCircuitToast
 * stilių (familiar success pattern user'iui).
 */
export default function DiscoveryToast({ message = 'Atradai naują rūšį! Tau priklauso +1 AI užklausa' }) {
  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -20, opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 320 }}
      className="bg-forest-600 rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3"
    >
      <Mascot type="plant" state="happy" size={36} blink={false} className="flex-shrink-0 text-bone" />
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[9.5px] font-medium uppercase tracking-[0.16em] text-bone/70">
          ⭐ atradimas
        </p>
        <p className="text-[14px] font-semibold text-bone leading-tight mt-0.5">
          {message}
        </p>
      </div>
    </motion.div>
  )
}
