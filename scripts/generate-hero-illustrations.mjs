// Generate watercolor hero illustrations for catalog → Firebase Storage.
//
// FLOW per entry:
//   1. recraft-v2 watercolor (transparent bg, „houseplant {latin}")
//   2. Upload → Firebase Storage: catalog/{slug}/hero-illus.png (RGBA)
//   3. catalog.heroIllustration = public Storage URL
//
// transparent PNG — app render'ina ant cream card'o (bg lock).
// catalog.image (real foto) NELIEČIAMAS — heroIllustration atskiras field.
//
// RESUMABLE: skip jei jau turi heroIllustration (nebent --force).
//
// USAGE:
//   node --env-file=.env.local scripts/generate-hero-illustrations.mjs --tier=1
//   node --env-file=.env.local scripts/generate-hero-illustrations.mjs --all
//   node --env-file=.env.local scripts/generate-hero-illustrations.mjs --ids=aloe,monstera_deliciosa
//   node --env-file=.env.local scripts/generate-hero-illustrations.mjs --all --force

import admin from 'firebase-admin'

const args = process.argv.slice(2)
const TIER  = args.find(a => a.startsWith('--tier='))?.split('=')[1] ?? null
const ALL   = args.includes('--all')
const FORCE = args.includes('--force')
const IDS   = args.find(a => a.startsWith('--ids='))?.split('=')[1]?.split(',') ?? null
const DRY   = args.includes('--dry-run')

const token = process.env.VERCEL_OIDC_TOKEN
if (!token) { console.error('No VERCEL_OIDC_TOKEN (vercel env pull)'); process.exit(1) }

// ── Firebase Admin ───────────────────────────────────────────────
let sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n')
admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: 'geliu-db.firebasestorage.app' })
const db = admin.firestore()
const bucket = admin.storage().bucket()

// ── Morphology-brief pipeline (validated POC) ───────────────────
// Generic prompt'as ignoruodavo neįprastas formas (caudex, pinnate lapus) —
// modelis nepažįsta rūšies. Fix: Claude (per AI Gateway) generuoja DIAGNOSTINĮ
// morfologijos brief'ą — VISION iš real foto (entry.image) jei yra, kitaip text
// iš latin+lt. Brief → recraft. heroPromptBrief saugomas catalog'e (reproducible).
const GATEWAY = 'https://ai-gateway.vercel.sh/v1'
const BRIEF_MODEL = 'anthropic/claude-sonnet-4.5'
const STYLE = 'muted natural palette (sage green, bone, warm terracotta), vintage Kew Gardens botanical plate aesthetic, centered, premium, no text, isolated subject on a fully transparent background, no background scenery, no cast shadow.'

const BRIEF_RULES = `You are a botanical illustrator's reference assistant. Output a concise visual morphology brief (max ~60 words) for a watercolor illustration of ONE potted specimen. Rules:
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
    body: JSON.stringify({ model: BRIEF_MODEL, max_tokens, messages }),
  })
  if (!res.ok) throw new Error(`brief HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`)
  const json = await res.json()
  return json.choices?.[0]?.message?.content?.trim() ?? ''
}

async function morphologyBrief(entry) {
  const latin = entry.lotyniskas || ''
  const lt = entry.lietuviškas || ''
  // VISION — grounding iš real foto (tiksliausia)
  if (entry.image) {
    try {
      const r = await fetch(entry.image)
      if (r.ok) {
        const ct = r.headers.get('content-type') || 'image/jpeg'
        const b64 = Buffer.from(await r.arrayBuffer()).toString('base64')
        return await chat([
          { role: 'system', content: BRIEF_RULES + '\nBase the brief on the ACTUAL specimen in the provided photo — describe what is really visible (true leaf type, trunk, habit), not a generic idea of the species.' },
          { role: 'user', content: [
            { type: 'text', text: `Species: ${latin}\nCommon (LT): ${lt || '—'}\nWrite the morphology brief from this photo:` },
            { type: 'image_url', image_url: { url: `data:${ct};base64,${b64}` } },
          ] },
        ])
      }
    } catch { /* fall through to text */ }
  }
  // TEXT fallback — nėra real foto arba fetch fail'ino
  return chat([
    { role: 'system', content: BRIEF_RULES },
    { role: 'user', content: `Species: ${latin}\nCommon (LT): ${lt || '—'}` },
  ])
}

function buildPrompt(entry, brief) {
  const latin = entry.lotyniskas || ''
  const lt = entry.lietuviškas || ''
  return `Soft watercolor botanical illustration of the houseplant ${latin}${lt ? ` (${lt})` : ''}. ${brief} Planted in a simple terracotta pot, a single plant only with no extra objects or props. ${STYLE}`
}

async function generateImage(prompt) {
  const res = await fetch('https://ai-gateway.vercel.sh/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ model: 'recraft/recraft-v2', prompt, n: 1, size: '1024x1024', response_format: 'b64_json' }),
  })
  if (!res.ok) throw new Error(`gen HTTP ${res.status}: ${(await res.text()).slice(0, 140)}`)
  const json = await res.json()
  const item = json.data?.[0]
  if (item?.b64_json) return Buffer.from(item.b64_json, 'base64')
  if (item?.url) { const r = await fetch(item.url); return Buffer.from(await r.arrayBuffer()) }
  throw new Error('No image in response')
}

async function uploadToStorage(slug, buf) {
  const filename = `catalog/${slug}/hero-illus.png`
  const file = bucket.file(filename)
  await file.save(buf, {
    contentType: 'image/png',
    metadata: { cacheControl: 'public, max-age=31536000, immutable' },
  })
  await file.makePublic()
  // Cache-bust: deterministic path + immutable cache → re-gen serv'intų stale.
  // ?v= keičia URL'ą kiekvienam re-gen'ui → browser/CDN fetch'ina fresh.
  return `https://storage.googleapis.com/${bucket.name}/${filename}?v=${Date.now()}`
}

// ── Select entries ───────────────────────────────────────────────
const snap = await db.collection('catalog').get()
let entries = snap.docs.map(d => ({ id: d.id, ...d.data() }))

if (IDS) entries = entries.filter(e => IDS.includes(e.id))
else if (TIER) {
  // tier info catalog'e — per _batchSource? Naudojam curated-300 tier lookup.
  // Paprasčiau: jei nėra tier field'o, --all arba --ids. Tier filter skip jei
  // nėra duomenų.
  entries = entries.filter(e => String(e.tier ?? e._tier ?? '') === TIER)
  if (entries.length === 0) {
    console.warn(`[hero] No entries with tier=${TIER} (catalog neturi tier field'o). Naudok --all arba --ids=`)
  }
} else if (!ALL) {
  console.error('Specify --tier=N, --all, arba --ids=a,b,c')
  process.exit(1)
}

// Skip already-done (unless --force)
const todo = FORCE ? entries : entries.filter(e => !e.heroIllustration)
console.log(`[hero] ${entries.length} matched, ${todo.length} to generate (${entries.length - todo.length} skipped, force=${FORCE}, dry=${DRY})\n`)

// ── Main loop ────────────────────────────────────────────────────
let done = 0, failed = 0
for (let i = 0; i < todo.length; i++) {
  const entry = todo[i]
  const slug = entry.id
  process.stdout.write(`  [${i + 1}/${todo.length}] ${entry.lotyniskas}... `)
  if (DRY) { console.log('(dry-run skip)'); continue }
  try {
    const brief = await morphologyBrief(entry)
    const buf = await generateImage(buildPrompt(entry, brief))
    const url = await uploadToStorage(slug, buf)
    await db.collection('catalog').doc(slug).update({
      heroIllustration: url,
      heroPromptBrief: brief,
      _heroIllustrationAt: new Date().toISOString(),
    })
    console.log(`✓ ${Math.round(buf.length / 1024)}KB`)
    done++
  } catch (e) {
    console.log(`✗ ${e.message}`)
    failed++
  }
  await new Promise(r => setTimeout(r, 1500))  // rate-limit buffer
}

console.log(`\n[hero] Done: ${done} ok, ${failed} failed`)
process.exit(0)
