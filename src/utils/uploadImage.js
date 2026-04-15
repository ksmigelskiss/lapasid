import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage, authReady } from './firebase'

/**
 * Uploads a base64 data URL to Firebase Storage.
 * Returns the public download URL.
 * Only uploads user-taken photos (data: URLs) — external URLs pass through unchanged.
 */
export async function uploadImage(dataUrl, plantId) {
  // External URL (iNaturalist, Wikimedia) — no upload needed
  if (!dataUrl.startsWith('data:')) return dataUrl

  await authReady

  try {
    const base64 = dataUrl.split(',')[1]
    const mime   = dataUrl.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg'
    const ext    = mime === 'image/png' ? 'png' : 'jpg'

    // Convert base64 → Uint8Array
    const binary = atob(base64)
    const bytes  = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

    const path     = `plants/${plantId}/${Date.now()}.${ext}`
    const imageRef = ref(storage, path)

    await uploadBytes(imageRef, bytes, { contentType: mime })
    return getDownloadURL(imageRef)
  } catch (err) {
    console.error('uploadImage failed:', err)
    return null
  }
}
