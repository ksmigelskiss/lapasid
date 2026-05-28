// POC — image-to-image (reference-conditioned) restyle test.
//
// HIPOTEZĖ: vietoj „generuok augalą iš teksto" (hallucinacijos rizika
// cultivar level'yje), paimam REALIĄ augalo foto kaip reference ir
// perstilizuojam į vientisą watercolor. Modelis išlaiko tikro augalo
// bruožus (cultivar variegacija), tik suvienodina stilių.
//
// Modelis: bfl/flux-kontext-pro (purpose-built image editing / context-aware).
//
// USAGE:
//   node --env-file=.env.local scripts/poc-img2img.mjs

import { writeFileSync, mkdirSync } from 'node:fs'

const OUT = '/tmp/hero-poc'
mkdirSync(OUT, { recursive: true })
const token = process.env.VERCEL_OIDC_TOKEN
if (!token) { console.error('No OIDC token'); process.exit(1) }

// Step 1 — fetch REAL Sansevieria reference from iNat (botanically accurate)
async function fetchRealPhoto(query) {
  const res = await fetch(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(query)}&rank=species&limit=5`,
    { headers: { Accept: 'application/json' } })
  const data = await res.json()
  const plant = (data.results ?? []).find(t => t.iconic_taxon_name === 'Plantae' && t.default_photo)
  return plant?.default_photo?.medium_url ?? plant?.default_photo?.url ?? null
}

// Step 2 — flux-kontext restyle. Tries a few request shapes (gateway image
// editing API format varies). Reports which works.
async function restyleModel(refUrl, prompt, model) {
  const res = await fetch('https://ai-gateway.vercel.sh/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ model, prompt, image: refUrl, n: 1 }),
  })
  const txt = await res.text()
  if (!res.ok) { console.log(`  HTTP ${res.status}: ${txt.slice(0, 140)}`); return null }
  const json = JSON.parse(txt)
  const item = json.data?.[0]
  if (item?.b64_json) return { buf: Buffer.from(item.b64_json, 'base64') }
  if (item?.url) { const r = await fetch(item.url); return { buf: Buffer.from(await r.arrayBuffer()) } }
  console.log(`  OK but no image: ${JSON.stringify(json).slice(0, 120)}`)
  return null
}

// STRONGER preservation prompt — emphasize „only change art medium, keep
// botany identical". Kontext gerbia tikslias instrukcijas.
const PROMPT = 'Keep this exact plant unchanged — same leaf shape, same leaf count, same yellow leaf margins and green crossband markings, same proportions. ONLY change the rendering style to a soft watercolor botanical illustration on a clean cream background, and place the plant in a simple terracotta pot. Do not alter the plant species or its distinctive features.'

console.log('[img2img] Fetching real Sansevieria LAURENTII (yellow-margined) reference...')
// Laurentii = geltonkraščiai. Bandom rasti būtent cultivar foto.
let ref = await fetchRealPhoto('Dracaena trifasciata Laurentii')
if (!ref) ref = await fetchRealPhoto('Sansevieria trifasciata Laurentii')
if (!ref) { console.error('No reference photo found'); process.exit(1) }
console.log('[img2img] Reference:', ref)

const refImg = await fetch(ref)
writeFileSync(`${OUT}/_reference_laurentii.png`, Buffer.from(await refImg.arrayBuffer()))
console.log('[img2img] Saved reference → _reference_laurentii.png')

// Test BOTH kontext-pro ir kontext-max
for (const model of ['bfl/flux-kontext-pro', 'bfl/flux-kontext-max']) {
  console.log(`[img2img] Restyling via ${model}...`)
  const result = await restyleModel(ref, PROMPT, model)
  if (result) {
    const tag = model.split('/')[1].replace('flux-kontext-', '')
    writeFileSync(`${OUT}/laurentii__kontext-${tag}.png`, result.buf)
    console.log(`[img2img] ✓ Saved → laurentii__kontext-${tag}.png`)
  } else {
    console.log(`[img2img] ✗ ${model} failed`)
  }
}
process.exit(0)
