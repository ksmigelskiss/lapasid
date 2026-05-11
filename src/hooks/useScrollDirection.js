import { useEffect, useRef, useState } from 'react'

/**
 * useScrollDirection — grąžina `true` kai vartotojas scrollina žemyn (toliau nei
 * `threshold`px nuo viršaus), `false` kai scrollina atgal arba būna prie viršaus.
 *
 * Naudojama header'ių/greeting'ų auto-hide pattern'ui (kaip iOS Mail, Twitter):
 * tipinis vartotojas iškart sumeta dėmesį į turinį, todėl info juostas galim
 * paslėpti animuotai ir grąžinti, kai jis nori grįžti į viršų.
 *
 * Args:
 *   scrollRef — ref į elementą su overflow scroll
 *   threshold — kiek px nuo viršaus laikom „prie viršaus" (visada matomas)
 *   delta     — minimalus scroll delta, į kurį reaguojam (filtruojam jitter)
 */
export function useScrollDirection(scrollRef, { threshold = 80, delta = 4 } = {}) {
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const handler = () => {
      const y = el.scrollTop
      const diff = y - lastY.current

      // Ties viršuj — visada matom (svarbu po pull-to-refresh, prie zonų pradžios).
      if (y < threshold) {
        if (hidden) setHidden(false)
        lastY.current = y
        return
      }

      // Ignoruojam mažas vibracijas (touch jitter).
      if (Math.abs(diff) < delta) return

      if (diff > 0 && !hidden) setHidden(true)        // scroll'inasi žemyn
      else if (diff < 0 && hidden) setHidden(false)   // scroll'inasi atgal

      lastY.current = y
    }

    el.addEventListener('scroll', handler, { passive: true })
    return () => el.removeEventListener('scroll', handler)
  }, [scrollRef, threshold, delta, hidden])

  return hidden
}
