import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage } from './firebase'

// ── Fetch ──────────────────────────────────────────────────────

function stripCultivar(name) {
  return name.replace(/\s*'[^']*'/g, '').replace(/\s*"[^"]*"/g, '').trim()
}

function extractPhotoUrl(photo) {
  return photo?.original_url ?? photo?.large_url ?? photo?.medium_url ?? null
}

async function fetchINaturalistPhotos(latinName) {
  if (!latinName) return []
  try {
    const searchRes = await fetch(
      `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(latinName)}&limit=1&rank=species,subspecies,variety`,
      { headers: { Accept: 'application/json' } }
    )
    if (!searchRes.ok) return []
    const searchData = await searchRes.json()
    const taxon = searchData.results?.[0]
    if (!taxon) return []

    const detailRes = await fetch(
      `https://api.inaturalist.org/v1/taxa/${taxon.id}`,
      { headers: { Accept: 'application/json' } }
    )
    const fullTaxon = detailRes.ok ? (await detailRes.json()).results?.[0] : taxon
    const photos = fullTaxon?.taxon_photos ?? taxon.taxon_photos ?? []
    const urls = photos.map(tp => extractPhotoUrl(tp.photo)).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i)
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

/**
 * Fetch Wikipedia summary text for RAG (Retrieval-Augmented Generation).
 * Returns abstract paragraph + page URL — passed to Claude as authoritative
 * factual source for toxicity/edibility/medicinal info, reducing hallucinations.
 *
 * Returns null if no Wikipedia article exists for that latinName.
 */
export async function fetchWikipediaContext(latinName) {
  if (!latinName) return null
  const title = latinName.trim().replace(/ /g, '_')
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { headers: { Accept: 'application/json' } }
    )
    if (!res.ok) return null
    const data = await res.json()
    if (!data.extract) return null
    return {
      title:   data.title ?? null,
      extract: data.extract,                                       // plain text abstract
      url:     data.content_urls?.desktop?.page ?? null,
    }
  } catch {
    return null
  }
}

/** Single best photo — used for bulk Dashboard fetch */
export async function fetchBestPhoto(latinName) {
  const photos = await fetchINaturalistPhotos(latinName)
  if (photos.length) return photos[0]
  return fetchWikipediaPhoto(latinName)
}

/** Multiple photos — used for cycling in PhotoSheet */
export async function fetchPhotos(latinName) {
  const search = stripCultivar(latinName)
  const genus  = search.split(' ')[0]

  const [inatPhotos, wikiPhoto] = await Promise.all([
    fetchINaturalistPhotos(search),
    fetchWikipediaPhoto(search),
  ])
  const all = [...inatPhotos]
  if (wikiPhoto && !all.includes(wikiPhoto)) all.push(wikiPhoto)

  if (all.length === 0 && genus !== search) {
    const [genusInat, genusWiki] = await Promise.all([
      fetchINaturalistPhotos(genus),
      fetchWikipediaPhoto(genus),
    ])
    if (genusInat.length) return genusInat
    if (genusWiki) return [genusWiki]
  }

  return all
}

// ── Resize ────────────────────────────────────────────────────

/** Resizes a File to max dimensions, returns JPEG data URL */
export function resizeImage(file, maxSize = 900, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > height) {
        if (width > maxSize) { height = Math.round(height * maxSize / width); width = maxSize }
      } else {
        if (height > maxSize) { width = Math.round(width * maxSize / height); height = maxSize }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}

// ── Upload ────────────────────────────────────────────────────

/**
 * Uploads a base64 data URL to Firebase Storage.
 * External URLs (iNaturalist, Wikimedia) pass through unchanged.
 */
export async function uploadImage(dataUrl, plantId) {
  if (!dataUrl.startsWith('data:')) return dataUrl
  // auth garantuota App.jsx lygyje — uploadImage kviečiamas tik prisijungus
  try {
    const base64 = dataUrl.split(',')[1]
    const mime   = dataUrl.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg'
    const ext    = mime === 'image/png' ? 'png' : 'jpg'
    const binary = atob(base64)
    const bytes  = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const imageRef = ref(storage, `plants/${plantId}/${Date.now()}.${ext}`)
    await uploadBytes(imageRef, bytes, { contentType: mime })
    return getDownloadURL(imageRef)
  } catch (err) {
    console.error('uploadImage failed:', err)
    return null
  }
}
