import { SUNKUMAS_META } from '../../utils/toxinClasses'

// SunkumasZyma — vienoda sunkumo (mirtinas/sunkus/.../nera/null) žyma.
// Naudojama namų rizikos sekcijoje ir toksikologinėj kortelėj.
// null = „nėra duomenų" (NIEKADA ne „saugu") — atskiras neutralus stilius.

const STILIUS = {
  mirtinas:  'bg-terracotta text-bone',
  sunkus:    'bg-terracotta-100 text-terracotta-600 border border-terracotta-200',
  vidutinis: 'bg-caramel-100 text-caramel-600 border border-caramel-200',
  silpnas:   'bg-forest-100 text-forest-700',
  nera:      'bg-bone-300/70 text-forest-500',
  _null:     'bg-bone-200 text-forest-400 border border-bone-400/40',
}

export function sunkumasLabel(sunkumas, trukstaDuomenu = false) {
  if (sunkumas == null) return trukstaDuomenu ? 'Nėra duomenų' : 'Nėra duomenų'
  return SUNKUMAS_META[sunkumas]?.label ?? sunkumas
}

export default function SunkumasZyma({ sunkumas, trukstaDuomenu = false, className = '' }) {
  const key = sunkumas == null ? '_null' : sunkumas
  const stilius = STILIUS[key] ?? STILIUS._null
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] ${stilius} ${className}`}>
      {sunkumasLabel(sunkumas, trukstaDuomenu)}
    </span>
  )
}
