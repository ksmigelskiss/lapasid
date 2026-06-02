// One-off — Aglaonema 'White Joy' catalog doc-ID mismatch fix.
//
// PROBLEMA (legacy save bug, tas pats kaip Nephrolepis): cultivar'o rich data
// (hero, 39 laukai) atsidūrė po BARE-GENUS slug'u `aglaonema`, o correct cultivar
// slug `aglaonema_white_joy` neegzistuoja. Greičiausiai išsaugota kai lotyniskas
// dar buvo „Aglaonema", vėliau pataisyta į cultivar — bet Firestore doc ID immutable.
//
// SIMPTOMAS: admin „Atnaujinti duomenis → hero" → POST /api/generate-hero su
// latinName="Aglaonema 'White Joy'" → catalogDocId() = `aglaonema_white_joy` →
// catalog.doc('aglaonema_white_joy').get() → !exists → 404 catalog_entry_not_found.
// Be to F1 overlay user'io White Joy augalams neveikia (resolve'ina į neegzistuojantį slug).
//
// FIX (švarus rename — target slug neegzistuoja):
//   1. Copy `aglaonema` doc data → `aglaonema_white_joy` (correct cultivar slug).
//   2. Delete `aglaonema` (wrong bare-genus slug doc).
// heroIllustration jau rodo į catalog/aglaonema_white_joy/hero.jpg → po fix'o consistent.
//
// SCAN: viso catalog'o patikra parodė TIK 1 mismatch (vienetinis, ne sisteminis).
//
// USAGE:
//   node --env-file=.env.local scripts/fix-aglaonema-white-joy-slug.mjs --dry-run
//   node --env-file=.env.local scripts/fix-aglaonema-white-joy-slug.mjs

import admin from 'firebase-admin'

const DRY_RUN = process.argv.includes('--dry-run')
const WRONG_ID = 'aglaonema'                 // bare-genus slug, rich cultivar data
const CORRECT_ID = 'aglaonema_white_joy'     // correct cultivar slug, missing

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n')
admin.initializeApp({ credential: admin.credential.cert(sa) })
const db = admin.firestore()

const wrongSnap = await db.collection('catalog').doc(WRONG_ID).get()
const correctSnap = await db.collection('catalog').doc(CORRECT_ID).get()

if (!wrongSnap.exists) {
  console.log(`[fix] ${WRONG_ID} NĖRA — jau sutvarkyta? Abortinu.`)
  process.exit(0)
}
const data = wrongSnap.data()
delete data._id

// Saugumo patikra — ar tikrai cultivar (lotyniskas turi būti su cultivar žyme)
if (!/['"]/.test(data.lotyniskas || '')) {
  console.log(`[fix] ⚠️ ${WRONG_ID} lotyniskas="${data.lotyniskas}" NEatrodo cultivar (be quotes). Abortinu (saugumas).`)
  process.exit(1)
}

console.log(`[fix] Mode: ${DRY_RUN ? 'DRY-RUN' : 'LIVE'}`)
console.log(`[fix] Source [${WRONG_ID}]: ${Object.keys(data).length} laukai, lotyniskas="${data.lotyniskas}", hero=${data.heroIllustration ? 'YES' : '—'}`)
console.log(`[fix] Target [${CORRECT_ID}] exists: ${correctSnap.exists}`)
console.log(`[fix] Plan:`)
console.log(`  1. ${correctSnap.exists ? 'merge' : 'create'} data → ${CORRECT_ID}`)
console.log(`  2. delete ${WRONG_ID}`)

if (DRY_RUN) {
  console.log(`\n[fix] DRY-RUN — jokių rašymų. Paleisk be --dry-run kad įvykdytum.`)
  process.exit(0)
}

await db.collection('catalog').doc(CORRECT_ID).set(data, { merge: true })
console.log(`[fix] ✓ data → ${CORRECT_ID}`)
await db.collection('catalog').doc(WRONG_ID).delete()
console.log(`[fix] ✓ deleted ${WRONG_ID}`)

// Verify
const v = await db.collection('catalog').doc(CORRECT_ID).get()
console.log(`\n[fix] DONE. doc '${CORRECT_ID}' exists=${v.exists}, lotyniskas="${v.data()?.lotyniskas}", hero=${v.data()?.heroIllustration ? 'YES' : '—'}`)
console.log(`[fix] generate-hero dabar ras catalog įrašą → hero regen veiks. F1 overlay user'io White Joy augalams irgi atsistatys.`)
process.exit(0)
