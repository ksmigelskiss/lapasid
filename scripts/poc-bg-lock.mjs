// POC — background tone lock test.
//
// PROBLEMA: watercolor heroes turi varying bg toną (šviesus↔tamsokas).
// Bandom užrakinti per: (A) hardened flat-bg prompt, (B) recraft style param.
//
// USAGE: node --env-file=.env.local scripts/poc-bg-lock.mjs

import { writeFileSync, mkdirSync } from 'node:fs'

const OUT = '/tmp/hero-poc'
mkdirSync(OUT, { recursive: true })
const token = process.env.VERCEL_OIDC_TOKEN
if (!token) { console.error('No OIDC token'); process.exit(1) }

const PLANTS = [
  { id: 'sansevieria', latin: 'Sansevieria trifasciata', lt: 'Trijuostė sansevjera' },
  { id: 'aloe',        latin: 'Aloe vera',                lt: 'Tikrasis alavijas' },
  { id: 'calathea',    latin: 'Calathea',                 lt: 'Kalatėja' },
]

// HARDENED bg constraint — flat, solid, named hex, no gradient/vignette/shadow
const BG = 'on a completely flat, uniform, solid pale cream background, exact color hex #F2EBD9, no gradient, no vignette, no scenery, no cast shadows on the background, even flat lighting'

function prompt(p) {
  return `Soft watercolor botanical illustration of the houseplant ${p.latin} (${p.lt}), single specimen in a simple terracotta pot, render the plant's distinctive leaf shape and markings accurately, muted natural palette (sage green, bone, warm terracotta), vintage Kew Gardens botanical plate aesthetic, centered, premium, no text, ${BG}`
}

// Try with + without recraft style param to see if gateway forwards it
async function gen(p, withStyle) {
  const body = { model: 'recraft/recraft-v2', prompt: prompt(p), n: 1, size: '1024x1024' }
  if (withStyle) body.style = 'digital_illustration'  // recraft style hint
  const res = await fetch('https://ai-gateway.vercel.sh/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 140)}`)
  const json = await res.json()
  const item = json.data?.[0]
  if (item?.b64_json) return Buffer.from(item.b64_json, 'base64')
  if (item?.url) { const r = await fetch(item.url); return Buffer.from(await r.arrayBuffer()) }
  throw new Error('No image')
}

console.log('[bg-lock] Testing hardened flat-bg prompt...\n')
for (const p of PLANTS) {
  process.stdout.write(`  ${p.latin} (hardened prompt)... `)
  try {
    const buf = await gen(p, false)
    writeFileSync(`${OUT}/bglock__${p.id}.png`, buf)
    console.log(`✓`)
  } catch (e) { console.log(`✗ ${e.message}`) }
  await new Promise(r => setTimeout(r, 1500))
}
console.log('\n[bg-lock] Done — palygink bglock__*.png tarpusavyje (ar fonas vienodas?)')
process.exit(0)
