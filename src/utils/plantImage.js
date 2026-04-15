/**
 * Fetches plant photos.
 * fetchWikimediaImage  — single best photo (used for bulk fetch)
 * fetchPlantPhotos     — multiple photos for cycling in the detail view
 */

function stripCultivarForImage(name) {
  return name.replace(/\s*'[^']*'/g, '').replace(/\s*"[^"]*"/g, '').trim()
}

function extractPhotoUrl(photo) {
  return photo?.original_url ?? photo?.large_url ?? photo?.medium_url ?? null
}

async function fetchINaturalistPhotos(latinName) {
  if (!latinName) return []
  try {
    // Step 1: search for taxon ID
    const searchRes = await fetch(
      `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(latinName)}&limit=1&rank=species,subspecies,variety`,
      { headers: { Accept: 'application/json' } }
    )
    if (!searchRes.ok) return []
    const searchData = await searchRes.json()
    const taxon = searchData.results?.[0]
    if (!taxon) return []

    // Step 2: fetch full taxon detail — has complete taxon_photos list
    const detailRes = await fetch(
      `https://api.inaturalist.org/v1/taxa/${taxon.id}`,
      { headers: { Accept: 'application/json' } }
    )
    const fullTaxon = detailRes.ok
      ? (await detailRes.json()).results?.[0]
      : taxon

    const photos = fullTaxon?.taxon_photos ?? taxon.taxon_photos ?? []
    const urls = photos
      .map(tp => extractPhotoUrl(tp.photo))
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)

    // Ensure default photo is first
    const def = extractPhotoUrl(taxon.default_photo)
    if (def && !urls.includes(def)) urls.unshift(def)

    return urls
  } catch {
    return []
  }
}

async function fetchWikipediaPhoto(latinName) {
  if (!latinName) return null
  const title = latinName.trim().replace(/ /g, '_')
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { headers: { Accept: 'application/json' } }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.originalimage?.source ?? data.thumbnail?.source ?? null
  } catch {
    return null
  }
}

// Single best photo — used for bulk Dashboard fetch
export async function fetchWikimediaImage(latinName) {
  const photos = await fetchINaturalistPhotos(latinName)
  if (photos.length) return photos[0]
  return fetchWikipediaPhoto(latinName)
}

// Multiple photos — used for cycling in PhotoSheet
export async function fetchPlantPhotos(latinName) {
  const search = stripCultivarForImage(latinName)
  const [inatPhotos, wikiPhoto] = await Promise.all([
    fetchINaturalistPhotos(search),
    fetchWikipediaPhoto(search),
  ])
  const all = [...inatPhotos]
  if (wikiPhoto && !all.includes(wikiPhoto)) all.push(wikiPhoto)
  return all
}
