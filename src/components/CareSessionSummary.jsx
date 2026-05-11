import { useEffect } from 'react'
import { Sprout, Droplets, FlaskConical, Clock, Heart, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { CARE_COPY, plPlantsInstr, pick } from '../constants/careCopy'
import { moodFromCounts } from '../utils/careBuckets'

// Bucket meta — Brandbook'iškai: forest gradient'as nuo perfect (geriausia)
// iki waylate (blogiausia), su terracotta įvykdomame `late`/`waylate` rate.
const BUCKET_META = {
  perfect: { Icon: Sprout,   color: 'text-forest-600'    },
  early:   { Icon: Droplets, color: 'text-forest-400'    },
  late:    { Icon: Clock,    color: 'text-terracotta-400' },
  waylate: { Icon: Heart,    color: 'text-terracotta-600' },
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
            <span className="text-sm font-bold text-forest-700">{count}</span>
            <span className="text-sm text-forest-500">{CARE_COPY.bulk.label[key]}</span>
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
        {/* Close X — viršutiniame dešiniame kampe. Dismiss yra ir per
            tap-anywhere + 10s auto-close, bet ne visiems aišku → eksplicit X. */}
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 w-8 h-8 rounded-btn bg-gray-100 active:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
          aria-label="Uždaryti"
        >
          <X size={16} />
        </button>

        {/* Confidence + sesijos delta — Brandbook'iškai: bazinis % forest-600
            ramus, delta gain — forest-700 didesnis (POSITIVE = forest). */}
        <div className="text-center">
          <p className="leading-none tabular-nums">
            <span className="text-[22px] font-bold text-forest-600">{confPct}%</span>
            {session.deltaPct > 0 && (
              <span className="ml-2 text-[28px] font-extrabold text-forest-700 align-middle">+{session.deltaPct}</span>
            )}
          </p>
          <p className="text-[10px] font-semibold text-forest-400 mt-1.5 uppercase tracking-wider font-mono">Prognozių tikslumas</p>
        </div>

        {/* Headline — drąsiausias akcentas */}
        <h2 className="text-[28px] font-extrabold text-forest-800 text-center mt-5 leading-[1.15] tracking-tight">{headline}</h2>
        <p className="text-sm text-forest-500 text-center mt-2">
          Pasirūpinai {uniquePlants} {plPlantsInstr(uniquePlants)}
        </p>

        {/* Sections */}
        <div className="mt-5 space-y-3">
          {wT > 0 && (
            <div className="bg-forest-50 rounded-2xl p-4">
              <div className="flex items-center gap-2">
                <Droplets size={16} className="text-forest-500" />
                <span className="text-sm font-bold text-forest-700">{wateringVerb} {wT}</span>
              </div>
              <BucketRow counts={session.watering} />
            </div>
          )}
          {fT > 0 && (
            <div className="bg-terracotta-50 rounded-2xl p-4">
              <div className="flex items-center gap-2">
                <FlaskConical size={16} className="text-terracotta-500" />
                <span className="text-sm font-bold text-forest-700">{fertilizingVerb} {fT}</span>
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
