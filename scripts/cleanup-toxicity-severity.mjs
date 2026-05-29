// One-shot cleanup — re-derive toxicity SEVERITY esamiems catalog įrašams po
// 2026-05-29 fix'o (žmonėms oksalato vidutinis→silpnas; ASPCA confidence→
// vidutinis floor). Fix'as paveikia tik NAUJUS save'us — esami įrašai turi
// stale severity įrašytą. Šis script'as juos pataiso.
//
// SAUGU — patcha TIK severity (pavojai[].severity, pavojingumas.lygis) ir
// PRIDEDA trūkstamus derived target'us (under-report fix). NEKLOBORINA
// detales/narrative/tipas (admin/AI turinys lieka). aiSupplementaryHazard
// įrašai (DB tyli, AI gap-fill) — praleidžiami (derive grąžina hasToxicity=false).
//
// USAGE:
//   node --env-file=.env.local scripts/cleanup-toxicity-severity.mjs --dry-run
//   node --env-file=.env.local scripts/cleanup-toxicity-severity.mjs

import admin from 'firebase-admin'
import { deriveToxicityFromSourcesServer } from '../api/_lib/deriveToxicity-server.js'

const DRY_RUN = process.argv.includes('--dry-run')

function initAdmin() {
  let serviceAccount
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  } catch (e) {
    console.error('FIREBASE_SERVICE_ACCOUNT parse failed:', e.message)
    process.exit(1)
  }
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n')
  }
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
}

initAdmin()
const db = admin.firestore()

console.log(`[tox-cleanup] Reading catalog... (dry-run=${DRY_RUN})`)
const snap = await db.collection('catalog').get()
console.log(`[tox-cleanup] ${snap.size} entries.`)

let touched = 0
let skippedSafe = 0
const samples = []

for (const doc of snap.docs) {
  const data = doc.data()
  const latin = data.lotyniskas ?? data.latinName
  if (!latin) continue

  const savybes = data.savybes ?? {}
  const storedPavojai = Array.isArray(savybes.pavojai) ? savybes.pavojai : []

  // aiSupplementaryHazard įrašai (DB tyli) — derive grąžins hasToxicity=false →
  // praleidžiam, kad neklobortume AI gap-fill turinio.
  let derived
  try {
    derived = await deriveToxicityFromSourcesServer(latin)
  } catch (e) {
    console.warn('[tox-cleanup] derive failed', doc.id, e?.message)
    continue
  }
  if (!derived?.hasToxicity) { skippedSafe++; continue }

  const derivedByTarget = new Map()
  for (const d of (derived.pavojai ?? [])) if (d?.target) derivedByTarget.set(d.target, d)

  // 1. Pataisom severity matched target'uose; 2. pridedam trūkstamus derived
  //    target'us (under-report). Stored target'ų, kurių nėra derived, NEtrinam.
  const seen = new Set()
  const newPavojai = storedPavojai.map(p => {
    if (p?.target) seen.add(p.target)
    const d = p?.target ? derivedByTarget.get(p.target) : null
    if (d?.severity && d.severity !== p.severity) return { ...p, severity: d.severity }
    return p
  })
  for (const [t, d] of derivedByTarget) {
    if (!seen.has(t)) newPavojai.push({ ...d })
  }

  const pavojaiChanged = JSON.stringify(newPavojai) !== JSON.stringify(storedPavojai)
  const newLygis = derived.pavojingumas?.lygis
  const lygisChanged = !!(savybes.pavojingumas && newLygis && newLygis !== savybes.pavojingumas.lygis)

  if (!pavojaiChanged && !lygisChanged) continue

  const updates = {}
  if (pavojaiChanged) updates['savybes.pavojai'] = newPavojai
  if (lygisChanged)   updates['savybes.pavojingumas.lygis'] = newLygis

  touched++
  if (samples.length < 15) {
    samples.push({
      id: doc.id, latin,
      before: storedPavojai.map(p => `${p.target}:${p.severity}`).join(', ') || '(tuščia)',
      after:  newPavojai.map(p => `${p.target}:${p.severity}`).join(', '),
      lygis:  lygisChanged ? `${savybes.pavojingumas.lygis}→${newLygis}` : '—',
    })
  }
  if (!DRY_RUN) await db.collection('catalog').doc(doc.id).update(updates)
}

console.log('')
console.log('=== TOXICITY SEVERITY CLEANUP DONE ===')
console.log(`Documents touched:     ${touched} / ${snap.size}`)
console.log(`Skipped (DB silent):   ${skippedSafe}`)
console.log(`Mode:                  ${DRY_RUN ? 'DRY-RUN (no writes)' : 'LIVE'}`)
if (samples.length > 0) {
  console.log('\nSample changes (target:severity):')
  for (const s of samples) {
    console.log(`  [${s.id}] ${s.latin}`)
    console.log(`    pavojai:  ${s.before}  →  ${s.after}`)
    if (s.lygis !== '—') console.log(`    lygis:    ${s.lygis}`)
  }
}
process.exit(0)
