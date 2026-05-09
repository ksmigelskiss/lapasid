import { useEffect } from 'react'
import { Sprout, Droplets, FlaskConical, Clock, Heart } from 'lucide-react'
import { motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { CARE_COPY, plPlantsInstr, pick } from '../constants/careCopy'
import { moodFromCounts } from '../utils/careBuckets'

// Bucket meta — vienas šaltinis vizualams
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
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
      {Object.entries(counts).map(([key, count]) => {
        if (count <= 0) return null
        const { Icon, color } = BUCKET_META[key]
        return (
          <div key={key} className="flex items-center gap-1.5">
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
 * Auto-close po 10s.
 *
 * Props:
 *   session: { watering: counts, fertilizing: counts, plants: Set }
 *   confidence: 0..1 — vartotojo „pažinimo" lygis (iš aggregateConfidence)
 *   onDismiss: callback uždarymui
 */
export default function CareSessionSummary({ session, confidence = 0, onDismiss }) {
  const wT = totalIn(session.watering)
  const fT = totalIn(session.fertilizing)
  const uniquePlants = session.plants.size

  // Mood iš agreguotų counts'ų visoms veikloms
  const allCounts = {
    perfect: session.watering.perfect + session.fertilizing.perfect,
    early:   session.watering.early   + session.fertilizing.early,
    late:    session.watering.late    + session.fertilizing.late,
    waylate: session.watering.waylate + session.fertilizing.waylate,
  }
  const mood     = moodFromCounts(allCounts)
  const headline = pick(CARE_COPY.bulk.headline[mood])

  // Sekcijų antraštės — random per render
  const wateringVerb = pick(CARE_COPY.bulk.section.watering)
  const fertilizingVerb = pick(CARE_COPY.bulk.section.fertilizing)

  // Confidence display
  const confPct = Math.round(confidence * 100)

  // Auto-close po 10s
  useEffect(() => {
    const timer = setTimeout(onDismiss, 10000)
    return () => clearTimeout(timer)
  }, [onDismiss])

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
        {/* Confidence — antrasis akcentas. Pakankamas dydis gratification'ui,
            bet aiškiai mažesnis nei headline (per dydį + svorį + spalvą).
            Šalia pridėtas sesijos delta (jei +>0) — vizualus „padaugino pažinimą". */}
        <div className="text-center">
          <p className="text-[22px] font-bold leading-none text-sage-600 tabular-nums">
            {confPct}%
            {session.deltaPct > 0 && (
              <span className="ml-2 text-[14px] font-bold text-sage-500 align-middle">+{session.deltaPct}</span>
            )}
          </p>
          <p className="text-[10px] font-semibold text-gray-400 mt-1 uppercase tracking-wider">Prognozių tikslumas</p>
        </div>

        {/* Headline — pagrindinis akcentas: didžiausias, drąsiausias, tamsus */}
        <h2 className="text-[28px] font-extrabold text-gray-900 text-center mt-5 leading-[1.15] tracking-tight">{headline}</h2>
        <p className="text-sm text-gray-500 text-center mt-2">
          Pasirūpinai {uniquePlants} {plPlantsInstr(uniquePlants)}
        </p>

        {/* Sections */}
        <div className="mt-5 space-y-3">
          {wT > 0 && (
            <div className="bg-gray-50 rounded-2xl p-4">
              <div className="flex items-center gap-2">
                <Droplets size={16} className="text-sky-500" />
                <span className="text-sm font-bold text-gray-800">{wateringVerb} {wT}</span>
              </div>
              <BucketRow counts={session.watering} />
            </div>
          )}
          {fT > 0 && (
            <div className="bg-gray-50 rounded-2xl p-4">
              <div className="flex items-center gap-2">
                <FlaskConical size={16} className="text-amber-500" />
                <span className="text-sm font-bold text-gray-800">{fertilizingVerb} {fT}</span>
              </div>
              <BucketRow counts={session.fertilizing} />
            </div>
          )}
        </div>

        {/* Dismiss — paspaudus bet kur ar 10s auto-close. „Baigta" mygtuko atsisakyta. */}
      </motion.div>
    </motion.div>,
    document.body
  )
}
