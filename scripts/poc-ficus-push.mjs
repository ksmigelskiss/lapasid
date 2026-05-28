// Push pataisytą Ficus į catalog: transparentize + upload + update doc.
// USAGE: node --env-file=.env.local scripts/poc-ficus-push.mjs
import admin from 'firebase-admin'
import sharp from 'sharp'
import fs from 'fs/promises'

let sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n')
admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: 'geliu-db.firebasestorage.app' })
const db = admin.firestore()
const bucket = admin.storage().bucket()

async function transparentizeBg(buf, T = 44) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h, channels: ch } = info
  const cs = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]
  let br = 0, bg = 0, bb = 0
  for (const [x, y] of cs) { const i = (y * w + x) * ch; br += data[i]; bg += data[i + 1]; bb += data[i + 2] }
  br /= 4; bg /= 4; bb /= 4
  const T2 = T * T
  const close = (i) => { const dr = data[i] - br, dg = data[i + 1] - bg, dbb = data[i + 2] - bb; return dr * dr + dg * dg + dbb * dbb <= T2 }
  const visited = new Uint8Array(w * h)
  const stack = []
  for (let x = 0; x < w; x++) stack.push(x, 0, x, h - 1)
  for (let y = 0; y < h; y++) stack.push(0, y, w - 1, y)
  while (stack.length) {
    const y = stack.pop(), x = stack.pop()
    if (x < 0 || y < 0 || x >= w || y >= h) continue
    const p = y * w + x
    if (visited[p]) continue
    const i = p * ch
    if (!close(i)) continue
    visited[p] = 1; data[i + 3] = 0
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1)
  }
  return sharp(data, { raw: { width: w, height: h, channels: ch } }).png().toBuffer()
}

const raw = await fs.readFile('/tmp/ficus-v2-raw.png')
const buf = await transparentizeBg(raw)
const filename = 'catalog/ficus/hero-illus.png'
const file = bucket.file(filename)
await file.save(buf, { contentType: 'image/png', metadata: { cacheControl: 'public, max-age=31536000, immutable' } })
await file.makePublic()
const url = `https://storage.googleapis.com/${bucket.name}/${filename}?v=${Date.now()}`
await db.collection('catalog').doc('ficus').update({
  heroIllustration: url,
  heroPromptBrief: 'A compact bushy potted indoor Ficus houseplant (rubber-plant / fiddle-leaf style), large glossy leathery oval leaves, NOT a mature tree.',
  heroPhotoAssessment: 'mismatch — outdoor tree; redrawn as indoor houseplant form (manual fix)',
  _heroMethod: 'gemini-text-houseplant',
  _heroIllustrationAt: new Date().toISOString(),
})
console.log('pushed ficus →', url.slice(-40))
process.exit(0)
