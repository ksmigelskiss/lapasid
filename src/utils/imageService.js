import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage, auth } from './firebase'

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

/**
 * resizeImagePair(file) — 2026-06-01. Vienoje praeityje produces TWO data URLs:
 *   • full:  900px JPEG quality 0.82 (~50-150 KB) — hero/detail render'iui
 *   • thumb: 240px JPEG quality 0.78 (~8-20 KB)  — kortelių grid'ams
 *
 * Vienas img decode → dvi canvas resize operacijos. Daug pigiau nei du
 * resizeImage() call'ai (kiekvienas savo Image load + decode).
 *
 * Naudojama Dashboard widget'uose, kur skaitomas plant.imageThumb (jei
 * egzistuoja) vietoj 900px image'o → mažiau kraunamų byte'ų ant grid'o
 * → no visible „resize flash" kortelės užkrovimo metu.
 */
export function resizeImagePair(file, { fullSize = 900, fullQ = 0.82, thumbSize = 240, thumbQ = 0.78 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      // Helper — fit longest edge to target, preserve aspect
      const fit = (target) => {
        let { width, height } = img
        if (width > height) {
          if (width > target) { height = Math.round(height * target / width); width = target }
        } else {
          if (height > target) { width = Math.round(width * target / height); height = target }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        return canvas
      }
      try {
        const fullDataUrl  = fit(fullSize).toDataURL('image/jpeg', fullQ)
        const thumbDataUrl = fit(thumbSize).toDataURL('image/jpeg', thumbQ)
        resolve({ full: fullDataUrl, thumb: thumbDataUrl })
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}

// ── Upload ────────────────────────────────────────────────────

/**
 * rehostExternalImage(externalUrl, latinNameOrPathHint, maxSize) — gauna external
 * image URL'ą (Brave commercial, paghat.com, etc.), server'is fetch'ina,
 * resize'ina į maxSize px (longest side) ir upload'ina į mūsų Firebase Storage.
 *
 * Naudojama Save flow'e — vartotojas išsaugo augalą, mes pasiimam jo hero
 * nuotrauką ir užtikrinam, kad ji nesulūš (mūsų Storage = guaranteed URL).
 *
 * Storage path: server'is derivuoja iš `latinName` per savą `catalogSlug()`
 * (mirror'as catalogDocId). Backward-compat: jei perduotum `catalog/{slug}`
 * format'o string'ą, server'is jį validuoja ir priima kaip legacy pathHint.
 * Geriau perduoti tiesiog latinName.
 *
 * AUTH: nuo 2026-05-21 reikalauja Firebase ID token'o (audit fix). Jei
 * user nelogged'in — request'as fail'ins su 401, fail-soft grąžinam original
 * URL'ą.
 *
 * Fail-soft — jei rehost nepavyksta (CORS, timeout, 401, 404), grąžinam
 * original URL ir log'iname warning'ą. Vartotojas save'o flow'as nesulūž.
 */
export async function rehostExternalImage(externalUrl, latinNameOrPathHint, maxSize = 1200) {
  if (!externalUrl || typeof externalUrl !== 'string') return externalUrl
  if (!latinNameOrPathHint) return externalUrl

  // Skip jei jau mūsų Storage URL'as
  if (externalUrl.includes('firebasestorage.googleapis.com') ||
      externalUrl.includes('storage.googleapis.com/geliu-db')) {
    return externalUrl
  }
  // Skip data: URL'ai — atskira tvarka per uploadImage
  if (externalUrl.startsWith('data:')) return externalUrl

  // Auth tokenas — server'is reikalauja nuo 2026-05-21
  let idToken = null
  try {
    idToken = await auth.currentUser?.getIdToken?.()
  } catch (e) {
    console.warn('[rehostExternalImage] auth token unavailable:', e?.message)
    return externalUrl  // fail-soft, no auth → no rehost
  }
  if (!idToken) {
    console.warn('[rehostExternalImage] no signed-in user, skipping rehost')
    return externalUrl
  }

  // Pasirenkam, kurį body param siųsti: jei argumentas atrodo kaip pilnas
  // legacy pathHint'as (su `catalog/` prefix'u), siunčiam jį; kitaip
  // pradedam laikyti kaip latinName ir server'is sukurs slug'ą.
  const isLegacyPathHint = /^catalog\//.test(latinNameOrPathHint)
  const body = isLegacyPathHint
    ? { url: externalUrl, pathHint: latinNameOrPathHint, maxSize }
    : { url: externalUrl, latinName: latinNameOrPathHint, maxSize }

  try {
    const r = await fetch('/api/rehost-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify(body),
    })
    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      console.warn('[rehostExternalImage] server returned', r.status, err)
      return externalUrl  // fail-soft
    }
    const data = await r.json()
    if (data.url) {
      if (data.reduction != null) {
        console.log(`[rehostExternalImage] ${latinNameOrPathHint}: ${data.originalSize} → ${data.finalSize} bytes (-${data.reduction}%)`)
      }
      return data.url
    }
    return externalUrl
  } catch (e) {
    console.warn('[rehostExternalImage] failed (keeping external):', e?.message ?? e)
    return externalUrl  // fail-soft
  }
}

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

/**
 * uploadImageWithThumb(dataUrl, plantId) — 2026-06-01. Vienu žingsniu:
 *   1. Decode'ina data URL'ą atgal į Image
 *   2. Generuoja 240px thumb canvas-on-the-fly
 *   3. Upload'ina ABU (full + thumb) paraleliai į Firebase Storage
 *   4. Grąžina { url, thumbUrl }
 *
 * Pravartu kai caller'is jau turi resized data URL'ą (e.g. resizeImage(file)
 * call'ą iš seno code path'o) — nereikia keisti viso upstream chain'o, vis
 * tiek gauname dual upload benefits.
 *
 * Storage path'ai:
 *   plants/{id}/{ts}.jpg        — full (900px JPEG)
 *   plants/{id}/{ts}_thumb.jpg  — thumb (240px JPEG)
 *
 * Failsoft — bet kuris upload nepavyks → grąžinam null tam URL'ui (caller'is
 * gali užfiksuoti full be thumb, ar abu null).
 *
 * Plain URL (ne data:) passthrough — external photo (iNat, Wiki) grąžinam
 * kaip yra, su thumbUrl=null (PlantImage transformPlantImageUrl jas gali
 * resize'inti per URL pattern'ą).
 */
export async function uploadImageWithThumb(dataUrl, plantId) {
  if (!dataUrl) return { url: null, thumbUrl: null }
  if (!dataUrl.startsWith('data:')) return { url: dataUrl, thumbUrl: null }
  try {
    // 1) Decode data URL atgal į Image
    const img = await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload  = () => resolve(i)
      i.onerror = () => reject(new Error('data URL decode failed'))
      i.src = dataUrl
    })
    // 2) Generuoti thumb canvas-on-the-fly (~480px = retina 2x sweet spot
    //    Dashboard PlantCard usage'ui ~200-250px CSS dydžio kortelei)
    const fitThumb = (target = 480) => {
      let { width, height } = img
      if (width > height) {
        if (width > target) { height = Math.round(height * target / width); width = target }
      } else {
        if (height > target) { width = Math.round(width * target / height); height = target }
      }
      const c = document.createElement('canvas')
      c.width = width; c.height = height
      c.getContext('2d').drawImage(img, 0, 0, width, height)
      return c.toDataURL('image/jpeg', 0.78)
    }
    const thumbDataUrl = fitThumb(240)

    // 3) Upload'inti abu paraleliai. Tas pats timestamp natūraliai atsekamumui.
    const ts  = Date.now()
    const uploadOne = async (dUrl, suffix) => {
      const base64 = dUrl.split(',')[1]
      const mime   = dUrl.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg'
      const ext    = mime === 'image/png' ? 'png' : 'jpg'
      const binary = atob(base64)
      const bytes  = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const r = ref(storage, `plants/${plantId}/${ts}${suffix}.${ext}`)
      await uploadBytes(r, bytes, { contentType: mime })
      return getDownloadURL(r)
    }
    const [url, thumbUrl] = await Promise.all([
      uploadOne(dataUrl, ''),
      uploadOne(thumbDataUrl, '_thumb'),
    ])
    return { url, thumbUrl }
  } catch (err) {
    console.error('uploadImageWithThumb failed:', err)
    return { url: null, thumbUrl: null }
  }
}
