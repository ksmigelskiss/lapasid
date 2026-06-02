// One-off — Nephrolepis exaltata 'Bostoniensis' duplikato root-cause fix.
//
// PROBLEMA (legacy save bug): cultivar'o rich data (hero, thumb, 39 laukai)
// atsidūrė po SPECIES slug'u `nephrolepis_exaltata`, o correct cultivar slug
// `nephrolepis_exaltata_bostoniensis` turi tik bare doc'ą (no hero).
// catalogDocId("Nephrolepis exaltata 'Bostoniensis'") → cultivar slug, tad
// user'io augalas resolve'inasi į BARE doc → praranda hero.
//
// FIX:
//   1. Merge rich (`nephrolepis_exaltata`) data → cultivar ID
//      (`nephrolepis_exaltata_bostoniensis`). Rich laukai (hero/thumb/aprasymas)
//      overwrite'ina bare. taxonGroupId abiejuose toks pat (nephrolepis-exaltata).
//   2. Delete wrong-ID species-slug doc (`nephrolepis_exaltata`).
//
// Po fix'o: vienas doc correct cultivar ID su rich data. User'io cultivar
// augalas gauna hero per F1 overlay. Species-slug doc (turėjęs klaidingą
// cultivar data) pašalintas — bet kuris bare „Nephrolepis exaltata" species
// augalas dabar fallback'ina į inline (geriau nei klaidingas cultivar overlay).
//
// USAGE:
//   node --env-file=.env.local scripts/fix-nephrolepis-duplicate.mjs --dry-run
//   node --env-file=.env.local scripts/fix-nephrolepis-duplicate.mjs

import admin from 'firebase-admin'

const DRY_RUN = process.argv.includes('--dry-run')
const RICH_ID = 'nephrolepis_exaltata'                  // wrong ID (species slug), rich data
const CULT_ID = 'nephrolepis_exaltata_bostoniensis'     // correct cultivar ID, bare

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n')
admin.initializeApp({ credential: admin.credential.cert(sa) })
const db = admin.firestore()

const richSnap = await db.collection('catalog').doc(RICH_ID).get()
const cultSnap = await db.collection('catalog').doc(CULT_ID).get()

if (!richSnap.exists) {
  console.log(`[fix] ${RICH_ID} NÉRA — jau sutvarkyta? Abortinu.`)
  process.exit(0)
}
if (!cultSnap.exists) {
  console.log(`[fix] ${CULT_ID} NÉRA — netikėta. Abortinu (saugumas).`)
  process.exit(1)
}

const richData = richSnap.data()
// _id / meta laukus praleidžiam (Firestore doc ID derive'inamas iš path'o)
delete richData._id

console.log(`[fix] Mode: ${DRY_RUN ? 'DRY-RUN' : 'LIVE'}`)
console.log(`[fix] Rich (${RICH_ID}): ${Object.keys(richData).length} laukai, hero=${richData.heroIllustration ? 'YES' : '—'}`)
console.log(`[fix] Plan:`)
console.log(`  1. Merge rich data → ${CULT_ID} (hero/thumb/aprasymas/care perkeliama)`)
console.log(`  2. Delete ${RICH_ID} (wrong-ID species-slug doc)`)

if (DRY_RUN) {
  console.log(`\n[fix] DRY-RUN — jokių rašymų. Paleisk be --dry-run kad įvykdytum.`)
  process.exit(0)
}

// 1. Merge rich → cultivar ID
await db.collection('catalog').doc(CULT_ID).set(richData, { merge: true })
console.log(`[fix] ✓ merged rich data → ${CULT_ID}`)

// 2. Delete wrong-ID doc
await db.collection('catalog').doc(RICH_ID).delete()
console.log(`[fix] ✓ deleted ${RICH_ID}`)

console.log(`\n[fix] DONE. catalog dabar turi vieną „Bostono papartis" doc'ą correct ID'u su rich data.`)
process.exit(0)
