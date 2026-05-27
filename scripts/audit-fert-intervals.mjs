// Audit — tresimas + laistymasIntervalas field shapes catalog'e.
//
// Tikrinam:
//   1. Kiek entries turi tresimas.intervalVasara (per-plant fert interval)
//   2. Kiek turi laistymasIntervalas.vasara (per-plant water interval)
//   3. Sample value distribution (median, p25/p75)
//   4. Plants su suspiciously round numbers (likely AI defaults)
//   5. Schema mismatch detection — wrong field names from my Audit #4 editors
//      (laistymasIntervalas.intervalVasara — should be .vasara)
//      (tresimas.reikia — should be tresimas.intervalVasara)
//
// USAGE:
//   node --env-file=.env.local scripts/audit-fert-intervals.mjs

import admin from 'firebase-admin'

function initAdmin() {
  let serviceAccount
  try { serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) }
  catch (e) { console.error('FIREBASE_SERVICE_ACCOUNT parse failed:', e.message); process.exit(1) }
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n')
  }
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
}

initAdmin()
const db = admin.firestore()

const snap = await db.collection('catalog').get()
console.log(`[audit] Reading ${snap.size} catalog entries...\n`)

const stats = {
  total: snap.size,
  tresimasShape: {
    hasIntervalVasara: 0,
    hasIntervalZiema: 0,
    hasTipas: 0,
    hasReikia: 0,            // dormancyInfo-style, WRONG for tresimas
    nullOrMissing: 0,
  },
  laistymasShape: {
    hasVasaraCorrect: 0,     // .vasara (correct schema)
    hasZiemaCorrect: 0,
    hasMetodasCorrect: 0,
    hasIntervalVasaraWrong: 0,  // .intervalVasara (WRONG from my editor)
    hasIntervalZiemaWrong: 0,
    hasTipasWrong: 0,           // .tipas (WRONG, should be .metodas)
    nullOrMissing: 0,
  },
  fertIntervalValues: [],     // for distribution analysis
  waterIntervalValues: [],
  fertMonthlyOrLonger: [],    // suspicious: ≥28d (could be too generic)
  wrongShapeEntries: [],      // entries with WRONG schema (need rewrite)
}

for (const doc of snap.docs) {
  const data = doc.data()
  const id = doc.id
  const latin = data.lotyniskas ?? id

  // Tresimas shape
  const tre = data.tresimas
  if (!tre) {
    stats.tresimasShape.nullOrMissing++
  } else {
    if (tre.intervalVasara != null) {
      stats.tresimasShape.hasIntervalVasara++
      stats.fertIntervalValues.push({ id, latin, value: tre.intervalVasara })
      if (tre.intervalVasara >= 28) {
        stats.fertMonthlyOrLonger.push({ id, latin, days: tre.intervalVasara })
      }
    }
    if (tre.intervalZiema !== undefined) stats.tresimasShape.hasIntervalZiema++
    if (tre.tipas != null) stats.tresimasShape.hasTipas++
    if (tre.reikia !== undefined) {
      stats.tresimasShape.hasReikia++
      stats.wrongShapeEntries.push({
        id, latin, field: 'tresimas',
        issue: 'has reikia (dormancyInfo-style)',
        shape: JSON.stringify(tre),
      })
    }
  }

  // Laistymas shape
  const la = data.laistymasIntervalas
  if (!la) {
    stats.laistymasShape.nullOrMissing++
  } else {
    if (la.vasara != null) {
      stats.laistymasShape.hasVasaraCorrect++
      stats.waterIntervalValues.push({ id, latin, value: la.vasara })
    }
    if (la.ziema !== undefined) stats.laistymasShape.hasZiemaCorrect++
    if (la.metodas != null) stats.laistymasShape.hasMetodasCorrect++
    if (la.intervalVasara != null) {
      stats.laistymasShape.hasIntervalVasaraWrong++
      stats.wrongShapeEntries.push({
        id, latin, field: 'laistymasIntervalas',
        issue: 'has intervalVasara (wrong field — should be .vasara)',
        shape: JSON.stringify(la),
      })
    }
    if (la.intervalZiema !== undefined) stats.laistymasShape.hasIntervalZiemaWrong++
    if (la.tipas != null) {
      stats.laistymasShape.hasTipasWrong++
      // Only flag wrong-tipas if no correct .metodas
      if (!la.metodas) {
        stats.wrongShapeEntries.push({
          id, latin, field: 'laistymasIntervalas',
          issue: 'has tipas (wrong field — should be .metodas)',
          shape: JSON.stringify(la),
        })
      }
    }
  }
}

// ── Report ────────────────────────────────────────────────────────

console.log('=' .repeat(70))
console.log('TRESIMAS SHAPE')
console.log('=' .repeat(70))
console.log(`Total entries:              ${stats.total}`)
console.log(`Has tresimas.intervalVasara: ${stats.tresimasShape.hasIntervalVasara}  ← per-plant fert interval`)
console.log(`Has tresimas.intervalZiema:  ${stats.tresimasShape.hasIntervalZiema}`)
console.log(`Has tresimas.tipas:          ${stats.tresimasShape.hasTipas}  ← fertilizer type`)
console.log(`Has tresimas.reikia (WRONG): ${stats.tresimasShape.hasReikia}  ← dormancyInfo-style, schema misuse`)
console.log(`Null or missing:             ${stats.tresimasShape.nullOrMissing}  ← falls back to category default`)

console.log('')
console.log('=' .repeat(70))
console.log('LAISTYMAS SHAPE (laistymasIntervalas)')
console.log('=' .repeat(70))
console.log(`Has .vasara (correct):           ${stats.laistymasShape.hasVasaraCorrect}`)
console.log(`Has .ziema (correct):            ${stats.laistymasShape.hasZiemaCorrect}`)
console.log(`Has .metodas (correct):          ${stats.laistymasShape.hasMetodasCorrect}`)
console.log(`Has .intervalVasara (WRONG):     ${stats.laistymasShape.hasIntervalVasaraWrong}  ← Audit #4 editor bug`)
console.log(`Has .intervalZiema (WRONG):      ${stats.laistymasShape.hasIntervalZiemaWrong}`)
console.log(`Has .tipas (WRONG):              ${stats.laistymasShape.hasTipasWrong}  ← should be .metodas`)
console.log(`Null or missing:                 ${stats.laistymasShape.nullOrMissing}`)

console.log('')
console.log('=' .repeat(70))
console.log('FERTILIZING INTERVAL DISTRIBUTION (vasara, days)')
console.log('=' .repeat(70))
const fertValues = stats.fertIntervalValues.map(e => e.value).sort((a, b) => a - b)
if (fertValues.length > 0) {
  const median = fertValues[Math.floor(fertValues.length / 2)]
  const p25 = fertValues[Math.floor(fertValues.length * 0.25)]
  const p75 = fertValues[Math.floor(fertValues.length * 0.75)]
  const min = fertValues[0]
  const max = fertValues[fertValues.length - 1]
  console.log(`Sample size: ${fertValues.length}`)
  console.log(`Min: ${min}d  p25: ${p25}d  median: ${median}d  p75: ${p75}d  max: ${max}d`)
  // Histogram
  const buckets = { '7-13': 0, '14-20': 0, '21-27': 0, '28-29': 0, '30': 0, '31+': 0 }
  for (const v of fertValues) {
    if (v < 14) buckets['7-13']++
    else if (v < 21) buckets['14-20']++
    else if (v < 28) buckets['21-27']++
    else if (v < 30) buckets['28-29']++
    else if (v === 30) buckets['30']++
    else buckets['31+']++
  }
  console.log('Distribution:')
  for (const [bucket, count] of Object.entries(buckets)) {
    const bar = '█'.repeat(Math.round(count / fertValues.length * 40))
    console.log(`  ${bucket.padEnd(8)} ${String(count).padStart(3)} ${bar}`)
  }
}

console.log('')
console.log('=' .repeat(70))
console.log('SUSPICIOUS: monthly+ fert intervals (≥28d) — too generic?')
console.log('=' .repeat(70))
console.log(`${stats.fertMonthlyOrLonger.length} plants with vasara ≥28d. Sample:`)
for (const e of stats.fertMonthlyOrLonger.slice(0, 15)) {
  console.log(`  ${e.days}d  ${e.latin}`)
}

console.log('')
console.log('=' .repeat(70))
console.log('SCHEMA MISMATCH ENTRIES (need rewrite — Audit #4 editor bug)')
console.log('=' .repeat(70))
console.log(`${stats.wrongShapeEntries.length} entries with wrong field names:`)
for (const e of stats.wrongShapeEntries.slice(0, 10)) {
  console.log(`  [${e.id}] ${e.field} — ${e.issue}`)
  console.log(`    shape: ${e.shape}`)
}
if (stats.wrongShapeEntries.length > 10) {
  console.log(`  ... ${stats.wrongShapeEntries.length - 10} more`)
}

console.log('')
process.exit(0)
