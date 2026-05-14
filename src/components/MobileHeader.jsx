import { useState, useRef, useEffect } from 'react'
import { Search, Droplets, FlaskConical } from 'lucide-react'
import { CareSummaryList } from './CareOverview'
import T4Icon from './brand/T4Icon'
import T4Word from './brand/T4Word'

/**
 * MobileHeader — top toolbar mobile'e (<1024px).
 *
 * Layout:
 *   ┌──────────────────────────────────────────────┐
 *   │ [T4Icon LapasID]  [🔍] [💧N] [🧪N] [Avatar]  │
 *   └──────────────────────────────────────────────┘
 *
 * Vientisas su DesktopHeader: bone frost bg, T4Icon inverted (antspaudas)
 * + T4Word wordmark; care notifications dviem brand pill'ais (water
 * forest, fert terracotta) vietoj generic bell + raudonas badge.
 */
export default function MobileHeader({
  user, onProfileClick, role = 'owner',
  careNotificationCount = 0, careWaterCount = 0, careFertCount = 0,
  carePopupPlants = [], onCareTap,
  onSearchClick,
}) {
  const [showCarePopup, setShowCarePopup] = useState(false)
  const carePopupRef = useRef(null)

  // Outside click — uždarom care popup'ą
  useEffect(() => {
    if (!showCarePopup) return
    const handler = (e) => {
      if (carePopupRef.current && !carePopupRef.current.contains(e.target)) {
        setShowCarePopup(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showCarePopup])

  const initials = (user?.displayName || user?.email || '?')
    .split(/[\s@]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()

  return (
    <header
      className="h-12 flex-shrink-0 flex items-center px-4 gap-2 bg-app border-b border-bone-400/30 z-30 relative"
      style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(48px + env(safe-area-inset-top))' }}
    >
      {/* Brand — T4Icon inverted (antspaudas: bone mark on forest square) + wordmark.
          h-12 header (48px) → T4Icon 32px palieka 8px tarpą iš viršaus/apačios. */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <T4Icon size={32} ink="#f1ebdd" paper="#1c3a2a" />
        <T4Word size={20} className="text-forest-700" />
      </div>

      {/* Action cluster: search + care pills + avatar.
          Wrapper'is `.relative` — popup'as anchor'ina nuo CLUSTER'IO dešinio
          krašto (= header dešinio krašto), todėl visada tiksliai po trigger
          pill'u, neatsižvelgiant į kitus content'us viewport'e. */}
      <div className="ml-auto flex items-center gap-1.5 flex-shrink-0 relative" ref={carePopupRef}>
        {role !== 'viewer' && (
          <button
            onClick={onSearchClick}
            className="w-9 h-9 rounded-lg inline-flex items-center justify-center hover:bg-forest-700/[0.06] active:bg-forest-700/[0.10] transition-colors text-forest-600"
            title="Ieškoti augalo"
          >
            <Search size={18} />
          </button>
        )}

        {/* Care notifications — du pill'ai (water forest, fert terracotta) */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowCarePopup(v => !v)}
            className={`inline-flex items-center gap-1 h-7 px-2 rounded-full transition-colors active:scale-95 ${
              careWaterCount > 0
                ? (showCarePopup ? 'bg-forest-200 text-forest-800' : 'bg-forest-100 text-forest-700 hover:bg-forest-200')
                : 'bg-bone-300/60 text-forest-300 hover:bg-bone-300'
            }`}
            title={careWaterCount > 0 ? `Laistyti: ${careWaterCount}` : 'Laistyti — viskas tvarkoj'}
          >
            <Droplets size={12} />
            <span className="text-[11px] font-bold tabular-nums leading-none">{careWaterCount}</span>
          </button>
          <button
            onClick={() => setShowCarePopup(v => !v)}
            className={`inline-flex items-center gap-1 h-7 px-2 rounded-full transition-colors active:scale-95 ${
              careFertCount > 0
                ? (showCarePopup ? 'bg-terracotta-200 text-terracotta-600' : 'bg-terracotta-100 text-terracotta-600 hover:bg-terracotta-200')
                : 'bg-bone-300/60 text-forest-300 hover:bg-bone-300'
            }`}
            title={careFertCount > 0 ? `Tręšti: ${careFertCount}` : 'Tręšti — viskas tvarkoj'}
          >
            <FlaskConical size={12} />
            <span className="text-[11px] font-bold tabular-nums leading-none">{careFertCount}</span>
          </button>
        </div>

        {/* Avatar — atidaro ProfileSheet */}
        <button
          onClick={onProfileClick}
          className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-bone-400/50 active:scale-95 transition-transform ml-1"
          title={user?.displayName || user?.email?.split('@')[0] || 'Vartotojas'}
        >
          {user?.photoURL
            ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-forest-500 flex items-center justify-center text-bone text-[12px] font-semibold">
                {initials}
              </div>}
        </button>

        {/* Popup — anchor'ina nuo action cluster'io dešinio krašto (avatar'o
            dešinė = header'io dešinė), atsiranda žemiau visų button'ų. */}
        {showCarePopup && (
          <div className="absolute top-full right-0 mt-2 w-[calc(100vw-2rem)] max-w-[360px] max-h-[70vh] overflow-y-auto bg-bone-50 rounded-2xl shadow-[0_16px_40px_rgba(28,58,42,0.28),0_0_0_1px_rgba(28,58,42,0.06)] border border-bone-400/60 z-[100] p-3">
            <div className="flex items-center gap-2 px-1 pb-2 mb-1 border-b border-bone-400/40">
              <p className="font-display text-sm font-bold text-forest-700 flex-1 tracking-tight">Priežiūros santrauka</p>
              <span className="font-mono text-[10px] font-medium text-forest-400 uppercase tracking-[0.18em]">{careNotificationCount}</span>
            </div>
            {careNotificationCount > 0 ? (
              <CareSummaryList
                plants={carePopupPlants}
                onTap={(plant, list) => { onCareTap?.(plant, list); setShowCarePopup(false) }}
              />
            ) : (
              <p className="text-center text-sm text-forest-500 py-6">Visi augalai laimingi 🌿</p>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
