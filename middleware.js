// Vercel Edge Middleware — vision-doc gate'as per cookie.
// 2026-06-09. Saugo TIK dokumentą (/vision/doc, /vision-doc.html) + /screenshots/*.
// Viešas vartų puslapis (/vision, /vision.html) ir /api/vision-unlock NEliečiami.
//
// Srautas:
//   /vision (viešas gate) → user įveda slaptažodį + pasirenka kalbą →
//   POST /api/vision-unlock → serveris uždeda httpOnly cookie
//   vision_auth = SHA-256(PEPPER + ':' + VISION_PASSWORD) →
//   šis middleware tą cookie tikrina prieš serv'indamas dokumentą / screenshots.
//
// Kodėl ne client-side slaptažodis: turinys parsisiųstų PRIEŠ JS (view-source / Network) =
// teatras. Čia turinys už cookie, kurį uždeda TIK serveris po teisingo slaptažodžio.
//
// Fail-closed: VISION_PASSWORD nenustatytas → blokuojam.
// KRITIŠKA: PEPPER + token algoritmas TURI tiksliai sutapti su api/vision-unlock.js.

export const config = {
  matcher: ['/vision/doc', '/vision-doc.html', '/screenshots/:path*'],
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
  const isDoc  = pathname === '/vision/doc' || pathname === '/vision-doc.html'
  const isShot = pathname.startsWith('/screenshots/')
  if (!isDoc && !isShot) return  // safety net — nieko kito neliečiam

  const PASSWORD = process.env.VISION_PASSWORD
  const cookie   = readCookie(request, 'vision_auth')
  const ok = !!PASSWORD && !!cookie && cookie === await tokenFor(PASSWORD)
  if (ok) return  // ✓ praleidžiam į static failą / rewrite

  // Dokumentui — gražiai redirect'inam į vartų puslapį (kad direct-link patektų į gate'ą).
  // Sub-resource'ams (screenshots) — 401 (redirect sulaužytų <img>).
  if (isDoc) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/vision', 'Cache-Control': 'no-store' },
    })
  }
  return new Response('🔒 LapasID Vision — unauthorized.', {
    status: 401,
    headers: { 'Cache-Control': 'no-store' },
  })
}
