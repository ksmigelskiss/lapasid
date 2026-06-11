import { adminFirestore } from '../_lib/firestore-admin.js'

/**
 * VIEŠAS katalogo endpoint'as (BE auth) — atvira augalų biblioteka (1 segmentas).
 *
 * KODĖL serveris: catalog Firestore read reikalauja auth (firestore.rules:85),
 * o ši biblioteka vieša. Admin SDK apeina taisykles, BET grąžiname TIK
 * PUBLIC_FIELDS allowlist'ą — žalias katalogas lieka nenuskreipinamas, o
 * aprašymai/priežiūra (care + licencijų rizika: PFAF NC, knygos) NEatskleidžiami,
 * kol akademija peržiūrės ir licencijos bus išvalytos.
 *
 * Tai ir pirmas plytas /api/catalog proxy (data-protection sprint Phase B).
 *
 * Režimai (GET):
 *   ?list=1   — visi įrašai, trimmed (grid kortelėms)
 *   ?slug=X   — viena pilna vieša kortelė
 *   ?q=...    — paieška (normalizuotas substring), trimmed sąrašas
 */

// ── VIEŠŲ LAUKŲ ALLOWLIST — VIENINTELIS konfigūracijos taškas ──────────
// Norint atverti/uždaryti lauką viešai — keisk TIK čia.
// SĄMONINGAI NEĮTRAUKTA: aprasymas, prieziura, sviesa, vanduo, temperatura,
// dregme, substratas, persodinimas, ziemojimas, dauginimas, problemos
// (care sekcijos + licencijų rizika).
const PUBLIC_FIELDS = [
  'lietuviškas', 'lotyniskas', 'sinonimai', 'englishNames',
  'heroIllustration', 'heroThumb', 'image',
  'savybes',      // toksiškumas / valgomumas / vaistinis — saugumo šerdis
  'idomybes',     // įdomybės
]

// Grid sąrašui užtenka mažiau (lengvas payload).
const LIST_FIELDS = [
  'lietuviškas', 'lotyniskas', 'heroThumb', 'heroIllustration', 'image', 'savybes',
]

// ── In-memory module cache (katalogas mažas ~100-300 įrašų, retai keičiasi) ──
let _cache = null      // [{ slug, ...rawEntry }]
let _cacheAt = 0
const TTL_MS = 5 * 60 * 1000

async function loadCatalog() {
  if (_cache && (Date.now() - _cacheAt) < TTL_MS) return _cache
  const snap = await adminFirestore().collection('catalog').get()
  _cache = snap.docs.map(d => ({ slug: d.id, ...d.data() }))
  _cacheAt = Date.now()
  return _cache
}

/** Palieka tik allowlist laukus + slug. */
function pick(entry, fields) {
  const out = { slug: entry.slug }
  for (const f of fields) {
    if (entry[f] != null) out[f] = entry[f]
  }
  return out
}

/** Paieškai — normalizuotas lietuviškų raidžių stripping + lowercase. */
function norm(s) {
  return (s ?? '').toString().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function matches(entry, q) {
  const hay = [
    entry.lietuviškas, entry.lotyniskas,
    ...(Array.isArray(entry.sinonimai) ? entry.sinonimai : []),
    ...(Array.isArray(entry.englishNames) ? entry.englishNames : []),
  ].map(norm).join(' ')
  return hay.includes(q)
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  try {
    const all = await loadCatalog()
    const { slug, q, list } = req.query ?? {}

    // Edge-cache draugiškai (viešas turinys, retai keičiasi).
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')

    if (slug) {
      const entry = all.find(e => e.slug === slug)
      if (!entry) return res.status(404).json({ error: 'not_found' })
      return res.json({ entry: pick(entry, PUBLIC_FIELDS) })
    }

    if (typeof q === 'string' && q.trim()) {
      const needle = norm(q)
      const hits = all.filter(e => matches(e, needle)).slice(0, 50)
      return res.json({ entries: hits.map(e => pick(e, LIST_FIELDS)) })
    }

    // list=1 (arba default) — visi, trimmed
    return res.json({ entries: all.map(e => pick(e, LIST_FIELDS)) })
  } catch (e) {
    console.error('[catalog/public]', e)
    return res.status(500).json({ error: 'server_error' })
  }
}
