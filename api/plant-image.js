// Vercel serverless function — proxy į Google Custom Search Image API.
//
// Kodėl proxy:
//   • API key NEGALI būti expose'intas kliente
//   • Server-side rezultatai cache'inami per Vercel edge cache (30d)
//     — antras user'is ieškantis to paties cultivar'o gauna instant
//   • Sentralizuotas rate limiting / error handling
//
// Setup (admin):
//   1. cse.google.com → naujas search engine, configure'inti plant authority
//      sites (RHS, garden.org, whiteflowerfarm, etc.), gauti Search Engine ID
//   2. console.cloud.google.com → enable „Custom Search API", create API key
//   3. Vercel env: GOOGLE_CSE_ID + GOOGLE_CSE_API_KEY
//
// API:
//   GET /api/plant-image?q=Clematis+Acropolis
//   → { images: [{ url, thumbnail, source, title, width, height }] }
//
// Cost: 100 queries/day free, $5/1000 paskui. Tikslas: ~$5-10/mėn at scale.

export default async function handler(req, res) {
  const q = req.query.q?.trim()
  if (!q) return res.status(400).json({ error: 'query_required' })

  const cseId  = process.env.GOOGLE_CSE_ID
  const apiKey = process.env.GOOGLE_CSE_API_KEY
  if (!cseId || !apiKey) {
    console.warn('[plant-image] GOOGLE_CSE_ID or GOOGLE_CSE_API_KEY not configured')
    return res.status(503).json({ error: 'cse_not_configured', images: [] })
  }

  try {
    const params = new URLSearchParams({
      q,
      cx:         cseId,
      key:        apiKey,
      searchType: 'image',
      num:        '3',           // top 3 — keli kandidatai, klientas pasirenka
      safe:       'active',
      imgSize:    'medium',      // ne ikona ir ne giant — tinka thumbnail'ui
    })
    const url = `https://www.googleapis.com/customsearch/v1?${params}`
    const r = await fetch(url)
    if (!r.ok) {
      const errText = await r.text()
      console.warn('[plant-image] CSE returned non-OK:', r.status, errText.slice(0, 200))
      return res.status(r.status).json({ error: 'cse_failed', images: [] })
    }
    const data = await r.json()
    const images = (data.items ?? []).map(item => ({
      url:       item.link,
      thumbnail: item.image?.thumbnailLink ?? item.link,
      source:    item.displayLink,
      title:     item.title,
      width:     item.image?.width,
      height:    item.image?.height,
    }))

    // Vercel edge cache 30 dienų (~popular cultivar užklausos kartos su latency'u)
    res.setHeader('Cache-Control', 's-maxage=2592000, stale-while-revalidate=86400')
    return res.json({ images })
  } catch (e) {
    console.error('[plant-image] exception:', e)
    return res.status(500).json({ error: e.message, images: [] })
  }
}
