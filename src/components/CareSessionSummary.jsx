import { Sprout, Droplets, FlaskConical, Clock, Heart } from 'lucide-react'
import { motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { CARE_COPY, plPlants, pick } from '../constants/careCopy'
import { moodFromCounts } from '../utils/careBuckets'

// Tas pats bucket meta map'as kaip CareToast'e — vienas šaltinis vizualams
const BUCKET_META = {
  perfect: { Icon: Sprout,   color: 'text-sage-600' },
  early:   { Icon: Droplets, color: 'text-sky-500'  },
  late:    { Icon: Clock,    color: 'text-amber-500' },
  waylate: { Icon: Heart,    color: 'text-rose-500'  },
}

function totalIn(c) {
  return c.perfect + c.early + c.late + c.waylate
}

function BucketRow({ counts }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2">
      {Object.entries(counts).map(([key, count]) => {
        if (count <= 0) return null
        const { Icon, color } = BUCKET_META[key]
        return (
          <div key={key} className="flex items-center gap-1">
            <Icon size={15} className={color} />
            <span className="text-sm font-bold text-gray-800">{count}</span>
            <span className="text-sm text-gray-500">{CARE_COPY.bulk.label[key]}</span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Session summary modal — atsiranda išėjus iš care mode po >0 veiksmų.
 * Centruotas, su backdrop, dismissable per tap arba mygtuką.
 *
 * Props:
 *   session: { watering: counts, fertilizing: counts, plants: Set }
 *   onDismiss: callback uždarymui
 */
export default function CareSessionSummary({ session, onDismiss }) {
  const wT = totalIn(session.watering)
  const fT = totalIn(session.fertilizing)
  const uniquePlants = session.plants.size

  // Nuotaika imama iš agreguotų counts'ų visoms veikloms
  const allCounts = {
    perfect: session.watering.perfect + session.fertilizing.perfect,
    early:   session.watering.early   + session.fertilizing.early,
    late:    session.watering.late    + session.fertilizing.late,
    waylate: session.watering.waylate + session.fertilizing.waylate,
  }
  const mood = moodFromCounts(allCounts)
  const headline = pick(CARE_COPY.bulk.headline[mood])

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[120] flex items-center justify-center px-6"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      onClick={onDismiss}
    >
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
      <motion.div
        className="relative bg-white rounded-3xl w-full max-w-[340px] p-6 shadow-2xl"
        initial={{ y: 30, scale: 0.95, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 30, scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Big icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-sage-100 flex items-center justify-center">
            <Sprout size={32} className="text-sage-600" />
          </div>
        </div>

        {/* Headline + subtitle */}
        <h2 className="text-xl font-extrabold text-gray-900 text-center leading-tight">{headline}</h2>
        <p className="text-sm text-gray-500 text-center mt-1.5">
          Pasirūpinai {uniquePlants} {plPlants(uniquePlants)}
        </p>

        {/* Sections */}
        <div className="mt-5 space-y-3">
          {wT > 0 && (
            <div className="bg-gray-50 rounded-2xl p-4">
              <div className="flex items-center gap-2">
                <Droplets size={16} className="text-sky-500" />
                <span className="text-sm font-bold text-gray-800">Laistymas</span>
                <span className="text-sm text-gray-400">· {wT}</span>
              </div>
              <BucketRow counts={session.watering} />
            </div>
          )}
          {fT > 0 && (
            <div className="bg-gray-50 rounded-2xl p-4">
              <div className="flex items-center gap-2">
                <FlaskConical size={16} className="text-amber-500" />
                <span className="text-sm font-bold text-gray-800">Tręšimas</span>
                <span className="text-sm text-gray-400">· {fT}</span>
              </div>
              <BucketRow counts={session.fertilizing} />
            </div>
          )}
        </div>

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="mt-5 w-full h-11 rounded-2xl bg-sage-500 active:bg-sage-600 text-white font-bold transition-colors"
        >
          Baigta
        </button>
      </motion.div>
    </motion.div>,
    document.body
  )
}
