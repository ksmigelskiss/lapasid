import { useState, useRef, useEffect } from 'react'
import { Bell, Search } from 'lucide-react'
import { CareSummaryList } from './CareOverview'
import T4Mark from './brand/T4Mark'
import T4Word from './brand/T4Word'

/**
 * MobileHeader — top toolbar mobile'e (<1024px).
 *
 * Layout:
 *   ┌──────────────────────────────────────┐
 *   │ [LapasID]              [🔍] [🔔] [Av] │
 *   └──────────────────────────────────────┘
 *
 * Bell — toggle popup'as su priežiūros santrauka (CareSummaryList).
 * Tas pats pattern'as kaip DesktopHeader bell — mobile vartotojas pamato
 * notification count badge ir pataptelėjęs gauna pilną care summary,
 * vietoj kad summary nuolat užimtų vietos Dashboard'o virš grid'o.
 */
export default function MobileHeader({
  user, onProfileClick, role = 'owner',
  careNotificationCount = 0, carePopupPlants = [], onCareTap,
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
      className="h-12 flex-shrink-0 flex items-center px-4 gap-2 bg-white/85 backdrop-blur border-b border-gray-200/80 z-30 relative"
      style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(48px + env(safe-area-inset-top))' }}
    >
      {/* Brand cluster — T4Mark + T4Word, kompaktiškas mobile variantas */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <T4Mark size={26} />
        <T4Word size={17} className="text-forest-700" />
      </div>

      {/* Action cluster — search, bell, avatar (ml-auto stumia į dešinį kraštą) */}
      <div className="ml-auto flex items-center gap-1 flex-shrink-0">
        {role !== 'viewer' && (
          <button
            onClick={onSearchClick}
            className="w-9 h-9 rounded-lg inline-flex items-center justify-center hover:bg-gray-900/[0.05] active:bg-gray-900/[0.08] transition-colors text-gray-600"
            title="Ieškoti augalo"
          >
            <Search size={18} />
          </button>
        )}

        {/* Notifications bell — atidaro priežiūros santrauką popup'e */}
        <div className="relative" ref={carePopupRef}>
          <button
            onClick={() => setShowCarePopup(v => !v)}
            className={`w-9 h-9 rounded-lg inline-flex items-center justify-center transition-colors ${
              showCarePopup ? 'bg-sage-100 text-sage-700' : 'hover:bg-gray-900/[0.05] active:bg-gray-900/[0.08] text-gray-600'
            }`}
            title={careNotificationCount > 0
              ? `Priežiūros santrauka (${careNotificationCount})`
              : 'Visi augalai laimingi'}
          >
            <Bell size={18} />
            {careNotificationCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none flex items-center justify-center ring-2 ring-white">
                {careNotificationCount > 99 ? '99+' : careNotificationCount}
              </span>
            )}
          </button>

          {/* Popup — priežiūros santrauka. Mobile'e pinasi nuo dešiniojo krašto,
              max-w garantuoja, kad netampa už ekrano */}
          {showCarePopup && (
            <div className="absolute top-full right-0 mt-2 w-[calc(100vw-2rem)] max-w-[360px] max-h-[70vh] overflow-y-auto bg-white rounded-2xl shadow-[0_12px_32px_rgba(20,40,30,0.18)] border border-gray-100 z-50 p-3">
              <div className="flex items-center gap-2 px-1 pb-2 mb-1 border-b border-gray-100">
                <Bell size={14} className="text-sage-600" />
                <p className="text-sm font-bold text-gray-800 flex-1">Priežiūros santrauka</p>
                <span className="text-[11px] font-semibold text-gray-400">{careNotificationCount}</span>
              </div>
              {careNotificationCount > 0 ? (
                <CareSummaryList
                  plants={carePopupPlants}
                  onTap={(plant, list) => { onCareTap?.(plant, list); setShowCarePopup(false) }}
                />
              ) : (
                <p className="text-center text-sm text-gray-500 py-6">Visi augalai laimingi 🌿</p>
              )}
            </div>
          )}
        </div>

        {/* Avatar — atidaro ProfileSheet */}
        <button
          onClick={onProfileClick}
          className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-white shadow-[0_0_0_1px_rgba(20,40,30,0.06)] active:scale-95 transition-transform ml-1"
          title={user?.displayName || 'Vartotojas'}
        >
          {user?.photoURL
            ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center text-white text-[12px] font-semibold">
                {initials}
              </div>}
        </button>
      </div>
    </header>
  )
}
