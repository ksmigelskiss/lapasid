import { useState } from 'react'
import { ChevronRight, Sparkles, Heart } from 'lucide-react'

/**
 * ShopWidget — demo „pasiūlymas iš tiekėjo" kortelė. Rodo augalų pasiūlymus,
 * kuriuos vartotojas galėtų pridėti į biblioteką (Noriu sąrašą).
 *
 * Šiame etape — naudoja LOCAL_OFFERS array'ų (mock duomenys). Vėliau galima
 * integruoti su realia partner API (pvz. „Vasara" botanikos sodas, „Žaluma"
 * augalų parduotuvė).
 *
 * Props:
 *   onAddToWishlist — (offer) => void; kviečiamas paspaudus „Pridėti"
 *                     mygtuką. Galima neperduoti — tada CTA paslepiamas.
 */

// Mock pasiūlymų pool. Realioj versijoj ateis iš API arba serverio config.
const LOCAL_OFFERS = [
  {
    name: 'Filodendras „Birkin"',
    latin: 'Philodendron Birkin',
    supplier: 'Žalumos krautuvė',
    price: '€18',
    emoji: '🌿',
    bgGradient: 'linear-gradient(135deg, #1f4d36 0%, #3a8a5a 60%, #5fae7c 100%)',
    blurb: 'Nauja partija — baltais ruožais ant tamsiai žalių lapų.',
  },
  {
    name: 'Anthuris',
    latin: 'Anthurium andraeanum',
    supplier: 'Dvaras orchidėjom',
    price: '€22',
    emoji: '🌺',
    bgGradient: 'linear-gradient(140deg, #6a3a4d 0%, #c2647a 50%, #e8a5b5 100%)',
    blurb: 'Raudoni žiedai ištisus metus — ideal šviesiam kambariui.',
  },
  {
    name: 'Kalatėja „Orbifolia"',
    latin: 'Calathea orbifolia',
    supplier: 'Vilniaus botanikos sodas',
    price: '€26',
    emoji: '🌱',
    bgGradient: 'linear-gradient(150deg, #2d4a32 0%, #4a7549 50%, #8aa861 100%)',
    blurb: 'Apvalūs sidabrinių dryžių lapai — vakaro poreikia drėgmės.',
  },
  {
    name: 'Pakalnutė',
    latin: 'Convallaria majalis',
    supplier: 'Sodybų augalai',
    price: '€8',
    emoji: '🌸',
    bgGradient: 'linear-gradient(155deg, #4a3a6a 0%, #8a7ab0 50%, #c4b8d8 100%)',
    blurb: 'Pavasarinis kvapas — kambary žydės kovo–gegužės mėn.',
  },
]

export default function ShopWidget({ onAddToWishlist }) {
  const [idx, setIdx] = useState(0)
  const offer = LOCAL_OFFERS[idx % LOCAL_OFFERS.length]
  const next = () => setIdx(i => (i + 1) % LOCAL_OFFERS.length)

  return (
    <div className="bg-white/95 backdrop-blur rounded-2xl shadow-[0_2px_12px_rgba(20,40,30,0.08)] border border-white/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
          <Sparkles size={12} className="text-amber-500" />
          Pasiūlymas
        </p>
        <button
          onClick={next}
          className="text-[11px] font-semibold text-sage-600 hover:text-sage-700 inline-flex items-center gap-0.5"
          title="Kitas pasiūlymas"
        >
          Kitas <ChevronRight size={12} />
        </button>
      </div>

      {/* Photo strip — gradient + emoji centered */}
      <div className="relative h-24 mx-4 rounded-xl overflow-hidden" style={{ background: offer.bgGradient }}>
        <div className="absolute inset-0" style={{
          backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 8px, rgba(0,0,0,0.04) 8px, rgba(0,0,0,0.04) 16px)',
        }} />
        <div className="absolute inset-0 flex items-center justify-center text-4xl mix-blend-luminosity opacity-90">
          {offer.emoji}
        </div>
      </div>

      {/* Body — name, latin, blurb, price + CTA */}
      <div className="px-4 pt-2.5 pb-3">
        <h4 className="text-sm font-bold text-gray-900 leading-tight">{offer.name}</h4>
        <p className="text-[11px] text-gray-500 italic mt-0.5">{offer.latin}</p>
        <p className="text-[11.5px] text-gray-600 leading-snug mt-1.5">{offer.blurb}</p>
        <div className="flex items-center justify-between mt-2.5">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400">{offer.supplier}</span>
            <span className="text-sm font-bold text-gray-900 tabular-nums leading-tight">{offer.price}</span>
          </div>
          {onAddToWishlist && (
            <button
              onClick={() => onAddToWishlist(offer)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors text-[11.5px] font-semibold"
            >
              <Heart size={12} />Į biblioteką
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
