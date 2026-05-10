import { Bell, Leaf, ChevronDown } from 'lucide-react'
import AccuracySprite, { accuracyLabel } from '../AccuracySprite'

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
  active, onTabChange, counts = {}, careConfidence = 0,
  careMode = false, onCareToggle,
  collectionName = '', user, onProfileClick, role = 'owner',
}) {
  const pct   = Math.round((careConfidence ?? 0) * 100)
  const label = accuracyLabel(pct)
  const stage = pct < 25 ? 0 : pct < 50 ? 1 : pct < 75 ? 2 : 3

  // Vienas pill button su dviem vidinėm sekcijom (designer'io spec):
  //   acc-cta  — kairė: sprite + „Priežiūra" (sage)
  //   acc-meta — dešinė: „Tikslumas N%" (stage spalva)
  // Outer wrapper su rounded-full + overflow-hidden, kad inner sekcijos
  // gražiai pilnai užimtų pill formą.

  // INVERTED state'ai (vs. ankstesnė versija):
  //   inactive (default) — ghost: white bg + sage ring outer
  //   active   (careMode) — filled: solid sage outer su white text'u
  // Inner sekcijos (cta + meta) turi tik bg/text spalvas — JOKIO `rounded-*`,
  // kad outer pill'as būtų vientisas (overflow-hidden cut'ina inner kvadratus).

  // Outer wrapper — tik shadow (joks ring/outline). Inactive'e bg-gray-900/[0.04]
  // (kaip tabs nav), active'e solid sage-700 su didesnio shadow'u.
  const wrapperCls = careMode
    ? 'bg-sage-700 shadow-[0_4px_14px_rgba(46,125,82,0.32)]'
    : 'bg-gray-900/[0.04] shadow-[0_1px_2px_rgba(20,40,30,0.06),0_0_0_1px_rgba(20,40,30,0.04)]'

  // Acc-cta (Priežiūra) — kairė sekcija
  const ctaCls = careMode
    ? 'bg-transparent text-white'
    : 'bg-transparent text-sage-700'

  // Acc-meta (Tikslumas N%) — dešinė sekcija; subtle separator border-l (be ring)
  const metaCls = careMode
    ? 'bg-white/12 text-white border-l border-white/15'
    : stage === 0 ? 'bg-transparent text-gray-700 border-l border-gray-900/[0.06]'
    : stage === 1 ? 'bg-transparent text-amber-800 border-l border-gray-900/[0.06]'
    : stage === 2 ? 'bg-transparent text-sage-700 border-l border-gray-900/[0.06]'
    : 'bg-transparent text-sage-800 border-l border-gray-900/[0.06]'

  // Pct badge'as acc-meta viduj
  const pctCls = careMode
    ? 'bg-white/25 text-white'
    : stage === 0 ? 'bg-gray-200 text-gray-800'
    : stage === 1 ? 'bg-amber-200/70 text-amber-900'
    : stage === 2 ? 'bg-sage-200 text-sage-800'
    : 'bg-sage-300/70 text-sage-900'

  const tabs = [
    { id: 'dashboard',  label: 'Augalai',    badge: counts.dashboard },
    { id: 'biblioteka', label: 'Biblioteka', badge: counts.biblioteka },
    { id: 'zinynas',    label: 'Žinynas',    badge: counts.zinynas },
  ]
  const visibleTabs = role === 'viewer' ? tabs.filter(t => t.id === 'dashboard') : tabs

  // Vartotojo iniciatas avatarui (kai nėra photoURL)
  const initials = (user?.displayName || user?.email || '?')
    .split(/[\s@]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()

  // Kolekcijos pip — pirma raidė
  const colPip = (collectionName || 'L')[0].toUpperCase()

  return (
    <header className="h-16 flex-shrink-0 flex items-center px-6 gap-4 bg-white/85 backdrop-blur border-b border-gray-200/80 z-30 relative">
      {/* Brand cluster: logo + accuracy button */}
      <div className="flex items-center gap-3.5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sage-500 flex items-center justify-center text-white">
            <Leaf size={18} />
          </div>
          <span className="text-[19px] font-bold text-sage-700 tracking-tight">LapasID</span>
        </div>
        <div className="w-px h-5 bg-gray-300/60" />
        {role !== 'viewer' && (
          <button
            onClick={onCareToggle}
            className={`h-10 inline-flex items-stretch rounded-full overflow-hidden transition-all active:scale-[0.97] ${wrapperCls}`}
            title={careMode ? 'Išeiti iš priežiūros režimo' : `Priežiūra · ${label} ${pct}%`}
          >
            {/* acc-cta — Priežiūra (kairė); be rounded — outer wrapper duoda formą */}
            <span className={`inline-flex items-center gap-2 pl-3 pr-3.5 ${ctaCls}`}>
              <AccuracySprite pct={pct} size={20} />
              <span className="text-[13.5px] font-bold leading-none tracking-tight">Priežiūra</span>
            </span>
            {/* acc-meta — Tikslumas N% (dešinė); border-l skiria nuo cta */}
            <span className={`inline-flex items-center gap-1.5 pl-3 pr-3.5 ${metaCls}`}>
              <span className="text-[12.5px] font-semibold leading-none">Tikslumas</span>
              <span className={`text-[11px] font-bold leading-none tabular-nums px-1.5 py-0.5 rounded-full ${pctCls}`}>
                {pct}%
              </span>
            </span>
          </button>
        )}
      </div>

      {/* Tabs centered */}
      <nav className="ml-auto mr-auto flex bg-gray-900/[0.04] rounded-full p-1 gap-0.5">
        {visibleTabs.map(t => {
          const isActive = active === t.id
          return (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13.5px] font-medium transition-colors ${
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

      {/* Profile cluster: collection switcher + bell + avatar */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {role !== 'viewer' && (
          <button
            onClick={onProfileClick}
            className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-900/[0.05] transition-colors"
            title="Pakeisti kolekciją"
          >
            <span className="w-6 h-6 rounded-full bg-sage-100 text-sage-700 inline-flex items-center justify-center text-[11px] font-bold">
              {colPip}
            </span>
            <span className="text-sm font-semibold text-gray-900 tracking-tight">{collectionName}</span>
            <ChevronDown size={11} className="text-gray-400" />
          </button>
        )}
        {/* Notifications bell — placeholder, dabar tik vizualinis */}
        <button
          className="w-9 h-9 rounded-lg hover:bg-gray-900/[0.05] inline-flex items-center justify-center text-gray-600 transition-colors"
          title="Pranešimai"
          disabled
        >
          <Bell size={18} />
        </button>
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
