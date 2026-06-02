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
import { verifyAuthToken } from './_lib/firestore-admin.js'

// Server-side latinName → catalog slug derivation.
// MIRROR'as src/utils/catalog.js'o `catalogDocId` funkcijos. Lengvai
// dubliuotas (pure string manipulation, ~10 line'ų), kad išvengtume
// browser↔node bundler share'inimo komplikacijų.
//
// SVARBU: ABU code path'ai TURI grąžinti tą patį slug'ą tam pačiam latinName'ui,
// kitaip catalog photo path'ai išsiskirs (browser save'ina vienoj vietoj,
// server rehost'ina kitoj).
function catalogSlug(latinName) {
  if (!latinName) return null
  return latinName
    .toLowerCase()
    .replace(/['"]/g, '')           // tik quotes pašalinam
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 100)
}

// Lazy init — Vercel function instance gali atgaivinti tarp request'ų.
let _initialized = false
function initAdmin() {
  // 2026-06-02 — admin.apps.length guard. Po JWT fix'o verifyAuthToken
  // (firestore-admin.js) init'ina global app PIRMA. Be šio guard'o čia,
  // rehost'o init'as bandytų initializeApp() ANTRĄ kartą → „default app
  // already exists" throw → 500. Reuse'inam esamą app instance'ą.
  if (_initialized || admin.apps.length > 0) { _initialized = true; return }
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

// 2026-06-02 (P0-7 SSRF) — blokuoja private/internal/metadata fetch target'us.
// Apsaugo nuo:
//   • cloud metadata endpoint'ų (169.254.169.254, metadata.google.internal) —
//     GCP/AWS service account token theft
//   • loopback (localhost, 127.x), private IPv4 (10 / 192.168 / 172.16-31)
//   • link-local (169.254), this-host (0.x), IPv6 loopback/link-local/unique-local
//
// LIMITACIJA: hostname-based. DNS rebinding (legit hostname → private IP) NEapsaugotas
// (reikėtų DNS resolve + IP pin per fetch'ą). Houseplant rehost'ui hostname blocklist'as
// + admin-gated endpoint'as pakankama apsauga; full IP-pinning — future jei prireiks.
function isUrlSafeForFetch(rawUrl) {
  let u
  try { u = new URL(rawUrl) } catch { return false }
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '') // strip IPv6 [brackets]

  // Metadata + loopback hostnames
  if (host === 'localhost' || host === 'metadata' || host.endsWith('.internal')) return false
  if (host === '0.0.0.0' || host === '::1' || host === '::') return false

  // IPv4 literal ranges
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (m) {
    const a = Number(m[1]), b = Number(m[2])
    if (a === 127) return false                        // loopback
    if (a === 10)  return false                        // private
    if (a === 0)   return false                        // this-host
    if (a === 169 && b === 254) return false           // link-local + metadata (169.254.169.254)
    if (a === 192 && b === 168) return false           // private
    if (a === 172 && b >= 16 && b <= 31) return false  // private
  }

  // IPv6 unique-local (fc00::/7) + link-local (fe80::/10)
  if (/^(fc|fd|fe8|fe9|fea|feb)/.test(host)) return false

  return true
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // ── AUTH ─────────────────────────────────────────────────────
  // Anksčiau šis endpoint'as buvo OPEN — kas nors galėjo POST'inti
  // su arbitrary URL ir pathHint, užteršti mūsų Firebase Storage
  // ar DDoS'inti rehost flow'ą. Audit (2026-05-21) flagino kaip 🔴.
  //
  // Patikrinam Authorization Bearer tokeną — konsistent su esamu
  // api/claude.js ir api/claude/stream.js pattern'u. uidFromToken
  // dekuoduoja JWT payload (nepatikrina parašo, bet pakanka block'inti
  // naive bot'us). Future: upgrade'inti visus endpoint'us į
  // admin.auth().verifyIdToken() vienu šuoliu.
  const idToken = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!idToken) return res.status(401).json({ error: 'auth_required' })
  const uid = await verifyAuthToken(idToken)
  if (!uid) return res.status(401).json({ error: 'invalid_token' })

  // ── BODY PARSING ─────────────────────────────────────────────
  // Naujas contract'as: priimam `latinName`, server derivuoja pathHint
  // per catalogSlug(). Senas `pathHint` parametras backward-compat —
  // priimam, bet log'inam warning'ą + validate'inam catalog/ prefix'ą.
  const { url, latinName, pathHint: legacyPathHint, maxSize = 1200 } = req.body ?? {}
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url required' })
  }

  // ── URL PROTOCOL WHITELIST ───────────────────────────────────
  // Tik http/https. Anksčiau galima buvo file://, ftp:// → server'is
  // bandytų fetch'inti local files ar internal services (SSRF rizika).
  if (!/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: 'url_protocol_must_be_http_or_https' })
  }

  // ── SSRF GUARD (P0-7) — block private/internal/metadata target'us ──
  if (!isUrlSafeForFetch(url)) {
    console.warn('[rehost-image] uid=' + uid + ' blocked SSRF target:', url.slice(0, 80))
    return res.status(400).json({ error: 'url_target_blocked', detail: 'private/internal/metadata addresses not allowed' })
  }

  // ── PATH HINT — SERVER DERIVED ───────────────────────────────
  // Prioritetas: latinName → catalog/{slug}. Jei tik legacyPathHint,
  // validate'inam, kad atitinka catalog/{a-z0-9_-/}+ formatą.
  let pathHint = null
  if (latinName && typeof latinName === 'string') {
    const slug = catalogSlug(latinName)
    if (!slug) return res.status(400).json({ error: 'invalid_latin_name' })
    pathHint = `catalog/${slug}`
  } else if (legacyPathHint && typeof legacyPathHint === 'string') {
    // Backward compat — validate'inam, kad nepradėtum jokios kitos Storage tree
    // šakos. catalog/ prefix'as privalomas.
    if (!/^catalog\/[a-z0-9_-]+$/i.test(legacyPathHint)) {
      return res.status(400).json({
        error: 'invalid_path_hint',
        detail: 'must match catalog/{slug} format',
      })
    }
    pathHint = legacyPathHint
    console.warn('[rehost-image] uid=' + uid + ' using legacy pathHint param — caller should migrate to latinName')
  } else {
    return res.status(400).json({ error: 'latinName_or_pathHint_required' })
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
