import { useState } from 'react'
import { ChevronRight, Sparkles, Heart, ShoppingBag } from 'lucide-react'

/**
 * ShopWidget — demo „pasiūlymas iš tiekėjo" kortelė. Rodo augalų pasiūlymus,
 * kuriuos vartotojas galėtų pridėti į biblioteką arba pirkti pas tiekėją.
 *
 * Šiame etape — naudoja LOCAL_OFFERS array'ų (mock duomenys). Vėliau galima
 * integruoti su realia partner API.
 *
 * Props:
 *   onAddToWishlist — (offer) => void; „Į biblioteką" CTA.
 *   onBuy           — (offer) => void; „Pirkti" CTA. Default — atveria
 *                     offer.shopUrl naujam tab'e.
 */

const LOCAL_OFFERS = [
  {
    name: 'Filodendras „Birkin"',
    latin: 'Philodendron Birkin',
    supplier: 'Žalumos krautuvė',
    price: '€18',
    emoji: '🌿',
    bgGradient: 'linear-gradient(135deg, #1f4d36 0%, #3a8a5a 60%, #5fae7c 100%)',
    shopUrl: 'https://example.com/birkin',
  },
  {
    name: 'Anthuris',
    latin: 'Anthurium andraeanum',
    supplier: 'Dvaras orchidėjom',
    price: '€22',
    emoji: '🌺',
    bgGradient: 'linear-gradient(140deg, #6a3a4d 0%, #c2647a 50%, #e8a5b5 100%)',
    shopUrl: 'https://example.com/anthurium',
  },
  {
    name: 'Kalatėja „Orbifolia"',
    latin: 'Calathea orbifolia',
    supplier: 'Vilniaus botanikos sodas',
    price: '€26',
    emoji: '🌱',
    bgGradient: 'linear-gradient(150deg, #2d4a32 0%, #4a7549 50%, #8aa861 100%)',
    shopUrl: 'https://example.com/calathea',
  },
  {
    name: 'Pakalnutė',
    latin: 'Convallaria majalis',
    supplier: 'Sodybų augalai',
    price: '€8',
    emoji: '🌸',
    bgGradient: 'linear-gradient(155deg, #4a3a6a 0%, #8a7ab0 50%, #c4b8d8 100%)',
    shopUrl: 'https://example.com/convallaria',
  },
  {
    name: 'Sansevieria „Black Coral"',
    latin: 'Dracaena trifasciata',
    supplier: 'Žalumos krautuvė',
    price: '€15',
    emoji: '🌵',
    bgGradient: 'linear-gradient(150deg, #2d4a32 0%, #4a7549 50%, #8aa861 100%)',
    shopUrl: 'https://example.com/sansevieria',
  },
]

// Single compact offer card — naudojamas 2-grid'e ShopWidget'e.
function OfferCard({ offer, onAddToWishlist, onBuy }) {
  const handleBuy = () => {
    if (onBuy) onBuy(offer)
    else window.open(offer.shopUrl, '_blank', 'noopener')
  }
  return (
    <div className="bg-white/70 backdrop-blur rounded-xl overflow-hidden border border-white/40 flex flex-col">
      {/* Photo strip */}
      <div className="relative h-16" style={{ background: offer.bgGradient }}>
        <div className="absolute inset-0" style={{
          backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 8px, rgba(0,0,0,0.04) 8px, rgba(0,0,0,0.04) 16px)',
        }} />
        <div className="absolute inset-0 flex items-center justify-center text-3xl mix-blend-luminosity opacity-90">
          {offer.emoji}
        </div>
      </div>

      {/* Body */}
      <div className="px-2.5 pt-2 pb-2.5 flex-1 flex flex-col">
        <h4 className="text-[12px] font-bold text-gray-900 leading-tight line-clamp-1">{offer.name}</h4>
        <p className="text-[10px] text-gray-500 italic mt-0.5 line-clamp-1">{offer.latin}</p>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[11px] font-bold text-gray-800 tabular-nums">{offer.price}</span>
          <span className="text-[9px] text-gray-400 truncate max-w-[80px]">{offer.supplier}</span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-1 mt-2">
          {onAddToWishlist && (
            <button
              onClick={() => onAddToWishlist(offer)}
              className="flex-1 inline-flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors text-[10.5px] font-semibold"
              title="Į biblioteką (norų sąrašą)"
            >
              <Heart size={11} />Noriu
            </button>
          )}
          <button
            onClick={handleBuy}
            className="flex-1 inline-flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-lg bg-sage-500 text-white hover:bg-sage-600 transition-colors text-[10.5px] font-semibold"
            title="Pirkti pas tiekėją"
          >
            <ShoppingBag size={11} />Pirkti
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ShopWidget({ onAddToWishlist, onBuy }) {
  // idx — pirmojo iš dviejų rodomų offer'ių indeksas. „Kitas >" advansuoja per 1.
  // Wraps modulu LOCAL_OFFERS.length, kad cikliškai grįžtų prie pradžios.
  const [idx, setIdx] = useState(0)
  const a = LOCAL_OFFERS[idx % LOCAL_OFFERS.length]
  const b = LOCAL_OFFERS[(idx + 1) % LOCAL_OFFERS.length]
  const next = () => setIdx(i => (i + 1) % LOCAL_OFFERS.length)

  return (
    <div className="bg-white/55 backdrop-blur-xl rounded-2xl shadow-[0_4px_24px_rgba(20,40,30,0.06)] border border-white/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2.5">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
          <Sparkles size={12} className="text-amber-500" />
          Pasiūlymai
        </p>
        <button
          onClick={next}
          className="text-[11px] font-semibold text-sage-600 hover:text-sage-700 inline-flex items-center gap-0.5"
          title="Sekantys pasiūlymai"
        >
          Kitas <ChevronRight size={12} />
        </button>
      </div>

      {/* 2-grid */}
      <div className="grid grid-cols-2 gap-2 px-3 pb-3">
        <OfferCard offer={a} onAddToWishlist={onAddToWishlist} onBuy={onBuy} />
        <OfferCard offer={b} onAddToWishlist={onAddToWishlist} onBuy={onBuy} />
      </div>
    </div>
  )
}
