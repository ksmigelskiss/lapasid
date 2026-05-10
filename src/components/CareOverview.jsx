import { useState } from 'react'
import { Droplets, FlaskConical, Moon, Sprout, Snowflake, ChevronUp, ChevronDown } from 'lucide-react'
import { getWateringForecast, shouldShowWateringAlert } from '../utils/wateringForecast'
import { getFertilizingForecast } from '../utils/fertilizingForecast'
import { getDormancyForecast } from '../utils/dormancyForecast'

// `withList` — kai true, perduoda Section.plants kaip 2-ą onTap argumentą
// (CareWateringSheet navigacijai). Dormancy sekcijoms — false (nėra cycle reikalo).
function Section({ bg, labelColor, chipBg, chipText, badgeColor, icon, label, plants, renderBadge, onTap, withList = false }) {
  if (plants.length === 0) return null
  return (
    <div className={`${bg} rounded-2xl px-3 py-2.5`}>
      <p className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider mb-2 ${labelColor}`}>
        {icon} {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {plants.map(p => (
          <button
            key={p.id}
            onClick={() => withList ? onTap(p, plants) : onTap(p)}
            className={`flex items-center gap-1 ${chipBg} rounded-xl px-2.5 py-1 active:opacity-70 transition-opacity`}
          >
            <span className={`text-[11px] font-medium max-w-[90px] truncate ${chipText}`}>{p.lietuviškas}</span>
            {renderBadge && (
              <span className={`text-[10px] font-semibold ml-0.5 ${badgeColor}`}>{renderBadge(p)}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// „Labas rytas / dienai / vakaras / nakt" pagal valandą.
function timeGreeting() {
  const h = new Date().getHours()
  if (h >= 5  && h < 12) return 'Labas rytas'
  if (h >= 12 && h < 18) return 'Laba diena'
  if (h >= 18 && h < 23) return 'Labas vakaras'
  return 'Labanakt'
}

// Vardas iš Google displayName (pirmas žodis), arba „svečias" jei viewer.
function userFirstName(user) {
  if (!user) return 'svečias'
  const name = user.displayName?.trim() || user.email?.split('@')[0]
  return name?.split(/\s+/)[0] || 'svečias'
}

// Lietuviška „augalas" žodžio galūnė pagal kiekį (1 augalas, 2-9 augalai, 0/10-19/.. augalų).
function plAugal(n) {
  const lastTwo = n % 100
  const last    = n % 10
  if (lastTwo >= 11 && lastTwo <= 19) return 'augalų'
  if (last === 1) return 'augalas'
  if (last >= 2 && last <= 9)  return 'augalai'
  return 'augalų'
}

// Kvietikliškas subline'as: laistymas yra „gali būti", tręšimas — „prašo valgyti"
//   (laistymo tikslumas priklauso nuo daug parametrų, tręšimas — aiški cikliška sistema).
function buildSubline(waterCount, fertCount) {
  if (waterCount === 0 && fertCount === 0) return 'Visi augalai laimingi 🌿'
  const parts = []
  if (waterCount > 0) parts.push(`${waterCount} ${plAugal(waterCount)} gali būti ištroškę`)
  if (fertCount > 0)  parts.push(`${fertCount} ${plAugal(fertCount)} prašo valgyti`)
  return parts.join(' · ')
}

/**
 * Visų care list'ų skaičiavimai vienoj vietoj — leidžia ir greeting'ui ir
 * popup'ui dalintis tomis pačiomis reikšmėmis.
 */
export function useCareLists(plants) {
  const wateringList = plants.filter(p => shouldShowWateringAlert(p))
  const fertList     = plants.filter(p => getFertilizingForecast(p).isOverdue)
  const wakingList   = plants.filter(p => getDormancyForecast(p)?.window === 'waking')
  const dormingList  = plants.filter(p => getDormancyForecast(p)?.window === 'active')
  const approachList = plants.filter(p => getDormancyForecast(p)?.window === 'approaching')
  const total = wateringList.length + fertList.length + wakingList.length + dormingList.length + approachList.length
  return { wateringList, fertList, wakingList, dormingList, approachList, total }
}

/**
 * CareSummaryList — visos sekcijos (laistymas / tręšimas / dormancy).
 * Naudojama:
 *  - inline CareOverview (mobile)
 *  - bell popup (desktop)
 */
export function CareSummaryList({ plants, onTap, onWaterTap }) {
  const lists = useCareLists(plants)
  return (
    <div className="space-y-2">
      <Section
        bg="bg-sky-50" labelColor="text-sky-600" chipBg="bg-sky-100" chipText="text-sky-900" badgeColor="text-sky-500"
        icon={<Droplets size={11} />}
        label="Patikrink ar ne sausi"
        plants={lists.wateringList}
        renderBadge={p => { const d = getWateringForecast(p).daysUntil; return d != null ? `+${Math.abs(d)}d` : null }}
        onTap={onWaterTap ?? onTap}
        withList
      />
      <Section
        bg="bg-amber-50" labelColor="text-amber-600" chipBg="bg-amber-100" chipText="text-amber-900" badgeColor="text-amber-500"
        icon={<FlaskConical size={11} />}
        label="Pamaitink augalėlį"
        plants={lists.fertList}
        renderBadge={p => { const d = getFertilizingForecast(p).daysUntil; return d != null ? `+${Math.abs(d)}d` : null }}
        onTap={onWaterTap ?? onTap}
        withList
      />
      <Section
        bg="bg-gray-50" labelColor="text-green-700" chipBg="bg-white" chipText="text-gray-800" badgeColor="text-gray-400"
        icon={<Sprout size={11} />}
        label="Palengva žadink"
        plants={lists.wakingList}
        onTap={onTap}
      />
      <Section
        bg="bg-gray-50" labelColor="text-blue-600" chipBg="bg-white" chipText="text-gray-800" badgeColor="text-gray-400"
        icon={<Moon size={11} />}
        label="Miega"
        plants={lists.dormingList}
        onTap={onTap}
      />
      <Section
        bg="bg-gray-50" labelColor="text-orange-500" chipBg="bg-white" chipText="text-gray-800" badgeColor="text-gray-400"
        icon={<Snowflake size={11} />}
        label="Ruošiasi miegui"
        plants={lists.approachList}
        onTap={onTap}
      />
    </div>
  )
}

/**
 * CareOverview — greeting + (opcionalus) summary.
 *
 * Props:
 *   plants       — augalų masyvas (mainPlants)
 *   onTap        — augalo tap iš dormancy chip
 *   onWaterTap   — augalo tap iš water/fert chip (kviečia CareWateringSheet)
 *   user         — auth user (greeting'ui)
 *   defaultOpen  — ar santrauka iš pradžių išskleista (mobile)
 *   mode         — 'inline' (default, mobile) | 'greeting' (tik kreipinys, be summary) | 'summary' (tik summary, be greeting)
 *   bigGreeting  — kai true, h1 + didesnis šriftas (desktop „hero" greeting'as)
 */
export default function CareOverview({
  plants, onTap, onWaterTap, defaultOpen = false, user,
  mode = 'inline', bigGreeting = false,
}) {
  const [open, setOpen] = useState(defaultOpen)
  const lists = useCareLists(plants)

  // Tylus state — niekas nerodo, bet ir lieka neutraliai (nėra ką rašyt apie 0 augalų)
  if (lists.total === 0 && mode !== 'greeting') return null
  // 'greeting' režimas — visada rodom kreipinį, net jei 0 augalų reikalauja priežiūros

  const greeting = `${timeGreeting()}, ${userFirstName(user)}`
  const subline  = buildSubline(lists.wateringList.length, lists.fertList.length)

  // 'summary' režimas — tik sąrašas, be kortelės wrapper'io (popup'ui)
  if (mode === 'summary') {
    return <CareSummaryList plants={plants} onTap={onTap} onWaterTap={onWaterTap} />
  }

  // 'greeting' režimas — tik kreipinys, jokio summary expand'o
  if (mode === 'greeting') {
    return (
      <div className={bigGreeting ? '' : 'mb-4'}>
        {bigGreeting ? (
          // Inline: didelis greeting + smulki subline subtle-padded į dešinę,
          // baseline-aligned. flex-wrap leidžia subline užšokti į kitą eilutę
          // kai viewport siauras (~lg breakpoint).
          <div className="flex items-baseline gap-x-4 gap-y-1 flex-wrap">
            <h1 className="text-[28px] sm:text-[32px] font-extrabold text-gray-950 leading-tight tracking-tight">{greeting}</h1>
            <p className="text-sm text-gray-500">{subline}</p>
          </div>
        ) : (
          <>
            <h2 className="text-base font-bold text-gray-900 leading-tight">{greeting}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{subline}</p>
          </>
        )}
      </div>
    )
  }

  // 'inline' režimas (default, mobile) — greeting + summary toggle
  return (
    <div className="mb-4 bg-white rounded-2xl overflow-hidden shadow-ios-card">
      <div className="px-4 pt-3 pb-2 border-b border-gray-100">
        <h2 className="text-base font-bold text-gray-900 leading-tight">{greeting}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{subline}</p>
      </div>

      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 active:bg-surface transition-colors"
      >
        <Sprout size={15} className="text-sage-500 flex-shrink-0" />
        <p className="text-sm font-bold text-gray-800 flex-1 text-left">Priežiūros santrauka ({lists.total})</p>
        {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-3 pb-3">
          <CareSummaryList plants={plants} onTap={onTap} onWaterTap={onWaterTap} />
        </div>
      )}
    </div>
  )
}
