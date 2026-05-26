/**
 * LibraryEditorV2 — 3-pane admin library editor (desktop-only, min 1280px).
 *
 * LAYOUT:
 *   ┌─────────────┬───────────────────────────┬────────────────────┐
 *   │ 280px       │ flex (min 600px)          │ 480px              │
 *   │ Left list   │ Center: tabs + edit form  │ Right: live preview│
 *   │ + search    │ + sticky save bar         │ (ProfileContent)   │
 *   │ + filters   │                           │                    │
 *   └─────────────┴───────────────────────────┴────────────────────┘
 *
 * Pakeičia LibraryTab.jsx kaip default'inį admin biblioteka editor'ių.
 * v1 (LibraryTab.jsx) lieka repo'je kaip backup — galim revert'inti 1 commit'u.
 *
 * URL state: ?edit=<docId> — bookmark'inamas konkretus entry'is, browser back
 * uždaro edit, naviguoja į list'ą.
 *
 * KAIP SUDĖTA:
 *   1. Pagrindinis export'as — state'as + 3-pane CSS grid
 *   2. LeftPaneList — searchable list (extract'inta iš v1 LibraryTab list logikos)
 *   3. CenterPaneEditor — placeholder'is (Etapas 2-3 užpildys)
 *   4. RightPanePreview — placeholder'is (Etapas 2 įdės ProfileContent)
 *   5. Form atoms — duplikuotos iš v1 (paliekam v1 atskirai, kad backup'as
 *      būtų self-contained)
 *
 * ETAPAI:
 *   • Etapas 1 (ŠIS COMMIT): shell + left list + URL routing + placeholder'iai
 *   • Etapas 2: live preview + save/discard state machine
 *   • Etapas 3: 7 tabs + form per tab'as + per-field modified indicator
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Search, ChevronRight, ChevronDown, ImageOff, Layers, Eye, Filter,
} from 'lucide-react'

const WIDGET = 'bg-bone-50 rounded-2xl border border-bone-400/40 shadow-[0_1px_3px_rgba(28,58,42,0.06),0_4px_14px_rgba(28,58,42,0.05)]'
const MIN_WIDTH_PX = 1280

// ── Filter definitions ─────────────────────────────────────────────
//
// Filter chips (kairėje pusėje virš list'o). Naudotojas gali siaurinti
// list'ą per kategorijas — pvz. „tik standalone" arba „tik tier 1".
const FILTERS = [
  { id: 'all',        label: 'Visi'        },
  { id: 'modified',   label: 'Pakeisti'    },  // _batchEnrichedAt > updatedAt - 7d
  { id: 'standalone', label: 'Standalone' },
  { id: 'series',     label: 'Serijos'     },
]

// ── Main export ─────────────────────────────────────────────────────

export default function LibraryEditorV2({
  catalog, taxonGroups,
  onSaveCatalog, onDeleteCatalog,
  onSaveTaxonGroup, onDeleteTaxonGroup,
}) {
  // ── Window size guard (desktop-only)
  const [windowTooSmall, setWindowTooSmall] = useState(
    typeof window !== 'undefined' && window.innerWidth < MIN_WIDTH_PX,
  )
  useEffect(() => {
    const check = () => setWindowTooSmall(window.innerWidth < MIN_WIDTH_PX)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ── Selection state (which entry being edited)
  const [selectedId, setSelectedId] = useState(null)
  const [selectedType, setSelectedType] = useState(null)  // 'cultivar' | 'series'

  // ── List state (search, filter, expanded series)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [expanded, setExpanded] = useState(() => new Set())

  // ── URL routing — ?edit=docId
  //
  // Hidratacija: pirmas render'is pasižiūri į URL ir auto-select'ina entry'į.
  // Editing → URL update'as per replaceState (be browser history pollution'o).
  // Naudojam catalog/taxonGroups ref'us, kad pakeitimai šitam useEffect'e
  // neperprocess'intų visą logiką po kiekvieno doc pakeitimo.
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (hydratedRef.current) return
    if (!catalog.length && !taxonGroups.length) return  // luktelk kol duomenys pasikraus
    const params = new URLSearchParams(window.location.search)
    const editId = params.get('edit')
    if (editId) {
      const cat = catalog.find(c => c.id === editId)
      if (cat) {
        setSelectedId(editId)
        setSelectedType('cultivar')
      } else {
        const ser = taxonGroups.find(g => g.id === editId)
        if (ser) {
          setSelectedId(editId)
          setSelectedType('series')
        }
      }
    }
    hydratedRef.current = true
  }, [catalog, taxonGroups])

  useEffect(() => {
    if (!hydratedRef.current) return
    const params = new URLSearchParams(window.location.search)
    if (selectedId) params.set('edit', selectedId)
    else params.delete('edit')
    const qs = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${qs ? '?' + qs : ''}`)
  }, [selectedId])

  // ── Resolve selected entry from catalog/taxonGroups
  const selectedEntry = useMemo(() => {
    if (!selectedId) return null
    if (selectedType === 'cultivar') return catalog.find(c => c.id === selectedId) ?? null
    if (selectedType === 'series') return taxonGroups.find(g => g.id === selectedId) ?? null
    return null
  }, [selectedId, selectedType, catalog, taxonGroups])

  // ── Select handler (no dirty-guard yet — Etapas 2 prideda)
  const handleSelect = useCallback((id, type) => {
    setSelectedId(id)
    setSelectedType(type)
  }, [])

  const toggleExpand = useCallback((id) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  if (windowTooSmall) return <TooSmallGuard />

  return (
    <div className="grid grid-cols-[280px_1fr_480px] gap-3 h-full min-h-0 p-3">
      <LeftPaneList
        catalog={catalog}
        taxonGroups={taxonGroups}
        search={search}
        setSearch={setSearch}
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
        expanded={expanded}
        toggleExpand={toggleExpand}
        selectedId={selectedId}
        onSelect={handleSelect}
      />
      <CenterPanePlaceholder entry={selectedEntry} entryType={selectedType} />
      <RightPanePlaceholder entry={selectedEntry} />
    </div>
  )
}

// ── Window too small guard ────────────────────────────────────────

function TooSmallGuard() {
  return (
    <div className="h-full flex items-center justify-center p-12">
      <div className={`${WIDGET} max-w-md px-6 py-8 text-center`}>
        <Eye size={32} className="text-forest-400 mx-auto mb-3" />
        <h3 className="font-display text-lg font-semibold text-forest-800 mb-2">
          Desktop only editor'ius
        </h3>
        <p className="text-sm text-forest-600 leading-relaxed">
          Library editor v2 reikalauja min <span className="font-mono">1280px</span> ekrano pločio.
          Atidaryk pilno ekrano lange arba ant didesnio monitoriaus.
        </p>
        <p className="text-xs text-forest-500 mt-3">
          Dabartinis plotis: <span className="font-mono">{typeof window !== 'undefined' ? window.innerWidth : '?'}</span>px
        </p>
      </div>
    </div>
  )
}

// ── Left pane: searchable list ────────────────────────────────────

function LeftPaneList({
  catalog, taxonGroups,
  search, setSearch,
  activeFilter, setActiveFilter,
  expanded, toggleExpand,
  selectedId, onSelect,
}) {
  // Unified items list — sortavimas:
  //   1. Serijos (taxonGroups) pirma, by cultivar count desc (kaip v1)
  //   2. Standalone'iai pabaigoje, alfabetu (kaip v1)
  const items = useMemo(() => {
    const seriesItems = taxonGroups.map(g => ({
      kind: 'series',
      id: g.id,
      group: g,
      cultivars: catalog.filter(c => c.taxonGroupId === g.id),
    }))
    const standaloneItems = catalog
      .filter(c => !c.taxonGroupId)
      .map(c => ({ kind: 'standalone', id: c.id, entry: c }))

    return [
      ...seriesItems.sort((a, b) => b.cultivars.length - a.cultivars.length),
      ...standaloneItems.sort((a, b) =>
        (a.entry.lotyniskas ?? '').localeCompare(b.entry.lotyniskas ?? ''),
      ),
    ]
  }, [catalog, taxonGroups])

  // Filter pipeline — paieška + chip filter'is.
  // Chip'ai filter'inami pirmiausia (greitesnis), tada paieška.
  const filteredItems = useMemo(() => {
    let result = items

    // Chip filter'is
    if (activeFilter === 'standalone') {
      result = result.filter(it => it.kind === 'standalone')
    } else if (activeFilter === 'series') {
      result = result.filter(it => it.kind === 'series')
    } else if (activeFilter === 'modified') {
      // „Modified" = batch enriched per pastarąsias 7 dienas. Eviksta noise
      // (legacy entries iš seno saugojimo nerodomi).
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
      result = result.filter(it => {
        if (it.kind === 'series') return false  // serijos neturi _batchEnrichedAt
        const ts = it.entry._batchEnrichedAt
        if (!ts) return false
        return new Date(ts).getTime() > cutoff
      })
    }

    // Paieška
    if (!search.trim()) return result
    const q = search.toLowerCase()
    return result
      .map(item => {
        if (item.kind === 'series') {
          const seriesMatches = `${item.group.genus ?? ''} ${item.group.name ?? ''}`.toLowerCase().includes(q)
          const matchingCults = item.cultivars.filter(c =>
            `${c.lotyniskas ?? ''} ${c.lietuviškas ?? ''}`.toLowerCase().includes(q),
          )
          if (seriesMatches) return item
          if (matchingCults.length > 0) return { ...item, cultivars: matchingCults }
          return null
        }
        const hay = `${item.entry.lotyniskas ?? ''} ${item.entry.lietuviškas ?? ''}`.toLowerCase()
        return hay.includes(q) ? item : null
      })
      .filter(Boolean)
  }, [items, search, activeFilter])

  // Auto-expand serijos kai paieška turi match'us cultivar'uose
  useEffect(() => {
    if (!search.trim()) return
    // We rely on setter being stable; toggleExpand'as priimtų bet kurią ID,
    // bet čia naudojam direct setter (parent'as turi state'ą)
    // Pasinaudosim factor'ed pattern'u: per filteredItems iteruoti, kviesti
    // toggleExpand jei dar nėra expanded'inta.
    filteredItems.forEach(item => {
      if (item.kind === 'series' && !expanded.has(item.group.id)) {
        toggleExpand(item.group.id)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  // Keyboard navigation — ↑↓ arrows naviguoja, Enter open'ina
  //
  // Flat'inam visus selectable'us items (serijos + cultivars expanded'intuose
  // serijose + standalone'iai). Index per visus → ↑↓ navigation.
  const flatNavItems = useMemo(() => {
    const flat = []
    for (const item of filteredItems) {
      if (item.kind === 'series') {
        flat.push({ id: item.group.id, type: 'series' })
        if (expanded.has(item.group.id)) {
          for (const c of item.cultivars) {
            flat.push({ id: c.id, type: 'cultivar' })
          }
        }
      } else {
        flat.push({ id: item.entry.id, type: 'cultivar' })
      }
    }
    return flat
  }, [filteredItems, expanded])

  useEffect(() => {
    const handler = (e) => {
      // Skip jei vartotojas type'ina input'e (search'as)
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (!flatNavItems.length) return
      const currentIdx = flatNavItems.findIndex(it => it.id === selectedId)
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const next = currentIdx < flatNavItems.length - 1 ? currentIdx + 1 : 0
        const target = flatNavItems[next]
        onSelect(target.id, target.type)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const next = currentIdx > 0 ? currentIdx - 1 : flatNavItems.length - 1
        const target = flatNavItems[next]
        onSelect(target.id, target.type)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [flatNavItems, selectedId, onSelect])

  return (
    <div className={`${WIDGET} flex flex-col min-h-0 overflow-hidden`}>
      {/* Sticky header: search + filter chips */}
      <div className="flex-shrink-0 border-b border-bone-400/40 bg-bone-50">
        {/* Search */}
        <div className="px-3 py-2.5">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-forest-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Paieška…"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-bone-100 border border-bone-400/40 rounded-btn-sm text-forest-800 placeholder:text-forest-300 focus:outline-none focus:border-forest-500 focus:bg-bone-50"
            />
          </div>
        </div>
        {/* Filter chips */}
        <div className="px-3 pb-2.5 flex items-center gap-1 overflow-x-auto">
          <Filter size={10} className="text-forest-400 flex-shrink-0" />
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={`flex-shrink-0 px-2 py-0.5 rounded-full font-mono text-[10px] font-medium uppercase tracking-[0.1em] transition-colors ${
                activeFilter === f.id
                  ? 'bg-forest-700 text-bone'
                  : 'bg-bone-200 text-forest-600 hover:bg-bone-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List scrollable */}
      <div className="flex-1 overflow-y-auto px-1.5 py-1.5">
        {filteredItems.length === 0 ? (
          <p className="text-center text-forest-500 text-xs py-12 px-3">
            {search.trim()
              ? `Nieko nerasta su „${search}"`
              : activeFilter !== 'all'
                ? 'Šiame filtre tuščia.'
                : 'Biblioteka tuščia.'}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {filteredItems.map(item =>
              item.kind === 'series' ? (
                <SeriesListItem
                  key={item.id}
                  group={item.group}
                  cultivars={item.cultivars}
                  expanded={expanded.has(item.group.id)}
                  onToggle={() => toggleExpand(item.group.id)}
                  selectedId={selectedId}
                  onSelect={onSelect}
                />
              ) : (
                <StandaloneListItem
                  key={item.id}
                  entry={item.entry}
                  selected={selectedId === item.entry.id}
                  onSelect={() => onSelect(item.entry.id, 'cultivar')}
                />
              ),
            )}
          </ul>
        )}
      </div>

      {/* Footer count */}
      <div className="flex-shrink-0 border-t border-bone-400/40 px-3 py-1.5 bg-bone-100/60">
        <p className="font-mono text-[10px] text-forest-500 tabular-nums">
          {filteredItems.length} / {items.length} items
        </p>
      </div>
    </div>
  )
}

// ── List items ─────────────────────────────────────────────────────

function SeriesListItem({ group, cultivars, expanded, onToggle, selectedId, onSelect }) {
  const heroImage = cultivars[0]?.image
  const seriesSelected = selectedId === group.id
  return (
    <li>
      <div className={`flex items-center gap-1.5 rounded-btn-sm pl-1 pr-2 py-1 transition-colors ${
        seriesSelected ? 'bg-forest-100' : 'hover:bg-bone-200/60'
      }`}>
        <button
          onClick={onToggle}
          className="w-5 h-5 flex-shrink-0 inline-flex items-center justify-center text-forest-500 hover:text-forest-700 rounded-sm hover:bg-bone-300/40"
          title={expanded ? 'Suskleisti' : 'Išskleisti'}
        >
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </button>
        <button
          onClick={() => onSelect(group.id, 'series')}
          className="flex-1 flex items-center gap-2 text-left min-w-0"
        >
          <div className="w-7 h-7 flex-shrink-0 rounded-md overflow-hidden bg-bone-200 flex items-center justify-center">
            {heroImage ? (
              <img src={heroImage} alt="" className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <Layers size={11} className="text-forest-300" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-semibold truncate leading-tight italic ${
              seriesSelected ? 'text-forest-800' : 'text-forest-700'
            }`}>
              {group.genus} {group.name}
            </p>
            <p className="text-[10px] text-forest-500 font-mono leading-tight">
              {group.type ?? '—'} · {cultivars.length}
            </p>
          </div>
        </button>
      </div>
      {expanded && cultivars.length > 0 && (
        <ul className="ml-7 mt-0.5 space-y-0.5">
          {cultivars.map(c => (
            <CultivarChildItem
              key={c.id}
              entry={c}
              selected={selectedId === c.id}
              onSelect={() => onSelect(c.id, 'cultivar')}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function StandaloneListItem({ entry, selected, onSelect }) {
  return (
    <li>
      <button
        onClick={onSelect}
        className={`w-full flex items-center gap-2 rounded-btn-sm px-2 py-1 text-left transition-colors ${
          selected ? 'bg-forest-100' : 'hover:bg-bone-200/60'
        }`}
      >
        <div className="w-7 h-7 flex-shrink-0 rounded-md overflow-hidden bg-bone-200 flex items-center justify-center">
          {entry.image ? (
            <img src={entry.image} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <ImageOff size={11} className="text-forest-300" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold truncate leading-tight ${
            selected ? 'text-forest-800' : 'text-forest-700'
          }`}>
            {entry.lietuviškas || '—'}
          </p>
          <p className="text-[10px] text-forest-500 italic truncate leading-tight">
            {entry.lotyniskas}
          </p>
        </div>
      </button>
    </li>
  )
}

function CultivarChildItem({ entry, selected, onSelect }) {
  return (
    <li>
      <button
        onClick={onSelect}
        className={`w-full flex items-center gap-1.5 rounded-btn-sm px-1.5 py-1 text-left transition-colors ${
          selected ? 'bg-forest-100' : 'hover:bg-bone-200/40'
        }`}
      >
        <div className="w-5 h-5 flex-shrink-0 rounded-sm overflow-hidden bg-bone-200 flex items-center justify-center">
          {entry.image ? (
            <img src={entry.image} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <ImageOff size={9} className="text-forest-300" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[11px] font-medium truncate leading-tight ${
            selected ? 'text-forest-800' : 'text-forest-600'
          }`}>
            {entry.lietuviškas || '—'}
          </p>
          <p className="text-[9px] text-forest-500 italic truncate leading-tight">
            {entry.lotyniskas}
          </p>
        </div>
      </button>
    </li>
  )
}

// ── Center pane placeholder (Etapas 2-3 užpildys) ─────────────────

function CenterPanePlaceholder({ entry, entryType }) {
  if (!entry) {
    return (
      <div className={`${WIDGET} flex items-center justify-center h-full`}>
        <div className="text-center px-6">
          <p className="text-sm text-forest-500">Pasirink augalą iš sąrašo kairėje</p>
          <p className="text-xs text-forest-400 mt-1 font-mono">↑↓ navigate · Enter open</p>
        </div>
      </div>
    )
  }
  return (
    <div className={`${WIDGET} flex flex-col h-full overflow-hidden`}>
      <div className="px-5 py-3 border-b border-bone-400/40 flex-shrink-0">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-forest-500">
          {entryType === 'series' ? 'Serija' : 'Cultivar'}
        </p>
        <h2 className="font-display text-base font-semibold tracking-tight text-forest-800 truncate italic">
          {entryType === 'series'
            ? `${entry.genus ?? ''} ${entry.name ?? ''}`.trim()
            : entry.lotyniskas || entry.id}
        </h2>
        {entryType === 'cultivar' && entry.lietuviškas && (
          <p className="text-sm text-forest-600">{entry.lietuviškas}</p>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        <p className="text-xs text-forest-400 font-mono">
          [Etapas 2-3: tabs + edit form'a čia bus]
        </p>
        <pre className="mt-4 text-[10px] text-forest-500 font-mono bg-bone-100 p-3 rounded overflow-auto max-h-[60vh]">
          {JSON.stringify(entry, null, 2)}
        </pre>
      </div>
    </div>
  )
}

// ── Right pane placeholder (Etapas 2 įdės ProfileContent) ─────────

function RightPanePlaceholder({ entry }) {
  return (
    <div className={`${WIDGET} flex flex-col h-full overflow-hidden`}>
      <div className="flex-shrink-0 px-4 py-2 border-b border-bone-400/40 bg-bone-100/60 flex items-center gap-2">
        <Eye size={11} className="text-forest-500" />
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-forest-500">
          Preview
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        {entry ? (
          <div className="space-y-2">
            <p className="text-xs text-forest-400 font-mono">
              [Etapas 2: live ProfileContent preview čia]
            </p>
            {entry.image && (
              <img src={entry.image} alt="" className="w-full max-h-64 object-contain rounded-md bg-bone-100" />
            )}
            <p className="font-display text-lg font-semibold text-forest-800 italic">
              {entry.lotyniskas}
            </p>
            {entry.lietuviškas && (
              <p className="text-sm text-forest-600">{entry.lietuviškas}</p>
            )}
            {entry.aprasymas && (
              <p className="text-xs text-forest-700 leading-relaxed mt-3">
                {typeof entry.aprasymas === 'string' ? entry.aprasymas : JSON.stringify(entry.aprasymas)}
              </p>
            )}
          </div>
        ) : (
          <p className="text-center text-forest-400 text-xs py-12">
            Preview rodysis pasirinkus augalą
          </p>
        )}
      </div>
    </div>
  )
}
