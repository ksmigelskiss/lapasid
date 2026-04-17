import { ChevronDown } from 'lucide-react'
import { STATUS_OPTIONS, getStatusMeta } from '../constants/plant'

export function StatusButton({ status, onClick, variant = 'dark' }) {
  const meta = getStatusMeta(status)
  const className = variant === 'dark'
    ? 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-black/30 text-white active:bg-black/50 transition-colors'
    : `flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold mt-0.5 transition-colors ${meta.bg} ${meta.text}`

  return (
    <button onClick={onClick} className={className}>
      {!meta.hideDot && <span className={`w-2 h-2 rounded-full ${meta.dot}`} />}
      {meta.label}
      <ChevronDown size={10} className="opacity-60" />
    </button>
  )
}

export function StatusMenu({ status, section, onSelect, onClose }) {
  const options = STATUS_OPTIONS.filter(opt => section === 'auginama' || opt.key !== 'numire')
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 bottom-full mb-1.5 bg-white rounded-2xl shadow-xl border border-warm-border p-1.5 z-[200] min-w-[140px]">
        {options.map(opt => (
          <button
            key={opt.key}
            onClick={() => onSelect(opt.key)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
              opt.hideDot ? `${opt.bg} ${opt.text}` :
              status === opt.key ? `${opt.bg} ${opt.text}` : 'text-gray-600 hover:bg-surface'
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
