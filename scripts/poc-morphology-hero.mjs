// POC: ar recraft sugeba nupiešti charakteringą morfologiją (caudex, pinnate
// lapus) kai paduodam EKSPLICITŲ morfologijos aprašymą? Generuoja + saugo
// lokaliai (/tmp), NERAŠO į catalog — validacijos loop'as prieš pipeline.
//
// USAGE: node --env-file=.env.local scripts/poc-morphology-hero.mjs
import fs from 'fs/promises'

const token = process.env.VERCEL_OIDC_TOKEN
if (!token) { console.error('No VERCEL_OIDC_TOKEN'); process.exit(1) }

const STYLE = 'muted natural palette (sage green, bone, warm terracotta), vintage Kew Gardens botanical plate aesthetic, centered, premium, no text, isolated subject on a fully transparent background, no background scenery, no cast shadow.'

async function gen(prompt) {
  const res = await fetch('https://ai-gateway.vercel.sh/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ model: 'recraft/recraft-v2', prompt, n: 1, size: '1024x1024', response_format: 'b64_json' }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = await res.json()
  const item = json.data?.[0]
  if (item?.b64_json) return Buffer.from(item.b64_json, 'base64')
  if (item?.url) { const r = await fetch(item.url); return Buffer.from(await r.arrayBuffer()) }
  throw new Error('no image')
}

const tests = [
  ['adenium', `Soft watercolor botanical illustration of the houseplant Adenium obesum (Desert Rose). A pachycaul succulent with a dramatically THICK swollen bottle-shaped caudex — a fat bulbous water-storing trunk base — tapering up into a few short thick stubby branches; glossy spoon-shaped leaves clustered only at the branch tips; two or three pink trumpet flowers; planted in a shallow bonsai-style terracotta pot. ${STYLE}`],
  ['biophytum', `Soft watercolor botanical illustration of the houseplant Biophytum sensitivum (Lifeplant). A tiny palm-tree-like plant: a single slender erect unbranched stem topped by a symmetrical crown rosette of pinnate compound leaves radiating outward like a miniature palm or little fern, each leaf made of many small paired oval leaflets in a feather pattern; planted in a small terracotta pot. ${STYLE}`],
  ['brighamia', `Soft watercolor botanical illustration of the houseplant Brighamia insignis (cabbage on a stick). A pachycaul succulent with a THICK smooth bottle-shaped trunk, very swollen at the base and tapering upward, completely unbranched, topped by a single compact rosette of fleshy bright-green spoon-shaped leaves like a cabbage head perched on a stick; planted in a simple terracotta pot. ${STYLE}`],
]

for (const [name, prompt] of tests) {
  process.stdout.write(`${name}... `)
  try {
    const buf = await gen(prompt)
    await fs.writeFile(`/tmp/poc-${name}.png`, buf)
    console.log(`✓ ${Math.round(buf.length / 1024)}KB → /tmp/poc-${name}.png`)
  } catch (e) { console.log(`✗ ${e.message}`) }
  await new Promise(r => setTimeout(r, 1500))
}
console.log('done')
