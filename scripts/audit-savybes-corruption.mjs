// Audit'as: ar yra Firestore plant doc'ų, kurių `savybes` objektas turi
// numeric-key chars (`{0:'{', 1:'"', 2:'p', ...}`) — symptom'as ankstesnio
// bug'o, kai AI grąžino `savybes` kaip string'ą, o save-plant.js spread
// `{ ...details.savybes }` sukurdavo per-char map'ą JS spread'o semantika.
//
// Tikrina abi vietas:
//   • catalog/{plantId}
//   • collectionGroup('plants')  →  collections/{colId}/plants/{plantId}
//
// USAGE:
//   node --env-file=.env.local scripts/audit-savybes-corruption.mjs
//
// Output'as: kiekvienas suspect doc'as su path'u, numeric-key sample'u,
// ir bendras counter'is. Jei rasta — generuoja JSON failą su path'ais
// migration'ui (scripts/.savybes-corruption-targets.json).

import { writeFileSync } from 'node:fs'
import { adminFirestore } from '../api/_lib/firestore-admin.js'

const db = adminFirestore()

// Detekcija: plain object'as su numeric-string key'ais 0,1,2,... (consecutive
// from 0). Single-char `value` (kadangi spread per string'ą sukuria po simbolį
// kiekvienam key'ui). Tolerantiškas — užtenka 3+ tokių key'ų, kad signal'as
// būtų stiprus (random objects su key '0' yra normalūs).
function isCorrupted(savybes) {
  if (!savybes || typeof savybes !== 'object' || Array.isArray(savybes)) return false
  const keys = Object.keys(savybes)
  let numericRun = 0
  for (let i = 0; i < keys.length; i++) {
    if (keys.includes(String(i)) && typeof savybes[String(i)] === 'string' && savybes[String(i)].length === 1) {
      numericRun++
    } else {
      break
    }
  }
  return numericRun >= 3
}

function sampleNumericKeys(savybes, n = 10) {
  const out = {}
  for (let i = 0; i < n; i++) {
    if (String(i) in savybes) out[i] = savybes[String(i)]
  }
  return out
}

const suspects = []

console.log('[audit] Scanning catalog/...')
const catalogSnap = await db.collection('catalog').get()
console.log(`[audit]   ${catalogSnap.size} catalog docs`)
for (const doc of catalogSnap.docs) {
  const data = doc.data()
  if (isCorrupted(data.savybes)) {
    suspects.push({
      path: `catalog/${doc.id}`,
      latin: data.lotyniskas ?? data.latinName ?? null,
      sample: sampleNumericKeys(data.savybes),
      totalKeys: Object.keys(data.savybes).length,
    })
  }
}

console.log('[audit] Scanning collectionGroup("plants")...')
const plantsSnap = await db.collectionGroup('plants').get()
console.log(`[audit]   ${plantsSnap.size} user plant docs`)
for (const doc of plantsSnap.docs) {
  const data = doc.data()
  if (isCorrupted(data.savybes)) {
    suspects.push({
      path: doc.ref.path,
      latin: data.lotyniskas ?? data.latinName ?? null,
      sample: sampleNumericKeys(data.savybes),
      totalKeys: Object.keys(data.savybes).length,
    })
  }
}

console.log('')
console.log('═══════════════════════════════════════════════════════════')
console.log(`AUDIT'O REZULTATAS: ${suspects.length} korumpuoti doc'ai`)
console.log('═══════════════════════════════════════════════════════════')

if (suspects.length === 0) {
  console.log("✓ Nei vieno suspect doc'o. Production save'ai nepatyrė šios korupcijos.")
  process.exit(0)
}

for (const s of suspects) {
  console.log(`\n  ${s.path}`)
  console.log(`    latin: ${s.latin}`)
  console.log(`    numeric-key total: ${s.totalKeys}`)
  console.log(`    sample: ${JSON.stringify(s.sample)}`)
}

const outPath = new URL('.savybes-corruption-targets.json', import.meta.url).pathname
writeFileSync(outPath, JSON.stringify(suspects, null, 2))
console.log('')
console.log(`✓ Targets išsaugoti: ${outPath}`)
console.log("  Migration'as: paleisk scripts/migrate-savybes-corruption.mjs (žr. tą failą)")
