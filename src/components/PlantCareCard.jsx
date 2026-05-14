import { useState, useEffect, useRef } from 'react'
import { Sun, Droplets, ChevronRight, FlaskConical, Leaf, Sprout } from 'lucide-react'
import PostFertilizePrompt from './PostFertilizePrompt'
import PlantImage from './brand/PlantImage'

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

// ── Editorial status block (Laistymas / Tręšimas) ──────────────
// Brandbook v1.0: mono caps section header + label/value rows (no colored
// bg). Overdue accent via terracotta border-l. Recently-done accent via
// forest border-l.

function StatusBlock({ icon, title, lastDate, intervalDays, nextDate, daysUntil, isOverdue, isDone, tone }) {
  // tone: 'forest' (water) | 'terracotta' (fert)
  const accentColor = isOverdue ? 'border-terracotta' : isDone ? 'border-forest-500' : 'border-bone-400/60'
  const titleColor = tone === 'terracotta' ? 'text-terracotta-600' : 'text-forest-700'
  const iconColor  = tone === 'terracotta' ? 'text-terracotta-500' : 'text-forest-500'

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <div className={iconColor}>{icon}</div>
        <h3 className={`font-display text-base font-semibold tracking-tight ${titleColor}`}>{title}</h3>
      </div>
      <div className={`pl-3 border-l-2 ${accentColor} space-y-1`}>
        {isDone && (
          <p className="text-sm font-semibold text-forest-700">✓ Šiandien</p>
        )}
        {isOverdue && !isDone && daysUntil != null && (
          <p className="text-sm font-semibold text-terracotta-600">Vėluoja {Math.abs(daysUntil)} d.</p>
        )}
        {lastDate && (
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.16em]">Paskutinis</span>
            <span className="text-sm text-forest-700 tabular-nums">{fmtDate(lastDate)}</span>
          </div>
        )}
        {intervalDays != null && (
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.16em]">Rekomenduojama</span>
            <span className="text-sm text-forest-700 tabular-nums">kas {intervalDays} d.</span>
          </div>
        )}
        {nextDate && !isOverdue && !isDone && (
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.16em]">Kitas</span>
            <span className="text-sm text-forest-700 tabular-nums">
              {daysUntil === 0 ? 'šiandien' : `po ${daysUntil} d.`} · {fmtDate(nextDate)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function WateringStatus({ snapshot, watered }) {
  const interval = pickInterval(snapshot.laistymasIntervalas)
  if (!interval) return null

  const lastDate = watered
    ? new Date().toISOString().split('T')[0]
    : snapshot.lastWatered

  if (!lastDate) {
    return (
      <StatusBlock
        icon={<Droplets size={20} />}
        title="Laistymas"
        intervalDays={interval}
        tone="forest"
      />
    )
  }

  const since = daysSince(lastDate)
  const until = since != null ? interval - since : null
  const nextIso = new Date(new Date(lastDate + 'T00:00:00').getTime() + interval * 86400000)
    .toISOString().split('T')[0]

  return (
    <StatusBlock
      icon={<Droplets size={20} />}
      title="Laistymas"
      lastDate={lastDate}
      intervalDays={interval}
      nextDate={nextIso}
      daysUntil={until}
      isOverdue={until <= 0 && !watered}
      isDone={watered}
      tone="forest"
    />
  )
}

function FertilizingStatus({ snapshot, fertilized }) {
  const interval = snapshot.laistymasIntervalas?.tresimasIntervalas ?? null
  const fertInterval = interval ?? snapshot.fertIntervalas ?? null
  if (!fertInterval && !snapshot.lastFertilized) return null

  const lastDate = fertilized
    ? new Date().toISOString().split('T')[0]
    : snapshot.lastFertilized

  if (!lastDate) return null

  const since = daysSince(lastDate)
  const until = (since != null && fertInterval) ? fertInterval - since : null
  const nextIso = fertInterval
    ? new Date(new Date(lastDate + 'T00:00:00').getTime() + fertInterval * 86400000)
        .toISOString().split('T')[0]
    : null

  return (
    <StatusBlock
      icon={<Leaf size={20} />}
      title="Tręšimas"
      lastDate={lastDate}
      intervalDays={fertInterval}
      nextDate={nextIso}
      daysUntil={until}
      isOverdue={until != null && until <= 0 && !fertilized}
      isDone={fertilized}
      tone="terracotta"
    />
  )
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
    <div className="min-h-dvh bg-app flex flex-col">

      {/* ── Hero — editorial: clean photo (3:2), title block ant bone. ── */}
      {s.image ? (
        <div className="w-full aspect-[3/2] overflow-hidden bg-bone-300 flex-shrink-0">
          <PlantImage url={s.image} alt={s.lietuviškas} size="detail" eager className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-full aspect-[3/2] flex items-center justify-center text-8xl bg-bone-300 flex-shrink-0">
          {s.emoji ?? '🪴'}
        </div>
      )}

      {/* ── Content ───────────────────────────────────────────────── */}
      <div className="flex-1 px-5 pt-5 pb-10 space-y-5 max-w-[430px] mx-auto w-full">

        {/* Title block */}
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-forest-800 leading-tight">
            {s.lietuviškas}
          </h1>
          {s.lotyniskas && (
            <p className="text-sm text-forest-500 italic mt-1">{s.lotyniskas}</p>
          )}
        </div>

        {/* Care pills — brand'iškai: Sun terracotta, Water forest, Interval bone-50 mono */}
        {(s.sviesa?.lygis || s.vanduo?.lygis || s.laistymasIntervalas?.vasara) && (
          <div className="flex flex-wrap gap-2">
            {s.sviesa?.lygis && (
              <span className="inline-flex items-center gap-1.5 bg-terracotta-50 text-terracotta-600 rounded-full px-3 py-1 text-xs font-semibold">
                <Sun size={12} className="text-terracotta-400" />
                {s.sviesa.lygis}
              </span>
            )}
            {s.vanduo?.lygis && (
              <span className="inline-flex items-center gap-1.5 bg-forest-50 text-forest-700 rounded-full px-3 py-1 text-xs font-semibold">
                <Droplets size={12} className="text-forest-500" />
                {s.vanduo.lygis}
              </span>
            )}
            {s.laistymasIntervalas?.vasara && (
              <span className="inline-flex items-center gap-1.5 bg-bone-50 text-forest-600 rounded-full px-3 py-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] border border-bone-400/40">
                kas {s.laistymasIntervalas.vasara} d.
              </span>
            )}
          </div>
        )}

        {/* Aprašymas */}
        {s.aprasymas && (
          <p className="text-sm text-forest-600 leading-relaxed">{s.aprasymas}</p>
        )}

        {/* Status blokai — editorial */}
        <WateringStatus snapshot={s} watered={watered} />
        <FertilizingStatus snapshot={s} fertilized={fertilized} />

        {/* ── Veiksmai ─────────────────────────────────────────────── */}
        <div className="pt-2 space-y-3">

          {postFert ? (
            <PostFertilizePrompt count={1} onPalasciau={onPalasciau} onNelasciau={onNelasciau} />
          ) : (
          <div className="flex gap-3">

            {/* Laistymas — forest brand */}
            <button
              onClick={onWaterTap}
              disabled={watered}
              className={`flex-1 h-12 flex items-center justify-center gap-1.5 rounded-2xl font-bold text-sm transition-colors ${
                watered
                  ? 'bg-forest-100 text-forest-700'
                  : confirmType === 'watering'
                  ? 'bg-forest-700 text-bone active:bg-forest-800'
                  : 'bg-forest-600 text-bone active:bg-forest-700'
              }`}
            >
              {watered ? (
                <span>✓ Laistyta</span>
              ) : (
                <>
                  <Droplets size={16} />
                  <span>
                    {confirmType === 'watering' ? `Tikrai? (${countdown})` : 'Laistyti'}
                  </span>
                </>
              )}
            </button>

            {/* Trąšos — terracotta brand. Tik auth vartotojams */}
            {user && (
              <button
                onClick={onFertilizeTap}
                disabled={fertilized}
                className={`flex-1 h-12 flex items-center justify-center gap-1.5 rounded-2xl font-bold text-sm transition-colors ${
                  fertilized
                    ? 'bg-forest-100 text-forest-700'
                    : confirmType === 'fertilizing'
                    ? 'bg-terracotta-600 text-bone active:bg-terracotta-600'
                    : 'bg-terracotta text-bone active:bg-terracotta-500'
                }`}
              >
                {fertilized ? (
                  <span>✓ Patręšta</span>
                ) : (
                  <>
                    <FlaskConical size={16} />
                    <span>
                      {confirmType === 'fertilizing' ? `Tikrai? (${countdown})` : 'Tręšti'}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
          )}

          {/* Klaida — terracotta accent */}
          {error && (
            <p className="text-xs text-terracotta-600 text-center">{error}</p>
          )}

          {/* Auth: atidaryti pilną kortelę */}
          {user && (
            <button
              onClick={openInApp}
              className="w-full py-3 rounded-2xl border border-bone-400/50 text-forest-600 text-sm font-semibold flex items-center justify-center gap-1.5 active:bg-bone-300/40 transition-colors"
            >
              <Sprout size={14} /> Atidaryti kortelę <ChevronRight size={14} />
            </button>
          )}

          {/* Be auth: diskretus footer */}
          {!user && (
            <p className="text-center font-mono text-[10px] uppercase tracking-[0.18em] text-forest-400 pt-2">lapasid.lt</p>
          )}
        </div>
      </div>
    </div>
  )
}
