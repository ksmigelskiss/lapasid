// Last 7 days statistics aggregation iš plant.timeline įrašų.
// Naudojama CareChartWidget — desktop right panel.
//
// Output: array iš 7 elementų (Pirmadienis → Sekmadienis šios savaitės):
//   [{ dayCode, label, dateISO, watering, fertilizing, isToday }, ...]
//
// Reikia minimalių augalų duomenų — tik plant.timeline su event objektais
// turinčiais .type ir .date arba .timestamp.

const DAY_LABELS = ['P', 'A', 'T', 'K', 'P', 'Š', 'S']
const DAY_CODES  = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

// Grąžina šios savaitės pirmadienio Date objektą (00:00 lokalu laiku).
function thisWeekMonday(now = new Date()) {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  // getDay(): 0=Sun, 1=Mon, ..., 6=Sat. Pirmadienis = 1.
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay()
  d.setDate(d.getDate() + diff)
  return d
}

function dateToISODay(date) {
  return date.toISOString().slice(0, 10)
}

// Iš event'o ištraukiam datos string'ą (gali būti `date: '2026-05-09'`
// arba `timestamp: '2026-05-09T...Z'` — abu formatai timeline'e pasitaiko).
function eventDayISO(event) {
  if (event?.date) return String(event.date).slice(0, 10)
  if (event?.timestamp) return String(event.timestamp).slice(0, 10)
  return null
}

/**
 * aggregateCareWeek — sumeta visus plant.timeline watering+fertilizing event'us
 * į 7-dienos lentą šiai savaitei.
 *
 * @param {Array} plants — augalų sąrašas (dashboard arba library)
 * @returns {Array} 7-elementų array (Pir → Sek)
 */
export function aggregateCareWeek(plants = []) {
  const monday = thisWeekMonday()
  const todayISO = dateToISODay(new Date())

  // Init: 7 dienos su 0/0 count'ais
  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const iso = dateToISODay(d)
    days.push({
      dayCode: DAY_CODES[i],
      label: DAY_LABELS[i],
      dateISO: iso,
      watering: 0,
      fertilizing: 0,
      isToday: iso === todayISO,
    })
  }

  // Walk all plants → all timeline events → bump appropriate day count
  for (const plant of plants) {
    const tl = plant?.timeline ?? []
    for (const e of tl) {
      if (e?.type !== 'watering' && e?.type !== 'fertilizing') continue
      const eventISO = eventDayISO(e)
      if (!eventISO) continue
      const day = days.find(d => d.dateISO === eventISO)
      if (!day) continue // event ne šios savaitės
      if (e.type === 'watering')    day.watering += 1
      if (e.type === 'fertilizing') day.fertilizing += 1
    }
  }

  return days
}
