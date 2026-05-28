// POC: Gemini restyle su FIKSUOTU cream fonu (#fefdfa) → upload į catalog (2 hard
// case'ai) preview palyginimui. + transparent bg testas (atsako į klausimą).
//
// USAGE: node --env-file=.env.local scripts/poc-restyle-push.mjs
import admin from 'firebase-admin'
import fs from 'fs/promises'

const token = process.env.VERCEL_OIDC_TOKEN
let sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n')
admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: 'geliu-db.firebasestorage.app' })
const db = admin.firestore()
const bucket = admin.storage().bucket()

const GW = 'https://ai-gateway.vercel.sh/v1'
const MODEL = 'google/gemini-3-pro-image'

const STYLE_CREAM = `Redraw the EXACT plant shown in this photograph as a soft watercolor botanical illustration. Preserve its true growth habit, real leaf shape, arrangement and trunk/stem form precisely — only change the art style. Compose as a SQUARE 1:1 image. The single potted plant (simple terracotta pot) is LARGE and PROMINENT, filling about 90% of the frame — centered, with only a small even margin; DO NOT leave large empty space around it. Fill the ENTIRE background edge-to-edge with one SOLID FLAT warm off-white colour #FEFDFA — absolutely no checkerboard or transparency pattern, no scenery, no surface, no shadow, no text, no watermark, no signature. Muted natural palette (sage green, bone, warm terracotta), vintage Kew Gardens botanical plate aesthetic.`
const STYLE_TRANSP = STYLE_CREAM

async function dataUrl(url) {
  const r = await fetch(url)
  const ct = r.headers.get('content-type') || 'image/jpeg'
  return `data:${ct};base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}`
}

async function restyle(imgDataUrl, instr) {
  const res = await fetch(`${GW}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content: [
      { type: 'text', text: instr },
      { type: 'image_url', image_url: { url: imgDataUrl } },
    ] }] }),
  })
  const txt = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`)
  const msg = JSON.parse(txt).choices?.[0]?.message
  const imgs = msg?.images
  if (Array.isArray(imgs) && imgs[0]) {
    const u = imgs[0].image_url?.url || imgs[0].url || imgs[0]
    if (typeof u === 'string') return u.startsWith('data:') ? Buffer.from(u.split(',')[1], 'base64') : Buffer.from(await (await fetch(u)).arrayBuffer())
  }
  if (Array.isArray(msg?.content)) for (const p of msg.content) {
    const u = p.image_url?.url; if (typeof u === 'string') return u.startsWith('data:') ? Buffer.from(u.split(',')[1], 'base64') : Buffer.from(await (await fetch(u)).arrayBuffer())
  }
  throw new Error('no image')
}

async function upload(slug, buf) {
  const filename = `catalog/${slug}/hero-illus.png`
  const file = bucket.file(filename)
  await file.save(buf, { contentType: 'image/png', metadata: { cacheControl: 'public, max-age=31536000, immutable' } })
  await file.makePublic()
  return `https://storage.googleapis.com/${bucket.name}/${filename}?v=${Date.now()}`
}

const targets = ['Biophytum sensitivum', 'Brighamia insignis']
const snap = await db.collection('catalog').get()
const entries = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => targets.includes(e.lotyniskas))

for (const e of entries) {
  process.stdout.write(`${e.lotyniskas} (cream→push)... `)
  try {
    const img = await dataUrl(e.image)
    const buf = await restyle(img, STYLE_CREAM)
    await fs.writeFile(`/tmp/cream-${e.id}.png`, buf)
    const url = await upload(e.id, buf)
    await db.collection('catalog').doc(e.id).update({ heroIllustration: url, _heroMethod: 'gemini-3-pro-restyle', _heroIllustrationAt: new Date().toISOString() })
    console.log(`✓ pushed ${Math.round(buf.length / 1024)}KB`)
  } catch (err) { console.log(`✗ ${err.message}`) }
  await new Promise(r => setTimeout(r, 1500))
}

// transparent test (local only) — atsakom ar Gemini honoruoja alpha
try {
  const e = entries[0]
  process.stdout.write(`transparent test (${e.id})... `)
  const buf = await restyle(await dataUrl(e.image), STYLE_TRANSP)
  await fs.writeFile(`/tmp/transp-${e.id}.png`, buf)
  console.log(`✓ /tmp/transp-${e.id}.png`)
} catch (err) { console.log(`✗ ${err.message}`) }

console.log('done')
process.exit(0)
