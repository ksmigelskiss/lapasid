import { Sprout, Droplets, Clock, Heart } from 'lucide-react'
import { motion } from 'framer-motion'
import { CARE_COPY, plPlants } from '../constants/careCopy'

// Bucket'o vizualinė meta (ikona + spalva). Tonas — be kaltinimo.
// perfect (sage)  — augalas patenkintas, augimas
// early   (sky)   — vandens linkmė, atsargumas
// late    (amber) — laiko linkmė, neutralu
// waylate (rose)  — širdis, šiluma, jokio blame
const BUCKET_META = {
  perfect: { Icon: Sprout,   color: 'text-sage-600' },
  early:   { Icon: Droplets, color: 'text-sky-500'  },
  late:    { Icon: Clock,    color: 'text-amber-500' },
  waylate: { Icon: Heart,    color: 'text-rose-500'  },
}

/**
 * Toast po care mode bulk action.
 * Atsiranda virš care action bar'o, fade-out po ~4s.
 *
 * Props:
 *   headline: antraštė pagal mood'ą (iš CARE_COPY.bulk.headline)
 *   counts:   { perfect, early, late, waylate } — kiek augalų į kurį bucket'ą
 *   total:    bendras augalų skaičius (antraštės pluralui)
 */
export default function CareToast({ headline, counts, total }) {
  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -20, opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 320 }}
      className="bg-white rounded-2xl shadow-xl border border-gray-100 p-3.5"
    >
      <p className="text-[15px] font-bold text-gray-900 leading-tight">{headline}</p>
      <p className="text-[11px] text-gray-400 mt-0.5 mb-2">
        {total} {plPlants(total)}
      </p>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {Object.entries(counts).map(([key, count]) => {
          if (count <= 0) return null
          const { Icon, color } = BUCKET_META[key]
          return (
            <div key={key} className="flex items-center gap-1">
              <Icon size={14} className={color} />
              <span className="text-[12px] font-bold text-gray-800">{count}</span>
              <span className="text-[12px] text-gray-500">{CARE_COPY.bulk.label[key]}</span>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
