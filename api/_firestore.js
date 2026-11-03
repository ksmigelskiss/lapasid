// Firestore REST API helpers — naudojami api/ serverless funkcijose
// Skaitymui naudojamas vartotojo ID token'as; aiUsage skaitiklio didinimas —
// admin SDK (žr. fsIncrement, K4 fix).
import admin from 'firebase-admin'
import { adminFirestore } from './_lib/firestore-admin.js'

const PROJECT   = 'geliu-db'
const FS_BASE   = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`

// Konvertuoja Firestore REST formato reikšmę į JavaScript reikšmę
function parseValue(v) {
  if (!v) return null
  if (v.booleanValue !== undefined) return v.booleanValue
  if (v.integerValue !== undefined) return parseInt(v.integerValue)
  if (v.doubleValue  !== undefined) return parseFloat(v.doubleValue)
  if (v.stringValue  !== undefined) return v.stringValue
  if (v.nullValue    !== undefined) return null
  if (v.mapValue)   return parseDoc(v.mapValue)
  if (v.arrayValue) return (v.arrayValue.values || []).map(parseValue)
  return null
}

function parseDoc(doc) {
  const obj = {}
  for (const [k, v] of Object.entries(doc.fields || {})) obj[k] = parseValue(v)
  return obj
}

// Nuskaito dokumentą iš Firestore (su vartotojo tokenu — rules tikrina leidimą)
export async function fsGet(collection, id, idToken) {
  try {
    const res = await fetch(`${FS_BASE}/${collection}/${id}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    })
    if (!res.ok) return null
    return parseDoc(await res.json())
  } catch { return null }
}

// Padidina skaičiaus lauką per 1 (atomic server-side increment).
//
// 2026-11-03 (K4 fix) — anksčiau rašyta per Firestore REST su VARTOTOJO ID
// token'u, tad skaitiklio write'as priklausė nuo security rules. Kadangi
// vartotojas turi pilną rašymą į savo users/{uid} doc'ą, jis galėjo paprasčiausiai
// nunulinti `aiUsage` (arba nusistatyti beta/subscription) ir apeiti AI limitus.
// Dabar naudojamas ADMIN SDK (serverio credentials), kuris apeina rules ir
// nepriklauso nuo kliento teisių. Kartu su firestore.rules pakeitimu (klientui
// uždrausta rašyti aiUsage/beta/subscription) limitų nebegalima apeiti iš kliento.
//
// idToken parametras paliktas suderinamumui su esamais kvietikliais — nenaudojamas.
export async function fsIncrement(collection, id, fieldPath, _idToken) {
  try {
    // fieldPath formatas „aiUsage.<type>" — update() interpretuoja tašką kaip
    // įdėtinio (nested) lauko kelią; increment sukuria lauką jei jo nėra.
    await adminFirestore()
      .collection(collection).doc(id)
      .update({ [fieldPath]: admin.firestore.FieldValue.increment(1) })
  } catch (e) {
    console.warn('[fsIncrement] admin increment failed:', e?.message)
  }
}

// 2026-06-02 (P0-1 security) — `uidFromToken` PAŠALINTA. Ji tik base64-decode'ino
// JWT payload'ą BE parašo verifikacijos → forge'inamas UID. Pakeista saugiu
// `verifyAuthToken` (api/_lib/firestore-admin.js → admin.auth().verifyIdToken).

// Free tier limitai
export const FREE_LIMITS = { searches: 5, chats: 5, fbPosts: 2 }

// Tikrina ar vartotojas pasiekė limitą
// Grąžina false jei leisti, limitType string jei blokuoti
export function checkLimit(user, limitType) {
  if (!user || !limitType) return false
  if (user.beta === true) return false
  const plan = user.subscription?.plan
  const until = user.subscription?.validUntil
  if (plan && plan !== 'free' && until && new Date(until) > new Date()) return false
  const used  = (user.aiUsage || {})[limitType] ?? 0
  const limit = FREE_LIMITS[limitType] ?? Infinity
  return used >= limit ? limitType : false
}
