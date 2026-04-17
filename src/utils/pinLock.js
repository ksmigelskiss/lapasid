const PIN          = '1957'
const KEY_UNTIL    = 'pin-unlock-until'
const REMEMBER_MS  = 7 * 86400_000    // 7 days

export function isUnlocked() {
  const until = localStorage.getItem(KEY_UNTIL)
  return !!until && Date.now() < Number(until)
}

export function tryUnlock(pin) {
  if (pin !== PIN) return false
  localStorage.setItem(KEY_UNTIL, String(Date.now() + REMEMBER_MS))
  return true
}

export function lock() {
  localStorage.removeItem(KEY_UNTIL)
}
