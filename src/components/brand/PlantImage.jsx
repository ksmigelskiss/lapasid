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

/**
 * Stale-while-revalidate image swap (2026-06-01):
 *
 * Kai `url` prop pasikeičia (e.g. subscribeCatalog atneša naują heroIllustration
 * po Phase 2 enrichment'o, ar admin'as pergeneravo paveiksliuką), KEEP'inam
 * rodyti SENĄJĮ image tol, kol naujasis fully užsikrauna network'u, tada
 * smooth opacity swap. Tas pašalina vizualų „loading flash" tarp catalog
 * write'ų.
 *
 * Pirmą kartą rendinant (no previous): tiesiai naujas — toks UX kaip iki šiol.
 *
 * Pattern'as įprastas industry — analogiškas SWR, React Suspense fallback'ams,
 * Next.js Image priority loading'ui. Reusable visur kur image url gali keistis
 * runtime'e (ne tik plant cards).
 */
import { useState, useEffect, useRef } from 'react'

export default function PlantImage({
  url,
  thumbUrl,
  size = 'card',
  alt = '',
  eager = false,
  className = '',
  onError,
  onLoad,
  draggable,
  style,
}) {
  // 2026-06-01 — dual upload support: kai render'inam SMALL display dydį
  // ('thumb' arba 'card'), prioritetinkime thumbUrl prop'ą (mūsų pre-resized
  // ~480px Firebase Storage variant). Dashboard PlantCard naudoja size='card',
  // PhotoSheet grid'as — size='thumb'. Abiem atvejais 480px užtenka net retina'e.
  // transformPlantImageUrl toliau handle'ina iNat/Wiki source-side resize.
  // Firebase Storage upload'ams be thumbUrl pasiliekam full URL → no regression.
  const useThumb = (size === 'thumb' || size === 'card') && thumbUrl
  const baseUrl = useThumb ? thumbUrl : url
  const targetSrc = transformPlantImageUrl(baseUrl, size)

  // displayedSrc — kas faktiškai render'inta <img>'e (gali būti SENAS kol naujas
  // user'iui nepakliuvęs); targetSrc — kur norim eit (props url). Jei jie skiriasi
  // → background preload + atomic swap kai naujas ready.
  const [displayedSrc, setDisplayedSrc] = useState(targetSrc)
  const lastTargetRef = useRef(targetSrc)

  useEffect(() => {
    // targetSrc nepasikeitė — nieko nedarom.
    if (targetSrc === lastTargetRef.current) return
    lastTargetRef.current = targetSrc

    // 2026-06-02 — image PAŠALINTAS (revert / delete-from-history → url=null).
    // Išvalom displayedSrc, kad nepaliktų seno paveikslėlio (anksčiau `!targetSrc`
    // return'indavo be išvalymo → senas hero likdavo matomas).
    if (!targetSrc) { setDisplayedSrc(null); return }

    // Naujas URL — preload'inam background'e. SENAS lieka rodomas iki preload
    // baigsis. Kai baigsis — setDisplayedSrc → React re-render su naujo URL
    // <img>'u; browser jau turi cached → instant DOM swap, jokio flash'o.
    const preload = new Image()
    let cancelled = false

    preload.onload = () => {
      if (!cancelled) setDisplayedSrc(targetSrc)
    }
    preload.onerror = () => {
      if (!cancelled) onError?.()
    }
    preload.src = targetSrc

    return () => { cancelled = true }
  }, [targetSrc, onError])

  if (!displayedSrc) return null
  return (
    <img
      src={displayedSrc}
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
