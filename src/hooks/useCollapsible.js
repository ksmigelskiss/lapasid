import { useState } from 'react'

/**
 * useCollapsible — collapse/expand state'as su localStorage persistencija.
 * Naudojamas RightPanel widget'uose (Weather / Heatmap / Shop).
 *
 * @param {string} key — unique localStorage key (be prefix'o)
 * @param {boolean} defaultCollapsed — pradinis state'as jei localStorage nėra
 * @returns {[boolean, () => void]} — [collapsed, toggle]
 */
export function useCollapsible(key, defaultCollapsed = false) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem(`lapasid:widget:${key}`)
      return stored === null ? defaultCollapsed : stored === 'true'
    } catch {
      return defaultCollapsed
    }
  })

  const toggle = () => {
    setCollapsed(c => {
      const next = !c
      try { localStorage.setItem(`lapasid:widget:${key}`, String(next)) } catch {}
      return next
    })
  }

  return [collapsed, toggle]
}
