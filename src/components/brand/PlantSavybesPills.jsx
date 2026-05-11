import { AlertTriangle, Skull, Leaf, Apple, BadgeCheck, Sprout } from 'lucide-react'

/**
 * PlantSavybesPills — augalo savybės kaip horizontalūs pill'ai.
 *
 * Brandbook v1.0 logika:
 *   - Granuliarūs pavojai (savybes.pavojai[]) → specifiški pill'ai
 *     (TOKSIŠKA GYVŪNAMS · stiprus etc.)
 *   - Saugiklis (savybes.pavojingumas.yra=true bet pavojai[] tuščias) →
 *     generinis ATSARGIAI pill'as
 *   - Valgomumas / Vaistinis → atskiri brand pill'ai jei statusas != 'none'
 *
 * Backward compat: jei augalas neturi `savybes` lauko (senas plant'as), bet
 * yra `toksiskas: true` boolean'as — rodome bendrą ATSARGIAI pill'ą su
 * `toksiskumo_info` kaip detalės. Vartotojas vis tiek mato info kol per
 * „Atnaujinti per AI" mygtuką pavyzdžiui nepasinaujins schema.
 */

// ── Pill data builders ────────────────────────────────────────

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
  // tradicine
  return {
    label: v.naudojama ? `LIAUDIES VAISTINĖ · ${v.naudojama.toUpperCase()}` : 'LIAUDIES VAISTINĖ',
    bg: 'bg-bone-300', text: 'text-forest-700', Icon: Sprout,
  }
}

// ── Component ─────────────────────────────────────────────────

export default function PlantSavybesPills({ plant }) {
  const s = plant.savybes

  // Backward compat — senas plant'as be savybes, bet su toksiskas=true
  const legacyFallback = !s && plant.toksiskas
    ? [{
        label: 'ATSARGIAI',
        bg: 'bg-terracotta-100', text: 'text-terracotta-600',
        Icon: AlertTriangle,
        tooltip: plant.toksiskumo_info || 'Augalas pavojingas — atnaujink per AI dėl detalių.',
      }]
    : []

  // Granuliarūs pavojai → specifiniai pill'ai
  const pavojuPills = (s?.pavojai ?? []).map(p => ({
    label:   `${pavojusLabel(p)} · ${p.severity}`,
    tooltip: '',
    ...pavojusStyle(p.severity),
  }))

  // Saugiklis — kai pavojai[] tuščias, bet yra bendrai pavojingas
  const safetyPill = !legacyFallback.length && s && (s.pavojai?.length ?? 0) === 0 && s.pavojingumas?.yra
    ? [{
        label:   `ATSARGIAI${s.pavojingumas.lygis ? ` · ${s.pavojingumas.lygis}` : ''}`,
        ...pavojusStyle(s.pavojingumas.lygis ?? 'silpnas'),
        Icon:    AlertTriangle,
        tooltip: s.pavojingumas.detales || '',
      }]
    : []

  // Valgomumas + vaistinis
  const valg = valgomumasPill(s?.valgomumas)
  const vais = vaistinisPill(s?.vaistinis)

  const allPills = [...legacyFallback, ...pavojuPills, ...safetyPill, valg, vais].filter(Boolean)

  if (allPills.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {allPills.map((p, i) => (
        <span
          key={i}
          title={p.tooltip || undefined}
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] ${p.bg} ${p.text}`}
        >
          {p.Icon && <p.Icon size={11} className="flex-shrink-0" />}
          {p.label}
        </span>
      ))}
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
