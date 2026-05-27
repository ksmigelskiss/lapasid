// One-off cleanup — drop'iname `tresimas.reikia` orphan field'us (jei kur nors
// AI/old data juos paliko). `reikia` boolean priklauso dormancyInfo schema'oj,
// NE tresimas. fertilizingForecast.js ignoruoja `reikia` field'ą tresimas
// objekte, bet schema validation ateityje gali atsisakyt.
//
// Audit'as parodė 1 paveiktą entry: Nepenthes (tresimas.reikia = false).
//
// USAGE:
//   node --env-file=.env.local scripts/fix-tresimas-orphan-reikia.mjs --dry-run
//   node --env-file=.env.local scripts/fix-tresimas-orphan-reikia.mjs

import admin from 'firebase-admin'

const DRY_RUN = process.argv.includes('--dry-run')

let serviceAccount
try { serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) }
catch (e) { console.error('FIREBASE_SERVICE_ACCOUNT parse failed:', e.message); process.exit(1) }
if (serviceAccount.private_key) {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n')
}
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()

const snap = await db.collection('catalog').get()
console.log(`[fix] Scanning ${snap.size} catalog entries... (dry-run=${DRY_RUN})\n`)

let touched = 0
const samples = []

for (const doc of snap.docs) {
  const data = doc.data()
  const tre = data.tresimas
  if (!tre || tre.reikia === undefined) continue

  // Build clean tresimas without reikia
  const { reikia, ...clean } = tre
  if (samples.length < 5) {
    samples.push({ id: doc.id, before: tre, after: clean })
  }
  touched++
  if (!DRY_RUN) {
    await db.collection('catalog').doc(doc.id).update({ tresimas: clean })
  }
}

console.log('=== CLEANUP DONE ===')
console.log(`Touched: ${touched} / ${snap.size}`)
console.log(`Mode:    ${DRY_RUN ? 'DRY-RUN (no writes)' : 'LIVE'}`)
if (samples.length > 0) {
  console.log('')
  console.log('Samples:')
  for (const s of samples) {
    console.log(`  [${s.id}]`)
    console.log(`    BEFORE: ${JSON.stringify(s.before).slice(0, 120)}`)
    console.log(`    AFTER:  ${JSON.stringify(s.after).slice(0, 120)}`)
  }
}
process.exit(0)
