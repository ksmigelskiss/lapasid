import { Droplets } from 'lucide-react'
import { plPlants } from '../constants/careCopy'

/**
 * Po tręšimo paklausimas: "ar palaistei?"
 * Naudojama Dashboard care mode bulk action ir CareWateringSheet single-plant kortelėje.
 * Vienas šaltinis = vienas UX visiems care veiksmams.
 *
 * Komponentas yra "pure content" — be savo wrapper'io. Skambintojas pats apgaubia
 * (Dashboard care bar — į balta kortelę su shadow; sheet — naudoja sheet'o action bar).
 *
 * count: kiek augalų ką tik patręšta (1+ — sufoarmuoja antraštę)
 * onPalasciau: jeigu paspaudžia — turi įrašyti `watering` event'us
 * onNelasciau: jei paspaudžia — tiesiog uždaryti / dismiss
 */
export default function PostFertilizePrompt({ count = 1, onPalasciau, onNelasciau }) {
  const subtitle = count === 1
    ? 'Patręšta · ar palaistei?'
    : `Patręšta ${count} ${plPlants(count)} · ar palaistei?`

  return (
    <>
      <p className="text-[11px] font-medium text-gray-500 mb-2 px-1">{subtitle}</p>
      <div className="flex gap-2 items-center">
        <button
          onClick={onPalasciau}
          className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-xl bg-sky-500 active:bg-sky-600 transition-colors"
        >
          <Droplets size={16} className="text-white" />
          <span className="text-sm font-bold text-white">Palaisčiau</span>
        </button>
        <button
          onClick={onNelasciau}
          className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-xl bg-gray-100 active:bg-gray-200 transition-colors"
        >
          <span className="text-sm font-bold text-gray-700">Nelaisčiau</span>
        </button>
      </div>
    </>
  )
}
