import { ChevronDown } from 'lucide-react'
import { STATUS_OPTIONS, getStatusMeta } from '../constants/plant'

export function StatusButton({ status, onClick, variant = 'dark' }) {
  const meta = getStatusMeta(status)
  const className = variant === 'dark'
    ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md text-bone active:bg-black/55 transition-colors'
    : `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mt-0.5 transition-colors ${meta.bg} ${meta.text}`

  return (
    <button onClick={onClick} className={className}>
      {!meta.hideDot && <span className={`w-2 h-2 rounded-full ${meta.dot}`} />}
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
      <div className="absolute right-0 bottom-full mb-1.5 bg-bone rounded-2xl shadow-[0_12px_32px_rgba(28,58,42,0.18)] border border-bone-400/50 p-1.5 z-[200] min-w-[140px]">
        {options.map(opt => (
          <button
            key={opt.key}
            onClick={() => onSelect(opt.key)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
              opt.hideDot ? `${opt.bg} ${opt.text}` :
              status === opt.key ? `${opt.bg} ${opt.text}` : 'text-forest-600 hover:bg-bone-300/60'
            }`}
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${opt.hideDot ? 'invisible' : opt.dot}`} />
            {opt.label}
          </button>
        ))}
      </div>
    </>
  )
}
