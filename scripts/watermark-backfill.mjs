// Backfill watermark esamiems katalogo hero PNG'ams — Data Protection Phase A.
//
// Prideda vizualų „LapasID.lt" ženklą + forensic LSB ant kiekvieno hero-illus.png.
// Thumb (hero-thumb.webp) NELIEČIAMAS (švarus by design). Aspect PRESERVE'inamas
// (NE re-pad'inam į 3:2 — tik markinam kaip yra). Idempotent: praleidžia jau-
// watermark'intus (nebent --force).
//
// SVARBU: overwrite'ina hero-illus.png Storage + bumpina catalog.heroIllustration
// ?v= cacheBust (kitaip immutable cache klientams rodytų seną be-ženklo versiją).
//
//   node --env-file=.env.local scripts/watermark-backfill.mjs --dry-run          # 3 → /tmp/wm/
//   node --env-file=.env.local scripts/watermark-backfill.mjs --dry-run --limit=99
//   node --env-file=.env.local scripts/watermark-backfill.mjs                     # LIVE visus
//   node --env-file=.env.local scripts/watermark-backfill.mjs --force             # re-mark visus

import admin from 'firebase-admin'
import { writeFile, mkdir } from 'node:fs/promises'
import { applyVisibleMark, embedForensic, extractForensic } from '../api/_lib/watermark.js'

const argv = process.argv.slice(2)
const DRY = argv.includes('--dry-run')
const FORCE = argv.includes('--force')
const limitArg = argv.find(a => a.startsWith('--limit='))
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : (DRY ? 3 : Infinity)

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n')
admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: 'geliu-db.firebasestorage.app' })
const db = admin.firestore()
const bucket = admin.storage().bucket()

const snap = await db.collection('catalog').get()
const entries = []
snap.forEach(d => { const x = d.data(); if (x.heroIllustration?.startsWith('http')) entries.push({ id: d.id, name: x.lotyniskas || d.id, url: x.heroIllustration }) })
entries.sort((a, b) => a.id.localeCompare(b.id))
const work = entries.slice(0, LIMIT)

console.log(`[wm-backfill] mode=${DRY ? 'DRY-RUN' : 'LIVE'} force=${FORCE} | ${entries.length} hero entries, processing ${work.length}`)
if (DRY) await mkdir('/tmp/wm', { recursive: true })

let done = 0, skipped = 0, failed = 0
for (const e of work) {
  try {
    const resp = await fetch(e.url)
    if (!resp.ok) { console.warn(`  ⚠ ${e.id}: fetch ${resp.status}`); failed++; continue }
    const buf = Buffer.from(await resp.arrayBuffer())

    const existing = await extractForensic(buf)
    if (existing && !FORCE) {
      console.log(`  ⏭ ${e.id}: jau watermark'intas (t=${existing.t})`)
      skipped++; continue
    }

    const marked = await embedForensic(await applyVisibleMark(buf), { v: 1, id: e.id, t: Date.now() })
    const check = await extractForensic(marked)
    if (!check || check.id !== e.id) { console.warn(`  ✗ ${e.id}: roundtrip FAIL — NEsaugau`); failed++; continue }

    if (DRY) {
      await writeFile(`/tmp/wm/backfill-${e.id}.png`, marked)
      console.log(`  ✓ ${e.id} (${e.name}) → /tmp/wm/backfill-${e.id}.png | extract: id=${check.id} v=${check.v}`)
    } else {
      const filePath = `catalog/${e.id}/hero-illus.png`
      const file = bucket.file(filePath)
      await file.save(marked, { contentType: 'image/png', metadata: { cacheControl: 'public, max-age=31536000, immutable' } })
      await file.makePublic()
      const cacheBust = Date.now()
      const newUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}?v=${cacheBust}`
      await db.collection('catalog').doc(e.id).update({ heroIllustration: newUrl, _heroWatermarkedAt: new Date().toISOString() })
      console.log(`  ✓ ${e.id} (${e.name}) uploaded + URL bumped`)
    }
    done++
  } catch (err) {
    console.warn(`  ✗ ${e.id}: ${err?.message}`); failed++
  }
}

console.log(`\n[wm-backfill] DONE — marked=${done} skipped=${skipped} failed=${failed}`)
process.exit(failed > 0 ? 1 : 0)
