// Migracija — ŠVARUS foto modelis. Išvalo STOCK image iš esamų user plant doc'ų.
//
// Naujas modelis: plant.image = TIK user foto (heroIsDefaultFor = !image). Esami
// augalai turi stock (iNat/Wiki/hero.jpg) image'e (iš seno fromAIResult) → su nauja
// logika rodytų stock foto vietoj watercolor. Šis script'as išvalo stock image,
// PALIEKA stock galerijoje (photos[]), kad user galėtų pasirinkti.
//
// ATSARGI heuristika — CLEAR tik jei image yra stock-default:
//   • NE user upload (URL be `/plants/`)  IR
//   • NE pinned pick (useHistoryPhoto !== false)  IR
//   • NE auto-istorijos foto (timeline neturi photo su imageUrl === image)
// → tada image = STOCK iš sukūrimo → išvalom.
// User upload'ai / pick'ai / istorijos foto — PALIEKAMI.
//
//   node --env-file=.env.local scripts/migrate-clear-stock-images.mjs --dry-run
//   node --env-file=.env.local scripts/migrate-clear-stock-images.mjs

import admin from 'firebase-admin'

const DRY = process.argv.includes('--dry-run')

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n')
admin.initializeApp({ credential: admin.credential.cert(sa) })
const db = admin.firestore()

const isUserUpload = (url) => typeof url === 'string' && (url.includes('/plants/') || url.includes('plants%2F'))

const cols = await db.collection('collections').get()
console.log(`[migrate] mode=${DRY ? 'DRY-RUN' : 'LIVE'} | ${cols.size} collections`)

let scanned = 0, cleared = 0, kept = 0
for (const colDoc of cols.docs) {
  const plantsSnap = await colDoc.ref.collection('plants').get()
  for (const pDoc of plantsSnap.docs) {
    const p = pDoc.data()
    scanned++
    if (!p.image) continue

    const upload   = isUserUpload(p.image)
    const pinned   = p.useHistoryPhoto === false
    const inTimeline = (p.timeline ?? []).some(e => e.type === 'photo' && e.imageUrl === p.image)
    const isUserPhoto = upload || pinned || inTimeline

    if (isUserPhoto) { kept++; continue }

    // Stock-default → clear. Užtikrinam, kad stock liktų galerijoje.
    const photos = Array.isArray(p.photos) ? p.photos : []
    const newPhotos = photos.includes(p.image) ? photos : [p.image, ...photos].slice(0, 10)

    console.log(`  ✂ ${pDoc.id} (${p.lietuviškas || p.lotyniskas}) — clear stock image: ${String(p.image).slice(-40)}`)
    cleared++
    if (!DRY) {
      await pDoc.ref.set({ image: null, imageThumb: null, photos: newPhotos }, { merge: true })
    }
  }
}

console.log(`\n[migrate] DONE — scanned=${scanned} cleared=${cleared} kept(user photo)=${kept}`)
process.exit(0)
