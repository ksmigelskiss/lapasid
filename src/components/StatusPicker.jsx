import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { ChevronDown, Leaf, Thermometer, ShieldAlert, Ghost, Check } from 'lucide-react'
import { STATUS_OPTIONS, STATUS, getStatusMeta } from '../constants/plant'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { useDetailHost } from '../contexts/DetailHostContext'

// Semantinės ikonos vietoj generic spalvotų dot'ų (brandbook vocabulary).
// Tie patys ikonai naudojami timeline status changes — vientisas patternas.
// Export'inta, kad PlantDetail hero galėtų naudoti tas pačias ikonas inline.
export const STATUS_ICON = {
  [STATUS.HEALTHY]:    Leaf,
  [STATUS.SICK]:       Thermometer,
  [STATUS.QUARANTINE]: ShieldAlert,
  [STATUS.NUMIRE]:     Ghost,
}

export function StatusButton({ status, onClick, variant = 'dark' }) {
  const meta = getStatusMeta(status)
  const Icon = STATUS_ICON[status] ?? Leaf
  const className = variant === 'dark'
    ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md text-bone active:bg-black/55 transition-colors'
    : `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mt-0.5 transition-colors ${meta.bg} ${meta.text}`

  return (
    <button onClick={onClick} className={className}>
      <Icon size={12} className="flex-shrink-0" />
      <span className="font-display text-xs font-semibold tracking-tight">{meta.label}</span>
      <ChevronDown size={10} className="opacity-60" />
    </button>
  )
}

// 2026-06-01 — StatusMenu refactor'as iš absolute dropdown'o į bottom sheet'ą.
// Konsistentu su ZonePicker pattern'u (žr. ZoneManager.jsx ZonePicker). Anksčiau
// dropdown'o anchor'inimas prie invisible div'o toolbar'e sukeldavo clipping'ą
// kai trigger'is iš ... menu. Bottom sheet visada renderinasi viewport bottom'e —
// no anchor dependency, predictable position, larger touch targets mobile'e.
export function StatusMenu({ status, section, onSelect, onClose }) {
  const options = STATUS_OPTIONS.filter(opt => section === 'auginama' || opt.key !== 'numire')

  // Desktop split panel: portal į RightPanel container'į (sub-modal ant
  // PlantDetail viršaus). Mobile lieka full-screen overlay.
  const isDesktop = useIsDesktop()
  const host = useDetailHost()
  const useDesktopPanel = isDesktop && !!host?.container

  useEffect(() => {
    if (!useDesktopPanel || !host) return
    host.open()
    return () => host.close()
  }, [useDesktopPanel]) // eslint-disable-line react-hooks/exhaustive-deps

  // ESC keyboard shortcut — uždaryti StatusMenu (sub-modal ant PlantDetail).
  useEffect(() => {
    if (!useDesktopPanel) return
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [useDesktopPanel, onClose])

  const tree = (
    <div className={useDesktopPanel
      ? "absolute inset-0 z-[5] flex items-end justify-center"
      : "fixed inset-0 z-[95] flex items-end justify-center"}>
      {/* Backdrop — forest INK */}
      <motion.div
        className="absolute inset-0 bg-forest-800/55 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }} onPointerDown={onClose}
      />
      {/* Sheet — bottom sheet pattern, unified su ZonePicker */}
      <motion.div
        className="relative w-full max-w-[430px] bg-bone-50 rounded-t-4xl px-5 pt-3 pb-8 border-t border-bone-400/40"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        onPointerDown={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pb-3">
          <div className="w-10 h-1 bg-bone-400/60 rounded-full" />
        </div>
        <p className="font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.18em] text-center mb-4">
          Pakeisti būklę
        </p>

        {/* Status list */}
        <div className="space-y-1.5">
          {options.map(opt => {
            const Icon = STATUS_ICON[opt.key] ?? Leaf
            const isActive = status === opt.key
            return (
              <button
                key={opt.key}
                onClick={() => { onSelect(opt.key); onClose?.() }}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-colors ${
                  isActive
                    ? `${opt.bg} ${opt.text}`
                    : 'hover:bg-bone-300 text-forest-700'
                }`}
              >
                <Icon size={16} className="flex-shrink-0" />
                <span className="font-display text-sm font-semibold tracking-tight flex-1 text-left">{opt.label}</span>
                {isActive && <Check size={14} className={opt.text} />}
              </button>
            )
          })}
        </div>
      </motion.div>
    </div>
  )

  if (useDesktopPanel) return createPortal(tree, host.container)
  return tree
}
