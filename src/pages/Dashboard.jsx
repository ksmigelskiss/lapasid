import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useDragControls, useMotionValue, animate } from 'framer-motion'
import { Search, SlidersHorizontal, AlertTriangle, Droplets, Loader2, Image as ImageIcon, ChevronUp, ChevronDown, Leaf, ShieldAlert, Thermometer, MapPin, Sprout, FlaskConical, X, Camera, Check, UserCircle, Pencil } from 'lucide-react'
import ProfileSheet from '../components/ProfileSheet'
const GARDENER = '/gardener.png'
import PlantCard from '../components/PlantCard'
import CollectionChat from '../components/CollectionChat'
import { getFertilizingForecast } from '../utils/fertilizingForecast'
import { getDormancyForecast } from '../utils/dormancyForecast'
import { getWateringForecast, shouldShowWateringAlert } from '../utils/wateringForecast'
import { buildDashboardSystemPrompt } from '../utils/collectionChatContext'
import CareOverview from '../components/CareOverview'
import PostFertilizePrompt from '../components/PostFertilizePrompt'
import CareToast from '../components/CareToast'
import CareCircuitToast from '../components/CareCircuitToast'
import CareSessionSummary from '../components/CareSessionSummary'
import { aggregateConfidence, bucketCounts, moodFromCounts } from '../utils/careBuckets'
import { CARE_COPY, pick, fillTemplate } from '../constants/careCopy'

// Tuščia care session struktūra
const emptySession = () => ({
  watering:    { perfect: 0, early: 0, late: 0, waylate: 0 },
  fertilizing: { perfect: 0, early: 0, late: 0, waylate: 0 },
  plants: new Set(),
  // startConfidence — aggregate confidence snapshot care mode pradžioje.
  // Sesijos delta skaičiuojama exit metu kaip (current - start), todėl
  // automatiškai apima ir non-bulk veiksmus (single-plant CareWateringSheet,
  // PlantDetail, NFC) kurie irgi atnaujina plant.timeline ir atitinkamai
  // perskaičiuoja confidence.
  startConfidence: 0,
})

const sessionTotal = (s) =>
  s.watering.perfect + s.watering.early + s.watering.late + s.watering.waylate +
  s.fertilizing.perfect + s.fertilizing.early + s.fertilizing.late + s.fertilizing.waylate

// Apskaičiuoja aggregate confidence delta nuo watering veiksmo,
// simuliuojant naują event'ą plant.timeline atminty (be DB).
// Confidence skaičiuoja tik watering events, todėl tik kind='watering'
// realiai prideda. Kitiems return 0.
function computeWateringDelta(actedPlants, allPlantsCount, eventType, todayIso) {
  if (eventType !== 'watering' || allPlantsCount === 0 || actedPlants.length === 0) return 0
  let sumPlantDelta = 0
  for (const p of actedPlants) {
    const before = getWateringForecast(p).confidence ?? 0
    const simPlant = {
      ...p,
      timeline: [{ id: 'sim', type: 'watering', date: todayIso }, ...(p.timeline ?? [])],
    }
    const after = getWateringForecast(simPlant).confidence ?? 0
    sumPlantDelta += (after - before)
  }
  return sumPlantDelta / allPlantsCount
}
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

function CareWateringSheet({ plant, zones = [], onClose, onAddEvent }) {
  const wc = getWateringForecast(plant)
  const hasImg = !!plant.image
  const intervals = plant.laistymasIntervalas
  const desc = plant.prieziura?.laistymas
  const hasFert = getFertilizingForecast(plant).intervalDays != null
  const showInspect = wc.isOverdue && wc.lastType === 'watering'
  const currentZone = zones.find(z => z.id === plant.zonaId)
  const [postFert, setPostFert] = useState(false)

  const onWater     = () => { onAddEvent('watering');     onClose() }
  const onFertilize = () => { onAddEvent('fertilizing'); setPostFert(true) }
  const onInspect   = () => { onAddEvent('inspection');   onClose() }
  const onPalasciau = () => { onAddEvent('watering', { komentaras: 'Laistyta po tręšimo' }); onClose() }
  const onNelasciau = () => { onClose() }

  const fmtDate = iso => iso
    ? new Date(iso + 'T00:00:00').toLocaleDateString('lt-LT', { month: 'short', day: 'numeric' })
    : null
  const daysSince = iso => iso
    ? Math.floor((Date.now() - new Date(iso + 'T00:00:00')) / 86400000)
    : null

  const dragControls = useDragControls()
  const y = useMotionValue(0)
  const handleDragEnd = (_, info) => {
    if (info.velocity.y > 400 || info.offset.y > 120) onClose()
    else animate(y, 0, { type: 'spring', stiffness: 400, damping: 30 })
  }

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end justify-center">
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={onClose}
      />

      {/* Sheet — full-screen mobile width, identiška PlantDetail struktūrai */}
      <motion.div
        className="relative w-full max-w-[430px] bg-app flex flex-col"
        style={{ height: '100dvh', y }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0 }}
        dragElastic={{ top: 0, bottom: 0.25 }}
        onDragEnd={handleDragEnd}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
      >
        {/* Drag handle — pill viršuje, su safe-area pad */}
        <div className="absolute top-0 left-0 right-0 z-20 flex justify-center pb-2 pointer-events-none select-none" style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}>
          <div
            onPointerDown={e => dragControls.start(e)}
            className="px-8 py-1 cursor-grab active:cursor-grabbing pointer-events-auto"
            style={{ touchAction: 'none' }}
          >
            <div className="w-10 h-1 bg-black/15 rounded-full" />
          </div>
        </div>

        {/* ── Hero ── identiška PlantDetail */}
        {hasImg ? (
          <div className="relative flex-shrink-0 overflow-hidden" style={{ height: 'calc(17rem + env(safe-area-inset-top))' }}>
            <img src={plant.image} alt={plant.lietuviškas} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
            <div className="absolute right-4 z-30" style={{ top: 'max(1rem, env(safe-area-inset-top))' }}>
              <button
                onClick={onClose}
                className="w-11 h-11 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4">
              {currentZone && (
                <div className="inline-flex items-center gap-1 mb-1 px-2 py-0.5 rounded-lg bg-white/20">
                  <MapPin size={9} className="text-white/80" />
                  <span className="text-[10px] text-white/90 font-medium">{currentZone.name}</span>
                </div>
              )}
              <h2 className="text-xl font-bold text-white leading-tight">{plant.lietuviškas}</h2>
              {plant.lotyniskas && (
                <p className="text-xs text-white/70 italic mt-0.5">{plant.lotyniskas}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="relative flex-shrink-0 px-5 pb-4 bg-sage-50" style={{ paddingTop: 'max(1.75rem, env(safe-area-inset-top))' }}>
            <div className="flex items-center justify-end mb-3">
              <button
                onClick={onClose}
                className="w-11 h-11 bg-white/60 rounded-full flex items-center justify-center text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-white/80 rounded-2xl flex items-center justify-center text-3xl shadow-ios flex-shrink-0">
                {plant.emoji ?? '🌿'}
              </div>
              <div className="flex-1 min-w-0">
                {currentZone && (
                  <div className="inline-flex items-center gap-1 mb-1 px-2 py-0.5 rounded-lg bg-sage-100">
                    <MapPin size={9} className="text-sage-600" />
                    <span className="text-[10px] text-sage-700 font-medium">{currentZone.name}</span>
                  </div>
                )}
                <h2 className="text-lg font-bold text-gray-900 leading-tight">{plant.lietuviškas}</h2>
                {plant.lotyniskas && (
                  <p className="text-xs text-gray-500 italic mt-0.5">{plant.lotyniskas}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 pt-4 pb-4 space-y-4">

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

          {/* Method */}
          {wc.metodas && (
            <div className="bg-gray-50 rounded-2xl px-4 py-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Metodas</p>
              <p className="text-sm text-gray-700">{wc.metodas}</p>
            </div>
          )}

          {/* Current status */}
          <div className={`rounded-2xl px-4 py-3 ${wc.isOverdue ? 'bg-sky-50 border border-sky-100' : wc.isSnoozed ? 'bg-green-50 border border-green-100' : 'bg-gray-50'}`}>
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
              {(intervals?.vasara != null || wc.intervalDays != null) && (
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-sm text-gray-500 flex-shrink-0">Rekomenduojama</span>
                  <span className="text-sm font-semibold text-gray-800 text-right">
                    {intervals?.vasara != null
                      ? `vasarą kas ${intervals.vasara} d.`
                      : `kas ${wc.intervalDays} d.`}
                    {intervals && (
                      <span className="text-gray-400 font-normal">
                        {' · '}
                        {intervals.ziema === null
                          ? 'žiemą neskaistoma'
                          : intervals.ziema != null
                            ? `žiemą kas ${intervals.ziema} d.`
                            : ''}
                      </span>
                    )}
                  </span>
                </div>
              )}
              {wc.daysUntil != null && (
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-sm text-gray-500 flex-shrink-0">
                    {wc.isOverdue ? 'Galimai vėluoja' : 'Kitas'}
                  </span>
                  <span className={`text-sm font-bold text-right ${wc.isOverdue ? 'text-sky-600' : 'text-gray-800'}`}>
                    {wc.isOverdue
                      ? `${Math.abs(wc.daysUntil)} d.`
                      : `po ${wc.daysUntil} d.${wc.nextDate ? ` · ${fmtDate(wc.nextDate)}` : ''}`}
                  </span>
                </div>
              )}
              {wc.isSnoozed && wc.snoozedUntil && (
                <div className="flex justify-between items-baseline gap-2">
                  <span className="text-sm text-gray-500 flex-shrink-0">Patikrinta</span>
                  <span className="text-sm font-semibold text-green-700 text-right">
                    {fmtDate(wc.lastInspectionDate)} · ramybė iki {fmtDate(wc.snoozedUntil)}
                  </span>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Action bar — float apačioje, su safe-area pad */}
        <div className="flex-shrink-0 px-4 pt-3 border-t border-gray-100 bg-white" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          {postFert ? (
            <PostFertilizePrompt
              count={1}
              onPalasciau={onPalasciau}
              onNelasciau={onNelasciau}
            />
          ) : (
            <>
              <div className="flex gap-2 items-center">
                <button
                  onClick={onWater}
                  className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-xl bg-sky-500 active:bg-sky-600 transition-colors"
                >
                  <Droplets size={16} className="text-white" />
                  <span className="text-sm font-bold text-white">Laistyti</span>
                </button>
                {hasFert && (
                  <button
                    onClick={onFertilize}
                    className="flex-1 h-10 flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 active:bg-amber-600 transition-colors"
                  >
                    <FlaskConical size={16} className="text-white" />
                    <span className="text-sm font-bold text-white">Tręšti</span>
                  </button>
                )}
              </div>
              {showInspect && (
                <button
                  onClick={onInspect}
                  className="mt-2 w-full h-10 flex items-center justify-center gap-1.5 rounded-xl bg-green-500 active:bg-green-600 transition-colors"
                >
                  <Check size={16} className="text-white" />
                  <span className="text-sm font-bold text-white">Patikrinau — viskas tvarkoj</span>
                </button>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  )
}

function QuarantineSection({ plants, zones, onTap, careMode, careChecked, onCareToggle, onCareInfo }) {
  const [open, setOpen] = useState(true)
  const containerRef = useRef(null)
  const orderedPlants = pinChecked(plants, careMode, careChecked)
  return (
    <div ref={containerRef} className="mb-3">
      <div className="w-full flex items-center gap-2 py-2">
        <button onClick={() => setOpen(v => !v)} className="flex items-center gap-1.5 min-w-0">
          <ShieldAlert size={13} className="text-red-400 flex-shrink-0" />
          <span className="text-sm font-bold text-red-600">Karantinas</span>
          <span className="text-xs text-red-300 flex-shrink-0">{plants.length}</span>
        </button>
        <div className="flex-1 h-px bg-gradient-to-r from-red-200/70 to-transparent ml-2" />
        <button onClick={() => setOpen(v => !v)} className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
          {open ? <ChevronUp size={14} className="text-red-300" /> : <ChevronDown size={14} className="text-red-300" />}
        </button>
      </div>
      {open && (
        <div className="bg-red-50 rounded-2xl p-1.5">
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

function ZoneSection({ zone, plants, onTap, careMode, careChecked, onCareToggle, onCareInfo }) {
  const [open, setOpen] = useState(true)
  const containerRef = useRef(null)
  const sickPlants    = pinChecked(plants.filter(p => p.status === 'sick'),    careMode, careChecked)
  const healthyPlants = pinChecked(plants.filter(p => p.status !== 'sick'), careMode, careChecked)

  const carePropsFn = (plant) => careMode ? {
    careMode: true,
    checked: careChecked?.has(plant.id),
    onToggle: () => onCareToggle(plant.id),
    onCareInfo: () => onCareInfo?.(plant),
  } : {}

  return (
    <div ref={containerRef} className="mb-3">
      <div className="w-full flex items-center gap-2 py-2">
        <button onClick={() => setOpen(v => !v)} className="flex items-center gap-1.5 min-w-0">
          <MapPin size={13} className="text-sage-400 flex-shrink-0" />
          <span className="text-sm font-bold text-gray-700 truncate">{zone.name}</span>
          <span className="text-xs text-gray-400 flex-shrink-0">{plants.length}</span>
        </button>
        <div className="flex-1 h-px bg-gradient-to-r from-sage-200/70 to-transparent ml-2" />
        <button onClick={() => setOpen(v => !v)} className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
          {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </button>
      </div>
      {open && (
        <div className="space-y-3">
          {sickPlants.length > 0 && (
            <div className="bg-amber-50 rounded-2xl p-1.5">
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

export default function Dashboard({ plants, allPlants = [], zones = [], onTap, onTapFromCare, onSearch, onSearchByCamera, onFetchAllImages, fetchingAll, onSaveToZinynas, onViewPlant, onRefresh, onAddTimelineEvent, onAddZone, onUpdateZone, onDeleteZone, onReorderZones, onCareModeChange, user, collectionId, onSignOut, role = 'owner', allCollections = [], onSwitchCollection, onRenameCollection, ownCollectionId }) {
  const quarantinePlants = plants.filter(p => p.status === 'quarantine')
  // sick plants stay in their zone (mainPlants includes them)
  const mainPlants       = plants.filter(p => p.status !== 'quarantine')
  const missingCount     = plants.filter(p => !p.image).length
  const overdueList      = mainPlants.filter(p => getFertilizingForecast(p).isOverdue)
  const wateringList     = mainPlants.filter(p => shouldShowWateringAlert(p))
  const [sortKey, setSortKey]         = useState('added')
  const [showFilters, setShowFilters] = useState(false)
  const [showChat, setShowChat]       = useState(false)
  const [searching, setSearching]     = useState(false)
  const [query, setQuery]             = useState('')
  const [showProfile,    setShowProfile]    = useState(false)
  const [showSwitcher,   setShowSwitcher]   = useState(false)
  const [editingName,    setEditingName]    = useState(false)
  const [nameInput,      setNameInput]      = useState('')
  const [careMode, setCareMode]         = useState(false)
  const [careChecked, setCareChecked]   = useState(new Set())
  const [careInfoPlant, setCareInfoPlant] = useState(null)
  const [postFertilizeFor, setPostFertilizeFor] = useState(null) // null | Set<plantId> — laukia "ar palaistei?" atsakymo
  const [careToast, setCareToast] = useState(null)         // { headline, counts, total } | null — bulk action reward
  const careToastTimerRef = useRef(null)
  const sessionRef = useRef(emptySession())                 // Visi care session veiksmai aggregate'inami
  const [showSummary, setShowSummary] = useState(null)      // session snapshot | null — modal po exit
  const [confirmType, setConfirmType]   = useState(null)   // 'watering' | 'fertilizing' | null
  const [countdown, setCountdown]       = useState(5)
  const confirmTimerRef = useRef(null)
  const inputRef        = useRef(null)
  const scrollRef       = useRef(null)
  const unzonedRef      = useRef(null)

  const toggleCare = useCallback((id) => {
    setCareChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const resetConfirm = useCallback(() => {
    clearInterval(confirmTimerRef.current)
    setConfirmType(null)
    setCountdown(5)
  }, [])

  // careConfidence — aggregate per visus auginama augalus.
  // Turi būti deklaruotas PRIEŠ exitCareMode ir useEffect kurie jį naudoja
  // (kitaip TDZ klaida useCallback dependency array'uje).
  const careConfidence = useMemo(
    () => aggregateConfidence(mainPlants.map(p => getWateringForecast(p))),
    [mainPlants]
  )

  const exitCareMode = useCallback(() => {
    resetConfirm()
    setCareChecked(new Set())
    setPostFertilizeFor(null)
    setCareToast(null)
    if (careToastTimerRef.current) clearTimeout(careToastTimerRef.current)
    // Jei session turėjo veiksmų — parodom summary modal'ą; care mode visada baigiamas
    const s = sessionRef.current
    if (sessionTotal(s) > 0) {
      // Snapshot/diff: pakaitalas per-action sumai. Tikslesnis, nes apima
      // visus confidence pokyčius (bulk + single-plant + bet kokie kiti),
      // kurie atnaujino plant.timeline care mode metu.
      const rawDelta = Math.round((careConfidence - (s.startConfidence ?? 0)) * 100)
      setShowSummary({
        watering:    { ...s.watering },
        fertilizing: { ...s.fertilizing },
        plants:      new Set(s.plants),
        deltaPct:    Math.max(0, rawDelta),  // negatyvių (outlier filtravimas) nerodom
      })
    }
    sessionRef.current = emptySession()
    setCareMode(false)
  }, [resetConfirm, careConfidence])

  const dismissSummary = useCallback(() => setShowSummary(null), [])

  // Care mode'o pradžia — reset'inam session ir snapshot'inam pradinį confidence.
  // Snapshot reikalingas, kad sesijos delta būtų tikslus net jei vartotojas
  // padaro single-plant veiksmų (CareWateringSheet long-press) care mode metu.
  useEffect(() => {
    if (careMode) {
      sessionRef.current = emptySession()
      sessionRef.current.startConfidence = careConfidence
    }
  }, [careMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // DEV/DEMO: parodo fake toast'ą be jokio DB rašymo. Cikliuoja per 3 delta dydžius.
  const careToastDemoIdx = useRef(0)
  const runCareToastDemo = useCallback(() => {
    const samples = [4, 2, 7]  // skirtingi delta dydžiai
    const deltaPct = samples[careToastDemoIdx.current % samples.length]
    careToastDemoIdx.current += 1
    setCareToast({ kind: 'delta', deltaPct, phrase: pick(CARE_COPY.delta) })
    if (careToastTimerRef.current) clearTimeout(careToastTimerRef.current)
    careToastTimerRef.current = setTimeout(() => setCareToast(null), 3000)
  }, [])

  // DEV/DEMO: circuit toast su fake zonos vardu. Cikliuoja zona ↔ frazė variantus.
  const careCircuitDemoIdx = useRef(0)
  const runCareCircuitDemo = useCallback(() => {
    const fakeZones = ['Virtuvė', 'Svetainė', 'Miegamasis', 'Balkonas']
    const zoneName = fakeZones[careCircuitDemoIdx.current % fakeZones.length]
    careCircuitDemoIdx.current += 1
    const message = fillTemplate(pick(CARE_COPY.circuit), { zone: zoneName })
    setCareToast({ kind: 'circuit', message })
    if (careToastTimerRef.current) clearTimeout(careToastTimerRef.current)
    careToastTimerRef.current = setTimeout(() => setCareToast(null), 3500)
  }, [])

  // Detect zonų, kurios po simuliuotų event'ų pridėjimo eina iš todo>0 → todo=0.
  // Naudojama circuit toast'ui („Virtuvė pasirūpinta"). Pure JS, jokio I/O.
  const detectClearedZones = useCallback((actedIds, eventTypes) => {
    const idSet = actedIds instanceof Set ? actedIds : new Set(actedIds)
    const t = today()
    const cleared = []
    for (const z of zones) {
      const zonePlants = mainPlants.filter(p => p.zonaId === z.id)
      if (zonePlants.length === 0) continue
      const before = zonePlants.filter(p => shouldShowWateringAlert(p) || getFertilizingForecast(p).isOverdue).length
      if (before === 0) continue  // zona jau buvo tuščia — nieko įdomaus
      const afterCount = zonePlants
        .map(p => {
          if (!idSet.has(p.id)) return p
          const newEvents = eventTypes.map((type, i) => ({ id: 'sim_' + i, type, date: t }))
          return { ...p, timeline: [...newEvents, ...(p.timeline ?? [])] }
        })
        .filter(p => shouldShowWateringAlert(p) || getFertilizingForecast(p).isOverdue).length
      if (afterCount === 0) cleared.push(z.name)
    }
    return cleared
  }, [mainPlants, zones])

  // Bulk action akumuliacija + per-action toast.
  // Prioritizuoja circuit toast'ą virš delta toast'o (kai zona pilnai išvaloma —
  // tai didesnis momentas nei pats prieaugis).
  // Skip jei nei circuit nei delta — tyla geriau nei „+0%" arba tuščias toast'as.
  const showCareToast = useCallback((plantsToShow, eventTypes, primaryKind) => {
    const days = plantsToShow
      .map(p => primaryKind === 'watering' ? getWateringForecast(p).daysUntil : getFertilizingForecast(p).daysUntil)
      .filter(d => d != null)
    if (days.length === 0) return
    const counts = bucketCounts(days)

    // Confidence delta — tik watering keičia confidence
    const hasWatering = eventTypes.includes('watering')
    const deltaFraction = hasWatering ? computeWateringDelta(plantsToShow, mainPlants.length, 'watering', today()) : 0
    const deltaPct = Math.round(deltaFraction * 100)

    // Aggregate į session (visada — breakdown matomas summary'je)
    const sb = sessionRef.current[primaryKind]
    sb.perfect += counts.perfect
    sb.early   += counts.early
    sb.late    += counts.late
    sb.waylate += counts.waylate
    plantsToShow.forEach(p => sessionRef.current.plants.add(p.id))
    // Pastaba: nebenakaupiame deltaPct į session — sesijos delta dabar
    // skaičiuojama snapshot/diff būdu exit metu (žr. exitCareMode).
    // Tai užfiksuoja IR single-plant veiksmus, kurie neateina per šį path'ą.

    // Circuit detection — ar bet kuri zona po šio veiksmo lieka be todo
    const cleared = detectClearedZones(plantsToShow.map(p => p.id), eventTypes)

    // Toast prioritetas: circuit > delta. Jei nei vienas — tylu.
    if (cleared.length > 0) {
      const message = fillTemplate(pick(CARE_COPY.circuit), { zone: cleared[0] })
      setCareToast({ kind: 'circuit', message })
      if (careToastTimerRef.current) clearTimeout(careToastTimerRef.current)
      careToastTimerRef.current = setTimeout(() => setCareToast(null), 3500)
    } else if (deltaPct > 0) {
      setCareToast({ kind: 'delta', deltaPct, phrase: pick(CARE_COPY.delta) })
      if (careToastTimerRef.current) clearTimeout(careToastTimerRef.current)
      careToastTimerRef.current = setTimeout(() => setCareToast(null), 3000)
    }
  }, [mainPlants.length, detectClearedZones])

  // DEMO: session summary fake data
  const runSessionSummaryDemo = useCallback(() => {
    setShowSummary({
      watering:    { perfect: 5, early: 2, late: 1, waylate: 0 },
      fertilizing: { perfect: 2, early: 0, late: 0, waylate: 1 },
      plants: new Set(['fake1','fake2','fake3','fake4','fake5','fake6','fake7','fake8']),
      deltaPct: 7,  // demo: +7% sesijos pažinimo prieaugis
    })
  }, [])

  // Keep screen awake while in care mode
  // Praneša parent'ui apie care mode būseną (kad App.jsx galėtų slėpti Navigation)
  useEffect(() => { onCareModeChange?.(careMode) }, [careMode, onCareModeChange])

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
    const ids = new Set(careChecked)
    // Snapshot pre-action plant data — buckets'ams reikia daysUntil prieš įrašant
    const ourPlants = mainPlants.filter(p => ids.has(p.id))
    ids.forEach(plantId => {
      onAddTimelineEvent(plantId, { id: makeId(), type, date: t, komentaras: comment })
    })
    resetConfirm()
    setCareChecked(new Set())
    if (type === 'fertilizing' && ids.size > 0) {
      setPostFertilizeFor(ids)
      // Toast'as bus parodytas po Palaisčiau / Nelaisčiau (kad neperdengtų prompt'o)
      return
    }
    // Watering — toast iškart
    showCareToast(ourPlants, ['watering'], 'watering')
  }, [careChecked, mainPlants, onAddTimelineEvent, resetConfirm, showCareToast])

  const confirmPostFertWater = useCallback(() => {
    if (!postFertilizeFor) return
    const t = today()
    const ourPlants = mainPlants.filter(p => postFertilizeFor.has(p.id))
    postFertilizeFor.forEach(plantId => {
      onAddTimelineEvent(plantId, { id: makeId(), type: 'watering', date: t, komentaras: 'Laistyta po tręšimo' })
    })
    setPostFertilizeFor(null)
    // Pridėtas ir fert (anksčiau handleCareAction etape), ir water — abu simuliuojami circuit detectionui
    showCareToast(ourPlants, ['fertilizing', 'watering'], 'watering')
  }, [postFertilizeFor, mainPlants, onAddTimelineEvent, showCareToast])

  const dismissPostFert = useCallback(() => {
    if (!postFertilizeFor) return
    const ourPlants = mainPlants.filter(p => postFertilizeFor.has(p.id))
    setPostFertilizeFor(null)
    // Tik tręšimas įrašytas — circuit detection simuliuoja tik fert
    showCareToast(ourPlants, ['fertilizing'], 'fertilizing')
  }, [postFertilizeFor, mainPlants, showCareToast])

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
    <div className="flex flex-col h-full bg-app">
      {/* Top region — header + search + sort. Slepiama animuotai care mode'e
          (kad augalų grid'as gautų visą ekraną). */}
      <AnimatePresence initial={false}>
        {!careMode && (
          <motion.div
            key="dash-top"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
      {/* Header */}
      <div className="px-5 pb-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <div className="flex items-center justify-between">
          <div className="relative">
            {/* Avatar + kolekcijos etiketė */}
            <div className="flex items-center gap-2 mb-0.5">
              {role !== 'viewer' && (
                <button
                  onClick={() => setShowProfile(true)}
                  className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 border border-gray-200 active:opacity-70 transition-opacity"
                >
                  {user?.photoURL
                    ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-sage-100 flex items-center justify-center">
                        <UserCircle size={12} className="text-sage-500" />
                      </div>
                  }
                </button>
              )}
              {/* Kolekcijų switcher — rodomas kai > 1 kolekcija su augalais */}
              {(() => {
                const switcher = allCollections.filter(c => c.hasPlants !== false)
                return switcher.length > 1 ? (
                  <button
                    onClick={() => setShowSwitcher(v => !v)}
                    className="flex items-center gap-1 active:opacity-70"
                  >
                    <p className="text-[11px] font-semibold text-sage-400 uppercase tracking-[0.12em]">
                      {allCollections.find(c => c.id === collectionId)?.name ?? 'Mano augalai'}
                    </p>
                    <ChevronDown size={11} className="text-sage-400" />
                  </button>
                ) : (
                  <p className="text-[11px] font-semibold text-sage-400 uppercase tracking-[0.12em]">Mano kolekcija</p>
                )
              })()}
            </div>

            {/* Kolekcijos pavadinimas — inline edit owner'iui */}
            {editingName ? (
              <input
                autoFocus
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onBlur={() => {
                  if (nameInput.trim()) onRenameCollection?.(collectionId, nameInput.trim())
                  setEditingName(false)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') e.target.blur()
                  if (e.key === 'Escape') { setEditingName(false) }
                }}
                className="text-[28px] font-extrabold text-gray-900 leading-tight tracking-tight bg-transparent outline-none border-b-2 border-sage-400 w-full"
              />
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-[28px] font-extrabold text-gray-900 leading-tight tracking-tight">
                  {allCollections.find(c => c.id === collectionId)?.name ?? 'Mano augalai'}
                </h1>
                {role === 'owner' && (
                  <button
                    onClick={() => {
                      setNameInput(allCollections.find(c => c.id === collectionId)?.name ?? 'Mano augalai')
                      setEditingName(true)
                    }}
                    className="opacity-40 active:opacity-80 mt-1"
                  >
                    <Pencil size={14} className="text-gray-500" />
                  </button>
                )}
              </div>
            )}

            {/* Switcher dropdown */}
            {showSwitcher && allCollections.filter(c => c.hasPlants !== false).length > 1 && (
              <div className="absolute top-full left-0 mt-2 bg-white rounded-2xl shadow-lg border border-gray-100 z-10 min-w-[200px] overflow-hidden">
                {allCollections.filter(c => c.hasPlants !== false).map(c => (
                  <button
                    key={c.id}
                    onClick={() => { onSwitchCollection?.(c.id); setShowSwitcher(false) }}
                    className={`w-full flex items-center gap-2.5 px-4 py-3 text-left text-sm transition-colors ${c.id === collectionId ? 'bg-sage-50 font-semibold text-sage-700' : 'text-gray-700 active:bg-surface'}`}
                  >
                    {c.id === collectionId && <Check size={14} className="text-sage-500 flex-shrink-0" />}
                    <span className={c.id === collectionId ? '' : 'ml-[22px]'}>{c.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {/* Top row: laistymas + augalai */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setCareMode(v => !v); setCareChecked(new Set()) }}
                className={`relative transition-colors rounded-2xl px-3.5 py-2 flex flex-col items-center justify-center h-[58px] ${careMode ? 'bg-sage-500 active:bg-sage-600' : 'bg-white border border-gray-200 active:bg-surface'}`}
              >
                <Sprout size={20} className={careMode ? 'text-white' : 'text-sage-500'} />
                <span className={`text-[10px] font-medium mt-0.5 ${careMode ? 'text-white' : 'text-sage-500'}`}>priežiūra</span>
                {/* Confidence badge — rodomas tik išėjus iš care mode'o ir kai turime duomenų */}
                {!careMode && mainPlants.length > 0 && careConfidence > 0 && (
                  <div className={`absolute -top-1.5 -right-1.5 px-1.5 h-[16px] flex items-center justify-center rounded-full shadow-sm ${
                    careConfidence >= 0.66 ? 'bg-sage-500' :
                    careConfidence >= 0.33 ? 'bg-amber-400' :
                    'bg-gray-300'
                  }`}>
                    <span className="text-[9px] font-bold leading-none text-white">{Math.round(careConfidence * 100)}%</span>
                  </div>
                )}
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
      {role !== 'viewer' && <div className="px-5 mb-3 flex gap-2">
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
      </div>}


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
          </motion.div>
        )}
      </AnimatePresence>

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
      {!searching && <div ref={scrollRef} className={`flex-1 overflow-y-auto scrollbar-none px-5 ${role === 'viewer' ? 'pb-8' : 'pb-28'}`}>

        {/* Care overview — slepiama care mode'e (vartotojas jau dirba su augalais tiesiogiai) */}
        {!careMode && <CareOverview plants={mainPlants} onTap={setCareInfoPlant} />}

        {/* Karantinas pseudo-zone */}
        {quarantinePlants.length > 0 && (
          <QuarantineSection plants={quarantinePlants} zones={zones} onTap={onTap}
            careMode={careMode} careChecked={careChecked} onCareToggle={toggleCare} onCareInfo={setCareInfoPlant} />
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
                careMode={careMode} careChecked={careChecked} onCareToggle={toggleCare} onCareInfo={setCareInfoPlant} />
            ))}
            {unzonedPlants.length > 0 && (
              <div ref={unzonedRef} className="mb-3">
                <div className="flex items-center gap-2 py-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex-shrink-0">Nepriskirti</p>
                  <div className="flex-1 h-px bg-gradient-to-r from-gray-200 to-transparent" />
                </div>
                <div className="space-y-3">
                  {pinChecked(unzonedPlants.filter(p => p.status === 'sick'), careMode, careChecked).length > 0 && (
                    <div className="bg-amber-50 rounded-2xl p-1.5">
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

      {/* Floating AI bubble — hidden in care mode and for viewers */}
      {plants.length > 0 && !careMode && role !== 'viewer' && (
        <button
          onClick={() => setShowChat(true)}
          className="absolute bottom-24 right-4 active:scale-90 transition-transform z-10"
        >
          <img src={GARDENER} className="h-[96px] w-auto object-contain drop-shadow opacity-90 animate-idle-float-gardener" alt="" />
        </button>
      )}

      {/* Care reward toast — viršuje, kaip notification.
          Matomas ir care mode'e (header paslėptas), ir ne care mode'e
          (single-plant veiksmai per CareWateringSheet). z-30 tinka virš
          dashboard'o, ne care mode'e gali trumpai uždengti header'į. */}
      <AnimatePresence>
        {careToast && (
          <motion.div
            key="care-toast"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed top-0 left-0 right-0 z-30 pointer-events-none"
            style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
          >
            <div className="max-w-[430px] mx-auto px-4">
              {careToast.kind === 'circuit'
                ? <CareCircuitToast message={careToast.message} />
                : <CareToast deltaPct={careToast.deltaPct} phrase={careToast.phrase} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Care session summary modal — atsiranda išėjus iš care mode po >0 veiksmų */}
      <AnimatePresence>
        {showSummary && <CareSessionSummary session={showSummary} confidence={careConfidence} onDismiss={dismissSummary} />}
      </AnimatePresence>

      {/* Care mode action bar */}
      <AnimatePresence>
        {careMode && (
          <motion.div
            key="care-bar"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed bottom-2 left-0 right-0 z-30"
          >
            <div className="max-w-[430px] mx-auto px-4 pb-2">
            {/* DEV/DEMO: trys mygtukai be DB rašymo. Pašalinti po testavimo. */}
            <div className="absolute -top-7 right-4 flex gap-1.5">
              <button
                onClick={runCareToastDemo}
                className="text-[10px] font-medium text-gray-400 bg-white/80 backdrop-blur-sm rounded-md px-2 py-0.5 border border-gray-200"
              >
                Demo delta
              </button>
              <button
                onClick={runCareCircuitDemo}
                className="text-[10px] font-medium text-gray-400 bg-white/80 backdrop-blur-sm rounded-md px-2 py-0.5 border border-gray-200"
              >
                Demo circuit
              </button>
              <button
                onClick={runSessionSummaryDemo}
                className="text-[10px] font-medium text-gray-400 bg-white/80 backdrop-blur-sm rounded-md px-2 py-0.5 border border-gray-200"
              >
                Demo summary
              </button>
            </div>
            {postFertilizeFor ? (
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-3">
                <PostFertilizePrompt
                  count={postFertilizeFor.size}
                  onPalasciau={confirmPostFertWater}
                  onNelasciau={dismissPostFert}
                />
              </div>
            ) : (
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
                onClick={role === 'viewer' ? undefined : () => {
                  if (careChecked.size === 0) return
                  if (confirmType === 'fertilizing') { handleCareAction('fertilizing'); resetConfirm() }
                  else { resetConfirm(); setConfirmType('fertilizing'); setCountdown(5) }
                }}
                disabled={role === 'viewer' || careChecked.size === 0}
                className={`flex-1 h-10 flex items-center justify-center gap-1.5 rounded-xl transition-colors ${
                  role === 'viewer'
                    ? 'bg-amber-500 opacity-25 cursor-not-allowed'
                    : `disabled:opacity-40 ${confirmType === 'fertilizing' ? 'bg-amber-700 active:bg-amber-800' : 'bg-amber-500 active:bg-amber-600'}`
                }`}
              >
                <FlaskConical size={16} className="text-white" />
                <span className="text-sm font-bold text-white">
                  {role !== 'viewer' && confirmType === 'fertilizing'
                    ? `Patvirtinti (${countdown})`
                    : `Tręšti${role !== 'viewer' && careChecked.size > 0 ? ` (${careChecked.size})` : ''}`}
                </span>
              </button>
            </div>
            )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {careInfoPlant && (
          <CareWateringSheet
            key={careInfoPlant.id}
            plant={careInfoPlant}
            zones={zones}
            onClose={() => setCareInfoPlant(null)}
            onAddEvent={(type, extra = {}) => {
              const plant = careInfoPlant
              onAddTimelineEvent(plant.id, { id: makeId(), type, date: today(), komentaras: '', ...extra })
              // Reward toast — tik watering veiksmui (delta + circuit šiame eventType nenuliniai).
              // Detektuojam Palaisčiau path'ą per komentaro hint'ą — fert irgi reikia simuliuoti
              // circuit detection'ui (jis pridėtas anksčiau handleFertilizeTap step'e).
              if (type === 'watering') {
                const eventTypes = extra.komentaras === 'Laistyta po tręšimo'
                  ? ['fertilizing', 'watering']
                  : ['watering']
                showCareToast([plant], eventTypes, 'watering')
              }
            }}
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

      <AnimatePresence>
        {showProfile && (
          <ProfileSheet
            key="profile"
            user={user}
            collectionId={collectionId}
            role={role}
            ownCollectionId={ownCollectionId}
            allCollections={allCollections}
            onSignOut={onSignOut}
            onClose={() => setShowProfile(false)}
            onSwitchCollection={colId => { onSwitchCollection?.(colId); setShowProfile(false) }}
            onRenameCollection={onRenameCollection}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
