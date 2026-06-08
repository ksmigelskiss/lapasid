// Vercel serverless function — vision-doc slaptažodžio validacija (POST).
// Sėkmingai → uždeda httpOnly cookie, kurį middleware.js tikrina prieš serv'indamas
// /vision/doc + /screenshots/*.
//
// Cookie token = SHA-256(PEPPER + ':' + VISION_PASSWORD). Slaptažodis NIEKADA negyvena
// kliento pusėje (cookie turi tik hash'ą; jo nepaforguosi nežinodamas slaptažodžio).
//
// KRITIŠKA: PEPPER + token algoritmas TURI tiksliai sutapti su middleware.js.
// Fail-closed: VISION_PASSWORD nenustatytas → 503 (niekada atsitiktinai atviras).

const PEPPER  = 'lapasid-vision-v1'
const MAX_AGE = 60 * 60 * 24 * 7   // 7 dienos

async function tokenFor(password) {
  const data = new TextEncoder().encode(PEPPER + ':' + password)
  const buf  = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' })

  const PASSWORD = process.env.VISION_PASSWORD
  if (!PASSWORD) return res.status(503).json({ ok: false, error: 'not_configured' })  // fail-closed

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  const password = (body && body.password) || ''

  if (!password || password !== PASSWORD) {
    return res.status(401).json({ ok: false })
  }

  const token = await tokenFor(PASSWORD)
  res.setHeader('Set-Cookie',
    'vision_auth=' + token + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=' + MAX_AGE)
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ ok: true })
}
