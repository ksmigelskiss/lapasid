import { Sun, Droplets, Snowflake, Leaf, Moon, Sprout } from 'lucide-react'
import { getFertilizingForecast } from '../utils/fertilizingForecast'
import { getDormancyForecast } from '../utils/dormancyForecast'
import { getWateringForecast, shouldShowWateringAlert } from '../utils/wateringForecast'

function fmtDate(str) {
  if (!str) return '—'
  return new Date(str).toLocaleDateString('lt-LT', { month: 'short', day: 'numeric' })
}

// ── Editorial blocks ──────────────────────────────────────────────
// Brandbook v1.0 patternas: vietoj spalvotų kortelių — typografinis flow su
// mono caps label + Bricolage Bold title + body. Callout'ai (overdue alerts)
// išlieka kortelės — frost glass + brand border (terracotta = warning).

function CalloutCard({ icon, label, title, body, hint, tone = 'terracotta' }) {
  // tone: 'terracotta' = severe/overdue; 'forest' = info/urgent (light)
  const isWarn = tone === 'terracotta'
  return (
    <div className={`bg-bone-50 border-2 rounded-2xl px-4 py-3 flex gap-3 ${
      isWarn ? 'border-terracotta/50' : 'border-forest-300/50'
    }`}>
      <div className={`flex-shrink-0 mt-0.5 ${isWarn ? 'text-terracotta' : 'text-forest-600'}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        {label && (
          <p className={`font-mono text-[10px] font-medium uppercase tracking-[0.16em] ${
            isWarn ? 'text-terracotta-600' : 'text-forest-500'
          }`}>{label}</p>
        )}
        <p className={`font-display text-sm font-bold tracking-tight mt-0.5 ${
          isWarn ? 'text-terracotta-600' : 'text-forest-700'
        }`}>{title}</p>
        {body && <p className="text-[11.5px] text-forest-600 mt-1 leading-snug">{body}</p>}
        {hint && <p className="text-[11px] text-forest-500 italic mt-1.5 leading-snug">{hint}</p>}
      </div>
    </div>
  )
}

function EditorialBlock({ icon, label, title, body, hint }) {
  return (
    <div className="flex gap-3">
      {icon && (
        <div className="flex-shrink-0 mt-0.5 text-forest-500">{icon}</div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[10px] font-medium text-forest-500 uppercase tracking-[0.16em]">{label}</p>
        <p className="font-display text-sm font-bold text-forest-700 tracking-tight mt-0.5">{title}</p>
        {body && <p className="text-[11.5px] text-forest-600 mt-1 leading-snug">{body}</p>}
        {hint && <p className="text-[11px] text-forest-500 italic mt-1.5 leading-snug">{hint}</p>}
      </div>
    </div>
  )
}

// ── Watering ──────────────────────────────────────────────────────

export function WateringCard({ plant, section }) {
  if (section !== 'auginama') return null
  if (!shouldShowWateringAlert(plant)) return null
  const wc = getWateringForecast(plant)
  const days = Math.abs(wc.daysUntil)
  return (
    <CalloutCard
      icon={<Droplets size={22} />}
      label="Laistymas vėluoja"
      title={`${days} d.`}
      body={
        <>
          Paskutinis: {fmtDate(wc.lastDate)}
          {wc.lastType === 'repotting' ? ' (persodinimas)' : ''}
          {' · '}{wc.intervalDays}d intervalas
        </>
      }
      hint={wc.metodas}
      tone="terracotta"
    />
  )
}

// ── Fertilizing ───────────────────────────────────────────────────

export function FertilizingCard({ plant, section }) {
  if (section !== 'auginama') return null
  const fc = getFertilizingForecast(plant)

  if (fc.skipSeason) {
    return (
      <EditorialBlock
        icon={<Snowflake size={18} />}
        label="Tręšimas"
        title="Žiemą netręšiama"
        body={fc.fertilizerTip}
      />
    )
  }

  if (fc.isOverdue) {
    const days = Math.abs(fc.daysUntil)
    return (
      <CalloutCard
        icon={<Leaf size={22} />}
        label="Pamaitink augalėlį — vėluoja"
        title={`${days} d.`}
        body={
          <>
            Paskutinis: {fmtDate(fc.lastDate)}
            {fc.lastType === 'repotting' ? ' (persodinimas)' : ''}
            {' · '}{fc.intervalDays}d intervalas
          </>
        }
        hint={fc.fertilizerTip}
        tone="terracotta"
      />
    )
  }

  const urgent = fc.daysUntil <= 7
  return (
    <EditorialBlock
      icon={<Leaf size={18} />}
      label={`Kitas tręšimas · ${fmtDate(fc.nextDate)}`}
      title={fc.daysUntil === 0 ? 'Šiandien!' : `Po ${fc.daysUntil} d.`}
      body={
        <span className="inline-flex items-center gap-1">
          {fc.season === 'vasara'
            ? <><Sun size={11} className="text-terracotta-400" /> Vasara</>
            : <><Snowflake size={11} className="text-forest-500" /> Žiema</>
          }
          {fc.lastType === 'repotting' ? ' · nuo persodinimo' : ''}
        </span>
      }
      hint={fc.fertilizerTip}
    />
  )
}

// ── Dormancy ──────────────────────────────────────────────────────

export function DormancyCard({ plant, section }) {
  if (section !== 'auginama') return null
  const df = getDormancyForecast(plant)
  if (!df) return null

  // Visi dormancy state'ai — editorial flow (info, ne callout).
  // Ikona + spalva atspindi „intensity":
  //   approaching = terracotta (rudeniškas tonas, šiltas)
  //   active      = forest-600 (gilus miegas)
  //   waking      = forest-500 (vibrancy)
  const configs = {
    approaching: {
      icon: <Snowflake size={18} className="text-terracotta-400" />,
      title: df.daysUntilDormancy != null
        ? `Ruoškitės žiemos miegui — liko ${df.daysUntilDormancy} d.`
        : 'Ruoškitės žiemos miegui',
    },
    active: {
      icon: <Moon size={18} className="text-forest-600" />,
      title: df.type === 'full' ? 'Augalas žiemos miege' : 'Dalinis žiemos poilsis',
    },
    waking: {
      icon: <Sprout size={18} className="text-forest-500" />,
      title: 'Laikas žadinti augalą!',
    },
  }

  const c = configs[df.window]
  return (
    <EditorialBlock
      icon={c.icon}
      label="Dormancy"
      title={c.title}
      body={df.action}
      hint={df.ziemojimas && df.window !== 'waking' ? df.ziemojimas : null}
    />
  )
}
