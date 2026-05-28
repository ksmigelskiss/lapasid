// Generate watercolor hero illustrations for catalog → Firebase Storage.
// OFFLINE BATCH — branduolys gyvena api/_lib/heroGen.js (bendras su /api/generate-hero).
//
// FLOW per entry (žr. heroGen.js): Sonnet vision brief + foto gate (do-no-harm)
//   → Gemini restyle (full-habit/partial) ARBA text→img (mismatch/none)
//   → sharp bg→transparent → upload + catalog write (čia, batch-local).
//
// RESUMABLE: skip jei jau turi heroIllustration (nebent --force).
//
// USAGE:
//   node --env-file=.env.local scripts/generate-hero-illustrations.mjs --all
//   node --env-file=.env.local scripts/generate-hero-illustrations.mjs --ids=aloe,monstera_deliciosa --force
//   node --env-file=.env.local scripts/generate-hero-illustrations.mjs --all --dry-run

import admin from 'firebase-admin'
import { createHeroGen, transparentizeBg } from '../api/_lib/heroGen.js'

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

// Hero gen branduolys — bendras modulis (vienas šaltinis su /api/generate-hero)
const hg = createHeroGen({ token })

// Upload + cache-bust — batch-local (route turės savo per firebase-admin).
async function uploadToStorage(slug, buf) {
  const filename = `catalog/${slug}/hero-illus.png`
  const file = bucket.file(filename)
  await file.save(buf, {
    contentType: 'image/png',
    metadata: { cacheControl: 'public, max-age=31536000, immutable' },
  })
  await file.makePublic()
  // ?v= keičia URL'ą kiekvienam re-gen'ui → browser/CDN fetch'ina fresh.
  return `https://storage.googleapis.com/${bucket.name}/${filename}?v=${Date.now()}`
}

// ── Select entries ───────────────────────────────────────────────
const snap = await db.collection('catalog').get()
let entries = snap.docs.map(d => ({ id: d.id, ...d.data() }))

if (IDS) entries = entries.filter(e => IDS.includes(e.id))
else if (TIER) {
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
    const { brief, photo, photoNote } = await hg.morphologyBrief(entry)
    // GATE (do-no-harm): gera foto → restyle iš jos; bloga/nėra → tekstas iš brief'o.
    const usePhoto = !!entry.image && (photo === 'full-habit' || photo === 'partial')
    let buf = usePhoto ? await hg.geminiRestyle(entry.image) : await hg.geminiTextToImage(entry, brief)
    buf = await transparentizeBg(buf)
    const method = usePhoto ? 'gemini-restyle' : 'gemini-text'
    const url = await uploadToStorage(slug, buf)
    await db.collection('catalog').doc(slug).update({
      heroIllustration: url,
      heroPromptBrief: brief,
      heroPhotoAssessment: `${photo}${photoNote ? ` — ${photoNote}` : ''}`,
      _heroMethod: method,
      _heroIllustrationAt: new Date().toISOString(),
    })
    const flag = usePhoto ? `[restyle·${photo}]` : `[text·${photo}${photoNote ? ` — ${photoNote}` : ''}]`
    console.log(`✓ ${Math.round(buf.length / 1024)}KB ${flag}`)
    done++
  } catch (e) {
    console.log(`✗ ${e.message}`)
    failed++
  }
  await new Promise(r => setTimeout(r, 1500))  // rate-limit buffer
}

console.log(`\n[hero] Done: ${done} ok, ${failed} failed`)
process.exit(0)
