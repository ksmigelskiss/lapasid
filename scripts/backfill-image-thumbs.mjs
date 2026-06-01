// One-shot backfill — generuoti imageThumb senø user plant'ams po 2026-06-01
// dual upload feature'o. Esami plants su image, bet be imageThumb, gauna 480px
// JPEG thumb upload'intą paraleliai į Storage + plant.imageThumb URL įrašytą.
//
// SCRIPT'AS DARO:
//   • Iterate'ina collectionGroup('plants') — visi user augalai per visus collections
//   • Filter: plant.image yra mūsų Firebase Storage URL + plant.imageThumb missing
//   • Atsisiunčia full image bytes per HTTP fetch
//   • sharp resize į 480px (fit: 'inside', withoutEnlargement)
//   • Upload kaip _thumb.jpg į to paties path'o derivative
//   • Update plant doc su imageThumb URL
//
// SAUGU:
//   • External URLs (iNat, Wikipedia) — skip'inami (PlantImage transformPlantImageUrl
//     juos handle'ina source-side)
//   • Esami imageThumb — skip'inami (idempotent — gali kelis kart paleisti)
//   • Failed downloads (404, expired token) — log'inami, ne crash'inami
//   • Dry-run mode preview'ui
//
// USAGE:
//   node --env-file=.env.local scripts/backfill-image-thumbs.mjs --dry-run
//   node --env-file=.env.local scripts/backfill-image-thumbs.mjs

import admin from 'firebase-admin'
import sharp from 'sharp'

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
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'geliu-db.firebasestorage.app',
  })
}

initAdmin()
const db = admin.firestore()
const bucket = admin.storage().bucket()

// Du URL formatai, iš kuriem reikia ištraukti Storage path'ą:
//   1. https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encoded-path}?alt=media&token=...
//   2. https://storage.googleapis.com/{bucket}/{path}
// Grąžinam decoded path arba null jei ne mūsų Storage URL.
function extractFirebasePath(url) {
  if (!url || typeof url !== 'string') return null
  let m = url.match(/firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/([^?]+)/)
  if (m) return decodeURIComponent(m[1])
  m = url.match(/storage\.googleapis\.com\/geliu-db\.firebasestorage\.app\/([^?]+?)(\?|$)/)
  if (m) return m[1]
  return null
}

// plants/{id}/{ts}.jpg → plants/{id}/{ts}_thumb.jpg
function deriveThumbPath(originalPath) {
  return originalPath.replace(/\.(jpg|jpeg|png|webp)$/i, '_thumb.$1')
}

async function downloadImage(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

async function uploadThumb(buf, path, contentType = 'image/jpeg') {
  const file = bucket.file(path)
  await file.save(buf, {
    contentType,
    metadata: { cacheControl: 'public, max-age=31536000, immutable' },
  })
  await file.makePublic()
  return `https://storage.googleapis.com/${bucket.name}/${path}`
}

console.log(`[thumb-backfill] Scanning collectionGroup('plants')... (dry-run=${DRY_RUN})`)
const plantsSnap = await db.collectionGroup('plants').get()
console.log(`[thumb-backfill] ${plantsSnap.size} plant docs.`)

let total = 0, eligible = 0, processed = 0, skippedExternal = 0, skippedHasThumb = 0, skippedNoImage = 0, failed = 0
const samples = []

for (const doc of plantsSnap.docs) {
  total++
  const data = doc.data()

  if (!data.image) { skippedNoImage++; continue }
  if (data.imageThumb) { skippedHasThumb++; continue }

  const path = extractFirebasePath(data.image)
  if (!path) {
    skippedExternal++
    // iNat/Wiki external URLs — jiems PlantImage transformPlantImageUrl
    // source-side resize'ina, no need for our thumb.
    continue
  }

  eligible++
  const label = data.lietuviškas ?? data.lotyniskas ?? doc.id

  if (DRY_RUN) {
    if (samples.length < 20) {
      samples.push({ docPath: doc.ref.path, label, storagePath: path })
    }
    continue
  }

  try {
    const buf = await downloadImage(data.image)
    const thumbBuf = await sharp(buf)
      .resize(480, 480, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 78 })
      .toBuffer()
    const thumbPath = deriveThumbPath(path)
    const thumbUrl = await uploadThumb(thumbBuf, thumbPath)
    await doc.ref.update({ imageThumb: thumbUrl })
    processed++
    console.log(`✓ ${doc.ref.path}  (${label})`)
  } catch (e) {
    failed++
    console.error(`✗ ${doc.ref.path}  (${label}): ${e.message}`)
  }
}

console.log('')
console.log('=== IMAGE THUMB BACKFILL DONE ===')
console.log(`Mode:                      ${DRY_RUN ? 'DRY-RUN (no writes)' : 'LIVE'}`)
console.log(`Total plants scanned:      ${total}`)
console.log(`Skipped (no image):        ${skippedNoImage}`)
console.log(`Skipped (already has thumb): ${skippedHasThumb}`)
console.log(`Skipped (external URL):    ${skippedExternal}`)
console.log(`Eligible (needs thumb):    ${eligible}`)
if (!DRY_RUN) {
  console.log(`Processed (thumb generated): ${processed}`)
  console.log(`Failed:                    ${failed}`)
}
if (DRY_RUN && samples.length > 0) {
  console.log('\nFirst eligible plants:')
  for (const s of samples) {
    console.log(`  ${s.docPath}`)
    console.log(`    ${s.label}`)
    console.log(`    → storage: ${s.storagePath}`)
  }
}
process.exit(0)
