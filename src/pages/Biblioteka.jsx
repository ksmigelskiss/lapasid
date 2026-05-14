import { useState, useMemo, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, Ghost, BookOpen, RefreshCw, Camera } from 'lucide-react'
import PlantCard from '../components/PlantCard'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import CollectionChat from '../components/CollectionChat'
import { buildLibrarySystemPrompt } from '../utils/collectionChatContext'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { plantFuzzyScore } from '../utils/fuzzySearch'
import Mascot from '../components/brand/Mascot'

// Pagrindinis kategorijos filtras (mutually exclusive). `null` = visi.
// Bibliotekoje rodomi tik `nori` ir `istorija` augalai (`auginama` lieka Dashboard'e).
const KATEGORIJA_TABS = [
  { key: 'nori',     label: 'Norėčiau' },
  { key: 'istorija', label: 'Istorija', Icon: Ghost },
]

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
    if (!query.trim()) {
      return [...filtered].sort((a, b) => new Date(b.data_prideta) - new Date(a.data_prideta))
    }
    // Su query — fuzzy match'as (LT diacritic'ai + typo'ų toleravimas) +
    // sort'as pagal score'ą (geriausi match'ai pirmiausiai), ne pagal datą.
    return filtered
      .map(p => ({ plant: p, score: plantFuzzyScore(p, query) }))
      .filter(x => x.score !== Infinity)
      .sort((a, b) => a.score - b.score)
      .map(x => x.plant)
  }, [plants, kategorija, query])

  const closeSearch = () => { setSearching(false); setQuery('') }
  const launchFullSearch = () => { onSearch(query); closeSearch() }

  // Filter tabs — underline stilius (toks pat kaip PlantDetail TabBar): plain
  // border-b + sage-500 active underline su layoutId animacija.
  const tabKeys = [{ key: null, label: 'Visi', count: counts.all }, ...KATEGORIJA_TABS.map(t => ({ ...t, count: counts[t.key] }))]
  const filterTabs = (
    <div className="flex border-b border-bone-400/40 flex-shrink-0">
      {tabKeys.map(({ key, label, Icon, count }) => {
        const active = kategorija === key
        return (
          <button
            key={key ?? 'visi'}
            onClick={() => setKategorija(key)}
            className={`relative py-3 mr-5 text-sm font-semibold transition-colors flex items-center gap-1.5 ${
              active ? 'text-forest-700' : 'text-forest-500 hover:text-forest-700'
            }`}
          >
            {Icon && <Icon size={13} />}
            <span>{label}</span>
            {count > 0 && (
              <span className={`font-mono text-[10px] font-medium rounded-full px-1.5 py-0.5 leading-none ${
                active ? 'bg-forest-100 text-forest-700' : 'bg-bone-300 text-forest-500'
              }`}>{count}</span>
            )}
            {active && (
              <motion.div
                layoutId="biblioteka-tab-underline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-forest-700 rounded-full"
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              />
            )}
          </button>
        )
      })}
    </div>
  )

  const searchRow = searching ? (
    <div className="flex-1 flex items-center gap-2 bg-bone-50 border border-bone-400/40 rounded-2xl px-4 h-9 focus-within:border-forest-400/60 transition-colors">
      <Search size={15} className="text-forest-400 flex-shrink-0" />
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
        className="flex-1 text-sm text-forest-700 placeholder-forest-400 outline-none bg-transparent"
      />
      <button onClick={closeSearch} className="text-forest-400 text-xs">✕</button>
    </div>
  ) : (
    <button
      onClick={() => setSearching(true)}
      className="flex-1 inline-flex items-center gap-2 bg-bone-50 border border-bone-400/40 hover:bg-bone-300/40 transition-colors rounded-2xl px-4 h-9"
    >
      <Search size={15} className="text-forest-400" />
      <span className="text-sm text-forest-500">Ieškoti augalo...</span>
    </button>
  )

  return (
    <div className="flex flex-col h-full bg-app">
      {/* Top row — tik filter tabs. Search perkelta į MobileHeader/DesktopHeader toolbar'ą. */}
      <div className="px-5 pb-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        {filterTabs}
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
          className={`text-forest-400 ${refreshing ? 'animate-spin' : ''}`}
          style={{ opacity: refreshing ? 1 : pullY / 48, transform: refreshing ? undefined : `rotate(${pullY * 4}deg)` }}
        />
      </div>

      {/* Grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-none px-5 pb-28">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
            <div className="text-forest-300">
              {query ? <Search size={48} /> : <BookOpen size={48} />}
            </div>
            <p className="font-display text-sm font-semibold tracking-tight text-forest-700">
              {query ? `„${query}" nerasta bibliotekoje` : 'Biblioteka tuščia'}
            </p>
            <p className="text-xs text-forest-500 max-w-[220px] leading-relaxed">
              {query
                ? null
                : 'Čia matysi augalus, kuriuos nori įsigyti, ir savo auginimo istoriją'}
            </p>
            {query ? (
              <button
                onClick={launchFullSearch}
                className="mt-1 px-6 h-12 rounded-btn font-display text-sm font-semibold text-bone bg-forest-700 hover:bg-forest-800 transition-colors"
              >
                ✦ Ieškoti su AI
              </button>
            ) : kategorija == null && (
              <button
                onClick={() => onSearch('')}
                className="mt-1 px-6 h-12 rounded-btn font-display text-sm font-semibold text-bone bg-forest-700 hover:bg-forest-800 transition-colors"
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
                />
              ))}
            </div>
            {searching && query.trim() && (
              <button
                onClick={launchFullSearch}
                className="w-full mt-3 py-3 rounded-btn font-display text-sm font-semibold text-bone bg-forest-700 hover:bg-forest-800 transition-colors"
              >
                ✦ Ieškoti su AI
              </button>
            )}
          </>
        )}
      </div>

      {/* Floating AI bubble */}
      {plants.length > 0 && (
        <button
          onClick={() => setShowChat(true)}
          aria-label="Atidaryti bibliotekos asistentą"
          className="absolute bottom-24 lg:bottom-3 right-4 lg:right-6 active:scale-90 transition-transform z-10 text-forest-700 animate-idle-float-gardener"
          /* Self-adjusting bone halo — visibility ant photo card'ų. */
          style={{
            filter: 'drop-shadow(0 0 12px rgba(254, 253, 250, 0.85)) drop-shadow(0 4px 10px rgba(28, 58, 42, 0.22))',
          }}
        >
          <Mascot type="gardener" state="idle" size={96} hoverable />
        </button>
      )}

      <AnimatePresence>
        {showChat && (
          <CollectionChat
            key="library-chat"
            title="Bibliotekos asistentas"
            mascot="gardener"
            systemPrompt={buildLibrarySystemPrompt(plants)}
            onClose={() => setShowChat(false)}
            onSaveToZinynas={onSaveToZinynas}
            plants={plants}
            onViewPlant={onViewPlant}
            desktopPopover={isDesktop}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
