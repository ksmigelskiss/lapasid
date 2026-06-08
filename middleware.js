// Vercel Edge Middleware — HTTP Basic Auth gate'as vision doc'ui.
// 2026-06-08. Apsaugo TIK /vision + /vision.html + /screenshots/* (matcher scoped →
// pagrindinis app'as lapasid.lt nepaliestas, jokios latency jam).
//
// Kodėl middleware, ne JS slaptažodis: client-side JS slaptažodis = teatras (HTML
// turinys parsisiunčia PRIEŠ JS → view-source/Network/JS-off viską parodo).
// Basic Auth tikrina serveryje (edge) PRIEŠ serv'inant → turinys neišeina be slaptažodžio.
//
// Slaptažodis = VISION_PASSWORD env var (Vercel → Settings → Environment Variables).
// Username naršyklės prompt'e — bet koks (tikrinamas TIK password).
// Fail-closed: jei VISION_PASSWORD nenustatytas → 401 (niekada atsitiktinai atviras).

export const config = {
  matcher: ['/vision', '/vision.html', '/screenshots/:path*'],
}

export default function middleware(request) {
  const { pathname } = new URL(request.url)
  const isProtected =
    pathname === '/vision' ||
    pathname === '/vision.html' ||
    pathname.startsWith('/screenshots/')
  if (!isProtected) return  // safety net — pagrindinio app'o neliečiam

  const PASSWORD = process.env.VISION_PASSWORD
  const header = request.headers.get('authorization') || ''
  let pass = ''
  if (header.startsWith('Basic ')) {
    try { pass = atob(header.slice(6)).split(':')[1] || '' } catch { /* invalid b64 */ }
  }

  if (PASSWORD && pass === PASSWORD) return  // ✓ praleidžiam į static failą / rewrite

  return new Response('🔒 LapasID Vision — reikalingas slaptažodis.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="LapasID Vision", charset="UTF-8"',
      'Cache-Control': 'no-store',
    },
  })
}
