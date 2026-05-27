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
  Save, RotateCcw, Trash2, AlertTriangle, X, CheckCircle2, Plus, Minus,
  Image as ImageIcon, Type, BookOpen, Droplet, Skull, Tag, Info,
} from 'lucide-react'
import { ProfileContent } from '../PlantDetail'
import PlantImage from '../brand/PlantImage'
import { fetchWikiPhoto } from '../../utils/wikiApi'
import { TAXON_GROUP_TYPES, CULTIVATION_CONTEXTS, LIFECYCLES } from '../../utils/taxonGroups'

const WIDGET = 'bg-bone-50 rounded-2xl border border-bone-400/40 shadow-[0_1px_3px_rgba(28,58,42,0.06),0_4px_14px_rgba(28,58,42,0.05)]'
const MIN_WIDTH_PX = 1280

// ── Filter definitions ─────────────────────────────────────────────
const FILTERS = [
  { id: 'all',        label: 'Visi'        },
  { id: 'modified',   label: 'Pakeisti'    },  // _batchEnrichedAt < 7d
  { id: 'standalone', label: 'Standalone' },
  { id: 'series',     label: 'Serijos'     },
]

// ── Schema enums (chip select'iams) ──────────────────────────────────
//
// Schema'os realios enum reikšmės yra schema'os pirmas language layer'is —
// silpnas/vidutinis/stiprus. UI label'ai = vartotojui draugiški terminai
// (dirgina/toksiškas/mirtinas — user spec'as 2026-05-25). Tooltip rodo
// abu — kad admin'as žinotų, kas iš tikrųjų rašoma DB.
const SEVERITY_OPTS = [
  { value: 'silpnas',   label: 'Dirgina',   help: 'Vietinis kontaktas — odos/burnos dirginimas, ne sisteminis. (schema: silpnas)' },
  { value: 'vidutinis', label: 'Toksiškas', help: 'Reikšminga žala — vėmimas, viduriavimas, paralys. (schema: vidutinis)' },
  { value: 'stiprus',   label: 'Mirtinas',  help: 'Net mažais kiekiais — mirtinai pavojinga. (schema: stiprus)' },
]
const TIPAS_OPTS = [
  { value: 'toksiskas',    label: 'Toksiška'    },
  { value: 'alergiskas',   label: 'Alergiška'   },
  { value: 'dirginantis',  label: 'Dirginanti'  },
]
const TARGET_OPTS = [
  { value: 'zmonems',  label: 'Žmonėms'  },
  { value: 'gyvunams', label: 'Gyvūnams' },
]
const SUNKUMAS_OPTS = [
  { value: 1, label: '1 · labai lengvas' },
  { value: 2, label: '2 · lengvas' },
  { value: 3, label: '3 · vidutinis' },
  { value: 4, label: '4 · iššūkis' },
  { value: 5, label: '5 · tik patyrusiems' },
]
const AUGINIMAS_OPTS = [
  { value: 'kambarinis', label: 'Kambarinis' },
  { value: 'sodo',       label: 'Sodo'       },
  { value: 'laukinis',   label: 'Laukinis'   },
]
const INFO_CONFIDENCE_OPTS = [
  { value: 'aukstas',   label: 'Aukštas'   },
  { value: 'vidutinis', label: 'Vidutinis' },
  { value: 'zemas',     label: 'Žemas'     },
]
const AUGIMO_GREITIS_OPTS = [
  { value: 'lėtas',     label: 'Lėtas'     },
  { value: 'vidutinis', label: 'Vidutinis' },
  { value: 'greitas',   label: 'Greitas'   },
]

// ── Tab definitions ──────────────────────────────────────────────────
//
// Tab'ai matomi center pane'o viršuje. Cultivar'as turi pilną 7-tab'ų rinkinį,
// Series — sutrumpintą (be Foto/Toksiškumas/Klasifikacija — netaikoma).
const CULTIVAR_TABS = [
  { id: 'identification', label: 'Identifikacija', Icon: Type        },
  { id: 'photo',          label: 'Foto',            Icon: ImageIcon   },
  { id: 'descriptions',   label: 'Aprašymai',       Icon: BookOpen    },
  { id: 'care',           label: 'Priežiūra',       Icon: Droplet     },
  { id: 'toxicity',       label: 'Toksiškumas',     Icon: Skull       },
  { id: 'classification', label: 'Klasifikacija',   Icon: Tag         },
  { id: 'meta',           label: 'Meta',            Icon: Info        },
]
const SERIES_TABS = [
  { id: 'identification', label: 'Identifikacija', Icon: Type     },
  { id: 'descriptions',   label: 'Aprašymai',       Icon: BookOpen },
  { id: 'care',           label: 'Care šablonas',   Icon: Droplet  },
  { id: 'meta',           label: 'Meta',            Icon: Info     },
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

  // ── Active tab (per entry — reset'inamas kai keisis entry)
  const [activeTab, setActiveTab] = useState('identification')

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
    setActiveTab('identification')  // reset tab kai keičiam entry
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

  // ── Update draft field — path-aware (supports nested keys).
  //
  // path = string ('lotyniskas') ARBA nested ('savybes.pavojingumas.lygis').
  // value = naujas value (any type — string, array, object, null).
  // Object'us klonuojam (structuredClone) kad React detect'intų ref pakeitimą
  // ir re-render'intų reliable. Performance OK — draft'as 30-50 field'ų,
  // structuredClone'as ~0.1ms.
  const updateField = useCallback((path, value) => {
    setDraft(d => {
      if (!d) return d
      if (!path.includes('.')) return { ...d, [path]: value }
      const keys = path.split('.')
      const next = structuredClone(d)
      let cur = next
      for (let i = 0; i < keys.length - 1; i++) {
        if (cur[keys[i]] == null || typeof cur[keys[i]] !== 'object') {
          cur[keys[i]] = {}
        }
        cur = cur[keys[i]]
      }
      cur[keys[keys.length - 1]] = value
      return next
    })
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

  // ── Image-only save (single-field auto-save, bypass'as dirty kitiems)
  //
  // Naudojama Foto tab'e: nuotraukos picker'is arba „Saugoti tik nuotrauką"
  // mini-button. Patch'as turi TIK image lauką → kiti draft pakeitimai
  // nepaliečiami. originalDraft.image atnaujinamas, kad image nebebūtų dirty.
  const handleSaveImageOnly = useCallback(async (newUrl) => {
    if (!selectedEntry || selectedType !== 'cultivar') return
    setSaving(true)
    setSaveError(null)
    try {
      await onSaveCatalog(selectedEntry.id, { image: newUrl })
      // Atnaujinam abu — image tampa nauju baseline'u, kiti laukai nepaliečiami
      setDraft(d => d ? { ...d, image: newUrl } : d)
      setOriginalDraft(o => o ? { ...o, image: newUrl } : o)
      setSavedToast(true)
      setTimeout(() => setSavedToast(false), 2000)
    } catch (e) {
      setSaveError(e?.message ?? 'Nepavyko išsaugoti nuotraukos')
    } finally {
      setSaving(false)
    }
  }, [selectedEntry, selectedType, onSaveCatalog])

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
        onSaveImageOnly={handleSaveImageOnly}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        taxonGroups={taxonGroups}
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
  onSave, onDiscard, onDelete, onSaveImageOnly,
  activeTab, setActiveTab,
  taxonGroups,
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

  // Count dirty fields for save button label (top-level diff'as).
  // NESTED field'ai (savybes.pavojai[], careInfo.*) skaičiuojami kaip 1 dirty
  // jei subtree pakeistas — kad chip badge neblendintų.
  const dirtyCount = useMemo(() => {
    if (!dirty || !originalDraft) return 0
    let n = 0
    for (const k of Object.keys(draft)) {
      if (JSON.stringify(draft[k]) !== JSON.stringify(originalDraft[k] ?? defaultValueFor(k))) n++
    }
    return n
  }, [draft, originalDraft, dirty])

  // Per-tab dirty count — UI tab indicator'iui (rodome dot'ą prie tab'o jei
  // jame yra pakeistų field'ų).
  const tabDirtyMap = useMemo(() => {
    if (!dirty || !originalDraft) return {}
    return buildTabDirtyMap(draft, originalDraft, entryType)
  }, [draft, originalDraft, dirty, entryType])

  const tabs = entryType === 'series' ? SERIES_TABS : CULTIVAR_TABS
  const activeTabExists = tabs.some(t => t.id === activeTab)
  const effectiveActiveTab = activeTabExists ? activeTab : tabs[0].id

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

        {/* Tab navigation */}
        <div className="px-3 pb-0 flex items-center gap-0.5 overflow-x-auto">
          {tabs.map(t => (
            <TabButton
              key={t.id}
              tab={t}
              active={effectiveActiveTab === t.id}
              dirty={tabDirtyMap[t.id]}
              onClick={() => setActiveTab(t.id)}
            />
          ))}
        </div>
      </div>

      {/* Tab content body */}
      <div className="flex-1 overflow-y-auto p-5">
        <TabContent
          tabId={effectiveActiveTab}
          entry={entry}
          entryType={entryType}
          draft={draft}
          originalDraft={originalDraft}
          updateField={updateField}
          taxonGroups={taxonGroups}
          onSaveImageOnly={onSaveImageOnly}
        />
      </div>

      {/* Danger zone */}
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

function TabButton({ tab, active, dirty, onClick }) {
  const { Icon } = tab
  return (
    <button
      onClick={onClick}
      className={`relative flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.12em] font-mono transition-colors border-b-2 ${
        active
          ? 'text-forest-800 border-forest-700'
          : 'text-forest-500 border-transparent hover:text-forest-700 hover:bg-bone-100/60'
      }`}
    >
      <Icon size={11} />
      {tab.label}
      {dirty && (
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-terracotta-500" title="Pakeista" />
      )}
    </button>
  )
}

// ── Tab content dispatcher ───────────────────────────────────────────

function TabContent({ tabId, entry, entryType, draft, originalDraft, updateField, taxonGroups, onSaveImageOnly }) {
  const props = { entry, entryType, draft, originalDraft, updateField, taxonGroups, onSaveImageOnly }
  if (entryType === 'series') {
    switch (tabId) {
      case 'identification': return <TabIdentificationSeries {...props} />
      case 'descriptions':   return <TabDescriptionsSeries {...props} />
      case 'care':           return <TabCareSeries {...props} />
      case 'meta':           return <TabMeta {...props} />
      default:               return null
    }
  }
  switch (tabId) {
    case 'identification': return <TabIdentificationCultivar {...props} />
    case 'photo':          return <TabPhoto {...props} />
    case 'descriptions':   return <TabDescriptionsCultivar {...props} />
    case 'care':           return <TabCareCultivar {...props} />
    case 'toxicity':       return <TabToxicity {...props} />
    case 'classification': return <TabClassification {...props} />
    case 'meta':           return <TabMeta {...props} />
    default:               return null
  }
}

// ── Tab: Identifikacija (cultivar) ───────────────────────────────────

function TabIdentificationCultivar({ entry, draft, originalDraft, updateField, taxonGroups }) {
  return (
    <div className="space-y-4 max-w-2xl">
      <FormRow label="Lotyniškas" dirty={fieldDirty(draft.lotyniskas, originalDraft?.lotyniskas)} helper={`Genus + species (pvz. „Kalanchoe blossfeldiana"). Cultivar: „Sansevieria trifasciata 'Laurentii'".`}>
        <TextInput value={draft.lotyniskas ?? ''} onChange={v => updateField('lotyniskas', v)} placeholder="Kalanchoe blossfeldiana" />
      </FormRow>
      <FormRow label="Lietuviškas" dirty={fieldDirty(draft.lietuviškas, originalDraft?.lietuviškas)}>
        <TextInput value={draft.lietuviškas ?? ''} onChange={v => updateField('lietuviškas', v)} placeholder="Kalankė" />
      </FormRow>
      <FormRow label="Lietuviški sinonimai" dirty={fieldDirty(draft.sinonimai, originalDraft?.sinonimai)} helper="Vienas po kito — Enter pridėti. Naudojami paieškoje (alternative names).">
        <StringArrayChips value={draft.sinonimai ?? []} onChange={v => updateField('sinonimai', v)} placeholder="pvz. Madagaskaro kalankė" />
      </FormRow>
      <FormRow label="Serija (taxonGroup)" dirty={fieldDirty(draft.taxonGroupId, originalDraft?.taxonGroupId)} helper="Jei priklauso serijai — paveldės jos care šabloną.">
        <select
          value={draft.taxonGroupId ?? ''}
          onChange={e => updateField('taxonGroupId', e.target.value || null)}
          className="w-full bg-bone-50 border border-bone-400/40 rounded-md px-2 py-1.5 text-xs text-forest-700 focus:outline-none focus:border-forest-500"
        >
          <option value="">— standalone (be serijos) —</option>
          {taxonGroups.map(g => (
            <option key={g.id} value={g.id}>{g.genus} {g.name} ({g.type})</option>
          ))}
        </select>
      </FormRow>
      <FormRow label="Auginimo kontekstas" dirty={fieldDirty(draft.auginimas, originalDraft?.auginimas)} helper="Kur šis augalas dažniausiai auga Lietuvoje.">
        <ChipSelect value={draft.auginimas} onChange={v => updateField('auginimas', v)} options={AUGINIMAS_OPTS} allowEmpty />
      </FormRow>
      <FormRow label="Info confidence" dirty={fieldDirty(draft.infoConfidence, originalDraft?.infoConfidence)} helper="Kiek šios kortelės info'ai patikima — kalibracija PFAF/ASPCA atveju.">
        <ChipSelect value={draft.infoConfidence} onChange={v => updateField('infoConfidence', v)} options={INFO_CONFIDENCE_OPTS} allowEmpty />
      </FormRow>
      <div className="text-[10px] text-forest-400 font-mono pt-2 border-t border-bone-400/30">
        ID: <span className="text-forest-500">{entry.id}</span>
      </div>
    </div>
  )
}

// ── Tab: Identifikacija (series) ─────────────────────────────────────

function TabIdentificationSeries({ entry, draft, originalDraft, updateField }) {
  return (
    <div className="space-y-4 max-w-2xl">
      <FormRow label="Genus" dirty={fieldDirty(draft.genus, originalDraft?.genus)}>
        <TextInput value={draft.genus ?? ''} onChange={v => updateField('genus', v)} placeholder="Sansevieria" />
      </FormRow>
      <FormRow label="Pavadinimas" dirty={fieldDirty(draft.name, originalDraft?.name)} helper="Serijos vidinis pavadinimas — paprastai species ar cultivar grupė.">
        <TextInput value={draft.name ?? ''} onChange={v => updateField('name', v)} placeholder="trifasciata" />
      </FormRow>
      <FormRow label="Tipas" dirty={fieldDirty(draft.type, originalDraft?.type)} helper="Taksonominis lygis.">
        <Select value={draft.type ?? ''} onChange={v => updateField('type', v)} options={['', ...TAXON_GROUP_TYPES]} />
      </FormRow>
      <FormRow label="Tipas (laisva forma)" dirty={fieldDirty(draft.tipas, originalDraft?.tipas)} helper="LT-friendly augalo tipas (kambarinis, sodinis, etc.).">
        <TextInput value={draft.tipas ?? ''} onChange={v => updateField('tipas', v)} placeholder="kambarinis" />
      </FormRow>
      <div className="text-[10px] text-forest-400 font-mono pt-2 border-t border-bone-400/30">
        ID: <span className="text-forest-500">{entry.id}</span>
      </div>
    </div>
  )
}

// ── Tab: Foto — image picker + URL paste ────────────────────────────
//
// 2 būdai keisti nuotrauką:
//   1. „🔍 Ieškoti nuotraukos" — fetch'ina Wiki EN/LT + iNat candidates,
//      rodo grid'ą su thumbnail'ais. Click → URL set + AUTO-SAVE.
//   2. Rankinis URL paste — keičia draft.image, „💾 Saugoti nuotrauką"
//      mini-button save'ina TIK image field'ą (be kitų dirty laukų).
//
// AUTO-SAVE: image picker'is bypass'ina standard'inį save flow'ą — vienas
// klick → image įrašytas Firestore'e. Greita, intuityvu, draftas neturi
// likti dirty.

function TabPhoto({ draft, originalDraft, updateField, onSaveImageOnly }) {
  const dirtyImg = fieldDirty(draft.image, originalDraft?.image)
  const latin = draft.lotyniskas ?? ''

  const [searching, setSearching] = useState(false)
  const [candidates, setCandidates] = useState(null)  // null = nepradėjom, []=nieko
  const [searchError, setSearchError] = useState(null)

  const handleSearch = useCallback(async () => {
    if (!latin.trim()) {
      setSearchError('Pirmiausia nustatyk lotynišką pavadinimą.')
      return
    }
    setSearching(true)
    setSearchError(null)
    setCandidates(null)
    try {
      const results = await fetchImageCandidates(latin)
      setCandidates(results)
      if (results.length === 0) {
        setSearchError(`Nieko nerasta „${latin}" pavadinimui (Wiki + iNat). Pabandyk genus tik (pvz. ${latin.split(' ')[0]}).`)
      }
    } catch (e) {
      setSearchError(`Paieška nepavyko: ${e.message}`)
    } finally {
      setSearching(false)
    }
  }, [latin])

  const handlePickCandidate = useCallback(async (url) => {
    // Auto-save: keičiam draft + tuoj pat Firestore'e
    updateField('image', url)
    if (onSaveImageOnly) await onSaveImageOnly(url)
    setCandidates(null)  // collapse picker po pasirinkimo
  }, [updateField, onSaveImageOnly])

  const handleManualSave = useCallback(async () => {
    if (!onSaveImageOnly) return
    await onSaveImageOnly(draft.image ?? null)
  }, [onSaveImageOnly, draft.image])

  return (
    <div className="space-y-4 max-w-3xl">
      {/* URL input + search button */}
      <FormRow
        label="Image URL"
        dirty={dirtyImg}
        helper="Wiki Commons (upload.wikimedia.org) ar iNaturalist (static.inaturalist.org / inaturalist-open-data.s3.amazonaws.com). Catalog freeze: pirmas save'as nustato, vėlesni išlieka."
      >
        <div className="flex gap-1.5">
          <div className="flex-1">
            <TextInput
              value={draft.image ?? ''}
              onChange={v => updateField('image', v)}
              placeholder="https://upload.wikimedia.org/..."
            />
          </div>
          {dirtyImg && (
            <button
              onClick={handleManualSave}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-forest-700 hover:bg-forest-800 text-bone transition-colors flex-shrink-0"
              title="Išsaugoti TIK šio lauko pakeitimą (kiti dirty laukai nepaliečiami)"
            >
              <Save size={11} /> Saugoti
            </button>
          )}
        </div>
      </FormRow>

      {/* Search button */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleSearch}
          disabled={searching || !latin.trim()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-btn-sm text-xs font-semibold bg-forest-100 hover:bg-forest-200 text-forest-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Search size={12} />
          {searching ? 'Ieškau…' : `🔍 Ieškoti nuotraukos${latin ? ` „${latin}"` : ''}`}
        </button>
        {candidates !== null && !searching && (
          <button
            onClick={() => setCandidates(null)}
            className="text-[11px] text-forest-500 hover:text-forest-700"
          >
            Uždaryti rezultatus
          </button>
        )}
      </div>

      {searchError && (
        <div className="px-3 py-2 bg-amber-50 border border-amber-200/60 rounded-md text-[11px] text-amber-800 flex items-start gap-2">
          <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
          <span>{searchError}</span>
        </div>
      )}

      {/* Candidates grid */}
      {candidates !== null && candidates.length > 0 && (
        <div>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-forest-500 mb-2">
            {candidates.length} kandidatų — paspaudus įrašysiu iškart
          </p>
          <div className="grid grid-cols-3 gap-2">
            {candidates.map((c, idx) => (
              <CandidateCard
                key={idx}
                candidate={c}
                selected={c.url === draft.image}
                onPick={() => handlePickCandidate(c.url)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Current image large preview */}
      {draft.image ? (
        <div className="space-y-1.5">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-forest-500">Dabar pasirinktas</p>
          <div className="bg-bone-200 rounded-lg overflow-hidden border border-bone-400/40 max-w-md">
            <img src={draft.image} alt="" className="w-full max-h-80 object-contain" />
          </div>
          <p className="text-[10px] text-forest-400 font-mono break-all">{draft.image}</p>
        </div>
      ) : (
        <div className="text-center py-12 px-6 bg-bone-100 rounded-lg border border-dashed border-bone-400/60">
          <ImageOff size={24} className="text-forest-300 mx-auto mb-2" />
          <p className="text-xs text-forest-500">Nuotraukos URL'as nenurodytas.</p>
          <p className="text-[10px] text-forest-400 mt-1">
            Paspausk „Ieškoti nuotraukos" — automatiškai pasiūlysiu iš Wiki/iNat.
          </p>
        </div>
      )}
    </div>
  )
}

function CandidateCard({ candidate, selected, onPick }) {
  const [error, setError] = useState(false)
  return (
    <button
      onClick={onPick}
      className={`relative group rounded-lg overflow-hidden border-2 transition-all ${
        selected
          ? 'border-forest-600 ring-2 ring-forest-200'
          : 'border-bone-400/40 hover:border-forest-400'
      }`}
    >
      <div className="aspect-square bg-bone-200 overflow-hidden">
        {error ? (
          <div className="w-full h-full flex items-center justify-center text-3xl">🌿</div>
        ) : (
          <img
            src={candidate.url}
            alt=""
            loading="lazy"
            onError={() => setError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        )}
      </div>
      <div className="px-2 py-1 bg-bone-50/95 border-t border-bone-400/40">
        <p className="font-mono text-[9px] font-medium uppercase tracking-[0.1em] text-forest-700 truncate">
          {candidate.source}
        </p>
        <p className="text-[9px] text-forest-500 italic truncate leading-tight">
          {candidate.label}
        </p>
      </div>
      {selected && (
        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-forest-600 flex items-center justify-center">
          <CheckCircle2 size={11} className="text-bone" />
        </div>
      )}
    </button>
  )
}

// ── Image candidates fetcher (Wiki EN/LT + iNat parallel) ───────────
//
// Naudoja egzistuojantį fetchWikiPhoto (browser-safe per origin=*) ir
// iNat taxa API (CORS-safe). Visi parallel — total ~500-1500ms.
// Dedupe by URL.
async function fetchImageCandidates(latinName) {
  if (!latinName) return []
  const genus = latinName.split(/\s+/)[0]
  const wantsGenus = genus && genus !== latinName

  const [wikiEnSpec, wikiLt, wikiEnGenus, inatRes] = await Promise.all([
    fetchWikiPhoto(latinName, 'en', { thumbSize: 600 }).catch(() => null),
    fetchWikiPhoto(latinName, 'lt', { thumbSize: 600 }).catch(() => null),
    wantsGenus
      ? fetchWikiPhoto(genus, 'en', { thumbSize: 600 }).catch(() => null)
      : Promise.resolve(null),
    fetch(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(latinName)}&rank=species,genus&limit=6`, {
      headers: { Accept: 'application/json' },
    })
      .then(r => r.ok ? r.json() : null)
      .catch(() => null),
  ])

  const results = []
  const seen = new Set()
  const tryAdd = (url, source, label) => {
    if (!url || seen.has(url)) return
    seen.add(url)
    results.push({ url, source, label })
  }

  if (wikiEnSpec?.found) tryAdd(wikiEnSpec.url, 'Wiki EN', latinName)
  if (wikiLt?.found) tryAdd(wikiLt.url, 'Wiki LT', latinName)
  if (wikiEnGenus?.found) tryAdd(wikiEnGenus.url, 'Wiki EN (genus)', genus)

  if (inatRes?.results) {
    const plants = inatRes.results.filter(t => t.iconic_taxon_name === 'Plantae')
    for (const t of plants.slice(0, 4)) {
      if (t.default_photo?.medium_url) {
        tryAdd(t.default_photo.medium_url, 'iNat', `${t.name} (${t.rank})`)
      }
    }
  }

  return results
}

// ── Tab: Aprašymai (cultivar) ────────────────────────────────────────

function TabDescriptionsCultivar({ entry, draft, originalDraft, updateField }) {
  return (
    <div className="space-y-4 max-w-3xl">
      <FormRow label="Aprašymas" dirty={fieldDirty(draft.aprasymas, originalDraft?.aprasymas)} helper={`„Sodininkas friend" stilius — LT vartotojui draugiškas tekstas.`}>
        <TextArea value={draft.aprasymas} onChange={v => updateField('aprasymas', v)} rows={5} />
      </FormRow>
      <FormRow label="Kilmė" dirty={fieldDirty(draft.kilme, originalDraft?.kilme)} helper="Iš kur augalas — geografinė kilmė + buveinė.">
        <TextInput value={draft.kilme ?? ''} onChange={v => updateField('kilme', v)} placeholder="Madagaskaras (atogrąžų pievos)" />
      </FormRow>
      <FormRow label="Įdomybės" dirty={fieldDirty(draft.idomybes, originalDraft?.idomybes)} helper="3-7 įdomių faktų — kiekvienas atskira eilutė. Naudojami plant detail screen'e.">
        <TextArea value={draft.idomybes} onChange={v => updateField('idomybes', v)} rows={5} placeholder={'Faktas 1\nFaktas 2\nFaktas 3'} />
      </FormRow>
      <ProvenanceBadge entry={entry} />
    </div>
  )
}

function TabDescriptionsSeries({ draft, originalDraft, updateField }) {
  return (
    <div className="space-y-4 max-w-3xl">
      <FormRow label="Aprašymas" dirty={fieldDirty(draft.aprasymas, originalDraft?.aprasymas)}>
        <TextArea value={draft.aprasymas} onChange={v => updateField('aprasymas', v)} rows={5} />
      </FormRow>
      <FormRow label="Įdomybės" dirty={fieldDirty(draft.idomybes, originalDraft?.idomybes)}>
        <TextArea value={draft.idomybes} onChange={v => updateField('idomybes', v)} rows={4} />
      </FormRow>
    </div>
  )
}

// ── Tab: Priežiūra (cultivar — flat fields) ─────────────────────────

function TabCareCultivar({ draft, originalDraft, updateField }) {
  return (
    <div className="space-y-4 max-w-3xl">
      <FormRow label="Šviesa" dirty={fieldDirty(draft.sviesa, originalDraft?.sviesa)}>
        <TextArea value={draft.sviesa} onChange={v => updateField('sviesa', v)} rows={2} placeholder="Ryški netiesioginė, 2-4h tiesioginės ryto saulės" />
      </FormRow>
      <FormRow label="Vanduo" dirty={fieldDirty(draft.vanduo, originalDraft?.vanduo)}>
        <TextArea value={draft.vanduo} onChange={v => updateField('vanduo', v)} rows={2} placeholder="Vidutiniai poreikiai — kas 7d vasarą, kas 14d žiemą" />
      </FormRow>
      <FormRow label="Substratas" dirty={fieldDirty(draft.substratas, originalDraft?.substratas)}>
        <TextArea value={draft.substratas} onChange={v => updateField('substratas', v)} rows={2} />
      </FormRow>
      <FormRow label="Persodinimas" dirty={fieldDirty(draft.persodinimas, originalDraft?.persodinimas)}>
        <TextArea value={draft.persodinimas} onChange={v => updateField('persodinimas', v)} rows={2} />
      </FormRow>
      <FormRow label="Žiemojimas" dirty={fieldDirty(draft.ziemojimas, originalDraft?.ziemojimas)}>
        <TextArea value={draft.ziemojimas} onChange={v => updateField('ziemojimas', v)} rows={2} />
      </FormRow>
      <FormRow label="Tręšimas" dirty={fieldDirty(draft.tresimas, originalDraft?.tresimas)}>
        <TextArea value={draft.tresimas} onChange={v => updateField('tresimas', v)} rows={2} />
      </FormRow>
      <FormRow label="Priežiūra (kita)" dirty={fieldDirty(draft.prieziura, originalDraft?.prieziura)}>
        <TextArea value={draft.prieziura} onChange={v => updateField('prieziura', v)} rows={2} />
      </FormRow>
    </div>
  )
}

// ── Tab: Care šablonas (series — structured careInfo.*) ─────────────

function TabCareSeries({ draft, originalDraft, updateField }) {
  return (
    <div className="space-y-4 max-w-3xl">
      <div className="text-[11px] text-forest-500 bg-bone-100 px-3 py-2 rounded-md border border-bone-400/40">
        <strong>Care šablonas</strong> — paveldimas visiems serijos cultivar'ams per <code className="font-mono">mergeWithSeries()</code>. Object'iniai laukai (sviesa, vanduo, ...) edit'inami kaip JSON. Structured editor'iai — sekantis etapas.
      </div>
      <FormRow label="Šviesa (object)" dirty={fieldDirty(draft.careInfo?.sviesa, originalDraft?.careInfo?.sviesa)}>
        <JsonField value={draft.careInfo?.sviesa} onChange={v => updateField('careInfo.sviesa', v)} />
      </FormRow>
      <FormRow label="Vanduo (object)" dirty={fieldDirty(draft.careInfo?.vanduo, originalDraft?.careInfo?.vanduo)}>
        <JsonField value={draft.careInfo?.vanduo} onChange={v => updateField('careInfo.vanduo', v)} />
      </FormRow>
      <FormRow label="Laistymo intervalas (object)" dirty={fieldDirty(draft.careInfo?.laistymasIntervalas, originalDraft?.careInfo?.laistymasIntervalas)}>
        <JsonField value={draft.careInfo?.laistymasIntervalas} onChange={v => updateField('careInfo.laistymasIntervalas', v)} />
      </FormRow>
      <FormRow label="Tręšimas (object)" dirty={fieldDirty(draft.careInfo?.tresimas, originalDraft?.careInfo?.tresimas)}>
        <JsonField value={draft.careInfo?.tresimas} onChange={v => updateField('careInfo.tresimas', v)} />
      </FormRow>
      <FormRow label="Priežiūra (object)" dirty={fieldDirty(draft.careInfo?.prieziura, originalDraft?.careInfo?.prieziura)}>
        <JsonField value={draft.careInfo?.prieziura} onChange={v => updateField('careInfo.prieziura', v)} />
      </FormRow>
      <FormRow label="Substratas (text)" dirty={fieldDirty(draft.careInfo?.substratas, originalDraft?.careInfo?.substratas)}>
        <TextArea value={draft.careInfo?.substratas} onChange={v => updateField('careInfo.substratas', v)} rows={2} />
      </FormRow>
      <FormRow label="Persodinimas (text)" dirty={fieldDirty(draft.careInfo?.persodinimas, originalDraft?.careInfo?.persodinimas)}>
        <TextArea value={draft.careInfo?.persodinimas} onChange={v => updateField('careInfo.persodinimas', v)} rows={2} />
      </FormRow>
      <FormRow label="Žiemojimas (text)" dirty={fieldDirty(draft.careInfo?.ziemojimas, originalDraft?.careInfo?.ziemojimas)}>
        <TextArea value={draft.careInfo?.ziemojimas} onChange={v => updateField('careInfo.ziemojimas', v)} rows={2} />
      </FormRow>
    </div>
  )
}

// ── Tab: Toksiškumas ────────────────────────────────────────────────

function TabToxicity({ entry, draft, originalDraft, updateField }) {
  const savybes = draft.savybes ?? {}
  const orig = originalDraft?.savybes ?? {}
  const pavojai = Array.isArray(savybes.pavojai) ? savybes.pavojai : []
  const pavojingumas = savybes.pavojingumas ?? { yra: false, lygis: null, detales: '' }

  // Update'as helper'is — savybes nested update'ams, kad mažiau verbose.
  const setSav = (subKey, value) => {
    const next = { ...(savybes ?? {}), [subKey]: value }
    updateField('savybes', next)
  }
  const setPavSub = (key, value) => {
    const nextPav = { ...pavojingumas, [key]: value }
    setSav('pavojingumas', nextPav)
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Pavojingumas summary card */}
      <div className="bg-bone-100 border border-bone-400/40 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-display text-sm font-semibold text-forest-800">Pavojingumas (badge)</h4>
          <ToggleSwitch
            checked={!!pavojingumas.yra}
            onChange={v => setPavSub('yra', v)}
            label={pavojingumas.yra ? 'Pavojingas' : 'Saugus'}
          />
        </div>
        {pavojingumas.yra && (
          <>
            <FormRow label="Lygis" dirty={fieldDirty(pavojingumas.lygis, orig?.pavojingumas?.lygis)}>
              <ChipSelect
                value={pavojingumas.lygis}
                onChange={v => setPavSub('lygis', v)}
                options={SEVERITY_OPTS}
              />
            </FormRow>
            <FormRow label="Detalės (narrative + URL)" dirty={fieldDirty(pavojingumas.detales, orig?.pavojingumas?.detales)} helper="LT proza. URL'us (ASPCA, PFAF, Pet Poison) auto-link'ina renderWithLinks().">
              <TextArea value={pavojingumas.detales} onChange={v => setPavSub('detales', v)} rows={6} />
            </FormRow>
          </>
        )}
      </div>

      {/* Pavojai[] row editor */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-display text-sm font-semibold text-forest-800">
            Pavojai (struktūrizuoti)
            {fieldDirty(pavojai, orig?.pavojai) && <span className="ml-2 text-terracotta-600 text-xs">●</span>}
          </h4>
          <button
            onClick={() => setSav('pavojai', [...pavojai, { tipas: 'toksiskas', target: 'zmonems', severity: 'vidutinis', detales: '' }])}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-btn-sm text-[11px] font-medium bg-forest-100 text-forest-700 hover:bg-forest-200 transition-colors"
          >
            <Plus size={11} /> Pridėti
          </button>
        </div>
        {pavojai.length === 0 ? (
          <p className="text-xs text-forest-400 italic py-3 text-center bg-bone-100 rounded-md border border-dashed border-bone-400/40">
            Nėra struktūrizuotų pavojų. Pridėk įrašą, jei žinomas toksiškumas.
          </p>
        ) : (
          <ul className="space-y-2">
            {pavojai.map((p, idx) => (
              <PavojaiRow
                key={idx}
                pavojus={p}
                onChange={(next) => {
                  const arr = [...pavojai]
                  arr[idx] = next
                  setSav('pavojai', arr)
                }}
                onDelete={() => {
                  const arr = pavojai.filter((_, i) => i !== idx)
                  setSav('pavojai', arr)
                }}
              />
            ))}
          </ul>
        )}
      </div>

      {/* aiSupplementaryHazard read-only display */}
      {savybes.aiSupplementaryHazard && (
        <div className="bg-amber-50/60 border border-amber-200/60 rounded-lg p-3">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-amber-700 mb-1">
            AI supplementary hazard (auditoriaus pridėtas gap-fill)
          </p>
          <pre className="text-[10px] font-mono text-forest-700 whitespace-pre-wrap">
            {JSON.stringify(savybes.aiSupplementaryHazard, null, 2)}
          </pre>
        </div>
      )}
      <ProvenanceBadge entry={entry} />
    </div>
  )
}

function PavojaiRow({ pavojus, onChange, onDelete }) {
  return (
    <li className="bg-bone-50 border border-bone-400/40 rounded-md p-3 space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="font-mono text-[9px] uppercase tracking-[0.12em] text-forest-500 block mb-1">Tipas</label>
          <Select
            value={pavojus.tipas ?? ''}
            onChange={v => onChange({ ...pavojus, tipas: v })}
            options={['', ...TIPAS_OPTS.map(o => o.value)]}
            optionLabels={Object.fromEntries(TIPAS_OPTS.map(o => [o.value, o.label]))}
          />
        </div>
        <div>
          <label className="font-mono text-[9px] uppercase tracking-[0.12em] text-forest-500 block mb-1">Target</label>
          <Select
            value={pavojus.target ?? ''}
            onChange={v => onChange({ ...pavojus, target: v })}
            options={['', ...TARGET_OPTS.map(o => o.value)]}
            optionLabels={Object.fromEntries(TARGET_OPTS.map(o => [o.value, o.label]))}
          />
        </div>
        <div>
          <label className="font-mono text-[9px] uppercase tracking-[0.12em] text-forest-500 block mb-1">Severity</label>
          <Select
            value={pavojus.severity ?? ''}
            onChange={v => onChange({ ...pavojus, severity: v })}
            options={['', ...SEVERITY_OPTS.map(o => o.value)]}
            optionLabels={Object.fromEntries(SEVERITY_OPTS.map(o => [o.value, o.label]))}
          />
        </div>
      </div>
      <div>
        <label className="font-mono text-[9px] uppercase tracking-[0.12em] text-forest-500 block mb-1">Detalės</label>
        <TextInput value={pavojus.detales ?? ''} onChange={v => onChange({ ...pavojus, detales: v })} placeholder="pvz. ASPCA: katėms, šunims" />
      </div>
      <div className="flex justify-end">
        <button
          onClick={onDelete}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-btn-sm text-[10px] font-medium text-terracotta-600 hover:bg-terracotta-50"
        >
          <Minus size={10} /> Šalinti
        </button>
      </div>
    </li>
  )
}

// ── Tab: Klasifikacija ──────────────────────────────────────────────

function TabClassification({ draft, originalDraft, updateField }) {
  return (
    <div className="space-y-4 max-w-2xl">
      <FormRow label="Tipas (laisva forma)" dirty={fieldDirty(draft.tipas, originalDraft?.tipas)} helper={`LT-friendly tipas — pvz. „Sultingas", „Tropinis daugiametis".`}>
        <TextInput value={draft.tipas ?? ''} onChange={v => updateField('tipas', v)} />
      </FormRow>
      <FormRow label="Sunkumas" dirty={fieldDirty(draft.sunkumas, originalDraft?.sunkumas)} helper="Schema: integer 1-5. UI rodo 1=labai lengvas → 5=tik patyrusiems.">
        <ChipSelect value={draft.sunkumas} onChange={v => updateField('sunkumas', v)} options={SUNKUMAS_OPTS} allowEmpty />
      </FormRow>
      <FormRow label="Augimo greitis" dirty={fieldDirty(draft.augimo_greitis, originalDraft?.augimo_greitis)}>
        <ChipSelect value={draft.augimo_greitis} onChange={v => updateField('augimo_greitis', v)} options={AUGIMO_GREITIS_OPTS} allowEmpty />
      </FormRow>
      <FormRow label="Kontekstas (cultivation)" dirty={fieldDirty(draft.cultivationContext, originalDraft?.cultivationContext)}>
        <Select value={draft.cultivationContext ?? ''} onChange={v => updateField('cultivationContext', v)} options={['', ...CULTIVATION_CONTEXTS]} />
      </FormRow>
      <FormRow label="Lifecycle" dirty={fieldDirty(draft.lifecycle, originalDraft?.lifecycle)}>
        <Select value={draft.lifecycle ?? ''} onChange={v => updateField('lifecycle', v)} options={['', ...LIFECYCLES]} />
      </FormRow>
      <FormRow label="Hardiness" dirty={fieldDirty(draft.hardiness, originalDraft?.hardiness)} helper={`USDA zona arba °C ribos. Pvz. „USDA 9-11, -1°C".`}>
        <TextInput value={draft.hardiness ?? ''} onChange={v => updateField('hardiness', v)} placeholder="USDA 9-11, -1°C" />
      </FormRow>
    </div>
  )
}

// ── Tab: Meta (read-only) ───────────────────────────────────────────

function TabMeta({ entry, entryType, draft }) {
  // Meta tab'as rodo Firestore metadata + batch provenance — read-only,
  // skirta admin'ui suprasti, iš kur atėjo duomenys.
  return (
    <div className="space-y-3 max-w-xl">
      <MetaRow k="ID" v={entry.id} mono />
      <MetaRow k="Tipas" v={entryType} />
      <MetaRow k="Atnaujinta" v={shortDate(entry.updatedAt)} />
      {entry._batchSource && (
        <>
          <MetaRow k="Batch source" v={entry._batchSource} mono />
          <MetaRow k="Batch enriched" v={shortDate(entry._batchEnrichedAt)} />
        </>
      )}
      {entry.taxonGroupId && (
        <MetaRow k="Serija (taxonGroupId)" v={entry.taxonGroupId} mono />
      )}
      <details className="pt-3 border-t border-bone-400/30">
        <summary className="cursor-pointer font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-forest-500 mb-2">
          Pilnas draft JSON (debug)
        </summary>
        <pre className="text-[10px] text-forest-500 font-mono bg-bone-100 p-3 rounded overflow-auto max-h-[50vh]">
          {JSON.stringify(draft, null, 2)}
        </pre>
      </details>
    </div>
  )
}

function MetaRow({ k, v, mono }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs border-b border-bone-400/20 py-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-forest-400">{k}</span>
      <span className={`text-forest-700 text-right max-w-[60%] truncate ${mono ? 'font-mono text-[11px]' : ''}`}>{v ?? '—'}</span>
    </div>
  )
}

function shortDate(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('lt-LT', { year: 'numeric', month: 'short', day: 'numeric' }) }
  catch { return '—' }
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

  // Identiškas user view — hero photo (aspect-3/2 kaip PlantDetail'yje) +
  // ProfileContent. Skip'inam top bar (status/zone — admin'ui nereikalingi)
  // ir TabBar (admin mato tik Profile content'ą).
  const heroPhoto = debouncedDraft?.image ?? entry.image
  return (
    <div className={`${WIDGET} flex flex-col h-full overflow-hidden`}>
      <PreviewBadge />
      <div className="flex-1 overflow-y-auto relative">
        <div className="pointer-events-none">
          {/* Hero photo — aspect-3/2 kaip PlantDetail.jsx (line 1781) */}
          <div className="w-full bg-bone-300" style={{ aspectRatio: '3 / 2' }}>
            {heroPhoto ? (
              <PlantImage
                url={heroPhoto}
                alt={mergedPlant.lietuviškas || mergedPlant.lotyniskas}
                size="detail"
                eager
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-7xl">
                🌿
              </div>
            )}
          </div>
          {/* ProfileContent body */}
          <ProfileContent
            plant={mergedPlant}
            section={null}
            onAction={() => {}}
            onClose={() => {}}
            collectionId={null}
            onTogglePassport={null}
            onUpdateNames={null}
            onRefreshFromAI={null}
            className="px-4 pt-4 pb-8 space-y-5"
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

function TextArea({ value, onChange, rows = 3, placeholder }) {
  // Defensive — array → newline-separated, object → JSON, string → as is.
  // Mirror'as su v1, kad legacy data nesujauktų editor'iaus.
  let displayValue = ''
  if (Array.isArray(value)) {
    displayValue = value.map(v => typeof v === 'string' ? v : JSON.stringify(v)).join('\n')
  } else if (typeof value === 'object' && value !== null) {
    displayValue = JSON.stringify(value, null, 2)
  } else if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          displayValue = parsed.map(v => typeof v === 'string' ? v : JSON.stringify(v)).join('\n')
        } else {
          displayValue = value
        }
      } catch { displayValue = value }
    } else {
      displayValue = value
    }
  }
  return (
    <textarea
      value={displayValue}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full bg-bone-50 border border-bone-400/40 rounded-md px-2 py-1.5 text-xs text-forest-800 leading-relaxed focus:outline-none focus:border-forest-500 resize-none"
    />
  )
}

function Select({ value, onChange, options, optionLabels }) {
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-bone-50 border border-bone-400/40 rounded-md px-2 py-1.5 text-xs text-forest-700 focus:outline-none focus:border-forest-500"
    >
      {options.map(opt => (
        <option key={opt || '_'} value={opt}>
          {optionLabels?.[opt] ?? opt ?? ''}
          {opt === '' && '— nenurodyta —'}
        </option>
      ))}
    </select>
  )
}

/**
 * ChipSelect — radio-style chip group'as enumeruotam pasirinkimui. Geriau nei
 * <select> kai opcijos mažai (3-5) ir aiškiai matomos — admin'as iškart mato
 * visus pasirinkimus, neturi click'inti dropdown'o.
 *
 * options = [{ value, label, help }] — `help` rodomas kaip tooltip + apačioje
 * po pasirinkimo (severity kalibracijai svarbu, kad admin'as suprastų ką
 * renka).
 *
 * allowEmpty = true → galima atšaukti pasirinkimą (chip su X).
 */
function ChipSelect({ value, onChange, options, allowEmpty = false }) {
  const selected = options.find(o => o.value === value)
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {options.map(opt => {
          const isSelected = opt.value === value
          return (
            <button
              key={String(opt.value)}
              onClick={() => onChange(opt.value)}
              title={opt.help}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                isSelected
                  ? 'bg-forest-700 text-bone'
                  : 'bg-bone-200 text-forest-600 hover:bg-bone-300'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
        {allowEmpty && value != null && value !== '' && (
          <button
            onClick={() => onChange(null)}
            title="Atšaukti pasirinkimą"
            className="px-2 py-1 rounded-full text-[10px] font-medium text-forest-500 hover:bg-bone-200"
          >
            ✕
          </button>
        )}
      </div>
      {selected?.help && (
        <p className="text-[10px] text-forest-400 italic">{selected.help}</p>
      )}
    </div>
  )
}

/**
 * ToggleSwitch — boolean field'ams (savybes.pavojingumas.yra). Vizualiai
 * iOS-style swap'as kad admin'ui būtų greitai aišku ar yra/ne.
 */
function ToggleSwitch({ checked, onChange, label }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-2 group transition-opacity hover:opacity-90`}
    >
      <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? 'bg-terracotta-500' : 'bg-bone-300'
      }`}>
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-bone-50 shadow-sm transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`} />
      </span>
      <span className={`text-[11px] font-medium ${checked ? 'text-terracotta-700' : 'text-forest-500'}`}>
        {label}
      </span>
    </button>
  )
}

/**
 * StringArrayChips — string[] field'ui (pvz. sinonimai). Chip-style display
 * su × removal'u + input apačioje su Enter / komma key bind'ais pridėjimui.
 *
 * Naudoja keyboard: Enter ar comma → pridėti. Backspace tuščiam input'e →
 * pašalinti paskutinį chip'ą.
 */
function StringArrayChips({ value, onChange, placeholder }) {
  const [input, setInput] = useState('')
  const arr = Array.isArray(value) ? value : []

  const add = () => {
    const trimmed = input.trim()
    if (!trimmed || arr.includes(trimmed)) {
      setInput('')
      return
    }
    onChange([...arr, trimmed])
    setInput('')
  }

  const remove = (idx) => {
    onChange(arr.filter((_, i) => i !== idx))
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add()
    } else if (e.key === 'Backspace' && input === '' && arr.length > 0) {
      e.preventDefault()
      remove(arr.length - 1)
    }
  }

  return (
    <div className="bg-bone-50 border border-bone-400/40 rounded-md p-1.5 focus-within:border-forest-500 transition-colors">
      <div className="flex flex-wrap gap-1.5">
        {arr.map((s, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-forest-100 text-forest-700 text-[11px]"
          >
            {s}
            <button
              onClick={() => remove(idx)}
              className="text-forest-500 hover:text-forest-700"
              title="Šalinti"
            >
              <X size={9} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={add}
          placeholder={arr.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[100px] px-1 py-0.5 bg-transparent text-xs text-forest-800 placeholder:text-forest-300 focus:outline-none"
        />
      </div>
    </div>
  )
}

/**
 * JsonField — structured object editor'ius (taxonGroup careInfo.*). Pretty-
 * printed JSON monospace. Invalid JSON visualus indikator'ius + raw save
 * (geriau bloga data nei prarastas darbas).
 *
 * Etapas 4+ (sekantis darbas) pakeistų į structured form'as kiekvienam
 * objektui (sviesa.poreikis, sviesa.tiesioginė_saulė, ...).
 */
function JsonField({ value, onChange, rows = 5 }) {
  const [text, setText] = useState(() => jsonStringify(value))
  const [valid, setValid] = useState(true)

  useEffect(() => { setText(jsonStringify(value)); setValid(true) }, [value])

  const handleChange = (next) => {
    setText(next)
    if (!next.trim()) { setValid(true); onChange(null); return }
    try {
      onChange(JSON.parse(next))
      setValid(true)
    } catch {
      setValid(false)
      onChange(next)
    }
  }

  return (
    <div>
      <textarea
        value={text}
        onChange={e => handleChange(e.target.value)}
        rows={rows}
        className={`w-full bg-bone-50 border rounded-md px-2 py-1.5 font-mono text-[11px] text-forest-800 leading-relaxed focus:outline-none resize-none ${
          valid ? 'border-bone-400/40 focus:border-forest-500' : 'border-terracotta-400 focus:border-terracotta-500'
        }`}
      />
      <p className={`text-[10px] mt-0.5 px-0.5 ${valid ? 'text-forest-400' : 'text-terracotta-600'}`}>
        {valid ? 'JSON formatas — keisk atsargiai.' : '⚠ Neteisingas JSON formatas. Save siųs raw tekstą.'}
      </p>
    </div>
  )
}

function jsonStringify(val) {
  if (val == null) return ''
  if (typeof val === 'string') return val
  try { return JSON.stringify(val, null, 2) } catch { return String(val ?? '') }
}

/**
 * ProvenanceBadge — rodo, iš kur atėjo entry'is (batch source + data).
 * Naudojama Aprašymai / Toksiškumas tab'uose, kur AI generuotas turinys gali
 * būti pakeistas. Future: per-field provenance (kuriame field'e AI vs manual).
 */
function ProvenanceBadge({ entry }) {
  if (!entry?._batchSource && !entry?._batchEnrichedAt) return null
  return (
    <div className="flex items-center gap-2 text-[10px] text-forest-500 bg-bone-100 px-2.5 py-1.5 rounded-md border border-bone-400/40">
      <Info size={10} className="flex-shrink-0" />
      <span>
        Šaltinis: <span className="font-mono text-forest-600">{entry._batchSource}</span>
        {entry._batchEnrichedAt && <span> · {shortDate(entry._batchEnrichedAt)}</span>}
      </span>
    </div>
  )
}

// ── Tab-aware dirty mapping ─────────────────────────────────────────
//
// Kiekvienam tab'ui — kurie field'ai jam priklauso (kad galėtumėm parodyti
// dot indicator'ių prie tab'o, jei jame yra pakeitimų). Kontrol'ė lieka
// vienoje vietoje — keičiant tab'ų struktūrą, atnaujini čia.
const TAB_FIELDS = {
  identification: {
    cultivar: ['lotyniskas', 'lietuviškas', 'sinonimai', 'taxonGroupId', 'auginimas', 'infoConfidence'],
    series:   ['genus', 'name', 'type', 'tipas'],
  },
  photo:          { cultivar: ['image'], series: [] },
  descriptions:   {
    cultivar: ['aprasymas', 'kilme', 'idomybes'],
    series:   ['aprasymas', 'idomybes'],
  },
  care: {
    cultivar: ['sviesa', 'vanduo', 'substratas', 'persodinimas', 'ziemojimas', 'tresimas', 'prieziura'],
    series:   ['careInfo'],
  },
  toxicity:       { cultivar: ['savybes'], series: [] },
  classification: { cultivar: ['tipas', 'sunkumas', 'augimo_greitis', 'cultivationContext', 'lifecycle', 'hardiness'], series: [] },
  meta:           { cultivar: [], series: [] },
}

function buildTabDirtyMap(draft, originalDraft, entryType) {
  const map = {}
  for (const [tabId, fieldsByType] of Object.entries(TAB_FIELDS)) {
    const fields = fieldsByType[entryType] ?? []
    map[tabId] = fields.some(f =>
      JSON.stringify(draft[f]) !== JSON.stringify(originalDraft[f] ?? defaultValueFor(f)),
    )
  }
  return map
}

// ── Helpers ──────────────────────────────────────────────────────

function fieldDirty(current, original) {
  // Treat null/undefined/empty-string as equivalent (admin'as nemato skirtumo
  // tarp jų UI'e). Tuščias array/object — taip pat equivalent į null
  // (nepasakytume „pakeitė" jei buvo undefined ir tapo []).
  const norm = (v) => {
    if (v == null || v === '') return ''
    if (Array.isArray(v) && v.length === 0) return ''
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) return ''
    return JSON.stringify(v)
  }
  return norm(current) !== norm(original)
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
