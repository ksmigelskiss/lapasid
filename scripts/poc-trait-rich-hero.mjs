// POC — trait-rich watercolor hero generation.
//
// HIPOTEZĖ: vietoj „watercolor of {latin}" (genus-only, gali drift'inti),
// maišom realius VISUAL traits iš catalog aprasymas/savybes → tikslesnis
// cultivar render. Modelis žino rūšį + mes paduodam distinctive bruožus.
//
// Modelis: recraft/recraft-v2 (illustration specialist, watercolor stiprus).
//
// USAGE:
//   node --env-file=.env.local scripts/poc-trait-rich-hero.mjs
//   node --env-file=.env.local scripts/poc-trait-rich-hero.mjs --ids=sansevieria_trifasciata,calathea

import { writeFileSync, mkdirSync } from 'node:fs'
import admin from 'firebase-admin'

const OUT = '/tmp/hero-poc'
mkdirSync(OUT, { recursive: true })
const token = process.env.VERCEL_OIDC_TOKEN
if (!token) { console.error('No OIDC token'); process.exit(1) }

// Firebase
let sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n')
admin.initializeApp({ credential: admin.credential.cert(sa) })
const db = admin.firestore()

// Default test set — įvairovė: sukulentas, dryžuotas, ambiguous-name, palmė
const idsArg = process.argv.find(a => a.startsWith('--ids='))?.split('=')[1]
const TEST_IDS = idsArg ? idsArg.split(',') : [
  'sansevieria_trifasciata',  // sword, geltoni kraštai — cultivar test
  'calathea',                  // distinctive lapų raštai
  'begonia',                   // ambiguous name (anksciau photoreal → moteris)
  'monstera_deliciosa',        // fenestracijos
  'aloe',                      // sukulentas rozetė
]

// Trait extraction — paimam pirmą sakinį/du iš aprasymas (dažniausiai
// morfologinis intro) + naudojam kaip visual hint. Trim'inam iki ~220 chars
// kad promptas neišsipūstų.
function visualTraits(entry) {
  const desc = entry.aprasymas || ''
  // Pirmas 1-2 sakiniai (iki ~220 chars, sentence boundary)
  let snippet = desc.slice(0, 240)
  const lastDot = snippet.lastIndexOf('.')
  if (lastDot > 80) snippet = snippet.slice(0, lastDot + 1)
  return snippet.trim()
}

function buildPrompt(entry) {
  const latin = entry.lotyniskas || ''
  const lt = entry.lietuviškas || ''
  const traits = visualTraits(entry)
  // Konstanta = watercolor composition. Kintamasis = augalas + jo traits.
  // „houseplant" disambiguacija (kad Begonia ≠ moteris).
  return [
    `Soft watercolor botanical illustration of the houseplant ${latin}${lt ? ` (${lt})` : ''}.`,
    traits ? `Botanical context: ${traits}` : '',
    `Render the plant's distinctive leaf shape, markings and form accurately.`,
    `Single specimen in a simple terracotta pot, clean cream background,`,
    `muted natural palette (sage green, bone, warm terracotta), vintage Kew`,
    `Gardens botanical plate aesthetic, centered, premium, no text.`,
  ].filter(Boolean).join(' ')
}

async function generate(prompt) {
  const res = await fetch('https://ai-gateway.vercel.sh/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ model: 'recraft/recraft-v2', prompt, n: 1, size: '1024x1024' }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 150)}`)
  const json = await res.json()
  const item = json.data?.[0]
  if (item?.b64_json) return Buffer.from(item.b64_json, 'base64')
  if (item?.url) { const r = await fetch(item.url); return Buffer.from(await r.arrayBuffer()) }
  throw new Error('No image')
}

console.log(`[trait-rich] Generating ${TEST_IDS.length} trait-rich watercolor heroes...\n`)
let done = 0
for (const id of TEST_IDS) {
  const snap = await db.collection('catalog').doc(id).get()
  if (!snap.exists) { console.log(`  ? ${id} — not in catalog, skip`); continue }
  const entry = snap.data()
  const prompt = buildPrompt(entry)
  process.stdout.write(`  ${entry.lotyniskas}... `)
  console.log(`\n     prompt: ${prompt.slice(0, 160)}...`)
  try {
    const buf = await generate(prompt)
    writeFileSync(`${OUT}/traitrich__${id}.png`, buf)
    console.log(`     ✓ saved → traitrich__${id}.png (${Math.round(buf.length / 1024)}KB)`)
    done++
  } catch (e) {
    console.log(`     ✗ ${e.message}`)
  }
  await new Promise(r => setTimeout(r, 1500))
}
console.log(`\n[trait-rich] Done: ${done}/${TEST_IDS.length}`)
process.exit(0)
