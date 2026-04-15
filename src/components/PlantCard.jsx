import { useState, useEffect } from 'react'
import { motion, AnimatePresence, useDragControls, useMotionValue, animate } from 'framer-motion'
import { Sun, Droplets, Star, Camera, ImageIcon, Search, Loader2, Leaf, Moon, Sprout, Snowflake, Skull, House, ShoppingCart } from 'lucide-react'
import { fetchWikimediaImage } from '../utils/plantImage'
import { resizeImage } from '../utils/imageResize'
import { useLongPress } from '../hooks/useLongPress'
import { getFertilizingForecast } from '../utils/fertilizingForecast'
import { getDormancyForecast } from '../utils/dormancyForecast'

function DotScore({ value, max = 3, color }) {
  return (
    <div className="flex gap-[3px] items-center">
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < value ? color : 'bg-gray-300'}`} />
      ))}
    </div>
  )
}

function PhotoActionSheet({ plant, onClose, onFileSelect, onWikimedia, fetching }) {
  const dragControls = useDragControls()
  const y = useMotionValue(0)

  const handleDragEnd = (_, info) => {
    if (info.velocity.y > 400 || info.offset.y > 80) {
      onClose()
    } else {
      animate(y, 0, { type: 'spring', stiffness: 400, damping: 30 })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <motion.div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onPointerDown={onClose}
      />
      <motion.div
        className="relative w-full max-w-[430px] bg-white rounded-t-4xl px-4 pt-3 pb-6"
        style={{ y }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0, bottom: 0.25 }}
        onDragEnd={handleDragEnd}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        onPointerDown={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div
          onPointerDown={e => dragControls.start(e)}
          className="flex justify-center pb-3 cursor-grab active:cursor-grabbing select-none"
          style={{ touchAction: 'none' }}
        >
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-center mb-3">Pakeisti nuotrauką</p>
        <div className="space-y-2">
          <label className="flex items-center gap-4 bg-surface hover:bg-surface-2 rounded-2xl px-4 py-3.5 cursor-pointer">
            <span className="text-gray-500"><Camera size={22} /></span>
            <span className="text-sm font-medium text-gray-800">Fotografuoti</span>
            <input type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => { onFileSelect(e.target.files[0]); e.target.value = '' }} />
          </label>
          <label className="flex items-center gap-4 bg-surface hover:bg-surface-2 rounded-2xl px-4 py-3.5 cursor-pointer">
            <span className="text-gray-500"><ImageIcon size={22} /></span>
            <span className="text-sm font-medium text-gray-800">Pasirinkti iš galerijos</span>
            <input type="file" accept="image/*" className="hidden"
              onChange={e => { onFileSelect(e.target.files[0]); e.target.value = '' }} />
          </label>
          <button disabled={fetching}
            className="w-full flex items-center gap-4 bg-surface hover:bg-surface-2 rounded-2xl px-4 py-3.5 disabled:opacity-50"
            onClick={onWikimedia}>
            <span className="text-gray-500">{fetching ? <Loader2 size={22} className="animate-spin" /> : <Search size={22} />}</span>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-800">{fetching ? 'Ieškoma...' : 'Atnaujinti iš iNaturalist'}</p>
              <p className="text-xs text-gray-400 italic">{plant.lotyniskas}</p>
            </div>
          </button>
          <button className="w-full py-3.5 rounded-2xl text-sm font-medium text-gray-500 bg-surface-2 mt-1" onClick={onClose}>
            Atšaukti
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export default function PlantCard({ plant, section, onTap, onImageFetch, cardBg = 'bg-white', showDashboardBadge = false }) {
  const [imgError, setImgError]             = useState(false)
  const [showPhotoSheet, setShowPhotoSheet] = useState(false)
  const [fetchingWiki, setFetchingWiki]     = useState(false)

  useEffect(() => { setImgError(false) }, [plant.image])

  const handleFileSelect = async (file) => {
    if (!file) return
    setShowPhotoSheet(false)
    try { onImageFetch?.(plant.id, await resizeImage(file)) } catch {}
  }

  const handleWikimedia = async () => {
    setFetchingWiki(true)
    try {
      const url = await fetchWikimediaImage(plant.lotyniskas)
      if (url) onImageFetch?.(plant.id, url)
    } finally { setFetchingWiki(false); setShowPhotoSheet(false) }
  }

  const { wasFired, ...longPressProps } = useLongPress(() => setShowPhotoSheet(true))
  const status    = plant.status ?? 'healthy'
  const hasImage  = plant.image && !imgError
  const fertFC      = section === 'auginama' ? getFertilizingForecast(plant) : null
  const fertOverdue = fertFC?.isOverdue ?? false
  const dormFC      = section === 'auginama' ? getDormancyForecast(plant) : null

  const bgClass = section === 'history'  ? 'bg-surface-2'
    : section === 'nori'     ? 'bg-blush-50'
    : 'bg-sage-50'

  return (
    <>
      <div
        className={`${cardBg} rounded-2xl overflow-hidden shadow-ios-card active:scale-95 transition-transform duration-100 cursor-pointer`}
        onClick={onTap}
      >
        {/* Image area */}
        <div
          className={`relative aspect-square overflow-hidden select-none ${!hasImage ? bgClass : ''}`}
          {...longPressProps}
          onClick={e => { if (wasFired()) e.stopPropagation() }}
          onContextMenu={e => e.preventDefault()}
        >
          {hasImage ? (
            <img src={plant.image} alt={plant.lietuviškas}
              className="w-full h-full object-cover pointer-events-none"
              onError={() => setImgError(true)} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl">
              {plant.emoji ?? '🌿'}
            </div>
          )}

          {/* Status dot */}
          <div className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm ${
            status === 'healthy'    ? 'bg-green-400'  :
            status === 'sick'       ? 'bg-orange-400' :
            status === 'quarantine' ? 'bg-red-500'    :
                                     'bg-green-400'
          }`} />

          {/* Right-side badge column — stacks below status dot */}
          {(showDashboardBadge || plant.pirkinys) && (
            <div className="absolute top-6 right-1.5 flex flex-col gap-1">
              {showDashboardBadge && (
                <div className="bg-sage-500/90 backdrop-blur-sm rounded-md p-0.5">
                  <House size={10} className="text-white" />
                </div>
              )}
              {plant.pirkinys && (
                <div className="bg-orange-500/90 backdrop-blur-sm rounded-md p-0.5">
                  <ShoppingCart size={10} className="text-white" />
                </div>
              )}
            </div>
          )}

          {/* Toxic badge */}
          {plant.toksiskas && (
            <div className="absolute top-2 left-2 bg-red-500/90 backdrop-blur-sm rounded-lg px-1.5 py-0.5">
              <span className="flex items-center gap-0.5 text-[9px] text-white font-bold"><Skull size={9} /> TOKSIŠKA</span>
            </div>
          )}

          {/* Section badges */}
          {section === 'istorija' && !plant.toksiskas && (
            <div className="absolute top-2 left-2 bg-black/35 backdrop-blur-sm rounded-md px-1.5 py-0.5">
              <span className="text-[9px] text-white font-semibold">RIP</span>
            </div>
          )}

          {/* Fertilizing overdue badge */}
          {fertOverdue && (
            <div className="absolute bottom-2 right-2 bg-orange-500/90 backdrop-blur-sm rounded-lg px-1.5 py-0.5">
              <span className="flex items-center gap-0.5 text-[9px] text-white font-bold"><Leaf size={9} /> +{Math.abs(fertFC.daysUntil)}d</span>
            </div>
          )}

          {/* Dormancy badge — bottom-left, independent of fertilizing */}
          {dormFC && (
            <div className={`absolute bottom-2 left-2 backdrop-blur-sm rounded-lg px-1.5 py-0.5 ${
              dormFC.window === 'active'     ? 'bg-blue-500/90' :
              dormFC.window === 'waking'     ? 'bg-green-500/90' :
                                               'bg-amber-500/90'
            }`}>
              <span className="flex items-center gap-0.5 text-[9px] text-white font-bold">
                {dormFC.window === 'active'
                  ? <><Moon size={9} /> Miega</>
                  : dormFC.window === 'waking'
                    ? <><Sprout size={9} /> Žadinti</>
                    : <><Snowflake size={9} /> Ruoštis</>}
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="px-2.5 pt-2 pb-2.5">
          <h3 className="text-[13px] font-bold text-gray-950 leading-tight line-clamp-2">
            {plant.lietuviškas}
          </h3>
          <p className="text-[10px] text-gray-600 italic mt-0.5 truncate">{plant.lotyniskas}</p>

          {/* Indicators */}
          <div className="flex items-center gap-2.5 mt-2">
            {plant.sviesa?.taskai != null && (
              <div className="flex items-center gap-1">
                <Sun size={12} className="text-amber-400" />
                <DotScore value={plant.sviesa.taskai} color="bg-amber-400" />
                {plant.sviesa?.ppfd && (
                  <span className="text-[9px] text-amber-500 font-medium leading-none">
                    {plant.sviesa.ppfd.min}–{plant.sviesa.ppfd.max}
                  </span>
                )}
              </div>
            )}
            {plant.vanduo?.taskai != null && (
              <div className="flex items-center gap-1">
                <Droplets size={12} className="text-blue-400" />
                <DotScore value={plant.vanduo.taskai} color="bg-blue-400" />
              </div>
            )}
            {plant.sunkumas != null && (
              <div className="flex items-center gap-1">
                <Star size={11} className="text-amber-400 fill-amber-400" />
                <span className="text-[10px] font-semibold text-gray-700">{plant.sunkumas}/5</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showPhotoSheet && (
          <PhotoActionSheet
            key="photo-sheet"
            plant={plant}
            onClose={() => setShowPhotoSheet(false)}
            onFileSelect={handleFileSelect}
            onWikimedia={handleWikimedia}
            fetching={fetchingWiki}
          />
        )}
      </AnimatePresence>
    </>
  )
}
