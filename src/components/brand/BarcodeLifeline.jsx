import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Droplets, FlaskConical } from 'lucide-react'

/**
 * BarcodeLifeline — augalo „vandens DNR" kaip barcode.
 *
 * Brand'iškai = T4Mark bars vizualinė šeima. Du row'ai stacked:
 *   - Viršus: laistymai (forest)
 *   - Apačia: trąšos (terracotta)
 *
 * Kiekvienas baras = vienas priežiūros įvykis chronologine tvarka.
 * Bar aukštis = dienų skaičius nuo praeito to paties tipo įvykio
 * (taller = ilgesnis pertraukis).
 *
 * Ghost barai (bone-400/40) pildo eilutę iki MIN_BARS_TARGET, kad mažos
 * istorijos atveju vartotojas iškart matytų kompozicijos struktūrą
 * — „dar nebaigtas barcode'as".
 *
 * Truncation: rodome paskutinius MAX_BARS — kitu atveju mobile width'as
 * paverstų barus < 1px storio. Footer'is rodo „naujausi N iš total"
 * nuorodą į pilną history (per timeline žemiau).
 *
 * Props:
 *   events — plant.timeline masyvas
 */

const MIN_BARS_TARGET = 20   // pildome ghost slot'us iki 20 jei mažiau įvykių
const MAX_BARS        = 100  // truncate'inam į paskutinius 100 — saugaus density limit'as

export default function BarcodeLifeline({ events = [] }) {
  const allEvents = useMemo(
    () => [...events].sort((a, b) => new Date(a.date) - new Date(b.date)),
    [events]
  )

  // True empty (jokių laistymų NEI trąšų)
  const careCount = allEvents.filter(e => e.type === 'watering' || e.type === 'fertilizing').length
  if (careCount === 0) {
    return (
      <div className="w-full aspect-[3/2] bg-bone-50 flex flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest-400">
          Dar nėra priežiūros istorijos
        </p>
        <p className="text-[12px] text-forest-500 leading-snug">
          Pridėk pirmąjį laistymą per <span className="font-semibold text-forest-600">+</span> apačioje
        </p>
      </div>
    )
  }

  return (
    <div className="w-full aspect-[3/2] bg-bone-50 flex flex-col px-5 pt-4 pb-3">
      <Row events={allEvents} type="watering"    tone="forest"     Icon={Droplets}     label="LAIKAS TARP LAISTYMŲ" />
      <div className="h-3 flex-shrink-0" />
      <Row events={allEvents} type="fertilizing" tone="terracotta" Icon={FlaskConical} label="LAIKAS TARP TRĘŠIMŲ" />

      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-forest-400 mt-2 text-center flex-shrink-0">
        {formatDateRange(allEvents)}
      </p>
    </div>
  )
}

// ── Single row (vienas care type) ──────────────────────────────

function Row({ events, type, tone, Icon, label }) {
  const filtered = events.filter(e => e.type === type)
  const total = filtered.length

  // Truncation: kai įvykių per daug — paliekam paskutinius MAX_BARS.
  // Ghost'ai šiuo metu neberodomi (visi slot'ai užimti realiais bar'ais).
  const truncated = total > MAX_BARS
  const visible   = truncated ? filtered.slice(-MAX_BARS) : filtered
  const count     = visible.length

  // Intervalai tarp gretimų to paties tipo įvykių (visible diapazone)
  const intervals = visible.map((e, i) => {
    if (i === 0) return null
    const ms = new Date(e.date).getTime() - new Date(visible[i - 1].date).getTime()
    return Math.max(1, Math.round(ms / 86400000))
  })

  const validIntervals = intervals.filter(d => d !== null)
  const maxInterval = Math.max(...validIntervals, 1)
  // Average — visada pagal VISĄ history (ne tik visible), kad reikšmė būtų stabili
  const allIntervals = filtered.map((e, i) => {
    if (i === 0) return null
    const ms = new Date(e.date).getTime() - new Date(filtered[i - 1].date).getTime()
    return Math.max(1, Math.round(ms / 86400000))
  }).filter(d => d !== null)
  const avgInterval = allIntervals.length
    ? Math.round(allIntervals.reduce((s, d) => s + d, 0) / allIntervals.length)
    : 0

  const realHeights = intervals.map(d =>
    d === null ? 0.55 : 0.3 + (d / maxInterval) * 0.7
  )

  // Ghost padding — tik kai NE truncated ir count < target
  const ghostCount = truncated ? 0 : Math.max(0, MIN_BARS_TARGET - count)
  const ghostHeight = 0.15

  const barColor   = tone === 'forest' ? 'bg-forest-700' : 'bg-terracotta'
  const labelColor = tone === 'forest' ? 'text-forest-600' : 'text-terracotta-600'
  const metaColor  = tone === 'forest' ? 'text-forest-400' : 'text-terracotta-400'

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header: icon + label kairėje, count + avg dešinėje */}
      <div className="flex items-baseline gap-2 mb-1.5 flex-shrink-0">
        <Icon size={11} className={`${labelColor} flex-shrink-0 self-center`} />
        <p className={`font-mono text-[10px] font-medium uppercase tracking-[0.16em] ${labelColor} truncate`}>
          {label}
        </p>
        <p className={`font-mono text-[9.5px] uppercase tracking-[0.16em] ${metaColor} ml-auto flex-shrink-0`}>
          {total} ĮV
          {avgInterval > 0 && (
            <> · VID {avgInterval}D</>
          )}
          {truncated && (
            <span className="opacity-70"> · NAUJAUSI {MAX_BARS}</span>
          )}
        </p>
      </div>

      {/* Bars — flex-1 evenly distribute, kiekvienas su title tooltip'u */}
      <div className="flex-1 flex items-end gap-px min-h-0">
        {realHeights.map((h, i) => (
          <motion.div
            key={`r-${i}`}
            title={barTooltip(visible[i], intervals[i])}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{
              duration: 0.4,
              delay: Math.min(i * 0.012, 0.6),
              ease: [0.22, 1, 0.36, 1],
            }}
            className={`${barColor} rounded-sm flex-1 min-w-px origin-bottom cursor-help`}
            style={{ height: `${h * 100}%` }}
          />
        ))}
        {Array.from({ length: ghostCount }).map((_, i) => (
          <div
            key={`g-${i}`}
            title="Ateities slot'as — užpildysi pridėdamas naują įvykį"
            className="bg-bone-400/40 rounded-sm flex-1 min-w-px"
            style={{ height: `${ghostHeight * 100}%` }}
          />
        ))}
      </div>
    </div>
  )
}

// ── Tooltip text per barą (native HTML title) ─────────────────

function barTooltip(event, interval) {
  if (!event) return ''
  const date = event.date
  if (interval === null) {
    return `${date} · pirmas šios rūšies įvykis`
  }
  return `${date} · po ${interval} ${plDay(interval)} nuo praeito`
}

function plDay(n) {
  const lastTwo = n % 100
  const last = n % 10
  if (lastTwo >= 11 && lastTwo <= 19) return 'dienų'
  if (last === 1) return 'dienos'
  if (last >= 2 && last <= 9)  return 'dienų'
  return 'dienų'
}

// ── Date range formatter ──────────────────────────────────────

const MONTHS_LT = ['SAU', 'VAS', 'KOV', 'BAL', 'GEG', 'BIR', 'LIE', 'RUG', 'RGS', 'SPA', 'LAP', 'GRD']

function formatDateRange(events) {
  if (events.length === 0) return ''
  const first = new Date(events[0].date)
  const last = new Date(events[events.length - 1].date)
  const f = `${MONTHS_LT[first.getMonth()]} ${first.getFullYear()}`
  const l = `${MONTHS_LT[last.getMonth()]} ${last.getFullYear()}`
  return f === l ? f : `${f} → ${l}`
}
