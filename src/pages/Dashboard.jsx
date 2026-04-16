import { useState, useMemo, useRef } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Search, SlidersHorizontal, AlertTriangle, Droplets, Loader2, Image as ImageIcon, ChevronUp, Leaf, ShieldAlert, Thermometer } from 'lucide-react'
const GARDENER = '/gardener.png'
import PlantCard from '../components/PlantCard'
import CollectionChat from '../components/CollectionChat'
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

export default function Dashboard({ plants, onTap, onSearch, onFetchAllImages, fetchingAll, onSaveToZinynas, onViewPlant, onRefresh }) {
  const quarantinePlants = plants.filter(p => p.status === 'quarantine')
  const sickPlants       = plants.filter(p => p.status === 'sick')
  const mainPlants       = plants.filter(p => p.status !== 'quarantine' && p.status !== 'sick')
  const missingCount     = plants.filter(p => !p.image).length
  const overdueList      = mainPlants.filter(p => getFertilizingForecast(p).isOverdue)
  const wateringList     = mainPlants.filter(p => shouldShowWateringAlert(p))
  const hasAlerts        = overdueList.length > 0 || wateringList.length > 0
  const [alertsOpen, setAlertsOpen]   = useState(false)
  const [sortKey, setSortKey]         = useState('added')
  const [showFilters, setShowFilters] = useState(false)
  const [showChat, setShowChat]       = useState(false)
  const scrollRef = useRef(null)
  const { pullY, refreshing } = usePullToRefresh(scrollRef, onRefresh ?? (() => {}))

  const sortedPlants = useMemo(() => sortPlants(mainPlants, sortKey), [mainPlants, sortKey])

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
            <div className="bg-sage-50 rounded-2xl px-3.5 py-2 flex flex-col items-center">
              <span className="text-2xl font-extrabold text-sage-600 leading-none">{plants.length}</span>
              <span className="text-[10px] text-sage-400 font-medium mt-0.5">augal{plants.length === 1 ? 'as' : 'ai'}</span>
            </div>
            {missingCount > 0 && (
              <button
                onClick={onFetchAllImages}
                disabled={fetchingAll}
                className="flex items-center gap-1.5 bg-sage-50 hover:bg-sage-100 disabled:opacity-60 transition-colors rounded-xl px-2.5 py-1.5"
              >
                {fetchingAll
                  ? <Loader2 size={14} className="animate-spin" />
                  : <ImageIcon size={14} />
                }
                <span className="text-xs font-medium text-sage-600">
                  {fetchingAll ? 'Kraunama...' : `+${missingCount} foto`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Search + filter toggle */}
      <div className="px-5 mb-3 flex gap-2">
        <button
          onClick={onSearch}
          className="flex-1 flex items-center gap-3 bg-white border border-gray-200 hover:bg-surface transition-colors rounded-2xl px-4 py-3"
        >
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <span className="text-sm text-gray-500">Ieškoti augalo...</span>
        </button>
        {plants.length > 1 && (
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

      {/* Pull-to-refresh indicator */}
      <div
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
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-none px-5 pb-28">

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

        {/* Reanimacija zone */}
        {quarantinePlants.length > 0 && (
          <div className="mb-4">
            <div className="bg-red-50 rounded-2xl overflow-hidden shadow-ios-card">
              <div className="flex items-center gap-2 px-4 py-3">
                <ShieldAlert size={16} className="text-red-500 flex-shrink-0" />
                <p className="text-sm font-bold text-red-700 flex-1">Karantinas ({quarantinePlants.length})</p>
              </div>
              <div className="px-4 pb-3">
                <div className="grid grid-cols-2 gap-2">
                  {quarantinePlants.map(plant => (
                    <PlantCard key={plant.id} plant={plant} section="auginama"
                      onTap={() => onTap(plant)} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ligoniai zone */}
        {sickPlants.length > 0 && (
          <div className="mb-4">
            <div className="bg-amber-50 rounded-2xl overflow-hidden shadow-ios-card">
              <div className="flex items-center gap-2 px-4 py-3">
                <Thermometer size={16} className="text-amber-500 flex-shrink-0" />
                <p className="text-sm font-bold text-amber-700 flex-1">Serga ({sickPlants.length})</p>
              </div>
              <div className="px-4 pb-3">
                <div className="grid grid-cols-2 gap-2">
                  {sickPlants.map(plant => (
                    <PlantCard key={plant.id} plant={plant} section="auginama"
                      onTap={() => onTap(plant)} />
                  ))}
                </div>
              </div>
            </div>
          </div>
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
      </div>

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
