// POC — galutinis hero sample generator (transparent watercolor + cream card).
//
// Generuoja transparent-bg watercolor heroes + composit'ina ant app cream
// (#fefdfa = bone-50 card body) → galutinis look'as kurį user matytų.
// Išsaugo PERSISTENT į ~/lapasid/poc-samples/ (ne /tmp — survive reboot).
//
// USAGE:
//   node --env-file=.env.local scripts/poc-hero-samples.mjs
//   node --env-file=.env.local scripts/poc-hero-samples.mjs --plants=aloe,monstera

import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'poc-samples')
mkdirSync(join(OUT, 'transparent'), { recursive: true })
mkdirSync(join(OUT, 'on-card'), { recursive: true })

const token = process.env.VERCEL_OIDC_TOKEN
if (!token) { console.error('No OIDC token'); process.exit(1) }

const APP_CREAM = '#fefdfa'  // bone-50 — app card body

// Įvairios formos — sword, rozetė, fenestruoti, frondy, trailing, tree, orchid
const PLANTS = {
  sansevieria: { latin: "Sansevieria trifasciata 'Laurentii'", lt: 'Trijuostė sansevjera', hint: 'tall stiff upright sword-shaped leaves with dark green crossbands and bright yellow margins' },
  aloe:        { latin: 'Aloe vera',              lt: 'Tikrasis alavijas',  hint: 'rosette of thick fleshy serrated succulent leaves' },
  monstera:    { latin: 'Monstera deliciosa',     lt: 'Monstera nuostabioji', hint: 'large glossy heart-shaped leaves with natural splits and holes' },
  calathea:    { latin: 'Calathea makoyana',      lt: 'Kalatėja',           hint: 'oval leaves with intricate dark-green peacock-feather pattern, purple undersides' },
  begonia:     { latin: 'Begonia rex',            lt: 'Begonija',           hint: 'asymmetric ornamental leaves with silver and burgundy spiral markings' },
  phalaenopsis:{ latin: 'Phalaenopsis',           lt: 'Falenopsis',         hint: 'arching spray of broad flat moth-shaped flowers above thick strap leaves' },
  fern:        { latin: 'Nephrolepis exaltata',   lt: 'Bostono papartis',   hint: 'arching feathery fronds with many small leaflets, cascading' },
  echeveria:   { latin: 'Echeveria elegans',      lt: 'Eševerija',          hint: 'tight symmetrical rosette of pale blue-green spoon-shaped succulent leaves' },
  ceropegia:   { latin: 'Ceropegia woodii',       lt: 'Ceropegija',         hint: 'delicate trailing strands of small heart-shaped silver-marbled leaves' },
  ficus:       { latin: 'Ficus elastica',         lt: 'Fikusas',            hint: 'upright woody stem with large glossy oval dark-green leaves' },
}

const idsArg = process.argv.find(a => a.startsWith('--plants='))?.split('=')[1]
const KEYS = idsArg ? idsArg.split(',') : Object.keys(PLANTS)

function prompt(p) {
  return `Soft watercolor botanical illustration of the houseplant ${p.latin} (${p.lt}). The plant has ${p.hint}. Single specimen in a simple terracotta pot, render the distinctive leaf shape and markings accurately, muted natural palette (sage green, bone, warm terracotta), vintage Kew Gardens botanical plate aesthetic, centered, premium, no text, isolated subject on a fully transparent background, no background scenery, no cast shadow.`
}

async function generate(prompt) {
  const res = await fetch('https://ai-gateway.vercel.sh/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ model: 'recraft/recraft-v2', prompt, n: 1, size: '1024x1024', response_format: 'b64_json' }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 140)}`)
  const json = await res.json()
  const item = json.data?.[0]
  if (item?.b64_json) return Buffer.from(item.b64_json, 'base64')
  if (item?.url) { const r = await fetch(item.url); return Buffer.from(await r.arrayBuffer()) }
  throw new Error('No image')
}

console.log(`[samples] Generating ${KEYS.length} transparent watercolor heroes...\n`)
let done = 0
for (const k of KEYS) {
  const p = PLANTS[k]
  if (!p) { console.log(`  ? ${k} unknown`); continue }
  process.stdout.write(`  ${p.latin}... `)
  try {
    const buf = await generate(prompt(p))
    // Save transparent
    writeFileSync(join(OUT, 'transparent', `${k}.png`), buf)
    // Composite onto app cream card (3:2 landscape hero crop, centered)
    await sharp(buf)
      .resize(900, 600, { fit: 'contain', background: APP_CREAM })
      .flatten({ background: APP_CREAM })
      .toFile(join(OUT, 'on-card', `${k}.png`))
    console.log('✓')
    done++
  } catch (e) {
    console.log(`✗ ${e.message}`)
  }
  await new Promise(r => setTimeout(r, 1500))
}

console.log(`\n[samples] Done: ${done}/${KEYS.length}`)
console.log(`[samples] Transparent: ${join(OUT, 'transparent')}/`)
console.log(`[samples] On cream card: ${join(OUT, 'on-card')}/`)
process.exit(0)
