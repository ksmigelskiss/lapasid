// Firestore REST API helpers — naudojami api/ serverless funkcijose
// Nereikia Firebase Admin SDK — naudojame vartotojo ID tokeną

const PROJECT   = 'geliu-db'
const FS_BASE   = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`
const FS_COMMIT = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:commit`

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

// Padidina skaičiaus lauką per 1 (atomic server-side increment)
export async function fsIncrement(collection, id, fieldPath, idToken) {
  try {
    await fetch(FS_COMMIT, {
      method:  'POST',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        writes: [{
          transform: {
            document: `projects/${PROJECT}/databases/(default)/documents/${collection}/${id}`,
            fieldTransforms: [{ fieldPath, increment: { integerValue: '1' } }],
          },
        }],
      }),
    })
  } catch {}
}

// Gauna UID iš Firebase ID tokeno (JWT payload — base64 decode)
export function uidFromToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'))
    return payload.sub || payload.user_id || null
  } catch { return null }
}

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
