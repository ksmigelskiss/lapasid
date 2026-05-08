// Google OAuth callback — keičia code į ID tokeną, grąžina į PWA
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

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  'https://augalai.crazyeuropean.eu/api/auth/callback',
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
