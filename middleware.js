// Vercel Edge Middleware — vision-doc gate'as per cookie.
// 2026-06-09. Saugo TIK dokumentą (/vision/doc, /vision-doc.html).
// Viešas vartų puslapis (/vision, /vision.html), /api/vision-unlock ir /screenshots/*
// NEliečiami.
//
// Kodėl screenshots NEbegatinami (2026-06-09 fix): statinių subresource'ų (<img>)
// gatinimas per auth cookie yra fragile — naršyklių (ypač Safari/iOS) SameSite
// elgsena su subresource'ais nepatikima → dokumentas užsikrauna (navigacija neša
// cookie), bet /screenshots/* img užklausos cookie nebeneša → 401 → broken images.
// Sprendimas: apsaugom dokumento TURINĮ (strateginis tekstas), o app UI screenshot'us
// paliekam viešus, bet noindex + no-store (vercel.json) + robots disallow — neindeksuojami,
// necache'inami, pasiekiami tik žinant tikslų failo vardą.
//
// Srautas:
//   /vision (viešas gate) → user įveda slaptažodį + pasirenka kalbą →
//   POST /api/vision-unlock → serveris uždeda httpOnly cookie
//   vision_auth = SHA-256(PEPPER + ':' + VISION_PASSWORD) →
//   šis middleware tą cookie tikrina prieš serv'indamas dokumentą.
//
// Fail-closed: VISION_PASSWORD nenustatytas → blokuojam.
// KRITIŠKA: PEPPER + token algoritmas TURI tiksliai sutapti su api/vision-unlock.js.

export const config = {
  matcher: ['/vision/doc', '/vision-doc.html'],
}

const PEPPER = 'lapasid-vision-v1'

async function tokenFor(password) {
  const data = new TextEncoder().encode(PEPPER + ':' + password)
  const buf  = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function readCookie(request, name) {
  const raw = request.headers.get('cookie') || ''
  const m = raw.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'))
  return m ? m[1] : ''
}

export default async function middleware(request) {
  const { pathname } = new URL(request.url)
  if (pathname !== '/vision/doc' && pathname !== '/vision-doc.html') return  // safety net

  const PASSWORD = process.env.VISION_PASSWORD
  const cookie   = readCookie(request, 'vision_auth')
  const ok = !!PASSWORD && !!cookie && cookie === await tokenFor(PASSWORD)
  if (ok) return  // ✓ praleidžiam į static failą / rewrite

  // Be galiojančio cookie — redirect'inam į vartų puslapį (direct-link patenka į gate'ą).
  return new Response(null, {
    status: 302,
    headers: { Location: '/vision', 'Cache-Control': 'no-store' },
  })
}
