import { useState, useMemo, useRef, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Star, SlidersHorizontal, Search, Ghost, ShoppingCart, BookOpen } from 'lucide-react'
import PlantCard from '../components/PlantCard'
import CollectionChat from '../components/CollectionChat'
import { buildLibrarySystemPrompt } from '../utils/collectionChatContext'

const SORT_OPTIONS = [
  { key: 'added',      label: 'Pridėta' },
  { key: 'name',       label: 'A–Z' },
  { key: 'light',      label: 'Šviesa' },
  { key: 'water',      label: 'Vanduo' },
  { key: 'difficulty', label: 'Sunkumas', icon: Star },
]

function sortPlants(plants, key) {
  const s = [...plants]
  switch (key) {
    case 'name':       return s.sort((a, b) => (a.lietuviškas ?? '').localeCompare(b.lietuviškas ?? '', 'lt'))
    case 'light':      return s.sort((a, b) => (b.sviesa?.taskai ?? 0) - (a.sviesa?.taskai ?? 0))
    case 'water':      return s.sort((a, b) => (b.vanduo?.taskai ?? 0) - (a.vanduo?.taskai ?? 0))
    case 'difficulty': return s.sort((a, b) => (b.sunkumas ?? 0) - (a.sunkumas ?? 0))
    default:           return s.sort((a, b) => new Date(b.data_prideta) - new Date(a.data_prideta))
  }
}

function matchesQuery(plant, q) {
  const lower = q.toLowerCase()
  const candidates = [
    plant.lietuviškas,
    plant.lotyniskas,
    plant.inatLtName,
    ...(plant.sinonimai    ?? []),
    ...(plant.englishNames ?? []),
  ]
  return candidates.some(c => c && c.toLowerCase().includes(lower))
}

const FILTERS = [
  { key: 'visi',    label: 'Visi' },
  { key: 'nori',    label: 'Įdomu' },
  { key: 'pirkti',  label: 'Pirkti' },
  { key: 'mirei',   label: 'Mirę' },
]

export default function Biblioteka({ plants, onTap, onImageFetch, onSearch, onSaveToZinynas, onViewPlant }) {
  const [filter, setFilter]           = useState('visi')
  const [sortKey, setSortKey]         = useState('added')
  const [showFilters, setShowFilters] = useState(false)
  const [showChat, setShowChat]       = useState(false)
  const [searching, setSearching]     = useState(false)
  const [query, setQuery]             = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (searching) inputRef.current?.focus()
  }, [searching])

  const visible = useMemo(() => {
    const filtered = (() => {
      switch (filter) {
        case 'nori':   return plants.filter(p => p.kategorija === 'nori')
        case 'mirei':  return plants.filter(p => p.kategorija === 'istorija')
        case 'pirkti': return plants.filter(p => p.pirkinys)
        default:       return plants
      }
    })()
    const sorted = sortPlants(filtered, sortKey)
    if (!query.trim()) return sorted
    return sorted.filter(p => matchesQuery(p, query))
  }, [plants, filter, sortKey, query])

  const counts = {
    visi:   plants.length,
    nori:   plants.filter(p => p.kategorija === 'nori').length,
    pirkti: plants.filter(p => p.pirkinys).length,
    mirei:  plants.filter(p => p.kategorija === 'istorija').length,
  }

  const closeSearch = () => {
    setSearching(false)
    setQuery('')
  }

  const launchFullSearch = () => {
    onSearch(query)
    closeSearch()
  }

  return (
    <div className="flex flex-col h-full bg-lib">
      {/* Header */}
      <div className="px-5 pt-14 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-sage-400 uppercase tracking-[0.12em] mb-1">Augalų žinynas</p>
            <h1 className="text-[28px] font-extrabold text-gray-900 leading-tight tracking-tight">Biblioteka</h1>
          </div>
          <div className="border border-gray-300 rounded-2xl px-3.5 py-2 flex flex-col items-center">
            <span className="text-2xl font-extrabold text-gray-700 leading-none">{plants.length}</span>
            <span className="text-[10px] text-gray-500 font-medium mt-0.5">augal{plants.length === 1 ? 'as' : 'ai'}</span>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="px-5 mb-3 flex gap-2">
        {searching ? (
          <div className="flex-1 flex items-center gap-2 bg-white border border-gray-300 rounded-2xl px-4 py-3 focus-within:border-gray-400 transition-colors">
            <span className="text-gray-400 text-sm">🔍</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && query.trim()) launchFullSearch()
                if (e.key === 'Escape') closeSearch()
              }}
              placeholder="Ieškoti bibliotekoje..."
              className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
            />
            {query ? (
              <button onClick={() => setQuery('')} className="text-gray-400 text-xs">✕</button>
            ) : (
              <button onClick={closeSearch} className="text-gray-400 text-xs">✕</button>
            )}
          </div>
        ) : (
          <button
            onClick={() => setSearching(true)}
            className="flex-1 flex items-center gap-3 bg-white border border-gray-200 hover:bg-surface transition-colors rounded-2xl px-4 py-3"
          >
            <span className="text-gray-400">🔍</span>
            <span className="text-sm text-gray-500">Rasti augalą...</span>
          </button>
        )}
        {!searching && (
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex-shrink-0 w-11 rounded-2xl flex items-center justify-center text-base transition-colors ${
              showFilters || filter !== 'visi' || sortKey !== 'added'
                ? 'bg-gray-800 text-white'
                : 'bg-white border border-gray-200 text-gray-600'
            }`}
          >
            <SlidersHorizontal size={18} />
          </button>
        )}
      </div>

      {/* Collapsible filters + sort */}
      {showFilters && !searching && (
        <div className="space-y-2 mb-4">
          <div className="flex gap-2 overflow-x-auto scrollbar-none px-5">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex-shrink-0 flex items-center gap-1 text-xs font-medium rounded-xl px-3 py-1.5 transition-colors ${
                  filter === f.key
                    ? 'bg-gray-800 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-surface'
                }`}
              >
                {f.label}
                {counts[f.key] > 0 && (
                  <span className={`text-[10px] rounded-full px-1 ${
                    filter === f.key ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-400'
                  }`}>
                    {counts[f.key]}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-none px-5">
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
                {opt.icon && <opt.icon size={11} className="inline-block mr-1 -mt-0.5" />}{opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto scrollbar-none px-5 pb-28">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
            <div className="text-gray-300">
              {query          ? <Search size={48} />
              : filter === 'mirei'  ? <Ghost size={48} />
              : filter === 'pirkti' ? <ShoppingCart size={48} />
              :                       <BookOpen size={48} />}
            </div>
            <p className="text-sm font-semibold text-gray-600">
              {query
                ? `„${query}" nerasta bibliotekoje`
                : filter === 'pirkti' ? 'Pirkinių sąrašas tuščias'
                : filter === 'mirei'  ? 'Mirę augalai neregistruoti'
                : 'Biblioteka tuščia'}
            </p>
            {query ? (
              <button
                onClick={launchFullSearch}
                className="mt-1 px-6 py-3 bg-gray-800 text-white rounded-2xl text-sm font-medium"
              >
                Ieškoti „{query}" naujų augalų
              </button>
            ) : filter !== 'pirkti' && (
              <button
                onClick={() => setSearching(true)}
                className="mt-1 px-6 py-3 bg-gray-800 text-white rounded-2xl text-sm font-medium"
              >
                + Pridėti augalą
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {visible.map(plant => (
                <PlantCard
                  key={plant.id}
                  plant={plant}
                  section={plant.kategorija === 'istorija' ? 'istorija' : 'nori'}
                  onTap={() => onTap(plant)}
                  onImageFetch={onImageFetch}
                  cardBg="bg-white"
                  showDashboardBadge={plant.kategorija === 'auginama'}
                />
              ))}
            </div>
            {/* "Search for new" nudge when actively searching */}
            {searching && query.trim() && (
              <button
                onClick={launchFullSearch}
                className="w-full mt-3 py-3 rounded-2xl text-sm text-gray-500 border border-dashed border-gray-300 hover:border-gray-400 hover:text-gray-700 transition-colors"
              >
                🔎 Ieškoti „{query}" naujų augalų
              </button>
            )}
          </>
        )}
      </div>

      {/* Floating AI bubble */}
      {plants.length > 0 && (
        <button
          onClick={() => setShowChat(true)}
          className="absolute bottom-24 right-4 active:scale-90 transition-transform z-10"
        >
          <img src="/gardener.png" className="h-[96px] w-auto object-contain drop-shadow opacity-90 animate-idle-float-gardener" alt="" />
        </button>
      )}

      <AnimatePresence>
        {showChat && (
          <CollectionChat
            key="library-chat"
            title="Bibliotekos asistentas"
            icon={<img src="/gardener.png" className="h-14 w-auto object-contain" alt="" />}
            iconLg={<img src="/gardener.png" className="h-[70px] w-auto object-contain" alt="" />}
            systemPrompt={buildLibrarySystemPrompt(plants)}
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
