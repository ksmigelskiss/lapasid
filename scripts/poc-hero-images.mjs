// POC — AI-generated hero images, 4 plants × 3 styles = 12 images.
//
// TIKSLAS: pamatyti ar AI gali generuoti vientiso stiliaus hero nuotraukas
// catalog'ui. Side-by-side palyginimas tarp stilių + su esamom foto.
//
// AUTH (auto-detect, prioritetas):
//   1. OPENAI_API_KEY → direct api.openai.com (DALL-E 3)
//   2. VERCEL_OIDC_TOKEN → Vercel AI Gateway (reikia CC on file)
//
// OUTPUT: /tmp/hero-poc/{plant-slug}__{style}.png
//
// USAGE:
//   node --env-file=.env.local scripts/poc-hero-images.mjs
//   node --env-file=.env.local scripts/poc-hero-images.mjs --plants=aloe,monstera

import { writeFileSync, mkdirSync } from 'node:fs'

const OUT_DIR = '/tmp/hero-poc'
mkdirSync(OUT_DIR, { recursive: true })

// ── Test plants ──────────────────────────────────────────────────
const ALL_PLANTS = {
  aloe:       { latin: 'Aloe vera',                lt: 'Tikrasis alavijas',  desc: 'rosette of thick fleshy green serrated succulent leaves' },
  monstera:   { latin: 'Monstera deliciosa',       lt: 'Monstera',           desc: 'large glossy heart-shaped leaves with natural splits and holes (fenestration)' },
  sansevieria:{ latin: "Sansevieria trifasciata 'Laurentii'", lt: 'Trijuostė sansevjera', desc: 'tall upright stiff sword-shaped leaves with dark green crossbands and bright yellow margins' },
  begonia:    { latin: 'Begonia',                  lt: 'Begonija',           desc: 'asymmetric ornamental leaves and small pink-white flowers on red stems' },
}

// ── Style variants (kompozicija = konstanta, augalas = kintamasis) ──
// Per-style model — geriausias įrankis darbui:
//   • recraft-v2 — illustration/design specialist (line + watercolor)
//   • imagen-4.0-fast — Google photoreal
// Visi free-tier accessible (patikrinta 2026-05-28).
const STYLES = {
  lineart: {
    label: 'Botanical line illustration',
    model: 'recraft/recraft-v2',
    template: (p) =>
      `Minimalist botanical line illustration of ${p.latin} (${p.desc}), single specimen, fine ink linework with subtle muted sage-green and terracotta accents, cream paper background, editorial scientific plate style, centered composition, lots of negative space, elegant and clean`,
  },
  watercolor: {
    label: 'Soft watercolor botanical',
    model: 'recraft/recraft-v2',
    template: (p) =>
      `Soft watercolor botanical illustration of ${p.latin} (${p.desc}), single potted specimen in a simple terracotta pot, delicate washes, muted natural palette (sage green, bone, warm terracotta), cream background, vintage Kew Gardens botanical plate aesthetic, gentle and premium, centered`,
  },
  photoreal: {
    label: 'Soft photoreal studio',
    model: 'google/imagen-4.0-fast-generate-001',
    template: (p) =>
      `Soft photorealistic studio photograph of ${p.latin} (${p.desc}), single healthy specimen in a matte terracotta pot, soft diffused natural side-light, cream / bone seamless background, shallow depth of field, minimalist editorial composition, centered, calm premium plant-care app aesthetic`,
  },
}

// ── Arg parsing ──────────────────────────────────────────────────
const args = process.argv.slice(2)
const plantsArg = args.find(a => a.startsWith('--plants='))?.split('=')[1]
const selectedPlantKeys = plantsArg ? plantsArg.split(',') : Object.keys(ALL_PLANTS)
const stylesArg = args.find(a => a.startsWith('--styles='))?.split('=')[1]
const selectedStyleKeys = stylesArg ? stylesArg.split(',') : Object.keys(STYLES)

// ── Auth (Vercel AI Gateway via OIDC, arba OpenAI direct) ────────
const OPENAI_KEY = process.env.OPENAI_API_KEY
const OIDC = process.env.VERCEL_OIDC_TOKEN
const useGateway = !OPENAI_KEY && OIDC
const endpoint   = useGateway ? 'https://ai-gateway.vercel.sh/v1/images/generations'
                              : 'https://api.openai.com/v1/images/generations'
const authHeader = useGateway ? `Bearer ${OIDC}` : `Bearer ${OPENAI_KEY}`
if (!OPENAI_KEY && !OIDC) {
  console.error('[poc] No OPENAI_API_KEY or VERCEL_OIDC_TOKEN — cannot generate.')
  process.exit(1)
}
console.log(`[poc] Endpoint: ${useGateway ? 'Vercel AI Gateway (OIDC)' : 'OpenAI direct'}`)

// ── Generate one image ──────────────────────────────────────────
// Minimal params — skirtingi modeliai (recraft/imagen/flux) turi skirtingus
// param schemas. model+prompt+n+size yra universalūs. Size 1024x1024 saugus
// visiems (landscape crop'insim vėliau jei stilius patiks).
async function generate(model, prompt, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
      body: JSON.stringify({ model, prompt, n: 1, size: '1024x1024' }),
    })
    if (res.status === 429 && attempt < retries) {
      const wait = 20000 * (attempt + 1)  // 20s, 40s, 60s backoff
      process.stdout.write(`(429, retry ${attempt + 1} po ${wait / 1000}s) `)
      await new Promise(r => setTimeout(r, wait))
      continue
    }
    if (!res.ok) {
      const t = await res.text()
      throw new Error(`HTTP ${res.status}: ${t.slice(0, 180)}`)
    }
    const json = await res.json()
    const item = json.data?.[0]
    if (item?.b64_json) return Buffer.from(item.b64_json, 'base64')
    if (item?.url) {
      const imgRes = await fetch(item.url)
      return Buffer.from(await imgRes.arrayBuffer())
    }
    throw new Error('No image: ' + JSON.stringify(json).slice(0, 150))
  }
  throw new Error('Rate-limited after retries (free tier)')
}

// ── Main loop ────────────────────────────────────────────────────
let done = 0, failed = 0
const total = selectedPlantKeys.length * selectedStyleKeys.length
console.log(`[poc] Generating ${total} images (${selectedPlantKeys.length} plants × ${selectedStyleKeys.length} styles)...\n`)

for (const pk of selectedPlantKeys) {
  const plant = ALL_PLANTS[pk]
  if (!plant) { console.warn(`  ? unknown plant key: ${pk}`); continue }
  for (const sk of selectedStyleKeys) {
    const style = STYLES[sk]
    if (!style) { console.warn(`  ? unknown style key: ${sk}`); continue }
    const prompt = style.template(plant)
    const filename = `${OUT_DIR}/${pk}__${sk}.png`
    process.stdout.write(`  ${plant.latin} · ${style.label} [${style.model}]... `)
    try {
      const buf = await generate(style.model, prompt)
      writeFileSync(filename, buf)
      console.log(`✓ (${Math.round(buf.length / 1024)}KB)`)
      done++
    } catch (e) {
      console.log(`✗ ${e.message}`)
      failed++
    }
    // Rate-limit buffer
    await new Promise(r => setTimeout(r, 800))
  }
}

console.log(`\n[poc] Done: ${done}/${total} ok, ${failed} failed`)
console.log(`[poc] Images: ${OUT_DIR}/`)
process.exit(0)
