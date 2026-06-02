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

  // 2026-06-02 — progressive LQIP: full-res display (pvz. size='detail') su turimu
  // thumbUrl → pradinis paint = THUMB (cached iš grid'o → instant, jokio „pop" po
  // kortelės atidarymo animacijos), tada preload full + atomic swap. Be thumbUrl
  // ar small dydžiams (card/thumb) — elgesys NEPAKITĘS.
  const lqipThumb = (!useThumb && thumbUrl && url) ? transformPlantImageUrl(thumbUrl, size) : null
  const initialSrc = lqipThumb ?? targetSrc

  // displayedSrc — kas faktiškai render'inta <img>'e. Pradžioj: lqip → thumb
  // (instant), kitaip → targetSrc. Effect preload'ina targetSrc (full) ir swap'ina
  // kai ready; SENAS/thumb lieka rodomas iki onload (SWR — jokio flash'o/loading'o).
  const [displayedSrc, setDisplayedSrc] = useState(initialSrc)

  // onError per ref — kad effect deps NEturėtų inline funkcijos. Anksčiau
  // [targetSrc, onError]: onError (inline arrow iš PlantDetail) keisdavo referenciją
  // kas render → effect re-run → cleanup cancel'indavo in-flight full preload PRIEŠ
  // swap → LQIP užstrigdavo ant thumb'o (ypač necached/lėtų full'ų). Bug fix 2026-06-02.
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  useEffect(() => {
    // image PAŠALINTAS (revert / delete-from-history → url=null) — išvalom.
    if (!targetSrc) { setDisplayedSrc(null); return }

    // Preload target (full); SENAS/thumb lieka rodomas iki onload → atomic swap.
    // Vienas dep [targetSrc] → re-run TIK kai realiai keičiasi paveikslo URL
    // (re-enrich / gallery nav / mount), niekad ne dėl render'o churn'o.
    let cancelled = false
    const preload = new Image()
    preload.onload  = () => { if (!cancelled) setDisplayedSrc(targetSrc) }
    preload.onerror = () => { if (!cancelled) onErrorRef.current?.() }
    preload.src = targetSrc

    return () => { cancelled = true }
  }, [targetSrc])

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
