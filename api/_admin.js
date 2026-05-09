// Firestore REST API client — no firebase-admin SDK needed
// Uses service account JWT to get OAuth2 token, then calls Firestore REST API directly
import { createSign } from 'crypto'

const PROJECT = 'geliu-db'
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`

// Token cache (per function instance lifetime)
let _tok = null
let _exp = 0

async function getToken() {
  if (_tok && Date.now() < _exp) return _tok
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}')
  if (!sa.client_email) throw new Error('FIREBASE_SERVICE_ACCOUNT not configured')

  const now = Math.floor(Date.now() / 1000)
  const hdr = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const pay = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  })).toString('base64url')
  const sig = createSign('RSA-SHA256').update(`${hdr}.${pay}`).sign(sa.private_key, 'base64url')

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${hdr}.${pay}.${sig}`,
  })
  const j = await r.json()
  if (!j.access_token) throw new Error('OAuth2 failed: ' + JSON.stringify(j))
  _tok = j.access_token
  _exp = Date.now() + (j.expires_in - 60) * 1000
  return _tok
}

// ── Firestore ↔ JS value conversion ──────────────────────────────────────────

function jsToFs(v) {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number')  return Number.isInteger(v) ? { integerValue: `${v}` } : { doubleValue: v }
  if (typeof v === 'string')  return { stringValue: v }
  if (Array.isArray(v))       return { arrayValue: { values: v.map(jsToFs) } }
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, val]) => [k, jsToFs(val)])) } }
}

function fsToJs(v) {
  if (!v) return null
  if ('stringValue'    in v) return v.stringValue
  if ('integerValue'   in v) return Number(v.integerValue)
  if ('doubleValue'    in v) return v.doubleValue
  if ('booleanValue'   in v) return v.booleanValue
  if ('nullValue'      in v) return null
  if ('timestampValue' in v) return v.timestampValue
  if ('arrayValue'     in v) return (v.arrayValue.values ?? []).map(fsToJs)
  if ('mapValue'       in v) return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, fv]) => [k, fsToJs(fv)]))
  return null
}

function parseDoc(raw) {
  if (!raw?.fields) return { exists: false, data: () => null, id: null }
  const id   = raw.name?.split('/').pop()
  const data = Object.fromEntries(Object.entries(raw.fields).map(([k, v]) => [k, fsToJs(v)]))
  return { exists: true, data: () => data, id }
}

// ── REST helpers ──────────────────────────────────────────────────────────────

async function fsGet(path) {
  const tok = await getToken()
  const r = await fetch(`${BASE}/${path}`, { headers: { Authorization: `Bearer ${tok}` } })
  if (r.status === 404) return { exists: false, data: () => null, id: path.split('/').pop() }
  if (!r.ok) throw new Error(`Firestore GET ${path} → ${r.status}: ${await r.text()}`)
  return parseDoc(await r.json())
}

async function fsList(path) {
  const tok = await getToken()
  const r = await fetch(`${BASE}/${path}`, { headers: { Authorization: `Bearer ${tok}` } })
  if (!r.ok) throw new Error(`Firestore LIST ${path} → ${r.status}: ${await r.text()}`)
  const { documents = [] } = await r.json()
  return { docs: documents.map(parseDoc) }
}

async function fsPatch(path, obj) {
  const tok    = await getToken()
  const fields = Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, jsToFs(v)]))
  const mask   = Object.keys(obj).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&')
  const r = await fetch(`${BASE}/${path}?${mask}`, {
    method:  'PATCH',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fields }),
  })
  if (!r.ok) throw new Error(`Firestore PATCH ${path} → ${r.status}: ${await r.text()}`)
}

// ── adminDb() — matches firebase-admin API subset used in viewer.js + water.js ─

export function adminDb() {
  const docRef = (path) => ({
    get:        ()    => fsGet(path),
    update:     (obj) => fsPatch(path, obj),
    collection: (sub) => collRef(`${path}/${sub}`),
  })
  const collRef = (path) => ({
    get: ()   => fsList(path),
    doc: (id) => docRef(`${path}/${id}`),
  })
  return { collection: (name) => collRef(name) }
}
