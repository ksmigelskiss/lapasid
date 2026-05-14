import { useEffect, useState } from 'react'
import { ChevronRight, Sparkles, Heart, ShoppingBag, ChevronDown } from 'lucide-react'
import { useCollapsible } from '../../hooks/useCollapsible'
import { fetchPhotos } from '../../utils/imageService'

// Modulinis cache — offer'iai pasikartoja per idx rotaciją, fetch'iname
// kiekvienai latin name vienąkart per sesiją.
const photoCache = new Map()  // latin -> string | Promise<string|null>

function useOfferPhoto(latin) {
  const [url, setUrl] = useState(() => {
    const cached = photoCache.get(latin)
    return typeof cached === 'string' ? cached : null
  })

  useEffect(() => {
    if (!latin || url) return
    let cached = photoCache.get(latin)
    if (typeof cached === 'string') { setUrl(cached); return }
    if (!cached) {
      // fetchPhotos turi genus-level fallback'ą (svarbu cultivar'ams kaip
      // „Philodendron Birkin", kurių pilno latin name'o nėra iNaturalist
      // taxon'uose). Imam pirmą array elementą.
      cached = fetchPhotos(latin).then(arr => {
        const u = arr?.[0] ?? null
        if (u) photoCache.set(latin, u)
        else photoCache.delete(latin)  // leidžiam retry kitą sesiją
        return u
      })
      photoCache.set(latin, cached)
    }
    let cancelled = false
    cached.then(u => { if (!cancelled && u) setUrl(u) })
    return () => { cancelled = true }
  }, [latin, url])

  return url
}

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
//
// Mygtukai („Noriu" / „Pirkti") yra PURE MOCKUP — paspaudus reaguoja tik
// vizualiai (active:scale + hover bg), bet nieko nepriduria į biblioteką
// ir niekur neveda. Vėliau (kai bus realus partner integration), reikės
// pridėti onClick handler'ius su tinkamu data flow'u.
function OfferCard({ offer }) {
  const photo = useOfferPhoto(offer.latin)
  return (
    <div className="bg-white/70 backdrop-blur rounded-xl overflow-hidden border border-white/40 flex flex-col">
      {/* Photo strip — dynamic real photo (iNaturalist/Wikipedia per fetchPhotos
          su genus fallback'u) ant gradient + emoji placeholder'io. */}
      <div className="relative h-16" style={{ background: offer.bgGradient }}>
        {photo ? (
          <img
            src={photo}
            alt={offer.name}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <>
            <div className="absolute inset-0" style={{
              backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 8px, rgba(0,0,0,0.04) 8px, rgba(0,0,0,0.04) 16px)',
            }} />
            <div className="absolute inset-0 flex items-center justify-center text-3xl mix-blend-luminosity opacity-90">
              {offer.emoji}
            </div>
          </>
        )}
      </div>

      {/* Body — kompaktiški padding'ai/gap'ai, kad widget telptų vienoj eilutėj */}
      <div className="px-2.5 pt-1.5 pb-2 flex-1 flex flex-col">
        <h4 className="text-[12px] font-bold text-gray-900 leading-tight line-clamp-1">{offer.name}</h4>
        <p className="text-[10px] text-gray-500 italic mt-0.5 line-clamp-1">{offer.latin}</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[11px] font-bold text-gray-800 tabular-nums">{offer.price}</span>
          <span className="text-[9px] text-gray-400 truncate max-w-[80px]">{offer.supplier}</span>
        </div>

        {/* Mockup mygtukai — animuojasi, bet nieko nedaro */}
        <div className="flex gap-1 mt-1.5">
          <button
            type="button"
            className="flex-1 inline-flex items-center justify-center gap-1 px-1.5 py-1 rounded-lg bg-terracotta-50 text-terracotta-600 hover:bg-terracotta-100 active:scale-[0.97] transition-all text-[10.5px] font-semibold"
            title="(Demo) Į biblioteką"
          >
            <Heart size={11} />Noriu
          </button>
          <button
            type="button"
            className="flex-1 inline-flex items-center justify-center gap-1 px-1.5 py-1 rounded-lg bg-forest-500 text-bone hover:bg-forest-600 active:scale-[0.97] transition-all text-[10.5px] font-semibold"
            title="(Demo) Pirkti pas tiekėją"
          >
            <ShoppingBag size={11} />Pirkti
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ShopWidget() {
  const [collapsed, toggle] = useCollapsible('shop', false)
  const [idx, setIdx] = useState(0)
  const a = LOCAL_OFFERS[idx % LOCAL_OFFERS.length]
  const b = LOCAL_OFFERS[(idx + 1) % LOCAL_OFFERS.length]
  const next = (e) => {
    e.stopPropagation() // kad header click'as netrigerintų collapse
    setIdx(i => (i + 1) % LOCAL_OFFERS.length)
  }

  return (
    <div className="bg-bone-50 rounded-2xl shadow-[0_4px_24px_rgba(20,40,30,0.06)] border border-white/40 overflow-hidden">
      {/* Header — visada matomas, click toggleina collapse. „Kitas" mygtukas
          stopProp'ina, kad nesutrigerintų collapse'o. */}
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/30 transition-colors"
        aria-expanded={!collapsed}
      >
        <p className="inline-flex items-center gap-1.5 font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.18em]">
          <Sparkles size={12} className="text-terracotta" />
          Parduotuvių naujienos
        </p>
        <div className="inline-flex items-center gap-2.5">
          {!collapsed && (
            <span
              onClick={next}
              className="text-[11px] font-semibold text-forest-600 hover:text-forest-700 inline-flex items-center gap-0.5 cursor-pointer"
              title="Sekantys pasiūlymai"
            >
              Kitas <ChevronRight size={12} />
            </span>
          )}
          <ChevronDown size={14} className={`text-forest-400 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </div>
      </button>

      {/* 2-grid — slepiamas kai collapsed */}
      {!collapsed && (
        <div className="grid grid-cols-2 gap-2 px-3 pb-3">
          <OfferCard offer={a} />
          <OfferCard offer={b} />
        </div>
      )}
    </div>
  )
}
