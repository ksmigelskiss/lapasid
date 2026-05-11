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

// Brandbook v1.0 — Water=forest, Fert=terracotta. Intensity per quartile.
const FOREST_TONES    = ['', 'bg-forest-100',     'bg-forest-300',     'bg-forest-500', 'bg-forest-700']
const TERRACOTTA_TONES = ['', 'bg-terracotta-100', 'bg-terracotta-200', 'bg-terracotta',  'bg-terracotta-600']

function cellColor(day, maxWater, maxFert) {
  if (day.fertilizing > 0) return TERRACOTTA_TONES[bucket(day.fertilizing, maxFert)]
  if (day.watering > 0)    return FOREST_TONES[bucket(day.watering, maxWater)]
  return 'bg-bone-300'
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
        <p className="font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.18em]">
          Priežiūros istorija
        </p>
        <div className="flex items-center gap-2.5">
          {collapsed ? (
            <span className="inline-flex items-center gap-2 text-[10.5px] font-semibold">
              <span className="inline-flex items-center gap-1 text-forest-700 tabular-nums">
                <span className="w-2 h-2 rounded-sm bg-forest-500" />{totalWater}
              </span>
              <span className="inline-flex items-center gap-1 text-terracotta-600 tabular-nums">
                <span className="w-2 h-2 rounded-sm bg-terracotta" />{totalFert}
              </span>
            </span>
          ) : (
            // Expanded legend — 4-swatch gradient'as parodo intensyvumo skalę
            // (1-2-3-4 dienos veiksmų per dieną), kad vartotojui būtų aišku, ką
            // tamsesni langeliai reiškia. Tos pačios spalvos kaip cellColor() bucket'ai.
            <div className="flex items-center gap-2.5 text-[10.5px] text-forest-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex gap-px">
                  <span className="w-[5px] h-2.5 rounded-[1px] bg-forest-100" />
                  <span className="w-[5px] h-2.5 rounded-[1px] bg-forest-300" />
                  <span className="w-[5px] h-2.5 rounded-[1px] bg-forest-500" />
                  <span className="w-[5px] h-2.5 rounded-[1px] bg-forest-700" />
                </span>
                Laist.
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex gap-px">
                  <span className="w-[5px] h-2.5 rounded-[1px] bg-terracotta-100" />
                  <span className="w-[5px] h-2.5 rounded-[1px] bg-terracotta-200" />
                  <span className="w-[5px] h-2.5 rounded-[1px] bg-terracotta" />
                  <span className="w-[5px] h-2.5 rounded-[1px] bg-terracotta-600" />
                </span>
                Tręš.
              </span>
            </div>
          )}
          <ChevronDown size={14} className={`text-forest-400 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </div>
      </button>

      {!collapsed && (
        <div className="px-4 pb-3.5">

      {/* Scrollable wrapper — jei kada nors weeks count padidės arba widget'as
          pateks į siauresnį kontekstą, horizontalus scroll'as išgelbės nuo
          slapto clip'inimo. Šiuo metu 8 savaitės telpa RightPanel'yje (430px). */}
      <div className="overflow-x-auto scrollbar-none -mx-1 px-1">

      {/* Mėnesio žymekliai virš grid'o */}
      <div className="flex pl-7 pb-1 font-mono text-[9px] font-medium text-forest-400 uppercase tracking-[0.18em] relative h-3.5">
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
      <div className="flex gap-1.5 w-max">
        {/* Day labels (visi 7 matomi, 2-letter abbr — Pi, An, Tr, Ke, Pe, Še, Se) */}
        <div className="flex flex-col gap-[3px] pt-[1px]">
          {DAY_LABELS.map((label, i) => (
            <span
              key={i}
              className="font-mono text-[9px] font-medium text-forest-400 leading-none w-4 h-[15px] flex items-center"
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
                    className="absolute top-0 bottom-0 w-px bg-bone-400/70"
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
                        day.isToday ? 'ring-[1.5px] ring-forest-700 ring-offset-0' : ''
                      }`}
                    />
                  )
                )}
              </div>
            )
          })}
        </div>
      </div>

      </div>{/* / scrollable wrapper */}

      {/* Total summary */}
      <div className="flex items-center justify-between text-[10.5px] text-forest-500 mt-3 pt-2 border-t border-bone-400/60">
        <span>Iš viso (8 sav.):</span>
        <span className="inline-flex items-center gap-2 font-semibold">
          <span className="inline-flex items-center gap-1 text-forest-700 tabular-nums">
            <span className="w-2 h-2 rounded-sm bg-forest-500" />{totalWater}
          </span>
          <span className="inline-flex items-center gap-1 text-terracotta-600 tabular-nums">
            <span className="w-2 h-2 rounded-sm bg-terracotta" />{totalFert}
          </span>
        </span>
      </div>
        </div>
      )}
    </div>
  )
}
