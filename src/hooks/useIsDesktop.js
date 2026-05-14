import { useState, useEffect } from 'react'

// Media query hook — true kai viewport ≥ 1100px.
//
// Anksčiau buvo 1024px (Tailwind lg:), bet su brand'u (~180px) + tabs
// (~340px) + right cluster (~280px) + padding (48px) DesktopHeader'iui
// reikia ≥1024 + ~80px slack'o, kad nesusioverlapintų centered tabs su
// right cluster'iu. 1100px duoda saugų buffer'į; mažesni screen'ai
// (planšetės, split-pane MacBook) gauna mobile layout'ą — touch-friendly
// anyway.
//
// Naudojama desktop split panel + DesktopHeader aktyvavimui. Tailwind
// `lg:` (1024px) lieka semantically atskira — naudojama hover effects,
// grid columns, ne layout switching'ui.
const DESKTOP_BREAKPOINT = '(min-width: 1100px)'

export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(DESKTOP_BREAKPOINT).matches
  )
  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_BREAKPOINT)
    const handler = (e) => setIsDesktop(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])
  return isDesktop
}
