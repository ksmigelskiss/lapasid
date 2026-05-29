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
  Search, ChevronRight, ChevronLeft, ChevronDown, ImageOff, Layers, Eye, Filter,
  Save, RotateCcw, Trash2, AlertTriangle, X, CheckCircle2, Plus, Minus,
  Image as ImageIcon, Type, BookOpen, Droplet, Skull, Tag, Info,
} from 'lucide-react'
import { ProfileContent } from '../PlantDetail'
import PlantImage from '../brand/PlantImage'
import { TAXON_GROUP_TYPES, CULTIVATION_CONTEXTS } from '../../utils/taxonGroups'
import { parseLatinName } from '../../utils/latinName'
import { auth } from '../../utils/firebase'
import { ExternalLink, Sun, Droplets, Thermometer, Wind, Sparkles, Calendar } from 'lucide-react'
import { getFertilizingSummary } from '../../utils/fertilizingForecast'

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

// Lifecycle — schema'os EN reikšmės (annual/biennial/perennial/woody/bulbous)
// → LT vartotojui draugiškos etiketės. Schema value (EN) išlieka — tas pats
// pattern'as kaip SEVERITY_OPTS.
const LIFECYCLE_OPTS = [
  { value: 'annual',    label: 'Vienametis',  help: 'Gyvena 1 sezoną (pvz. nasturtės, saulutės).' },
  { value: 'biennial',  label: 'Dvimetis',    help: 'Du metai gyvavimo (pvz. naktižiedė).' },
  { value: 'perennial', label: 'Daugiametis', help: 'Žolinis daugiametis (pvz. astrai, peonijos, daugelis kambarinių).' },
  { value: 'woody',     label: 'Sumedėjęs',   help: 'Medis ar krūmas (pvz. rožės, alyvos, fikusas).' },
  { value: 'bulbous',   label: 'Svogūninis',  help: 'Turi svogūnėlį (pvz. tulpės, narcizai, hipeastrai).' },
]

// ── Tab definitions (Audit fix #5 — 7→5 reorg) ──────────────────────
//
// Susitraukino į 5 tab'us iš 7:
//   • Foto + Aprašymai merge'inti į „Aprašymas" (visi pasakojantys laukai
//     kartu — image story + text story)
//   • Meta drop'intas → provenance footer pridėtas Atributai tab'o apačioje
//     + collapsible raw JSON debug
//   • Klasifikacija rename'inta į „Atributai" (LT vartotojui aiškesnis terminas)
//   • auginimas + infoConfidence perkelti į Atributai (jie yra atribut'ai,
//     ne identifikacija)
//
// Series turi 3 tab'us (be Toksiškumas/Atributai — netaikoma taxonGroup'ams).
const CULTIVAR_TABS = [
  { id: 'identification', label: 'Identifikacija', Icon: Type     },
  { id: 'descriptions',   label: 'Aprašymas',      Icon: BookOpen },
  { id: 'care',           label: 'Priežiūra',      Icon: Droplet  },
  { id: 'toxicity',       label: 'Toksiškumas',    Icon: Skull    },
  { id: 'classification', label: 'Atributai',      Icon: Tag      },
]
const SERIES_TABS = [
  { id: 'identification', label: 'Identifikacija', Icon: Type     },
  { id: 'descriptions',   label: 'Aprašymas',      Icon: BookOpen },
  { id: 'care',           label: 'Care šablonas',  Icon: Droplet  },
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

  // ── Genus parent (Phase 2 inheritance) — only for species entries
  const genusParent = useMemo(() => {
    if (!selectedEntry || selectedType !== 'cultivar') return null
    return getGenusParent(selectedEntry, catalog)
  }, [selectedEntry, selectedType, catalog])

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
      // Audit fix #6 — infoConfidence default 'vidutinis' jei admin'as ji
      // nustatė į null (explicit clear). Užtikrinam, kad catalog.infoConfidence
      // niekada nebūtų null Firestore'e — UI badge'as visada turi value.
      if ('infoConfidence' in patch && (patch.infoConfidence == null || patch.infoConfidence === '')) {
        patch.infoConfidence = 'vidutinis'
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
        genusParent={genusParent}
      />
      <RightPanePreview entry={selectedEntry} draft={draft} entryType={selectedType} genusParent={genusParent} />

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
  // 3-level hierarchy: Genus → Species → (Series → Cultivars)
  //
  // genus-group (level 1) — kontaineris pagal Latin genus name.
  //   - entry: catalog/{genus_slug} catalog doc'as (jei egzistuoja, pvz.
  //     catalog/aloe). Jei nėra — synthetic header, ne clickable.
  //   - members[]: arrays of:
  //     • species (level 2) — catalog entries with rank='species' (e.g.
  //       Aloe vera). Click → edit form.
  //     • series (level 2) — taxonGroup entries (e.g. Sansevieria
  //       trifasciata). Expandable to cultivars (level 3).
  //
  // Kodėl read-time derivation: nereikia DB migracijos, jokio schema
  // pakeitimo. Catalog + taxonGroups už šitos hierarchijos yra
  // atvaizduojama klientiniam UI lygyje.
  const items = useMemo(() => buildHierarchy(catalog, taxonGroups), [catalog, taxonGroups])

  const filteredItems = useMemo(() => {
    let result = items

    // Filter chips (adapted to 3-level hierarchy):
    //  • 'standalone' = genus groups su ≤1 member'iu (single entry, no children)
    //  • 'series' = genus groups, kuriose yra bent viena taxonGroup series
    //  • 'modified' = grupės, kur bent vienas entry batch-enriched per 7d
    if (activeFilter === 'standalone') {
      result = result.filter(g => (g.entry ? 1 : 0) + g.members.length <= 1)
    } else if (activeFilter === 'series') {
      result = result.filter(g => g.members.some(m => m.kind === 'series'))
    } else if (activeFilter === 'modified') {
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
      const isModified = e => e?._batchEnrichedAt && new Date(e._batchEnrichedAt).getTime() > cutoff
      result = result.filter(g => {
        if (isModified(g.entry)) return true
        return g.members.some(m => {
          if (m.kind === 'species' && isModified(m.entry)) return true
          if (m.kind === 'series') return m.cultivars.some(isModified)
          return false
        })
      })
    }

    // Paieška — match'inam genus name, entry LT/Latin, ar bet kurio member'io
    if (!search.trim()) return result
    const q = search.toLowerCase()
    return result
      .map(group => {
        const groupMatches = group.genus.toLowerCase().includes(q) ||
          (group.entry && (`${group.entry.lotyniskas ?? ''} ${group.entry.lietuviškas ?? ''}`.toLowerCase().includes(q)))
        if (groupMatches) return group
        // Filter members by match
        const matchingMembers = group.members
          .map(m => {
            if (m.kind === 'species') {
              const hay = `${m.entry.lotyniskas ?? ''} ${m.entry.lietuviškas ?? ''}`.toLowerCase()
              return hay.includes(q) ? m : null
            }
            // series — match group name OR any cultivar
            const seriesHay = `${m.group.genus ?? ''} ${m.group.name ?? ''}`.toLowerCase()
            if (seriesHay.includes(q)) return m
            const matchingCults = m.cultivars.filter(c =>
              `${c.lotyniskas ?? ''} ${c.lietuviškas ?? ''}`.toLowerCase().includes(q),
            )
            if (matchingCults.length > 0) return { ...m, cultivars: matchingCults }
            return null
          })
          .filter(Boolean)
        if (matchingMembers.length > 0) return { ...group, members: matchingMembers }
        return null
      })
      .filter(Boolean)
  }, [items, search, activeFilter])

  // Auto-expand genus groups + series kai paieška grąžina nested match'us
  useEffect(() => {
    if (!search.trim()) return
    filteredItems.forEach(group => {
      const genusKey = `genus:${group.id}`
      if (!expanded.has(genusKey)) toggleExpand(genusKey)
      for (const m of group.members) {
        if (m.kind === 'series') {
          const seriesKey = `series:${m.id}`
          if (!expanded.has(seriesKey)) toggleExpand(seriesKey)
        }
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  // Render items — singleton synthetic groups flattened.
  //
  // Jei genus grupė turi NULL entry (catalog'e nėra genus įrašo) IR turi tik
  // 1 member'į (species ar series), promote'inam tą member'į į top-level
  // (be synthetic group header'io). Praleidžiama vizualinė depth + „no entry"
  // gray indicator'ius kai grouping'as neduoda realios vertės.
  //
  // 2+ members case'e — synthetic header LIEKA (rodome „no entry · N"),
  // nes ten grupavimas vis tiek naudingas (rodo, kad species priklauso vienam
  // genus'ui).
  const renderItems = useMemo(() => {
    return filteredItems.map(group => {
      const isSingletonSynthetic = !group.entry && group.members.length === 1
      if (!isSingletonSynthetic) return group
      const m = group.members[0]
      if (m.kind === 'species') {
        // Promote species į entry slot — UI mato kaip standalone genus row
        return { ...group, entry: m.entry, members: [], _promotedFrom: 'species' }
      }
      if (m.kind === 'series') {
        // Series singleton — render kaip top-level series (be genus header'io
        // virš). Naudojam `_singletonSeries` flag'ą GenusGroupRow'ui.
        return { ...group, _singletonSeries: m }
      }
      return group
    })
  }, [filteredItems])

  // Flat list keyboard nav'ui — TIK matomi (expanded'inti) items
  const flatNavItems = useMemo(() => {
    const flat = []
    for (const group of renderItems) {
      // Singleton series flattening — series row at top level
      if (group._singletonSeries) {
        const m = group._singletonSeries
        flat.push({ id: m.id, type: 'series' })
        if (expanded.has(`series:${m.id}`)) {
          for (const c of m.cultivars) flat.push({ id: c.id, type: 'cultivar' })
        }
        continue
      }
      if (group.entry) {
        flat.push({ id: group.entry.id, type: 'cultivar' })
      }
      if (expanded.has(`genus:${group.id}`)) {
        for (const m of group.members) {
          if (m.kind === 'species') {
            flat.push({ id: m.id, type: 'cultivar' })
          } else if (m.kind === 'series') {
            flat.push({ id: m.id, type: 'series' })
            if (expanded.has(`series:${m.id}`)) {
              for (const c of m.cultivars) {
                flat.push({ id: c.id, type: 'cultivar' })
              }
            }
          }
        }
      }
    }
    return flat
  }, [renderItems, expanded])

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
            {renderItems.map(group => (
              <GenusGroupRow
                key={group.id}
                group={group}
                expanded={expanded.has(`genus:${group.id}`)}
                onToggleGenus={() => toggleExpand(`genus:${group.id}`)}
                expandedSet={expanded}
                onToggleSeries={(seriesId) => toggleExpand(`series:${seriesId}`)}
                selectedId={selectedId}
                onSelect={onSelect}
                dirty={dirty}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="flex-shrink-0 border-t border-bone-400/40 px-3 py-1.5 bg-bone-100/60">
        <p className="font-mono text-[10px] text-forest-500 tabular-nums">
          {renderItems.length} / {items.length} rows
          {dirty && <span className="ml-2 text-terracotta-600">⚡ unsaved</span>}
        </p>
      </div>
    </div>
  )
}

// ── Hierarchy builder ─────────────────────────────────────────────
//
// buildHierarchy(catalog, taxonGroups) → genus groups array.
//
// Šaknis: kiekvienas Latin genus name turi grupę. Grupėje:
//   • entry: catalog doc, kurio lotyniskas == genus (pvz. catalog/aloe). Gali būti null.
//   • members[]: species (catalog entries rank='species') + series (taxonGroups).
//
// Cultivar'ai (catalog entries su taxonGroupId) NĖRA atskiri members —
// jie hang'inasi po series member'iu kaip series.cultivars[]. 3-čias nesting'as.
//
// Edge case'ai:
//   • Genus entry yra, bet jokio species/series — group su members=[] (no expand)
//   • Species entry yra, bet genus entry nėra — synthetic header („Aloe (no entry)")
//   • Catalog entry su unparseable Latin — skip (filtered out)
//   • Series Latin name nesutampa su jokio genus — skip (defensive)
// ── Genus parent lookup + care inheritance (Phase 2) ──────────────
//
// PRINCIPAS: jei species entry'is (Aloe vera) neturi tam tikrų laukų, jie
// gali būti paveldimi iš genus entry'io (Aloe). Admin'as mato kuris laukas
// paveldimas + iš kur (badge'as „Iš Aloe genus"). Save'as nepakeičia
// paveldimo elgesio — admin'as gali įvesti specifinį species value
// (override) arba palikti tuščią (paveldima).
//
// PASTABA: paveldima TIK species → genus. Cultivar → series inheritance
// jau egzistuoja (mergeWithSeries Variant B flow). Genus → cultivar
// inheritance neimplemented'inta (per ilga grandinė).

const INHERITABLE_FIELDS = [
  // Care info (bendrai taikoma per visą genus)
  'sviesa', 'vanduo', 'substratas', 'persodinimas', 'ziemojimas', 'tresimas', 'prieziura',
  // Klasifikacija
  'tipas', 'sunkumas', 'augimo_greitis', 'cultivationContext', 'lifecycle', 'hardiness',
  'auginimas',
  // Kilmė (genus origin = species origin paprastai)
  'kilme',
  // Toxicity — savybes object'as (Aloe toxic to pets → visos Aloe rūšys taip pat)
  'savybes',
]

/** Genus parent lookup pagal Latin name (only species → genus). */
function getGenusParent(entry, catalog) {
  if (!entry?.lotyniskas) return null
  const parsed = parseLatinName(entry.lotyniskas)
  if (parsed.rank !== 'species') return null  // tik species turi genus parent'ą
  if (!parsed.genus) return null
  return catalog.find(c =>
    c.lotyniskas?.toLowerCase() === parsed.genus.toLowerCase(),
  ) ?? null
}

/** Ar value laikomas „neužpildytu" (empty string, null, undef, empty array/object). */
function isEmptyValue(v) {
  if (v == null || v === '') return true
  if (Array.isArray(v) && v.length === 0) return true
  if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) return true
  // savybes nested check — jei pavojai tuščias array + pavojingumas.yra=false → laikom tuščia
  if (typeof v === 'object' && !Array.isArray(v) && 'pavojai' in v) {
    const noPavojai = !Array.isArray(v.pavojai) || v.pavojai.length === 0
    const noYra = !v.pavojingumas?.yra
    if (noPavojai && noYra) return true
  }
  return false
}

/** Grąžina inherited value (su badge'u UI'e), arba null jei nepaveldima/užpildyta. */
function getInheritedValue(field, draftValue, genusParent) {
  if (!genusParent) return null
  if (!INHERITABLE_FIELDS.includes(field)) return null
  if (!isEmptyValue(draftValue)) return null  // entry turi own value
  const parentValue = genusParent[field]
  if (isEmptyValue(parentValue)) return null
  return parentValue
}

/** Merge genus parent fields į species entry'į (preview pane'ui). */
function mergeWithGenusParent(entry, genusParent) {
  if (!genusParent || !entry) return entry
  const merged = { ...entry }
  for (const field of INHERITABLE_FIELDS) {
    if (isEmptyValue(entry[field]) && !isEmptyValue(genusParent[field])) {
      merged[field] = genusParent[field]
    }
  }
  return merged
}

function buildHierarchy(catalog, taxonGroups) {
  const byGenus = new Map()
  const getGroup = (genus) => {
    const key = genus.toLowerCase()
    let g = byGenus.get(key)
    if (!g) {
      g = { id: key, genus, entry: null, members: [] }
      byGenus.set(key, g)
    }
    return g
  }

  // Step 1: series su cultivars — placement pagal series'os Latin genus
  const cultivarIds = new Set()
  for (const tg of taxonGroups) {
    const seriesLatin = (tg.scientificName || `${tg.genus ?? ''} ${tg.name ?? ''}`).trim()
    if (!seriesLatin) continue
    const cultivars = catalog.filter(c => c.taxonGroupId === tg.id)
    for (const c of cultivars) cultivarIds.add(c.id)
    const parsed = parseLatinName(seriesLatin)
    if (!parsed.genus) continue
    const group = getGroup(parsed.genus)
    group.members.push({
      kind: 'series',
      id: tg.id,
      group: tg,
      latin: seriesLatin,
      cultivars,
    })
  }

  // Step 2: catalog entries (not cultivars in series)
  for (const c of catalog) {
    if (cultivarIds.has(c.id)) continue
    if (!c.lotyniskas) continue
    const parsed = parseLatinName(c.lotyniskas)
    if (!parsed.genus) continue
    const group = getGroup(parsed.genus)
    if (parsed.rank === 'genus') {
      group.entry = c  // catalog doc IS the genus
    } else {
      group.members.push({
        kind: 'species',
        id: c.id,
        entry: c,
        latin: c.lotyniskas,
        rank: parsed.rank,
      })
    }
  }

  // Step 3: sort members within each group by Latin name (alphabetical)
  for (const g of byGenus.values()) {
    g.members.sort((a, b) => (a.latin ?? '').localeCompare(b.latin ?? ''))
  }

  // Step 4: sort groups alphabetically by genus
  return [...byGenus.values()].sort((a, b) => a.genus.localeCompare(b.genus))
}

// ── Thumbnail src helper ───────────────────────────────────────────
// Admin list + preview: watercolor heroIllustration prioritetas (mirror app —
// catalog stock augalams iliustracija = default hero). Fallback į real foto.
// Transparent PNG render'inasi ant bone-200 thumb container'io fono.
const heroThumb = e => e?.heroIllustration ?? e?.image ?? null

// ── Genus group row (Level 1) ──────────────────────────────────────
//
// Renders genus group header (catalog entry if exists, otherwise synthetic
// header). Below: expandable members list (species + series).
//
// SINGLETON SERIES: jei grupė turi `_singletonSeries` flag'ą (synthetic
// genus su 1 series member'iu), rodom seriją tiesiai top-level — be genus
// header'io virš. Vienodumas su standalone genus entries.
function GenusGroupRow({ group, expanded, onToggleGenus, expandedSet, onToggleSeries, selectedId, onSelect, dirty }) {
  const { genus, entry, members } = group

  // Singleton series — render kaip top-level series (be genus wrapper)
  if (group._singletonSeries) {
    return (
      <SeriesTopLevelRow
        series={group._singletonSeries}
        expanded={expandedSet.has(`series:${group._singletonSeries.id}`)}
        onToggle={() => onToggleSeries(group._singletonSeries.id)}
        selectedId={selectedId}
        onSelect={onSelect}
        dirty={dirty}
      />
    )
  }

  const hasMembers = members.length > 0
  const genusSelected = entry && selectedId === entry.id

  // Hero image: genus entry's own (watercolor/real), else first species, else first cultivar
  const heroImage = heroThumb(entry) ??
    heroThumb(members.find(m => m.kind === 'species')?.entry) ??
    heroThumb(members.find(m => m.kind === 'series')?.cultivars[0])

  return (
    <li>
      <div className={`flex items-center gap-1.5 rounded-btn-sm pl-1 pr-2 py-1 transition-colors ${
        genusSelected ? 'bg-forest-100' : 'hover:bg-bone-200/60'
      }`}>
        {/* Expand chevron — tik jei yra members. Vienodam alignment'ui — spacer
            jei nėra members. */}
        {hasMembers ? (
          <button
            onClick={onToggleGenus}
            className="w-5 h-5 flex-shrink-0 inline-flex items-center justify-center text-forest-500 hover:text-forest-700 rounded-sm hover:bg-bone-300/40"
            title={expanded ? 'Suskleisti' : 'Išskleisti'}
          >
            {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
        ) : (
          <div className="w-5 h-5 flex-shrink-0" />
        )}

        {entry ? (
          // Genus catalog entry'is egzistuoja — clickable
          <button
            onClick={() => onSelect(entry.id, 'cultivar')}
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
              <p className={`text-xs font-semibold truncate leading-tight ${
                genusSelected ? 'text-forest-800' : 'text-forest-700'
              }`}>
                {entry.lietuviškas || genus}
                {genusSelected && dirty && <span className="ml-1 text-terracotta-600">*</span>}
              </p>
              <p className="text-[10px] text-forest-500 italic truncate leading-tight">
                {entry.lotyniskas}
                {hasMembers && <span className="font-mono ml-1 not-italic">· {members.length}</span>}
              </p>
            </div>
          </button>
        ) : (
          // Genus entry nėra catalog'e — synthetic header, NEclickable
          <div className="flex-1 flex items-center gap-2 min-w-0 opacity-70" title="Genus catalog entry'is neegzistuoja — grupuojama vizualiai pagal Latin name">
            <div className="w-7 h-7 flex-shrink-0 rounded-md bg-bone-200/60 flex items-center justify-center">
              <Layers size={11} className="text-forest-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate leading-tight italic text-forest-500">
                {genus}
              </p>
              <p className="text-[10px] text-forest-400 font-mono leading-tight">
                no entry · {members.length}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Expanded members — su vertical tree connector'iu kairėje, kad būtų
          aišku jog children priklauso parent grupei. */}
      {expanded && hasMembers && (
        <div className="relative ml-3.5 mt-0.5 pl-3.5 border-l-2 border-forest-200/70">
          <ul className="space-y-0.5">
            {members.map(m =>
              m.kind === 'species' ? (
                <SpeciesChildRow
                  key={m.id}
                  entry={m.entry}
                  selected={selectedId === m.id}
                  onSelect={() => onSelect(m.id, 'cultivar')}
                  dirty={dirty}
                />
              ) : (
                <SeriesChildRow
                  key={m.id}
                  series={m}
                  expanded={expandedSet.has(`series:${m.id}`)}
                  onToggle={() => onToggleSeries(m.id)}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  dirty={dirty}
                />
              ),
            )}
          </ul>
        </div>
      )}
    </li>
  )
}

// ── Series top-level row (used for singleton-series flattening) ────
//
// Same UX kaip GenusGroupRow su entry, bet content'as iš series'os: rodo
// genus + name italic, taxon type, cultivar count. Expand'as atskleidžia
// cultivar'us su tree connector'iu.
function SeriesTopLevelRow({ series, expanded, onToggle, selectedId, onSelect, dirty }) {
  const { group, cultivars } = series
  const heroImage = heroThumb(cultivars[0])
  const seriesSelected = selectedId === series.id
  const hasCultivars = cultivars.length > 0
  return (
    <li>
      <div className={`flex items-center gap-1.5 rounded-btn-sm pl-1 pr-2 py-1 transition-colors ${
        seriesSelected ? 'bg-forest-100' : 'hover:bg-bone-200/60'
      }`}>
        {hasCultivars ? (
          <button
            onClick={onToggle}
            className="w-5 h-5 flex-shrink-0 inline-flex items-center justify-center text-forest-500 hover:text-forest-700 rounded-sm hover:bg-bone-300/40"
          >
            {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
        ) : (
          <div className="w-5 h-5 flex-shrink-0" />
        )}
        <button
          onClick={() => onSelect(series.id, 'series')}
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
      {expanded && hasCultivars && (
        <div className="relative ml-3.5 mt-0.5 pl-3.5 border-l-2 border-forest-200/70">
          <ul className="space-y-0.5">
            {cultivars.map(c => (
              <CultivarLeafRow
                key={c.id}
                entry={c}
                selected={selectedId === c.id}
                onSelect={() => onSelect(c.id, 'cultivar')}
                dirty={dirty}
              />
            ))}
          </ul>
        </div>
      )}
    </li>
  )
}

// ── Species child row (Level 2) ────────────────────────────────────
function SpeciesChildRow({ entry, selected, onSelect, dirty }) {
  const thumb = heroThumb(entry)
  return (
    <li>
      <button
        onClick={onSelect}
        className={`w-full flex items-center gap-2 rounded-btn-sm px-2 py-1 text-left transition-colors ${
          selected ? 'bg-forest-100' : 'hover:bg-bone-200/40'
        }`}
      >
        <div className="w-6 h-6 flex-shrink-0 rounded-sm overflow-hidden bg-bone-200 flex items-center justify-center">
          {thumb ? (
            <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <ImageOff size={10} className="text-forest-300" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[11px] font-medium truncate leading-tight ${
            selected ? 'text-forest-800' : 'text-forest-700'
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

// ── Series child row (Level 2) — expandable to cultivars (Level 3) ─
function SeriesChildRow({ series, expanded, onToggle, selectedId, onSelect, dirty }) {
  const { group, cultivars } = series
  const heroImage = heroThumb(cultivars[0])
  const seriesSelected = selectedId === series.id
  return (
    <li>
      <div className={`flex items-center gap-1.5 rounded-btn-sm pl-1 pr-2 py-1 transition-colors ${
        seriesSelected ? 'bg-forest-100' : 'hover:bg-bone-200/40'
      }`}>
        <button
          onClick={onToggle}
          className="w-4 h-4 flex-shrink-0 inline-flex items-center justify-center text-forest-500 hover:text-forest-700 rounded-sm hover:bg-bone-300/40"
        >
          {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        </button>
        <button
          onClick={() => onSelect(series.id, 'series')}
          className="flex-1 flex items-center gap-2 text-left min-w-0"
        >
          <div className="w-6 h-6 flex-shrink-0 rounded-sm overflow-hidden bg-bone-200 flex items-center justify-center">
            {heroImage ? (
              <img src={heroImage} alt="" className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <Layers size={10} className="text-forest-300" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-[11px] font-semibold truncate leading-tight italic ${
              seriesSelected ? 'text-forest-800' : 'text-forest-700'
            }`}>
              {group.genus} {group.name}
              {seriesSelected && dirty && <span className="ml-1 text-terracotta-600">*</span>}
            </p>
            <p className="text-[9px] text-forest-500 font-mono leading-tight">
              {group.type ?? '—'} · {cultivars.length}
            </p>
          </div>
        </button>
      </div>
      {expanded && cultivars.length > 0 && (
        <div className="relative ml-3 mt-0.5 pl-3 border-l-2 border-forest-200/50">
          <ul className="space-y-0.5">
            {cultivars.map(c => (
              <CultivarLeafRow
                key={c.id}
                entry={c}
                selected={selectedId === c.id}
                onSelect={() => onSelect(c.id, 'cultivar')}
                dirty={dirty}
              />
            ))}
          </ul>
        </div>
      )}
    </li>
  )
}

// ── Cultivar leaf row (Level 3) ────────────────────────────────────
function CultivarLeafRow({ entry, selected, onSelect, dirty }) {
  const thumb = heroThumb(entry)
  return (
    <li>
      <button
        onClick={onSelect}
        className={`w-full flex items-center gap-1.5 rounded-btn-sm px-1.5 py-1 text-left transition-colors ${
          selected ? 'bg-forest-100' : 'hover:bg-bone-200/30'
        }`}
      >
        <div className="w-5 h-5 flex-shrink-0 rounded-sm overflow-hidden bg-bone-200 flex items-center justify-center">
          {thumb ? (
            <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <ImageOff size={9} className="text-forest-300" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[10px] font-medium truncate leading-tight ${
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
  genusParent,
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

  // Cmd/Ctrl+1..N tab switcher (Audit fix #6).
  // Skip jei admin'as type'ina input'e/textarea'oj — apsauga nuo accidental
  // tab switch'o keystrokes'uose. Skip jei modifier'as PLUS shift'as
  // (browser shortcuts kaip Cmd+Shift+1 = back).
  useEffect(() => {
    if (!entry) return
    const handler = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return
      const n = parseInt(e.key, 10)
      if (Number.isNaN(n) || n < 1 || n > tabs.length) return
      e.preventDefault()
      setActiveTab(tabs[n - 1].id)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [entry, tabs, setActiveTab])

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
          {tabs.map((t, i) => (
            <TabButton
              key={t.id}
              tab={t}
              active={effectiveActiveTab === t.id}
              dirty={tabDirtyMap[t.id]}
              onClick={() => setActiveTab(t.id)}
              shortcutIdx={i + 1}
            />
          ))}
        </div>
      </div>

      {/* Genus inheritance hint (jei species ir turi genus parent'ą) */}
      {genusParent && entryType === 'cultivar' && (
        <div className="mx-5 mt-3 px-3 py-2 bg-forest-50 border border-forest-200/50 rounded-md text-[11px] text-forest-700 flex items-center gap-2">
          <Layers size={11} className="text-forest-500 flex-shrink-0" />
          <span>
            Paveldi iš genus <span className="font-semibold italic">{genusParent.lotyniskas}</span>
            {genusParent.lietuviškas && <span> · „{genusParent.lietuviškas}"</span>}
            <span className="text-forest-500"> — tušti laukai bus rodomi paveldėtu value</span>
          </span>
        </div>
      )}

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
          genusParent={genusParent}
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

function TabButton({ tab, active, dirty, onClick, shortcutIdx }) {
  const { Icon } = tab
  // Cmd+N shortcut hint title (rodomas tooltip'e, NE visible badge'as)
  const shortcutHint = shortcutIdx != null ? ` (⌘${shortcutIdx})` : ''
  return (
    <button
      onClick={onClick}
      title={`${tab.label}${shortcutHint}`}
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

function TabContent({ tabId, entry, entryType, draft, originalDraft, updateField, taxonGroups, onSaveImageOnly, genusParent }) {
  const props = { entry, entryType, draft, originalDraft, updateField, taxonGroups, onSaveImageOnly, genusParent }
  if (entryType === 'series') {
    switch (tabId) {
      case 'identification': return <TabIdentificationSeries {...props} />
      case 'descriptions':   return <TabDescriptionsSeries {...props} />
      case 'care':           return <TabCareSeries {...props} />
      default:               return null
    }
  }
  switch (tabId) {
    case 'identification': return <TabIdentificationCultivar {...props} />
    case 'descriptions':   return <TabAprasymasCultivar {...props} />  // merged Foto+Aprašymas
    case 'care':           return <TabCareCultivar {...props} />
    case 'toxicity':       return <TabToxicity {...props} />
    case 'classification': return <TabAtributai {...props} />  // renamed + augmented
    default:               return null
  }
}

// ── Tab: Identifikacija (cultivar) ───────────────────────────────────

function TabIdentificationCultivar({ entry, draft, originalDraft, updateField, taxonGroups }) {
  // taxonGroupId rodomas TIK cultivar'ams. Audit fix #5: auginimas + infoConfidence
  // perkelti į Atributai tab'ą (jie yra atribut'ai, ne identity).
  const parsed = entry.lotyniskas ? parseLatinName(entry.lotyniskas) : null
  const isCultivar = parsed?.rank === 'cultivar'
  return (
    <div className="space-y-4 max-w-3xl">
      <FormRow label="Lotyniškas" dirty={fieldDirty(draft.lotyniskas, originalDraft?.lotyniskas)} helper={`Genus + species (pvz. „Kalanchoe blossfeldiana"). Cultivar: „Sansevieria trifasciata 'Laurentii'".`}>
        <TextInput value={draft.lotyniskas ?? ''} onChange={v => updateField('lotyniskas', v)} placeholder="Kalanchoe blossfeldiana" />
      </FormRow>
      <FormRow label="Lietuviškas" dirty={fieldDirty(draft.lietuviškas, originalDraft?.lietuviškas)}>
        <TextInput value={draft.lietuviškas ?? ''} onChange={v => updateField('lietuviškas', v)} placeholder="Kalankė" />
      </FormRow>
      <FormRow label="Lietuviški sinonimai" dirty={fieldDirty(draft.sinonimai, originalDraft?.sinonimai)} helper="Alternatyvūs LT pavadinimai paieškai. Enter pridėti.">
        <StringArrayChips value={draft.sinonimai ?? []} onChange={v => updateField('sinonimai', v)} placeholder="pvz. Madagaskaro kalankė" />
      </FormRow>
      <FormRow label="Angliški sinonimai" dirty={fieldDirty(draft.englishNames, originalDraft?.englishNames)} helper={`Common names anglų k. (e.g. „Aloe vera", „Mother-in-Law's Tongue"). Užpildomi iš iNat per Phase 1. Naudojami fuzzy search'e.`}>
        <StringArrayChips value={draft.englishNames ?? []} onChange={v => updateField('englishNames', v)} placeholder="pvz. Snake Plant" />
      </FormRow>
      {isCultivar && (
        <FormRow label="Serija (taxonGroup)" dirty={fieldDirty(draft.taxonGroupId, originalDraft?.taxonGroupId)} helper="Cultivar'as priklauso parent serijai — paveldės jos care šabloną.">
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
      )}
      <div className="text-[10px] text-forest-400 font-mono pt-2 border-t border-bone-400/30 flex items-center gap-3">
        <span>ID: <span className="text-forest-500">{entry.id}</span></span>
        {parsed && (
          <span>rank: <span className="text-forest-500">{parsed.rank}</span></span>
        )}
      </div>
    </div>
  )
}

// Merged Foto + Aprašymas tab (Audit fix #5). Photo picker top-section
// + aprasymas/kilme/idomybes apačioje. Visi „pasakojantys" laukai vienoj
// vietoj.
function TabAprasymasCultivar({ entry, draft, originalDraft, updateField, onSaveImageOnly, genusParent }) {
  const inh = (f) => makeInherited(f, draft, genusParent)
  return (
    <div className="space-y-6 max-w-3xl">
      {/* Foto picker — buvo TabPhoto, perkeltas čia */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest-500 mb-3">Nuotrauka</p>
        <PhotoPickerSection
          draft={draft}
          originalDraft={originalDraft}
          updateField={updateField}
          onSaveImageOnly={onSaveImageOnly}
        />
      </div>

      <div className="pt-3 border-t border-bone-400/30">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest-500 mb-3">Tekstinis pasakojimas</p>
      </div>

      <FormRow label="Aprašymas" dirty={fieldDirty(draft.aprasymas, originalDraft?.aprasymas)} helper={`„Sodininkas friend" stilius — LT vartotojui draugiškas tekstas.`}>
        <TextArea value={draft.aprasymas} onChange={v => updateField('aprasymas', v)} rows={5} />
      </FormRow>
      <FormRow label="Kilmė" dirty={fieldDirty(draft.kilme, originalDraft?.kilme)} helper="Iš kur augalas — geografinė kilmė + buveinė." inherited={inh('kilme')}>
        <TextInput value={draft.kilme ?? ''} onChange={v => updateField('kilme', v)} placeholder="Madagaskaras (atogrąžų pievos)" />
      </FormRow>
      <FormRow label="Įdomybės" dirty={fieldDirty(draft.idomybes, originalDraft?.idomybes)} helper="3-7 įdomių faktų — kiekvienas atskira eilutė. Naudojami plant detail screen'e.">
        <TextArea value={draft.idomybes} onChange={v => updateField('idomybes', v)} rows={5} placeholder={'Faktas 1\nFaktas 2\nFaktas 3'} />
      </FormRow>
      <ProvenanceBadge entry={entry} />
    </div>
  )
}

// Atributai tab (renamed from Klasifikacija, augmented per Audit fix #5).
//   • Klasifikacija fields (tipas, sunkumas, augimo_greitis, lifecycle, hardiness)
//   • Auginimas (moved from Identifikacija — rūšinė kategorija)
//   • Info confidence (moved from Identifikacija — meta data quality)
//   • Provenance footer (was Meta tab — ID, updatedAt, batchSource)
//   • Raw JSON debug toggle (was Meta tab — for debugging)
function TabAtributai({ entry, draft, originalDraft, updateField, genusParent }) {
  const inh = (f) => makeInherited(f, draft, genusParent)
  return (
    <div className="space-y-4 max-w-3xl">
      <FormRow label="Tipas (laisva forma)" dirty={fieldDirty(draft.tipas, originalDraft?.tipas)} helper={`LT-friendly tipas — pvz. „Sultingas", „Tropinis daugiametis".`} inherited={inh('tipas')}>
        <TextInput value={draft.tipas ?? ''} onChange={v => updateField('tipas', v)} />
      </FormRow>
      <FormRow label="Auginimo kategorija" dirty={fieldDirty(draft.auginimas, originalDraft?.auginimas)} helper="Rūšinė augalo kategorija (NE kur konkretus augalas augintas). Sansevieria visada kambarinis, beržas visada laukinis." inherited={inh('auginimas')}>
        <ChipSelect value={draft.auginimas} onChange={v => updateField('auginimas', v)} options={AUGINIMAS_OPTS} allowEmpty />
      </FormRow>
      <FormRow label="Sunkumas" dirty={fieldDirty(draft.sunkumas, originalDraft?.sunkumas)} helper="Schema: integer 1-5. UI rodo 1=labai lengvas → 5=tik patyrusiems." inherited={inh('sunkumas')}>
        <ChipSelect value={draft.sunkumas} onChange={v => updateField('sunkumas', v)} options={SUNKUMAS_OPTS} allowEmpty />
      </FormRow>
      <FormRow label="Augimo greitis" dirty={fieldDirty(draft.augimo_greitis, originalDraft?.augimo_greitis)} inherited={inh('augimo_greitis')}>
        <ChipSelect value={draft.augimo_greitis} onChange={v => updateField('augimo_greitis', v)} options={AUGIMO_GREITIS_OPTS} allowEmpty />
      </FormRow>
      <FormRow label="Augimo trukmė" dirty={fieldDirty(draft.lifecycle, originalDraft?.lifecycle)} helper="Augalo gyvybės ciklas — kiek laiko gyvena ir kaip auga." inherited={inh('lifecycle')}>
        <ChipSelect value={draft.lifecycle} onChange={v => updateField('lifecycle', v)} options={LIFECYCLE_OPTS} allowEmpty />
      </FormRow>
      <FormRow label="Hardiness" dirty={fieldDirty(draft.hardiness, originalDraft?.hardiness)} helper={`USDA zona arba °C ribos. Pvz. „USDA 9-11, -1°C".`} inherited={inh('hardiness')}>
        <TextInput value={draft.hardiness ?? ''} onChange={v => updateField('hardiness', v)} placeholder="USDA 9-11, -1°C" />
      </FormRow>
      <FormRow label="Info confidence" dirty={fieldDirty(draft.infoConfidence, originalDraft?.infoConfidence)} helper="Kiek šios kortelės info'ai patikima — kalibracija PFAF/ASPCA atveju.">
        <ChipSelect value={draft.infoConfidence} onChange={v => updateField('infoConfidence', v)} options={INFO_CONFIDENCE_OPTS} allowEmpty />
      </FormRow>

      {/* Provenance footer + raw JSON debug (formeriai Meta tab) */}
      <div className="pt-4 border-t border-bone-400/30 space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest-500">Provenance</p>
        <MetaRow k="ID" v={entry.id} mono />
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
      </div>
      <details>
        <summary className="cursor-pointer font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-forest-500">
          Raw JSON (debug)
        </summary>
        <pre className="mt-2 text-[10px] text-forest-500 font-mono bg-bone-100 p-3 rounded overflow-auto max-h-[40vh]">
          {JSON.stringify(draft, null, 2)}
        </pre>
      </details>
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

// ── Tab: Foto — Brave search picker + URL paste + rehost ─────────────
//
// PROBLEMA: jei admin'as nori KEISTI nuotrauką, didelė tikimybė kad batch
// auto-fetch'inti Wiki/iNat kandidatai netiko. Reikia diversesnių rezultatų
// — Brave Images API (gardener-style nuotraukos, ne tik scientific).
//
// FLOW'AS:
//   1. „🌐 Ieškoti Brave" → fetch /api/plant-image (Brave server proxy)
//   2. Candidates grid'as su thumbnail'ais
//   3. Click → /api/rehost-image (download + resize 1200px + Firebase Storage
//      upload) → permanent URL (storage.googleapis.com/geliu-db/...)
//   4. Permanent URL įrašomas catalog.image lauke
//
// SVARBU: rehost'as reikalingas, nes:
//   • isPublicPhoto whitelist'as priima TIK Wiki/iNat/Firebase Storage URL'us
//   • Brave URL'ai dažnai sulūžta (commercial nursery sites, hotlink block)
//   • Firebase Storage = brand consistency + long-term safety
//
// Plius — ↗ „Atidaryti Brave Images" external link, jei admin'as nori
// peržiūrėti rezultatus pilname Brave puslapyje ir įklijuoti URL ranka.

// Foto picker section — anksciau buvo TabPhoto (atskiras tab'as), dabar
// embedded'inta į TabAprasymasCultivar viršuje (Audit fix #5 — tab merge).
// Pavadinimas „Section" (ne „Tab") aiškiai parodo, kad tai dalis kito tab'o.
function PhotoPickerSection({ draft, originalDraft, updateField, onSaveImageOnly }) {
  const dirtyImg = fieldDirty(draft.image, originalDraft?.image)
  const latin = draft.lotyniskas ?? ''
  const lt    = draft.lietuviškas ?? ''

  const [searching, setSearching] = useState(false)
  const [candidates, setCandidates] = useState(null)  // null=nepradėjom, []=nieko
  const [searchError, setSearchError] = useState(null)
  const [pickingIdx, setPickingIdx] = useState(null)  // idx of candidate being rehosted

  const handleSearch = useCallback(async () => {
    if (!latin.trim()) {
      setSearchError('Pirmiausia nustatyk lotynišką pavadinimą.')
      return
    }
    setSearching(true)
    setSearchError(null)
    setCandidates(null)
    try {
      const results = await fetchBraveCandidates(latin)
      setCandidates(results)
      if (results.length === 0) {
        setSearchError(`Brave nieko nerado „${latin}". Pabandyk pakeisti paieškos užklausą arba įklijuok URL ranka.`)
      }
    } catch (e) {
      setSearchError(`Paieška nepavyko: ${e.message}. Patikrink ar BRAVE_API_KEY nustatytas Vercel'yje.`)
    } finally {
      setSearching(false)
    }
  }, [latin])

  const handlePickCandidate = useCallback(async (candidate, idx) => {
    setPickingIdx(idx)
    setSearchError(null)
    try {
      // 1. Rehost — download external → resize → Firebase Storage → permanent URL
      const permanentUrl = await rehostImage(candidate.url, latin)
      // 2. Update draft + auto-save (image-only patch)
      updateField('image', permanentUrl)
      if (onSaveImageOnly) await onSaveImageOnly(permanentUrl)
      // 3. Close candidates panel po sėkmingo save'o
      setCandidates(null)
    } catch (e) {
      setSearchError(`Nepavyko įkelti į Storage: ${e.message}`)
    } finally {
      setPickingIdx(null)
    }
  }, [latin, updateField, onSaveImageOnly])

  const handleManualSave = useCallback(async () => {
    if (!onSaveImageOnly) return
    const url = draft.image ?? null
    // Jei admin'as įklijavo external URL (ne Storage) — rehost'inam pirma
    if (url && /^https?:\/\//.test(url) && !isStorageUrl(url) && !isWhitelistedHostingUrl(url)) {
      setSearchError(null)
      setPickingIdx('manual')
      try {
        const permanentUrl = await rehostImage(url, latin)
        updateField('image', permanentUrl)
        await onSaveImageOnly(permanentUrl)
      } catch (e) {
        setSearchError(`Rehost nepavyko: ${e.message}. Galima trinti URL, įklijuok kitą.`)
      } finally {
        setPickingIdx(null)
      }
      return
    }
    // URL jau saugus (Wiki/iNat/Storage) → tiesiog save
    await onSaveImageOnly(url)
  }, [onSaveImageOnly, draft.image, latin, updateField])

  // Brave Images external URL — admin'as gali ranka peržiūrėti pilname puslapyje
  const braveSearchUrl = latin
    ? `https://search.brave.com/images?q=${encodeURIComponent(latin + (lt ? ' ' + lt : ''))}&source=web`
    : null

  return (
    <div className="space-y-4 max-w-3xl">
      {/* URL input + save mini-button */}
      <FormRow
        label="Image URL"
        dirty={dirtyImg}
        helper="Įklijuok bet kokį HTTPS URL (Brave, Google, nursery site) — bus auto-rehost'inta į Firebase Storage. Wiki/iNat/Storage URL'ai saugojami tiesiogiai (whitelist'as)."
      >
        <div className="flex gap-1.5">
          <div className="flex-1">
            <TextInput
              value={draft.image ?? ''}
              onChange={v => updateField('image', v)}
              placeholder="https://..."
            />
          </div>
          {dirtyImg && (
            <button
              onClick={handleManualSave}
              disabled={pickingIdx === 'manual'}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-forest-700 hover:bg-forest-800 text-bone disabled:opacity-50 transition-colors flex-shrink-0"
              title="Išsaugoti TIK šio lauko pakeitimą (external URL'ai auto-rehost'inami į Storage)"
            >
              <Save size={11} />
              {pickingIdx === 'manual' ? 'Rehost…' : 'Saugoti'}
            </button>
          )}
        </div>
      </FormRow>

      {/* Search buttons row */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={handleSearch}
          disabled={searching || !latin.trim()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-btn-sm text-xs font-semibold bg-forest-100 hover:bg-forest-200 text-forest-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Search size={12} />
          {searching ? 'Ieškau Brave…' : `🌐 Ieškoti Brave${latin ? ` „${latin}"` : ''}`}
        </button>
        {braveSearchUrl && (
          <a
            href={braveSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-btn-sm text-[11px] font-medium text-forest-600 hover:bg-bone-200 transition-colors"
            title="Atidaryti Brave Images pilname puslapyje — radus norimą, copy image URL ir įklijuok aukščiau"
          >
            <ExternalLink size={11} /> Atidaryti pilname puslapyje
          </a>
        )}
        {candidates !== null && !searching && (
          <button
            onClick={() => setCandidates(null)}
            className="text-[11px] text-forest-500 hover:text-forest-700 ml-auto"
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
            {candidates.length} Brave kandidatų — paspausk → įkelsiu į Storage + įrašysiu
          </p>
          <div className="grid grid-cols-3 gap-2">
            {candidates.map((c, idx) => (
              <CandidateCard
                key={idx}
                candidate={c}
                selected={c.url === draft.image}
                loading={pickingIdx === idx}
                disabled={pickingIdx !== null}
                onPick={() => handlePickCandidate(c, idx)}
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
          {isStorageUrl(draft.image) && (
            <p className="text-[10px] text-forest-500 italic">
              ✓ Firebase Storage — permanent, brand-consistent
            </p>
          )}
        </div>
      ) : (
        <div className="text-center py-12 px-6 bg-bone-100 rounded-lg border border-dashed border-bone-400/60">
          <ImageOff size={24} className="text-forest-300 mx-auto mb-2" />
          <p className="text-xs text-forest-500">Nuotraukos URL'as nenurodytas.</p>
          <p className="text-[10px] text-forest-400 mt-1">
            Paspausk „Ieškoti Brave" — pasiūlysiu kandidatus iš Brave Images.
          </p>
        </div>
      )}
    </div>
  )
}

function CandidateCard({ candidate, selected, loading, disabled, onPick }) {
  const [error, setError] = useState(false)
  return (
    <button
      onClick={onPick}
      disabled={disabled}
      className={`relative group rounded-lg overflow-hidden border-2 transition-all ${
        selected
          ? 'border-forest-600 ring-2 ring-forest-200'
          : 'border-bone-400/40 hover:border-forest-400'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <div className="aspect-square bg-bone-200 overflow-hidden relative">
        {error ? (
          <div className="w-full h-full flex items-center justify-center text-3xl">🌿</div>
        ) : (
          <img
            src={candidate.thumbnail || candidate.url}
            alt=""
            loading="lazy"
            onError={() => setError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        )}
        {loading && (
          <div className="absolute inset-0 bg-forest-900/70 flex flex-col items-center justify-center text-bone gap-1">
            <RotateCcw size={18} className="animate-spin" />
            <span className="text-[10px] font-mono uppercase tracking-wider">Įkeliam į Storage…</span>
          </div>
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
      {selected && !loading && (
        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-forest-600 flex items-center justify-center">
          <CheckCircle2 size={11} className="text-bone" />
        </div>
      )}
    </button>
  )
}

// ── Brave Images fetcher (per existing /api/plant-image proxy) ──────
//
// Server proxy handles BRAVE_API_KEY (env), Vercel edge-cache 30d.
async function fetchBraveCandidates(latinName) {
  if (!latinName) return []
  const res = await fetch(`/api/plant-image?q=${encodeURIComponent(latinName)}`)
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status} ${detail.slice(0, 100)}`)
  }
  const data = await res.json()
  return (data.images ?? []).map((img, idx) => ({
    url:       img.url,
    thumbnail: img.thumbnail || img.url,
    source:    img.source || `Brave #${idx + 1}`,
    label:     img.title || latinName,
  }))
}

// ── Image rehost (download → resize → Storage → permanent URL) ──────
//
// Naudoja egzistuojantį /api/rehost-image endpoint'ą (auth-protected,
// Sharp resize'as iki 1200px, JPEG q85, Firebase Storage upload).
//
// CACHE-BUST (2026-05-27 fix): rehost storage path'as yra deterministic
// (`catalog/{slug}/hero.jpg`) + Storage set'ina cacheControl=immutable
// 1 metams. Tai reiškia, kad antras nuotraukos pakeitimas:
//   • Overwrite'ina failą Storage'e (Sharp upload tuo pačiu path'u)
//   • BET URL'as išlieka identiškas → browser rodo cached old image,
//     React <img> su tuo pačiu src nere-mount'ina, Firestore listener
//     nemato pakeitimo (image laukas tas pats string'as).
// User bug report'as: „antra kart keisciant jau nebeissaugo, palieka pirma".
// Realybėje save'asi, bet browser'is rodo cache.
//
// Fix: appendinam ?v=timestamp query param'ą. Storage failo location'as
// nesikeičia (param ignoruojamas), bet URL string'as kitas → cache miss,
// React re-mount, Firestore notice'ina value change.
async function rehostImage(externalUrl, latinName) {
  const idToken = await auth.currentUser?.getIdToken().catch(() => null)
  if (!idToken) throw new Error('Auth required (Firebase token missing)')
  if (!latinName) throw new Error('latinName required (catalog slug derivation)')

  const res = await fetch('/api/rehost-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({ url: externalUrl, latinName, maxSize: 1200 }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  const data = await res.json()
  if (!data.url) throw new Error('rehost grąžino tuščią URL')
  // Strip esamą ?v=... jei yra (nesikompoundinti), tada append naują timestamp.
  const baseUrl = data.url.split('?')[0]
  return `${baseUrl}?v=${Date.now()}`
}

// Image URL helpers — atskirti mūsų Storage'ą nuo external'iu
function isStorageUrl(url) {
  if (!url || typeof url !== 'string') return false
  return url.startsWith('https://storage.googleapis.com/geliu-db') ||
         url.startsWith('https://firebasestorage.googleapis.com/v0/b/geliu-db')
}

// URL'ai, kuriuos isPublicPhoto whitelist'as priima tiesiogiai (be rehost'o)
function isWhitelistedHostingUrl(url) {
  if (!url || typeof url !== 'string') return false
  return url.startsWith('https://static.inaturalist') ||
         url.startsWith('https://inaturalist-open-data') ||
         url.startsWith('https://upload.wikimedia') ||
         url.startsWith('https://photos.inaturalist')
}

// ── Tab: Aprašymai (cultivar) — moved to TabAprasymasCultivar (Audit fix #5)
//     Old TabDescriptionsCultivar removed; merged with PhotoPickerSection.

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

function TabCareCultivar({ draft, originalDraft, updateField, genusParent }) {
  const inh = (f) => makeInherited(f, draft, genusParent)
  return (
    <div className="space-y-4 max-w-3xl">
      <FormRow label="Šviesa" dirty={fieldDirty(draft.sviesa, originalDraft?.sviesa)} inherited={inh('sviesa')}>
        <StructuredSviesaEditor value={draft.sviesa} onChange={v => updateField('sviesa', v)} />
      </FormRow>
      <FormRow label="Vanduo" dirty={fieldDirty(draft.vanduo, originalDraft?.vanduo)} inherited={inh('vanduo')}>
        <StructuredVanduoEditor value={draft.vanduo} onChange={v => updateField('vanduo', v)} />
      </FormRow>
      <FormRow label="Laistymo intervalas" dirty={fieldDirty(draft.laistymasIntervalas, originalDraft?.laistymasIntervalas)}>
        <StructuredLaistymasEditor value={draft.laistymasIntervalas} onChange={v => updateField('laistymasIntervalas', v)} />
      </FormRow>
      <FormRow label="Tręšimas" helper="Deriviama iš kategorijos (tipas + augimo greitis) — per-augalo reikšmė nebenaudojama (forecast ją ignoruoja). Reikšmės keičiamos per kategorijų lentelę.">
        <DerivedTresimasInfo plant={draft} />
      </FormRow>
      <FormRow label="Ramybės periodas (dormancy)" dirty={fieldDirty(draft.dormancyInfo, originalDraft?.dormancyInfo)} helper="Ar augalas turi atskirą ramybės periodą žiemą. Sukulentai/kaktusai = full, ficusai/dalies tropikų = partial.">
        <StructuredDormancyEditor value={draft.dormancyInfo} onChange={v => updateField('dormancyInfo', v)} />
      </FormRow>
      <FormRow label="Priežiūra (temperatūra, drėgmė, narrative)" dirty={fieldDirty(draft.prieziura, originalDraft?.prieziura)} inherited={inh('prieziura')}>
        <StructuredPrieziuraEditor value={draft.prieziura} onChange={v => updateField('prieziura', v)} />
      </FormRow>

      <div className="pt-3 border-t border-bone-400/30">
        <p className="font-mono text-[10px] uppercase tracking-wider text-forest-500 mb-2">Naratyvinis turinys</p>
      </div>
      <FormRow label="Substratas" dirty={fieldDirty(draft.substratas, originalDraft?.substratas)} inherited={inh('substratas')}>
        <TextArea value={draft.substratas} onChange={v => updateField('substratas', v)} rows={3} placeholder="Substrato sudėtis, drenažas, pH..." />
      </FormRow>
      <FormRow label="Persodinimas" dirty={fieldDirty(draft.persodinimas, originalDraft?.persodinimas)} inherited={inh('persodinimas')}>
        <TextArea value={draft.persodinimas} onChange={v => updateField('persodinimas', v)} rows={3} placeholder="Kada persodinti, vazono dydis, technique..." />
      </FormRow>
      <FormRow label="Žiemojimas" dirty={fieldDirty(draft.ziemojimas, originalDraft?.ziemojimas)} inherited={inh('ziemojimas')}>
        <TextArea value={draft.ziemojimas} onChange={v => updateField('ziemojimas', v)} rows={3} placeholder="Žiemos periodas, temperatūra, laistymo režimas..." />
      </FormRow>
    </div>
  )
}

// ── Structured care field editors (Audit fix #4) ───────────────────
//
// Vietoj raw JSON edit'avimo, atskiri mini-card'ai kiekvienam care object'ui.
// Schema (žr. plantPromptConfig.js):
//   sviesa:              { taskai 1-3, lygis: žema|vidutinė|ryški, ppfd: {min, max} }
//   vanduo:              { taskai 1-3, lygis: mažai|vidutiniškai|daug }
//   laistymasIntervalas: { intervalVasara: int, intervalZiema: int, tipas: string }
//   tresimas:            { reikia: bool, tipas: full|partial|null }
//   prieziura:           { sviesa: str, laistymas: str, temperatura: str, dregme: str }
//
// Visi editor'iai naudoja onChange(newObject) pattern'ą — parent updateField
// stačiai persaugo visą object'ą. Tas pats kontraktas, kaip su TextInput'u
// (vienas value in, vienas onChange out).

const SVIESA_LYGIS_OPTS = [
  { value: 'žema',     label: 'Žema'     },
  { value: 'vidutinė', label: 'Vidutinė' },
  { value: 'ryški',    label: 'Ryški'    },
]
const VANDUO_LYGIS_OPTS = [
  { value: 'mažai',         label: 'Mažai'         },
  { value: 'vidutiniškai',  label: 'Vidutiniškai'  },
  { value: 'daug',          label: 'Daug'          },
]
const TASKAI_OPTS = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
]
// DORMANCY_TIPAS_OPTS — dormancyInfo.tipas reikšmės (NE tresimas).
// 'full'    = pilnas ramybės periodas (sukulentai žiemą, kaktusai)
// 'partial' = dalinis (ficus sumažina augimą, bet nesustoja)
const DORMANCY_TIPAS_OPTS = [
  { value: 'full',    label: 'Pilnas (sustabdo augimą)' },
  { value: 'partial', label: 'Dalinis (sulėtina)'        },
]
const DREGME_OPTS = [
  { value: 'sausa',    label: 'Sausa (<40%)'    },
  { value: 'vidutinė', label: 'Vidutinė (40-60%)' },
  { value: 'drėgna',   label: 'Drėgna (>60%)'   },
]

function StructuredSviesaEditor({ value, onChange }) {
  const v = value ?? {}
  const update = (k, val) => onChange({ ...v, [k]: val })
  const updatePpfd = (k, val) => onChange({ ...v, ppfd: { ...(v.ppfd ?? {}), [k]: val } })
  return (
    <div className="bg-bone-50 border border-bone-400/40 rounded-lg p-3 space-y-3">
      <SubFieldRow icon={Sun} iconColor="text-terracotta-400" label="Lygis">
        <ChipSelect value={v.lygis} onChange={x => update('lygis', x)} options={SVIESA_LYGIS_OPTS} allowEmpty />
      </SubFieldRow>
      <SubFieldRow label="Taškai (1-3)">
        <ChipSelect value={v.taskai} onChange={x => update('taskai', x)} options={TASKAI_OPTS} allowEmpty />
      </SubFieldRow>
      <SubFieldRow label="PPFD (μmol/m²/s)">
        <div className="flex items-center gap-1.5">
          <NumberInput value={v.ppfd?.min} onChange={x => updatePpfd('min', x)} placeholder="min" />
          <span className="text-forest-400 text-xs">–</span>
          <NumberInput value={v.ppfd?.max} onChange={x => updatePpfd('max', x)} placeholder="max" />
        </div>
      </SubFieldRow>
    </div>
  )
}

function StructuredVanduoEditor({ value, onChange }) {
  const v = value ?? {}
  const update = (k, val) => onChange({ ...v, [k]: val })
  return (
    <div className="bg-bone-50 border border-bone-400/40 rounded-lg p-3 space-y-3">
      <SubFieldRow icon={Droplets} iconColor="text-forest-400" label="Lygis">
        <ChipSelect value={v.lygis} onChange={x => update('lygis', x)} options={VANDUO_LYGIS_OPTS} allowEmpty />
      </SubFieldRow>
      <SubFieldRow label="Taškai (1-3)">
        <ChipSelect value={v.taskai} onChange={x => update('taskai', x)} options={TASKAI_OPTS} allowEmpty />
      </SubFieldRow>
    </div>
  )
}

function StructuredLaistymasEditor({ value, onChange }) {
  // SCHEMA: laistymasIntervalas = { vasara, ziema, metodas }
  // wateringForecast.js skaito .vasara/.ziema/.metodas. 2026-05-28 fix —
  // anksciau editor'ius rašė intervalVasara/intervalZiema/tipas (wrong field
  // names), forecast'as ne matydavo per-plant data → fallback'as į category
  // default. Audit'as parodė 0 corrupted entries — fix preventive.
  const v = value ?? {}
  const update = (k, val) => onChange({ ...v, [k]: val })
  return (
    <div className="bg-bone-50 border border-bone-400/40 rounded-lg p-3 space-y-3">
      <SubFieldRow icon={Calendar} iconColor="text-forest-400" label="Intervalas vasarą (dienos)">
        <NumberInput value={v.vasara} onChange={x => update('vasara', x)} placeholder="pvz. 7" />
      </SubFieldRow>
      <SubFieldRow label="Intervalas žiemą (dienos)">
        <NumberInput value={v.ziema} onChange={x => update('ziema', x)} placeholder="pvz. 14" />
      </SubFieldRow>
      <SubFieldRow label="Metodas / pastabos">
        <TextInput value={v.metodas} onChange={x => update('metodas', x)} placeholder="pvz. iš apačios, soak-dry, drėkinti lapus" />
      </SubFieldRow>
    </div>
  )
}

function StructuredTresimasEditor({ value, onChange }) {
  // SCHEMA: tresimas = { intervalVasara, intervalZiema, tipas }
  // fertilizingForecast.js skaito .intervalVasara / .intervalZiema. tipas =
  // narratyvas „Universalios skystos trąšos, ¼ dozės" tipo, NE enum'as.
  //
  // 2026-05-28 fix — anksciau editor'ius rašė `{ reikia, tipas }` (kaip
  // dormancyInfo schema — visai kitas konceptas). Audit'as: 0 plants taip
  // corrupted, fix preventive. „Reikia tręšti?" interface'as iškeltas į
  // atskirą StructuredDormancyEditor (jis IR YRA „reikia tipo")
  const v = value ?? {}
  const update = (k, val) => onChange({ ...v, [k]: val })
  return (
    <div className="bg-bone-50 border border-bone-400/40 rounded-lg p-3 space-y-3">
      <SubFieldRow icon={Sparkles} iconColor="text-amber-500" label="Intervalas vasarą (dienos)">
        <NumberInput value={v.intervalVasara} onChange={x => update('intervalVasara', x)} placeholder="pvz. 14, 21, 30" />
      </SubFieldRow>
      <SubFieldRow label="Intervalas žiemą (dienos arba tuščias = skip)">
        <NumberInput value={v.intervalZiema} onChange={x => update('intervalZiema', x)} placeholder="paliek tuščią žiemą" />
      </SubFieldRow>
      <SubFieldRow label="Trąšų rūšis / pastabos">
        <TextArea value={v.tipas} onChange={x => update('tipas', x)} rows={2} placeholder="pvz. Universalios skystos NPK 20-20-20, ½ dozės kas savaitę" />
      </SubFieldRow>
    </div>
  )
}

// DerivedTresimasInfo — read-only tręšimo display. Tręšimas deriviamas iš
// kategorijos (getFertilizingSummary), AI/per-augalo `tresimas` skaičius
// IGNORUOJAMAS (forecast naudoja lentelę). Editable per-plant fields pašalinti,
// kad nerodytų klaidinančios (nebenaudojamos) reikšmės.
function DerivedTresimasInfo({ plant }) {
  const fs = getFertilizingSummary(plant ?? {})
  return (
    <div className="bg-bone-50 border border-bone-400/40 rounded-lg p-3 text-sm text-forest-700 space-y-1.5">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-forest-500">Kategorija</span>
        <span className="font-medium">{fs.label}</span>
      </div>
      <div>{fs.vasaraDays == null
        ? 'Netręšti (mėsėdis / saugumas).'
        : `Augimo sezonu kas ~${fs.vasaraDays} d.${fs.skipWinter ? '; žiemą nutraukti' : ''}.`}</div>
      <div className="text-forest-600 text-[13px]">{fs.tip}</div>
      <div className="text-[11px] text-forest-400">Deriviama iš kategorijos — reikšmės redaguojamos per kategorijų lentelę.</div>
    </div>
  )
}

// StructuredDormancyEditor — atskiras nuo tresimas (skirtingi konceptai).
// SCHEMA: dormancyInfo = { reikia: bool, tipas: 'full'|'partial'|null }
// Vartojama kai augalas turi specifinį ramybės periodą — sukulentai
// (full žiemos sleep) vs ficus (partial slowdown).
function StructuredDormancyEditor({ value, onChange }) {
  const v = value ?? {}
  const update = (k, val) => onChange({ ...v, [k]: val })
  return (
    <div className="bg-bone-50 border border-bone-400/40 rounded-lg p-3 space-y-3">
      <SubFieldRow label="Ar augalas turi ramybės periodą (dormancy)?">
        <ToggleSwitch checked={!!v.reikia} onChange={x => update('reikia', x)} label={v.reikia ? 'Taip' : 'Ne'} />
      </SubFieldRow>
      {v.reikia && (
        <SubFieldRow label="Tipas">
          <ChipSelect value={v.tipas} onChange={x => update('tipas', x)} options={DORMANCY_TIPAS_OPTS} allowEmpty />
        </SubFieldRow>
      )}
    </div>
  )
}

function StructuredPrieziuraEditor({ value, onChange }) {
  // prieziura nested object'as: { sviesa, laistymas, temperatura, dregme }
  // Schema all STRINGS (narrative). Mes UI šitą daom labiau visualus —
  // temperatura/dregme atskiri input'ai, sviesa/laistymas textarea.
  const v = value ?? {}
  const update = (k, val) => onChange({ ...v, [k]: val })
  return (
    <div className="bg-bone-50 border border-bone-400/40 rounded-lg p-3 space-y-3">
      <SubFieldRow icon={Thermometer} iconColor="text-terracotta-500" label="Temperatūra">
        <TextInput value={v.temperatura} onChange={x => update('temperatura', x)} placeholder="pvz. 18-25°C, žiemą min. 10°C" />
      </SubFieldRow>
      <SubFieldRow icon={Wind} iconColor="text-forest-400" label="Drėgmė">
        <div className="space-y-1.5">
          <ChipSelect
            value={DREGME_OPTS.find(o => v.dregme?.includes(o.value))?.value ?? null}
            onChange={x => update('dregme', x ?? '')}
            options={DREGME_OPTS}
            allowEmpty
          />
          <TextInput value={v.dregme} onChange={x => update('dregme', x)} placeholder="laisva forma jei nori detalesnio aprašymo" />
        </div>
      </SubFieldRow>
      <SubFieldRow icon={Sun} iconColor="text-terracotta-400" label="Šviesa (narrative — papildomas)">
        <TextArea value={v.sviesa} onChange={x => update('sviesa', x)} rows={2} placeholder="Detalesnė šviesos info, jei reikia papildomai..." />
      </SubFieldRow>
      <SubFieldRow icon={Droplets} iconColor="text-forest-400" label="Laistymas (narrative — papildomas)">
        <TextArea value={v.laistymas} onChange={x => update('laistymas', x)} rows={2} placeholder="Detalesnė laistymo info..." />
      </SubFieldRow>
    </div>
  )
}

// Sub-field row helper for structured editors — label + icon + control.
function SubFieldRow({ icon: Icon, iconColor, label, children }) {
  return (
    <div>
      <label className="font-mono text-[10px] uppercase tracking-[0.12em] text-forest-500 block mb-1 flex items-center gap-1.5">
        {Icon && <Icon size={10} className={iconColor} />}
        {label}
      </label>
      {children}
    </div>
  )
}

// Number input atom — siunčia integer'į arba null jei tuščias.
function NumberInput({ value, onChange, placeholder }) {
  const display = value == null ? '' : String(value)
  return (
    <input
      type="number"
      value={display}
      onChange={e => {
        const raw = e.target.value
        if (raw === '') { onChange(null); return }
        const n = parseInt(raw, 10)
        onChange(Number.isFinite(n) ? n : null)
      }}
      placeholder={placeholder}
      className="w-20 bg-bone-50 border border-bone-400/40 rounded-md px-2 py-1 text-xs text-forest-800 placeholder:text-forest-300 focus:outline-none focus:border-forest-500"
    />
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

function TabToxicity({ entry, draft, originalDraft, updateField, genusParent }) {
  const savybes = draft.savybes ?? {}
  const orig = originalDraft?.savybes ?? {}
  const pavojai = Array.isArray(savybes.pavojai) ? savybes.pavojai : []
  const pavojingumas = savybes.pavojingumas ?? { yra: false, lygis: null, detales: '' }

  // Inheritance check — jei species toksiškumas tuščias bet genus turi
  const inheritedSavybes = getInheritedValue('savybes', draft.savybes, genusParent)

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
      {/* Inheritance banner — jei species toksiškumas tuščias bet genus turi */}
      {inheritedSavybes && (
        <div className="px-3 py-2.5 bg-forest-50 border border-forest-200/60 rounded-md text-xs text-forest-700 flex items-start gap-2">
          <Layers size={12} className="text-forest-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">
              Toksiškumas paveldimas iš <span className="italic">{genusParent.lotyniskas}</span> (genus)
            </p>
            <p className="text-[11px] text-forest-600 mt-0.5">
              {inheritedSavybes.pavojingumas?.yra
                ? `Lygis: ${inheritedSavybes.pavojingumas.lygis ?? '—'} · ${inheritedSavybes.pavojai?.length ?? 0} struktūrizuotų pavojų`
                : 'Genus pažymėtas kaip saugus.'}
            </p>
            <p className="text-[10px] text-forest-500 mt-1 italic">
              Įvesk specifinę informaciją apačioje, jei šios rūšies toksiškumas skiriasi.
            </p>
          </div>
        </div>
      )}

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

// TabClassification + TabMeta — removed (Audit fix #5). Klasifikacija content
// migrated to TabAtributai (above) which combines classification fields +
// auginimas/infoConfidence (moved from Identifikacija) + provenance footer
// + raw JSON debug (was Meta tab).

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

function RightPanePreview({ entry, draft, entryType, genusParent }) {
  // ── Debounced draft (300ms) — prevents preview re-render on every keystroke
  const [debouncedDraft, setDebouncedDraft] = useState(draft)
  useEffect(() => {
    if (!draft) { setDebouncedDraft(null); return }
    const t = setTimeout(() => setDebouncedDraft(draft), 300)
    return () => clearTimeout(t)
  }, [draft])

  // Hero galerijos index'as — reset'inam kai keičiasi augalas
  const [galleryIdx, setGalleryIdx] = useState(0)
  useEffect(() => { setGalleryIdx(0) }, [entry?.id])

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

  // Cultivar — merge: entry → draft overrides → genus parent fallbacks.
  // 1. entry — saved catalog doc
  // 2. debouncedDraft — admin's in-flight edits (override saved)
  // 3. genusParent — fill empty inheritable fields (Phase 2 inheritance)
  // 4. Safe defaults for ProfileContent (id, kategorija, status, etc.)
  //
  // Inheritance taikomas TIK INHERITABLE_FIELDS sąraše (care + classification
  // + toxicity + kilme). Identity fields (lotyniskas, lietuviškas, image, ...)
  // visada iš draft/entry, niekada iš genus.
  const draftMerged = { ...entry, ...(debouncedDraft ?? {}) }
  const withGenusInheritance = genusParent
    ? mergeWithGenusParent(draftMerged, genusParent)
    : draftMerged
  const mergedPlant = {
    ...withGenusInheritance,
    id: `preview-${entry.id}`,         // synthetic id (preview-mode)
    kategorija: entry.kategorija ?? 'auginama',
    status: entry.status ?? 'auginama',
    photos: entry.photos ?? [],
    timeline: entry.timeline ?? [],
  }

  // Identiškas user view — hero galerija (aspect-3/2 kaip PlantDetail'yje) +
  // ProfileContent. Skip'inam top bar (status/zone — admin'ui nereikalingi)
  // ir TabBar (admin mato tik Profile content'ą).
  //
  // Hero GALERIJA — admin gali cycle'inti [iliustracija, tikra foto, ...gallery]
  // strėlytėmis, kad palygintų kiek tiksliai watercolor atvaizduoja augalą vs
  // tikra foto (→ prompt refinement). Default = generated iliustracija (idx 0).
  const heroIllus = debouncedDraft?.heroIllustration ?? entry.heroIllustration ?? null
  const realPhoto = debouncedDraft?.image ?? entry.image ?? null
  const gallery = [heroIllus, realPhoto, ...(entry.photos ?? [])]
    .filter(Boolean)
    .filter((u, i, a) => a.indexOf(u) === i)
  const idx = Math.min(galleryIdx, Math.max(0, gallery.length - 1))
  const currentPhoto = gallery[idx] ?? null
  const isIllustration = !!heroIllus && currentPhoto === heroIllus
  const photoLabel = currentPhoto === heroIllus ? 'Iliustracija'
    : currentPhoto === realPhoto ? 'Tikra foto'
    : 'Galerija'
  return (
    <div className={`${WIDGET} flex flex-col h-full overflow-hidden`}>
      <PreviewBadge />
      <div className="flex-1 overflow-y-auto relative">
        <div className="pointer-events-none">
          {/* Hero galerija — aspect-3/2; strėlytės pointer-events-auto (parent none) */}
          <div className={`relative w-full ${isIllustration ? '' : 'bg-bone-300'}`}
               style={{ aspectRatio: '3 / 2', ...(isIllustration ? { background: '#fefdfa' } : {}) }}>
            {currentPhoto ? (
              <PlantImage
                key={currentPhoto}
                url={currentPhoto}
                alt={mergedPlant.lietuviškas || mergedPlant.lotyniskas}
                size="detail"
                eager
                className={`w-full h-full ${isIllustration ? 'object-contain' : 'object-cover'}`}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-7xl">
                🌿
              </div>
            )}
            {gallery.length > 1 && (
              <>
                <button
                  onClick={() => setGalleryIdx(i => Math.max(0, i - 1))}
                  disabled={idx === 0}
                  className="pointer-events-auto absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/35 hover:bg-black/55 backdrop-blur-sm text-white flex items-center justify-center disabled:opacity-30 transition"
                  aria-label="Ankstesnė"
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  onClick={() => setGalleryIdx(i => Math.min(gallery.length - 1, i + 1))}
                  disabled={idx >= gallery.length - 1}
                  className="pointer-events-auto absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/35 hover:bg-black/55 backdrop-blur-sm text-white flex items-center justify-center disabled:opacity-30 transition"
                  aria-label="Kita"
                >
                  <ChevronRight size={15} />
                </button>
              </>
            )}
            {/* Tipo label (Iliustracija / Tikra foto / Galerija) — palyginimui */}
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/45 backdrop-blur-sm">
              <span className="text-[10px] text-white/90 font-medium tracking-wide">{photoLabel}</span>
            </div>
            {gallery.length > 1 && (
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/45 backdrop-blur-sm">
                <span className="text-[10px] text-white/90 font-medium">{idx + 1} / {gallery.length}</span>
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

function FormRow({ label, children, dirty, helper, inherited }) {
  // `inherited` = { value, fromLabel } | null
  //   value: inherited string/object/array from parent
  //   fromLabel: pvz. „Iš Aloe (genus)"
  // Rodom badge + value preview po input'u, kai laukas tuščias bet parent
  // turi value. Admin'as gali matyti, kas bus rodoma user'iui, IR įvesti
  // override'inančią reikšmę.
  return (
    <div className="space-y-1">
      <label className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-forest-500 block flex items-center gap-1.5">
        {label}
        {dirty && <span className="text-terracotta-600" title="Pakeista">●</span>}
        {inherited && (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-forest-100 text-forest-600 text-[9px] font-normal normal-case tracking-normal"
            title="Šis laukas paveldi reikšmę iš genus parent'o, kol nenuves admin specifinė reikšmė"
          >
            <Layers size={9} /> {inherited.fromLabel}
          </span>
        )}
      </label>
      {children}
      {inherited && (
        <div className="text-[10px] text-forest-500 italic border-l-2 border-forest-200 pl-2 py-0.5">
          <span className="font-mono text-[9px] text-forest-400 uppercase tracking-wider mr-1.5">paveldima:</span>
          {typeof inherited.value === 'string'
            ? inherited.value
            : <span className="font-mono text-[9px]">{JSON.stringify(inherited.value)}</span>}
        </div>
      )}
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
    cultivar: ['lotyniskas', 'lietuviškas', 'sinonimai', 'englishNames', 'taxonGroupId'],
    series:   ['genus', 'name', 'type', 'tipas'],
  },
  descriptions:   {
    cultivar: ['image', 'aprasymas', 'kilme', 'idomybes'],  // image moved here (Foto merge)
    series:   ['aprasymas', 'idomybes'],
  },
  care: {
    cultivar: ['sviesa', 'vanduo', 'laistymasIntervalas', 'tresimas', 'dormancyInfo', 'prieziura', 'substratas', 'persodinimas', 'ziemojimas'],
    series:   ['careInfo'],
  },
  toxicity:       { cultivar: ['savybes'], series: [] },
  classification: {
    cultivar: ['tipas', 'sunkumas', 'augimo_greitis', 'lifecycle', 'hardiness', 'auginimas', 'infoConfidence'],
    series:   [],
  },
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

/** Inheritance helper formavimui FormRow `inherited` prop'ui. */
function makeInherited(field, draft, genusParent) {
  const v = getInheritedValue(field, draft?.[field], genusParent)
  if (v == null) return null
  return {
    value: v,
    fromLabel: `Iš ${genusParent.lotyniskas}`,
  }
}

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
    // Care fields — sviesa/vanduo/tresimas/prieziura/laistymasIntervalas yra
    // OBJEKTAI per schema (žr. plantPromptConfig.js). Substratas/persodinimas/
    // ziemojimas yra string'ai. Default'inam null object'ams, '' string'ams,
    // kad structured editor'ius (Audit fix #4) galėtų atskirti.
    sviesa:             c.sviesa             ?? null,
    vanduo:             c.vanduo             ?? null,
    laistymasIntervalas: c.laistymasIntervalas ?? null,
    tresimas:           c.tresimas           ?? null,
    dormancyInfo:       c.dormancyInfo       ?? null,
    prieziura:          c.prieziura          ?? null,
    substratas:         c.substratas         ?? '',
    persodinimas:       c.persodinimas       ?? '',
    ziemojimas:         c.ziemojimas         ?? '',
    tipas:              c.tipas              ?? '',
    sunkumas:           c.sunkumas           ?? '',
    augimo_greitis:     c.augimo_greitis     ?? '',
    lifecycle:          c.lifecycle          ?? '',
    hardiness:          c.hardiness          ?? '',
    savybes:            c.savybes            ?? null,
    sinonimai:          c.sinonimai          ?? [],
    englishNames:       c.englishNames       ?? [],
    auginimas:          c.auginimas          ?? '',
    infoConfidence:     c.infoConfidence     ?? '',
    // cultivationContext IŠTRINTA — duplikavo auginimas (subagent §1, user
    // patvirtino 2026-05-27). taxonGroup serijoms paliekamas (serijos
    // metadata, kitokia semantika).
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
