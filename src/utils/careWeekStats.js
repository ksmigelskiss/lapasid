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

// LOCAL date → 'YYYY-MM-DD'. Negalima naudoti `toISOString()` — tas
// konvertuoja į UTC, ir vakare/naktį (kai UTC viena diena, lokalu kita)
// gauname klaidingą datą (off-by-one bug).
function dateToISODay(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Iš event'o ištraukiam datos string'ą (gali būti `date: '2026-05-09'`
// arba `timestamp: '2026-05-09T...Z'` — abu formatai timeline'e pasitaiko).
// Timestamp atveju konvertuojam į lokalią datą, ne UTC slice'iuojam.
function eventDayISO(event) {
  if (event?.date) return String(event.date).slice(0, 10)
  if (event?.timestamp) return dateToISODay(new Date(event.timestamp))
  return null
}

// LT mėnesio sutrumpinimas pagal mėnesio indeksą (0-11).
const MONTH_SHORT = ['Sau', 'Vas', 'Kov', 'Bal', 'Geg', 'Bir', 'Lie', 'Rgp', 'Rgs', 'Spa', 'Lap', 'Grd']

/**
 * aggregateCareGrid — sumeta plant.timeline event'us į 7×N savaičių grid'ą
 * (heatmap'ui). Output forma: 2D array (savaitės kaip stulpeliai, dienos
 * Pir→Sek kaip eilutės).
 *
 * @param {Array} plants — augalų sąrašas
 * @param {number} weeks — kiek savaičių (default 8 = ~2 mėn)
 * @returns {{ grid: Day[][], monthMarkers: { weekIndex, label }[] }}
 */
export function aggregateCareGrid(plants = [], weeks = 8) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = dateToISODay(today)

  // Pirmadienis šios savaitės. Iš šio taško atgal — weeks * 7 dienų,
  // pirmyn — iki sekmadienio (kad savaitė pilna; ateities langeliai = future).
  const dayOfWeek = today.getDay() // 0=Sek, 1-6=Pir-Šeš
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const thisMonday = new Date(today)
  thisMonday.setDate(today.getDate() - daysSinceMonday)

  // Start = thisMonday - (weeks-1) * 7 days (pradedam weeks-1 savaičių atgal,
  // baigiam šios savaitės sekmadienį)
  const startDate = new Date(thisMonday)
  startDate.setDate(thisMonday.getDate() - (weeks - 1) * 7)

  const grid = [] // savaitės kaip stulpeliai
  const monthMarkers = [] // { weekIndex, label } — kuriam stulpely pirmadienis pakeičia mėnesį
  let lastMonth = -1

  for (let w = 0; w < weeks; w++) {
    const week = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(startDate)
      date.setDate(startDate.getDate() + w * 7 + d)
      const iso = dateToISODay(date)
      week.push({
        dateISO: iso,
        date,
        watering: 0,
        fertilizing: 0,
        isToday: iso === todayISO,
        isFuture: date > today,
      })
    }
    grid.push(week)
    // Mėnesio žymeklis — kai šios savaitės pirmadienio mėnuo skiriasi nuo praeito
    const mondayMonth = week[0].date.getMonth()
    if (mondayMonth !== lastMonth) {
      monthMarkers.push({ weekIndex: w, label: MONTH_SHORT[mondayMonth] })
      lastMonth = mondayMonth
    }
  }

  // Aggregate from plants
  for (const plant of plants) {
    const tl = plant?.timeline ?? []
    for (const e of tl) {
      if (e?.type !== 'watering' && e?.type !== 'fertilizing') continue
      const eventISO = eventDayISO(e)
      if (!eventISO) continue
      // Surask atitinkamą langelį
      for (const week of grid) {
        const cell = week.find(c => c.dateISO === eventISO)
        if (cell) {
          cell[e.type] += 1
          break
        }
      }
    }
  }

  return { grid, monthMarkers }
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
