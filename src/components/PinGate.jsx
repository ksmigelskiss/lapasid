import { useState } from 'react'
import { motion } from 'framer-motion'
import { tryUnlock, hasPin, setPin, isUnlocked } from '../utils/pinLock'

// ── Setup screen — shown when no PIN is set yet ────────────────
function PinSetup({ onDone }) {
  const [step, setStep]     = useState('enter')   // 'enter' | 'confirm'
  const [first, setFirst]   = useState('')
  const [current, setCurrent] = useState('')
  const [error, setError]   = useState('')

  const append = async (d) => {
    if (current.length >= 4) return
    const next = current + d
    setCurrent(next)
    if (next.length < 4) return

    // Auto-advance on 4th digit
    if (step === 'enter') {
      setTimeout(() => {
        setFirst(next)
        setCurrent('')
        setStep('confirm')
        setError('')
      }, 120)
    } else {
      if (next !== first) {
        setTimeout(() => {
          setError('PIN nesutampa. Bandyk dar kartą.')
          setCurrent('')
          setStep('enter')
          setFirst('')
        }, 120)
      } else {
        await setPin(next)
        onDone()
      }
    }
  }

  const del = () => { setCurrent(c => c.slice(0, -1)); setError('') }

  return (
    <PinLayout
      title={step === 'enter' ? 'Nustatyti PIN' : 'Pakartok PIN'}
      subtitle={step === 'enter' ? 'Pasirink 4 skaitmenų PIN kodą' : 'Įvesk tą patį PIN dar kartą'}
      value={current}
      error={error}
      onAppend={append}
      onDelete={del}
    />
  )
}

// ── Unlock screen ──────────────────────────────────────────────
function PinUnlock({ onUnlocked }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)

  const append = d => {
    if (value.length >= 4) return
    const next = value + d
    setValue(next)
    if (next.length === 4) verify(next)
  }

  const del = () => { setValue(v => v.slice(0, -1)); setError('') }

  const verify = async (pin) => {
    const ok = await tryUnlock(pin)
    if (ok) {
      onUnlocked()
    } else {
      setShake(true)
      setError('Neteisingas PIN')
      setTimeout(() => { setValue(''); setShake(false) }, 600)
    }
  }

  return (
    <PinLayout
      title="Įveskite PIN"
      subtitle="Atsiminta 30 dienų šiame įrenginyje"
      value={value}
      error={error}
      shake={shake}
      onAppend={append}
      onDelete={del}
      onSubmit={() => value.length === 4 && verify(value)}
      submitLabel="Atrakinti"
    />
  )
}

// ── Shared layout ──────────────────────────────────────────────
function PinLayout({ title, subtitle, value, error, shake, onAppend, onDelete }) {
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'del']

  return (
    <div className="fixed inset-0 z-[200] bg-app flex flex-col items-center justify-center px-8 safe-top safe-bottom">
      <motion.div
        className="flex flex-col items-center gap-8 w-full max-w-[320px]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Icon + title */}
        <div className="text-center space-y-1">
          <img src="/plant_pot.png" className="w-14 h-14 object-contain mx-auto mb-3 opacity-80" alt="" />
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>

        {/* Dots */}
        <motion.div
          className="flex gap-4"
          animate={shake ? { x: [-8, 8, -8, 8, 0] } : {}}
          transition={{ duration: 0.4 }}
        >
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                i < value.length
                  ? 'bg-sage-500 border-sage-500 scale-110'
                  : 'bg-transparent border-gray-300'
              }`}
            />
          ))}
        </motion.div>

        {/* Error */}
        <div className="h-4">
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {digits.map((d, i) => {
            if (d === null) return <div key={i} />
            if (d === 'del') return (
              <button
                key={i}
                onClick={onDelete}
                className="h-16 rounded-2xl text-gray-600 text-lg font-medium flex items-center justify-center active:bg-gray-100 transition-colors"
              >
                ⌫
              </button>
            )
            return (
              <button
                key={i}
                onClick={() => onAppend(String(d))}
                className="h-16 rounded-2xl bg-white border border-gray-200 text-gray-900 text-xl font-semibold flex items-center justify-center active:bg-surface shadow-sm transition-colors"
              >
                {d}
              </button>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}

// ── Gate — decides which screen to show ───────────────────────
// unlocked state: true = open, false = locked, 'setup' = setting PIN, 'offer' = first-time offer
export default function PinGate({ children }) {
  const [unlocked, setUnlocked] = useState(() => {
    if (!hasPin()) return 'offer'   // first time — offer PIN setup
    if (isUnlocked()) return true   // remembered device
    return false                    // needs PIN entry
  })

  if (unlocked === true)    return children
  if (unlocked === 'setup') return <PinSetup onDone={() => setUnlocked(true)} />
  if (unlocked === false)   return <PinUnlock onUnlocked={() => setUnlocked(true)} />

  // 'offer' — first time, no PIN set yet
  return (
    <div className="fixed inset-0 z-[200] bg-app flex flex-col items-center justify-center px-8">
      <div className="text-center space-y-4 max-w-[320px]">
        <img src="/plant_pot.png" className="w-16 h-16 object-contain mx-auto opacity-80" alt="" />
        <h1 className="text-xl font-bold text-gray-900">Apsaugoti PIN kodu?</h1>
        <p className="text-sm text-gray-500">Nustatyk 4 skaitmenų PIN kad apsaugotum savo augalų kolekciją. Šis įrenginys bus prisimenamas 30 dienų.</p>
        <button
          onClick={() => setUnlocked('setup')}
          className="w-full py-4 rounded-3xl bg-sage-500 text-white font-semibold text-sm"
        >
          Nustatyti PIN
        </button>
        <button
          onClick={() => setUnlocked(true)}
          className="w-full py-3 text-sm text-gray-500"
        >
          Praleisti
        </button>
      </div>
    </div>
  )
}
