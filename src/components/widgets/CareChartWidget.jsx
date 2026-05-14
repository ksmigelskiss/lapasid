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
    <div className="bg-bone-50 rounded-2xl shadow-[0_4px_24px_rgba(20,40,30,0.06)] border border-white/40 px-4 py-3.5">
      {/* Header: title + legend */}
      <div className="flex items-center justify-between mb-3">
        <p className="font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.18em]">
          Šios savaitės priežiūra
        </p>
        <div className="flex items-center gap-2 text-[10.5px] text-forest-500">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-forest-500" />Laist.
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-terracotta" />Tręš.
          </span>
        </div>
      </div>

      {/* Bars row */}
      <div className="flex items-end justify-between gap-2 h-[72px]">
        {weekData.map(day => {
          const total = day.watering + day.fertilizing
          const totalPct = (total / maxStack) * 100
          const waterPct = total > 0 ? (day.watering / total) * 100 : 0
          const fertPct  = total > 0 ? (day.fertilizing / total) * 100 : 0

          return (
            <div key={day.dayCode} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full max-w-[26px] bg-bone-300 rounded-md overflow-hidden flex flex-col justify-end" style={{ height: '60px' }}>
                {total > 0 ? (
                  <div className="flex flex-col w-full" style={{ height: `${totalPct}%`, minHeight: '4px' }}>
                    {day.fertilizing > 0 && (
                      <div className="bg-terracotta" style={{ height: `${fertPct}%` }} title={`${day.fertilizing} tręšimai`} />
                    )}
                    {day.watering > 0 && (
                      <div className="bg-forest-500" style={{ height: `${waterPct}%` }} title={`${day.watering} laistymai`} />
                    )}
                  </div>
                ) : null}
              </div>
              <span className={`text-[10.5px] tabular-nums ${
                day.isToday ? 'font-extrabold text-forest-700' : 'font-medium text-forest-400'
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
