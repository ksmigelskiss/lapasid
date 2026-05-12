import { AlertTriangle, Skull, Apple, BadgeCheck, Sprout, User, Cat } from 'lucide-react'

/**
 * PlantSavybesPills — augalo savybės kaip editorial sekcijos.
 *
 * Brandbook v1.0 editorial pattern (DESIGN_SYSTEM.md sec 6):
 *   Kiekviena savybes kategorija = mono caps section header + hairline +
 *   pills + body detales paragrafas. Viskas matoma iškart, jokio tap-to-expand.
 *
 * 3 sekcijos: PAVOJAI, VALGOMUMAS, VAISTINIS. Renderinama tik tos, kurios
 * turi turinį (pvz. valgomumas=none → sekcija nerodoma).
 *
 * Backward compat: senas plant'as su tik `toksiskas: true` boolean'u → rodom
 * PAVOJAI sekciją su generiniu ATSARGIAI pill'u + `toksiskumo_info` kaip body.
 */

// ── Section header — mono caps + hairline ────────────────────

function SectionHeader({ Icon, label, tone = 'forest' }) {
  const toneClasses = tone === 'terracotta'
    ? { text: 'text-terracotta-600', iconColor: 'text-terracotta-500', line: 'bg-terracotta-200/60' }
    : { text: 'text-forest-600',     iconColor: 'text-forest-500',     line: 'bg-bone-400/40' }
  return (
    <div className="flex items-center gap-3 mt-1">
      <div className="flex items-center gap-1.5">
        {Icon && <Icon size={11} className={`${toneClasses.iconColor} flex-shrink-0`} />}
        <p className={`font-mono text-[10px] font-medium uppercase tracking-[0.18em] ${toneClasses.text}`}>
          {label}
        </p>
      </div>
      <div className={`flex-1 h-px ${toneClasses.line}`} />
    </div>
  )
}

// ── Pavojai pill ─────────────────────────────────────────────

const TIPAS_LABEL = {
  toksiskas:   'TOKSIŠKA',
  alergiskas:  'ALERGIŠKA',
  dirginantis: 'DIRGINA',
}

const TARGET_META = {
  zmonems:  { label: 'Žmonėms',  Icon: User },
  gyvunams: { label: 'Gyvūnams', Icon: Cat },
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

function Pill({ label, bg, text, Icon }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] ${bg} ${text}`}>
      {Icon && <Icon size={11} className="flex-shrink-0" />}
      {label}
    </span>
  )
}

// ── Target group — sub-section pavojaiams (Žmonėms / Gyvūnams) ──

function TargetGroup({ target, pills }) {
  const meta = TARGET_META[target]
  if (!meta) return null
  const { Icon, label } = meta
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex items-center gap-1.5 flex-shrink-0 pt-1">
        <Icon size={11} className="text-forest-500" />
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-forest-500 w-[68px]">
          {label}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5 flex-1">
        {pills.map((p, i) => <Pill key={i} {...p} />)}
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────

export default function PlantSavybesPills({ plant }) {
  const s = plant.savybes

  // ── PAVOJAI sekcija — grupuojama pagal target (Žmonėms/Gyvūnams) ──
  // Tipas pill'e supaprastėja (TOKSIŠKA · vidutinis), nes target jau yra
  // sub-section header'yje. Saugiklis (ATSARGIAI) lieka bendras be target'o.
  const pavojaiByTarget = { zmonems: [], gyvunams: [] }
  let safetyPill = null

  // Severity koduojama per ikona + spalvą (silpnas: be ikonos + bg-50;
  // vidutinis: AlertTriangle + bg-100; stiprus: Skull + solid). Pill'o
  // label'e severity žodžio NĖRA — sutaupom vietos + mažiau triukšmo.
  if (s?.pavojai?.length) {
    for (const p of s.pavojai) {
      const pill = {
        label: TIPAS_LABEL[p.tipas] ?? p.tipas,
        ...pavojusStyle(p.severity),
      }
      if (pavojaiByTarget[p.target]) pavojaiByTarget[p.target].push(pill)
    }
  } else if (s?.pavojingumas?.yra) {
    safetyPill = {
      label: 'ATSARGIAI',
      ...pavojusStyle(s.pavojingumas.lygis ?? 'silpnas'),
      Icon: AlertTriangle,
    }
  } else if (!s && plant.toksiskas) {
    // Legacy fallback — senas plant'as be savybes
    safetyPill = {
      label: 'ATSARGIAI',
      bg: 'bg-terracotta-100',
      text: 'text-terracotta-600',
      Icon: AlertTriangle,
    }
  }
  const hasPavojai =
    pavojaiByTarget.zmonems.length > 0 ||
    pavojaiByTarget.gyvunams.length > 0 ||
    safetyPill !== null
  const pavojaiDetales = s?.pavojingumas?.detales || plant.toksiskumo_info || ''

  // ── VALGOMUMAS sekcija ───────────────────────────────────
  const v = s?.valgomumas
  const hasValgomumas = v && v.statusas !== 'none'
  const valgomumasLabel = hasValgomumas
    ? (v.statusas === 'pilnai'
        ? 'VISAS VALGOMAS'
        : `VALGOMA${v.dalys ? ` · ${v.dalys.toUpperCase()}` : ''}`)
    : ''

  // ── VAISTINIS sekcija ────────────────────────────────────
  const m = s?.vaistinis
  const hasVaistinis = m && m.statusas !== 'none'
  const vaistinisLabel = hasVaistinis
    ? (m.statusas === 'moksline'
        ? (m.naudojama ? `VAISTINĖ · ${m.naudojama.toUpperCase()}` : 'VAISTINĖ · MOKSLIŠKAI')
        : (m.naudojama ? `LIAUDIES VAISTINĖ · ${m.naudojama.toUpperCase()}` : 'LIAUDIES VAISTINĖ'))
    : ''
  const VaistinisIcon = hasVaistinis && m.statusas === 'moksline' ? BadgeCheck : Sprout

  // Nothing to show?
  if (!hasPavojai && !hasValgomumas && !hasVaistinis) return null

  return (
    <div className="space-y-4">
      {/* PAVOJAI — grupuojama pagal Žmonėms / Gyvūnams sub-sekcijomis */}
      {hasPavojai && (
        <div className="space-y-2">
          <SectionHeader Icon={AlertTriangle} label="Pavojai" tone="terracotta" />

          {/* Saugiklis (target nenurodytas) — be sub-grupės */}
          {safetyPill && (
            <div className="flex flex-wrap gap-1.5">
              <Pill {...safetyPill} />
            </div>
          )}

          {/* Žmonėms */}
          {pavojaiByTarget.zmonems.length > 0 && (
            <TargetGroup target="zmonems" pills={pavojaiByTarget.zmonems} />
          )}

          {/* Gyvūnams */}
          {pavojaiByTarget.gyvunams.length > 0 && (
            <TargetGroup target="gyvunams" pills={pavojaiByTarget.gyvunams} />
          )}

          {pavojaiDetales && (
            <p className="text-[13px] text-forest-700 leading-relaxed pt-1">{pavojaiDetales}</p>
          )}
        </div>
      )}

      {/* VALGOMUMAS */}
      {hasValgomumas && (
        <div className="space-y-2">
          <SectionHeader Icon={Apple} label="Valgomumas" tone="forest" />
          <div className="flex flex-wrap gap-1.5">
            <Pill label={valgomumasLabel} bg="bg-forest-100" text="text-forest-700" Icon={Apple} />
          </div>
          {v.detales && (
            <p className="text-[13px] text-forest-700 leading-relaxed">{v.detales}</p>
          )}
        </div>
      )}

      {/* VAISTINIS */}
      {hasVaistinis && (
        <div className="space-y-2">
          <SectionHeader Icon={Sprout} label="Vaistinis" tone="forest" />
          <div className="flex flex-wrap gap-1.5">
            <Pill
              label={vaistinisLabel}
              bg={m.statusas === 'moksline' ? 'bg-forest-100' : 'bg-bone-300'}
              text={m.statusas === 'moksline' ? 'text-forest-800' : 'text-forest-700'}
              Icon={VaistinisIcon}
            />
          </div>
          {m.detales && (
            <p className="text-[13px] text-forest-700 leading-relaxed">{m.detales}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Detailed callout block ────────────────────────────────────
// Kai augalas turi STIPRŲ toksiškumą žmonėms — papildomas callout virš
// editorial sekcijų, kad neignoruotų. Vidutinis/silpnas — neredundantiškas
// dabar (sekcija ir taip viską parodo).

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
