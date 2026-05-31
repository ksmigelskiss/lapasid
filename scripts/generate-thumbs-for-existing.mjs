#!/usr/bin/env node
/**
 * generate-thumbs-for-existing.mjs — vienkartinis batch script existing
 * hero PNG → thumb WebP konversijai.
 *
 * KONTEKSTAS:
 *   2026-06-01 įdiegėm dual-variant hero: nauji entries gauna 3:2 PNG +
 *   1:1 WebP thumb. Existing 79 entries turi tik 1:1 PNG hero. Šis script'as
 *   jiems sugeneruoja thumb (be Gemini call'o — tik sharp resize + format
 *   convert) → widget load'ai pagreitėja 10× IŠKART, neatlaukus admin UI
 *   per-entry „Atnaujinti paveiksliuką" mygtuko.
 *
 * Hero PNG palieka kaip yra (1:1 lieka, PlantDetail vis tiek šiek tiek
 * crop'ins — bet tai išsprendėm tik Gemini regen'u, o nauji generavimai
 * jau 3:2). Šis script'as TIK pridedа heroThumb URL — nelieka heroIllustration.
 *
 * USAGE:
 *   Reikia FIREBASE_SERVICE_ACCOUNT env. User'is rm'ino .env.local —
 *   atstatyti per `vercel env pull .env.local`.
 *
 *   # Dry-run (skenuoja, nepakeičia nieko):
 *   node --env-file=.env.local scripts/generate-thumbs-for-existing.mjs
 *
 *   # Apply (rašo thumbs + Firestore update):
 *   node --env-file=.env.local scripts/generate-thumbs-for-existing.mjs --apply
 */

import admin from 'firebase-admin'
import sharp from 'sharp'
import { cropToThumb } from '../api/_lib/heroGen.js'

const APPLY = process.argv.includes('--apply')

// ── Firebase init ──────────────────────────────────────────────
const sa = process.env.FIREBASE_SERVICE_ACCOUNT
if (!sa) {
  console.error('ERROR: FIREBASE_SERVICE_ACCOUNT env not set')
  console.error('Run: vercel env pull .env.local')
  console.error('Then: node --env-file=.env.local scripts/generate-thumbs-for-existing.mjs [--apply]')
  process.exit(1)
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(sa)),
  storageBucket: 'geliu-db.firebasestorage.app',
})

const db = admin.firestore()
const bucket = admin.storage().bucket()

// ── Main ───────────────────────────────────────────────────────
console.log(`[thumbs] mode: ${APPLY ? 'APPLY (will write)' : 'DRY-RUN (no writes)'}`)
console.log(`[thumbs] loading catalog entries...`)

const snap = await db.collection('catalog').get()
console.log(`[thumbs] ${snap.size} catalog entries fetched`)

const candidates = []
const skippedNoHero = []
const skippedHasThumb = []

for (const doc of snap.docs) {
  const data = doc.data()
  if (!data.heroIllustration) { skippedNoHero.push(doc.id); continue }
  if (data.heroThumb) { skippedHasThumb.push(doc.id); continue }
  candidates.push({ id: doc.id, heroIllustration: data.heroIllustration })
}

console.log()
console.log(`[thumbs] candidates: ${candidates.length} (need thumb)`)
console.log(`[thumbs] skipped (no hero):   ${skippedNoHero.length}`)
console.log(`[thumbs] skipped (has thumb): ${skippedHasThumb.length}`)
console.log()

if (candidates.length === 0) {
  console.log('[thumbs] nothing to do — all entries with hero already have thumb')
  process.exit(0)
}

if (!APPLY) {
  console.log('[thumbs] DRY-RUN — listing first 10 candidates:')
  for (const c of candidates.slice(0, 10)) {
    console.log(`  • ${c.id}`)
  }
  if (candidates.length > 10) console.log(`  ... (${candidates.length - 10} more)`)
  console.log()
  console.log('[thumbs] Re-run with --apply to generate thumbs')
  process.exit(0)
}

// ── Apply mode ─────────────────────────────────────────────────
let ok = 0, fail = 0
const errors = []

for (const [idx, c] of candidates.entries()) {
  const progress = `[${idx + 1}/${candidates.length}]`
  try {
    // Download existing hero
    const resp = await fetch(c.heroIllustration)
    if (!resp.ok) throw new Error(`fetch hero failed: ${resp.status}`)
    const heroBuf = Buffer.from(await resp.arrayBuffer())

    // Generate thumb (crop center 1:1 + resize 512 + WebP)
    const thumbBuf = await cropToThumb(heroBuf, 512)

    // Upload thumb
    const thumbFilename = `catalog/${c.id}/hero-thumb.webp`
    const thumbFile = bucket.file(thumbFilename)
    await thumbFile.save(thumbBuf, {
      contentType: 'image/webp',
      metadata: { cacheControl: 'public, max-age=31536000, immutable' },
    })
    await thumbFile.makePublic()
    const thumbUrl = `https://storage.googleapis.com/${bucket.name}/${thumbFilename}?v=${Date.now()}`

    // Update Firestore (merge — palieka kitus laukus untouched)
    await db.collection('catalog').doc(c.id).update({
      heroThumb: thumbUrl,
      _heroThumbAt: new Date().toISOString(),
    })

    const heroSize = heroBuf.length
    const thumbSize = thumbBuf.length
    const ratio = (heroSize / thumbSize).toFixed(1)
    console.log(`${progress} ✓ ${c.id}  (${(heroSize/1024).toFixed(0)}KB → ${(thumbSize/1024).toFixed(0)}KB, ${ratio}× smaller)`)
    ok++
  } catch (e) {
    console.warn(`${progress} ✗ ${c.id}: ${e.message}`)
    errors.push({ id: c.id, error: e.message })
    fail++
  }
}

console.log()
console.log(`[thumbs] DONE: ${ok} ok, ${fail} failed`)
if (errors.length) {
  console.log('[thumbs] errors:')
  for (const e of errors) console.log(`  ${e.id}: ${e.error}`)
}

process.exit(fail > 0 ? 1 : 0)
