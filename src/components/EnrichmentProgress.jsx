/**
 * EnrichmentProgress — po Phase 1 save'o vartotojas mato CONTENT atsirandantį
 * realtime'e, ne abstrakčius stage'us.
 *
 * Filosofija (2026-06-01 redesign):
 *   Vietoj „abstract checklist" su nesuprantamais etapais — rodom KONKREČIAS
 *   informacijos sekcijas (toxicity, care, narrative, watercolor), kurios
 *   užsipildo skeleton'as → real content per fade-in transitions kai tas
 *   konkretus duomenų laukas tampa available catalog'e per onSnapshot.
 *
 *   Vartotojas mato vertę: „aš jau matau toxicity info, nors hero dar piešia".
 *
 * REVEAL ORDER (greitiausiai-prieinama pirmiausia):
 *   1. Identity card (Phase 1)              — INSTANT
 *   2. Toxicity pills (pre-DB ar AI)        — INSTANT ar ~25s
 *   3. Care intervals (laistymas/tresimas)  — ~25s (Sonnet AI tool result)
 *   4. Aprašymas / kilmė                    — ~25s (same)
 *   5. Idomybes / problemos                 — ~25s (same)
 *   6. Hero watercolor (PARALELIAI iš Gemini) — ~30s
 *   7. Complete indicator                   — kai enrichmentStage='complete'
 *
 * Catalog-hit edge case: jei catalog jau turi `laistymasIntervalas` =
 * full data egzistuoja → ProgressView iškart parodys complete state'ą,
 * nelaukia stage transition (kuris niekada neateis).
 */

import { useEffect, useState, useMemo } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { CheckCircle2, Loader2, Camera, Droplet, FlaskConical, BookOpen, Sparkles, AlertTriangle } from 'lucide-react'
import { db } from '../utils/firebase'
import { catalogDocId } from '../utils/catalog'
import PlantImage from './brand/PlantImage'

// ── Skeleton block ───────────────────────────────────────────────
function Skeleton({ className = '', lines = 2 }) {
  return (
    <div className={`space-y-2 animate-pulse ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-3 rounded bg-bone-300/60"
          style={{ width: i === lines - 1 ? '70%' : '100%' }}
        />
      ))}
    </div>
  )
}

// ── Section header (mono-caps + hairline, PlantDetail brandbook) ─
function SectionHeader({ icon: Icon, label, complete }) {
  return (
    <div className="flex items-center gap-2 mb-2 px-1">
      {Icon && <Icon className={`w-3.5 h-3.5 ${complete ? 'text-forest-500' : 'text-forest-300'}`} strokeWidth={2} />}
      <p className={`font-mono text-[10px] font-semibold uppercase tracking-[0.18em] ${complete ? 'text-forest-600' : 'text-forest-400'}`}>
        {label}
      </p>
      <div className="h-px flex-1 bg-bone-400/40" />
      {complete && <CheckCircle2 className="w-3.5 h-3.5 text-forest-500" strokeWidth={2.5} />}
    </div>
  )
}

// ── Content reveal wrapper (fade-in animation) ────────────────────
function Reveal({ show, children }) {
  return (
    <div
      className="transition-all duration-400 ease-out"
      style={{
        opacity: show ? 1 : 0,
        transform: show ? 'translateY(0)' : 'translateY(4px)',
        // Reduce layout jump — collapse height when hidden
        maxHeight: show ? '1000px' : 'auto',
      }}
    >
      {children}
    </div>
  )
}

export default function EnrichmentProgress({ latinName, name, image, onClose, onOpenPlant }) {
  const [catalogData, setCatalogData] = useState(null)
  const [stage, setStage] = useState(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const startedAt = useState(() => Date.now())[0]

  // Subscribe to catalog/{slug} for live data updates
  useEffect(() => {
    const slug = catalogDocId(latinName)
    if (!slug) return
    const unsub = onSnapshot(
      doc(db, 'catalog', slug),
      (snap) => {
        if (!snap.exists()) return
        const data = snap.data()
        setCatalogData(data)
        if (data.enrichmentStage) setStage(data.enrichmentStage)
      },
      (e) => console.warn('[enrichment-progress] subscribe error:', e?.message),
    )
    return unsub
  }, [latinName])

  // Tick elapsed time
  useEffect(() => {
    if (stage === 'complete') return
    const t = setInterval(() => setElapsedMs(Date.now() - startedAt), 500)
    return () => clearInterval(t)
  }, [startedAt, stage])

  // Content availability checks (derived from catalogData)
  const d = catalogData ?? {}
  const hasToxicity = d.savybes?.pavojai?.length > 0 || d.savybes?.pavojingumas?.detales
  const hasCare = !!d.laistymasIntervalas
  const hasNarrative = !!d.aprasymas
  const hasInteresting = Array.isArray(d.idomybes) && d.idomybes.length > 0
  const hasProblems = Array.isArray(d.problemos) && d.problemos.length > 0
  const hasHero = !!d.heroIllustration

  // „Complete" condition: explicit stage OR catalog hit (already has all data)
  const isComplete = stage === 'complete' || (hasCare && hasHero && hasNarrative)
  const elapsedSec = Math.floor(elapsedMs / 1000)

  // Current activity hint (shown subtly at bottom)
  const activityHint = useMemo(() => {
    if (isComplete) return 'Baigta'
    if (!stage || stage === 'started') return 'Pradedu enrichment...'
    if (stage === 'rag') return 'Renku botanikos šaltinius...'
    if (stage === 'narrative') return 'Renku priežiūros patarimus...'
    if (stage === 'image') return 'Piešiu iliustraciją...'
    return 'Vyksta enrichment...'
  }, [stage, isComplete])

  return (
    <div className="px-1 pt-2 pb-4">
      {/* Identity card — visible IŠKART. Hero swap'inasi photo → watercolor
          per PlantImage stale-while-revalidate'ą kai watercolor parsigauna. */}
      <div className="rounded-3xl overflow-hidden bg-bone-50 border border-bone-400/40 p-4 mb-5 flex items-center gap-4">
        <div className="w-20 h-20 rounded-2xl overflow-hidden bg-bone-200 flex-shrink-0">
          {hasHero ? (
            <PlantImage
              url={d.heroThumb || d.heroIllustration}
              alt={name}
              size="thumb"
              eager
              className="w-full h-full object-cover"
            />
          ) : image ? (
            <PlantImage url={image} alt={name} size="thumb" eager className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl">🌿</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-lg font-semibold tracking-tight text-forest-800 leading-tight">
            {name}
          </h3>
          <p className="text-sm text-forest-500 italic mt-0.5 truncate">{latinName}</p>
          <p className="text-[10.5px] font-mono uppercase tracking-[0.14em] text-forest-500/80 mt-1.5 inline-flex items-center gap-1.5">
            {isComplete ? (
              <>
                <CheckCircle2 className="w-3 h-3" strokeWidth={2.5} />
                Baigta · {elapsedSec}s
              </>
            ) : (
              <>
                <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2.5} />
                {elapsedSec}s
              </>
            )}
          </p>
        </div>
      </div>

      {/* ── Toxicity section ──────────────────────────────────── */}
      <div className="mb-5">
        <SectionHeader icon={AlertTriangle} label="Pavojai" complete={hasToxicity || isComplete} />
        <Reveal show={hasToxicity}>
          <div className="text-[13px] text-forest-700 leading-relaxed px-1">
            {d.savybes?.pavojai?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {d.savybes.pavojai.map((p, i) => (
                  <span
                    key={i}
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-[0.12em] ${
                      p.severity === 'stiprus' ? 'bg-terracotta-500 text-bone'
                      : p.severity === 'vidutinis' ? 'bg-terracotta-200 text-terracotta-700'
                      : 'bg-terracotta-50 text-terracotta-600'
                    }`}
                  >
                    {p.tipas === 'toksiskas' ? 'Toksiška'
                      : p.tipas === 'alergiskas' ? 'Alergiška'
                      : 'Dirgina'} · {p.target === 'zmonems' ? 'žmonėms' : 'gyvūnams'}
                  </span>
                ))}
              </div>
            )}
            {d.savybes?.pavojingumas?.detales && (
              <p className="text-forest-600">{d.savybes.pavojingumas.detales}</p>
            )}
          </div>
        </Reveal>
        {!hasToxicity && !isComplete && (
          <div className="px-1"><Skeleton lines={2} /></div>
        )}
        {!hasToxicity && isComplete && (
          <p className="text-[12px] text-forest-500 italic px-1">Mūsų šaltiniai pavojų nenustatė.</p>
        )}
      </div>

      {/* ── Care section ──────────────────────────────────────── */}
      <div className="mb-5">
        <SectionHeader icon={Droplet} label="Priežiūra" complete={hasCare || isComplete} />
        <Reveal show={hasCare}>
          <div className="space-y-2 px-1">
            {d.laistymasIntervalas && (
              <div className="flex items-baseline gap-2 text-[13px]">
                <Droplet className="w-3.5 h-3.5 text-forest-500 flex-shrink-0 translate-y-[2px]" strokeWidth={2} />
                <span className="text-forest-700 font-medium">Laistymas:</span>
                <span className="text-forest-600">
                  vasarą kas {d.laistymasIntervalas.vasara}d
                  {d.laistymasIntervalas.ziema && `, žiemą kas ${d.laistymasIntervalas.ziema}d`}
                </span>
              </div>
            )}
            {d.tresimas && (
              <div className="flex items-baseline gap-2 text-[13px]">
                <FlaskConical className="w-3.5 h-3.5 text-forest-500 flex-shrink-0 translate-y-[2px]" strokeWidth={2} />
                <span className="text-forest-700 font-medium">Tręšimas:</span>
                <span className="text-forest-600">
                  vasarą kas {d.tresimas.intervalVasara}d
                  {d.tresimas.intervalZiema && `, žiemą kas ${d.tresimas.intervalZiema}d`}
                </span>
              </div>
            )}
          </div>
        </Reveal>
        {!hasCare && <div className="px-1"><Skeleton lines={2} /></div>}
      </div>

      {/* ── Description section ─────────────────────────────────── */}
      <div className="mb-5">
        <SectionHeader icon={BookOpen} label="Aprašymas" complete={hasNarrative || isComplete} />
        <Reveal show={hasNarrative}>
          <p className="text-[13px] text-forest-700 leading-relaxed px-1">{d.aprasymas}</p>
        </Reveal>
        {!hasNarrative && <div className="px-1"><Skeleton lines={3} /></div>}
      </div>

      {/* ── Idomybes (optional, nice-to-have) ─────────────────── */}
      {(hasInteresting || (!isComplete && !hasNarrative)) && (
        <div className="mb-5">
          <SectionHeader icon={Sparkles} label="Įdomybės" complete={hasInteresting || isComplete} />
          <Reveal show={hasInteresting}>
            <ul className="space-y-1.5 px-1">
              {d.idomybes?.slice(0, 3).map((fact, i) => (
                <li key={i} className="text-[12.5px] text-forest-600 leading-snug">
                  · {fact}
                </li>
              ))}
            </ul>
          </Reveal>
          {!hasInteresting && !isComplete && <div className="px-1"><Skeleton lines={2} /></div>}
        </div>
      )}

      {/* ── Activity hint (bottom, subtle) ────────────────────── */}
      {!isComplete && (
        <div className="text-center mb-4">
          <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-forest-400 inline-flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2.5} />
            {activityHint}
          </p>
        </div>
      )}

      {/* ── Action buttons ────────────────────────────────────── */}
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
            <p className="text-[10.5px] text-forest-400 text-center px-3 leading-snug">
              Enrichment vyks fone net jei uždarysi — info atsiras bibliotekoje per kelias akimirkas.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
