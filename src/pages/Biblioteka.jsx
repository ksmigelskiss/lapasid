import { useState, useMemo, useRef, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Search, Ghost, BookOpen, RefreshCw, Camera } from 'lucide-react'
import PlantCard from '../components/PlantCard'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import CollectionChat from '../components/CollectionChat'
import { buildLibrarySystemPrompt } from '../utils/collectionChatContext'

// Pagrindinis kategorijos filtras (mutually exclusive). `null` = visi.
// Bibliotekoje rodomi tik `nori` ir `istorija` augalai (`auginama` lieka Dashboard'e).
const KATEGORIJA_TABS = [
  { key: 'nori',     label: 'Norėčiau' },
  { key: 'istorija', label: 'Istorija', Icon: Ghost },
]

function matchesQuery(plant, q) {
  const lower = q.toLowerCase()
  return [plant.lietuviškas, plant.lotyniskas, plant.inatLtName,
    ...(plant.sinonimai ?? []), ...(plant.englishNames ?? [])]
    .some(c => c && c.toLowerCase().includes(lower))
}

export default function Biblioteka({ plants, onTap, onSearch, onSearchByCamera, onSaveToZinynas, onViewPlant, onRefresh }) {
  const [kategorija, setKategorija] = useState(null)        // null = visi
  const [showChat, setShowChat]     = useState(false)
  const [searching, setSearching]   = useState(false)
  const [query, setQuery]           = useState('')
  const inputRef  = useRef(null)
  const scrollRef = useRef(null)
  const { pullY, refreshing } = usePullToRefresh(scrollRef, onRefresh ?? (() => {}))

  // Reset to "visi" when app returns from background
  useEffect(() => {
    const handle = () => {
      if (document.visibilityState === 'visible') setKategorija(null)
    }
    document.addEventListener('visibilitychange', handle)
    return () => document.removeEventListener('visibilitychange', handle)
  }, [])

  useEffect(() => {
    if (searching) inputRef.current?.focus()
  }, [searching])

  // Skaičiai segmented control'ui
  const counts = useMemo(() => ({
    all:      plants.length,
    nori:     plants.filter(p => p.kategorija === 'nori').length,
    istorija: plants.filter(p => p.kategorija === 'istorija').length,
  }), [plants])

  const visible = useMemo(() => {
    const filtered = kategorija == null
      ? plants
      : plants.filter(p => p.kategorija === kategorija)
    const sorted = [...filtered].sort((a, b) => new Date(b.data_prideta) - new Date(a.data_prideta))
    if (!query.trim()) return sorted
    return sorted.filter(p => matchesQuery(p, query))
  }, [plants, kategorija, query])

  const closeSearch = () => { setSearching(false); setQuery('') }
  const launchFullSearch = () => { onSearch(query); closeSearch() }

  // Filter tabs + search row — extracted, kad reuse'intume inline (filter|search vienoj eilutėj).
  const filterTabs = (
    <div className="inline-flex items-center bg-gray-900/[0.04] rounded-full p-1 gap-0.5 flex-shrink-0">
      <button
        onClick={() => setKategorija(null)}
        className={`h-9 inline-flex items-center justify-center gap-1.5 px-3 rounded-full text-[13.5px] font-medium transition-colors ${
          kategorija == null
            ? 'bg-white text-sage-700 shadow-[0_1px_2px_rgba(20,40,30,0.06),0_0_0_1px_rgba(20,40,30,0.04)]'
            : 'text-gray-600 hover:text-gray-900'
        }`}
      >
        <span>Visi</span>
        {counts.all > 0 && (
          <span className={`text-[11px] font-bold px-1.5 py-px rounded-full ${
            kategorija == null ? 'bg-sage-100 text-sage-700' : 'bg-sky-100 text-sky-800'
          }`}>{counts.all}</span>
        )}
      </button>
      {KATEGORIJA_TABS.map(({ key, label, Icon }) => {
        const active = kategorija === key
        const count = counts[key]
        return (
          <button
            key={key}
            onClick={() => setKategorija(active ? null : key)}
            className={`h-9 inline-flex items-center justify-center gap-1.5 px-3 rounded-full text-[13.5px] font-medium transition-colors ${
              active
                ? 'bg-white text-sage-700 shadow-[0_1px_2px_rgba(20,40,30,0.06),0_0_0_1px_rgba(20,40,30,0.04)]'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {Icon && <Icon size={13} />}
            <span>{label}</span>
            {count > 0 && (
              <span className={`text-[11px] font-bold px-1.5 py-px rounded-full ${
                active ? 'bg-sage-100 text-sage-700' : 'bg-sky-100 text-sky-800'
              }`}>{count}</span>
            )}
          </button>
        )
      })}
    </div>
  )

  const searchRow = searching ? (
    <div className="flex-1 flex items-center gap-2 bg-white border border-gray-300 rounded-2xl px-4 h-9 focus-within:border-gray-400 transition-colors">
      <Search size={15} className="text-gray-400 flex-shrink-0" />
      <input
        ref={inputRef}
        type="text"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="nope"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck="false"
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
      className="flex-1 inline-flex items-center gap-2 bg-white border border-gray-200 hover:bg-surface transition-colors rounded-2xl px-4 h-9"
    >
      <Search size={15} className="text-gray-400" />
      <span className="text-sm text-gray-500">Ieškoti augalo...</span>
    </button>
  )

  return (
    <div className="flex flex-col h-full bg-lib">
      {/* Top row: filter | search inline (designer'io ekonomiškas top'as, be h1 +
          augalų count'o — tos info dubliuoja header tabs su badge'u) */}
      <div className="px-5 pb-3 flex items-center gap-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        {filterTabs}
        {searchRow}
        {!searching && (
          <button
            onClick={() => onSearchByCamera ? onSearchByCamera() : onSearch('')}
            className="flex-shrink-0 w-9 h-9 rounded-2xl flex items-center justify-center bg-white border border-gray-200 text-gray-600 active:bg-surface transition-colors"
          >
            <Camera size={16} />
          </button>
        )}
      </div>

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

      {/* Grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-none px-5 pb-28">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
            <div className="text-gray-300">
              {query ? <Search size={48} /> : <BookOpen size={48} />}
            </div>
            <p className="text-sm font-semibold text-gray-600">
              {query ? `„${query}" nerasta bibliotekoje` : 'Biblioteka tuščia'}
            </p>
            <p className="text-xs text-gray-400 max-w-[220px] leading-relaxed">
              {query
                ? null
                : 'Čia matysi augalus, kuriuos nori įsigyti, ir savo auginimo istoriją'}
            </p>
            {query ? (
              <button
                onClick={launchFullSearch}
                className="mt-1 px-6 py-3 bg-sage-500 active:bg-sage-600 text-white rounded-2xl text-sm font-medium"
              >
                Ieškoti „{query}" naujų augalų
              </button>
            ) : kategorija == null && (
              <button
                onClick={() => setSearching(true)}
                className="mt-1 px-6 py-3 bg-sage-500 active:bg-sage-600 text-white rounded-2xl text-sm font-medium"
              >
                + Pridėti augalą
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {visible.map(plant => (
                <PlantCard
                  key={plant.id}
                  plant={plant}
                  section={plant.kategorija === 'istorija' ? 'istorija' : 'nori'}
                  onTap={() => onTap(plant)}
                  cardBg="bg-white"
                />
              ))}
            </div>
            {searching && query.trim() && (
              <button
                onClick={launchFullSearch}
                className="w-full mt-3 py-3 rounded-2xl text-sm text-gray-500 border border-dashed border-gray-300 hover:border-gray-400 hover:text-gray-700 transition-colors"
              >
                Ieškoti „{query}" naujų augalų
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
