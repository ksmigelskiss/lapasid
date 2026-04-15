import { useState, useRef, useEffect } from 'react'

const THRESHOLD = 56   // px — visual pull needed to trigger refresh
const MAX_PULL  = 72   // px — max visual indicator height
const DAMPEN    = 0.45 // pull resistance factor

export function usePullToRefresh(containerRef, onRefresh) {
  const [pullY, setPullY]           = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  // Use a ref so event listeners always see the latest values
  const stateRef = useRef({ startY: null, pulling: false, pullY: 0, refreshing: false })

  useEffect(() => {
    stateRef.current.refreshing = refreshing
  }, [refreshing])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onTouchStart = (e) => {
      if (stateRef.current.refreshing) return
      if (el.scrollTop > 0) return
      stateRef.current.startY  = e.touches[0].clientY
      stateRef.current.pulling = false
    }

    const onTouchMove = (e) => {
      if (stateRef.current.startY === null || stateRef.current.refreshing) return
      if (el.scrollTop > 0) { stateRef.current.startY = null; return }

      const dy = e.touches[0].clientY - stateRef.current.startY
      if (dy <= 0) { stateRef.current.startY = null; setPullY(0); return }

      stateRef.current.pulling = true
      const clamped = Math.min(dy * DAMPEN, MAX_PULL)
      stateRef.current.pullY = clamped
      setPullY(clamped)
      e.preventDefault() // block native scroll while pulling
    }

    const onTouchEnd = async () => {
      if (!stateRef.current.pulling) return
      const py = stateRef.current.pullY
      stateRef.current.pulling = false
      stateRef.current.startY  = null
      stateRef.current.pullY   = 0

      if (py >= THRESHOLD) {
        stateRef.current.refreshing = true
        setRefreshing(true)
        setPullY(0)
        try { await onRefresh() } finally {
          stateRef.current.refreshing = false
          setRefreshing(false)
        }
      } else {
        setPullY(0)
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove',  onTouchMove,  { passive: false })
    el.addEventListener('touchend',   onTouchEnd,   { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove',  onTouchMove)
      el.removeEventListener('touchend',   onTouchEnd)
    }
  }, [containerRef, onRefresh])

  return { pullY, refreshing }
}
