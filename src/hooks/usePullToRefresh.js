/**
 * usePullToRefresh — NO-OP hook'as (deprecated UX, paliktas API kompatilumui).
 *
 * Pradžioj: pull-to-refresh gesture'as su touchmove `passive: false` listener'iu
 * + e.preventDefault() kai user'is pulled į apačią. Problema iOS PWA'e —
 * `{ passive: false }` reiškia browser'iui „šis listener'is GALI preventDefault,
 * todėl scroll'o pradžia atidedama kol listener'is execute'inasi". Retkarčiais
 * tai sukeldavo gesture lock'ą, kur scroll'as „uzstring'davo" iki refresh'o.
 *
 * Dabar: su Firestore SDK persistence + onSnapshot real-time listener'iais
 * (usePlants.js), server pokyčiai auto-sinkrinasi continuously. Manual
 * pull-to-refresh'o reikšmė menka — auto-sync dengia visus use case'us.
 *
 * No-op hook'as palieka:
 *   - API kompatilumas (Dashboard.jsx + Biblioteka.jsx vis kviečia)
 *   - Pure native iOS scroll'as be jokio touchmove interferencijos
 *   - pullY=0, refreshing=false → indikator'as niekada nesirodo
 */
export function usePullToRefresh() {
  return { pullY: 0, refreshing: false }
}
