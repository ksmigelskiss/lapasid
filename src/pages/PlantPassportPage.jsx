import { useState, useEffect, useMemo } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { db, auth } from '../utils/firebase'
import { Droplets, Sun, MapPin, ArrowRight } from 'lucide-react'

// ── Skeleton ──────────────────────────────────────────────────────
function PassportSkeleton() {
  return (
    <div className="min-h-dvh bg-white flex flex-col">
      <div
        className="relative w-full flex-shrink-0 bg-sage-100 animate-pulse"
        style={{ height: '44dvh', maxHeight: '360px' }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="h-7 bg-white/25 rounded-xl w-44 mb-2" />
          <div className="h-4 bg-white/15 rounded-lg w-28" />
        </div>
      </div>
      <div className="flex-1 px-4 pt-5 pb-10 space-y-4 max-w-[430px] mx-auto w-full">
        <div className="flex gap-2">
          {[24, 20].map(w => (
            <div key={w} className={`h-8 bg-gray-100 rounded-xl w-${w} animate-pulse`} />
          ))}
        </div>
        <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
          {[100, 85, 70].map(pct => (
            <div
              key={pct}
              className="h-3 bg-gray-200 rounded animate-pulse"
              style={{ width: `${pct}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Not found / private ───────────────────────────────────────────
function NotFoundView() {
  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center gap-4 px-8 text-center">
      <span className="text-5xl">🔒</span>
      <p className="text-gray-500 text-sm">Augalo pasas nerastas arba privatus</p>
      <a
        href="/"
        className="mt-2 px-6 py-3 bg-sage-500 text-white rounded-2xl text-sm font-medium"
      >
        Grįžti į geliai.app
      </a>
    </div>
  )
}

// ── Sitter / priežiūros vaizdas (Phase 6B backbone) ───────────────
function SitterView({ passport }) {
  const s = passport?.snapshot ?? {}
  return (
    <div className="min-h-dvh bg-white flex flex-col items-center justify-center gap-6 px-6 text-center">
      {s.image ? (
        <img
          src={s.image}
          alt={s.lietuviškas}
          className="w-32 h-32 rounded-full object-cover shadow-lg"
        />
      ) : (
        <div className="w-32 h-32 rounded-full bg-sage-100 flex items-center justify-center text-6xl">
          {s.emoji ?? '🪴'}
        </div>
      )}
      <div>
        <h1 className="text-xl font-bold text-gray-900">{s.lietuviškas}</h1>
        {s.lotyniskas && (
          <p className="text-sm text-gray-400 italic mt-0.5">{s.lotyniskas}</p>
        )}
      </div>
      {/* TODO 6B: SimpleCareCard su "Palaistyta" mygtuku + timeline event */}
      <button className="w-full max-w-xs py-4 bg-sky-500 text-white rounded-2xl text-lg font-bold shadow-md active:scale-95 transition-transform">
        💧 Palaistyta
      </button>
      <p className="text-xs text-gray-400">Prižiūrėtojo nuoroda · geliai.app</p>
    </div>
  )
}

// ── Viešas augalo pasas ────────────────────────────────────────────
function PassportView({ passport }) {
  const s = passport?.snapshot ?? {}
  return (
    <div className="min-h-dvh bg-white flex flex-col">
      {/* Hero */}
      <div
        className="relative w-full flex-shrink-0"
        style={{ height: '44dvh', maxHeight: '360px' }}
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
        <div className="absolute bottom-0 left-0 right-0 p-5 max-w-[430px]">
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

      {/* Content */}
      <div className="flex-1 px-4 pt-5 pb-10 space-y-4 max-w-[430px] mx-auto w-full">
        {/* Care pills */}
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

        {/* Description */}
        {s.aprasymas && (
          <div className="bg-surface rounded-2xl p-4">
            <p className="text-sm text-gray-700 leading-relaxed">{s.aprasymas}</p>
          </div>
        )}

        {/* Origin */}
        {s.kilme && (
          <div className="flex items-center gap-2">
            <MapPin size={13} className="text-gray-400 flex-shrink-0" />
            <p className="text-xs text-gray-500">Kilmė: {s.kilme}</p>
          </div>
        )}

        {/* CTA */}
        <div className="mt-4 bg-sage-50 border border-sage-100 rounded-2xl p-4">
          <p className="text-sm font-semibold text-gray-800 mb-0.5">Stebėk savo augalus</p>
          <p className="text-xs text-gray-500 mb-3 leading-relaxed">
            Laistymų priminimai, ligų diagnostika, AI patarimai — viskas vienoje vietoje.
          </p>
          <a
            href="/"
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-sage-500 text-white rounded-xl text-sm font-semibold"
          >
            Išbandyti geliai.app <ArrowRight size={14} />
          </a>
        </div>

        <p className="text-center text-xs text-gray-400 pt-2">geliai.app</p>
      </div>
    </div>
  )
}

// ── Root komponentas ───────────────────────────────────────────────
/**
 * Vienas puslapis, trys vaizdai priklausomai nuo konteksto:
 *   ?sit=TOKEN  → SitterView  (prižiūrėtojas, 6B)
 *   prisijungęs narys → redirect į pilną app + PlantDetail
 *   kitas       → PassportView (viešas profilis)
 */
export default function PlantPassportPage({ plantId }) {
  const sitToken = useMemo(
    () => new URLSearchParams(window.location.search).get('sit'),
    []
  )

  const [passport, setPassport] = useState(null)
  const [notFound, setNotFound] = useState(false)
  // undefined = dar tikrinama | null = neprisijungęs | object = prisijungęs
  const [user, setUser] = useState(undefined)

  // Startuoja LYGIAGREČIAI: auth klausytojas + paso duomenys
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u ?? null))

    getDoc(doc(db, 'plant-passports', plantId))
      .then(snap => {
        if (!snap.exists() || snap.data().isPublic === false) {
          setNotFound(true)
          return
        }
        setPassport(snap.data())
      })
      .catch(() => setNotFound(true))

    return unsub
  }, [plantId])

  // Redirect savininką/narį → pilnas app (abu duomenys turi būti gauti)
  useEffect(() => {
    if (!passport || user === undefined || !user) return
    getDoc(doc(db, 'collections', passport.collectionId))
      .then(colSnap => {
        if (
          colSnap.exists() &&
          (colSnap.data().members ?? []).includes(user.uid)
        ) {
          sessionStorage.setItem('open-plant', plantId)
          window.location.href = '/'
        }
      })
      .catch(() => {})
  }, [passport, user, plantId])

  // ── Render ────────────────────────────────────────────────────────
  if (notFound) return <NotFoundView />
  if (!passport) return <PassportSkeleton />

  // Prižiūrėtojo nuoroda (Phase 6B)
  if (sitToken) return <SitterView passport={passport} token={sitToken} />

  // Viešas pasas
  return <PassportView passport={passport} />
}
