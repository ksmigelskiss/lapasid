import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Search, SlidersHorizontal, AlertTriangle, Droplets, Loader2, Image as ImageIcon, ChevronUp, ChevronDown, Leaf, ShieldAlert, Thermometer, MapPin } from 'lucide-react'
const GARDENER = '/gardener.png'
import PlantCard from '../components/PlantCard'
import CollectionChat from '../components/CollectionChat'
import WateringSession from '../components/WateringSession'
import { getFertilizingForecast } from '../utils/fertilizingForecast'
import { getDormancyForecast } from '../utils/dormancyForecast'
import { getWateringForecast, shouldShowWateringAlert } from '../utils/wateringForecast'
import { buildDashboardSystemPrompt } from '../utils/collectionChatContext'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { RefreshCw } from 'lucide-react'

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

function QuarantineSection({ plants, zones, onTap }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 py-2"
      >
        <ShieldAlert size={13} className="text-red-400 flex-shrink-0" />
        <span className="text-sm font-bold text-red-600 flex-1 text-left">Karantinas</span>
        <span className="text-xs text-red-300 mr-1">{plants.length}</span>
        {open ? <ChevronUp size={14} className="text-red-300" /> : <ChevronDown size={14} className="text-red-300" />}
      </button>
      {open && (
        <div className="bg-red-50 rounded-2xl p-2.5">
          <div className="grid grid-cols-2 gap-3">
            {plants.map(plant => (
              <PlantCard
                key={plant.id}
                plant={plant}
                section="auginama"
                onTap={() => onTap(plant)}
                zoneName={zones.find(z => z.id === plant.zonaId)?.name}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ZoneSection({ zone, plants, onTap }) {
  const [open, setOpen] = useState(true)
  const sickPlants    = plants.filter(p => p.status === 'sick')
  const healthyPlants = plants.filter(p => p.status !== 'sick')

  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 py-2"
      >
        <MapPin size={13} className="text-sage-400 flex-shrink-0" />
        <span className="text-sm font-bold text-gray-700 flex-1 text-left truncate">{zone.name}</span>
        <span className="text-xs text-gray-400 mr-1">{plants.length}</span>
        {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>
      {open && (
        <div className="space-y-3">
          {/* Sick sub-group */}
          {sickPlants.length > 0 && (
            <div className="bg-amber-50 rounded-2xl p-2.5">
              <div className="flex items-center gap-1.5 mb-2 px-1">
                <Thermometer size={12} className="text-amber-500" />
                <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wide">Dėmesio</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {sickPlants.map(plant => (
                  <PlantCard key={plant.id} plant={plant} section="auginama" onTap={() => onTap(plant)} zoneName={zone.name} />
                ))}
              </div>
            </div>
          )}
          {/* Healthy plants */}
          {healthyPlants.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {healthyPlants.map(plant => (
                <PlantCard key={plant.id} plant={plant} section="auginama" onTap={() => onTap(plant)} zoneName={zone.name} />
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

export default function Dashboard({ plants, allPlants = [], zones = [], onTap, onSearch, onFetchAllImages, fetchingAll, onSaveToZinynas, onViewPlant, onRefresh, onAddTimelineEvent, onAddZone, onUpdateZone, onDeleteZone, onReorderZones }) {
  const quarantinePlants = plants.filter(p => p.status === 'quarantine')
  // sick plants stay in their zone (mainPlants includes them)
  const mainPlants       = plants.filter(p => p.status !== 'quarantine')
  const missingCount     = plants.filter(p => !p.image).length
  const overdueList      = mainPlants.filter(p => getFertilizingForecast(p).isOverdue)
  const wateringList     = mainPlants.filter(p => shouldShowWateringAlert(p))
  const hasAlerts        = overdueList.length > 0 || wateringList.length > 0
  const [alertsOpen, setAlertsOpen]   = useState(false)
  const [sortKey, setSortKey]         = useState('added')
  const [showFilters, setShowFilters] = useState(false)
  const [showChat, setShowChat]       = useState(false)
  const [showWaterSession, setWaterSession] = useState(false)
  const [searching, setSearching]     = useState(false)
  const [query, setQuery]             = useState('')
  const inputRef  = useRef(null)
  const scrollRef = useRef(null)

  useEffect(() => { if (searching) inputRef.current?.focus() }, [searching])
  const closeSearch = useCallback(() => { setSearching(false); setQuery('') }, [])
  const launchFullSearch = useCallback(() => { onSearch(); closeSearch() }, [onSearch, closeSearch])

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
    <div className="flex flex-col h-full">
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
                onClick={() => setWaterSession(true)}
                className="bg-sky-50 active:bg-sky-100 transition-colors rounded-2xl px-3.5 py-2 flex flex-col items-center justify-center h-[58px]"
              >
                <Droplets size={20} className="text-sky-400 leading-none" />
                <span className="text-[10px] text-sky-400 font-medium mt-0.5">laistymas</span>
              </button>
              <div className="bg-sage-50 rounded-2xl px-3.5 py-2 flex flex-col items-center justify-center h-[58px]">
                <span className="text-2xl font-extrabold text-sage-600 leading-none">{plants.length}</span>
                <span className="text-[10px] text-sage-400 font-medium mt-0.5">augal{plants.length === 1 ? 'as' : 'ai'}</span>
              </div>
            </div>
            {/* Secondary row: foto */}
            {missingCount > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={onFetchAllImages}
                  disabled={fetchingAll}
                  className="flex items-center gap-1.5 bg-sage-50 hover:bg-sage-100 disabled:opacity-60 transition-colors rounded-xl px-2.5 py-1.5"
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

        {/* Unified alerts widget */}
        {hasAlerts && (
          <div className="mb-4">
            <div className="bg-white rounded-2xl overflow-hidden shadow-ios-card">
              {/* Collapsible header */}
              <button
                onClick={() => setAlertsOpen(o => !o)}
                className="w-full flex items-center gap-2 px-4 py-3 active:bg-surface-2 transition-colors"
              >
                <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
                <p className="text-sm font-bold text-gray-800 flex-1 text-left">
                  Priminimai ({wateringList.length + overdueList.length})
                </p>
                <div className={`transition-transform duration-200 ${alertsOpen ? '' : 'rotate-180'}`}>
                  <ChevronUp size={14} className="text-gray-400" />
                </div>
              </button>

              {alertsOpen && (
                <div className="px-4 pb-3 space-y-3">
                  {/* Watering section */}
                  {wateringList.length > 0 && (
                    <div>
                      <p className="flex items-center gap-1 text-[10px] font-bold text-sky-500 uppercase tracking-wider mb-1.5">
                        <Droplets size={11} /> Laistymas vėluoja
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {wateringList.map(p => {
                          const wc = getWateringForecast(p)
                          return (
                            <button
                              key={p.id}
                              onClick={() => onTap(p)}
                              className="flex items-center gap-1 bg-sky-100 hover:bg-sky-200 active:bg-sky-200 transition-colors rounded-xl px-2.5 py-1"
                            >
                              <span className="text-[11px] font-medium text-sky-800 max-w-[90px] truncate">{p.lietuviškas}</span>
                              <span className="text-[10px] text-sky-500 font-semibold ml-0.5">+{Math.abs(wc.daysUntil)}d</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Fertilizing section */}
                  {overdueList.length > 0 && (
                    <div>
                      <p className="flex items-center gap-1 text-[10px] font-bold text-orange-500 uppercase tracking-wider mb-1.5">
                        <Leaf size={11} /> Tręšimas vėluoja
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
        )}

        {/* Karantinas pseudo-zone */}
        {quarantinePlants.length > 0 && (
          <QuarantineSection plants={quarantinePlants} zones={zones} onTap={onTap} />
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
              <ZoneSection key={zone.id} zone={zone} plants={zp} onTap={onTap} />
            ))}
            {unzonedPlants.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide py-2">Nepriskirti</p>
                <div className="space-y-3">
                  {unzonedPlants.filter(p => p.status === 'sick').length > 0 && (
                    <div className="bg-amber-50 rounded-2xl p-2.5">
                      <div className="flex items-center gap-1.5 mb-2 px-1">
                        <Thermometer size={12} className="text-amber-500" />
                        <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wide">Dėmesio</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {unzonedPlants.filter(p => p.status === 'sick').map(plant => (
                          <PlantCard key={plant.id} plant={plant} section="auginama" onTap={() => onTap(plant)} />
                        ))}
                      </div>
                    </div>
                  )}
                  {unzonedPlants.filter(p => p.status !== 'sick').length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      {unzonedPlants.filter(p => p.status !== 'sick').map(plant => (
                        <PlantCard key={plant.id} plant={plant} section="auginama" onTap={() => onTap(plant)} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {sortedPlants.map(plant => (
              <PlantCard
                key={plant.id}
                plant={plant}
                section="auginama"
                onTap={() => onTap(plant)}
              />
            ))}
          </div>
        )}
      </div>}

      {/* Floating AI bubble */}
      {plants.length > 0 && (
        <button
          onClick={() => setShowChat(true)}
          className="absolute bottom-24 right-4 active:scale-90 transition-transform z-10"
        >
          <img src={GARDENER} className="h-[96px] w-auto object-contain drop-shadow opacity-90 animate-idle-float-gardener" alt="" />
        </button>
      )}

      <AnimatePresence>
        {showWaterSession && (
          <WateringSession
            key="water-session"
            plants={plants}
            zones={zones}
            onAddTimelineEvent={onAddTimelineEvent}
            onAddZone={onAddZone}
            onUpdateZone={onUpdateZone}
            onDeleteZone={onDeleteZone}
            onReorderZones={onReorderZones}
            onClose={() => setWaterSession(false)}
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
            systemPrompt={buildDashboardSystemPrompt(plants)}
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
