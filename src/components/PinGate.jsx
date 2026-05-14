import { useState } from 'react'
import { motion } from 'framer-motion'
import { tryUnlock, isUnlocked } from '../utils/pinLock'
import T4Icon from './brand/T4Icon'

function PinUnlock({ onUnlocked }) {
  const [value, setValue]   = useState('')
  const [shake, setShake]   = useState(false)
  const [error, setError]   = useState('')

  const append = (d) => {
    if (value.length >= 4) return
    const next = value + d
    setValue(next)
    if (next.length < 4) return
    // Auto-verify on 4th digit
    const ok = tryUnlock(next)
    if (ok) {
      onUnlocked()
    } else {
      setShake(true)
      setError('Neteisingas PIN')
      setTimeout(() => { setValue(''); setShake(false); setError('') }, 600)
    }
  }

  const del = () => { setValue(v => v.slice(0, -1)); setError('') }

  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del']

  return (
    <div className="fixed inset-0 z-[200] bg-app flex flex-col items-center justify-center px-8">
      <motion.div
        className="flex flex-col items-center gap-8 w-full max-w-[320px]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Icon + title */}
        <div className="text-center space-y-1">
          <div className="flex justify-center mb-3 opacity-80">
            <T4Icon size={56} ink="#1c3a2a" paper="transparent" />
          </div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-forest-800">Įveskite PIN</h1>
          <p className="text-sm text-forest-500">Šis įrenginys bus prisimenamas 7 dienas</p>
        </div>

        {/* Dots */}
        <motion.div
          className="flex gap-4"
          animate={shake ? { x: [-8, 8, -8, 8, 0] } : {}}
          transition={{ duration: 0.4 }}
        >
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
              i < value.length ? 'bg-sage-500 border-sage-500 scale-110' : 'bg-transparent border-gray-300'
            }`} />
          ))}
        </motion.div>

        <div className="h-4">
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {digits.map((d, i) => {
            if (d === null) return <div key={i} />
            if (d === 'del') return (
              <button key={i} onClick={del}
                className="h-16 rounded-2xl text-gray-600 text-lg font-medium flex items-center justify-center active:bg-gray-100 transition-colors">
                ⌫
              </button>
            )
            return (
              <button key={i} onClick={() => append(String(d))}
                className="h-16 rounded-2xl bg-white border border-gray-200 text-gray-900 text-xl font-semibold flex items-center justify-center active:bg-surface shadow-sm transition-colors">
                {d}
              </button>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}

export default function PinGate({ children }) {
  const [unlocked, setUnlocked] = useState(() => isUnlocked())

  if (unlocked) return children
  return <PinUnlock onUnlocked={() => setUnlocked(true)} />
}
