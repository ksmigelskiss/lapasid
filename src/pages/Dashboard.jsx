import { useState, useMemo, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, SlidersHorizontal, AlertTriangle, Droplets, Loader2, Image as ImageIcon, ChevronUp, ChevronDown, Leaf, ShieldAlert, Thermometer, MapPin, Sprout, FlaskConical, X, Camera, Check, Pencil, RefreshCw } from 'lucide-react'
import PlantCard from '../components/PlantCard'
import CollectionChat from '../components/CollectionChat'
import CareOverview from '../components/CareOverview'
import CareWateringSheet from '../components/CareWateringSheet'
import CareToast from '../components/CareToast'
import CareCircuitToast from '../components/CareCircuitToast'
import CareSessionSummary from '../components/CareSessionSummary'
import PostFertilizePrompt from '../components/PostFertilizePrompt'
import { getFertilizingForecast } from '../utils/fertilizingForecast'
import { getWateringForecast, shouldShowWateringAlert } from '../utils/wateringForecast'
import { buildDashboardSystemPrompt } from '../utils/collectionChatContext'
import { aggregateConfidence, bucketCounts, moodFromCounts, computeWateringDelta } from '../utils/careBuckets'
import AccuracySprite from '../components/AccuracySprite'
import { CARE_COPY, pick, fillTemplate } from '../constants/careCopy'
import { SORT_OPTIONS, sortPlants } from '../utils/plantSort'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { makeId, today } from '../utils/plantTransform'
import T4Icon from '../components/brand/T4Icon'
import Mascot from '../components/brand/Mascot'

// GARDENER asset'as pakeistas <Mascot type="gardener"> komponentu.
// Senas /gardener.png lieka public/ folder'yje kaip fallback'as.

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


function QuarantineSection({ plants, zones, onTap, careMode, careChecked, onCareToggle, onCareInfo }) {
  const [open, setOpen] = useState(true)
  const containerRef = useRef(null)
  const orderedPlants = pinChecked(plants, careMode, careChecked)
  return (
    <div ref={containerRef} className="mb-3">
      <div className="w-full flex items-center gap-2 py-2">
        <button onClick={() => setOpen(v => !v)} className="flex items-center gap-2 min-w-0">
          <ShieldAlert size={13} className="text-terracotta flex-shrink-0" />
          <span className="font-display font-semibold text-sm tracking-tight text-terracotta-600">Karantinas</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-terracotta-400 flex-shrink-0">· {plants.length}</span>
        </button>
        <div className="flex-1 h-px bg-gradient-to-r from-terracotta-200/70 to-transparent ml-2" />
        <button onClick={() => setOpen(v => !v)} className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
          {open ? <ChevronUp size={14} className="text-terracotta-300" /> : <ChevronDown size={14} className="text-terracotta-300" />}
        </button>
      </div>
      {open && (
        <div className="bg-bone-50 border-2 border-terracotta/50 rounded-2xl p-1.5">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
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
        <button onClick={() => setOpen(v => !v)} className="flex items-center gap-2 min-w-0">
          <MapPin size={13} className="text-forest-400 flex-shrink-0" />
          <span className="font-display font-semibold text-sm tracking-tight text-forest-700 truncate">{zone.name}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest-400 flex-shrink-0">· {plants.length}</span>
        </button>
        <div className="flex-1 h-px bg-gradient-to-r from-forest-200/70 to-transparent ml-2" />
        <button onClick={() => setOpen(v => !v)} className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
          {open ? <ChevronUp size={14} className="text-forest-300" /> : <ChevronDown size={14} className="text-forest-300" />}
        </button>
      </div>
      {open && (
        <div className="space-y-3">
          {sickPlants.length > 0 && (
            <div className="bg-bone-50 border border-forest-300/50 rounded-2xl p-1.5">
              <div className="flex items-center gap-1.5 mb-2 px-1">
                <Thermometer size={11} className="text-forest-500" />
                <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-forest-600">Dėmesio</span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
                {sickPlants.map(plant => (
                  <PlantCard key={plant.id} plant={plant} section="auginama" onTap={() => onTap(plant)} zoneName={zone.name} {...carePropsFn(plant)} />
                ))}
              </div>
            </div>
          )}
          {healthyPlants.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
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

function Dashboard({ plants, allPlants = [], zones = [], onTap, onTapFromCare, onSearch, onSearchByCamera, onFetchAllImages, fetchingAll, onSaveToZinynas, onViewPlant, onRefresh, onAddTimelineEvent, onAddZone, onUpdateZone, onDeleteZone, onReorderZones, onCareModeChange, onCareConfidenceChange, user, collectionId, onSignOut, role = 'owner', allCollections = [], onSwitchCollection, onRenameCollection, ownCollectionId, hideInnerHeader = false }, ref) {
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
  const [showSwitcher,   setShowSwitcher]   = useState(false)
  const [editingName,    setEditingName]    = useState(false)
  const [nameInput,      setNameInput]      = useState('')
  const [careMode, setCareMode]         = useState(false)
  const [careChecked, setCareChecked]   = useState(new Set())
  // CareWateringSheet kontekstas. Vietoj objekto saugom ID + opcionalų navigacijos sąrašą,
  // kad galėtume cyclinti per priežiūros santraukos sąrašą (Patikrink ar ne sausi /
  // Pamaitink augalėlį). Plant duomenys live-resolve'inami iš mainPlants per useMemo,
  // todėl jie visada šviežūs po veiksmų (Firestore listener atnaujina mainPlants).
  const [careInfoPlantId, setCareInfoPlantId] = useState(null)
  const [careInfoList, setCareInfoList]       = useState(null) // string[] | null — augalų ID sąrašas navigacijai
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

  // Pranešam App'ui apie confidence pasikeitimus, kad DesktopHeader
  // (kuris renderinasi App lygyje) galėtų atvaizduoti tą pačią reikšmę.
  useEffect(() => {
    onCareConfidenceChange?.(careConfidence)
  }, [careConfidence, onCareConfidenceChange])

  // Imperative API: leidžia App per ref iškviesti careMode toggle iš
  // DesktopHeader'io + atidaryti CareWateringSheet iš bell popup'o.
  useImperativeHandle(ref, () => ({
    toggleCareMode: () => {
      setCareMode(v => !v)
      setCareChecked(new Set())
    },
    // Toggle: jei tas pats plant.id jau atvertas — uždarom (pirmas atidaro,
    // antras uždaro). Naudojam funkcinį setState, kad gauti šviežią state'ą
    // (useImperativeHandle deps yra [] → closure'as nebūtų aktualus).
    openCareInfo: (plant, list) => {
      setCareInfoPlantId(curr => {
        if (curr === plant.id) {
          setCareInfoList(null)
          return null
        }
        setCareInfoList(list ? list.map(p => p.id) : null)
        return plant.id
      })
    },
    closeCareInfo: () => {
      setCareInfoPlantId(null)
      setCareInfoList(null)
    },
  }), [])

  // CareWateringSheet: derived state ir navigacijos handler'iai
  const careInfoPlant = useMemo(
    () => careInfoPlantId ? mainPlants.find(p => p.id === careInfoPlantId) ?? null : null,
    [careInfoPlantId, mainPlants]
  )
  const careInfoIdx = (careInfoList && careInfoPlantId) ? careInfoList.indexOf(careInfoPlantId) : -1

  // Atidarymas — list opcionalus (nav strėlės rodomos tik jei list pateikta).
  // Long-press care mode'e neperduoda list (viengubas augalas), priežiūros
  // santraukos tap'as perduoda atitinkamo skyrelio sąrašą (watering / fert).
  const openCareInfo = useCallback((plant, list) => {
    setCareInfoPlantId(plant.id)
    setCareInfoList(list ? list.map(p => p.id) : null)
  }, [])

  const closeCareInfo = useCallback(() => {
    setCareInfoPlantId(null)
    setCareInfoList(null)
  }, [])

  const goCareInfoPrev = useCallback(() => {
    if (!careInfoList || careInfoIdx <= 0) return
    setCareInfoPlantId(careInfoList[careInfoIdx - 1])
  }, [careInfoList, careInfoIdx])

  const goCareInfoNext = useCallback(() => {
    if (!careInfoList || careInfoIdx === -1 || careInfoIdx >= careInfoList.length - 1) return
    setCareInfoPlantId(careInfoList[careInfoIdx + 1])
  }, [careInfoList, careInfoIdx])

  // Auto-advance po veiksmo: jei sąraše dar yra augalų — pereiti į kitą,
  // kitaip uždaryti sheet'ą. Variant B (vartotojo pasirinkimas).
  const onCareInfoAfterAction = useCallback(() => {
    if (careInfoList && careInfoIdx !== -1 && careInfoIdx < careInfoList.length - 1) {
      setCareInfoPlantId(careInfoList[careInfoIdx + 1])
    } else {
      closeCareInfo()
    }
  }, [careInfoList, careInfoIdx, closeCareInfo])

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
      {/* Senas mobile inner header (collection switcher + care toggle + plants count + foto)
          pašalintas. Greeting + AccuracyButton dabar visada renderinami žemiau (per
          CareOverview mode="greeting" bigGreeting), t.y. tas pats modulis kaip ir desktop'e. */}

      {/* Search row content — extractintas, kad reuse'intume tiek mobile (atskira eilutė),
          tiek desktop (inline su greeting'u). Kiekvienas vaikas turi flex hint'us. */}
      {(() => {
        const searchRow = role !== 'viewer' && (
          <>
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
          </>
        )

        return null  // Greeting'as perkeltas Į scrollable container'į žemiau —
                     // natural scroll be JS scroll-direction logikos.
      })()}


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
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 mb-3">
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
                  <Search size={40} className="text-forest-300" />
                  <p className="text-sm font-display font-semibold tracking-tight text-forest-700">„{query}" nerasta bibliotekoje</p>
                  <button
                    onClick={launchFullSearch}
                    className="mt-1 px-6 py-3 rounded-btn font-display text-sm font-semibold text-bone bg-forest-700 hover:bg-forest-800 transition-colors"
                  >
                    ✦ Ieškoti su AI
                  </button>
                </div>
              )}
              {searchResults.length > 0 && (
                <button
                  onClick={launchFullSearch}
                  className="w-full mt-3 py-3 rounded-btn font-display text-sm font-semibold text-bone bg-forest-700 hover:bg-forest-800 transition-colors"
                >
                  ✦ Ieškoti su AI
                </button>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <Search size={40} className="text-forest-300" />
              <p className="text-sm text-forest-500">Įveskite augalo pavadinimą</p>
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

        {/* Greeting + AccuracyButton — natūraliai slidasi su content'u
            (be JS scroll-direction logikos). Scroll'inant žemyn — natūraliai
            išslydsta į viršų; atgal — natūraliai parodomas. careMode'e
            slepiamas (kad augalų grid'as gautų visą ekraną). */}
        {!careMode && (
          <>
            <div className="-mx-5 px-5 pt-4 pb-3" style={hideInnerHeader ? undefined : { paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
              <CareOverview
                plants={mainPlants}
                user={user}
                mode="greeting"
                bigGreeting
                careMode={careMode}
                careConfidence={careConfidence}
                onCareToggle={() => { setCareMode(v => !v); setCareChecked(new Set()) }}
              />
            </div>
          </>
        )}

        {/* Karantinas pseudo-zone */}
        {quarantinePlants.length > 0 && (
          <QuarantineSection plants={quarantinePlants} zones={zones} onTap={onTap}
            careMode={careMode} careChecked={careChecked} onCareToggle={toggleCare} onCareInfo={(p) => openCareInfo(p)} />
        )}

        {/* Plant grid */}
        {plants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="opacity-50">
              <T4Icon size={64} ink="#1c3a2a" paper="transparent" />
            </div>
            <div>
              <p className="font-display text-base font-semibold tracking-tight text-forest-700">Dar nėra augalų</p>
              <p className="text-sm text-forest-500 mt-1">Ieškokite augalo ir pridėkite į kolekciją</p>
            </div>
            <button
              onClick={onSearch}
              className="mt-2 px-6 py-3 bg-forest-700 hover:bg-forest-800 text-bone-50 rounded-btn font-display text-sm font-semibold transition-colors"
            >
              + Pridėti pirmą augalą
            </button>
          </div>
        ) : hasZones ? (
          <>
            {zonedPlants.map(({ zone, plants: zp }) => zp.length > 0 && (
              <ZoneSection key={zone.id} zone={zone} plants={zp} onTap={onTap}
                careMode={careMode} careChecked={careChecked} onCareToggle={toggleCare} onCareInfo={(p) => openCareInfo(p)} />
            ))}
            {unzonedPlants.length > 0 && (
              <div ref={unzonedRef} className="mb-3">
                <div className="flex items-center gap-2 py-2">
                  <p className="font-display font-semibold text-sm tracking-tight text-forest-500 flex-shrink-0">Nepriskirti</p>
                  <div className="flex-1 h-px bg-gradient-to-r from-forest-200/70 to-transparent" />
                </div>
                <div className="space-y-3">
                  {pinChecked(unzonedPlants.filter(p => p.status === 'sick'), careMode, careChecked).length > 0 && (
                    <div className="bg-bone-50 border border-forest-300/50 rounded-2xl p-1.5">
                      <div className="flex items-center gap-1.5 mb-2 px-1">
                        <Thermometer size={11} className="text-forest-500" />
                        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-forest-600">Dėmesio</span>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
                        {pinChecked(unzonedPlants.filter(p => p.status === 'sick'), careMode, careChecked).map(plant => (
                          <PlantCard key={plant.id} plant={plant} section="auginama" onTap={() => onTap(plant)}
                            careMode={careMode} checked={careChecked.has(plant.id)} onToggle={() => toggleCare(plant.id)} onCareInfo={() => openCareInfo(plant)} />
                        ))}
                      </div>
                    </div>
                  )}
                  {pinChecked(unzonedPlants.filter(p => p.status !== 'sick'), careMode, careChecked).length > 0 && (
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                      {pinChecked(unzonedPlants.filter(p => p.status !== 'sick'), careMode, careChecked).map(plant => (
                        <PlantCard key={plant.id} plant={plant} section="auginama" onTap={() => onTap(plant)}
                          careMode={careMode} checked={careChecked.has(plant.id)} onToggle={() => toggleCare(plant.id)} onCareInfo={() => openCareInfo(plant)} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {pinChecked(sortedPlants, careMode, careChecked).map(plant => (
                <PlantCard
                  key={plant.id}
                  plant={plant}
                  section="auginama"
                  onTap={() => onTap(plant)}
                  careMode={careMode}
                  checked={careChecked.has(plant.id)}
                  onToggle={() => toggleCare(plant.id)}
                  onCareInfo={() => openCareInfo(plant)}
                />
              ))}
            </div>
          </>
        )}
      </div>}

      {/* Floating AI bubble — hidden in care mode and for viewers.
          Mobile: bottom-24 (virš mobile nav). Desktop: bottom-5 (nav nėra,
          suvienodinta su PlantDetail PlantAvatar pozicija). */}
      {plants.length > 0 && !careMode && role !== 'viewer' && (
        <button
          onClick={() => setShowChat(true)}
          aria-label="Atidaryti AI asistentą"
          className="absolute bottom-24 lg:bottom-5 right-4 active:scale-90 transition-transform z-10 text-forest-700 animate-idle-float-gardener lg:animate-idle-float drop-shadow"
        >
          <Mascot type="gardener" state="idle" size={96} hoverable />
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
            {postFertilizeFor ? (
              <div className="bg-bone-100/95 rounded-2xl shadow-[0_8px_24px_rgba(28,58,42,0.14)] border border-bone-400/40 p-3">
                <PostFertilizePrompt
                  count={postFertilizeFor.size}
                  onPalasciau={confirmPostFertWater}
                  onNelasciau={dismissPostFert}
                />
              </div>
            ) : (
            // Care action bar — frost glass (suderinta su header / widget'ai /
            // Karantinas — visa frost language vieningai).
            <div className="bg-bone-100/95 rounded-btn shadow-[0_8px_24px_rgba(28,58,42,0.14),0_0_0_1px_rgba(28,58,42,0.04)] p-1.5 flex gap-1.5 items-center">
              <button
                onClick={exitCareMode}
                className="w-10 h-10 flex items-center justify-center rounded-btn-sm bg-bone-300 active:bg-bone-400 flex-shrink-0"
                aria-label="Išeiti iš priežiūros"
              >
                <X size={18} className="text-forest-600" />
              </button>
              <button
                onClick={() => {
                  if (careChecked.size === 0) return
                  if (confirmType === 'watering') { handleCareAction('watering'); resetConfirm() }
                  else { resetConfirm(); setConfirmType('watering'); setCountdown(5) }
                }}
                disabled={careChecked.size === 0}
                className={`flex-1 h-10 flex items-center justify-center gap-1.5 rounded-btn-sm disabled:opacity-40 transition-colors ${
                  confirmType === 'watering' ? 'bg-forest-700 active:bg-forest-800' : 'bg-forest-500 active:bg-forest-600'
                }`}
              >
                <Droplets size={16} className="text-bone" />
                <span className="text-sm font-bold text-bone">
                  {confirmType === 'watering'
                    ? `Tikrai? (${countdown})`
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
                className={`flex-1 h-10 flex items-center justify-center gap-1.5 rounded-btn-sm transition-colors ${
                  role === 'viewer'
                    ? 'bg-terracotta opacity-25 cursor-not-allowed'
                    : `disabled:opacity-40 ${confirmType === 'fertilizing' ? 'bg-terracotta-600 active:bg-terracotta-600' : 'bg-terracotta active:bg-terracotta-500'}`
                }`}
              >
                <FlaskConical size={16} className="text-bone" />
                <span className="text-sm font-bold text-bone">
                  {role !== 'viewer' && confirmType === 'fertilizing'
                    ? `Tikrai? (${countdown})`
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
            /* Stable key — kad navigation tarp augalų NEbe unmount/mount
               (AnimatePresence exit+enter slide). Sheet'as lieka opened,
               tik props update'ina turinį → instant switch be animacijos.
               Sheet'o open/close animacija lieka per AnimatePresence
               (kai careInfoPlant null'inasi). */
            key="care-info"
            plant={careInfoPlant}
            zones={zones}
            onClose={closeCareInfo}
            onPrev={careInfoIdx > 0 ? goCareInfoPrev : null}
            onNext={(careInfoList && careInfoIdx < careInfoList.length - 1) ? goCareInfoNext : null}
            onAfterAction={onCareInfoAfterAction}
            navIndex={careInfoIdx >= 0 ? careInfoIdx : null}
            navTotal={careInfoList?.length ?? null}
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
            icon={<Mascot type="gardener" state="idle" size={56} />}
            iconLg={<Mascot type="gardener" state="idle" size={70} />}
            systemPrompt={buildDashboardSystemPrompt(plants, zones)}
            onClose={() => setShowChat(false)}
            onSaveToZinynas={onSaveToZinynas}
            plants={plants}
            onViewPlant={onViewPlant}
            desktopPopover={hideInnerHeader}
          />
        )}
      </AnimatePresence>

      {/* ProfileSheet dabar valdomas App.jsx lygmenyje (atidaromas iš MobileHeader/DesktopHeader avataro). */}
    </div>
  )
}

export default forwardRef(Dashboard)
