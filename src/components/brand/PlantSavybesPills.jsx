import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Skull, Apple, BadgeCheck, Sprout } from 'lucide-react'

/**
 * PlantSavybesPills — augalo savybės kaip horizontalūs pill'ai.
 *
 * Brandbook v1.0 logika:
 *   - Granuliarūs pavojai (savybes.pavojai[]) → specifiški pill'ai
 *   - Saugiklis (savybes.pavojingumas.yra=true bet pavojai[] tuščias) →
 *     generinis ATSARGIAI pill'as
 *   - Valgomumas / Vaistinis → atskiri brand pill'ai jei statusas != 'none'
 *
 * Tap pill → expand'inasi inline detalių sekcija. 3 grupės (pavojai, valgomumas,
 * vaistinis) turi atskirus expand state'us — vienu metu atvira viena grupė.
 *
 * Backward compat: jei augalas neturi `savybes` lauko (senas plant'as), bet
 * yra `toksiskas: true` boolean'as — rodome bendrą ATSARGIAI pill'ą su
 * `toksiskumo_info` kaip detalės.
 */

// ── Builders ─────────────────────────────────────────────────

function pavojusLabel(p) {
  const tipasMap = {
    toksiskas:   'TOKSIŠKA',
    alergiskas:  'ALERGIŠKA',
    dirginantis: 'DIRGINA',
  }
  const targetMap = {
    zmonems:  'ŽMONĖMS',
    gyvunams: 'GYVŪNAMS',
  }
  return `${tipasMap[p.tipas] ?? p.tipas} ${targetMap[p.target] ?? p.target}`
}

function pavojusStyle(severity) {
  switch (severity) {
    case 'stiprus':
      return { bg: 'bg-terracotta',     text: 'text-bone',            Icon: Skull }
    case 'vidutinis':
      return { bg: 'bg-terracotta-100', text: 'text-terracotta-600',  Icon: AlertTriangle }
    case 'silpnas':
    default:
      return { bg: 'bg-terracotta-50',  text: 'text-terracotta-500',  Icon: null }
  }
}

function valgomumasPill(v) {
  if (!v || v.statusas === 'none') return null
  const label = v.statusas === 'pilnai' ? 'VISAS VALGOMAS' : `VALGOMA${v.dalys ? ` · ${v.dalys.toUpperCase()}` : ''}`
  return { label, bg: 'bg-forest-100', text: 'text-forest-700', Icon: Apple }
}

function vaistinisPill(v) {
  if (!v || v.statusas === 'none') return null
  if (v.statusas === 'moksline') {
    return {
      label: v.naudojama ? `VAISTINĖ · ${v.naudojama.toUpperCase()}` : 'VAISTINĖ · MOKSLIŠKAI',
      bg: 'bg-forest-100', text: 'text-forest-800', Icon: BadgeCheck,
    }
  }
  return {
    label: v.naudojama ? `LIAUDIES VAISTINĖ · ${v.naudojama.toUpperCase()}` : 'LIAUDIES VAISTINĖ',
    bg: 'bg-bone-300', text: 'text-forest-700', Icon: Sprout,
  }
}

// ── Detail panel — bone-50 card po pill'ais ──────────────────

function DetailPanel({ children }) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden"
    >
      <div className="bg-bone-50 border border-bone-400/40 rounded-2xl px-4 py-3 mt-2 text-[13px] text-forest-700 leading-relaxed">
        {children}
      </div>
    </motion.div>
  )
}

// ── Component ─────────────────────────────────────────────────

export default function PlantSavybesPills({ plant }) {
  const s = plant.savybes
  const [expanded, setExpanded] = useState(null) // 'pavojai' | 'valgomumas' | 'vaistinis' | null

  const toggle = (key) => setExpanded(prev => prev === key ? null : key)

  // Backward compat — senas plant'as be savybes, bet su toksiskas=true
  const legacyFallback = !s && plant.toksiskas
    ? [{
        label: 'ATSARGIAI',
        bg: 'bg-terracotta-100', text: 'text-terracotta-600',
        Icon: AlertTriangle,
        group: 'pavojai',
      }]
    : []

  // Granuliarūs pavojai
  const pavojuPills = (s?.pavojai ?? []).map(p => ({
    label: `${pavojusLabel(p)} · ${p.severity}`,
    ...pavojusStyle(p.severity),
    group: 'pavojai',
  }))

  // Saugiklis
  const safetyPill = !legacyFallback.length && s && (s.pavojai?.length ?? 0) === 0 && s.pavojingumas?.yra
    ? [{
        label: `ATSARGIAI${s.pavojingumas.lygis ? ` · ${s.pavojingumas.lygis}` : ''}`,
        ...pavojusStyle(s.pavojingumas.lygis ?? 'silpnas'),
        Icon: AlertTriangle,
        group: 'pavojai',
      }]
    : []

  // Valgomumas + vaistinis
  const valg = valgomumasPill(s?.valgomumas)
  const vais = vaistinisPill(s?.vaistinis)
  if (valg) valg.group = 'valgomumas'
  if (vais) vais.group = 'vaistinis'

  const allPills = [...legacyFallback, ...pavojuPills, ...safetyPill, valg, vais].filter(Boolean)
  if (allPills.length === 0) return null

  // Detalės tekstai (kiekvienai grupei savo)
  const pavojaiDetales = s?.pavojingumas?.detales || plant.toksiskumo_info || ''
  const valgomumasDetales = s?.valgomumas?.detales || ''
  const vaistinisDetales = s?.vaistinis?.detales || (s?.vaistinis?.naudojama && s.vaistinis.naudojama !== '' ? '' : '')

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {allPills.map((p, i) => {
          const hasDetail =
            (p.group === 'pavojai'    && pavojaiDetales) ||
            (p.group === 'valgomumas' && valgomumasDetales) ||
            (p.group === 'vaistinis'  && vaistinisDetales)
          const isExpanded = expanded === p.group
          return (
            <button
              key={i}
              onClick={() => hasDetail && toggle(p.group)}
              disabled={!hasDetail}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] transition-opacity ${p.bg} ${p.text} ${
                hasDetail ? 'cursor-pointer active:opacity-70' : 'cursor-default'
              } ${isExpanded ? 'ring-2 ring-forest-300/50' : ''}`}
            >
              {p.Icon && <p.Icon size={11} className="flex-shrink-0" />}
              {p.label}
            </button>
          )
        })}
      </div>

      <AnimatePresence initial={false}>
        {expanded === 'pavojai' && pavojaiDetales && (
          <DetailPanel key="pavojai">{pavojaiDetales}</DetailPanel>
        )}
        {expanded === 'valgomumas' && valgomumasDetales && (
          <DetailPanel key="valgomumas">{valgomumasDetales}</DetailPanel>
        )}
        {expanded === 'vaistinis' && vaistinisDetales && (
          <DetailPanel key="vaistinis">{vaistinisDetales}</DetailPanel>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Detailed callout block ────────────────────────────────────
// Kai augalas turi STIPRŲ toksiškumą žmonėms — rodome papildomą callout
// block'ą po pill'ų, kad neignoruotų. Vidutinis/silpnas — tik pill'as pakanka.

export function PlantSafetyCallout({ plant }) {
  const s = plant.savybes
  const stiprusZmones = s?.pavojai?.find(p => p.severity === 'stiprus' && p.target === 'zmonems')
  if (!stiprusZmones && !(s?.pavojingumas?.yra && s?.pavojingumas?.lygis === 'stiprus')) {
    return null
  }
  const detales = s?.pavojingumas?.detales || ''
  if (!detales) return null

  return (
    <div className="bg-white/55 backdrop-blur-xl border-2 border-terracotta/50 rounded-2xl p-3.5 flex gap-3">
      <Skull size={22} className="flex-shrink-0 text-terracotta mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[10px] font-medium text-terracotta-600 uppercase tracking-[0.16em]">Pavojinga</p>
        <p className="font-display text-sm font-bold text-terracotta-600 tracking-tight mt-0.5">
          Stipriai toksiškas žmonėms
        </p>
        <p className="text-xs text-forest-600 mt-1 leading-snug">{detales}</p>
      </div>
    </div>
  )
}
