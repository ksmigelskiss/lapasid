// api/_lib/heroGen.js
// Hero watercolor iliustracijų generavimo BRANDUOLYS — bendras batch script'ui
// (scripts/generate-hero-illustrations.mjs) IR API route'ui (api/generate-hero.js).
// Vienas šaltinis → jokio prompt/logikos drift'o tarp offline ir produkcijos.
//
// FLOW: Sonnet vision morfologijos brief + foto įvertinimas (do-no-harm gate)
//   → Gemini restyle (iš foto, full-habit/partial) ARBA text→img (iš brief'o,
//     mismatch/unreliable/none) → sharp bg→transparent.
// Caller'is daro upload + catalog write (bucket/db init skiriasi batch vs route).
//
// Token (VERCEL_OIDC_TOKEN) per createHeroGen({token}): batch iš .env.local,
// route iš Vercel runtime env (auto-injected).
import sharp from 'sharp'

export const GATEWAY = 'https://ai-gateway.vercel.sh/v1'
export const BRIEF_MODEL = 'anthropic/claude-sonnet-4.5'
export const IMAGE_MODEL = 'google/gemini-3-pro-image'

// Bendras stiliaus suffix'as — IDENTIŠKAS restyle + text→img keliams → vientisas
// stilius. Cream #fefdfa (vėliau transparentize), kvadratas, augalas ~90%, no-text
// (dropintas „plate" — provokuodavo įkeptas antraštes).
export const STYLE_BASE = 'Compose as a SQUARE 1:1 image. The single potted plant (simple terracotta pot) is LARGE and PROMINENT, filling about 90% of the frame — centered, with only a small even margin; do not leave large empty space. Fill the ENTIRE background edge-to-edge with one SOLID FLAT warm off-white colour #FEFDFA — absolutely no checkerboard or transparency pattern, no scenery, no surface, no shadow. ABSOLUTELY NO TEXT, no caption, no label, no lettering, no handwriting, no botanical annotations, no watermark, no signature anywhere in the image. Muted natural palette (sage green, bone, warm terracotta), soft vintage botanical watercolor illustration style.'

// Backbone + foto refine (do-no-harm): žinios + mūsų notes = pagrindas; foto tik
// patikslina; fragmentinė/mismatch foto atmetama. Grąžina JSON su foto įvertinimu.
export const BRIEF_RULES = `You are a botanical illustrator's reference assistant. Produce a visual morphology brief for a watercolor illustration of ONE potted specimen of the named species.

SOURCES & PRIORITY (critical):
- Your canonical botanical KNOWLEDGE of the named species PLUS the curator NOTES below are the PRIMARY, trusted source for overall growth habit, trunk/stem type, and leaf type.
- The attached PHOTO(S) are a SECONDARY refinement layer: use them only to confirm and add reliable visual detail (variegation, exact proportions, cultivar traits).
- If a photo is a close-up (single leaf/flower), low-quality, ambiguous, or appears to show a DIFFERENT plant than the named species, DISREGARD it for overall habit and rely on knowledge + notes. NEVER let a partial or suspect photo override the known growth form.

BRIEF RULES (max ~60 words):
1. START with the overall silhouette in concrete comparative terms ("resembles a miniature palm tree", "fat bottle-shaped succulent", "trailing vine").
2. Trunk/stem: if it has a caudex / pachycaul / swollen succulent base, state the THICK BARE TRUNK IS FULLY VISIBLE AND EXPOSED, foliage only at the very top.
3. Leaves: exact shape + arrangement. If compound, say "feather-like pinnate compound leaves of many small paired leaflets" and add "leaves are NOT round or simple". If simple, give the exact outline.
4. Iconic flowers only if characteristic.
5. Plain visual words a painter follows. Do NOT restate names. Do NOT turn common-name metaphors into literal objects.

Output ONLY valid JSON, no markdown:
{"photo":"full-habit|partial|unreliable|mismatch|none","photoNote":"<=12 words why","brief":"<the brief>"}`

// ── Pure: bg → transparent (flood-fill iš kraštų, sharp) ──────────
// Gemini bg tonas/tekstūra varijuoja → seam ant kortelės. Pašalinam foną →
// app render'ina ant vienodo #fefdfa. Flood iš kraštų išsaugo augalo vidaus
// šviesias vietas (bone highlights).
export async function transparentizeBg(buf, T = 44) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h, channels: ch } = info
  const cs = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]
  let br = 0, bg = 0, bb = 0
  for (const [x, y] of cs) { const i = (y * w + x) * ch; br += data[i]; bg += data[i + 1]; bb += data[i + 2] }
  br /= 4; bg /= 4; bb /= 4
  const T2 = T * T
  const close = (i) => { const dr = data[i] - br, dg = data[i + 1] - bg, dbb = data[i + 2] - bb; return dr * dr + dg * dg + dbb * dbb <= T2 }
  const visited = new Uint8Array(w * h)
  const stack = []
  for (let x = 0; x < w; x++) stack.push(x, 0, x, h - 1)
  for (let y = 0; y < h; y++) stack.push(0, y, w - 1, y)
  while (stack.length) {
    const y = stack.pop(), x = stack.pop()
    if (x < 0 || y < 0 || x >= w || y >= h) continue
    const p = y * w + x
    if (visited[p]) continue
    const i = p * ch
    if (!close(i)) continue
    visited[p] = 1; data[i + 3] = 0
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1)
  }
  return sharp(data, { raw: { width: w, height: h, channels: ch } }).png().toBuffer()
}

// ── Token-bound AI helpers (factory) ──────────────────────────────
export function createHeroGen({ token }) {
  if (!token) throw new Error('heroGen: VERCEL_OIDC_TOKEN required')

  async function chat(messages, max_tokens = 400) {
    const res = await fetch(`${GATEWAY}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ model: BRIEF_MODEL, max_tokens, messages }),
    })
    const txt = await res.text()
    if (!res.ok) throw new Error(`brief HTTP ${res.status}: ${txt.slice(0, 160)}`)
    return JSON.parse(txt).choices?.[0]?.message?.content?.trim() ?? ''
  }

  // Mūsų curated tekstas — patikimas backbone kontekstas (LT, Claude supranta).
  function curatorNotes(entry) {
    const parts = []
    if (entry.tipas)     parts.push(`Type: ${entry.tipas}`)
    if (entry.aprasymas) parts.push(`Description: ${String(entry.aprasymas).slice(0, 600)}`)
    if (entry.kilme)     parts.push(`Origin: ${String(entry.kilme).slice(0, 200)}`)
    return parts.join('\n') || '—'
  }

  async function fetchImagePart(url) {
    try {
      const r = await fetch(url)
      if (!r.ok) return null
      const ct = r.headers.get('content-type') || 'image/jpeg'
      if (!ct.startsWith('image/')) return null
      const b64 = Buffer.from(await r.arrayBuffer()).toString('base64')
      return { type: 'image_url', image_url: { url: `data:${ct};base64,${b64}` } }
    } catch { return null }
  }

  // Grąžina { brief, photo, photoNote }. photo = foto patikimumo įvertinimas.
  async function morphologyBrief(entry, photoUrls = null) {
    const latin = entry.lotyniskas || ''
    const lt = entry.lietuviškas || ''
    const urls = (photoUrls ?? [entry.image, ...(entry.photos ?? [])]).filter(Boolean)
    const unique = [...new Set(urls)].slice(0, 3)
    const imageParts = []
    for (const u of unique) { const p = await fetchImagePart(u); if (p) imageParts.push(p) }

    const userContent = [
      { type: 'text', text: `Species: ${latin}\nCommon (LT): ${lt || '—'}\nCurator notes (trusted backbone):\n${curatorNotes(entry)}\n\n${imageParts.length ? `${imageParts.length} reference photo(s) attached — SECONDARY, refine only; ignore any that are partial/ambiguous/mismatch.` : 'No reference photo — rely on knowledge + notes (photo:"none").'}` },
      ...imageParts,
    ]
    const raw = await chat([
      { role: 'system', content: BRIEF_RULES },
      { role: 'user', content: userContent },
    ])
    try {
      const m = raw.match(/\{[\s\S]*\}/)
      const obj = JSON.parse(m ? m[0] : raw)
      return { brief: (obj.brief || '').trim(), photo: obj.photo || 'unknown', photoNote: obj.photoNote || '' }
    } catch {
      return { brief: raw, photo: 'unknown', photoNote: 'json-parse-fail' }
    }
  }

  // Gemini image gen (chat/completions): vienas modelis abiems keliams.
  async function geminiImage(content) {
    const res = await fetch(`${GATEWAY}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ model: IMAGE_MODEL, messages: [{ role: 'user', content }] }),
    })
    const txt = await res.text()
    if (!res.ok) throw new Error(`img HTTP ${res.status}: ${txt.slice(0, 160)}`)
    const msg = JSON.parse(txt).choices?.[0]?.message
    const toBuf = async (u) => (typeof u === 'string')
      ? (u.startsWith('data:') ? Buffer.from(u.split(',')[1], 'base64') : Buffer.from(await (await fetch(u)).arrayBuffer()))
      : null
    const imgs = msg?.images
    if (Array.isArray(imgs) && imgs[0]) {
      const b = await toBuf(imgs[0].image_url?.url || imgs[0].url || imgs[0]); if (b) return b
    }
    if (Array.isArray(msg?.content)) for (const p of msg.content) {
      const b = await toBuf(p.image_url?.url); if (b) return b
    }
    throw new Error('no image in gemini response')
  }

  // RESTYLE (img→img) — atkartoja tikrą augalo morfologiją iš foto.
  async function geminiRestyle(imageUrl) {
    const part = await fetchImagePart(imageUrl)
    if (!part) throw new Error('image fetch failed')
    const instr = `Redraw the EXACT plant shown in this photograph as a soft watercolor botanical illustration. Preserve its true growth habit, real leaf shape, arrangement and trunk/stem form precisely — only change the art style. ${STYLE_BASE}`
    return geminiImage([{ type: 'text', text: instr }, part])
  }

  // TEXT→img — fallback kai nėra geros foto: piešiam iš brief'o (žinios+notes).
  async function geminiTextToImage(entry, brief) {
    const latin = entry.lotyniskas || ''
    const lt = entry.lietuviškas || ''
    const instr = `Soft watercolor botanical illustration of the houseplant ${latin}${lt ? ` (${lt})` : ''}. ${brief} ${STYLE_BASE}`
    return geminiImage([{ type: 'text', text: instr }])
  }

  return { chat, curatorNotes, fetchImagePart, morphologyBrief, geminiImage, geminiRestyle, geminiTextToImage }
}
