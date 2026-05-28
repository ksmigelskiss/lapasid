// POC: image-conditioned restyle (real foto → watercolor) vs mūsų text→recraft.
// Testuoja ar multimodal modelis išlaiko TIKRĄ morfologiją restyle'indamas.
// Saugo /tmp/restyle-*. NERAŠO į catalog.
//
// USAGE: node --env-file=.env.local scripts/poc-restyle.mjs
import admin from 'firebase-admin'
import fs from 'fs/promises'

const token = process.env.VERCEL_OIDC_TOKEN
let sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n')
admin.initializeApp({ credential: admin.credential.cert(sa) })
const db = admin.firestore()

const GW = 'https://ai-gateway.vercel.sh/v1'
const STYLE = 'Soft watercolor botanical illustration style, muted natural palette (sage green, bone, warm terracotta), vintage Kew Gardens botanical plate aesthetic, plant in a simple terracotta pot, centered, premium, no text, clean plain off-white background, no room scenery, no cast shadow.'
const INSTR = `Redraw the EXACT plant shown in this photograph — preserve its true growth habit, real leaf shape and arrangement, and trunk/stem form precisely — but render it as a ${STYLE} Keep the morphology faithful to the photo; only change the art style and remove the background.`

async function dataUrl(url) {
  const r = await fetch(url)
  const ct = r.headers.get('content-type') || 'image/jpeg'
  const b64 = Buffer.from(await r.arrayBuffer()).toString('base64')
  return `data:${ct};base64,${b64}`
}

// Multimodal image model per chat/completions (image in → image out)
async function restyleChat(model, imgDataUrl) {
  const res = await fetch(`${GW}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: [
        { type: 'text', text: INSTR },
        { type: 'image_url', image_url: { url: imgDataUrl } },
      ] }],
    }),
  })
  const txt = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${txt.slice(0, 300)}`)
  const json = JSON.parse(txt)
  // Bandome rasti image įvairiuose response shape'uose
  const msg = json.choices?.[0]?.message
  const imgs = msg?.images
  if (Array.isArray(imgs) && imgs[0]) {
    const u = imgs[0].image_url?.url || imgs[0].url || imgs[0]
    if (typeof u === 'string') {
      if (u.startsWith('data:')) return Buffer.from(u.split(',')[1], 'base64')
      const r = await fetch(u); return Buffer.from(await r.arrayBuffer())
    }
  }
  // content gali turėti image parts
  if (Array.isArray(msg?.content)) {
    for (const part of msg.content) {
      const u = part.image_url?.url || (part.type === 'image' && part.source?.data)
      if (typeof u === 'string') {
        if (u.startsWith('data:')) return Buffer.from(u.split(',')[1], 'base64')
        return Buffer.from(await (await fetch(u)).arrayBuffer())
      }
    }
  }
  throw new Error('no image in response; keys=' + JSON.stringify(Object.keys(json)) + ' msgKeys=' + JSON.stringify(Object.keys(msg || {})) + ' sample=' + JSON.stringify(msg).slice(0, 300))
}

const targets = ['Biophytum sensitivum', 'Brighamia insignis']
const snap = await db.collection('catalog').get()
const entries = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => targets.includes(e.lotyniskas))

const MODELS = ['google/gemini-2.5-flash-image', 'google/gemini-3-pro-image', 'bfl/flux-kontext-pro']

for (const e of entries) {
  console.log(`\n======== ${e.lotyniskas} ========`)
  if (!e.image) { console.log('no image'); continue }
  const img = await dataUrl(e.image)
  for (const model of MODELS) {
    const tag = model.split('/')[1]
    process.stdout.write(`  ${tag}... `)
    try {
      const buf = await restyleChat(model, img)
      await fs.writeFile(`/tmp/restyle-${e.id}-${tag}.png`, buf)
      console.log(`✓ ${Math.round(buf.length / 1024)}KB → /tmp/restyle-${e.id}-${tag}.png`)
    } catch (err) { console.log(`✗ ${err.message}`) }
    await new Promise(r => setTimeout(r, 1500))
  }
}
console.log('\ndone')
process.exit(0)
