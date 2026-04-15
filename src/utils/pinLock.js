const KEY_HASH   = 'pin-hash'
const KEY_UNTIL  = 'pin-unlock-until'
const REMEMBER_DAYS = 30

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function hasPin() {
  return !!localStorage.getItem(KEY_HASH)
}

export async function setPin(pin) {
  const hash = await sha256(pin)
  localStorage.setItem(KEY_HASH, hash)
  // Setting a new PIN re-locks immediately
  localStorage.removeItem(KEY_UNTIL)
}

export function removePin() {
  localStorage.removeItem(KEY_HASH)
  localStorage.removeItem(KEY_UNTIL)
}

export function isUnlocked() {
  if (!hasPin()) return true
  const until = localStorage.getItem(KEY_UNTIL)
  if (!until) return false
  return Date.now() < Number(until)
}

export async function tryUnlock(pin) {
  const hash = await sha256(pin)
  if (hash !== localStorage.getItem(KEY_HASH)) return false
  const until = Date.now() + REMEMBER_DAYS * 86400_000
  localStorage.setItem(KEY_UNTIL, String(until))
  return true
}

export function lock() {
  localStorage.removeItem(KEY_UNTIL)
}
