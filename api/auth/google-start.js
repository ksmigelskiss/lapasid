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
// redirect_uri HARDCODED į production'ą — PRIVALO match'inti tikslų URL
// Google Cloud Console authorized redirect URIs sąraše. Anksčiau bandėm
// dinamiškai per x-forwarded-host, bet iOS PWA kartais resolve'ino į
// `www.lapasid.lt` ar kitą hostą, kurio nebuvo GCC sąraše → 400 mismatch.
// Override per OAUTH_REDIRECT_URI env jei reikia (preview / dev).

const DEFAULT_REDIRECT_URI = 'https://lapasid.lt/api/auth/callback'

export default function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    res.status(500).send('GOOGLE_CLIENT_ID not configured')
    return
  }

  const redirectUri = process.env.OAUTH_REDIRECT_URI || DEFAULT_REDIRECT_URI

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'openid email profile',
    prompt:        'select_account',
  })

  res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
