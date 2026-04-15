import { useRef, useCallback } from 'react'

export function useLongPress(onLongPress, delay = 500) {
  const timer = useRef(null)
  const fired = useRef(false)

  const start = useCallback((e) => {
    // Only primary touch/click
    if (e.type === 'mousedown' && e.button !== 0) return
    fired.current = false
    timer.current = setTimeout(() => {
      fired.current = true
      // Haptic feedback on supported devices
      navigator.vibrate?.(30)
      onLongPress(e)
    }, delay)
  }, [onLongPress, delay])

  const cancel = useCallback(() => {
    clearTimeout(timer.current)
  }, [])

  // Return true if this press was a long press (to suppress click)
  const wasFired = useCallback(() => fired.current, [])

  return {
    onMouseDown: start,
    onMouseUp: cancel,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: cancel,
    onTouchMove: cancel,
    wasFired,
  }
}
