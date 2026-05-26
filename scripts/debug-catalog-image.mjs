// Debug: kas vyksta su catalog image batch'e
//
// 1. Test'ina Wiki photo fetch'ą Kalanchoe + Dracaena
// 2. Skaito catalog/kalanchoe + catalog/dracaena iš Firestore
// 3. Parodo ar image field yra, ir jei taip — kokia URL

import { fetchWikiPhoto } from '../src/utils/wikiApi.js'
import { adminFirestore } from '../api/_lib/firestore-admin.js'

const tests = ['Kalanchoe', 'Dracaena']

console.log('=== STEP 1: Wiki photo fetch test ===')
for (const latin of tests) {
  console.log(`\n[wiki] ${latin}:`)
  let r = await fetchWikiPhoto(latin, 'en', { thumbSize: 800 })
  console.log(`  EN: found=${r.found}, url=${r.url}`)
  if (!r.found) {
    r = await fetchWikiPhoto(latin, 'lt', { thumbSize: 800 })
    console.log(`  LT: found=${r.found}, url=${r.url}`)
  }
}

console.log('\n=== STEP 2: Firestore catalog docs ===')
const db = adminFirestore()
for (const latin of tests) {
  const id = latin.toLowerCase()
  const snap = await db.collection('catalog').doc(id).get()
  if (!snap.exists) {
    console.log(`[firestore] catalog/${id}: NEEXISTS`)
    continue
  }
  const data = snap.data()
  console.log(`\n[firestore] catalog/${id}:`)
  console.log(`  lotyniskas:  ${data.lotyniskas}`)
  console.log(`  lietuviškas: ${data.lietuviškas ?? data.lietuviskas ?? '(none)'}`)
  console.log(`  image:       ${data.image ?? '(NONE)'}`)
  console.log(`  updatedAt:   ${data.updatedAt}`)
  console.log(`  _batchSource: ${data._batchSource ?? '(none)'}`)
  console.log(`  _batchEnrichedAt: ${data._batchEnrichedAt ?? '(none)'}`)
}
