import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { db, auth } from '../utils/firebase'
import { Droplets, Sun, MapPin, ArrowRight, Loader2 } from 'lucide-react'

/**
 * PlantPassportPage — viešas augalo profilis
 * Atsidaro per URL: geliai.app/p/{plantId}
 *
 * Kontekstas:
 *   owner    → redirect į pilną app su atidarytu PlantDetail
 *   visitor  → viešas profilis su CTA
 */
export default function PlantPassportPage({ plantId }) {
  const [status, setStatus] = useState('loading') // 'loading'|'notfound'|'ready'|'redirecting'
  const [passport, setPassport] = useState(null)

  // 1. Nuskaityti plant-passports/{plantId} (viešas read, be auth)
  useEffect(() => {
    getDoc(doc(db, 'plant-passports', plantId))
      .then(snap => {
        if (!snap.exists() || snap.data().isPublic === false) {
          setStatus('notfound')
          return
        }
        setPassport(snap.data())
        setStatus('ready')
      })
      .catch(() => setStatus('notfound'))
  }, [plantId])

  // 2. Jei vartotojas prisijungęs ir yra kolekcijos narys → redirect į app
  useEffect(() => {
    if (status !== 'ready' || !passport) return
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return
      try {
        const colSnap = await getDoc(doc(db, 'collections', passport.collectionId))
        if (colSnap.exists() && (colSnap.data().members ?? []).includes(user.uid)) {
          setStatus('redirecting')
          window.location.href = `/?openPlant=${plantId}`
        }
      } catch {}
    })
    return unsub
  }, [status, passport, plantId])

  // ── Loading / redirecting ─────────────────────────────────────
  if (status === 'loading' || status === 'redirecting') {
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <img src="/plant_pot.png" className="w-16 h-16 object-contain animate-spin" alt="" />
      </div>
    )
  }

  // ── Not found / private ───────────────────────────────────────
  if (status === 'notfound') {
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

  const s = passport?.snapshot ?? {}

  return (
    <div className="min-h-dvh bg-white flex flex-col">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="relative w-full flex-shrink-0" style={{ height: '44dvh', maxHeight: '360px' }}>
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
            {s.emoji && <span className="text-4xl leading-none flex-shrink-0">{s.emoji}</span>}
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-white leading-tight">{s.lietuviškas}</h1>
              {s.lotyniskas && <p className="text-sm text-white/70 italic mt-0.5">{s.lotyniskas}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────── */}
      <div className="flex-1 px-4 pt-5 pb-10 space-y-4 max-w-[430px] mx-auto w-full">

        {/* Care summary */}
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

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 pt-2">geliai.app</p>
      </div>
    </div>
  )
}
