import { Sun, Droplets, Snowflake, Leaf, Moon, Sprout } from 'lucide-react'
import { getFertilizingForecast } from '../utils/fertilizingForecast'
import { getDormancyForecast } from '../utils/dormancyForecast'
import { getWateringForecast, shouldShowWateringAlert } from '../utils/wateringForecast'

function fmtDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('lt-LT', { month: 'short', day: 'numeric' })
}

export function WateringCard({ plant, section }) {
  if (section !== 'auginama') return null
  if (!shouldShowWateringAlert(plant)) return null
  const wc = getWateringForecast(plant)
  const days = Math.abs(wc.daysUntil)
  return (
    <div className="bg-sky-50 border border-sky-100 rounded-2xl px-4 py-3 flex gap-3">
      <Droplets size={24} className="flex-shrink-0 text-sky-400 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-sky-700">Laistymas vėluoja {days} d.!</p>
        <p className="text-[11px] text-sky-600 mt-0.5">
          Paskutinis: {fmtDate(wc.lastDate)}
          {wc.lastType === 'repotting' ? ' (persodinimas)' : ''}
          {' · '}{wc.intervalDays}d intervalas
        </p>
        {wc.metodas && <p className="text-[11px] text-sky-500 italic mt-1">{wc.metodas}</p>}
      </div>
    </div>
  )
}

export function FertilizingCard({ plant, section }) {
  if (section !== 'auginama') return null
  const fc = getFertilizingForecast(plant)

  if (fc.skipSeason) {
    return (
      <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
        <Snowflake size={20} className="flex-shrink-0 text-blue-400" />
        <div>
          <p className="text-sm font-semibold text-blue-700">Žiemą netręšiama</p>
          <p className="text-[11px] text-blue-500 mt-0.5">{fc.fertilizerTip}</p>
        </div>
      </div>
    )
  }

  if (fc.isOverdue) {
    const days = Math.abs(fc.daysUntil)
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 flex gap-3">
        <Leaf size={24} className="flex-shrink-0 text-orange-400 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-orange-700">Tręšimas vėluoja {days} d.!</p>
          <p className="text-[11px] text-orange-600 mt-0.5">
            Paskutinis: {fmtDate(fc.lastDate)}
            {fc.lastType === 'repotting' ? ' (persodinimas)' : ''}
            {' · '}{fc.intervalDays}d intervalas
          </p>
          <p className="text-[11px] text-orange-500 italic mt-1">{fc.fertilizerTip}</p>
        </div>
      </div>
    )
  }

  const urgent = fc.daysUntil <= 7
  return (
    <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
      urgent ? 'bg-amber-50 border border-amber-100' : 'bg-green-50 border border-green-100'
    }`}>
      <Leaf size={20} className={`flex-shrink-0 mt-0.5 ${urgent ? 'text-amber-400' : 'text-green-400'}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${urgent ? 'text-amber-700' : 'text-green-700'}`}>
          Kitas tręšimas: {fmtDate(fc.nextDate)}
        </p>
        <p className={`text-[11px] mt-0.5 ${urgent ? 'text-amber-600' : 'text-green-600'}`}>
          {fc.daysUntil === 0 ? 'Šiandien!' : `Po ${fc.daysUntil} d.`}
          {' · '}
          {fc.season === 'vasara'
            ? <><Sun size={11} className="inline align-text-bottom" /> Vasara</>
            : <><Snowflake size={11} className="inline align-text-bottom" /> Žiema</>
          }
          {fc.lastType === 'repotting' ? ' · nuo persodinimo' : ''}
        </p>
        <p className="text-[11px] text-gray-500 italic mt-1">{fc.fertilizerTip}</p>
      </div>
    </div>
  )
}

export function DormancyCard({ plant, section }) {
  if (section !== 'auginama') return null
  const df = getDormancyForecast(plant)
  if (!df) return null

  const configs = {
    approaching: {
      bg: 'bg-amber-50 border-amber-100',
      icon: <Snowflake size={22} className="text-amber-400 flex-shrink-0 mt-0.5" />,
      titleColor: 'text-amber-700', textColor: 'text-amber-600', subColor: 'text-amber-500',
      title: df.daysUntilDormancy != null
        ? `Ruoškitės žiemos miegui — liko ${df.daysUntilDormancy} d.`
        : 'Ruoškitės žiemos miegui',
    },
    active: {
      bg: 'bg-blue-50 border-blue-100',
      icon: <Moon size={22} className="text-blue-400 flex-shrink-0 mt-0.5" />,
      titleColor: 'text-blue-700', textColor: 'text-blue-600', subColor: 'text-blue-400',
      title: df.type === 'full' ? 'Augalas žiemos miege' : 'Dalinis žiemos poilsis',
    },
    waking: {
      bg: 'bg-green-50 border-green-100',
      icon: <Sprout size={22} className="text-green-400 flex-shrink-0 mt-0.5" />,
      titleColor: 'text-green-700', textColor: 'text-green-600', subColor: 'text-green-400',
      title: 'Laikas žadinti augalą!',
    },
  }

  const c = configs[df.window]
  return (
    <div className={`border rounded-2xl px-4 py-3 flex gap-3 ${c.bg}`}>
      {c.icon}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold ${c.titleColor}`}>{c.title}</p>
        <p className={`text-[11px] mt-1 leading-snug ${c.textColor}`}>{df.action}</p>
        {df.ziemojimas && df.window !== 'waking' && (
          <p className={`text-[10px] mt-1.5 italic ${c.subColor}`}>{df.ziemojimas}</p>
        )}
      </div>
    </div>
  )
}
