// POC: validuoja TEXT→img fallback kelią (kai foto bloga/nėra). Tas pats
// STYLE_BASE kaip restyle → tikrinam stiliaus vientisumą. Saugo /tmp/textfb-*.
// USAGE: node --env-file=.env.local scripts/poc-textfallback.mjs
import fs from 'fs/promises'
const token = process.env.VERCEL_OIDC_TOKEN
const GW = 'https://ai-gateway.vercel.sh/v1'
const MODEL = 'google/gemini-3-pro-image'
const STYLE_BASE = 'Compose as a SQUARE 1:1 image. The single potted plant (simple terracotta pot) is LARGE and PROMINENT, filling about 90% of the frame — centered, with only a small even margin; do not leave large empty space. Fill the ENTIRE background edge-to-edge with one SOLID FLAT warm off-white colour #FEFDFA — absolutely no checkerboard or transparency pattern, no scenery, no surface, no shadow, no text, no watermark, no signature. Muted natural palette (sage green, bone, warm terracotta), vintage Kew Gardens botanical plate aesthetic.'

async function gen(content) {
  const res = await fetch(`${GW}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content }] }) })
  const txt = await res.text(); if (!res.ok) throw new Error(`HTTP ${res.status}: ${txt.slice(0, 160)}`)
  const msg = JSON.parse(txt).choices?.[0]?.message
  const imgs = msg?.images
  if (Array.isArray(imgs) && imgs[0]) { const u = imgs[0].image_url?.url || imgs[0].url || imgs[0]; if (typeof u === 'string') return u.startsWith('data:') ? Buffer.from(u.split(',')[1], 'base64') : Buffer.from(await (await fetch(u)).arrayBuffer()) }
  if (Array.isArray(msg?.content)) for (const p of msg.content) { const u = p.image_url?.url; if (typeof u === 'string') return u.startsWith('data:') ? Buffer.from(u.split(',')[1], 'base64') : Buffer.from(await (await fetch(u)).arrayBuffer()) }
  throw new Error('no image')
}

const tests = [
  ['monstera', 'Monstera deliciosa', 'Monstera', 'Large climbing aroid with big glossy heart-shaped leaves deeply split and perforated with oval holes (fenestrations), held on long sturdy petioles rising from the pot.'],
  ['brighamia', 'Brighamia insignis', 'Havajų palmė', 'Resembles a miniature palm tree with a fat bottle-shaped succulent trunk; the thick bare pale gray-green trunk is fully visible and exposed, topped by a dense rosette of large simple oblong-oval fleshy bright-green leaves. NOT compound or feathery.'],
]
for (const [name, latin, lt, brief] of tests) {
  process.stdout.write(`${name} (text→img)... `)
  try {
    const buf = await gen([{ type: 'text', text: `Soft watercolor botanical illustration of the houseplant ${latin} (${lt}). ${brief} ${STYLE_BASE}` }])
    await fs.writeFile(`/tmp/textfb-${name}.png`, buf)
    console.log(`✓ ${Math.round(buf.length / 1024)}KB`)
  } catch (e) { console.log(`✗ ${e.message}`) }
  await new Promise(r => setTimeout(r, 1500))
}
console.log('done')
