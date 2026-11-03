import { useState, useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { Printer, Share2, Check, ArrowLeft } from 'lucide-react'
import { db } from '../utils/firebase'
import ToxCard from '../components/sauga/ToxCard'

/**
 * ToxCardPage — viešas toksikologinės kortelės puslapis: /t/{plantId}
 *
 * Mirror'ina PlantPassportPage pattern'ą: fetch'ina `plant-passports/{id}`
 * snapshot'ą (tik tapatybė — lotyniškas/lietuviškas), o toksinų duomenys
 * resolve'inami iš bundled JSON (resolveToxinProfile). Household nežinomas
 * (viešas) → kortelė rodo pilną rūšių vaizdą medikui.
 *
 * Spausdinimui — `.toxcard-print` root klasė (žr. index.css @media print).
 */

function Skeleton() {
  return (
    <div className="min-h-dvh bg-white flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-forest-200 border-t-forest-600 rounded-full animate-spin" />
    </div>
  )
}

function NotFoundView() {
  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center gap-4 px-8 text-center">
      <span className="text-5xl">🔒</span>
      <p className="text-forest-500 text-sm">Augalo kortelė nerasta arba privati</p>
      <a href="/" className="mt-2 px-6 py-3 bg-forest-700 text-bone-50 rounded-btn text-sm font-medium">Grįžti į LapasID</a>
    </div>
  )
}

export default function ToxCardPage({ plantId }) {
  const [passport, setPassport] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    getDoc(doc(db, 'plant-passports', plantId))
      .then(snap => {
        if (!snap.exists() || snap.data().isPublic === false) { setNotFound(true); return }
        setPassport(snap.data())
      })
      .catch(() => setNotFound(true))
  }, [plantId])

  if (notFound) return <NotFoundView />
  if (!passport) return <Skeleton />

  const snap = passport.snapshot ?? {}
  const plant = {
    lotyniskas: snap.lotyniskas ?? null,
    lietuviškas: snap.lietuviškas ?? null,
    emoji: snap.emoji ?? null,
    sinonimai: [],
    englishNames: [],
  }

  const handlePrint = () => window.print()
  const handleShare = async () => {
    const url = window.location.href
    const title = `Toksikologinė kortelė — ${plant.lietuviškas || plant.lotyniskas || 'augalas'}`
    if (navigator.share) {
      try { await navigator.share({ title, url }); return } catch (e) { if (e?.name === 'AbortError') return }
    }
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
  }

  return (
    <div className="toxcard-print min-h-dvh bg-white">
      <div className="toxcard-no-print sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-bone-400/40">
        <div className="max-w-[640px] mx-auto px-4 py-2.5 flex items-center gap-2">
          <a href="/" className="w-10 h-10 bg-bone-300/60 hover:bg-bone-400/60 rounded-btn flex items-center justify-center text-forest-700 transition-colors flex-shrink-0" aria-label="Grįžti">
            <ArrowLeft size={16} />
          </a>
          <span className="flex-1 font-mono text-[10px] uppercase tracking-[0.18em] text-forest-500 truncate">Toksikologinė kortelė</span>
          <button onClick={handleShare} className="h-10 px-3 rounded-btn border border-bone-400/60 bg-bone-50 hover:bg-bone-100 text-forest-700 text-sm font-medium inline-flex items-center gap-1.5 transition-colors">
            {copied ? <Check size={15} className="text-forest-600" /> : <Share2 size={15} />}
            <span className="hidden sm:inline">{copied ? 'Nukopijuota' : 'Dalintis'}</span>
          </button>
          <button onClick={handlePrint} className="h-10 px-3 rounded-btn bg-forest-700 hover:bg-forest-800 text-bone-50 text-sm font-medium inline-flex items-center gap-1.5 transition-colors">
            <Printer size={15} />
            <span className="hidden sm:inline">Spausdinti</span>
          </button>
        </div>
      </div>
      <ToxCard plant={plant} />
    </div>
  )
}
