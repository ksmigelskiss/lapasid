import { ShieldAlert, ArrowUp, Leaf, AlertTriangle, ShieldCheck, Stethoscope, Home, ChevronRight } from 'lucide-react'
import {
  assessHouseholdRisk,
  isHouseholdEmpty,
  normalizeHousehold,
  AUDITORIJA_META,
} from '../../utils/toxinClasses'
import SunkumasZyma from './SunkumasZyma'

// HouseholdRiskSection — vieno augalo rizika TAVO namams + išdėstymo rekomendacija.
// Rodo SĄRAŠĄ (ne balą), sunkumą pagal narį (katė ≠ šuo), rekomendaciją
// informaciniu tonu. „Nėra duomenų" niekada nevirsta „saugu".

const TONAS_STILIUS = {
  kritinis:  { bg: 'bg-terracotta-50',  border: 'border-terracotta/40',   head: 'text-terracotta-600', Icon: ShieldAlert },
  vidutinis: { bg: 'bg-caramel-50',     border: 'border-caramel-200',     head: 'text-caramel-600',    Icon: ArrowUp },
  zemas:     { bg: 'bg-forest-50',      border: 'border-forest-200/70',   head: 'text-forest-700',     Icon: Leaf },
  nezinoma:  { bg: 'bg-bone-100',       border: 'border-bone-400/50',     head: 'text-forest-600',     Icon: AlertTriangle },
  saugu:     { bg: 'bg-forest-50',      border: 'border-forest-200/70',   head: 'text-forest-700',     Icon: ShieldCheck },
}

const REK_LABEL = {
  ne_namuose:         'Geriau ne namuose',
  aukstai:            'Laikyti aukštai',
  ant_zemes:          'Galima pasiekiamai',
  atsargiai_nezinoma: 'Atsargiai',
  saugu:              'Pavojų nematyti',
}

function SectionHeader({ label }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <Home size={12} className="text-forest-500 flex-shrink-0" />
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-700">{label}</p>
      </div>
      <div className="flex-1 h-px bg-bone-400/60" />
    </div>
  )
}

export default function HouseholdRiskSection({ plant, household, onOpenCard, onOpenProfile }) {
  const h = normalizeHousehold(household)
  const empty = isHouseholdEmpty(h)
  const risk = assessHouseholdRisk(plant, h)
  const st = TONAS_STILIUS[risk.tonas] ?? TONAS_STILIUS.nezinoma
  const Icon = st.Icon

  // Namų profilis nenustatytas — kvietimas jį užpildyti (+ bendras toksiškumas).
  if (empty) {
    return (
      <div className="space-y-2.5">
        <SectionHeader label="Namų rizika" />
        <button
          onClick={onOpenProfile}
          className="w-full flex items-center gap-3 bg-bone-100 border border-bone-400/50 rounded-2xl p-3.5 text-left hover:bg-bone-300/40 transition-colors"
        >
          <Home size={18} className="text-forest-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-forest-700">Nustatyk namų profilį</p>
            <p className="text-xs text-forest-500 mt-0.5 leading-snug">Nurodyk, kas gyvena namuose (vaikai, gyvūnai) — parodysim, kiek šis augalas pavojingas būtent tau.</p>
          </div>
          <ChevronRight size={16} className="text-forest-400 flex-shrink-0" />
        </button>
        {onOpenCard && (
          <ToxCardButton onClick={onOpenCard} />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <SectionHeader label="Namų rizika" />

      {/* Rekomendacijos kortelė */}
      <div className={`rounded-2xl border ${st.bg} ${st.border} p-3.5`}>
        <div className="flex items-start gap-3">
          <Icon size={20} className={`${st.head} flex-shrink-0 mt-0.5`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`font-display text-sm font-bold tracking-tight ${st.head}`}>{risk.antraste}</p>
              {risk.kritineVeliava && (
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] bg-terracotta text-bone rounded-full px-1.5 py-0.5">Skambink dabar</span>
              )}
            </div>
            <p className="text-[13px] text-forest-700 leading-relaxed mt-1">{risk.tekstas}</p>
            {risk.maziVaikaiPastaba && (
              <p className="text-[12px] text-forest-600 leading-snug mt-2 pl-2.5 border-l-2 border-caramel-300">{risk.maziVaikaiPastaba}</p>
            )}
          </div>
        </div>
      </div>

      {/* Pagal namų narį — „TAVO katei / vaikams" */}
      {risk.perAuditorija.length > 0 && (
        <div className="space-y-1.5 px-0.5">
          {risk.perAuditorija.map(row => (
            <div key={row.auditorija} className="flex items-center justify-between gap-3 py-1">
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-forest-500">
                {AUDITORIJA_META[row.auditorija]?.label ?? row.label}
              </span>
              <SunkumasZyma sunkumas={row.sunkumas} trukstaDuomenu={row.trukstaDuomenu} />
            </div>
          ))}
        </div>
      )}

      {/* Duomenų spragos — sąžiningai */}
      {risk.profile.dataGaps.length > 0 && (
        <div className="flex items-start gap-2 bg-bone-100 border border-bone-400/40 rounded-xl px-3 py-2">
          <AlertTriangle size={13} className="text-forest-400 flex-shrink-0 mt-0.5" />
          <div className="text-[11.5px] text-forest-500 leading-snug space-y-0.5">
            {risk.profile.dataGaps.map((g, i) => <p key={i}>{g}</p>)}
          </div>
        </div>
      )}

      {onOpenCard && <ToxCardButton onClick={onOpenCard} />}
    </div>
  )
}

function ToxCardButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-btn border border-forest-200/70 bg-forest-50 text-forest-700 text-sm font-semibold hover:bg-forest-100 transition-colors"
    >
      <Stethoscope size={15} />
      Toksikologinė kortelė
      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-forest-500">medikui / vet</span>
    </button>
  )
}

export { REK_LABEL }
