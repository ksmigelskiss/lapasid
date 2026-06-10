import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Camera, Image as ImageIcon, RefreshCw, Check, Palette } from 'lucide-react'
import { useIsDesktop } from '../../hooks/useIsDesktop'
import { useDetailHost } from '../../contexts/DetailHostContext'
import PlantImage from '../brand/PlantImage'

export default function PhotoSheet({ plant, onClose, onSave, onCapture, onRevert, onToggleHistoryPhoto }) {
  // Step 6u — PhotoSheet rewrite. Unified design po stack-on-top chaos'o:
  //   • Drop'inta iNat live search (redundant — plant.photos[] jau cache'ina
  //     search'o metu surinktas referencias)
  //   • Galerija = plant.photos[] iš Stage 1 fetch'o (Brave + Wiki + iNat)
  //   • Mūsų istorija = timeline.photo events (user'io augimo nuotraukos)
  //   • Select-then-confirm UX: tap thumb → highlight → „Išsaugoti" button
  //     (saugiau nei instant tap-to-set, leidžia browse'inti prieš commit)
  //   • Camera + Upload — instant flow (user intent jau aiškus po file pick)
  const historyPhotos = (plant.timeline ?? []).filter(e => e.type === 'photo' && e.imageUrl)
  const galleryPhotos = (plant.photos ?? []).filter(Boolean)
  const useHistory    = plant.useHistoryPhoto !== false

  // selectedPhoto — pasirinkta thumb, dar nepatvirtinta. fromHistory tracking'as
  // kad onSave gautų teisingą second-arg flag'ą (timeline event source vs
  // search-time gallery).
  const [selected, setSelected] = useState(null)  // { url, fromHistory, thumb } | null

  const isDesktop = useIsDesktop()
  const host = useDetailHost()
  const useDesktopPanel = isDesktop && !!host?.container

  // Capture (camera/upload) → foto į TIMELINE (istoriją), NE pin. Jei „Auto iš
  // istorijos" įjungtas, naujausia tampa profiliu (addTimelineEvent sync).
  // Skiriasi nuo pick'o (galerija/istorija → pin + auto off).
  const handleFile = (file) => {
    if (!file) return
    onClose()
    onCapture?.(file)
  }

  const handleSave = () => {
    if (!selected) return
    onSave(selected.url, selected.fromHistory, selected.thumb ?? null)
    onClose()
  }

  const PhotoThumb = ({ url, fromHistory, thumb, keyHint }) => {
    const isSelected = selected?.url === url
    return (
      <button
        key={keyHint ?? url}
        onClick={() => setSelected({ url, fromHistory, thumb })}
        className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all ${
          isSelected
            ? 'border-forest-600 ring-2 ring-forest-600/30'
            : 'border-bone-400/40 hover:border-forest-400'
        }`}
      >
        <PlantImage url={url} size="thumb" alt="" className="w-full h-full object-cover" />
        {isSelected && (
          <div className="absolute top-1 right-1 w-5 h-5 bg-forest-600 rounded-full flex items-center justify-center">
            <Check size={12} className="text-bone" strokeWidth={3} />
          </div>
        )}
      </button>
    )
  }

  const tree = (
    <div className={useDesktopPanel
      ? "absolute inset-0 z-[80] flex items-end justify-center"
      : "fixed inset-0 z-[80] flex items-end justify-center"}>
      <motion.div
        className="absolute inset-0 bg-forest-800/55 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }} onPointerDown={onClose}
      />
      <motion.div
        className="relative w-full max-w-[430px] bg-bone-50 rounded-t-4xl px-4 pt-3 pb-8 border-t border-bone-400/40 max-h-[85vh] overflow-y-auto"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        onPointerDown={e => e.stopPropagation()}
      >
        <div className="flex justify-center pb-3">
          <div className="w-10 h-1 bg-bone-400/60 rounded-full" />
        </div>
        <p className="font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.18em] text-center mb-4">
          Pakeisti nuotrauką
        </p>

        <div className="space-y-4">
          {/* CAPTURE — primary. Foto → istorija; jei „Auto", tampa profiliu. */}
          <div className="space-y-2">
            <label className="flex items-center gap-4 bg-forest-600 hover:bg-forest-700 rounded-2xl px-4 py-3.5 cursor-pointer transition-colors">
              <span className="text-bone"><Camera size={22} /></span>
              <span className="font-display text-sm font-semibold tracking-tight text-bone">Fotografuoti</span>
              <input type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => { handleFile(e.target.files[0]); e.target.value = '' }} />
            </label>
            <label className="flex items-center gap-4 bg-bone-50 border border-bone-400/40 hover:bg-bone-300/40 rounded-2xl px-4 py-3.5 cursor-pointer transition-colors">
              <span className="text-forest-500"><ImageIcon size={22} /></span>
              <span className="font-display text-sm font-semibold tracking-tight text-forest-800">Įkelti iš įrenginio</span>
              <input type="file" accept="image/*" className="hidden"
                onChange={e => { handleFile(e.target.files[0]); e.target.value = '' }} />
            </label>
          </div>

          {/* „Auto iš istorijos" toggle — profilis seka naujausią augimo foto */}
          {historyPhotos.length > 0 && (
            <button
              onClick={onToggleHistoryPhoto}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-colors ${
                useHistory ? 'bg-forest-600 text-bone' : 'bg-bone-50 border border-bone-400/40 text-forest-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <RefreshCw size={20} className={useHistory ? 'text-bone' : 'text-forest-500'} />
                <div className="text-left">
                  <p className="font-display text-sm font-semibold tracking-tight">Auto iš istorijos</p>
                  <p className={`text-xs mt-0.5 ${useHistory ? 'text-bone/70' : 'text-forest-500'}`}>
                    {useHistory ? 'Naujos istorijos nuotraukos → profilis' : 'Išjungta — profilis fiksuotas'}
                  </p>
                </div>
              </div>
              <div className={`w-10 h-6 rounded-full flex items-center transition-colors px-0.5 ${useHistory ? 'bg-bone/30' : 'bg-bone-400'}`}>
                <div className={`w-5 h-5 rounded-full bg-bone shadow transition-transform ${useHistory ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </button>
          )}

          {/* MŪSŲ ISTORIJA — timeline photo events. Pick → pin (auto off). */}
          {historyPhotos.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <p className="font-mono text-[11px] font-semibold text-forest-700 uppercase tracking-[0.18em]">Mūsų istorija</p>
                <div className="flex-1 h-px bg-bone-400/60" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {historyPhotos.map(e => (
                  <PhotoThumb key={`h-${e.id}`} url={e.imageUrl} thumb={e.imageUrlThumb} fromHistory />
                ))}
              </div>
            </div>
          )}

          {/* GALERIJA — plant.photos[] iš Stage 1 fetch'o. Pick → pin (auto off). */}
          {galleryPhotos.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <p className="font-mono text-[11px] font-semibold text-forest-700 uppercase tracking-[0.18em]">Galerija</p>
                <div className="flex-1 h-px bg-bone-400/60" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {galleryPhotos.map((url, i) => (
                  <PhotoThumb key={`g-${i}`} url={url} fromHistory={false} />
                ))}
              </div>
            </div>
          )}

          {/* Hint — pick'as išjungia Auto (konsistentiškai galerijai+istorijai) */}
          {useHistory && (historyPhotos.length > 0 || galleryPhotos.length > 0) && (
            <p className="text-xs text-forest-500 text-center px-3 -mt-1">
              Pasirinkus konkrečią nuotrauką, „Auto iš istorijos" išsijungs.
            </p>
          )}

          {/* Išsaugoti — patvirtina pasirinktą nuotrauką → pin */}
          {selected && (
            <button
              onClick={handleSave}
              className="w-full h-12 rounded-btn font-display text-sm font-semibold text-bone bg-forest-700 hover:bg-forest-800 transition-colors"
            >
              Išsaugoti
            </button>
          )}

          {/* Grįžti į iliustraciją — išvalo asmeninės foto override → watercolor */}
          {plant.image && (
            <button
              onClick={() => { onRevert?.(); onClose() }}
              className="w-full h-12 rounded-2xl font-display text-sm font-semibold text-forest-700 bg-bone-50 border border-bone-400/40 hover:bg-bone-300/40 transition-colors flex items-center justify-center gap-2"
            >
              <Palette size={18} className="text-forest-500" /> Rodyti iliustraciją
            </button>
          )}

          <button
            className="w-full h-12 rounded-btn font-display text-sm font-semibold text-forest-600 bg-bone-300 hover:bg-bone-400/70 transition-colors"
            onClick={onClose}
          >
            Atšaukti
          </button>
        </div>
      </motion.div>
    </div>
  )

  if (useDesktopPanel) return createPortal(tree, host.container)
  return tree
}
