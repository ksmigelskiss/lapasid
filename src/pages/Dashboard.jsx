import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, SlidersHorizontal, AlertTriangle, Droplets, Loader2, Image as ImageIcon, ChevronUp, ChevronDown, Leaf, ShieldAlert, Thermometer, MapPin, Sprout, FlaskConical, X, Camera, Check } from 'lucide-react'
const GARDENER = '/gardener.png'
import PlantCard from '../components/PlantCard'
import CollectionChat from '../components/CollectionChat'
import { getFertilizingForecast } from '../utils/fertilizingForecast'
import { getDormancyForecast } from '../utils/dormancyForecast'
import { getWateringForecast, shouldShowWateringAlert } from '../utils/wateringForecast'
import { buildDashboardSystemPrompt } from '../utils/collectionChatContext'
import CareOverview from '../components/CareOverview'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { RefreshCw } from 'lucide-react'
import { makeId, today } from '../utils/plantTransform'

const SORT_OPTIONS = [
  { key: 'added',     label: 'Pridėta' },
  { key: 'name',      label: 'A–Z' },
  { key: 'light',     label: 'Šviesa' },
  { key: 'water',     label: 'Vanduo' },
  { key: 'attention', label: 'Dėmesys' },
  { key: 'difficulty',label: 'Sunkumas' },
]

function sortPlants(plants, key) {
  const sorted = [...plants]
  switch (key) {
    case 'name':
      return sorted.sort((a, b) => (a.lietuviškas ?? '').localeCompare(b.lietuviškas ?? '', 'lt'))
    case 'light':
      return sorted.sort((a, b) => (b.sviesa?.taskai ?? 0) - (a.sviesa?.taskai ?? 0))
    case 'water':
      return sorted.sort((a, b) => (b.vanduo?.taskai ?? 0) - (a.vanduo?.taskai ?? 0))
    case 'attention':
      return sorted.sort((a, b) => {
        const score = p => {
          let s = 0
          if (shouldShowWateringAlert(p))      s += 4
          if (getFertilizingForecast(p).isOverdue) s += 3
          if (getDormancyForecast(p))          s += 2
          if ((p.status ?? 'healthy') !== 'healthy') s += 1
          return s
        }
        return score(b) - score(a)
      })
    case 'difficulty':
      return sorted.sort((a, b) => (b.sunkumas ?? 0) - (a.sunkumas ?? 0))
    case 'added':
    default:
      return sorted.sort((a, b) => new Date(b.data_prideta) - new Date(a.data_prideta))
  }
}

function CareWateringSheet({ plant, onClose }) {
  const wc = getWateringForecast(plant)
  const hasImg = !!plant.image
  const intervals = plant.laistymasIntervalas
  const desc = plant.prieziura?.laistymas

  const fmtDate = iso => iso
    ? new Date(iso + 'T00:00:00').toLocaleDateString('lt-LT', { month: 'short', day: 'numeric' })
    : null
  const daysSince = iso => iso
    ? Math.floor((Date.now() - new Date(iso + 'T00:00:00')) / 86400000)
    : null

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[110] flex flex-col justify-end"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        className="relative bg-white rounded-t-3xl overflow-hidden max-h-[84dvh] flex flex-col"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 340 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Photo header — handle overlaid on top */}
        <div className="relative flex-shrink-0">
          {hasImg ? (
            <>
              <img src={plant.image} alt="" className="w-full h-52 object-cover" />
              {/* Handle on image */}
              <div className="absolute top-3 inset-x-0 flex justify-center">
                <div className="w-10 h-1 rounded-full bg-white/50" />
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-5 pb-4 pt-12">
                <p className="text-white font-bold text-lg leading-tight">{plant.lietuviškas}</p>
                {plant.lotyniskas && <p className="text-white/60 text-sm italic leading-tight">{plant.lotyniskas}</p>}
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-gray-200" />
              </div>
              <div className="w-full h-24 bg-sky-50 flex items-center justify-center">
                <span className="text-6xl">{plant.emoji ?? '🌿'}</span>
              </div>
            </>
          )}
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 pt-4 pb-8 space-y-4">
          {!hasImg && (
            <div>
              <p className="text-lg font-bold text-gray-900">{plant.lietuviškas}</p>
              {plant.lotyniskas && <p className="text-sm italic text-gray-500">{plant.lotyniskas}</p>}
            </div>
          )}

          {/* Description */}
          {desc ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Droplets size={15} className="text-sky-500" />
                <p className="text-sm font-bold text-gray-800">Laistymas</p>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Droplets size={15} className="text-sky-500" />
              <p className="text-sm font-bold text-gray-800">Laistymas</p>
            </div>
          )}

          {/* Interval badges */}
          {(intervals?.vasara != null || wc.intervalDays != null) && (
            <div className="flex gap-2">
              <div className="flex-1 bg-amber-50 rounded-2xl p-3 text-center">
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">☀️ Vasara</p>
                <p className="text-base font-bold text-amber-700">
                  {intervals?.vasara != null
                    ? `kas ${intervals.vasara} d.`
                    : wc.intervalDays ? `kas ${wc.intervalDays} d.` : '–'}
                </p>
              </div>
              <div className="flex-1 bg-sky-50 rounded-2xl p-3 text-center">
                <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wider mb-1">❄️ Žiema</p>
                <p className="text-base font-bold text-sky-700">
                  {intervals?.ziema === null
                    ? 'Neskaistoma'
                    : intervals?.ziema != null
                      ? `kas ${intervals.ziema} d.`
                      : '–'}
                </p>
              </div>
            </div>
          )}

          {/* Method */}
          {wc.metodas && (
            <div className="bg-gray-50 rounded-2xl px-4 py-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Metodas</p>
              <p className="text-sm text-gray-700">{wc.metodas}</p>
            </div>
          )}

          {/* Current status */}
          <div className={`rounded-2xl px-4 py-3 ${wc.isOverdue ? 'bg-sky-50 border border-sky-100' : 'bg-gray-50'}`}>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">Dabar</p>
            <div className="space-y-2">
              {wc.lastDate && (
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-sm text-gray-500 flex-shrink-0">Paskutinis</span>
                  <span className="text-sm font-semibold text-gray-800 text-right">
                    {fmtDate(wc.lastDate)}
                    {daysSince(wc.lastDate) != null && (
                      <span className="text-gray-400 font-normal"> · {daysSince(wc.lastDate)} d. atgal</span>
                    )}
                  </span>
                </div>
              )}
              {wc.daysUntil != null && (
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-sm text-gray-500 flex-shrink-0">
                    {wc.isOverdue ? 'Vėluoja' : 'Kitas'}
                  </span>
                  <span className={`text-sm font-bold text-right ${wc.isOverdue ? 'text-sky-600' : 'text-gray-800'}`}>
                    {wc.isOverdue
                      ? `${Math.abs(wc.daysUntil)} d.`
                      : `po ${wc.daysUntil} d.${wc.nextDate ? ` · ${fmtDate(wc.nextDate)}` : ''}`}
                  </span>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl text-sm font-semibold text-gray-500 bg-gray-100 active:bg-gray-200 transition-colors"
          >
            Uždaryti
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}

function QuarantineSection({ plants, zones, onTap, careMode, careChecked, onCareToggle, onSelectAll, onDeselectAll, onScrollToGroup, onCareInfo }) {
  const [open, setOpen] = useState(true)
  const containerRef = useRef(null)
  const scrollToTop = () => onScrollToGroup?.(containerRef.current)
  const orderedPlants = pinChecked(plants, careMode, careChecked)
  const allChecked    = careMode && plants.length > 0 && plants.every(p => careChecked?.has(p.id))
  return (
    <div ref={containerRef} className="mb-3 bg-white rounded-2xl px-3 pb-3">
      <div className="w-full flex items-center gap-2 py-2">
        <button onClick={() => setOpen(v => !v)} className="flex items-center gap-1.5 min-w-0">
          <ShieldAlert size={13} className="text-red-400 flex-shrink-0" />
          <span className="text-sm font-bold text-red-600">Karantinas</span>
          <span className="text-xs text-red-300 flex-shrink-0">{plants.length}</span>
        </button>
        <div className="flex-1" />
        {careMode && open && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => { onSelectAll(plants.filter(p => getWateringForecast(p).isOverdue)); scrollToTop() }} className="w-7 h-7 flex items-center justify-center rounded-lg bg-sky-100 active:bg-sky-200">
              <Droplets size={13} className="text-sky-500" />
            </button>
            <button onClick={() => { onSelectAll(plants.filter(p => getFertilizingForecast(p).isOverdue)); scrollToTop() }} className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-100 active:bg-amber-200">
              <FlaskConical size={13} className="text-amber-500" />
            </button>
            <button onClick={() => { allChecked ? onDeselectAll?.(plants) : onSelectAll(plants); scrollToTop() }} className="text-[11px] font-semibold text-red-400 px-1">
              {allChecked ? 'Atžymėti' : 'Žymėti visus'}
            </button>
          </div>
        )}
        <button onClick={() => setOpen(v => !v)} className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
          {open ? <ChevronUp size={14} className="text-red-300" /> : <ChevronDown size={14} className="text-red-300" />}
        </button>
      </div>
      {open && (
        <div className="bg-red-50 rounded-2xl p-2.5">
          <div className="grid grid-cols-2 gap-3">
            {orderedPlants.map(plant => (
              <PlantCard
                key={plant.id}
                plant={plant}
                section="auginama"
                onTap={() => onTap(plant)}
                zoneName={zones.find(z => z.id === plant.zonaId)?.name}
                careMode={careMode}
                checked={careChecked?.has(plant.id)}
                onToggle={() => onCareToggle(plant.id)}
                onCareInfo={() => onCareInfo?.(plant)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function pinChecked(plants) { return plants }

function ZoneSection({ zone, plants, onTap, careMode, careChecked, onCareToggle, onSelectAll, onDeselectAll, onScrollToGroup, onCareInfo }) {
  const [open, setOpen] = useState(true)
  const containerRef = useRef(null)
  const scrollToTop = () => onScrollToGroup?.(containerRef.current)
  const sickPlants    = pinChecked(plants.filter(p => p.status === 'sick'),    careMode, careChecked)
  const healthyPlants = pinChecked(plants.filter(p => p.status !== 'sick'), careMode, careChecked)
  const allChecked    = careMode && plants.length > 0 && plants.every(p => careChecked?.has(p.id))

  const carePropsFn = (plant) => careMode ? {
    careMode: true,
    checked: careChecked?.has(plant.id),
    onToggle: () => onCareToggle(plant.id),
    onCareInfo: () => onCareInfo?.(plant),
  } : {}

  return (
    <div ref={containerRef} className="mb-3 bg-white rounded-2xl px-3 pb-3">
      <div className="w-full flex items-center gap-2 py-2">
        <button onClick={() => setOpen(v => !v)} className="flex items-center gap-1.5 min-w-0">
          <MapPin size={13} className="text-sage-400 flex-shrink-0" />
          <span className="text-sm font-bold text-gray-700 truncate">{zone.name}</span>
          <span className="text-xs text-gray-400 flex-shrink-0">{plants.length}</span>
        </button>
        <div className="flex-1" />
        {careMode && open && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => { onSelectAll(plants.filter(p => getWateringForecast(p).isOverdue)); scrollToTop() }} className="w-7 h-7 flex items-center justify-center rounded-lg bg-sky-100 active:bg-sky-200">
              <Droplets size={13} className="text-sky-500" />
            </button>
            <button onClick={() => { onSelectAll(plants.filter(p => getFertilizingForecast(p).isOverdue)); scrollToTop() }} className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-100 active:bg-amber-200">
              <FlaskConical size={13} className="text-amber-500" />
            </button>
            <button onClick={() => { allChecked ? onDeselectAll?.(plants) : onSelectAll(plants); scrollToTop() }} className="text-[11px] font-semibold text-sage-500 px-1">
              {allChecked ? 'Atžymėti' : 'Žymėti visus'}
            </button>
          </div>
        )}
        <button onClick={() => setOpen(v => !v)} className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
          {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </button>
      </div>
      {open && (
        <div className="space-y-3">
          {sickPlants.length > 0 && (
            <div className="bg-amber-50 rounded-2xl p-2.5">
              <div className="flex items-center gap-1.5 mb-2 px-1">
                <Thermometer size={12} className="text-amber-500" />
                <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wide">Dėmesio</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {sickPlants.map(plant => (
                  <PlantCard key={plant.id} plant={plant} section="auginama" onTap={() => onTap(plant)} zoneName={zone.name} {...carePropsFn(plant)} />
                ))}
              </div>
            </div>
          )}
          {healthyPlants.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {healthyPlants.map(plant => (
                <PlantCard key={plant.id} plant={plant} section="auginama" onTap={() => onTap(plant)} zoneName={zone.name} {...carePropsFn(plant)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function matchesQuery(plant, q) {
  const lower = q.toLowerCase()
  return [plant.lietuviškas, plant.lotyniskas, plant.inatLtName,
    ...(plant.sinonimai ?? []), ...(plant.englishNames ?? [])]
    .some(c => c && c.toLowerCase().includes(lower))
}

export default function Dashboard({ plants, allPlants = [], zones = [], onTap, onTapFromCare, onSearch, onSearchByCamera, onFetchAllImages, fetchingAll, onSaveToZinynas, onViewPlant, onRefresh, onAddTimelineEvent, onAddZone, onUpdateZone, onDeleteZone, onReorderZones }) {
  const quarantinePlants = plants.filter(p => p.status === 'quarantine')
  // sick plants stay in their zone (mainPlants includes them)
  const mainPlants       = plants.filter(p => p.status !== 'quarantine')
  const missingCount     = plants.filter(p => !p.image).length
  const overdueList      = mainPlants.filter(p => getFertilizingForecast(p).isOverdue)
  const wateringList     = mainPlants.filter(p => shouldShowWateringAlert(p))
  const [alertsOpen, setAlertsOpen]   = useState(false)
  const [sortKey, setSortKey]         = useState('added')
  const [showFilters, setShowFilters] = useState(false)
  const [showChat, setShowChat]       = useState(false)
  const [searching, setSearching]     = useState(false)
  const [query, setQuery]             = useState('')
  const [careMode, setCareMode]         = useState(false)
  const [careChecked, setCareChecked]   = useState(new Set())
  const [careInfoPlant, setCareInfoPlant] = useState(null)
  const [snoozedWatering, setSnoozedWatering] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('waterSnooze') ?? '{}')
      const todayStr = new Date().toISOString().slice(0, 10)
      return new Set(Object.entries(stored).filter(([, until]) => until >= todayStr).map(([id]) => id))
    } catch { return new Set() }
  })
  const [confirmType, setConfirmType]   = useState(null)   // 'watering' | 'fertilizing' | null
  const [countdown, setCountdown]       = useState(5)
  const confirmTimerRef = useRef(null)
  const inputRef        = useRef(null)
  const scrollRef       = useRef(null)
  const unzonedRef      = useRef(null)

  const scrollToGroup = useCallback((el) => {
    requestAnimationFrame(() => {
      if (!el || !scrollRef.current) return
      const c = scrollRef.current
      const top = el.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop
      c.scrollTo({ top, behavior: 'smooth' })
    })
  }, [])

  const toggleCare = useCallback((id) => {
    setCareChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback((groupPlants) => {
    setCareChecked(prev => {
      const next = new Set(prev)
      groupPlants.forEach(p => next.add(p.id))
      return next
    })
  }, [])

  const deselectAll = useCallback((groupPlants) => {
    setCareChecked(prev => {
      const next = new Set(prev)
      groupPlants.forEach(p => next.delete(p.id))
      return next
    })
  }, [])

  const selectNeedsWatering = useCallback(() => {
    const ids = mainPlants.filter(p => getWateringForecast(p).isOverdue).map(p => p.id)
    setCareChecked(prev => new Set([...prev, ...ids]))
  }, [mainPlants])

  const selectNeedsFertilizing = useCallback(() => {
    const ids = mainPlants.filter(p => getFertilizingForecast(p).isOverdue).map(p => p.id)
    setCareChecked(prev => new Set([...prev, ...ids]))
  }, [mainPlants])

  const selectAllWatering = useCallback(() => {
    setCareChecked(prev => new Set([...prev, ...mainPlants.map(p => p.id)]))
  }, [mainPlants])

  const selectAllFertilizing = useCallback(() => {
    setCareChecked(prev => new Set([...prev, ...mainPlants.map(p => p.id)]))
  }, [mainPlants])

  const resetConfirm = useCallback(() => {
    clearInterval(confirmTimerRef.current)
    setConfirmType(null)
    setCountdown(5)
  }, [])

  const exitCareMode = useCallback(() => {
    resetConfirm()
    setCareMode(false)
    setCareChecked(new Set())
  }, [resetConfirm])

  const snoozeWatering = useCallback((plantId) => {
    const until = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
    setSnoozedWatering(prev => new Set([...prev, plantId]))
    try {
      const stored = JSON.parse(localStorage.getItem('waterSnooze') ?? '{}')
      stored[plantId] = until
      localStorage.setItem('waterSnooze', JSON.stringify(stored))
    } catch {}
  }, [])

  // Keep screen awake while in care mode
  useEffect(() => {
    if (!careMode || !navigator.wakeLock) return
    let lock = null
    const acquire = async () => {
      try { lock = await navigator.wakeLock.request('screen') } catch {}
    }
    acquire()
    const onVisible = () => { if (document.visibilityState === 'visible') acquire() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release()
    }
  }, [careMode])

  useEffect(() => {
    if (!confirmType) return
    confirmTimerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(confirmTimerRef.current); setConfirmType(null); return 5 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(confirmTimerRef.current)
  }, [confirmType])

  const handleCareAction = useCallback((type) => {
    const t = today()
    const comment = type === 'watering' ? 'Laistyta masiniu laistymu' : 'Trešta masiniu laistymu'
    careChecked.forEach(plantId => {
      onAddTimelineEvent(plantId, { id: makeId(), type: 'watering', date: t, komentaras: comment })
      if (type === 'fertilizing') {
        onAddTimelineEvent(plantId, { id: makeId(), type: 'fertilizing', date: t, komentaras: comment })
      }
    })
    resetConfirm()
    setCareChecked(new Set())
  }, [careChecked, onAddTimelineEvent, resetConfirm])

  useEffect(() => { if (searching) inputRef.current?.focus() }, [searching])
  const closeSearch = useCallback(() => { setSearching(false); setQuery('') }, [])
  const launchFullSearch = useCallback(() => { onSearch(query); closeSearch() }, [onSearch, query, closeSearch])

  const searchResults = useMemo(() => {
    if (!query.trim()) return []
    return allPlants.filter(p => matchesQuery(p, query))
  }, [allPlants, query])
  const { pullY, refreshing } = usePullToRefresh(scrollRef, onRefresh ?? (() => {}))

  const sortedPlants = useMemo(() => sortPlants(mainPlants, sortKey), [mainPlants, sortKey])

  // Zone grouping: only active when zones exist
  const hasZones = zones.length > 0
  const zonedPlants = hasZones
    ? zones.map(zone => ({ zone, plants: sortedPlants.filter(p => p.zonaId === zone.id) }))
    : []
  const unzonedPlants = hasZones
    ? sortedPlants.filter(p => !p.zonaId)
    : sortedPlants

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="px-5 pt-14 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-sage-400 uppercase tracking-[0.12em] mb-1">Mano kolekcija</p>
            <h1 className="text-[28px] font-extrabold text-gray-900 leading-tight tracking-tight">Mano augalai</h1>
          </div>
          <div className="flex flex-col items-end gap-2">
            {/* Top row: laistymas + augalai */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setCareMode(v => !v); setCareChecked(new Set()) }}
                className={`transition-colors rounded-2xl px-3.5 py-2 flex flex-col items-center justify-center h-[58px] ${careMode ? 'bg-sage-500 active:bg-sage-600' : 'bg-white border border-gray-200 active:bg-surface'}`}
              >
                <Sprout size={20} className={careMode ? 'text-white' : 'text-sage-500'} />
                <span className={`text-[10px] font-medium mt-0.5 ${careMode ? 'text-white' : 'text-sage-500'}`}>priežiūra</span>
              </button>
              <div className="border border-gray-300 rounded-2xl px-3.5 py-2 flex flex-col items-center justify-center h-[58px]">
                <span className="text-2xl font-extrabold text-gray-700 leading-none">{plants.length}</span>
                <span className="text-[10px] text-gray-500 font-medium mt-0.5">augal{plants.length === 1 ? 'as' : 'ai'}</span>
              </div>
            </div>
            {/* Secondary row: foto */}
            {missingCount > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={onFetchAllImages}
                  disabled={fetchingAll}
                  className="flex items-center gap-1.5 bg-white hover:bg-gray-50 disabled:opacity-60 transition-colors rounded-xl px-2.5 py-1.5"
                >
                  {fetchingAll ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                  <span className="text-xs font-medium text-sage-600">
                    {fetchingAll ? 'Kraunama...' : `+${missingCount} foto`}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search + filter toggle */}
      <div className="px-5 mb-3 flex gap-2">
        {searching ? (
          <div className="flex-1 flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 focus-within:border-gray-400 transition-colors">
            <Search size={15} className="text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="nope"
              autoCorrect="off"
              autoCapitalize="none"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && query.trim()) launchFullSearch()
                if (e.key === 'Escape') closeSearch()
              }}
              placeholder="Ieškoti augalo..."
              className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
            />
            <button onClick={closeSearch} className="text-gray-400 text-xs">✕</button>
          </div>
        ) : (
          <button
            onClick={() => setSearching(true)}
            className="flex-1 flex items-center gap-3 bg-white border border-gray-200 hover:bg-surface transition-colors rounded-2xl px-4 py-3"
          >
            <Search size={16} className="text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-500">Ieškoti augalo...</span>
          </button>
        )}
        {!searching && (
          <button
            onClick={() => onSearchByCamera ? onSearchByCamera() : onSearch('')}
            className="flex-shrink-0 w-11 rounded-2xl flex items-center justify-center bg-white border border-gray-200 text-gray-600 active:bg-surface transition-colors"
          >
            <Camera size={16} />
          </button>
        )}
        {!searching && plants.length > 1 && (
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex-shrink-0 w-11 rounded-2xl flex items-center justify-center text-base transition-colors ${
              showFilters || sortKey !== 'added'
                ? 'bg-sage-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600'
            }`}
          >
            <SlidersHorizontal size={16} />
          </button>
        )}
      </div>


      {/* Collapsible sort */}
      {showFilters && plants.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none px-5 mb-4">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setSortKey(opt.key)}
              className={`flex-shrink-0 text-xs font-medium rounded-xl px-3 py-1.5 transition-colors ${
                sortKey === opt.key
                  ? 'bg-sage-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-surface'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Inline search results */}
      {searching && (
        <div className="flex-1 overflow-y-auto scrollbar-none px-5 pb-28">
          {query.trim() ? (
            <>
              {searchResults.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {searchResults.map(plant => (
                    <PlantCard
                      key={plant.id}
                      plant={plant}
                      section={plant.kategorija === 'auginama' ? 'auginama' : plant.kategorija === 'istorija' ? 'istorija' : 'nori'}
                      onTap={() => { closeSearch(); onViewPlant(plant) }}
                      showDashboardBadge={plant.kategorija === 'auginama'}
                      zoneName={plant.kategorija === 'auginama' ? zones.find(z => z.id === plant.zonaId)?.name : undefined}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                  <Search size={40} className="text-gray-300" />
                  <p className="text-sm font-semibold text-gray-600">„{query}" nerasta bibliotekoje</p>
                  <button
                    onClick={launchFullSearch}
                    className="mt-1 px-6 py-3 bg-gray-800 text-white rounded-2xl text-sm font-medium"
                  >
                    Ieškoti „{query}" naujų augalų
                  </button>
                </div>
              )}
              {searchResults.length > 0 && (
                <button
                  onClick={launchFullSearch}
                  className="w-full mt-3 py-3 rounded-2xl text-sm text-gray-500 border border-dashed border-gray-300 hover:border-gray-400 hover:text-gray-700 transition-colors"
                >
                  Ieškoti „{query}" naujų augalų
                </button>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <Search size={40} className="text-gray-300" />
              <p className="text-sm text-gray-400">Įveskite augalo pavadinimą</p>
            </div>
          )}
        </div>
      )}

      {/* Pull-to-refresh indicator + main content — hidden while searching */}
      {!searching && <div
        className="flex items-center justify-center overflow-hidden"
        style={{
          height: refreshing ? 48 : pullY,
          transition: pullY > 0 ? 'none' : 'height 0.25s ease-out',
        }}
      >
        <RefreshCw
          size={20}
          className={`text-sage-400 ${refreshing ? 'animate-spin' : ''}`}
          style={{ opacity: refreshing ? 1 : pullY / 48, transform: refreshing ? undefined : `rotate(${pullY * 4}deg)` }}
        />
      </div>}

      {/* Scrollable content */}
      {!searching && <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-none px-5 pb-28">

        {/* Care overview — only in careMode */}
        {careMode && <CareOverview plants={mainPlants} onTap={onTapFromCare ?? onTap} onSelectWatering={selectNeedsWatering} onSelectFertilizing={selectNeedsFertilizing} onSelectAllWatering={selectAllWatering} onSelectAllFertilizing={selectAllFertilizing} />}

        {/* Unified alerts widget — only outside careMode */}
        {!careMode && (() => {
          const visibleWatering = wateringList.filter(p => !snoozedWatering.has(p.id))
          if (visibleWatering.length === 0 && overdueList.length === 0) return null
          return (
          <div className="mb-4">
            <div className="bg-white rounded-2xl overflow-hidden shadow-ios-card">
              {/* Collapsible header */}
              <button
                onClick={() => setAlertsOpen(o => !o)}
                className="w-full flex items-center gap-2 px-4 py-3 active:bg-surface-2 transition-colors"
              >
                <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
                <p className="text-sm font-bold text-gray-800 flex-1 text-left">
                  Priminimai ({visibleWatering.length + overdueList.length})
                </p>
                <div className={`transition-transform duration-200 ${alertsOpen ? '' : 'rotate-180'}`}>
                  <ChevronUp size={14} className="text-gray-400" />
                </div>
              </button>

              {alertsOpen && (
                <div className="px-4 pb-3 space-y-3">
                  {/* Watering section */}
                  {visibleWatering.length > 0 && (
                    <div>
                      <p className="flex items-center gap-1 text-[10px] font-bold text-sky-500 uppercase tracking-wider mb-1.5">
                        <Droplets size={11} /> Patikrink ar ne sausi
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {visibleWatering.map(p => {
                          const wc = getWateringForecast(p)
                          return (
                            <div key={p.id} className="flex items-center bg-sky-100 rounded-xl overflow-hidden">
                              <button
                                onClick={() => onTap(p)}
                                className="flex items-center gap-1 px-2.5 py-1 active:bg-sky-200 transition-colors"
                              >
                                <span className="text-[11px] font-medium text-sky-800 max-w-[80px] truncate">{p.lietuviškas}</span>
                                <span className="text-[10px] text-sky-500 font-semibold ml-0.5">+{Math.abs(wc.daysUntil)}d</span>
                              </button>
                              <button
                                onClick={() => snoozeWatering(p.id)}
                                className="pr-2 pl-1 py-1 text-sky-400 active:text-sky-600 transition-colors"
                                title="Patikrinau"
                              >
                                <Check size={11} />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Fertilizing section */}
                  {overdueList.length > 0 && (
                    <div>
                      <p className="flex items-center gap-1 text-[10px] font-bold text-orange-500 uppercase tracking-wider mb-1.5">
                        <Leaf size={11} /> Pamaitink augalėlį
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {overdueList.map(p => {
                          const fc = getFertilizingForecast(p)
                          return (
                            <button
                              key={p.id}
                              onClick={() => onTap(p)}
                              className="flex items-center gap-1 bg-orange-100 hover:bg-orange-200 active:bg-orange-200 transition-colors rounded-xl px-2.5 py-1"
                            >
                              <span className="text-[11px] font-medium text-orange-800 max-w-[90px] truncate">{p.lietuviškas}</span>
                              <span className="text-[10px] text-orange-500 font-semibold ml-0.5">+{Math.abs(fc.daysUntil)}d</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}


                </div>
              )}
            </div>
          </div>
          )
        })()}

        {/* Karantinas pseudo-zone */}
        {quarantinePlants.length > 0 && (
          <QuarantineSection plants={quarantinePlants} zones={zones} onTap={onTap}
            careMode={careMode} careChecked={careChecked} onCareToggle={toggleCare} onSelectAll={selectAll} onDeselectAll={deselectAll} onScrollToGroup={scrollToGroup} onCareInfo={setCareInfoPlant} />
        )}

        {/* Plant grid */}
        {plants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <img src="/plant_pot.png" className="h-16 w-auto object-contain opacity-50" alt="" />
            <div>
              <p className="text-base font-semibold text-gray-700">Dar nėra augalų</p>
              <p className="text-sm text-gray-400 mt-1">Ieškokite augalo ir pridėkite į kolekciją</p>
            </div>
            <button
              onClick={onSearch}
              className="mt-2 px-6 py-3 bg-sage-500 text-white rounded-2xl text-sm font-medium"
            >
              + Pridėti pirmą augalą
            </button>
          </div>
        ) : hasZones ? (
          <>
            {zonedPlants.map(({ zone, plants: zp }) => zp.length > 0 && (
              <ZoneSection key={zone.id} zone={zone} plants={zp} onTap={onTap}
                careMode={careMode} careChecked={careChecked} onCareToggle={toggleCare} onSelectAll={selectAll} onDeselectAll={deselectAll} onScrollToGroup={scrollToGroup} onCareInfo={setCareInfoPlant} />
            ))}
            {unzonedPlants.length > 0 && (
              <div ref={unzonedRef} className="mb-3 bg-white rounded-2xl px-3 pb-3">
                <div className="flex items-center py-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex-1">Nepriskirti</p>
                  {careMode && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => { selectAll(unzonedPlants.filter(p => getWateringForecast(p).isOverdue)); scrollToGroup(unzonedRef.current) }} className="w-7 h-7 flex items-center justify-center rounded-lg bg-sky-100 active:bg-sky-200">
                        <Droplets size={13} className="text-sky-500" />
                      </button>
                      <button onClick={() => { selectAll(unzonedPlants.filter(p => getFertilizingForecast(p).isOverdue)); scrollToGroup(unzonedRef.current) }} className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-100 active:bg-amber-200">
                        <FlaskConical size={13} className="text-amber-500" />
                      </button>
                      <button onClick={() => { const allChk = unzonedPlants.every(p => careChecked.has(p.id)); allChk ? deselectAll(unzonedPlants) : selectAll(unzonedPlants); scrollToGroup(unzonedRef.current) }} className="text-[11px] font-semibold text-sage-500 px-1">
                        {unzonedPlants.every(p => careChecked.has(p.id)) ? 'Atžymėti' : 'Žymėti visus'}
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  {pinChecked(unzonedPlants.filter(p => p.status === 'sick'), careMode, careChecked).length > 0 && (
                    <div className="bg-amber-50 rounded-2xl p-2.5">
                      <div className="flex items-center gap-1.5 mb-2 px-1">
                        <Thermometer size={12} className="text-amber-500" />
                        <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wide">Dėmesio</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {pinChecked(unzonedPlants.filter(p => p.status === 'sick'), careMode, careChecked).map(plant => (
                          <PlantCard key={plant.id} plant={plant} section="auginama" onTap={() => onTap(plant)}
                            careMode={careMode} checked={careChecked.has(plant.id)} onToggle={() => toggleCare(plant.id)} onCareInfo={() => setCareInfoPlant(plant)} />
                        ))}
                      </div>
                    </div>
                  )}
                  {pinChecked(unzonedPlants.filter(p => p.status !== 'sick'), careMode, careChecked).length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      {pinChecked(unzonedPlants.filter(p => p.status !== 'sick'), careMode, careChecked).map(plant => (
                        <PlantCard key={plant.id} plant={plant} section="auginama" onTap={() => onTap(plant)}
                          careMode={careMode} checked={careChecked.has(plant.id)} onToggle={() => toggleCare(plant.id)} onCareInfo={() => setCareInfoPlant(plant)} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {careMode && (
              <div className="flex justify-end items-center gap-1 py-1 mb-1">
                <button onClick={() => selectAll(sortedPlants.filter(p => getWateringForecast(p).isOverdue))} className="w-7 h-7 flex items-center justify-center rounded-lg bg-sky-100 active:bg-sky-200">
                  <Droplets size={13} className="text-sky-500" />
                </button>
                <button onClick={() => selectAll(sortedPlants.filter(p => getFertilizingForecast(p).isOverdue))} className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-100 active:bg-amber-200">
                  <FlaskConical size={13} className="text-amber-500" />
                </button>
                <button onClick={() => sortedPlants.every(p => careChecked.has(p.id)) ? deselectAll(sortedPlants) : selectAll(sortedPlants)} className="text-[11px] font-semibold text-sage-500 px-1">
                  {sortedPlants.every(p => careChecked.has(p.id)) ? 'Atžymėti' : 'Žymėti visus'}
                </button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {pinChecked(sortedPlants, careMode, careChecked).map(plant => (
                <PlantCard
                  key={plant.id}
                  plant={plant}
                  section="auginama"
                  onTap={() => onTap(plant)}
                  careMode={careMode}
                  checked={careChecked.has(plant.id)}
                  onToggle={() => toggleCare(plant.id)}
                  onCareInfo={() => setCareInfoPlant(plant)}
                />
              ))}
            </div>
          </>
        )}
      </div>}

      {/* Floating AI bubble — hidden in care mode */}
      {plants.length > 0 && !careMode && (
        <button
          onClick={() => setShowChat(true)}
          className="absolute bottom-24 right-4 active:scale-90 transition-transform z-10"
        >
          <img src={GARDENER} className="h-[96px] w-auto object-contain drop-shadow opacity-90 animate-idle-float-gardener" alt="" />
        </button>
      )}

      {/* Care mode action bar */}
      <AnimatePresence>
        {careMode && (
          <motion.div
            key="care-bar"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed bottom-[68px] left-0 right-0 z-30 px-4 pb-2"
          >
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-3 flex gap-2 items-center">
              <button
                onClick={exitCareMode}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 active:bg-gray-200 flex-shrink-0"
              >
                <X size={18} className="text-gray-600" />
              </button>
              <button
                onClick={() => {
                  if (careChecked.size === 0) return
                  if (confirmType === 'watering') { handleCareAction('watering'); resetConfirm() }
                  else { resetConfirm(); setConfirmType('watering'); setCountdown(5) }
                }}
                disabled={careChecked.size === 0}
                className={`flex-1 h-10 flex items-center justify-center gap-1.5 rounded-xl disabled:opacity-40 transition-colors ${
                  confirmType === 'watering' ? 'bg-sky-700 active:bg-sky-800' : 'bg-sky-500 active:bg-sky-600'
                }`}
              >
                <Droplets size={16} className="text-white" />
                <span className="text-sm font-bold text-white">
                  {confirmType === 'watering'
                    ? `Patvirtinti (${countdown})`
                    : `Laistyti${careChecked.size > 0 ? ` (${careChecked.size})` : ''}`}
                </span>
              </button>
              <button
                onClick={() => {
                  if (careChecked.size === 0) return
                  if (confirmType === 'fertilizing') { handleCareAction('fertilizing'); resetConfirm() }
                  else { resetConfirm(); setConfirmType('fertilizing'); setCountdown(5) }
                }}
                disabled={careChecked.size === 0}
                className={`flex-1 h-10 flex items-center justify-center gap-1.5 rounded-xl disabled:opacity-40 transition-colors ${
                  confirmType === 'fertilizing' ? 'bg-amber-700 active:bg-amber-800' : 'bg-amber-500 active:bg-amber-600'
                }`}
              >
                <FlaskConical size={16} className="text-white" />
                <span className="text-sm font-bold text-white">
                  {confirmType === 'fertilizing'
                    ? `Patvirtinti (${countdown})`
                    : `Tręšti${careChecked.size > 0 ? ` (${careChecked.size})` : ''}`}
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {careInfoPlant && (
          <CareWateringSheet
            key={careInfoPlant.id}
            plant={careInfoPlant}
            onClose={() => setCareInfoPlant(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showChat && (
          <CollectionChat
            key="dashboard-chat"
            title="Kolekcijos asistentas"
            icon={<img src={GARDENER} className="h-14 w-auto object-contain" alt="" />}
            iconLg={<img src={GARDENER} className="h-[70px] w-auto object-contain" alt="" />}
            systemPrompt={buildDashboardSystemPrompt(plants, zones)}
            onClose={() => setShowChat(false)}
            onSaveToZinynas={onSaveToZinynas}
            plants={plants}
            onViewPlant={onViewPlant}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
