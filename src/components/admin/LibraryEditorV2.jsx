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
 * STATE FLOW:
 *   1. User'is click'ina entry'į → setSelectedId/Type
 *   2. selectedEntry useMemo'as resolve'ina entry'į iš catalog/taxonGroups
 *   3. useEffect on selectedEntry kintančio: load originalDraft + draft state'us
 *   4. User'is edit'ina field'ą → setDraft + setDirty(true)
 *   5. Preview pane'as merge'ina entry + draft → ProfileContent live update
 *   6. Save → diff'as nuo originalDraft → onSaveCatalog patch'as
 *   7. Discard → reset draft į originalDraft
 *   8. Switch entry su dirty → unsaved changes modal'as (Cancel/Discard/Save+Switch)
 *
 * ETAPAI:
 *   • Etapas 1 (DONE): shell + left list + URL routing
 *   • Etapas 2 (ŠIS COMMIT): center editor + live preview + save/discard state
 *   • Etapas 3: 7 tabs + full form per tab'as + per-field modified indicator
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Search, ChevronRight, ChevronDown, ImageOff, Layers, Eye, Filter,
  Save, RotateCcw, Trash2, AlertTriangle, X, CheckCircle2,
} from 'lucide-react'
import { ProfileContent } from '../PlantDetail'

const WIDGET = 'bg-bone-50 rounded-2xl border border-bone-400/40 shadow-[0_1px_3px_rgba(28,58,42,0.06),0_4px_14px_rgba(28,58,42,0.05)]'
const MIN_WIDTH_PX = 1280

// ── Filter definitions ─────────────────────────────────────────────
const FILTERS = [
  { id: 'all',        label: 'Visi'        },
  { id: 'modified',   label: 'Pakeisti'    },  // _batchEnrichedAt < 7d
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

  // ── Selection state
  const [selectedId, setSelectedId] = useState(null)
  const [selectedType, setSelectedType] = useState(null)  // 'cultivar' | 'series'

  // ── List state
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [expanded, setExpanded] = useState(() => new Set())

  // ── Draft state machine
  //
  // `originalDraft` — paskutinio save'o snapshot'as (dirty=false baseline'as).
  // `draft` — current edit'ai. Dirty = JSON.stringify(draft) !== stringify(original).
  // Per useEffect on selectedEntry, abu re-set'inami iš naujo (load'as).
  // Save success → originalDraft = draft (naujas baseline'as).
  const [draft, setDraft] = useState(null)
  const [originalDraft, setOriginalDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [savedToast, setSavedToast] = useState(false)  // 2s flash po success

  // ── Unsaved-changes guard modal
  const [pendingNav, setPendingNav] = useState(null)  // { id, type } pending switch

  // ── URL routing — ?edit=docId
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (hydratedRef.current) return
    if (!catalog.length && !taxonGroups.length) return
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

  // ── Resolve selected entry
  const selectedEntry = useMemo(() => {
    if (!selectedId) return null
    if (selectedType === 'cultivar') return catalog.find(c => c.id === selectedId) ?? null
    if (selectedType === 'series') return taxonGroups.find(g => g.id === selectedId) ?? null
    return null
  }, [selectedId, selectedType, catalog, taxonGroups])

  // ── Reload draft kai selectedEntry pakeičiamas
  //
  // CRITICAL: useEffect priklauso nuo selectedId+Type (NE selectedEntry), kad
  // kiekvienas catalog list'os refresh'as (po save'o, po batch'o) nereset'intų
  // draft'o. Pakeitimas iš parent'o (saveCatalogEntry → catalog state update)
  // grąžins naują entry instance — selectedEntry useMemo regeneruosis, BET
  // draft NEPAKEISIM nes selectedId nepakito. Naują entry'į matysim per
  // preview'o merge (entry + draft).
  useEffect(() => {
    if (!selectedEntry) {
      setDraft(null)
      setOriginalDraft(null)
      setSaveError(null)
      return
    }
    const norm = selectedType === 'cultivar'
      ? normalizeCultivar(selectedEntry)
      : normalizeTaxonGroup(selectedEntry)
    setDraft(norm)
    setOriginalDraft(norm)
    setSaveError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selectedType])

  // ── Dirty calculation (cheap JSON compare)
  const dirty = useMemo(() => {
    if (!draft || !originalDraft) return false
    return JSON.stringify(draft) !== JSON.stringify(originalDraft)
  }, [draft, originalDraft])

  // ── Selection handler with dirty guard
  const handleSelect = useCallback((id, type) => {
    if (dirty) {
      setPendingNav({ id, type })
    } else {
      setSelectedId(id)
      setSelectedType(type)
    }
  }, [dirty])

  const toggleExpand = useCallback((id) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  // ── beforeunload guard
  useEffect(() => {
    if (!dirty) return
    const handler = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  // ── Update draft field (passed to form components)
  const updateField = useCallback((key, value) => {
    setDraft(d => d ? { ...d, [key]: value } : d)
  }, [])

  // ── Save handler
  //
  // Build'inu patch'ą iš dirty field'ų tik. NE siunčiame visus laukus (ne
  // overwrite'inti AI ar manual edit'ai, kurių neliečiame). Tuščius string'us
  // siunčiame kaip null (clear field). Tas pats kaip v1 logika.
  const handleSave = useCallback(async (afterSaveNav = null) => {
    if (!selectedEntry || !draft || !originalDraft) return
    setSaving(true)
    setSaveError(null)
    try {
      const patch = {}
      for (const k of Object.keys(draft)) {
        if (JSON.stringify(draft[k]) !== JSON.stringify(originalDraft[k] ?? defaultValueFor(k))) {
          patch[k] = draft[k] === '' ? null : draft[k]
        }
      }
      if (Object.keys(patch).length === 0) {
        // Nothing changed — odd path, just exit gracefully
        setSaving(false)
        if (afterSaveNav) {
          setSelectedId(afterSaveNav.id)
          setSelectedType(afterSaveNav.type)
          setPendingNav(null)
        }
        return
      }
      if (selectedType === 'cultivar') {
        await onSaveCatalog(selectedEntry.id, patch)
      } else {
        await onSaveTaxonGroup(selectedEntry.id, patch)
      }
      // Success: new baseline = current draft
      setOriginalDraft(draft)
      setSavedToast(true)
      setTimeout(() => setSavedToast(false), 2000)
      if (afterSaveNav) {
        setSelectedId(afterSaveNav.id)
        setSelectedType(afterSaveNav.type)
        setPendingNav(null)
      }
    } catch (e) {
      setSaveError(e?.message ?? 'Nepavyko išsaugoti')
    } finally {
      setSaving(false)
    }
  }, [selectedEntry, selectedType, draft, originalDraft, onSaveCatalog, onSaveTaxonGroup])

  // ── Discard handler
  const handleDiscard = useCallback(() => {
    if (!originalDraft) return
    setDraft(originalDraft)
    setSaveError(null)
  }, [originalDraft])

  // ── Delete handler
  const handleDelete = useCallback(async () => {
    if (!selectedEntry) return
    const label = selectedType === 'cultivar'
      ? (selectedEntry.lotyniskas || selectedEntry.id)
      : `${selectedEntry.genus ?? ''} ${selectedEntry.name ?? ''}`.trim() || selectedEntry.id
    try {
      if (selectedType === 'cultivar') {
        await onDeleteCatalog(selectedEntry.id, label)
      } else {
        await onDeleteTaxonGroup(selectedEntry.id, label)
      }
      // After delete: clear selection
      setSelectedId(null)
      setSelectedType(null)
    } catch (e) {
      setSaveError(e?.message ?? 'Nepavyko ištrinti')
    }
  }, [selectedEntry, selectedType, onDeleteCatalog, onDeleteTaxonGroup])

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
        dirty={dirty}
      />
      <CenterPaneEditor
        entry={selectedEntry}
        entryType={selectedType}
        draft={draft}
        originalDraft={originalDraft}
        updateField={updateField}
        dirty={dirty}
        saving={saving}
        saveError={saveError}
        savedToast={savedToast}
        onSave={() => handleSave()}
        onDiscard={handleDiscard}
        onDelete={handleDelete}
      />
      <RightPanePreview entry={selectedEntry} draft={draft} entryType={selectedType} />

      {pendingNav && (
        <UnsavedChangesModal
          onCancel={() => setPendingNav(null)}
          onDiscard={() => {
            setSelectedId(pendingNav.id)
            setSelectedType(pendingNav.type)
            setPendingNav(null)
          }}
          onSaveAndContinue={() => handleSave(pendingNav)}
          saving={saving}
        />
      )}
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
  selectedId, onSelect, dirty,
}) {
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

  const filteredItems = useMemo(() => {
    let result = items

    if (activeFilter === 'standalone') {
      result = result.filter(it => it.kind === 'standalone')
    } else if (activeFilter === 'series') {
      result = result.filter(it => it.kind === 'series')
    } else if (activeFilter === 'modified') {
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
      result = result.filter(it => {
        if (it.kind === 'series') return false
        const ts = it.entry._batchEnrichedAt
        if (!ts) return false
        return new Date(ts).getTime() > cutoff
      })
    }

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

  useEffect(() => {
    if (!search.trim()) return
    filteredItems.forEach(item => {
      if (item.kind === 'series' && !expanded.has(item.group.id)) {
        toggleExpand(item.group.id)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

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
      <div className="flex-shrink-0 border-b border-bone-400/40 bg-bone-50">
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

      <div className="flex-1 overflow-y-auto px-1.5 py-1.5">
        {filteredItems.length === 0 ? (
          <p className="text-center text-forest-500 text-xs py-12 px-3">
            {search.trim() ? `Nieko nerasta su „${search}"`
              : activeFilter !== 'all' ? 'Šiame filtre tuščia.'
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
                  dirty={dirty}
                />
              ) : (
                <StandaloneListItem
                  key={item.id}
                  entry={item.entry}
                  selected={selectedId === item.entry.id}
                  onSelect={() => onSelect(item.entry.id, 'cultivar')}
                  dirty={dirty}
                />
              ),
            )}
          </ul>
        )}
      </div>

      <div className="flex-shrink-0 border-t border-bone-400/40 px-3 py-1.5 bg-bone-100/60">
        <p className="font-mono text-[10px] text-forest-500 tabular-nums">
          {filteredItems.length} / {items.length} items
          {dirty && <span className="ml-2 text-terracotta-600">⚡ unsaved</span>}
        </p>
      </div>
    </div>
  )
}

function SeriesListItem({ group, cultivars, expanded, onToggle, selectedId, onSelect, dirty }) {
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
              {seriesSelected && dirty && <span className="ml-1 text-terracotta-600">*</span>}
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
              dirty={dirty}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function StandaloneListItem({ entry, selected, onSelect, dirty }) {
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
            {selected && dirty && <span className="ml-1 text-terracotta-600">*</span>}
          </p>
          <p className="text-[10px] text-forest-500 italic truncate leading-tight">
            {entry.lotyniskas}
          </p>
        </div>
      </button>
    </li>
  )
}

function CultivarChildItem({ entry, selected, onSelect, dirty }) {
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
            {selected && dirty && <span className="ml-1 text-terracotta-600">*</span>}
          </p>
          <p className="text-[9px] text-forest-500 italic truncate leading-tight">
            {entry.lotyniskas}
          </p>
        </div>
      </button>
    </li>
  )
}

// ── Center pane: editor with sticky save bar ──────────────────────

function CenterPaneEditor({
  entry, entryType, draft, originalDraft, updateField,
  dirty, saving, saveError, savedToast,
  onSave, onDiscard, onDelete,
}) {
  if (!entry || !draft) {
    return (
      <div className={`${WIDGET} flex items-center justify-center h-full`}>
        <div className="text-center px-6">
          <p className="text-sm text-forest-500">Pasirink augalą iš sąrašo kairėje</p>
          <p className="text-xs text-forest-400 mt-1 font-mono">↑↓ navigate · click open</p>
        </div>
      </div>
    )
  }

  // Count dirty fields for save button label
  const dirtyCount = useMemo(() => {
    if (!dirty || !originalDraft) return 0
    let n = 0
    for (const k of Object.keys(draft)) {
      if (JSON.stringify(draft[k]) !== JSON.stringify(originalDraft[k] ?? defaultValueFor(k))) n++
    }
    return n
  }, [draft, originalDraft, dirty])

  return (
    <div className={`${WIDGET} flex flex-col h-full overflow-hidden relative`}>
      {/* Sticky header */}
      <div className="flex-shrink-0 border-b border-bone-400/40 bg-bone-50">
        <div className="px-5 py-3 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-forest-500">
              {entryType === 'series' ? 'Serija' : 'Cultivar'}
              {dirty && <span className="ml-2 text-terracotta-600">⚡ {dirtyCount} change{dirtyCount === 1 ? '' : 's'}</span>}
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
          <div className="flex items-center gap-1.5 flex-shrink-0 pt-1">
            <button
              onClick={onDiscard}
              disabled={!dirty || saving}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-btn-sm text-[11px] font-medium text-forest-600 hover:bg-bone-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Atmesti pakeitimus"
            >
              <RotateCcw size={11} /> Atmesti
            </button>
            <button
              onClick={onSave}
              disabled={!dirty || saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn-sm text-xs font-semibold bg-forest-700 hover:bg-forest-800 text-bone disabled:bg-bone-300 disabled:text-forest-400 disabled:cursor-not-allowed transition-colors"
            >
              <Save size={12} />
              {saving ? 'Saugoma…' : dirty ? `Saugoti${dirtyCount > 0 ? ` (${dirtyCount})` : ''}` : 'Be pakeitimų'}
            </button>
          </div>
        </div>
        {saveError && (
          <div className="mx-5 mb-3 px-3 py-2 bg-terracotta-50 border border-terracotta-200/60 rounded-md text-[11px] text-terracotta-700 flex items-start gap-2">
            <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
            <span>{saveError}</span>
          </div>
        )}
        {savedToast && (
          <div className="mx-5 mb-3 px-3 py-2 bg-forest-50 border border-forest-200/60 rounded-md text-[11px] text-forest-700 flex items-center gap-2">
            <CheckCircle2 size={11} className="flex-shrink-0" />
            <span>Išsaugota.</span>
          </div>
        )}
      </div>

      {/* Body — Etapas 3 įdės pilnus tab'us. Dabar: bazinis identifikacijos
          form'as + raw JSON viewer kitiems laukams. Tai pakankama testavimui
          save/discard flow'o. */}
      <div className="flex-1 overflow-y-auto p-5">
        <BasicIdentForm
          draft={draft}
          originalDraft={originalDraft}
          updateField={updateField}
          entryType={entryType}
        />
        <details className="mt-6">
          <summary className="cursor-pointer font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-forest-500 mb-2">
            Visi laukai (raw JSON) — Etapas 3 įdės struktūrizuotus tabs'us
          </summary>
          <pre className="text-[10px] text-forest-500 font-mono bg-bone-100 p-3 rounded overflow-auto max-h-[40vh]">
            {JSON.stringify(draft, null, 2)}
          </pre>
        </details>
      </div>

      {/* Danger zone — apačioje */}
      <div className="flex-shrink-0 border-t border-bone-400/40 bg-terracotta-50/40 px-5 py-2.5">
        <button
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 text-[11px] text-terracotta-700 hover:text-terracotta-800 hover:underline"
        >
          <Trash2 size={11} />
          {entryType === 'series' ? 'Ištrinti seriją (cascade)' : 'Ištrinti iš bibliotekos'}
        </button>
      </div>
    </div>
  )
}

// ── Basic identification form (Etapas 2 placeholder; Etapas 3 expand to 7 tabs) ─

function BasicIdentForm({ draft, originalDraft, updateField, entryType }) {
  if (entryType === 'series') {
    return (
      <div className="space-y-3 max-w-2xl">
        <FormRow label="Genus" dirty={fieldDirty(draft.genus, originalDraft?.genus)}>
          <TextInput value={draft.genus ?? ''} onChange={v => updateField('genus', v)} />
        </FormRow>
        <FormRow label="Pavadinimas" dirty={fieldDirty(draft.name, originalDraft?.name)}>
          <TextInput value={draft.name ?? ''} onChange={v => updateField('name', v)} />
        </FormRow>
        <FormRow label="Tipas" dirty={fieldDirty(draft.type, originalDraft?.type)}>
          <TextInput value={draft.type ?? ''} onChange={v => updateField('type', v)} />
        </FormRow>
      </div>
    )
  }
  return (
    <div className="space-y-3 max-w-2xl">
      <FormRow label="Lotyniškas" dirty={fieldDirty(draft.lotyniskas, originalDraft?.lotyniskas)}>
        <TextInput
          value={draft.lotyniskas ?? ''}
          onChange={v => updateField('lotyniskas', v)}
          placeholder="Kalanchoe blossfeldiana"
        />
      </FormRow>
      <FormRow label="Lietuviškas" dirty={fieldDirty(draft.lietuviškas, originalDraft?.lietuviškas)}>
        <TextInput
          value={draft.lietuviškas ?? ''}
          onChange={v => updateField('lietuviškas', v)}
          placeholder="Kalankė"
        />
      </FormRow>
      <FormRow label="Image URL" dirty={fieldDirty(draft.image, originalDraft?.image)}>
        <TextInput
          value={draft.image ?? ''}
          onChange={v => updateField('image', v)}
          placeholder="https://upload.wikimedia.org/..."
        />
      </FormRow>
      {draft.image && (
        <img
          src={draft.image}
          alt=""
          className="max-w-[280px] max-h-40 object-contain rounded-md bg-bone-200"
        />
      )}
    </div>
  )
}

// ── Right pane: live ProfileContent preview ───────────────────────

function RightPanePreview({ entry, draft, entryType }) {
  // ── Debounced draft (300ms) — prevents preview re-render on every keystroke
  const [debouncedDraft, setDebouncedDraft] = useState(draft)
  useEffect(() => {
    if (!draft) { setDebouncedDraft(null); return }
    const t = setTimeout(() => setDebouncedDraft(draft), 300)
    return () => clearTimeout(t)
  }, [draft])

  if (!entry) {
    return (
      <div className={`${WIDGET} flex flex-col h-full overflow-hidden`}>
        <PreviewBadge />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-center text-forest-400 text-xs px-6">
            Preview rodysis pasirinkus augalą
          </p>
        </div>
      </div>
    )
  }

  if (entryType === 'series') {
    // Series neturi plant card render'io — ji yra metadata + careInfo, ne
    // pats augalas. Rodom suvestinę draft state'o pavidalu.
    return (
      <div className={`${WIDGET} flex flex-col h-full overflow-hidden`}>
        <PreviewBadge label="Serija — preview" />
        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-3">
            <div>
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-forest-500">Genus · Name</p>
              <p className="font-display text-xl font-semibold italic text-forest-800">
                {debouncedDraft?.genus} {debouncedDraft?.name}
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-forest-500">Tipas</p>
              <p className="text-sm text-forest-700">{debouncedDraft?.type || '—'}</p>
            </div>
            {debouncedDraft?.aprasymas && (
              <div>
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-forest-500">Aprašymas</p>
                <p className="text-xs text-forest-700 leading-relaxed">{debouncedDraft.aprasymas}</p>
              </div>
            )}
            <div>
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-forest-500 mb-1">Care šablonas</p>
              <pre className="text-[10px] text-forest-600 font-mono bg-bone-100 p-2 rounded overflow-auto max-h-[40vh]">
                {JSON.stringify(debouncedDraft?.careInfo ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Cultivar — merge entry + draft, render ProfileContent
  // ProfileContent expects a plant doc-like object. Catalog entries trūksta
  // kai kurių user-plant field'ų (id, kategorija, status, etc) — pridedam
  // safe defaults, kad ProfileContent neclashintų.
  const mergedPlant = {
    ...entry,
    ...(debouncedDraft ?? {}),
    id: `preview-${entry.id}`,         // synthetic id (preview-mode)
    kategorija: entry.kategorija ?? 'auginama',
    status: entry.status ?? 'auginama',
    photos: entry.photos ?? [],
    timeline: entry.timeline ?? [],
  }

  return (
    <div className={`${WIDGET} flex flex-col h-full overflow-hidden`}>
      <PreviewBadge />
      <div className="flex-1 overflow-y-auto relative">
        {/* pointer-events-none overlay'as — view-only. ProfileContent'o
            action button'ai vizualiai matomi, bet click'ai blokuojami. */}
        <div className="pointer-events-none">
          <ProfileContent
            plant={mergedPlant}
            section={null}
            onAction={() => {}}
            onClose={() => {}}
            collectionId={null}
            onTogglePassport={null}
            onUpdateNames={null}
            onRefreshFromAI={null}
            className="px-4 pt-3 pb-8 space-y-5"
          />
        </div>
      </div>
    </div>
  )
}

function PreviewBadge({ label = 'Preview · live' }) {
  return (
    <div className="flex-shrink-0 px-4 py-2 border-b border-bone-400/40 bg-bone-100/60 flex items-center gap-2">
      <Eye size={11} className="text-forest-500" />
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-forest-500">
        {label}
      </p>
    </div>
  )
}

// ── Unsaved changes modal ─────────────────────────────────────────

function UnsavedChangesModal({ onCancel, onDiscard, onSaveAndContinue, saving }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-forest-900/40">
      <div className={`${WIDGET} max-w-md w-full mx-4 p-6`}>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 flex-shrink-0 rounded-full bg-terracotta-100 flex items-center justify-center">
            <AlertTriangle size={16} className="text-terracotta-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-base font-semibold text-forest-800">
              Nesaugoti pakeitimai
            </h3>
            <p className="text-sm text-forest-600 mt-1">
              Tavo pakeitimai bus prarasti. Ką darom?
            </p>
          </div>
          <button onClick={onCancel} className="text-forest-400 hover:text-forest-600">
            <X size={16} />
          </button>
        </div>
        <div className="mt-5 flex items-center gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="flex-1 px-3 py-2 rounded-btn text-sm font-medium text-forest-600 hover:bg-bone-200 disabled:opacity-40 transition-colors"
          >
            Atšaukti
          </button>
          <button
            onClick={onDiscard}
            disabled={saving}
            className="flex-1 px-3 py-2 rounded-btn text-sm font-medium text-terracotta-700 hover:bg-terracotta-50 disabled:opacity-40 transition-colors"
          >
            Atmesti
          </button>
          <button
            onClick={onSaveAndContinue}
            disabled={saving}
            className="flex-1 px-3 py-2 rounded-btn text-sm font-semibold bg-forest-700 hover:bg-forest-800 text-bone disabled:opacity-40 transition-colors"
          >
            {saving ? 'Saugoma…' : 'Saugoti'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Form atoms ────────────────────────────────────────────────────

function FormRow({ label, children, dirty, helper }) {
  return (
    <div className="space-y-1">
      <label className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-forest-500 block flex items-center gap-1.5">
        {label}
        {dirty && <span className="text-terracotta-600" title="Pakeista">●</span>}
      </label>
      {children}
      {helper && (
        <p className="text-[10px] text-forest-400">{helper}</p>
      )}
    </div>
  )
}

function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-bone-50 border border-bone-400/40 rounded-md px-2 py-1.5 text-sm text-forest-800 placeholder:text-forest-300 focus:outline-none focus:border-forest-500"
    />
  )
}

// ── Helpers ──────────────────────────────────────────────────────

function fieldDirty(current, original) {
  return JSON.stringify(current) !== JSON.stringify(original ?? '')
}

function defaultValueFor(_k) { return '' }

// Cultivar/series normalize'inimas — kopija iš LibraryTab.jsx v1, kad backup'as
// liktų self-contained. Per Etapus 3+ — papildysim su naujais field'ais
// (savybes, pavojai, sinonimai, infoConfidence, auginimas, etc).
function normalizeCultivar(c) {
  return {
    lotyniskas:         c.lotyniskas         ?? '',
    lietuviškas:        c.lietuviškas        ?? '',
    taxonGroupId:       c.taxonGroupId       ?? null,
    image:              c.image              ?? '',
    aprasymas:          c.aprasymas          ?? '',
    kilme:              c.kilme              ?? '',
    idomybes:           c.idomybes           ?? '',
    sviesa:             c.sviesa             ?? '',
    vanduo:             c.vanduo             ?? '',
    substratas:         c.substratas         ?? '',
    persodinimas:       c.persodinimas       ?? '',
    ziemojimas:         c.ziemojimas         ?? '',
    tresimas:           c.tresimas           ?? '',
    prieziura:          c.prieziura          ?? '',
    tipas:              c.tipas              ?? '',
    sunkumas:           c.sunkumas           ?? '',
    augimo_greitis:     c.augimo_greitis     ?? '',
    cultivationContext: c.cultivationContext ?? '',
    lifecycle:          c.lifecycle          ?? '',
    hardiness:          c.hardiness          ?? '',
    savybes:            c.savybes            ?? null,
    sinonimai:          c.sinonimai          ?? [],
    auginimas:          c.auginimas          ?? '',
    infoConfidence:     c.infoConfidence     ?? '',
  }
}

function normalizeTaxonGroup(g) {
  return {
    genus:     g.genus     ?? '',
    name:      g.name      ?? '',
    type:      g.type      ?? '',
    tipas:     g.tipas     ?? '',
    aprasymas: g.aprasymas ?? '',
    idomybes:  g.idomybes  ?? '',
    careInfo:  {
      sviesa:              g.careInfo?.sviesa              ?? null,
      vanduo:              g.careInfo?.vanduo              ?? null,
      laistymasIntervalas: g.careInfo?.laistymasIntervalas ?? null,
      tresimas:            g.careInfo?.tresimas            ?? null,
      prieziura:           g.careInfo?.prieziura           ?? null,
      substratas:          g.careInfo?.substratas          ?? '',
      persodinimas:        g.careInfo?.persodinimas        ?? '',
      ziemojimas:          g.careInfo?.ziemojimas          ?? '',
    },
  }
}
