import { motion } from 'framer-motion'
import { Camera, Image as ImageIcon } from 'lucide-react'

// WelcomePhotoSheet — 2026-06-02. Pasirodo iškart, kai augalas patenka į
// „Auginu" dashboard (iš bibliotekos „įsigyjau", search „įsigyjau", resurrect).
// Pasiūlo nufotografuoti augalą → foto eina į timeline kaip PIRMA istorijos
// nuotrauka → automatiškai tampa hero/widget (addTimelineEvent useHistoryPhoto
// sync). Skippable („Vėliau") — tada lieka watercolor hero. Capture flow toks
// pat kaip PlantDetail hero-camera: resizeImage → addTimelineEventWithUpload.
export default function WelcomePhotoSheet({ plant, onCapture, onClose }) {
  const handleFile = (file) => { if (file) onCapture(file) }
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center">
      <motion.div
        className="absolute inset-0 bg-forest-800/55 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }} onPointerDown={onClose}
      />
      <motion.div
        className="relative w-full max-w-[430px] bg-bone-50 rounded-t-4xl px-4 pt-3 pb-8 border-t border-bone-400/40"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        onPointerDown={e => e.stopPropagation()}
      >
        <div className="flex justify-center pb-3">
          <div className="w-10 h-1 bg-bone-400/60 rounded-full" />
        </div>
        <p className="font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.18em] text-center mb-1.5">
          Naujas augalas
        </p>
        <h3 className="font-display text-lg font-semibold tracking-tight text-forest-800 text-center">
          {plant?.lietuviškas || 'Sveikas atvykęs!'} 🌱
        </h3>
        <p className="text-sm text-forest-600 text-center mt-1.5 mb-5 px-3">
          Nufotografuok jį — tai bus pirmoji istorijos nuotrauka ir augalo veidas kortelėje.
        </p>

        <div className="space-y-2">
          <label className="flex items-center gap-4 bg-forest-600 hover:bg-forest-700 rounded-2xl px-4 py-3.5 cursor-pointer transition-colors">
            <span className="text-bone"><Camera size={22} /></span>
            <span className="font-display text-sm font-semibold tracking-tight text-bone">Fotografuoti</span>
            <input type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => { handleFile(e.target.files?.[0]); e.target.value = '' }} />
          </label>
          <label className="flex items-center gap-4 bg-bone-50 border border-bone-400/40 hover:bg-bone-300/40 rounded-2xl px-4 py-3.5 cursor-pointer transition-colors">
            <span className="text-forest-500"><ImageIcon size={22} /></span>
            <span className="font-display text-sm font-semibold tracking-tight text-forest-800">Įkelti iš įrenginio</span>
            <input type="file" accept="image/*" className="hidden"
              onChange={e => { handleFile(e.target.files?.[0]); e.target.value = '' }} />
          </label>
        </div>

        <button
          onClick={onClose}
          className="w-full h-12 mt-2 rounded-btn font-display text-sm font-semibold text-forest-600 bg-bone-300 hover:bg-bone-400/70 transition-colors"
        >
          Vėliau
        </button>
      </motion.div>
    </div>
  )
}
