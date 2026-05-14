// Server-side Google OAuth start — naudojama iOS PWA standalone mode'e,
// kur Firebase signInWithRedirect storage izoliuotas tarp firebaseapp.com
// auth iframe'o ir lapasid.lt main domeno → session prarandama.
//
// Flow:
//   1. PWA → GET /api/auth/google-start
//   2. Server redirect'ina į accounts.google.com su client_id + redirect_uri
//   3. User autentifikuojasi Google'e
//   4. Google redirect'ina į /api/auth/callback?code=...
//   5. Callback keičia code → ID token → redirect'ina į / su ?googleIdToken=...
//   6. PWA useAuth aptinka URL param → signInWithCredential → user'is logged in
//
// Domain handled DYNAMICALLY iš request headers — veikia ant bet kurio
// deploy'o (lapasid.lt production, *.vercel.app preview, localhost dev'e).

export default function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    res.status(500).send('GOOGLE_CLIENT_ID not configured')
    return
  }

  // Origin'as iš headers — Vercel pridėda x-forwarded-* trust'ed
  const proto  = req.headers['x-forwarded-proto'] ?? 'https'
  const host   = req.headers['x-forwarded-host']  ?? req.headers.host
  const origin = `${proto}://${host}`

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  `${origin}/api/auth/callback`,
    response_type: 'code',
    scope:         'openid email profile',
    prompt:        'select_account',
  })

  res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
