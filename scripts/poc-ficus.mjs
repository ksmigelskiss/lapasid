// POC: Ficus (genus, mismatch→text) su pataisytu prompt'u — houseplant forma +
// sustiprintas no-text (atsisakyta „plate" kuris provokuoja antraštes).
// USAGE: node --env-file=.env.local scripts/poc-ficus.mjs
import sharp from 'sharp'
import fs from 'fs/promises'
const token = process.env.VERCEL_OIDC_TOKEN
const GW = 'https://ai-gateway.vercel.sh/v1'
const MODEL = 'google/gemini-3-pro-image'

const STYLE_V2 = 'Compose as a SQUARE 1:1 image. The single potted plant (simple terracotta pot) is LARGE and PROMINENT, filling about 90% of the frame — centered, small even margin; do not leave large empty space. Fill the ENTIRE background edge-to-edge with one SOLID FLAT warm off-white colour #FEFDFA — no checkerboard or transparency pattern, no scenery, no surface, no shadow. ABSOLUTELY NO TEXT, no caption, no label, no lettering, no handwriting, no botanical annotations anywhere in the image. Muted natural palette (sage green, bone, warm terracotta), soft vintage botanical watercolor illustration style.'

// Houseplant ficus forma (rubber/fiddle), NE brandus medis
const FICUS_BRIEF = 'A compact bushy potted indoor Ficus houseplant (rubber-plant / fiddle-leaf style), NOT a mature outdoor tree. Short stem with full lush foliage starting low; large, glossy, leathery oval-to-violin-shaped leaves, deep green with a pale prominent midrib, each leaf big (15-30 cm), leaves NOT small.'

async function gen(content) {
  const res = await fetch(`${GW}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content }] }) })
  const txt = await res.text(); if (!res.ok) throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`)
  const msg = JSON.parse(txt).choices?.[0]?.message
  const imgs = msg?.images
  if (Array.isArray(imgs) && imgs[0]) { const u = imgs[0].image_url?.url || imgs[0].url || imgs[0]; if (typeof u === 'string') return u.startsWith('data:') ? Buffer.from(u.split(',')[1], 'base64') : Buffer.from(await (await fetch(u)).arrayBuffer()) }
  if (Array.isArray(msg?.content)) for (const p of msg.content) { const u = p.image_url?.url; if (typeof u === 'string') return u.startsWith('data:') ? Buffer.from(u.split(',')[1], 'base64') : Buffer.from(await (await fetch(u)).arrayBuffer()) }
  throw new Error('no image')
}

const instr = `Soft watercolor botanical illustration of the houseplant Ficus (Fikusas). ${FICUS_BRIEF} ${STYLE_V2}`
const buf = await gen([{ type: 'text', text: instr }])
await fs.writeFile('/tmp/ficus-v2-raw.png', buf)
console.log('raw saved')
process.exit(0)
