import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X, Printer, Share2, Check } from 'lucide-react'
import ToxCard from './ToxCard'
import { resolveToxinProfile, SPECIES, AUDITORIJA_META } from '../../utils/toxinClasses'

// ToxCardSheet — toksikologinės kortelės pilno ekrano overlay'us su spausdinimu
// ir dalijimusi. Print: `.toxcard-print` klasė → index.css @media print rodo TIK
// kortelę (likęs app paslepiamas). Mygtukai `.toxcard-no-print` — nespausdinami.

// Paprastas tekstinis kortelės santraukos variantas (navigator.share / clipboard).
function buildShareText(plant) {
  const profile = resolveToxinProfile(plant, {})
  const lot = plant?.lotyniskas || plant?.latinName || ''
  const lt = plant?.lietuviškas || lot || 'Augalas'
  const lines = [
    `TOKSIKOLOGINĖ KORTELĖ — ${lt}${lot ? ` (${lot})` : ''}`,
    'Informacija, NE medicininė konsultacija. Parodykite medikui / veterinarui.',
    '',
  ]
  if (profile.status === 'nezinoma') {
    lines.push('Toksiškumo duomenų šiai rūšiai neturime. „Nėra duomenų" ≠ „saugu" — elkitės atsargiai.')
  } else if (profile.status === 'saugu') {
    lines.push('Pagal turimus duomenis (ASPCA / botanika) nelaikomas toksišku. Vis tiek stebėkite.')
  } else {
    for (const k of profile.klases) {
      lines.push(`• ${k.vardas_lt} (dalis: ${k.dalis}; mechanizmas: ${k.mechanizmo_tipas}${k.organas ? `, ${k.organas}` : ''})`)
      const sens = SPECIES.map(sp => `${AUDITORIJA_META[sp]?.trumpas ?? sp}: ${k.rusies_jautrumas?.[sp] ?? 'nėra duomenų'}`).join(', ')
      lines.push(`   jautrumas — ${sens}`)
      if (k.antidotas) lines.push(`   antidotas: ${k.antidotas}`)
      if (k.medikui_lt) lines.push(`   medikui: ${k.medikui_lt}`)
    }
  }
  lines.push('', 'Nesukelkite vėmimo savarankiškai. Skambinkite / vykite, jei abejojate.')
  return lines.join('\n')
}

export default function ToxCardSheet({ plant, household, onClose }) {
  const [copied, setCopied] = useState(false)

  const handlePrint = () => { window.print() }

  const handleShare = async () => {
    let text = buildShareText(plant)
    // Jei augalas viešas (pasas įjungtas) — pridedam viešą kortelės nuorodą.
    if (plant?.isPublic && plant?.id) {
      text += `\n\nVieša kortelė: ${window.location.origin}/t/${plant.id}`
    }
    const title = `Toksikologinė kortelė — ${plant?.lietuviškas || plant?.lotyniskas || 'augalas'}`
    if (navigator.share) {
      try { await navigator.share({ title, text }); return } catch (e) { if (e?.name === 'AbortError') return }
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  return createPortal(
    <div className="toxcard-print fixed inset-0 z-[130] bg-white overflow-y-auto">
      {/* Veiksmų juosta — nespausdinama */}
      <div className="toxcard-no-print sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-bone-400/40">
        <div className="max-w-[640px] mx-auto px-4 py-2.5 flex items-center gap-2">
          <button
            onClick={onClose}
            className="w-10 h-10 bg-bone-300/60 hover:bg-bone-400/60 rounded-btn flex items-center justify-center text-forest-700 transition-colors flex-shrink-0"
            aria-label="Uždaryti"
          >
            <X size={16} />
          </button>
          <span className="flex-1 font-mono text-[10px] uppercase tracking-[0.18em] text-forest-500 truncate">Toksikologinė kortelė</span>
          <button
            onClick={handleShare}
            className="h-10 px-3 rounded-btn border border-bone-400/60 bg-bone-50 hover:bg-bone-100 text-forest-700 text-sm font-medium inline-flex items-center gap-1.5 transition-colors"
          >
            {copied ? <Check size={15} className="text-forest-600" /> : <Share2 size={15} />}
            <span className="hidden sm:inline">{copied ? 'Nukopijuota' : 'Dalintis'}</span>
          </button>
          <button
            onClick={handlePrint}
            className="h-10 px-3 rounded-btn bg-forest-700 hover:bg-forest-800 text-bone-50 text-sm font-medium inline-flex items-center gap-1.5 transition-colors"
          >
            <Printer size={15} />
            <span className="hidden sm:inline">Spausdinti</span>
          </button>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <ToxCard plant={plant} household={household} />
      </motion.div>
    </div>,
    document.body,
  )
}
