// Vercel serverless function — generuoja watercolor hero iliustraciją (drawing)
// katalogo entry'ui ir įrašo catalog.heroIllustration.
//
// Branduolys: api/_lib/heroGen.js (tas pats kaip offline batch — vienas šaltinis).
// Kviečiamas:
//   (A) async (fire-and-forget) po naujo global-catalog įrašymo (Phase 2 save)
//   (B) admin „Pergeneruoti drawing" mygtukas (LibraryEditorV2)
//
// POST /api/generate-hero  { latinName, force? }   (Bearer auth)
//   → { heroIllustration, method, assessment }  arba { skipped }
//
// SVARBU (deploy verifikacija): naudoja process.env.VERCEL_OIDC_TOKEN AI Gateway'ui
// (Sonnet vision + Gemini image). Vercel funkcijos turi OIDC token auto-injected.
// Jei ne — reikės AI Gateway API key env var.
import admin from 'firebase-admin'
import { createHeroGen, forceAspect3x2, cropToThumb } from './_lib/heroGen.js'
import { catalogDocId } from './_lib/catalog-server.js'
import { verifyAuthToken } from './_lib/firestore-admin.js'

export const config = { maxDuration: 120 }  // Sonnet vision + Gemini + sharp cutout ~30-60s

let _init = false
function initAdmin() {
  // 2026-06-02 — admin.apps.length guard (žr. rehost-image.js). verifyAuthToken
  // init'ina global app pirma → be šio guard'o double-init „already exists" → 500.
  if (_init || admin.apps.length > 0) { _init = true; return }
  let sa
  try { sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) }
  catch (e) { throw new Error('FIREBASE_SERVICE_ACCOUNT parse failed: ' + e.message) }
  if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n')
  admin.initializeApp({ credential: admin.credential.cert(sa), storageBucket: 'geliu-db.firebasestorage.app' })
  _init = true
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Auth — Bearer (konsistent su rehost-image / claude pattern'u)
  const idToken = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!idToken) return res.status(401).json({ error: 'auth_required' })
  if (!(await verifyAuthToken(idToken))) return res.status(401).json({ error: 'invalid_token' })

  // 2026-06-01 — useCuratedReference: kai true, naudoja catalog.image kaip
  // restyle source (skip'inant gatherCandidates + Sonnet voting). Admin'as
  // pasakė „naudok šitą foto", tai naudojam. Default'as false (Phase 1 ir
  // fresh hero gen flow'ai veikia kaip anksčiau — fresh discovery).
  const { latinName, force = false, useCuratedReference = false } = req.body ?? {}
  if (!latinName || typeof latinName !== 'string') {
    return res.status(400).json({ error: 'latinName required' })
  }

  // AI Gateway credential — Vercel auto-injected OIDC token, ARBA AI_GATEWAY_API_KEY
  // env (fallback jei OIDC neįjungtas project settings'uose).
  const token = process.env.VERCEL_OIDC_TOKEN || process.env.AI_GATEWAY_API_KEY
  if (!token) return res.status(503).json({ error: 'no_gateway_credential' })

  try {
    initAdmin()
    const db = admin.firestore()
    const bucket = admin.storage().bucket()

    const id = catalogDocId(latinName)
    if (!id) return res.status(400).json({ error: 'invalid_latin_name' })
    const snap = await db.collection('catalog').doc(id).get()
    if (!snap.exists) return res.status(404).json({ error: 'catalog_entry_not_found', id })
    const entry = { id, ...snap.data() }

    // Idempotent — skip jei jau turi hero (nebent force). Saugu async trigger'iui:
    // jei du request'ai lenktyniauja, antras praleidžia.
    if (entry.heroIllustration && !force) {
      return res.status(200).json({ skipped: 'already_has_hero', heroIllustration: entry.heroIllustration })
    }

    const hg = createHeroGen({ token })
    // Curated reference path'as — kai admin'as explicit'iškai paprašė naudoti
    // catalog.image kaip restyle source. entry.image saugomas catalog'e (paprastai
    // rehosted Storage URL po Brave search'o arba admin upload'o).
    const referenceImage = (useCuratedReference && entry.image) ? entry.image : null
    if (referenceImage) {
      console.log('[generate-hero] using curated reference', { id, ref: referenceImage.slice(0, 80) })
    }
    const { buf: rawBuf, heroPromptBrief, heroPhotoAssessment, _heroMethod } =
      await hg.generateHeroForEntry(entry, {
        braveApiKey: process.env.BRAVE_API_KEY,
        referenceImage,
      })

    // 2026-06-01: enforce 3:2 landscape aspect (safety net jei Gemini negens
    // tiksliai) + generate thumb 1:1 webp widget'ams (PlantCard).
    const heroBuf = await forceAspect3x2(rawBuf)
    const thumbBuf = await cropToThumb(heroBuf, 512)

    const cacheBust = Date.now()
    const heroFilename = `catalog/${id}/hero-illus.png`
    const heroFile = bucket.file(heroFilename)
    await heroFile.save(heroBuf, {
      contentType: 'image/png',
      metadata: { cacheControl: 'public, max-age=31536000, immutable' },
    })
    await heroFile.makePublic()
    const url = `https://storage.googleapis.com/${bucket.name}/${heroFilename}?v=${cacheBust}`

    const thumbFilename = `catalog/${id}/hero-thumb.webp`
    const thumbFile = bucket.file(thumbFilename)
    await thumbFile.save(thumbBuf, {
      contentType: 'image/webp',
      metadata: { cacheControl: 'public, max-age=31536000, immutable' },
    })
    await thumbFile.makePublic()
    const thumbUrl = `https://storage.googleapis.com/${bucket.name}/${thumbFilename}?v=${cacheBust}`

    await db.collection('catalog').doc(id).update({
      heroIllustration: url,
      heroThumb: thumbUrl,
      heroPromptBrief,
      heroPhotoAssessment,
      _heroMethod,
      _heroIllustrationAt: new Date().toISOString(),
    })

    return res.status(200).json({ heroIllustration: url, heroThumb: thumbUrl, method: _heroMethod, assessment: heroPhotoAssessment })
  } catch (e) {
    console.error('[generate-hero] failed:', e?.message)
    return res.status(500).json({ error: e?.message ?? 'hero_gen_failed' })
  }
}
