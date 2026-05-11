import { useState, useRef, useEffect } from 'react'
import { Bell, Leaf, Search } from 'lucide-react'
import { CareSummaryList } from '../CareOverview'

/**
 * DesktopHeader — top juosta desktop'e (≥1024px), pakeičia mobile bottom
 * navigation + Dashboard internal header'į.
 *
 * Layout (designer'io spec'as iš /tmp/geliai-design):
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ [Logo LapasID] | [Priežiūra · sprite + Tikslumas N%]         │
 *   │                  ──── tabs (Augalai N | Biblioteka | Žinynas) ──── │
 *   │                                          [K Stepono ⌄] [🔔] [RJ] │
 *   └──────────────────────────────────────────────────────────────┘
 *
 * 64px high, white-ish bg + blur, border-bottom.
 *
 * Props:
 *   active            — 'dashboard' | 'biblioteka' | 'zinynas'
 *   onTabChange       — (key) => void
 *   counts            — { dashboard, biblioteka, zinynas }
 *   careConfidence    — 0..1
 *   careMode          — bool, current state
 *   onCareToggle      — () => void
 *   collectionName    — string (e.g. "Stepono")
 *   user              — { displayName, email, photoURL }
 *   onProfileClick    — () => void (opens ProfileSheet)
 *   onCollectionClick — () => void (opens collection switcher; placeholder for now)
 *   role              — 'owner' | 'member' | 'viewer'
 */
export default function DesktopHeader({
  active, onTabChange, counts = {},
  user, onProfileClick, role = 'owner',
  careNotificationCount = 0, carePopupPlants = [], onCareTap,
  onSearchClick,
}) {
  // Bell popup state — atidaroma su pranešimų count
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

  const tabs = [
    { id: 'dashboard',  label: 'Augalai',    badge: counts.dashboard },
    { id: 'biblioteka', label: 'Biblioteka', badge: counts.biblioteka },
    { id: 'zinynas',    label: 'Žinynas',    badge: counts.zinynas },
  ]
  const visibleTabs = role === 'viewer' ? tabs.filter(t => t.id === 'dashboard') : tabs

  // Vartotojo iniciatas avatarui (kai nėra photoURL)
  const initials = (user?.displayName || user?.email || '?')
    .split(/[\s@]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()

  return (
    <header className="h-16 flex-shrink-0 flex items-center px-6 gap-4 bg-white/85 backdrop-blur border-b border-gray-200/80 z-30 relative">
      {/* Brand cluster: tik logo (AccuracyButton perkeltas į CareOverview greeting'ą) */}
      <div className="flex items-center gap-3.5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sage-500 flex items-center justify-center text-white">
            <Leaf size={18} />
          </div>
          <span className="text-[19px] font-bold text-sage-700 tracking-tight">LapasID</span>
        </div>
      </div>

      {/* Tabs — absolute pozicija viewport-centered (brand cluster plotis fiksuotas) */}
      <nav className="absolute left-1/2 -translate-x-1/2 flex bg-gray-900/[0.04] rounded-btn p-1 gap-0.5">
        {visibleTabs.map(t => {
          const isActive = active === t.id
          return (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-btn-sm text-[13.5px] font-medium transition-colors ${
                isActive
                  ? 'bg-white text-sage-700 shadow-[0_1px_2px_rgba(20,40,30,0.06),0_0_0_1px_rgba(20,40,30,0.04)]'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t.label}
              {t.badge > 0 && (
                <span className={`text-[11px] font-bold px-1.5 py-px rounded-full ${
                  isActive ? 'bg-sage-100 text-sage-700' : 'bg-sky-100 text-sky-800'
                }`}>
                  {t.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Profile cluster: search + bell + avatar.
          ml-auto stumia į dešinį kraštą (nes nav nebėra flex-grabbing). */}
      <div className="ml-auto flex items-center gap-2 flex-shrink-0">
        {role !== 'viewer' && (
          <button
            onClick={onSearchClick}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-lg hover:bg-gray-900/[0.05] transition-colors text-gray-600"
            title="Ieškoti augalo"
          >
            <Search size={16} />
            <span className="text-sm font-medium">Ieškoti</span>
          </button>
        )}
        {/* Notifications bell — atidaro priežiūros santrauką su pranešimų count badge */}
        <div className="relative" ref={carePopupRef}>
          <button
            onClick={() => setShowCarePopup(v => !v)}
            className={`w-9 h-9 rounded-lg inline-flex items-center justify-center transition-colors ${
              showCarePopup ? 'bg-sage-100 text-sage-700' : 'hover:bg-gray-900/[0.05] text-gray-600'
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

          {/* Popup — priežiūros santrauka pagal sekcijas (laistymas / tręšimas / dormancy) */}
          {showCarePopup && (
            <div className="absolute top-full right-0 mt-2 w-[360px] max-h-[70vh] overflow-y-auto bg-white rounded-2xl shadow-[0_12px_32px_rgba(20,40,30,0.18)] border border-gray-100 z-50 p-3">
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
          className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-white shadow-[0_0_0_1px_rgba(20,40,30,0.06)] active:scale-95 transition-transform"
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
