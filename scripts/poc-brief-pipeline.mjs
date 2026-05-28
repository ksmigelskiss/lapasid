// POC: morphology-brief pipeline. Claude (per AI Gateway, OIDC token) generuoja
// DIAGNOSTINĮ morfologijos brief'ą iš latin+lt → recraft watercolor. Saugo
// lokaliai + printina brief'us. NERAŠO į catalog.
//
// USAGE: node --env-file=.env.local scripts/poc-brief-pipeline.mjs
import fs from 'fs/promises'

const token = process.env.VERCEL_OIDC_TOKEN
if (!token) { console.error('No VERCEL_OIDC_TOKEN'); process.exit(1) }

const GATEWAY = 'https://ai-gateway.vercel.sh/v1'
const BRIEF_MODEL = 'anthropic/claude-sonnet-4.5'

const STYLE = 'muted natural palette (sage green, bone, warm terracotta), vintage Kew Gardens botanical plate aesthetic, centered, premium, no text, isolated subject on a fully transparent background, no background scenery, no cast shadow.'

const BRIEF_SYSTEM = `You are a botanical illustrator's reference assistant. Given a plant's scientific and common name, output a concise visual morphology brief for a watercolor botanical illustration of ONE potted specimen. Max ~55 words. Emphasize DIAGNOSTIC visual features: overall growth habit and silhouette; stem or trunk type — explicitly note if it has a caudex, swollen succulent base, pachycaul trunk, climbing vine, or basal rosette; leaf shape, size, arrangement, venation and any variegation; iconic flowers only if characteristic. Use concrete visual terms a painter can follow. Do NOT restate the names. Do NOT turn common-name metaphors into literal objects. Output ONLY the brief, no preamble.`

async function brief(latin, lt) {
  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      model: BRIEF_MODEL,
      max_tokens: 200,
      messages: [
        { role: 'system', content: BRIEF_SYSTEM },
        { role: 'user', content: `Species: ${latin}\nCommon (LT): ${lt || '—'}` },
      ],
    }),
  })
  if (!res.ok) throw new Error(`brief HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = await res.json()
  return json.choices?.[0]?.message?.content?.trim() ?? ''
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

const tests = [
  ['adenium', 'Adenium obesum', 'Dykumos rožė'],
  ['biophytum', 'Biophytum sensitivum', 'Jautrusis biofitumas'],
  ['brighamia', 'Brighamia insignis', 'Havajų palmė'],
]

for (const [name, latin, lt] of tests) {
  try {
    const b = await brief(latin, lt)
    console.log(`\n=== ${latin} ===\nBRIEF: ${b}`)
    const buf = await gen(buildPrompt(latin, lt, b))
    await fs.writeFile(`/tmp/poc2-${name}.png`, buf)
    console.log(`✓ ${Math.round(buf.length / 1024)}KB → /tmp/poc2-${name}.png`)
  } catch (e) { console.log(`✗ ${name}: ${e.message}`) }
  await new Promise(r => setTimeout(r, 1500))
}
console.log('\ndone')
