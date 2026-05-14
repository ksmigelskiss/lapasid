/**
 * PlantImage — vienas <img> wrapper'is augalų nuotraukoms.
 *
 * Du performance kontrolės sluoksniai:
 *
 *   1. RESIZE: URL transform'inimas pagal `size` prop'ą. iNaturalist + Wikipedia
 *      API'os jau hostina kelis dydžius — paimam mažiausią, kuris dengia render
 *      pasaulį, ne `original` (1500+px).
 *
 *   2. LAZY: `loading="lazy"` + `decoding="async"` defaultiniai. Browser'is
 *      atideda toli nuo viewport'o esančias nuotraukas. `eager` prop'as
 *      hero foto, kuri yra above-the-fold.
 *
 * Size mapping (UI render → URL variant):
 *   thumb  → ~240px (kortelės grid, mažos thumbnail'os)
 *   card   → ~500px (vidutinės kortelės, search rezultatai)
 *   detail → ~1024px (plant detail hero, timeline foto)
 *   zoom   → original (full-screen zoom)
 */

const INAT_SIZE_MAP = {
  thumb:  'small',
  card:   'medium',
  detail: 'large',
  zoom:   'original',
}

const WIKI_SIZE_MAP = {
  thumb:  320,
  card:   640,
  detail: 1280,
  zoom:   2560,
}

// URL transform'inimas pagal source + reikiamą dydį. Grąžina nepakeistą,
// jei šaltinis nepalaiko dydžių (Firebase Storage uploads, data: URLs, etc).
export function transformPlantImageUrl(url, size = 'card') {
  if (!url || typeof url !== 'string') return url

  // iNaturalist — failo vardas yra dydžio segmentas (.../large.jpg → .../medium.jpg)
  if (url.includes('inaturalist') || url.includes('staticflickr')) {
    const target = INAT_SIZE_MAP[size] ?? 'medium'
    return url.replace(/\/(original|large|medium|small|square|thumb)\.([a-z]+)(\?|$)/i, `/${target}.$2$3`)
  }

  // Wikipedia thumb URL — dimension prefix /1280px-foo.jpg
  if (url.includes('upload.wikimedia.org')) {
    const target = WIKI_SIZE_MAP[size] ?? 640
    // Jei jau yra dimension prefix — paswapinam
    if (/\/\d+px-/.test(url)) {
      return url.replace(/\/(\d+)px-/, `/${target}px-`)
    }
    // Original URL be thumb path — paliekam (negalim sukurti thumb URL'o iš originalo
    // be papildomo API call'o; mažesnių dydžių variant'ai pasiimami enrich() metu)
    return url
  }

  // Nežinomas šaltinis (Firebase Storage user uploads, etc) — kaip yra
  return url
}

export default function PlantImage({
  url,
  size = 'card',
  alt = '',
  eager = false,
  className = '',
  onError,
  onLoad,
  draggable,
  style,
}) {
  const src = transformPlantImageUrl(url, size)
  if (!src) return null
  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={className}
      onError={onError}
      onLoad={onLoad}
      draggable={draggable}
      style={style}
    />
  )
}
