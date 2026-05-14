// Google OAuth callback — keičia code į ID tokeną, grąžina į PWA per
// /?googleIdToken=... URL param'ą. PWA useAuth aptinka ir kviečia
// signInWithCredential.
//
// redirect_uri PRIVALO match'inti tą, kurį google-start.js siuntė +
// kurį pridėjom į Google Cloud Console authorized redirect URIs sąrašą.
// Hardcode'inta į production — žiūr. google-start.js paaiškinimą.

const DEFAULT_REDIRECT_URI = 'https://lapasid.lt/api/auth/callback'

export default async function handler(req, res) {
  const { code, error } = req.query

  if (error) {
    return res.redirect(`/?authError=${encodeURIComponent(error)}`)
  }
  if (!code) {
    return res.redirect('/?authError=no_code')
  }

  const clientId     = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri  = process.env.OAUTH_REDIRECT_URI || DEFAULT_REDIRECT_URI

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
      }),
    })

    const tokens = await tokenRes.json()

    if (tokens.error || !tokens.id_token) {
      console.error('[auth/callback] token error:', tokens)
      return res.redirect(`/?authError=${encodeURIComponent(tokens.error_description || tokens.error || 'token_failed')}`)
    }

    // Perduodame Google ID tokeną atgal į PWA — Firebase signInWithCredential jį priims
    return res.redirect(`/?googleIdToken=${encodeURIComponent(tokens.id_token)}`)
  } catch (e) {
    console.error('[auth/callback] exception:', e)
    return res.redirect(`/?authError=${encodeURIComponent(e.message)}`)
  }
}
