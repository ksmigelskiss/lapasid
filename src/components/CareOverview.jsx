import { useState } from 'react'
import { Droplets, FlaskConical, Moon, Sprout, Snowflake, ChevronUp, ChevronDown } from 'lucide-react'
import { getWateringForecast, shouldShowWateringAlert } from '../utils/wateringForecast'
import { getFertilizingForecast } from '../utils/fertilizingForecast'
import { getDormancyForecast } from '../utils/dormancyForecast'
import AccuracyButton from './AccuracyButton'

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
// Grąžina array of strings — render'is flex-wrap, kad natūraliai išsiplėstų į
// multi-line kai segmentų atsiras daugiau ar pavadinimai bus ilgesni.
function buildSublineParts(waterCount, fertCount) {
  const parts = []
  if (waterCount > 0) parts.push(`${waterCount} ${plAugal(waterCount)} gali būti ištroškę`)
  if (fertCount > 0)  parts.push(`${fertCount} ${plAugal(fertCount)} prašo valgyti`)
  return parts
}

// Subline render'is — flex-wrap su mid-dot separator'iais. Tuščio state'o atveju
// rodom „Visi augalai laimingi" pranešimą.
function Subline({ parts, className }) {
  if (parts.length === 0) return <p className={className}>Visi augalai laimingi 🌿</p>
  return (
    <div className={`flex flex-wrap gap-x-2 gap-y-0.5 ${className}`}>
      {parts.map((part, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          {i > 0 && <span aria-hidden className="text-gray-300">·</span>}
          {part}
        </span>
      ))}
    </div>
  )
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
        bg="bg-forest-50" labelColor="text-forest-600" chipBg="bg-forest-100" chipText="text-forest-800" badgeColor="text-forest-500"
        icon={<Droplets size={11} />}
        label="Patikrink ar ne sausi"
        plants={lists.wateringList}
        renderBadge={p => { const d = getWateringForecast(p).daysUntil; return d != null ? `+${Math.abs(d)}d` : null }}
        onTap={onWaterTap ?? onTap}
        withList
      />
      <Section
        bg="bg-terracotta-50" labelColor="text-terracotta-600" chipBg="bg-terracotta-100" chipText="text-terracotta-600" badgeColor="text-terracotta-500"
        icon={<FlaskConical size={11} />}
        label="Pamaitink augalėlį"
        plants={lists.fertList}
        renderBadge={p => { const d = getFertilizingForecast(p).daysUntil; return d != null ? `+${Math.abs(d)}d` : null }}
        onTap={onWaterTap ?? onTap}
        withList
      />
      <Section
        bg="bg-bone-300/50" labelColor="text-forest-600" chipBg="bg-bone" chipText="text-forest-700" badgeColor="text-forest-400"
        icon={<Sprout size={11} />}
        label="Palengva žadink"
        plants={lists.wakingList}
        onTap={onTap}
      />
      <Section
        bg="bg-bone-300/50" labelColor="text-forest-700" chipBg="bg-bone" chipText="text-forest-700" badgeColor="text-forest-400"
        icon={<Moon size={11} />}
        label="Miega"
        plants={lists.dormingList}
        onTap={onTap}
      />
      <Section
        bg="bg-bone-300/50" labelColor="text-terracotta-500" chipBg="bg-bone" chipText="text-forest-700" badgeColor="text-terracotta-400"
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
  // AccuracyButton — bigGreeting mode'e renderinamas tarp greeting ir subline.
  careMode = false, careConfidence = 0, onCareToggle,
}) {
  const [open, setOpen] = useState(defaultOpen)
  const lists = useCareLists(plants)

  // Tylus state — niekas nerodo, bet ir lieka neutraliai (nėra ką rašyt apie 0 augalų)
  if (lists.total === 0 && mode !== 'greeting') return null
  // 'greeting' režimas — visada rodom kreipinį, net jei 0 augalų reikalauja priežiūros

  // Mobile'e — tik vardas (kad tilptų šalia AccuracyButton'o); desktop'e — pilnas kreipinys.
  // Naudojam pure CSS (sm: breakpoint) vietoj JS sąlygos, kad nesukeltume re-render'ų.
  const greetPrefix = `${timeGreeting()}, `
  const firstName   = userFirstName(user)
  const greetingFull = `${greetPrefix}${firstName}`
  const sublineParts = buildSublineParts(lists.wateringList.length, lists.fertList.length)

  // 'summary' režimas — tik sąrašas, be kortelės wrapper'io (popup'ui)
  if (mode === 'summary') {
    return <CareSummaryList plants={plants} onTap={onTap} onWaterTap={onWaterTap} />
  }

  // 'greeting' režimas — tik kreipinys, jokio summary expand'o
  if (mode === 'greeting') {
    return (
      <div className={bigGreeting ? '' : 'mb-4'}>
        {bigGreeting ? (
          // Two-column kompozicija (designer'io .overview pattern):
          //   kairė: greeting h1 + subline stacked
          //   dešinė: AccuracyButton pill, vertikaliai centruotas
          // flex-wrap saugiklis siauresniam viewport'ui — pill'as užšoks
          // po greeting block'u (vis dar dešinėje per ml-auto savo eilutėj).
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex-shrink min-w-0">
              <h1 className="text-[28px] sm:text-[32px] font-extrabold text-gray-950 leading-tight tracking-tight">
                <span className="hidden sm:inline">{greetPrefix}</span>{firstName}
              </h1>
              <Subline parts={sublineParts} className="text-sm text-gray-500 mt-1" />
            </div>
            {onCareToggle && (
              <AccuracyButton careConfidence={careConfidence} careMode={careMode} onClick={onCareToggle} />
            )}
          </div>
        ) : (
          <>
            <h2 className="text-base font-bold text-gray-900 leading-tight">{greetingFull}</h2>
            <Subline parts={sublineParts} className="text-xs text-gray-500 mt-0.5" />
          </>
        )}
      </div>
    )
  }

  // 'inline' režimas (default, mobile) — greeting + summary toggle
  return (
    <div className="mb-4 bg-white rounded-2xl overflow-hidden shadow-ios-card">
      <div className="px-4 pt-3 pb-2 border-b border-gray-100">
        <h2 className="text-base font-bold text-gray-900 leading-tight">{greetingFull}</h2>
        <Subline parts={sublineParts} className="text-xs text-gray-500 mt-0.5" />
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
