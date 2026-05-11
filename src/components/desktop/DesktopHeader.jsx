import { useState, useRef, useEffect } from 'react'
import { Search, Droplets, FlaskConical } from 'lucide-react'
import { CareSummaryList } from '../CareOverview'
import T4Icon from '../brand/T4Icon'
import T4Word from '../brand/T4Word'

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
  careNotificationCount = 0, careWaterCount = 0, careFertCount = 0,
  carePopupPlants = [], onCareTap,
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
    <header className="h-16 flex-shrink-0 flex items-center px-6 gap-4 bg-bone/85 backdrop-blur-xl z-30 relative">
      {/* Brand — T4Icon inverted ("antspaudas": bone mark on forest square) + wordmark.
          h-16 header (64px) → T4Icon 38px palieka 13px tarpą iš viršaus/apačios. */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <T4Icon size={38} ink="#f1ebdd" paper="#1c3a2a" />
        <T4Word size={23} className="text-forest-700" />
      </div>

      {/* Tabs — absolute pozicija viewport-centered */}
      <nav className="absolute left-1/2 -translate-x-1/2 flex bg-gray-900/[0.04] rounded-btn p-1 gap-0.5">
        {visibleTabs.map(t => {
          const isActive = active === t.id
          return (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-btn-sm text-[13.5px] font-medium transition-colors ${
                isActive
                  ? 'bg-bone-50 text-forest-700 shadow-[0_1px_2px_rgba(28,58,42,0.06),0_0_0_1px_rgba(28,58,42,0.04)]'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {t.label}
              {t.badge > 0 && (
                <span className={`font-mono text-[10px] font-medium px-1.5 py-px rounded-full ${
                  isActive ? 'bg-forest-100 text-forest-700' : 'bg-bone-300 text-forest-600'
                }`}>
                  {t.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Profile cluster: search + bell + avatar */}
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
        {/* Care notifications — du pill'ai vietoj bell (water forest, fert terracotta).
            Vienodas onClick atidaro popup'ą su visu santrauku. */}
        <div className="relative flex items-center gap-1.5" ref={carePopupRef}>
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

          {/* Popup — fixed pozicija nuo viewport'o kraštinės, kad nepriklausytų nuo
              trigger pill'ų vietos header'yje (atskiri matavimai mobile/desktop'e). */}
          {showCarePopup && (
            <div className="fixed top-[72px] right-6 w-[360px] max-h-[70vh] overflow-y-auto bg-bone rounded-2xl shadow-[0_12px_32px_rgba(28,58,42,0.18)] border border-bone-400/60 z-50 p-3">
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
        {/* Avatar */}
        <button
          onClick={onProfileClick}
          className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-bone-400/50 active:scale-95 transition-transform"
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
