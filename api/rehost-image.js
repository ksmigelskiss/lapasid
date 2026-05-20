// Vercel serverless function — rehost external image į Firebase Storage.
//
// Naudojama kai AI search grąžina commercial URL'us (Brave nursery sites,
// paghat.com, etc.), kurie:
//   • Gali sulūžti (matėm timeouts)
//   • Nepatikimi ilgalaikiam catalog'ui
//   • CORS-blokuoja client-side fetch'ą
//
// Server flow'as:
//   1. Fetch external URL (server has no CORS restrictions)
//   2. Sharp resize'inam į max 1200px (longest side) + JPEG 85% quality
//   3. Upload į Firebase Storage per firebase-admin SDK
//   4. Make public → grąžinam permanent URL
//
// Storage path: catalog/{slug}/hero.jpg (deterministic — re-save'ojas tos
// pačios rūšies augalą perrašo, ne accumulate'ina). Slug ateina iš
// `pathHint` parametro (kliento atsakomybė tinkamą perduoti).

import admin from 'firebase-admin'
import sharp from 'sharp'

// Lazy init — Vercel function instance gali atgaivinti tarp request'ų.
let _initialized = false
function initAdmin() {
  if (_initialized) return
  let serviceAccount
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  } catch (e) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT JSON parse failed: ' + e.message)
  }
  // Vercel env gali saugot \n kaip literal backslash-n
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n')
  }
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'geliu-db.firebasestorage.app',
  })
  _initialized = true
}

export const config = {
  // Padidintas timeout — fetch + sharp + upload gali užtrukti 5-10s
  maxDuration: 30,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { url, pathHint, maxSize = 1200 } = req.body ?? {}
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url required' })
  }
  if (!pathHint || typeof pathHint !== 'string') {
    return res.status(400).json({ error: 'pathHint required' })
  }

  // Skip jei jau mūsų Storage URL'as (idempotent)
  if (url.includes('firebasestorage.googleapis.com') ||
      url.includes('storage.googleapis.com/geliu-db')) {
    return res.status(200).json({ url, skipped: 'already_in_storage' })
  }

  // Skip data: URL'ai — uploadImage client'as juos handle'ina atskirai
  if (url.startsWith('data:')) {
    return res.status(400).json({ error: 'data_url_use_client_uploadImage' })
  }

  try {
    // 1. Fetch external image (server-side, be CORS apribojimų)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 10000)
    const response = await fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer))

    if (!response.ok) {
      return res.status(502).json({
        error: 'external_fetch_failed',
        status: response.status,
        url,
      })
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    const originalSize = buffer.length

    // 2. Resize via sharp — max 1200px longest side, JPEG 85% quality.
    //    `withoutEnlargement: true` neperspaudžia mažų nuotraukų.
    const resized = await sharp(buffer)
      .rotate()  // honor EXIF orientation
      .resize(maxSize, maxSize, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer()

    // 3. Upload į Firebase Storage
    initAdmin()
    const bucket = admin.storage().bucket()
    // pathHint formatas: „catalog/{slug}" — deterministic, idempotent save'ai.
    // Sanitize hint — tik a-z0-9_-/ leidžiam, kad nesusimaisytų Storage tree.
    const safeHint = pathHint.toLowerCase().replace(/[^a-z0-9_/-]/g, '-').replace(/\/+/g, '/')
    const filename = `${safeHint}/hero.jpg`
    const file = bucket.file(filename)
    await file.save(resized, {
      contentType: 'image/jpeg',
      metadata: {
        cacheControl: 'public, max-age=31536000, immutable',  // 1 metai
      },
    })
    // Make public — be auth tokeno prieinamas iš bet kur (admin UI, plant detail).
    await file.makePublic()

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`

    return res.status(200).json({
      url: publicUrl,
      originalSize,
      finalSize: resized.length,
      reduction: Math.round((1 - resized.length / originalSize) * 100),
    })
  } catch (e) {
    console.error('[rehost-image] failed:', e?.message)
    return res.status(500).json({ error: e?.message ?? 'rehost_failed' })
  }
}
