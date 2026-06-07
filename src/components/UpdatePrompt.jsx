// 2026-06-03 — PWA „nauja versija" toast'as (registerType: 'prompt').
// autoUpdate tyliai reload'indavo kas deploy → erzino + prarasdavo UI būseną.
// Dabar naujas SW laukia, parodom mažą banner'į apačioj; user paspaudžia kai nori.
import { useRegisterSW } from 'virtual:pwa-register/react'

export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, r) {
      // Periodinis update check kas 1h — kad nauja versija būtų pasiūlyta net
      // ilgoje sesijoje (be pilno app reopen).
      if (r) setInterval(() => { r.update().catch(() => {}) }, 60 * 60 * 1000)
    },
    onRegisterError(err) {
      // Observability — kad sugedęs SW deploy nebūtų tylus.
      console.warn('[pwa] SW registracija nepavyko:', err)
    },
  })

  if (!needRefresh) return null

  return (
    // bottom = VIRŠ mobile Navigation juostos (fixed bottom-0, ~5rem) + safe-area.
    // z-[300] virš visko (nav z-40, modalai z-90, pickeriai z-200).
    <div
      className="fixed inset-x-0 z-[300] flex justify-center px-4 pointer-events-none"
      style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
    >
      <div className="pointer-events-auto flex items-center gap-3 bg-forest-700 text-bone rounded-full pl-4 pr-2 py-2 shadow-[0_8px_24px_rgba(20,43,31,0.30)] border border-forest-600/40">
        <span className="text-[13px] font-medium tracking-tight">🌿 Nauja versija</span>
        <button
          onClick={() => updateServiceWorker(true)}
          className="text-[13px] font-semibold bg-bone text-forest-800 rounded-full px-3.5 py-1 active:scale-95 transition-transform"
        >
          Atnaujinti
        </button>
      </div>
    </div>
  )
}
