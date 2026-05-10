/**
 * CareHeatmapWidget — 2 mėn priežiūros heatmap'as (kalendorinis grid).
 *
 * Pure component. Props:
 *   data — { grid: Day[][], monthMarkers: { weekIndex, label }[] }
 *          iš utils/careWeekStats.js aggregateCareGrid(plants, weeks)
 *
 * Spalvų logika:
 *   - Tręšimas (bet kokia diena): solid amber-400 (tręšimas wins, nes rečiau)
 *   - Laistymas (intensyvumas):
 *       1     → sky-100
 *       2-3   → sky-300
 *       4-5   → sky-500
 *       6+    → sky-700
 *   - 0 veiksmų: gray-200/40
 *   - Šiandien: sage-700 ring outline
 *   - Future: transparent (savaitė virš šios)
 */

const DAY_LABELS = ['P', 'A', 'T', 'K', 'P', 'Š', 'S']

function cellColor(day) {
  if (day.isFuture) return 'bg-transparent'
  if (day.fertilizing > 0) return 'bg-amber-400'
  if (day.watering === 0) return 'bg-gray-200/40'
  if (day.watering <= 1)  return 'bg-sky-100'
  if (day.watering <= 3)  return 'bg-sky-300'
  if (day.watering <= 5)  return 'bg-sky-500'
  return 'bg-sky-700'
}

function cellTooltip(day) {
  const parts = []
  if (day.watering > 0) parts.push(`${day.watering} laistymai`)
  if (day.fertilizing > 0) parts.push(`${day.fertilizing} tręšimai`)
  return `${day.dateISO}${parts.length ? ' — ' + parts.join(' · ') : ''}`
}

export default function CareHeatmapWidget({ data }) {
  if (!data) return null
  const { grid, monthMarkers } = data

  return (
    <div className="bg-white/55 backdrop-blur-xl rounded-2xl shadow-[0_4px_24px_rgba(20,40,30,0.06)] border border-white/40 px-4 py-3.5">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
          Priežiūros istorija
        </p>
        <div className="flex items-center gap-2 text-[10.5px] text-gray-500">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-sky-400" />Laist.
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-amber-400" />Tręš.
          </span>
        </div>
      </div>

      {/* Mėnesio žymekliai virš grid'o */}
      <div className="flex pl-5 pb-1 text-[9.5px] font-semibold text-gray-400 uppercase tracking-wider relative h-3.5">
        {monthMarkers.map(m => (
          <span
            key={`${m.weekIndex}-${m.label}`}
            className="absolute"
            // weekIndex * (cellW + gap) — width parametrai apačioj
            style={{ left: `${m.weekIndex * 18}px` }}
          >
            {m.label}
          </span>
        ))}
      </div>

      {/* Grid: kairėj day labels (P A T K P Š S), dešinėj 8 savaičių stulpeliai */}
      <div className="flex gap-1.5">
        {/* Day labels column */}
        <div className="flex flex-col gap-[3px] pt-[1px]">
          {DAY_LABELS.map((label, i) => (
            <span
              key={i}
              className="text-[9px] font-medium text-gray-400 leading-none w-3 h-[15px] flex items-center"
            >
              {/* Show only Mon, Wed, Fri (kas antrą), kad netilptų pernelyg arti */}
              {i % 2 === 0 ? label : ''}
            </span>
          ))}
        </div>

        {/* Heatmap grid — 8 savaičių stulpeliai */}
        <div className="flex gap-[3px]">
          {grid.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map(day => (
                <div
                  key={day.dateISO}
                  title={cellTooltip(day)}
                  className={`w-[15px] h-[15px] rounded-[3px] ${cellColor(day)} ${
                    day.isToday ? 'ring-[1.5px] ring-sage-700 ring-offset-0' : ''
                  }`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
