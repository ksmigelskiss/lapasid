/**
 * EnrichmentProgress — po Phase 1 save'o vartotojas mato realtime progresą
 * AI Phase 2 enrichment'o, vietoj 30-90s blank wait'o.
 *
 * VAIDMUO: subscribe'inasi į catalog/{slug} per Firestore onSnapshot. Backend
 * (save-plant.js) rašo `enrichmentStage` per kiekvieną milestone'ą:
 *   'started' → 'rag' → 'narrative' → 'image' → 'complete'
 * Šis komponentas vizualiai atspindi pažangą per checklist'ą.
 *
 * UX PROMISE: vartotojas mato KĄ tiksliai sistema dirba, gali laukti
 * informuotai, arba „Tęsti fone" kad uždarytų ir grįžtų į biblioteką.
 *
 * 2026-06-01 — Stage 2/2 implementacijos (Stage 1 = backend staging).
 * Vėliau (Stage 3): progressive content blocks (toxicity pills, care info,
 * watercolor reveal) atsiranda kai konkretūs duomenys tampa available.
 */

import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { db } from '../utils/firebase'
import { catalogDocId } from '../utils/catalog'

const STAGES = [
  { id: 'started',   label: 'Pradedu',                 desc: 'Inicializuoju enrichment...' },
  { id: 'rag',       label: 'Renku šaltinius',         desc: 'PFAF, ASPCA, Wikipedia, Cheng botanikos profile...' },
  { id: 'narrative', label: 'Renku priežiūros info',   desc: 'AI surenka care, problemas, toxiškumą...' },
  { id: 'image',     label: 'Piešiu iliustraciją',     desc: 'Generuoju watercolor (longest step, ~20-40s)...' },
  { id: 'complete',  label: 'Baigta!',                 desc: 'Visa info paruošta — gali atidaryti augalą' },
]

const STAGE_ORDER = STAGES.map(s => s.id)

export default function EnrichmentProgress({ latinName, name, image, onClose, onOpenPlant }) {
  const [stage, setStage] = useState(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const startedAt = useState(() => Date.now())[0]

  // Subscribe to catalog/{slug} for live enrichmentStage updates
  useEffect(() => {
    const slug = catalogDocId(latinName)
    if (!slug) return
    const unsub = onSnapshot(
      doc(db, 'catalog', slug),
      (snap) => {
        if (!snap.exists()) return
        const data = snap.data()
        if (data.enrichmentStage) setStage(data.enrichmentStage)
      },
      (e) => console.warn('[enrichment-progress] subscribe error:', e?.message),
    )
    return unsub
  }, [latinName])

  // Tick elapsed time (visualize progress while waiting for stages)
  useEffect(() => {
    if (stage === 'complete') return
    const t = setInterval(() => setElapsedMs(Date.now() - startedAt), 500)
    return () => clearInterval(t)
  }, [startedAt, stage])

  const currentIdx = stage ? STAGE_ORDER.indexOf(stage) : -1
  const isComplete = stage === 'complete'
  const elapsedSec = Math.floor(elapsedMs / 1000)

  return (
    <div className="px-1 pt-2 pb-4">
      {/* Plant identity (Phase 1 data — visible IŠKART) */}
      <div className="rounded-3xl overflow-hidden bg-bone-50 border border-bone-400/40 p-4 mb-5 flex items-center gap-4">
        {image ? (
          <img
            src={image}
            alt={name}
            className="w-20 h-20 rounded-2xl object-cover bg-bone-200 flex-shrink-0"
          />
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-bone-200 flex items-center justify-center text-3xl flex-shrink-0">
            🌿
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-lg font-semibold tracking-tight text-forest-800 leading-tight">
            {name}
          </h3>
          <p className="text-sm text-forest-500 italic mt-0.5 truncate">{latinName}</p>
          <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-forest-600 mt-1.5">
            {isComplete ? `Baigta per ${elapsedSec}s` : `Vyksta enrichment'as · ${elapsedSec}s`}
          </p>
        </div>
      </div>

      {/* Progress checklist */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3 px-1">
          <p className="font-mono text-[10px] font-semibold text-forest-500 uppercase tracking-[0.18em]">
            Etapai
          </p>
          <div className="h-px flex-1 bg-bone-400/60" />
        </div>
        <ol className="space-y-2.5">
          {STAGES.map((s, i) => {
            const done = i < currentIdx || isComplete
            const active = !isComplete && i === currentIdx
            const pending = !isComplete && i > currentIdx
            return (
              <li key={s.id} className="flex items-start gap-3">
                <span className="w-5 flex-shrink-0 mt-0.5 inline-flex justify-center">
                  {done && <CheckCircle2 className="w-4 h-4 text-forest-500" strokeWidth={2.5} />}
                  {active && <Loader2 className="w-4 h-4 text-forest-700 animate-spin" strokeWidth={2.5} />}
                  {pending && (
                    <span className="block w-2.5 h-2.5 rounded-full border border-bone-400/60 bg-bone-100 mt-1" />
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] leading-tight ${
                    done ? 'text-forest-600 font-medium'
                    : active ? 'text-forest-800 font-semibold'
                    : 'text-forest-400'
                  }`}>
                    {s.label}
                  </p>
                  {active && (
                    <p className="text-[11.5px] text-forest-500 mt-0.5 leading-snug">
                      {s.desc}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      {/* Action buttons */}
      <div className="space-y-2">
        {isComplete ? (
          <>
            <button
              type="button"
              onClick={onOpenPlant}
              className="w-full h-12 rounded-btn font-display text-sm font-semibold text-bone bg-forest-700 hover:bg-forest-800 transition-colors"
            >
              Atidaryti augalą
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full h-11 rounded-btn font-display text-xs font-medium text-forest-500 bg-transparent border border-bone-400/40 hover:bg-bone-300/30 transition-colors"
            >
              Grįžti į biblioteką
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onClose}
              className="w-full h-12 rounded-btn font-display text-sm font-medium text-forest-500 bg-transparent border border-bone-400/40 hover:bg-bone-300/30 transition-colors"
            >
              Tęsti fone
            </button>
            <p className="text-[11px] text-forest-400 text-center px-3 leading-snug">
              Enrichment vyks fone net jei uždarysi — visa info atsiras bibliotekoje per kelias akimirkas.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
