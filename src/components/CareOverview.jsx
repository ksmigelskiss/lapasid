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

export default function CareOverview({ plants, onTap, onWaterTap, defaultOpen = false, user }) {
  const [open, setOpen] = useState(defaultOpen)

  const wateringList = plants.filter(p => shouldShowWateringAlert(p))
  const fertList     = plants.filter(p => getFertilizingForecast(p).isOverdue)
  const wakingList   = plants.filter(p => getDormancyForecast(p)?.window === 'waking')
  const dormingList  = plants.filter(p => getDormancyForecast(p)?.window === 'active')
  const approachList = plants.filter(p => getDormancyForecast(p)?.window === 'approaching')

  const total = wateringList.length + fertList.length + wakingList.length + dormingList.length + approachList.length
  if (total === 0) return null

  const greeting = `${timeGreeting()}, ${userFirstName(user)}`
  // Subline parodo aktualų augalų darbų skaičių. Be augalų — santrauka null'u
  // (`if (total === 0) return null`), todėl čia visada >0.
  const subline = wateringList.length > 0
    ? `${wateringList.length} augal${wateringList.length === 1 ? 'as' : (wateringList.length < 10 ? 'ai' : 'ų')} laukia laistymo`
    : `${total} augal${total === 1 ? 'as' : 'ų'} laukia priežiūros`

  return (
    <div className="mb-4 bg-white rounded-2xl overflow-hidden shadow-ios-card">
      {/* Greeting — designer'io „CareOverview" stilistika; visada matoma, nepriklauso nuo open state'o */}
      <div className="px-4 pt-3 pb-2 border-b border-gray-100">
        <h2 className="text-base font-bold text-gray-900 leading-tight">{greeting}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{subline}</p>
      </div>

      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 active:bg-surface transition-colors"
      >
        <Sprout size={15} className="text-sage-500 flex-shrink-0" />
        <p className="text-sm font-bold text-gray-800 flex-1 text-left">Priežiūros santrauka ({total})</p>
        {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          <Section
            bg="bg-sky-50"
            labelColor="text-sky-600"
            chipBg="bg-sky-100"
            chipText="text-sky-900"
            badgeColor="text-sky-500"
            icon={<Droplets size={11} />}
            label="Patikrink ar ne sausi"
            plants={wateringList}
            renderBadge={p => { const d = getWateringForecast(p).daysUntil; return d != null ? `+${Math.abs(d)}d` : null }}
            onTap={onWaterTap ?? onTap}
            withList
          />
          <Section
            bg="bg-amber-50"
            labelColor="text-amber-600"
            chipBg="bg-amber-100"
            chipText="text-amber-900"
            badgeColor="text-amber-500"
            icon={<FlaskConical size={11} />}
            label="Pamaitink augalėlį"
            plants={fertList}
            renderBadge={p => { const d = getFertilizingForecast(p).daysUntil; return d != null ? `+${Math.abs(d)}d` : null }}
            onTap={onWaterTap ?? onTap}
            withList
          />
          <Section
            bg="bg-gray-50"
            labelColor="text-green-700"
            chipBg="bg-white"
            chipText="text-gray-800"
            badgeColor="text-gray-400"
            icon={<Sprout size={11} />}
            label="Palengva žadink"
            plants={wakingList}
            onTap={onTap}
          />
          <Section
            bg="bg-gray-50"
            labelColor="text-blue-600"
            chipBg="bg-white"
            chipText="text-gray-800"
            badgeColor="text-gray-400"
            icon={<Moon size={11} />}
            label="Miega"
            plants={dormingList}
            onTap={onTap}
          />
          <Section
            bg="bg-gray-50"
            labelColor="text-orange-500"
            chipBg="bg-white"
            chipText="text-gray-800"
            badgeColor="text-gray-400"
            icon={<Snowflake size={11} />}
            label="Ruošiasi miegui"
            plants={approachList}
            onTap={onTap}
          />
        </div>
      )}
    </div>
  )
}
