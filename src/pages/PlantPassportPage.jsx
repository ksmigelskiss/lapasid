import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { db, auth } from '../utils/firebase'
import PlantCareCard from '../components/PlantCareCard'

/**
 * PlantPassportPage — plono sluoksnio maršrutizatorius
 *
 * Paraleliaus fetch: passport duomenys + auth būsena kartu.
 * Kai abu gauti → perduoda PlantCareCard, kuris valdo visą UX.
 * Auto-redirect pašalintas: nariai irgi mato CareCard su "Atidaryti kortelę" opcija.
 */

function PassportSkeleton() {
  return (
    <div className="min-h-dvh bg-white flex flex-col">
      <div
        className="relative w-full flex-shrink-0 bg-sage-100 animate-pulse"
        style={{ height: '40dvh', maxHeight: '320px' }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="h-7 bg-white/25 rounded-xl w-44 mb-2" />
          <div className="h-4 bg-white/15 rounded-lg w-28" />
        </div>
      </div>
      <div className="flex-1 px-4 pt-5 pb-10 space-y-4 max-w-[430px] mx-auto w-full">
        <div className="flex gap-2">
          <div className="h-8 w-24 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-8 w-20 bg-gray-100 rounded-xl animate-pulse" />
        </div>
        <div className="space-y-2">
          {[100, 85, 70].map(w => (
            <div
              key={w}
              className="h-3 bg-gray-100 rounded animate-pulse"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
        <div className="h-14 bg-sky-100 rounded-2xl animate-pulse mt-4" />
      </div>
    </div>
  )
}

function NotFoundView() {
  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center gap-4 px-8 text-center">
      <span className="text-5xl">🔒</span>
      <p className="text-gray-500 text-sm">Augalo pasas nerastas arba privatus</p>
      <a
        href="/"
        className="mt-2 px-6 py-3 bg-sage-500 text-white rounded-2xl text-sm font-medium"
      >
        Grįžti į LapasID
      </a>
    </div>
  )
}

export default function PlantPassportPage({ plantId }) {
  const [passport, setPassport] = useState(null)
  const [notFound, setNotFound] = useState(false)
  // undefined = dar tikrinama | null = neprisijungęs | object = prisijungęs
  const [user, setUser] = useState(undefined)

  // Paraleliaus fetch: auth + paso duomenys
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

  if (notFound) return <NotFoundView />

  // Laukiame kol abu (passport + auth) bus gauti — vengiame "flash" efekto
  if (!passport || user === undefined) return <PassportSkeleton />

  return <PlantCareCard passport={passport} plantId={plantId} user={user} />
}
