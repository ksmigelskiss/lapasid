// Audit — laistymasIntervalas field shape + value distribution catalog'e.
//
// Tikrinam:
//   1. Kiek entries turi vasara/ziema/metodas (per-plant water interval)
//   2. Sample value distribution (median, p25/p75, histogram)
//   3. Plants su suspiciously short (≤3d) ar long (≥21d) intervals
//   4. Žiemos null vs explicit number ratio
//   5. „Metodas" pasiskirstymas — has narrative vs empty
//   6. Schema mismatch — `intervalVasara/intervalZiema/tipas` (wrong) vs `vasara/ziema/metodas`
//   7. CROSS-CHECK: vasara/ziema sanity — žiema turi būti ≥ vasara (slower)
//   8. CROSS-CHECK su category — sukulentas vasara <14d = įtartina
//
// USAGE:
//   node --env-file=.env.local scripts/audit-watering-intervals.mjs

import admin from 'firebase-admin'

let serviceAccount
try { serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) }
catch (e) { console.error('FIREBASE_SERVICE_ACCOUNT parse failed:', e.message); process.exit(1) }
if (serviceAccount.private_key) {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n')
}
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()

const snap = await db.collection('catalog').get()
console.log(`[audit] Reading ${snap.size} catalog entries...\n`)

function category(plant) {
  const tipas   = (plant.tipas ?? '').toLowerCase()
  const greitis = (plant.augimo_greitis ?? '').toLowerCase()
  if ((tipas.includes('sulting') && !tipas.includes('pusiau')) || tipas.includes('kaudeks')) return 'sultingas'
  if (tipas.includes('papart') || tipas.includes('epifit')) return 'papartis'
  if (greitis === 'greitas') return 'greitas'
  return 'vidutinis'
}

const stats = {
  total: snap.size,
  shape: {
    hasVasara: 0,
    hasZiemaNumber: 0,
    hasZiemaNull: 0,        // explicit skip-winter (valid)
    hasMetodas: 0,
    wrongIntervalVasara: 0,  // Audit #4 editor bug
    wrongIntervalZiema: 0,
    wrongTipas: 0,           // .tipas instead of .metodas
    nullOrMissing: 0,
  },
  vasaraValues: [],
  ziemaValues: [],
  byCategory: { sultingas: [], papartis: [], greitas: [], vidutinis: [] },
  suspicious: {
    veryShort: [],         // ≤3d (drowns roots)
    veryLong: [],          // ≥21d vasara (drying out)
    winterShorter: [],     // ziema < vasara (wrong direction)
    succulentTooFrequent: [], // sukulentas + vasara <10d
    fernTooSparse: [],     // papartis + vasara >10d (drying out)
    missingMetodas: [],    // has interval but no metodas narrative
  },
  wrongShape: [],
}

for (const doc of snap.docs) {
  const data = doc.data()
  const id = doc.id
  const latin = data.lotyniskas ?? id
  const la = data.laistymasIntervalas
  const cat = category(data)

  if (!la) {
    stats.shape.nullOrMissing++
    continue
  }

  // Correct shape detection
  if (la.vasara != null) {
    stats.shape.hasVasara++
    stats.vasaraValues.push({ id, latin, value: la.vasara, cat })
    stats.byCategory[cat].push(la.vasara)
  }
  if (la.ziema === null) stats.shape.hasZiemaNull++
  else if (la.ziema != null) {
    stats.shape.hasZiemaNumber++
    stats.ziemaValues.push({ id, latin, value: la.ziema })
  }
  if (la.metodas) stats.shape.hasMetodas++

  // Wrong shape detection (from Audit #4 editor bug, OR AI hallucination)
  if (la.intervalVasara != null) {
    stats.shape.wrongIntervalVasara++
    stats.wrongShape.push({ id, latin, field: 'intervalVasara', value: la.intervalVasara, fullShape: JSON.stringify(la).slice(0, 150) })
  }
  if (la.intervalZiema !== undefined) stats.shape.wrongIntervalZiema++
  if (la.tipas != null && !la.metodas) {
    stats.shape.wrongTipas++
    stats.wrongShape.push({ id, latin, field: 'tipas (should be metodas)', value: la.tipas, fullShape: JSON.stringify(la).slice(0, 150) })
  }

  // Suspicious value detection
  if (la.vasara != null && la.vasara <= 3) {
    stats.suspicious.veryShort.push({ id, latin, vasara: la.vasara, cat })
  }
  if (la.vasara != null && la.vasara >= 21) {
    stats.suspicious.veryLong.push({ id, latin, vasara: la.vasara, cat })
  }
  if (la.vasara != null && la.ziema != null && la.ziema < la.vasara) {
    stats.suspicious.winterShorter.push({ id, latin, vasara: la.vasara, ziema: la.ziema })
  }
  if (la.vasara != null && cat === 'sultingas' && la.vasara < 10) {
    stats.suspicious.succulentTooFrequent.push({ id, latin, vasara: la.vasara })
  }
  if (la.vasara != null && cat === 'papartis' && la.vasara > 10) {
    stats.suspicious.fernTooSparse.push({ id, latin, vasara: la.vasara })
  }
  if (la.vasara != null && (!la.metodas || la.metodas.trim().length < 5)) {
    stats.suspicious.missingMetodas.push({ id, latin })
  }
}

// ── Report ─────────────────────────────────────────────────────

console.log('='.repeat(70))
console.log('LAISTYMAS SHAPE')
console.log('='.repeat(70))
console.log(`Total entries:                  ${stats.total}`)
console.log(`Has vasara (correct):           ${stats.shape.hasVasara}`)
console.log(`Has ziema (number, year-round): ${stats.shape.hasZiemaNumber}`)
console.log(`Has ziema=null (skip winter):   ${stats.shape.hasZiemaNull}  ← e.g. sukulentai jokio laistymo žiemą`)
console.log(`Has metodas (narrative):        ${stats.shape.hasMetodas}`)
console.log(`Null or missing:                ${stats.shape.nullOrMissing}  ← category default fallback`)
console.log()
console.log(`Wrong shape entries:`)
console.log(`  has intervalVasara (Audit #4 editor bug): ${stats.shape.wrongIntervalVasara}`)
console.log(`  has intervalZiema (wrong):                ${stats.shape.wrongIntervalZiema}`)
console.log(`  has tipas (no metodas):                   ${stats.shape.wrongTipas}`)

console.log()
console.log('='.repeat(70))
console.log('VASARA INTERVAL DISTRIBUTION')
console.log('='.repeat(70))
const vasaraValues = stats.vasaraValues.map(e => e.value).sort((a, b) => a - b)
if (vasaraValues.length > 0) {
  const median = vasaraValues[Math.floor(vasaraValues.length / 2)]
  const p25 = vasaraValues[Math.floor(vasaraValues.length * 0.25)]
  const p75 = vasaraValues[Math.floor(vasaraValues.length * 0.75)]
  console.log(`N=${vasaraValues.length}  min=${vasaraValues[0]}  p25=${p25}  median=${median}  p75=${p75}  max=${vasaraValues[vasaraValues.length - 1]}`)
  const buckets = { '1-3': 0, '4-6': 0, '7-9': 0, '10-13': 0, '14-20': 0, '21+': 0 }
  for (const v of vasaraValues) {
    if (v <= 3) buckets['1-3']++
    else if (v <= 6) buckets['4-6']++
    else if (v <= 9) buckets['7-9']++
    else if (v <= 13) buckets['10-13']++
    else if (v <= 20) buckets['14-20']++
    else buckets['21+']++
  }
  for (const [b, c] of Object.entries(buckets)) {
    console.log(`  ${b.padEnd(8)} ${String(c).padStart(3)} ${'█'.repeat(Math.round(c / vasaraValues.length * 40))}`)
  }
}

console.log()
console.log('='.repeat(70))
console.log('PER-CATEGORY VASARA STATS')
console.log('='.repeat(70))
for (const [cat, values] of Object.entries(stats.byCategory)) {
  if (values.length === 0) continue
  values.sort((a, b) => a - b)
  const median = values[Math.floor(values.length / 2)]
  const min = values[0], max = values[values.length - 1]
  console.log(`  ${cat.padEnd(10)} N=${String(values.length).padStart(3)}  min=${min}  median=${median}  max=${max}`)
}

console.log()
console.log('='.repeat(70))
console.log('ZIEMA NULL vs NUMBER')
console.log('='.repeat(70))
console.log(`ziema = null (skip winter): ${stats.shape.hasZiemaNull}`)
console.log(`ziema = number (year-round): ${stats.shape.hasZiemaNumber}`)
if (stats.ziemaValues.length > 0) {
  const ziemaVals = stats.ziemaValues.map(e => e.value).sort((a, b) => a - b)
  console.log(`  ziema number range: ${ziemaVals[0]}–${ziemaVals[ziemaVals.length - 1]}, median ${ziemaVals[Math.floor(ziemaVals.length / 2)]}d`)
}

console.log()
console.log('='.repeat(70))
console.log('SUSPICIOUS VALUES')
console.log('='.repeat(70))

const printList = (label, list, fmt) => {
  if (list.length === 0) return
  console.log(`\n${label} (${list.length}):`)
  for (const e of list.slice(0, 10)) console.log(`  ${fmt(e)}`)
  if (list.length > 10) console.log(`  ... +${list.length - 10} more`)
}

printList('Very short vasara (≤3d, possible root rot risk)',
  stats.suspicious.veryShort, e => `${e.vasara}d  [${e.cat}]  ${e.latin}`)
printList('Very long vasara (≥21d, possible drying)',
  stats.suspicious.veryLong, e => `${e.vasara}d  [${e.cat}]  ${e.latin}`)
printList('Winter SHORTER than summer (wrong direction)',
  stats.suspicious.winterShorter, e => `vasara=${e.vasara}d ziema=${e.ziema}d  ${e.latin}`)
printList('Sukulentai <10d vasara (per dažnai)',
  stats.suspicious.succulentTooFrequent, e => `${e.vasara}d  ${e.latin}`)
printList('Paparčiai >10d vasara (per retai)',
  stats.suspicious.fernTooSparse, e => `${e.vasara}d  ${e.latin}`)
printList('Missing metodas narrative',
  stats.suspicious.missingMetodas, e => e.latin)

if (stats.wrongShape.length > 0) {
  console.log()
  console.log('='.repeat(70))
  console.log('SCHEMA MISMATCH ENTRIES (need rewrite)')
  console.log('='.repeat(70))
  for (const e of stats.wrongShape.slice(0, 10)) {
    console.log(`  [${e.id}] ${e.field}`)
    console.log(`    ${e.fullShape}`)
  }
}

console.log()
process.exit(0)
