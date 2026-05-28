// POC v2: text-brief (improved rules) VS vision-brief (iš real foto) ant 2 hard
// case'ų (biophytum, brighamia) + adenium control. Saugo /tmp/poc3-*, printina
// brief'us. NERAŠO į catalog.
//
// USAGE: node --env-file=.env.local scripts/poc-brief-v2.mjs
import admin from 'firebase-admin'
import fs from 'fs/promises'

const token = process.env.VERCEL_OIDC_TOKEN
if (!token) { console.error('No VERCEL_OIDC_TOKEN'); process.exit(1) }

let sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n')
admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: 'geliu-db.firebasestorage.app' })
const db = admin.firestore()

const GATEWAY = 'https://ai-gateway.vercel.sh/v1'
const MODEL = 'anthropic/claude-sonnet-4.5'
const STYLE = 'muted natural palette (sage green, bone, warm terracotta), vintage Kew Gardens botanical plate aesthetic, centered, premium, no text, isolated subject on a fully transparent background, no background scenery, no cast shadow.'

const RULES = `You are a botanical illustrator's reference assistant. Output a concise visual morphology brief (max ~60 words) for a watercolor illustration of ONE potted specimen. Rules:
1. START with the overall silhouette in concrete comparative terms (e.g. "resembles a miniature palm tree", "fat bottle-shaped succulent", "trailing vine").
2. Stem/trunk: if it has a caudex / pachycaul / swollen succulent base, state the THICK BARE TRUNK IS FULLY VISIBLE AND EXPOSED, foliage only at the very top.
3. Leaves: exact shape + arrangement. If compound, say "feather-like pinnate compound leaves of many small paired leaflets" and add "leaves are NOT round or simple". If simple, give the exact outline.
4. Iconic flowers only if characteristic.
5. Plain visual words a painter follows. Do NOT restate names. Do NOT turn common-name metaphors into literal objects.
Output ONLY the brief.`

async function chat(messages, max_tokens = 220) {
  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ model: MODEL, max_tokens, messages }),
  })
  if (!res.ok) throw new Error(`chat HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = await res.json()
  return json.choices?.[0]?.message?.content?.trim() ?? ''
}

const textBrief = (latin, lt) =>
  chat([{ role: 'system', content: RULES }, { role: 'user', content: `Species: ${latin}\nCommon (LT): ${lt || '—'}` }])

async function visionBrief(latin, lt, imageUrl) {
  const r = await fetch(imageUrl)
  const ct = r.headers.get('content-type') || 'image/jpeg'
  const b64 = Buffer.from(await r.arrayBuffer()).toString('base64')
  return chat([
    { role: 'system', content: RULES + '\nBase the brief on the ACTUAL specimen in the provided photo — describe what is really visible (true leaf type, trunk, habit), not a generic idea of the species.' },
    { role: 'user', content: [
      { type: 'text', text: `Species: ${latin}\nCommon (LT): ${lt || '—'}\nWrite the morphology brief from this photo:` },
      { type: 'image_url', image_url: { url: `data:${ct};base64,${b64}` } },
    ] },
  ])
}

async function gen(prompt) {
  const res = await fetch(`${GATEWAY}/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ model: 'recraft/recraft-v2', prompt, n: 1, size: '1024x1024', response_format: 'b64_json' }),
  })
  if (!res.ok) throw new Error(`gen HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = await res.json()
  const item = json.data?.[0]
  if (item?.b64_json) return Buffer.from(item.b64_json, 'base64')
  if (item?.url) { const r = await fetch(item.url); return Buffer.from(await r.arrayBuffer()) }
  throw new Error('no image')
}

const buildPrompt = (latin, lt, b) =>
  `Soft watercolor botanical illustration of the houseplant ${latin}${lt ? ` (${lt})` : ''}. ${b} Planted in a simple terracotta pot, a single plant only with no extra objects or props. ${STYLE}`

const targets = ['Biophytum sensitivum', 'Brighamia insignis', 'Adenium obesum']
const snap = await db.collection('catalog').get()
const entries = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => targets.includes(e.lotyniskas))

for (const e of entries) {
  const latin = e.lotyniskas, lt = e.lietuviškas, name = e.id
  console.log(`\n======== ${latin} (${lt}) ========`)
  // TEXT
  try {
    const b = await textBrief(latin, lt)
    console.log(`TEXT BRIEF: ${b}`)
    const buf = await gen(buildPrompt(latin, lt, b))
    await fs.writeFile(`/tmp/poc3-${name}-text.png`, buf)
    console.log(`  ✓ text → /tmp/poc3-${name}-text.png`)
  } catch (err) { console.log(`  ✗ text: ${err.message}`) }
  await new Promise(r => setTimeout(r, 1200))
  // VISION
  try {
    if (!e.image) { console.log('  (no real image — skip vision)'); continue }
    const b = await visionBrief(latin, lt, e.image)
    console.log(`VISION BRIEF: ${b}`)
    const buf = await gen(buildPrompt(latin, lt, b))
    await fs.writeFile(`/tmp/poc3-${name}-vision.png`, buf)
    console.log(`  ✓ vision → /tmp/poc3-${name}-vision.png`)
  } catch (err) { console.log(`  ✗ vision: ${err.message}`) }
  await new Promise(r => setTimeout(r, 1200))
}
console.log('\ndone')
process.exit(0)
