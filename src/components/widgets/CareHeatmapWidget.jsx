import { ChevronDown } from 'lucide-react'
import { useCollapsible } from '../../hooks/useCollapsible'

/**
 * CareHeatmapWidget — 2 mėn priežiūros heatmap'as (kalendorinis grid).
 *
 * Pure component. Props:
 *   data — { grid: Day[][], monthMarkers: { weekIndex, label }[] }
 *          iš utils/careWeekStats.js aggregateCareGrid(plants, weeks)
 *
 * Spalvų logika:
 *   - Tręšimas (bet kokia diena): solid amber-400 (laimi prieš laist, retas)
 *   - Laistymas intensyvumas:
 *       1     → sky-100
 *       2-3   → sky-300
 *       4-5   → sky-500
 *       6+    → sky-700
 *   - 0 veiksmų: gray-100 (matomas grid struktūra)
 *   - Šiandien: sage-700 ring outline
 *   - Future: visai NErenderinami (clean truncate ties šiandien)
 *
 * Visual papildomai: vertikalūs divider'iai tarp savaičių, kur prasideda
 * naujas mėnuo (sinchronizuotas su mėnesio label'iais virš grid'o).
 */

const DAY_LABELS = ['Pi', 'An', 'Tr', 'Ke', 'Pe', 'Še', 'Se']
const CELL_PX    = 15
const GAP_PX     = 3
const COL_PX     = CELL_PX + GAP_PX // 18px

// Quartile bucket pagal value vs. max — adaptuojasi prie konkretaus dataset'o.
// Bucket 0 → 0 actions; 1-4 → 1-25% / 25-50% / 50-75% / 75-100% nuo max'o.
function bucket(value, max) {
  if (value <= 0) return 0
  if (max <= 1) return 4 // edge case — max=1 reiškia visi vienodai aukščiausi
  const pct = value / max
  if (pct <= 0.25) return 1
  if (pct <= 0.5)  return 2
  if (pct <= 0.75) return 3
  return 4
}

const SKY_TONES   = ['', 'bg-sky-100',   'bg-sky-300',   'bg-sky-500',   'bg-sky-700']
const AMBER_TONES = ['', 'bg-amber-100', 'bg-amber-300', 'bg-amber-500', 'bg-amber-700']

function cellColor(day, maxWater, maxFert) {
  // Tręšimas wins (rečiau, vizualiai svarbiau) — bet su gradient ne vienu tonu.
  if (day.fertilizing > 0) return AMBER_TONES[bucket(day.fertilizing, maxFert)]
  if (day.watering > 0)    return SKY_TONES[bucket(day.watering, maxWater)]
  return 'bg-gray-100'
}

function cellTooltip(day) {
  const parts = []
  if (day.watering > 0) parts.push(`${day.watering} laistymai`)
  if (day.fertilizing > 0) parts.push(`${day.fertilizing} tręšimai`)
  return `${day.dateISO}${parts.length ? ' — ' + parts.join(' · ') : ''}`
}

export default function CareHeatmapWidget({ data }) {
  const [collapsed, toggle] = useCollapsible('heatmap', false)

  if (!data) return null
  const { grid, monthMarkers } = data

  // Vienu pereinimu: bendri totals + max per dieną (gradient bucket'ams).
  let totalWater = 0
  let totalFert = 0
  let maxWater  = 0
  let maxFert   = 0
  for (const week of grid) {
    for (const day of week) {
      if (day.isFuture) continue
      totalWater += day.watering
      totalFert  += day.fertilizing
      if (day.watering > maxWater)   maxWater   = day.watering
      if (day.fertilizing > maxFert) maxFert    = day.fertilizing
    }
  }

  // Mėnesio divider'iai — visi marker'iai išskyrus weekIndex=0 (pati pradžia
  // nereikalinga — tas tiesiog pirmas matomas mėnuo).
  const dividerWeekIdxs = new Set(
    monthMarkers.filter(m => m.weekIndex > 0).map(m => m.weekIndex)
  )

  return (
    <div className="bg-white/55 backdrop-blur-xl rounded-2xl shadow-[0_4px_24px_rgba(20,40,30,0.06)] border border-white/40">
      {/* Header — visada matomas, click toggleina collapse */}
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/30 transition-colors rounded-2xl"
        aria-expanded={!collapsed}
      >
        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
          Priežiūros istorija
        </p>
        <div className="flex items-center gap-2.5">
          {collapsed ? (
            // Collapsed — tik total skaičiai pakaitalui
            <span className="inline-flex items-center gap-2 text-[10.5px] font-semibold">
              <span className="inline-flex items-center gap-1 text-sky-700 tabular-nums">
                <span className="w-2 h-2 rounded-sm bg-sky-400" />{totalWater}
              </span>
              <span className="inline-flex items-center gap-1 text-amber-700 tabular-nums">
                <span className="w-2 h-2 rounded-sm bg-amber-400" />{totalFert}
              </span>
            </span>
          ) : (
            // Expanded — legenda
            <div className="flex items-center gap-2 text-[10.5px] text-gray-500">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-sky-400" />Laist.
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-amber-400" />Tręš.
              </span>
            </div>
          )}
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </div>
      </button>

      {!collapsed && (
        <div className="px-4 pb-3.5">

      {/* Mėnesio žymekliai virš grid'o */}
      <div className="flex pl-7 pb-1 text-[9.5px] font-semibold text-gray-400 uppercase tracking-wider relative h-3.5">
        {monthMarkers.map(m => (
          <span
            key={`${m.weekIndex}-${m.label}`}
            className="absolute"
            style={{ left: `${m.weekIndex * COL_PX}px` }}
          >
            {m.label}
          </span>
        ))}
      </div>

      {/* Grid: kairėj day labels, dešinėj 8 savaičių stulpeliai su divider'iais */}
      <div className="flex gap-1.5">
        {/* Day labels (visi 7 matomi, 2-letter abbr — Pi, An, Tr, Ke, Pe, Še, Se) */}
        <div className="flex flex-col gap-[3px] pt-[1px]">
          {DAY_LABELS.map((label, i) => (
            <span
              key={i}
              className="text-[9px] font-medium text-gray-400 leading-none w-4 h-[15px] flex items-center"
            >
              {label}
            </span>
          ))}
        </div>

        {/* Heatmap grid — 8 savaičių stulpeliai su mėnesio divider'iais */}
        <div className="flex gap-[3px] relative">
          {grid.map((week, wi) => {
            const isMonthDivider = dividerWeekIdxs.has(wi)
            return (
              <div key={wi} className="relative flex flex-col gap-[3px]">
                {/* Vertikalus divider — plonas linijos virš -gap pozicijoj */}
                {isMonthDivider && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-gray-300/70"
                    style={{ left: '-2px' }}
                  />
                )}
                {week.map(day =>
                  day.isFuture ? (
                    // Future — nerenderinam (placeholder dydis išlaikomas div'u
                    // be content'o, kad savaitės grid'as nesusispaustų)
                    <div key={day.dateISO} className="w-[15px] h-[15px]" />
                  ) : (
                    <div
                      key={day.dateISO}
                      title={cellTooltip(day)}
                      className={`w-[15px] h-[15px] rounded-[3px] ${cellColor(day, maxWater, maxFert)} ${
                        day.isToday ? 'ring-[1.5px] ring-sage-700 ring-offset-0' : ''
                      }`}
                    />
                  )
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Total summary — kontekstas */}
      <div className="flex items-center justify-between text-[10.5px] text-gray-500 mt-3 pt-2 border-t border-gray-200/60">
        <span>Iš viso (8 sav.):</span>
        <span className="inline-flex items-center gap-2 font-semibold">
          <span className="inline-flex items-center gap-1 text-sky-700 tabular-nums">
            <span className="w-2 h-2 rounded-sm bg-sky-400" />{totalWater}
          </span>
          <span className="inline-flex items-center gap-1 text-amber-700 tabular-nums">
            <span className="w-2 h-2 rounded-sm bg-amber-400" />{totalFert}
          </span>
        </span>
      </div>
        </div>
      )}
    </div>
  )
}
