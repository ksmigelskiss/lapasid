import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Star, SlidersHorizontal, Search, Ghost, BookOpen, RefreshCw, FileText, Camera } from 'lucide-react'
import PlantCard from '../components/PlantCard'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import CollectionChat from '../components/CollectionChat'
import { buildLibrarySystemPrompt } from '../utils/collectionChatContext'

const SORT_OPTIONS = [
  { key: 'added',      label: 'Pridėta' },
  { key: 'name',       label: 'A–Z' },
  { key: 'light',      label: 'Šviesa' },
  { key: 'water',      label: 'Vanduo' },
  { key: 'difficulty', label: 'Sunkumas', icon: Star },
]

// Pagrindinis kategorijos filtras (mutually exclusive). `null` = visi.
// Bibliotekoje rodomi tik `nori` ir `istorija` augalai (`auginama` lieka Dashboard'e).
const KATEGORIJA_TABS = [
  { key: 'nori',     label: 'Norėčiau' },
  { key: 'istorija', label: 'Istorija', Icon: Ghost },
]

// Papildomi modifikatoriai (AND virš kategorijos)
const MODIFIERS = [
  { key: 'uzrasai', Icon: FileText, label: 'Su užrašais' },
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
  return [plant.lietuviškas, plant.lotyniskas, plant.inatLtName,
    ...(plant.sinonimai ?? []), ...(plant.englishNames ?? [])]
    .some(c => c && c.toLowerCase().includes(lower))
}

function matchesKategorija(plant, kategorija) {
  if (kategorija == null) return true
  return plant.kategorija === kategorija
}

function matchesModifiers(plant, mods) {
  if (mods.size === 0) return true
  if (mods.has('uzrasai') && !(plant.uzrasai?.length > 0 || plant.komentaras?.trim())) return false
  return true
}

export default function Biblioteka({ plants, onTap, onSearch, onSearchByCamera, onSaveToZinynas, onViewPlant, onRefresh }) {
  const [kategorija, setKategorija] = useState(null)        // null = visi
  const [modifiers, setModifiers]   = useState(new Set())
  const [sortKey, setSortKey]       = useState('added')
  const [showFilters, setShowFilters] = useState(false)
  const [showChat, setShowChat]     = useState(false)
  const [searching, setSearching]   = useState(false)
  const [query, setQuery]           = useState('')
  const inputRef  = useRef(null)
  const scrollRef = useRef(null)
  const { pullY, refreshing } = usePullToRefresh(scrollRef, onRefresh ?? (() => {}))

  // Reset to "visi" when app returns from background
  useEffect(() => {
    const handle = () => {
      if (document.visibilityState === 'visible') {
        setKategorija(null)
        setModifiers(new Set())
      }
    }
    document.addEventListener('visibilitychange', handle)
    return () => document.removeEventListener('visibilitychange', handle)
  }, [])

  useEffect(() => {
    if (searching) inputRef.current?.focus()
  }, [searching])

  const toggleModifier = useCallback((key) => {
    setModifiers(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  // Skaičiai segmented control'ui
  const counts = useMemo(() => ({
    all:      plants.length,
    nori:     plants.filter(p => p.kategorija === 'nori').length,
    istorija: plants.filter(p => p.kategorija === 'istorija').length,
  }), [plants])

  const visible = useMemo(() => {
    const filtered = plants.filter(p => matchesKategorija(p, kategorija) && matchesModifiers(p, modifiers))
    const sorted   = sortPlants(filtered, sortKey)
    if (!query.trim()) return sorted
    return sorted.filter(p => matchesQuery(p, query))
  }, [plants, kategorija, modifiers, sortKey, query])

  const closeSearch = () => { setSearching(false); setQuery('') }
  const launchFullSearch = () => { onSearch(query); closeSearch() }

  // Sliders mygtukas highlightinasi tik kai aktyvūs jo panelio dalykai
  // (modifikatoriai arba sort). Kategorija turi savo segmented control viršuje
  // — todėl ji neskaitomi į "filtrai aktyvūs".
  const filtersActive = modifiers.size > 0 || sortKey !== 'added'

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
            className="flex-1 flex items-center gap-3 bg-white border border-gray-200 hover:bg-surface transition-colors rounded-2xl px-4 py-3"
          >
            <Search size={15} className="text-gray-400" />
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
        {!searching && (
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex-shrink-0 w-11 rounded-2xl flex items-center justify-center transition-colors ${
              showFilters || filtersActive
                ? 'bg-sage-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600'
            }`}
          >
            <SlidersHorizontal size={18} />
          </button>
        )}
      </div>

      {/* Segmented control — kategorijos filtras (visada matomas) */}
      {!searching && (
        <div className="px-5 mb-3">
          <div className="inline-flex items-center bg-white border border-gray-200 rounded-2xl p-1 w-full">
            <button
              onClick={() => setKategorija(null)}
              className={`flex-1 h-9 flex items-center justify-center gap-1 rounded-xl text-xs font-semibold transition-colors ${
                kategorija == null ? 'bg-sage-500 text-white' : 'text-gray-500 active:bg-surface'
              }`}
            >
              <span>Visi</span>
              <span className={kategorija == null ? 'text-white/70' : 'text-gray-400'}>{counts.all}</span>
            </button>
            {KATEGORIJA_TABS.map(({ key, label, Icon }) => {
              const active = kategorija === key
              const count = counts[key]
              return (
                <button
                  key={key}
                  onClick={() => setKategorija(active ? null : key)}
                  className={`flex-1 h-9 flex items-center justify-center gap-1 rounded-xl text-xs font-semibold transition-colors ${
                    active ? 'bg-sage-500 text-white' : 'text-gray-500 active:bg-surface'
                  }`}
                >
                  {Icon && <Icon size={13} />}
                  <span>{label}</span>
                  <span className={active ? 'text-white/70' : 'text-gray-400'}>{count}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Išplečiama: modifikatoriai + sort */}
      {showFilters && !searching && (
        <div className="space-y-3 mb-3 px-5">
          {/* Modifikatoriai (papildomi AND filtrai) */}
          {MODIFIERS.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Papildomai</p>
              <div className="flex gap-2 flex-wrap">
                {MODIFIERS.map(({ key, Icon, label }) => {
                  const active = modifiers.has(key)
                  return (
                    <button
                      key={key}
                      onClick={() => toggleModifier(key)}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? 'bg-sage-500 text-white'
                          : 'bg-white border border-gray-200 text-gray-600'
                      }`}
                    >
                      <Icon size={13} />
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Sort */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Rūšiuoti</p>
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
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
          </div>
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
            <div className="grid grid-cols-2 gap-3">
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
