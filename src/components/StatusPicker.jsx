import { ChevronDown, Leaf, Thermometer, ShieldAlert, Ghost } from 'lucide-react'
import { STATUS_OPTIONS, STATUS, getStatusMeta } from '../constants/plant'

// Semantinės ikonos vietoj generic spalvotų dot'ų (brandbook vocabulary).
// Tie patys ikonai naudojami timeline status changes — vientisas patternas.
const STATUS_ICON = {
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

export function StatusMenu({ status, section, onSelect, onClose }) {
  const options = STATUS_OPTIONS.filter(opt => section === 'auginama' || opt.key !== 'numire')
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 bottom-full mb-2 bg-bone rounded-2xl shadow-[0_12px_32px_rgba(28,58,42,0.18)] border border-bone-400/50 overflow-hidden z-[200] min-w-[180px]">
        <p className="font-mono text-[9.5px] font-medium text-forest-500 uppercase tracking-[0.18em] px-3 pt-2.5 pb-1.5">Būsena</p>
        <div className="px-1 pb-1 space-y-px">
          {options.map(opt => {
            const Icon = STATUS_ICON[opt.key] ?? Leaf
            const isActive = status === opt.key
            return (
              <button
                key={opt.key}
                onClick={() => onSelect(opt.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors ${
                  isActive ? `${opt.bg} ${opt.text}` : 'text-forest-600 hover:bg-bone-300/60'
                }`}
              >
                <Icon size={14} className="flex-shrink-0" />
                <span className="font-display text-sm font-semibold tracking-tight">{opt.label}</span>
                {isActive && <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.14em] opacity-60">aktyvus</span>}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
