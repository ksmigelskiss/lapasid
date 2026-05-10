import { useState, useEffect } from 'react'

// Media query hook — true kai viewport ≥ 1024px (Tailwind lg: breakpoint).
// Naudojama desktop layout aktyvavimui (split panel, header tabs).
// Mobile (<1024px) lieka kaip dabar.
export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  )
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)')
    const handler = (e) => setIsDesktop(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])
  return isDesktop
}
