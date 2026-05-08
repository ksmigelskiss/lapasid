// Standalone PWA Google OAuth — serverio pusė
// Naršyklė naudoja Firebase signInWithPopup; čia tik standalone PWA
export default function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    res.status(500).send('GOOGLE_CLIENT_ID not configured')
    return
  }

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  'https://augalai.crazyeuropean.eu/api/auth/callback',
    response_type: 'code',
    scope:         'openid email profile',
    prompt:        'select_account',
  })

  res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}
