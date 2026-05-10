import { useState, useMemo, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, Ghost, BookOpen, RefreshCw, Camera } from 'lucide-react'
import PlantCard from '../components/PlantCard'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import CollectionChat from '../components/CollectionChat'
import { buildLibrarySystemPrompt } from '../utils/collectionChatContext'
import { useIsDesktop } from '../hooks/useIsDesktop'

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
  const isDesktop = useIsDesktop()
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

  // Filter tabs — underline stilius (toks pat kaip PlantDetail TabBar): plain
  // border-b + sage-500 active underline su layoutId animacija.
  const tabKeys = [{ key: null, label: 'Visi', count: counts.all }, ...KATEGORIJA_TABS.map(t => ({ ...t, count: counts[t.key] }))]
  const filterTabs = (
    <div className="flex border-b border-warm-border flex-shrink-0">
      {tabKeys.map(({ key, label, Icon, count }) => {
        const active = kategorija === key
        return (
          <button
            key={key ?? 'visi'}
            onClick={() => setKategorija(key)}
            className={`relative py-3 mr-5 text-sm font-semibold transition-colors flex items-center gap-1.5 ${
              active ? 'text-sage-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {Icon && <Icon size={13} />}
            <span>{label}</span>
            {count > 0 && (
              <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none ${
                active ? 'bg-sage-100 text-sage-600' : 'bg-gray-100 text-gray-400'
              }`}>{count}</span>
            )}
            {active && (
              <motion.div
                layoutId="biblioteka-tab-underline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-sage-500 rounded-full"
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              />
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
      {/* Top row: desktop'e tik filter tabs (search perkelta į DesktopHeader toolbar'ą),
          mobile'e — filter + search + camera vienoj eilutėj. */}
      <div className="px-5 pb-3 flex items-center gap-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        {filterTabs}
        {!isDesktop && (
          <>
            {searchRow}
            {!searching && (
              <button
                onClick={() => onSearchByCamera ? onSearchByCamera() : onSearch('')}
                className="flex-shrink-0 w-9 h-9 rounded-2xl flex items-center justify-center bg-white border border-gray-200 text-gray-600 active:bg-surface transition-colors"
              >
                <Camera size={16} />
              </button>
            )}
          </>
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
