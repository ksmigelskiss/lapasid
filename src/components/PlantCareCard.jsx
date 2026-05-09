import { useState } from 'react'
import { Sun, Droplets, ChevronRight } from 'lucide-react'

/**
 * PlantCareCard — NFC paso modulis
 *
 * Tas pats komponentas visiems lankytojams, skirtingas turinys:
 *   user === null  → trumpa info + tik "Palaistyta"
 *   user !== null  → ta pati info + "Trąšos" + "Atidaryti kortelę"
 */

async function recordEvent(plantId, eventType) {
  const res = await fetch('/api/passport/water', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plantId, eventType }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export default function PlantCareCard({ passport, plantId, user }) {
  const s = passport?.snapshot ?? {}

  const [watered,    setWatered]    = useState(false)
  const [fertilized, setFertilized] = useState(false)
  const [busy,       setBusy]       = useState(null) // 'watering' | 'fertilizing' | null
  const [error,      setError]      = useState(null)

  async function handleAction(type) {
    if (busy) return
    setBusy(type)
    setError(null)
    try {
      await recordEvent(plantId, type)
      if (type === 'watering')    setWatered(true)
      if (type === 'fertilizing') setFertilized(true)
    } catch {
      setError('Nepavyko įrašyti. Bandyk dar kartą.')
    } finally {
      setBusy(null)
    }
  }

  function openInApp() {
    sessionStorage.setItem('open-plant', plantId)
    window.location.href = '/'
  }

  return (
    <div className="min-h-dvh bg-white flex flex-col">

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <div
        className="relative w-full flex-shrink-0"
        style={{ height: '40dvh', maxHeight: '320px' }}
      >
        {s.image ? (
          <img
            src={s.image}
            alt={s.lietuviškas}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-sage-100 flex items-center justify-center text-8xl">
            {s.emoji ?? '🪴'}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="flex items-end gap-3">
            {s.emoji && (
              <span className="text-4xl leading-none flex-shrink-0">{s.emoji}</span>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-white leading-tight">
                {s.lietuviškas}
              </h1>
              {s.lotyniskas && (
                <p className="text-sm text-white/70 italic mt-0.5">{s.lotyniskas}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────── */}
      <div className="flex-1 px-4 pt-5 pb-10 space-y-4 max-w-[430px] mx-auto w-full">

        {/* Priežiūros pilulės */}
        <div className="flex flex-wrap gap-2">
          {s.sviesa?.lygis && (
            <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 rounded-xl px-3 py-1.5 text-xs font-medium">
              <Sun size={13} className="text-amber-500" />
              {s.sviesa.lygis}
            </span>
          )}
          {s.vanduo?.lygis && (
            <span className="inline-flex items-center gap-1.5 bg-sky-50 text-sky-700 rounded-xl px-3 py-1.5 text-xs font-medium">
              <Droplets size={13} className="text-sky-500" />
              {s.vanduo.lygis}
            </span>
          )}
          {s.laistymasIntervalas?.vasara && (
            <span className="inline-flex items-center gap-1.5 bg-surface text-gray-600 rounded-xl px-3 py-1.5 text-xs font-medium">
              💧 Kas {s.laistymasIntervalas.vasara} d.
            </span>
          )}
        </div>

        {/* Aprašymas */}
        {s.aprasymas && (
          <p className="text-sm text-gray-600 leading-relaxed">{s.aprasymas}</p>
        )}

        {/* ── Veiksmai ─────────────────────────────────────────────── */}
        <div className="pt-2 space-y-3">

          {/* Pagrindiniai mygtukai */}
          <div className="flex gap-3">

            {/* Laistymas — visada matomas */}
            <button
              onClick={() => handleAction('watering')}
              disabled={!!busy || watered}
              className={`flex-1 py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-all active:scale-95 ${
                watered
                  ? 'bg-green-50 text-green-600'
                  : 'bg-sky-500 text-white shadow-md'
              }`}
            >
              {watered
                ? '✓ Palaistyta'
                : busy === 'watering'
                ? '...'
                : '💧 Palaistyta'}
            </button>

            {/* Trąšos — tik auth vartotojams */}
            {user && (
              <button
                onClick={() => handleAction('fertilizing')}
                disabled={!!busy || fertilized}
                className={`flex-1 py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-all active:scale-95 ${
                  fertilized
                    ? 'bg-green-50 text-green-600'
                    : 'bg-emerald-500 text-white shadow-md'
                }`}
              >
                {fertilized
                  ? '✓ Įrašyta'
                  : busy === 'fertilizing'
                  ? '...'
                  : '🌿 Trąšos'}
              </button>
            )}
          </div>

          {/* Klaida */}
          {error && (
            <p className="text-xs text-red-500 text-center">{error}</p>
          )}

          {/* Auth: atidaryti pilną kortelę */}
          {user && (
            <button
              onClick={openInApp}
              className="w-full py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-medium flex items-center justify-center gap-1.5 active:bg-gray-50 transition-colors"
            >
              🌱 Atidaryti kortelę <ChevronRight size={14} />
            </button>
          )}

          {/* Be auth: diskretus footer */}
          {!user && (
            <p className="text-center text-xs text-gray-400 pt-2">geliai.app</p>
          )}
        </div>
      </div>
    </div>
  )
}
