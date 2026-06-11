import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import PlantImage from './brand/PlantImage'
import PlantSavybesPills from './brand/PlantSavybesPills'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { useDetailHost } from '../contexts/DetailHostContext'

/**
 * Vieša augalo kortelė (1 segmentas) — rodoma paspaudus įrašą bibliotekoje.
 * TIK saugumas + įdomybės (allowlist iš /api/catalog/public). BE care, BE
 * nori/auginu, BE paso toggle. Pamatas būsimai embed/print kortelei.
 *
 * Desktop (≥1024px + DetailHost): portal'inasi į RightPanel su slide-in iš
 * dešinės — tas pats pattern'as kaip PlantDetail (plant-detail/PlantDetail.jsx).
 * Mobile: fullscreen overlay.
 */
export default function PublicPlantCard({ entry, onClose }) {
  const isDesktop = useIsDesktop()
  const host = useDetailHost()
  const useDesktopPanel = isDesktop && !!host?.container

  // RightPanel pointer-events aktyvavimas (kaip PlantDetail host.open/close).
  useEffect(() => {
    if (!useDesktopPanel || !host) return
    host.open()
    return () => host.close()
  }, [useDesktopPanel]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!entry) return null
  const hero     = entry.heroIllustration ?? entry.image ?? null
  const thumb    = entry.heroThumb ?? null
  const syn      = Array.isArray(entry.sinonimai) ? entry.sinonimai : []
  const idomybes = Array.isArray(entry.idomybes) ? entry.idomybes : []

  const content = (
    <div className="max-w-[680px] mx-auto px-5 pb-16">
      <div className="flex justify-end pt-3">
        <button onClick={onClose} aria-label="Uždaryti" className="text-forest-400 hover:text-forest-600 p-2 -mr-2">
          <X size={20} />
        </button>
      </div>

      {hero && (
        <div className="rounded-3xl overflow-hidden bg-bone-50 border border-bone-400/40 mb-4">
          <PlantImage url={hero} thumbUrl={thumb} size="card" alt={entry.lietuviškas} className="w-full h-auto object-contain" />
        </div>
      )}

      <h1 className="font-display text-2xl font-semibold tracking-tight text-forest-800">{entry.lietuviškas}</h1>
      {entry.lotyniskas && <p className="italic text-forest-500 text-sm mt-0.5">{entry.lotyniskas}</p>}
      {syn.length > 0 && <p className="text-forest-400 text-xs mt-1">{syn.join(' · ')}</p>}

      {/* Saugumas — toksiškumas / valgomumas / vaistinis */}
      <div className="mt-4">
        <PlantSavybesPills plant={entry} />
      </div>

      {idomybes.length > 0 && (
        <div className="mt-6">
          <p className="font-mono text-[11px] font-semibold text-forest-700 uppercase tracking-[0.18em] mb-2">Įdomybės</p>
          <ul className="space-y-2">
            {idomybes.map((it, i) => (
              <li key={i} className="text-sm text-forest-700 leading-relaxed flex gap-2">
                <span className="text-forest-400 flex-shrink-0">·</span>
                <span>{typeof it === 'string' ? it : (it?.text ?? it?.faktas ?? '')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-forest-400 mt-8 leading-relaxed border-t border-bone-400/40 pt-4">
        Informacija — pažintinio pobūdžio. Ji nepakeičia gydytojo ar veterinaro konsultacijos.
      </p>
    </div>
  )

  // Desktop: slide-in šoniniame panelyje (virš RightPanel widget'ų).
  if (useDesktopPanel) {
    return createPortal(
      <motion.div
        className="absolute inset-0 bg-app overflow-y-auto"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
      >
        {content}
      </motion.div>,
      host.container
    )
  }

  // Mobile: fullscreen overlay su slide-up.
  return (
    <motion.div
      className="fixed inset-0 z-50 bg-app overflow-y-auto"
      initial={{ y: '6%', opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 32, stiffness: 320 }}
    >
      {content}
    </motion.div>
  )
}
