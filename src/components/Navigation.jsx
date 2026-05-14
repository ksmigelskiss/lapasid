/**
 * Navigation — bottom tab juosta mobile'e.
 *
 * Stilius mirror'ina DesktopHeader pill-style tabs (sage active state),
 * tik išdėstyta apačioj kaip iOS-style segmented control'as.
 */

const tabs = [
  { id: 'dashboard',  label: 'Augalai',    countKey: 'dashboard'  },
  { id: 'biblioteka', label: 'Biblioteka', countKey: 'biblioteka' },
  { id: 'zinynas',    label: 'Žinynas',    countKey: 'zinynas'    },
]

export default function Navigation({ active, onChange, counts = {}, role = 'owner', isDesktop = false }) {
  const visibleTabs = role === 'viewer' ? tabs.filter(t => t.id === 'dashboard') : tabs
  // Desktop'e nav apsiriboja kairiame panelyje (right-[430px]); mobile — center max-w-[430px]
  const navPos = isDesktop
    ? 'fixed bottom-0 left-0 right-[430px] z-40'
    : 'fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-40'

  return (
    <nav className={navPos}>
      {/* Floating capsule pattern (iOS Maps style) — tabs nubrenta nuo apatinio
          krašto, gauna solid bg + lifted shadow, kad aiškiai atskirtų nuo
          grid'o turinio žemiau ir nuo browser/iOS bottom area. */}
      <div
        className="px-3 pt-2 pb-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
      >
        <div className="flex bg-bone-100/95 rounded-btn p-1 gap-0.5 border border-bone-400/40 shadow-[0_4px_16px_rgba(28,58,42,0.12),0_0_0_1px_rgba(28,58,42,0.04)]">
          {visibleTabs.map(({ id, label, countKey }) => {
            const isActive = active === id
            const count = counts[countKey] ?? 0
            return (
              <button
                key={id}
                onClick={() => onChange(id)}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-btn-sm text-[13px] font-medium transition-colors ${
                  isActive
                    ? 'bg-bone shadow-[0_1px_2px_rgba(28,58,42,0.06),0_0_0_1px_rgba(28,58,42,0.04)] text-forest-700'
                    : 'text-forest-500 active:text-forest-700'
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`font-mono text-[10px] font-medium px-1.5 py-px rounded-full ${
                    isActive ? 'bg-forest-100 text-forest-700' : 'bg-bone-300 text-forest-600'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
