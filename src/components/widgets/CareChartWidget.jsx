/**
 * CareChartWidget — šios savaitės priežiūros bar chart (laistymas / tręšimas)
 * dešinei panelei.
 *
 * Pure component. Props:
 *   weekData — array iš 7 dienos objektų (žr. utils/careWeekStats.js
 *              aggregateCareWeek). Forma:
 *              [{ dayCode, label, dateISO, watering, fertilizing, isToday }, ...]
 *
 * Stacked bars: laistymas mėlynas (apačioje), tręšimas oranžinis (viršuje).
 * Šiandien — bar'as turi sage-300 ring + pastorintą label'į.
 */
export default function CareChartWidget({ weekData = [] }) {
  // Auto-scale: maxStack visom dienom, kad bar'ai būtų proporcingi
  const maxStack = Math.max(1, ...weekData.map(d => d.watering + d.fertilizing))

  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl shadow-[0_2px_12px_rgba(20,40,30,0.08)] border border-white/60 px-4 py-3.5">
      {/* Header: title + legend */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
          Šios savaitės priežiūra
        </p>
        <div className="flex items-center gap-2 text-[10.5px] text-gray-500">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sky-400" />Laist.
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400" />Tręš.
          </span>
        </div>
      </div>

      {/* Bars row — fixed height for chart area, items-end so bars grow up from baseline */}
      <div className="flex items-end justify-between gap-2 h-[72px]">
        {weekData.map(day => {
          const total = day.watering + day.fertilizing
          const totalPct = (total / maxStack) * 100  // bar full-stack height %
          const waterPct = total > 0 ? (day.watering / total) * 100 : 0
          const fertPct  = total > 0 ? (day.fertilizing / total) * 100 : 0

          return (
            <div key={day.dayCode} className="flex-1 flex flex-col items-center gap-1.5">
              {/* Bar column */}
              <div className="w-full max-w-[26px] bg-gray-100 rounded-md overflow-hidden flex flex-col justify-end" style={{ height: '60px' }}>
                {total > 0 ? (
                  <div className="flex flex-col w-full" style={{ height: `${totalPct}%`, minHeight: '4px' }}>
                    {day.fertilizing > 0 && (
                      <div className="bg-amber-400" style={{ height: `${fertPct}%` }} title={`${day.fertilizing} tręšimai`} />
                    )}
                    {day.watering > 0 && (
                      <div className="bg-sky-400" style={{ height: `${waterPct}%` }} title={`${day.watering} laistymai`} />
                    )}
                  </div>
                ) : null}
              </div>
              {/* Day label */}
              <span className={`text-[10.5px] tabular-nums ${
                day.isToday ? 'font-extrabold text-sage-700' : 'font-medium text-gray-400'
              }`}>
                {day.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
