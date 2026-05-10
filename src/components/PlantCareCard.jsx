import { useState, useEffect, useRef } from 'react'
import { Sun, Droplets, ChevronRight, FlaskConical, Leaf, Sprout } from 'lucide-react'
import PostFertilizePrompt from './PostFertilizePrompt'

// ── Forecast helpers ──────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('lt-LT', { month: 'short', day: 'numeric' })
}

function daysSince(iso) {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso + 'T00:00:00')) / 86400000)
}

// Pasirenkame intervalo sezoną pagal dabartinį mėnesį
function pickInterval(laistymasIntervalas) {
  if (!laistymasIntervalas) return null
  const m = new Date().getMonth() + 1 // 1–12
  const isWinter = m <= 2 || m >= 11
  return isWinter
    ? (laistymasIntervalas.ziema ?? laistymasIntervalas.vasara ?? null)
    : (laistymasIntervalas.vasara ?? laistymasIntervalas.ziema ?? null)
}

function WateringStatus({ snapshot, watered }) {
  const interval = pickInterval(snapshot.laistymasIntervalas)
  if (!interval) return null

  // Jei ką tik palaistyta šiame session — rodome "✓" būseną
  const lastDate  = watered
    ? new Date().toISOString().split('T')[0]
    : snapshot.lastWatered

  const since = daysSince(lastDate)
  const until = since != null ? interval - since : null

  if (since == null) {
    return (
      <div className="bg-sky-50 border border-sky-100 rounded-2xl px-4 py-3 flex gap-3">
        <Droplets size={22} className="flex-shrink-0 text-sky-400 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-sky-700">Laistymo duomenų nėra</p>
          <p className="text-[11px] text-sky-600 mt-0.5">{interval}d intervalas</p>
        </div>
      </div>
    )
  }

  if (until <= 0) {
    return (
      <div className="bg-sky-50 border border-sky-100 rounded-2xl px-4 py-3 flex gap-3">
        <Droplets size={22} className="flex-shrink-0 text-sky-400 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-sky-700">
            {watered ? 'Palaistyta šiandien ✓' : `Laistymas vėluoja ${Math.abs(until)} d.!`}
          </p>
          <p className="text-[11px] text-sky-600 mt-0.5">
            Paskutinis: {fmtDate(lastDate)} · {interval}d intervalas
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-green-50 border border-green-100 rounded-2xl px-4 py-3 flex gap-3">
      <Droplets size={20} className="flex-shrink-0 text-green-400 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-green-700">
          Kitas laistymas: {fmtDate(
            new Date(new Date(lastDate + 'T00:00:00').getTime() + interval * 86400000)
              .toISOString().split('T')[0]
          )}
        </p>
        <p className="text-[11px] text-green-600 mt-0.5">
          {until === 0 ? 'Šiandien!' : `Po ${until} d.`} · {interval}d intervalas
        </p>
      </div>
    </div>
  )
}

function FertilizingStatus({ snapshot, fertilized }) {
  const interval = snapshot.laistymasIntervalas?.tresimasIntervalas ?? null
  // Bandome iš vanduo arba prieziura jei nėra specifinio
  const fertInterval = interval ?? snapshot.fertIntervalas ?? null
  if (!fertInterval && !snapshot.lastFertilized) return null

  const lastDate = fertilized
    ? new Date().toISOString().split('T')[0]
    : snapshot.lastFertilized

  const since = daysSince(lastDate)
  const until = (since != null && fertInterval) ? fertInterval - since : null

  if (!lastDate) return null

  if (until != null && until <= 0) {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 flex gap-3">
        <Leaf size={22} className="flex-shrink-0 text-orange-400 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-orange-700">
            {fertilized ? 'Patręšta šiandien ✓' : `Pamaitink augalėlį — vėluoja ${Math.abs(until)} d.!`}
          </p>
          <p className="text-[11px] text-orange-600 mt-0.5">
            Paskutinis: {fmtDate(lastDate)}{fertInterval ? ` · ${fertInterval}d intervalas` : ''}
          </p>
        </div>
      </div>
    )
  }

  if (lastDate) {
    return (
      <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 flex gap-3">
        <Leaf size={20} className="flex-shrink-0 text-amber-400 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-700">
            {fertilized ? 'Patręšta šiandien ✓' : `Paskutinis tręšimas: ${fmtDate(lastDate)}`}
          </p>
          {until != null && (
            <p className="text-[11px] text-amber-600 mt-0.5">
              Kitas po {until} d.
            </p>
          )}
        </div>
      </div>
    )
  }

  return null
}

/**
 * PlantCareCard — NFC paso modulis
 *
 * Tas pats komponentas visiems lankytojams, skirtingas turinys:
 *   user === null  → trumpa info + tik "Palaistyti"
 *   user !== null  → ta pati info + "Tręšti" + "Atidaryti kortelę"
 *
 * Du tapai su countdown (identiškas Dashboard priežiūros režimui):
 *   1. tap → "Tikrai? (5)" + tamsesnis fonas + countdown
 *   2. tap → įrašo → "✓ Laistyta"
 *   laikas baigiasi → atšaukia, grįžta į pradinę
 */

// events: [{ type: 'watering'|'fertilizing', komentaras?: string }]
async function recordEvents(plantId, events) {
  const res = await fetch('/api/passport/care', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plantId, events }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// Fire-and-forget unmount fallback (kai vartotojas užduoda Tręšti, bet
// nesujaučia ar palaistė, tada uždaro kortelę — fert event'as vis tiek
// įrašomas per sendBeacon, kad nebūtų prarasti).
function recordEventsBeacon(plantId, events) {
  try {
    const blob = new Blob([JSON.stringify({ plantId, events })], { type: 'application/json' })
    navigator.sendBeacon?.('/api/passport/care', blob)
  } catch {}
}

export default function PlantCareCard({ passport, plantId, user }) {
  const s = passport?.snapshot ?? {}

  const [watered,     setWatered]     = useState(false)
  const [fertilized,  setFertilized]  = useState(false)
  const [confirmType, setConfirmType] = useState(null)   // null | 'watering' | 'fertilizing'
  const [countdown,   setCountdown]   = useState(5)
  const [error,       setError]       = useState(null)
  const [postFert,    setPostFert]    = useState(false)
  const timerRef         = useRef(null)
  // pendingFertRef = true reiškia "vartotojas patvirtino tręšimą, bet
  // dar neatsakė Palaisčiau/Nelaisčiau — API call dar nepaleistas".
  // Naudojama unmount fallback'ui per sendBeacon.
  const pendingFertRef   = useRef(false)

  // Countdown — startuoja kai laukiama patvirtinimo
  useEffect(() => {
    if (!confirmType) return
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          setConfirmType(null)
          return 5
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [confirmType])

  function resetConfirm() {
    clearInterval(timerRef.current)
    setConfirmType(null)
    setCountdown(5)
  }

  // Optimistic UI + deferred fert fire:
  // - Watering tap: UI persijungia momentaliai, API fone, revert jei fail.
  // - Fertilizing tap: UI persijungia momentaliai, BET API call atidedamas
  //   kol vartotojas atsako prompt'ą — tada vienoje užklausoje siunčiam
  //   [fert] arba [fert, water] kombinuotai (vietoj 2 atskirų API call'ų).
  //   Unmount fallback (sendBeacon) jei vartotojas uždaro nesujaučęs.
  function commitAction(type) {
    setError(null)
    resetConfirm()
    if (type === 'watering') {
      setWatered(true)
      recordEvents(plantId, [{ type: 'watering' }]).catch(() => {
        setWatered(false)
        setError('Nepavyko įrašyti laistymo. Bandyk dar kartą.')
      })
    } else if (type === 'fertilizing') {
      setFertilized(true)
      setPostFert(true)
      pendingFertRef.current = true   // dar nepaleista, laukiam Palaisčiau/Nelaisčiau
    }
  }

  async function onPalasciau() {
    setError(null)
    setWatered(true)
    setPostFert(false)
    pendingFertRef.current = false
    try {
      // Vienas API call'as su abiem event'ais — fert pirmiausia, kad timeline
      // tvarka būtų teisinga (fertilize → watering).
      await recordEvents(plantId, [
        { type: 'fertilizing' },
        { type: 'watering', komentaras: 'Laistyta po tręšimo' },
      ])
    } catch {
      setFertilized(false)
      setWatered(false)
      setError('Nepavyko įrašyti. Bandyk dar kartą.')
    }
  }

  async function onNelasciau() {
    setPostFert(false)
    pendingFertRef.current = false
    try {
      await recordEvents(plantId, [{ type: 'fertilizing' }])
    } catch {
      setFertilized(false)
      setError('Nepavyko įrašyti tręšimo. Bandyk dar kartą.')
    }
  }

  // Unmount fallback: jei kortelė uždaroma (page nav, tab close) kol fert
  // dar nepatvirtintas — siunčiam per sendBeacon, kad event'as nedingtų.
  useEffect(() => {
    const flushOnHide = () => {
      if (pendingFertRef.current && document.visibilityState === 'hidden') {
        recordEventsBeacon(plantId, [{ type: 'fertilizing' }])
        pendingFertRef.current = false
      }
    }
    document.addEventListener('visibilitychange', flushOnHide)
    return () => {
      document.removeEventListener('visibilitychange', flushOnHide)
      if (pendingFertRef.current) {
        recordEventsBeacon(plantId, [{ type: 'fertilizing' }])
        pendingFertRef.current = false
      }
    }
  }, [plantId])

  function onWaterTap() {
    if (watered) return
    if (confirmType === 'watering') commitAction('watering')
    else { resetConfirm(); setConfirmType('watering'); setCountdown(5) }
  }

  function onFertilizeTap() {
    if (fertilized) return
    if (confirmType === 'fertilizing') commitAction('fertilizing')
    else { resetConfirm(); setConfirmType('fertilizing'); setCountdown(5) }
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
              <Droplets size={13} className="text-sky-400" />
              Kas {s.laistymasIntervalas.vasara} d.
            </span>
          )}
        </div>

        {/* Aprašymas */}
        {s.aprasymas && (
          <p className="text-sm text-gray-600 leading-relaxed">{s.aprasymas}</p>
        )}

        {/* Forecast widgetai */}
        <WateringStatus snapshot={s} watered={watered} />
        <FertilizingStatus snapshot={s} fertilized={fertilized} />

        {/* ── Veiksmai ─────────────────────────────────────────────── */}
        <div className="pt-2 space-y-3">

          {postFert ? (
            <PostFertilizePrompt count={1} onPalasciau={onPalasciau} onNelasciau={onNelasciau} />
          ) : (
          <div className="flex gap-3">

            {/* Laistymas */}
            <button
              onClick={onWaterTap}
              disabled={watered}
              className={`flex-1 h-12 flex items-center justify-center gap-1.5 rounded-xl font-bold text-sm transition-colors active:bg-sky-600 ${
                watered
                  ? 'bg-green-50 text-green-600'
                  : confirmType === 'watering'
                  ? 'bg-sky-700 text-white'
                  : 'bg-sky-500 text-white'
              }`}
            >
              {watered ? (
                <span>✓ Laistyta</span>
              ) : (
                <>
                  <Droplets size={16} className="text-white" />
                  <span>
                    {confirmType === 'watering' ? `Tikrai? (${countdown})` : 'Laistyti'}
                  </span>
                </>
              )}
            </button>

            {/* Trąšos — tik auth vartotojams */}
            {user && (
              <button
                onClick={onFertilizeTap}
                disabled={fertilized}
                className={`flex-1 h-12 flex items-center justify-center gap-1.5 rounded-xl font-bold text-sm transition-colors active:bg-amber-600 ${
                  fertilized
                    ? 'bg-green-50 text-green-600'
                    : confirmType === 'fertilizing'
                    ? 'bg-amber-700 text-white'
                    : 'bg-amber-500 text-white'
                }`}
              >
                {fertilized ? (
                  <span>✓ Patręšta</span>
                ) : (
                  <>
                    <FlaskConical size={16} className="text-white" />
                    <span>
                      {confirmType === 'fertilizing' ? `Tikrai? (${countdown})` : 'Tręšti'}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
          )}

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
              <Sprout size={14} /> Atidaryti kortelę <ChevronRight size={14} />
            </button>
          )}

          {/* Be auth: diskretus footer */}
          {!user && (
            <p className="text-center text-xs text-gray-400 pt-2">lapasid.lt</p>
          )}
        </div>
      </div>
    </div>
  )
}
