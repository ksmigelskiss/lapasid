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
import { parseLatinName } from '../../src/utils/latinName.js'

export const GATEWAY = 'https://ai-gateway.vercel.sh/v1'
export const BRIEF_MODEL = 'anthropic/claude-sonnet-4.5'
export const IMAGE_MODEL = 'google/gemini-3-pro-image'

// Bendras stiliaus suffix'as — IDENTIŠKAS restyle + text→img keliams → vientisas
// stilius. Cream #fefdfa (vėliau transparentize), 3:2 landscape, augalas centered
// ir prominent (ne pilnam plotyje, leidžia padding sides), no-text.
//
// 2026-06-01: pakeistas iš SQUARE 1:1 į 3:2 LANDSCAPE — atitinka PlantDetail
// hero zone'os aspect-3/2 (default), išvengia vertikalaus crop'inimo. Widget
// generates 1:1 thumb iš to paties hero per cropToThumb() (žemiau). Forced
// 3:2 sharp.extend'u kaip safety net jei Gemini negens 3:2 tiksliai.
export const STYLE_BASE = 'Compose as a 3:2 LANDSCAPE image (wider than tall). The single potted plant (simple terracotta pot) is CENTERED and PROMINENT, filling about 70-80% of the height — vertically centered, with even margins on left and right; do not leave large empty space at top or bottom. Fill the ENTIRE background edge-to-edge with one SOLID FLAT warm off-white colour #FEFDFA — absolutely no checkerboard or transparency pattern, no scenery, no surface, no shadow. ABSOLUTELY NO TEXT, no caption, no label, no lettering, no handwriting, no botanical annotations, no watermark, no signature anywhere in the image. Muted natural palette (sage green, bone, warm terracotta), soft vintage botanical watercolor illustration style.'

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

// ── Pure: enforce 3:2 landscape aspect via transparent extend ─────
// Safety net — Gemini gali kartais sugeneruoti close-to-square ar netaip
// 3:2 kaip prašyta. Šis helper'is normalize'ina į GARANTUOTĄ 3:2 per
// transparent padding (extend bottom/sides — niekada nekirpiam augalo).
// Pakvieskite PO transparentizeBg, kad pad'ai būtų jau-transparent.
export async function forceAspect3x2(buf) {
  const img = sharp(buf).ensureAlpha()
  const meta = await img.metadata()
  const w = meta.width, h = meta.height
  const targetRatio = 3 / 2
  const currentRatio = w / h
  if (Math.abs(currentRatio - targetRatio) < 0.02) return buf  // jau ~3:2

  if (currentRatio < targetRatio) {
    // Image siauresnis nei 3:2 → extend width (transparent sides)
    const targetW = Math.round(h * targetRatio)
    const padTotal = targetW - w
    const padLeft = Math.floor(padTotal / 2)
    const padRight = padTotal - padLeft
    return sharp(buf).ensureAlpha().extend({
      left: padLeft, right: padRight, top: 0, bottom: 0,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    }).png().toBuffer()
  } else {
    // Image platesnis nei 3:2 → extend height (transparent top/bottom)
    const targetH = Math.round(w / targetRatio)
    const padTotal = targetH - h
    const padTop = Math.floor(padTotal / 2)
    const padBottom = padTotal - padTop
    return sharp(buf).ensureAlpha().extend({
      left: 0, right: 0, top: padTop, bottom: padBottom,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    }).png().toBuffer()
  }
}

// ── Pure: crop center 1:1 thumb (widget'ams) ──────────────────────
// PlantCard/widget krauna mažą thumbnail (~150-400px display) ir BE šito
// download'avosi pilną 1024+ hero PNG (~500KB) — bandwidth nuostolis.
// Thumb yra:
//   • 512×512 (4× plotis vs typical display → retina-friendly)
//   • WebP (su quality 88 → ~30-50KB vs PNG ~500KB)
//   • Center-cropped iš 3:2 hero (augalas centered → no detail loss)
export async function cropToThumb(buf, size = 512) {
  const meta = await sharp(buf).metadata()
  const w = meta.width, h = meta.height
  const minDim = Math.min(w, h)
  const cropX = Math.floor((w - minDim) / 2)
  const cropY = Math.floor((h - minDim) / 2)
  return sharp(buf).ensureAlpha()
    .extract({ left: cropX, top: cropY, width: minDim, height: minDim })
    .resize(size, size, { fit: 'cover' })
    .webp({ quality: 88 })
    .toBuffer()
}

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

// ── Candidate photo fetchers (public APIs; Brave needs key) ───────
// Vision-gate'ui — surenkam realios foto kandidatus iš kelių šaltinių, kad
// modelis turėtų iš ko rinktis (iNat/Wiki linkę į laukinius; Brave houseplant-biased).
function stripCultivar(name) { return (name || '').replace(/\s*'[^']*'/g, '').replace(/\s*"[^"]*"/g, '').trim() }

async function fetchWikiPhoto(latin) {
  try {
    const title = latin.trim().replace(/ /g, '_')
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { headers: { Accept: 'application/json' } })
    if (!r.ok) return null
    const d = await r.json()
    return d.originalimage?.source ?? d.thumbnail?.source ?? null
  } catch { return null }
}

async function fetchINatPhotos(latin) {
  try {
    const s = await fetch(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(latin)}&limit=1&rank=species,subspecies,variety,genus`, { headers: { Accept: 'application/json' } })
    if (!s.ok) return []
    const taxon = (await s.json()).results?.[0]
    if (!taxon) return []
    const ex = (p) => p?.original_url ?? p?.large_url ?? p?.medium_url ?? null
    const urls = (taxon.taxon_photos ?? []).map(tp => ex(tp.photo)).filter(Boolean)
    const def = ex(taxon.default_photo); if (def) urls.unshift(def)
    return [...new Set(urls)].slice(0, 2)
  } catch { return [] }
}

async function fetchBravePhotos(query, apiKey, count = 4) {
  if (!apiKey) return []
  try {
    const params = new URLSearchParams({ q: query, count: String(count), safesearch: 'strict', country: 'us' })
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 5000)
    const r = await fetch(`https://api.search.brave.com/res/v1/images/search?${params}`, { headers: { 'X-Subscription-Token': apiKey, Accept: 'application/json' }, signal: ctrl.signal }).finally(() => clearTimeout(t))
    if (!r.ok) return []
    const d = await r.json()
    return (d.results ?? []).map(it => it.properties?.url ?? it.url).filter(Boolean)
  } catch { return [] }
}

// Vision-gate prompt — parenka geriausią kandidatą + brief (species/cultivar).
export const SELECT_RULES = `You are a botanical illustrator's reference assistant. From several CANDIDATE photos, select the single best one and write a morphology brief.

SELECTION: pick the candidate that best shows a TYPICAL, FULL-HABIT, POTTED INDOOR HOUSEPLANT specimen of the named species. Reject: outdoor mature trees, wild in-habitat shots, single-leaf or single-flower close-ups, and any photo that appears to be a DIFFERENT plant than the named species. If NONE is acceptable, chosenIndex = null.

BRIEF (max ~60 words) — base on canonical KNOWLEDGE + curator NOTES (primary), refined by the chosen photo:
1. START with overall silhouette in concrete comparative terms.
2. Trunk/stem: if caudex/pachycaul/swollen succulent base, state the THICK BARE TRUNK IS FULLY VISIBLE AND EXPOSED, foliage only at the top.
3. Leaves: exact shape + arrangement. If compound, say "feather-like pinnate compound leaves of many small paired leaflets" and add "leaves are NOT round or simple". If simple, give the exact outline.
4. Iconic flowers only if characteristic.
5. Plain visual words; do not restate names; do not turn common-name metaphors into literal objects.

Output ONLY valid JSON, no markdown:
{"chosenIndex": <1-based integer or null>, "photo":"full-habit|partial|unreliable|mismatch|none", "photoNote":"<=12 words", "brief":"<the brief>"}`

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
      const ct = r.headers.get('content-type') || ''
      if (!ct.startsWith('image/')) return null
      const raw = Buffer.from(await r.arrayBuffer())
      // Downscale per sharp → po 5MB Sonnet/Gemini limito (kai kurios Brave/Wiki
      // foto būna 16MB+) + greitesni vision/restyle payload'ai. Fail → null (skip).
      const resized = await sharp(raw).rotate().resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer()
      return { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${resized.toString('base64')}` } }
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

  // Surenka realios foto kandidatus TIK iš external sources (iNat + Wiki + Brave).
  //
  // 2026-06-01 — anksčiau entry.image (caller'io perduota „best image" optimization)
  // įtraukdavom į pool'ą. Bet re-enrich path'e tai contamination risk'as: PlantDetail
  // reEnrichPlant siunčia baseResult.image = plant.image, kuri gali būti user'io
  // ASMENINĖ foto (jo dekoratyvinis vazonas, apšvietimas, angle). Jei Sonnet vision-
  // gate'as ją parenka kaip „best candidate" → Gemini restyle'ina į watercolor su
  // user'io vazonu → global catalog hero turi personal artifacts.
  //
  // Fix: VISADA fetch'inam tik iš external auto-sources. Pure species-level imagery.
  // Naujam save'ui — vienas papildomas iNat round-trip (Phase 1 jau pasiima, Phase 2
  // pakartoja — toleruotina cost'as cleanness'o naudai). Re-enrich path'e — zero leak.
  async function gatherCandidates(entry, braveApiKey) {
    const stripped = stripCultivar(entry.lotyniskas)
    const [inat, wiki, brave] = await Promise.all([
      fetchINatPhotos(stripped),
      fetchWikiPhoto(stripped),
      fetchBravePhotos(`${stripped} houseplant potted indoor`, braveApiKey),
    ])
    const urls = [...inat, wiki, ...brave].filter(Boolean)
    return [...new Set(urls)].slice(0, 6)
  }

  // Vision-gate: Sonnet parenka geriausią kandidatą + brief. chosenUrl null →
  // text→img fallback. { brief, chosenUrl, photo, photoNote }.
  async function assessAndPick(entry, candidateUrls) {
    const latin = entry.lotyniskas || '', lt = entry.lietuviškas || ''
    const indexed = [], parts = []
    for (const u of candidateUrls) {
      const p = await fetchImagePart(u)
      if (p) { indexed.push(u); parts.push({ type: 'text', text: `Candidate ${indexed.length}:` }, p) }
    }
    if (indexed.length === 0) {
      const r = await morphologyBrief(entry, [])
      return { brief: r.brief, chosenUrl: null, photo: 'none', photoNote: 'no candidates' }
    }
    const userContent = [
      { type: 'text', text: `Species: ${latin}\nCommon (LT): ${lt || '—'}\nCurator notes (trusted backbone):\n${curatorNotes(entry)}\n\n${indexed.length} candidate photo(s) follow.` },
      ...parts,
    ]
    const raw = await chat([{ role: 'system', content: SELECT_RULES }, { role: 'user', content: userContent }], 500)
    try {
      const obj = JSON.parse(raw.match(/\{[\s\S]*\}/)[0])
      const ci = obj.chosenIndex
      const chosenUrl = (Number.isInteger(ci) && ci >= 1 && ci <= indexed.length) ? indexed[ci - 1] : null
      return { brief: (obj.brief || '').trim(), chosenUrl, photo: obj.photo || 'unknown', photoNote: obj.photoNote || '' }
    } catch {
      return { brief: '', chosenUrl: null, photo: 'unknown', photoNote: 'json-parse-fail' }
    }
  }

  // ── Orchestrator (rank-aware) ──────────────────────────────────
  // genus → representative text→img (houseplant forma, ne species-locked).
  // species/cultivar → vision-gate parenka realią foto → restyle (fallback text).
  //
  // 2026-06-01 — `referenceImage` SHORT-CIRCUIT (admin curated source path):
  //   Kai admin'as pakeičia catalog.image (e.g. įkelia geresnę vintage botaninę
  //   iliustraciją vietoj prastos iNat foto) ir trigger'ina hero regen, jis
  //   tikisi, kad TĄ KONKREČIĄ foto Gemini paims kaip restyle source. Bet
  //   gatherCandidates() FRESH'ina iNat+Wiki+Brave po assessAndPick → deterministic
  //   Sonnet votes always picks same external candidate → admin'o curated
  //   reference ignored, regen output identical kiekvieną kartą.
  //
  //   Sprendimas: kai caller perduoda { referenceImage }, skip'inam discovery
  //   + voting → tiesiogiai geminiRestyle(referenceImage). Admin explicit'iškai
  //   pasakė „naudok šitą", tai naudojam. Brief'as paliekamas tuščias (restyle
  //   image-grounded, prompt'as nieko nekeičia).
  //
  // Grąžina { buf, heroPromptBrief, heroPhotoAssessment, _heroMethod, chosenRealPhoto, rank }.
  async function generateHeroForEntry(entry, { braveApiKey, referenceImage } = {}) {
    let rank = 'unknown'
    try { rank = parseLatinName(entry.lotyniskas).rank } catch { /* keep unknown */ }
    let buf, brief = '', photo, photoNote = '', chosenRealPhoto = null, method

    // SHORT-CIRCUIT: admin curated reference. Genus turi text-mode net su
    // reference'u (genus = abstract category, restyle of one species'o foto'os
    // → klaidina representation'ą).
    if (referenceImage && rank !== 'genus') {
      try {
        buf = await geminiRestyle(referenceImage)
        chosenRealPhoto = referenceImage
        method = 'gemini-restyle-curated'
        photo = 'full-habit'
        photoNote = 'admin curated reference (skip discovery + voting)'
        brief = 'Curated reference — Sonnet brief skipped.'
      } catch (e) {
        // Restyle suklydo (e.g. URL broken) → graceful fallback į standartinį
        // discovery path'ą. Log'as kad admin'as suprastų kodėl jo reference
        // nepateko.
        console.warn('[heroGen] curated restyle failed, falling back to discovery:', e?.message)
      }
    }

    if (!buf) {
      if (rank === 'genus') {
        const r = await morphologyBrief(entry, [])   // knowledge+notes, be species-locking foto
        brief = r.brief; photo = 'none'; photoNote = 'genus → representative drawing'
        buf = await geminiTextToImage(entry, `${brief} Depict the common cultivated INDOOR houseplant form, not a wild or outdoor mature tree.`)
        method = 'gemini-text-genus'
      } else {
        const candidates = await gatherCandidates(entry, braveApiKey)
        const r = await assessAndPick(entry, candidates)
        brief = r.brief; photo = r.photo; photoNote = r.photoNote
        if (r.chosenUrl && (photo === 'full-habit' || photo === 'partial')) {
          buf = await geminiRestyle(r.chosenUrl); chosenRealPhoto = r.chosenUrl; method = 'gemini-restyle'
        } else {
          if (!brief) { const b = await morphologyBrief(entry, []); brief = b.brief }
          buf = await geminiTextToImage(entry, brief); method = 'gemini-text'
        }
      }
    }
    buf = await transparentizeBg(buf)
    return { buf, heroPromptBrief: brief, heroPhotoAssessment: `${photo}${photoNote ? ` — ${photoNote}` : ''}`, _heroMethod: method, chosenRealPhoto, rank }
  }

  return { chat, curatorNotes, fetchImagePart, morphologyBrief, geminiImage, geminiRestyle, geminiTextToImage, gatherCandidates, assessAndPick, generateHeroForEntry }
}
