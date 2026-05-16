// Vercel serverless function — proxy į Brave Image Search API.
//
// Kodėl proxy:
//   • API key NEGALI būti expose'intas kliente
//   • Server-side rezultatai cache'inami per Vercel edge cache (30d)
//     — antras user'is to paties cultivar'o gauna instant
//   • Sentralizuotas error handling
//
// Setup (admin):
//   1. search.brave.com/api → sign up
//   2. Dashboard → API Keys → Create
//   3. Vercel env: BRAVE_API_KEY
//
// API:
//   GET /api/plant-image?q=Clematis+Acropolis
//   → { images: [{ url, thumbnail, source, title, width, height }] }
//
// Cost: free tier 2000 queries/mėn, paskui $3/1000.
//
// (Pastaba: 2026-05 anksčiau bandėm Google CSE — Google account-level
// blokavo Custom Search JSON API naujiems projektams. Brave neturi šio
// apribojimo, todėl migravom šitur.)

export default async function handler(req, res) {
  const q = req.query.q?.trim()
  if (!q) return res.status(400).json({ error: 'query_required' })

  const apiKey = process.env.BRAVE_API_KEY
  if (!apiKey) {
    console.warn('[plant-image] BRAVE_API_KEY not configured')
    return res.status(503).json({ error: 'brave_not_configured', images: [] })
  }

  // Hard timeout — Brave occasionally hangs (free-tier rate limit, transient
  // upstream issues). Be aggressive: 4s nuo Brave > visi candidates kybo →
  // photo enrichment'as nedirba, user'is mato ERR_TIMED_OUT (žiūr. 2026-05
  // regresija). Geriau atsakyti tuščiu sąrašu, kad kliento fallback chain
  // (iNat → Wikidata → Wikipedia → Commons) suvirškintų toliau.
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 4000)

  try {
    const params = new URLSearchParams({
      q,
      count:      '5',          // top 5 results (kliento filter strict)
      safesearch: 'strict',
      country:    'us',         // gauti EN-language results
    })
    const url = `https://api.search.brave.com/res/v1/images/search?${params}`
    const r = await fetch(url, {
      headers: {
        'X-Subscription-Token': apiKey,
        'Accept':               'application/json',
      },
      signal: ctrl.signal,
    })
    if (!r.ok) {
      const errText = await r.text()
      console.warn('[plant-image] Brave returned non-OK:', r.status, errText.slice(0, 300))
      return res.status(r.status).json({
        error:  'brave_failed',
        status: r.status,
        detail: errText.slice(0, 300),
        images: [],
      })
    }
    const data = await r.json()
    const images = (data.results ?? []).map(item => ({
      url:       item.properties?.url ?? item.url,
      thumbnail: item.thumbnail?.src,
      source:    item.source,
      title:     item.title,
      width:     item.properties?.width,
      height:    item.properties?.height,
    }))

    // Vercel edge cache 30 dienų — kartotiniai užklausos visiems user'iams
    // be papildomo Brave quota usage.
    res.setHeader('Cache-Control', 's-maxage=2592000, stale-while-revalidate=86400')
    return res.json({ images })
  } catch (e) {
    if (e.name === 'AbortError') {
      console.warn('[plant-image] Brave timed out after 4s — returning empty list so client fallbacks fire')
      return res.status(504).json({ error: 'brave_timeout', images: [] })
    }
    console.error('[plant-image] exception:', e)
    return res.status(500).json({ error: e.message, images: [] })
  } finally {
    clearTimeout(timer)
  }
}
