import { useState } from 'react'
import { Droplets, FlaskConical, Moon, Sprout, Snowflake, ChevronUp, ChevronDown } from 'lucide-react'
import { getWateringForecast } from '../utils/wateringForecast'
import { getFertilizingForecast } from '../utils/fertilizingForecast'
import { getDormancyForecast } from '../utils/dormancyForecast'

function Section({ bg, labelColor, chipBg, chipText, badgeColor, icon, label, plants, renderBadge, onTap }) {
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
            onClick={() => onTap(p)}
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

export default function CareOverview({ plants, onTap, onSelectWatering, onSelectFertilizing, onSelectAllWatering, onSelectAllFertilizing }) {
  const [open, setOpen] = useState(true)

  const wateringList = plants.filter(p => { const f = getWateringForecast(p); return f.isOverdue && f.lastType === 'watering' })
  const fertList     = plants.filter(p => getFertilizingForecast(p).isOverdue)
  const wakingList   = plants.filter(p => getDormancyForecast(p)?.window === 'waking')
  const dormingList  = plants.filter(p => getDormancyForecast(p)?.window === 'active')
  const approachList = plants.filter(p => getDormancyForecast(p)?.window === 'approaching')

  const total = wateringList.length + fertList.length + wakingList.length + dormingList.length + approachList.length
  if (total === 0) return null

  return (
    <div className="mb-4 bg-white rounded-2xl overflow-hidden shadow-ios-card">
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
            onTap={onTap}
          />
          <Section
            bg="bg-amber-50"
            labelColor="text-amber-600"
            chipBg="bg-amber-100"
            chipText="text-amber-900"
            badgeColor="text-amber-500"
            icon={<FlaskConical size={11} />}
            label="Tręšimas vėluoja"
            plants={fertList}
            renderBadge={p => { const d = getFertilizingForecast(p).daysUntil; return d != null ? `+${Math.abs(d)}d` : null }}
            onTap={onTap}
          />
          {onSelectWatering && wateringList.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={onSelectWatering}
                className="flex-1 flex items-center justify-center gap-1.5 bg-sky-50 border border-sky-200 active:bg-sky-100 transition-colors rounded-2xl py-2.5"
              >
                <Droplets size={14} className="text-sky-500" />
                <span className="text-[13px] font-semibold text-sky-600">Laistyti ({wateringList.length})</span>
              </button>
              {onSelectAllWatering && (
                <button
                  onClick={onSelectAllWatering}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-sky-50 border border-sky-200 active:bg-sky-100 transition-colors rounded-2xl py-2.5"
                >
                  <Droplets size={14} className="text-sky-400" />
                  <span className="text-[13px] font-semibold text-sky-500">Laistyti viską</span>
                </button>
              )}
            </div>
          )}
          {onSelectFertilizing && fertList.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={onSelectFertilizing}
                className="flex-1 flex items-center justify-center gap-1.5 bg-amber-50 border border-amber-200 active:bg-amber-100 transition-colors rounded-2xl py-2.5"
              >
                <FlaskConical size={14} className="text-amber-500" />
                <span className="text-[13px] font-semibold text-amber-600">Tręšti ({fertList.length})</span>
              </button>
              {onSelectAllFertilizing && (
                <button
                  onClick={onSelectAllFertilizing}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-amber-50 border border-amber-200 active:bg-amber-100 transition-colors rounded-2xl py-2.5"
                >
                  <FlaskConical size={14} className="text-amber-400" />
                  <span className="text-[13px] font-semibold text-amber-500">Tręšti viską</span>
                </button>
              )}
            </div>
          )}
          <Section
            bg="bg-gray-50"
            labelColor="text-green-700"
            chipBg="bg-white"
            chipText="text-gray-800"
            badgeColor="text-gray-400"
            icon={<Sprout size={11} />}
            label="Augalas bunda"
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
