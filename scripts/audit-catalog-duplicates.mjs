// Audit catalog duplicates — paieška entries su identišku (case-insensitive)
// lotyniškas pavadinimu. Tipiniai šaltiniai:
//   • Manual admin add + Phase 2 save race condition (du atskiri doc'ai)
//   • Legacy imports su skirtingais doc ID schemes
//   • Cultivar variants sui generis: 'Bostoniensis' vs 'bostoniensis'
//
// Output'as: stable terminal report. Sprendžiame manually — admin'as renkasi,
// kurią doc ID palikti (paprastai tą, kuri turi heroIllustration + naujausią
// updatedAt), kuria delete'inti. Ateityje galima būtų pridėti --merge mode'ą,
// bet kol kas — žmogiškas peržiūrėjimas patikimiau.
//
// USAGE:
//   node --env-file=.env.local scripts/audit-catalog-duplicates.mjs

import admin from 'firebase-admin'

function initAdmin() {
  let sa
  try { sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) }
  catch (e) {
    console.error('FIREBASE_SERVICE_ACCOUNT parse failed:', e.message)
    process.exit(1)
  }
  if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n')
  admin.initializeApp({ credential: admin.credential.cert(sa) })
}

initAdmin()
const db = admin.firestore()

console.log('[audit-dupes] Reading catalog…')
const snap = await db.collection('catalog').get()
console.log(`[audit-dupes] ${snap.size} catalog entries.`)

const byLatin = new Map()
for (const doc of snap.docs) {
  const data = doc.data()
  const latin = (data.lotyniskas ?? '').trim()
  if (!latin) continue
  const key = latin.toLowerCase()
  if (!byLatin.has(key)) byLatin.set(key, [])
  byLatin.get(key).push({ id: doc.id, ...data })
}

const dupes = [...byLatin.entries()]
  .filter(([_, docs]) => docs.length > 1)
  .sort((a, b) => b[1].length - a[1].length)

console.log('')
console.log('=== CATALOG DUPLICATE AUDIT ===')
console.log(`Found ${dupes.length} Latin name groups with ≥2 entries.`)
console.log('')

if (dupes.length === 0) {
  console.log('No duplicates detected. ✓')
  process.exit(0)
}

for (const [latin, docs] of dupes) {
  console.log(`▶ ${docs[0].lotyniskas}  (${docs.length} entries)`)
  // Sort'inu pagal heroIllustration + updatedAt — best candidate first.
  // Admin'as lengvai mato, kurią palikti.
  const ranked = [...docs].sort((a, b) => {
    const aScore = (a.heroIllustration ? 10 : 0) + (a.heroThumb ? 5 : 0)
    const bScore = (b.heroIllustration ? 10 : 0) + (b.heroThumb ? 5 : 0)
    if (aScore !== bScore) return bScore - aScore
    const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
    const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
    return bTime - aTime
  })

  ranked.forEach((d, i) => {
    const tag = i === 0 ? '★ LIKELY KEEP' : '  delete candidate'
    const hero = d.heroIllustration ? '✓' : '—'
    const thumb = d.heroThumb ? '✓' : '—'
    const tg = d.taxonGroupId || '—'
    const upd = d.updatedAt ? new Date(d.updatedAt).toISOString().slice(0, 10) : '—'
    const lt = d.lietuviškas || d.lietuviskas || '—'
    console.log(`   ${tag}  ${d.id}`)
    console.log(`              LT: ${lt}`)
    console.log(`              hero: ${hero}  thumb: ${thumb}  taxonGroupId: ${tg}`)
    console.log(`              updated: ${upd}`)
  })
  console.log('')
}

console.log('To delete a duplicate manually:')
console.log('  await admin.firestore().collection("catalog").doc("<doc_id>").delete()')
console.log('')
console.log('Or paste into Firebase console → Firestore → catalog → <doc_id> → Delete.')
process.exit(0)
