/**
 * Resizes an image File to max dimensions and returns a JPEG data URL.
 * Keeps localStorage-friendly size (~100-200 KB).
 */
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
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}
