import { useState, useMemo, useEffect } from 'react'
import { Search, X, ChevronRight, ChevronDown, Trash2, AlertTriangle, Save, ImageOff, Layers } from 'lucide-react'
import { TAXON_GROUP_TYPES, CULTIVATION_CONTEXTS, LIFECYCLES } from '../../utils/taxonGroups'
import { parseLatinName } from '../../utils/latinName'

const WIDGET = 'bg-bone-50 rounded-2xl border border-bone-400/40 shadow-[0_1px_3px_rgba(28,58,42,0.06),0_4px_14px_rgba(28,58,42,0.05)]'

function shortDate(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('lt-LT', { year: '2-digit', month: 'short', day: 'numeric' }) }
  catch { return '—' }
}

/**
 * LibraryTab — UNIFIED bibliotekos sąrašas. Serijos (taxonGroups) ir
 * standalone cultivars rodomi viename sąraše, kaip įvairūs „augalų įrašai".
 * Serijos turi expandable seksciją, kurioje matomi visi jos cultivars.
 *
 * Klikus į serijos pavadinimą — atsidaro serijos edit drawer'is.
 * Klikus į expand chevron'ą — išskleidžia/suskleidžia cultivars'us.
 * Klikus į cultivar'ą serijoje — atsidaro cultivar edit drawer'is.
 * Ištrynus seriją — cascade'ina ir visus jos cultivar'us (žiūr. AdminPanel
 * deleteTaxonGroupEntry).
 *
 * Anksciau buvo du sub-tab'ai (Cultivars / Serijos) — atskira lentelė kiekvienam.
 * Unified view paprastesnis admin'ui: vienas mental model'is, serija kaip
 * folder'is su contents'ais.
 */
export default function LibraryTab({
  catalog, taxonGroups,
  onSaveCatalog, onDeleteCatalog,
  onSaveTaxonGroup, onDeleteTaxonGroup,
}) {
  const [search, setSearch]     = useState('')
  const [editing, setEditing]   = useState(null)         // { type, entry } | null
  const [expanded, setExpanded] = useState(() => new Set())  // serijos ID'ai

  // Unified items list — serijos su jų cultivars'ais + standalone'iai
  const items = useMemo(() => {
    const seriesItems = taxonGroups.map(g => ({
      kind: 'series',
      group: g,
      cultivars: catalog.filter(c => c.taxonGroupId === g.id),
    }))
    const standaloneItems = catalog
      .filter(c => !c.taxonGroupId)
      .map(c => ({ kind: 'standalone', entry: c }))

    // Serijos pirma (pagal narių count desc), standalone'iai pabaigoje (alfabetu)
    return [
      ...seriesItems.sort((a, b) => b.cultivars.length - a.cultivars.length),
      ...standaloneItems.sort((a, b) =>
        (a.entry.lotyniskas ?? '').localeCompare(b.entry.lotyniskas ?? '')
      ),
    ]
  }, [catalog, taxonGroups])

  // Filter — match'ina pagal serijos ar cultivar pavadinimą
  const filteredItems = useMemo(() => {
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items
      .map(item => {
        if (item.kind === 'series') {
          const seriesMatches = `${item.group.genus ?? ''} ${item.group.name ?? ''}`.toLowerCase().includes(q)
          const matchingCults = item.cultivars.filter(c =>
            `${c.lotyniskas ?? ''} ${c.lietuviškas ?? ''}`.toLowerCase().includes(q)
          )
          if (seriesMatches) return item
          if (matchingCults.length > 0) return { ...item, cultivars: matchingCults }
          return null
        }
        const hay = `${item.entry.lotyniskas ?? ''} ${item.entry.lietuviškas ?? ''}`.toLowerCase()
        return hay.includes(q) ? item : null
      })
      .filter(Boolean)
  }, [items, search])

  // Auto-expand serijos kai search'as turi match'us cultivar'ams jų viduje
  useEffect(() => {
    if (!search.trim()) return
    setExpanded(prev => {
      const next = new Set(prev)
      filteredItems.forEach(item => {
        if (item.kind === 'series') next.add(item.group.id)
      })
      return next
    })
  }, [search, filteredItems])

  const toggleExpand = (id) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  return (
    <>
      {/* Search */}
      <div className="mb-4 flex items-center gap-2 max-w-2xl">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Serijos, cultivar, lotyniškas, lietuviškas…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-bone-50 border border-bone-400/40 rounded-btn focus:outline-none focus:border-forest-500"
          />
        </div>
        {/* TEMPORARY — parser audit button. Pažiūrim ar `parseLatinName`
            teisingai klasifikuoja visus catalog įrašus prieš leidžiantis
            ant jo `ensureSpeciesTaxonGroup` flow'e. Galima ištrinti po
            verification'o. */}
        <AuditParserButton catalog={catalog} taxonGroups={taxonGroups} />
      </div>

      {/* Empty state */}
      {filteredItems.length === 0 ? (
        <p className="text-center text-forest-500 py-12">
          {search.trim() ? `Nieko nerasta su „${search}"` : 'Biblioteka tuščia — pridėk per Search → „Pridėti visą seriją"'}
        </p>
      ) : (
        <div className="space-y-2">
          {filteredItems.map(item =>
            item.kind === 'series' ? (
              <SeriesRow
                key={item.group.id}
                group={item.group}
                cultivars={item.cultivars}
                expanded={expanded.has(item.group.id)}
                onToggle={() => toggleExpand(item.group.id)}
                onEditSeries={() => setEditing({ type: 'series', entry: item.group })}
                onEditCultivar={(c) => setEditing({ type: 'cultivar', entry: c })}
              />
            ) : (
              <StandaloneRow
                key={item.entry.id}
                entry={item.entry}
                onClick={() => setEditing({ type: 'cultivar', entry: item.entry })}
              />
            )
          )}
        </div>
      )}

      {editing?.type === 'cultivar' && (
        <CultivarEditDrawer
          entry={editing.entry}
          taxonGroups={taxonGroups}
          onSave={async (patch) => {
            await onSaveCatalog(editing.entry.id, patch)
            setEditing(prev => prev ? { ...prev, entry: { ...prev.entry, ...patch } } : null)
          }}
          onDelete={async () => {
            await onDeleteCatalog(editing.entry.id, editing.entry.lotyniskas || editing.entry.id)
            setEditing(null)
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {editing?.type === 'series' && (
        <SeriesEditDrawer
          entry={editing.entry}
          cultivarCount={catalog.filter(c => c.taxonGroupId === editing.entry.id).length}
          onSave={async (patch) => {
            await onSaveTaxonGroup(editing.entry.id, patch)
            setEditing(prev => prev ? { ...prev, entry: { ...prev.entry, ...patch } } : null)
          }}
          onDelete={async () => {
            await onDeleteTaxonGroup(editing.entry.id, `${editing.entry.genus ?? ''} ${editing.entry.name ?? ''}`.trim() || editing.entry.id)
            setEditing(null)
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

// ── Unified row komponentai ─────────────────────────────────────────

/**
 * SeriesRow — serijos eilutė unified sąraše. Vizualiai panaši į augalų
 * įrašus: image + name + count. Klikus į name area — atsidaro serijos
 * edit drawer'is. Klikus į chevron'ą — toggle'inamas išskleidimas, ir tada
 * matomi visi serijos cultivars'ai inline.
 */
function SeriesRow({ group, cultivars, expanded, onToggle, onEditSeries, onEditCultivar }) {
  // Serijos hero image — naudojam pirmo cultivar'o nuotrauką (taxonGroup
  // neturi savo image field'o; visi serijos nariai vizualiai panašūs).
  const heroImage = cultivars[0]?.image
  return (
    <div className={`${WIDGET} overflow-hidden`}>
      <div className="flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-bone-100/40 transition-colors">
        <div className="w-9 h-9 flex-shrink-0 rounded-lg overflow-hidden bg-bone-200 flex items-center justify-center">
          {heroImage ? (
            <img src={heroImage} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <Layers size={13} className="text-forest-300" />
          )}
        </div>
        <button onClick={onEditSeries} className="flex-1 text-left min-w-0">
          <p className="font-display text-sm font-semibold text-forest-800 italic truncate leading-tight">
            {group.genus} {group.name}
          </p>
          <p className="text-[10px] text-forest-500 font-mono leading-tight">
            {group.type ?? '—'} · {cultivars.length} cultivar{cultivars.length === 1 ? '' : 's'}
          </p>
        </button>
        <Badge tone="forest">{cultivars.length}</Badge>
        <button
          onClick={onToggle}
          className="w-7 h-7 inline-flex items-center justify-center rounded-btn-sm hover:bg-bone-300/40 text-forest-500 transition-colors flex-shrink-0"
          title={expanded ? 'Suskleisti' : 'Išskleisti cultivars'}
        >
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
      </div>

      {expanded && cultivars.length > 0 && (
        <div className="border-t border-bone-400/30 bg-bone-100/30">
          {cultivars.map(c => (
            <button
              key={c.id}
              onClick={() => onEditCultivar(c)}
              className="w-full flex items-center gap-2.5 pl-10 pr-2.5 py-1.5 hover:bg-bone-100/70 border-b border-bone-400/20 last:border-b-0 text-left transition-colors"
            >
              <div className="w-7 h-7 flex-shrink-0 rounded-md overflow-hidden bg-bone-200 flex items-center justify-center">
                {c.image ? (
                  <img src={c.image} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <ImageOff size={11} className="text-forest-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-forest-700 truncate leading-tight">
                  {c.lietuviškas || '—'}
                </p>
                <p className="text-[10px] text-forest-500 italic truncate leading-tight">{c.lotyniskas}</p>
              </div>
              <ChevronRight size={11} className="text-forest-400 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * StandaloneRow — cultivar'as, kuris nepriklauso jokiai serijai (be
 * taxonGroupId). Klikus visur — atidaro cultivar edit drawer'į.
 */
function StandaloneRow({ entry, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`${WIDGET} w-full flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-bone-100/40 text-left transition-colors`}
    >
      <div className="w-9 h-9 flex-shrink-0 rounded-lg overflow-hidden bg-bone-200 flex items-center justify-center">
        {entry.image ? (
          <img src={entry.image} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <ImageOff size={13} className="text-forest-300" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-display text-sm font-semibold text-forest-800 truncate leading-tight">
          {entry.lietuviškas || '—'}
        </p>
        <p className="text-[10px] text-forest-500 italic truncate leading-tight">{entry.lotyniskas}</p>
      </div>
      <Badge tone="bone">standalone</Badge>
      <ChevronRight size={13} className="text-forest-400 flex-shrink-0" />
    </button>
  )
}

// ── Edit drawers ─────────────────────────────────────────────────────

/**
 * Cultivar edit drawer — flat form'as visiems user-facing field'ams. Save
 * patiekia tik diff'us (laukus, kurie iš tiesų pasikeitė), kad Firestore
 * merge'as nepertepiniau be reikalo.
 */
function CultivarEditDrawer({ entry, taxonGroups, onSave, onDelete, onClose }) {
  const [draft, setDraft] = useState(() => normalizeCultivar(entry))
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const update = (k, v) => { setDraft(d => ({ ...d, [k]: v })); setDirty(true) }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Tik dirty field'us per merge
      const patch = {}
      for (const k of Object.keys(draft)) {
        if (draft[k] !== (entry[k] ?? defaultValueFor(k))) patch[k] = draft[k] || null
      }
      if (Object.keys(patch).length === 0) { onClose(); return }
      await onSave(patch)
      setDirty(false)
    } catch {} finally { setSaving(false) }
  }

  return (
    <DrawerShell
      title={entry.lotyniskas || entry.id}
      subtitle="Cultivar"
      onClose={onClose}
      footer={
        <DangerFooter
          dirty={dirty}
          saving={saving}
          onSave={handleSave}
          onDelete={onDelete}
          deleteLabel="Ištrinti iš bibliotekos"
          warning="Cultivar dings iš shared catalog'o."
        />
      }
    >
      <Section label="Identifikacija">
        <FormRow label="Lotyniškas">
          <TextInput value={draft.lotyniskas} onChange={v => update('lotyniskas', v)} placeholder="Clematis 'Boulevard'" />
        </FormRow>
        <FormRow label="Lietuviškas">
          <TextInput value={draft.lietuviškas} onChange={v => update('lietuviškas', v)} placeholder="Raganė" />
        </FormRow>
        <FormRow label="Serija">
          <select
            value={draft.taxonGroupId ?? ''}
            onChange={e => update('taxonGroupId', e.target.value || null)}
            className="w-full bg-bone-50 border border-bone-400/40 rounded-md px-2 py-1.5 text-xs text-forest-700 focus:outline-none focus:border-forest-500"
          >
            <option value="">— standalone (be serijos) —</option>
            {taxonGroups.map(g => (
              <option key={g.id} value={g.id}>{g.genus} {g.name} ({g.type})</option>
            ))}
          </select>
        </FormRow>
      </Section>

      <Section label="Nuotrauka">
        <FormRow label="Image URL">
          <TextInput value={draft.image} onChange={v => update('image', v)} placeholder="https://..." />
        </FormRow>
        {draft.image && (
          <img src={draft.image} alt="preview" className="w-full max-h-40 object-contain rounded-md bg-bone-200" />
        )}
      </Section>

      <Section label="Aprašymas">
        <FormRow label="Aprašymas"><TextArea value={draft.aprasymas} onChange={v => update('aprasymas', v)} rows={4} /></FormRow>
        <FormRow label="Kilmė"><TextInput value={draft.kilme} onChange={v => update('kilme', v)} /></FormRow>
        <FormRow label="Įdomybės"><TextArea value={draft.idomybes} onChange={v => update('idomybes', v)} rows={3} /></FormRow>
      </Section>

      <Section label="Priežiūra">
        <FormRow label="Šviesa"><TextArea value={draft.sviesa} onChange={v => update('sviesa', v)} rows={2} /></FormRow>
        <FormRow label="Vanduo"><TextArea value={draft.vanduo} onChange={v => update('vanduo', v)} rows={2} /></FormRow>
        <FormRow label="Substratas"><TextArea value={draft.substratas} onChange={v => update('substratas', v)} rows={2} /></FormRow>
        <FormRow label="Persodinimas"><TextArea value={draft.persodinimas} onChange={v => update('persodinimas', v)} rows={2} /></FormRow>
        <FormRow label="Žiemojimas"><TextArea value={draft.ziemojimas} onChange={v => update('ziemojimas', v)} rows={2} /></FormRow>
        <FormRow label="Tręšimas"><TextArea value={draft.tresimas} onChange={v => update('tresimas', v)} rows={2} /></FormRow>
        <FormRow label="Priežiūra"><TextArea value={draft.prieziura} onChange={v => update('prieziura', v)} rows={2} /></FormRow>
      </Section>

      <Section label="Klasifikacija">
        <FormRow label="Tipas"><TextInput value={draft.tipas} onChange={v => update('tipas', v)} placeholder="kambarinis, sodinis…" /></FormRow>
        <FormRow label="Sunkumas"><TextInput value={draft.sunkumas} onChange={v => update('sunkumas', v)} placeholder="lengvas, vidutinis, sunkus" /></FormRow>
        <FormRow label="Augimo greitis"><TextInput value={draft.augimo_greitis} onChange={v => update('augimo_greitis', v)} /></FormRow>
        <FormRow label="Kontekstas">
          <Select value={draft.cultivationContext} onChange={v => update('cultivationContext', v)} options={['', ...CULTIVATION_CONTEXTS]} />
        </FormRow>
        <FormRow label="Lifecycle">
          <Select value={draft.lifecycle} onChange={v => update('lifecycle', v)} options={['', ...LIFECYCLES]} />
        </FormRow>
        <FormRow label="Hardiness"><TextInput value={draft.hardiness} onChange={v => update('hardiness', v)} placeholder="USDA 5-9, -23°C…" /></FormRow>
      </Section>

      <Section label="Meta">
        <Row k="ID" v={<span className="font-mono text-[11px]">{entry.id}</span>} />
        <Row k="Atnaujinta" v={shortDate(entry.updatedAt)} />
      </Section>
    </DrawerShell>
  )
}

/**
 * Series (taxonGroup) edit drawer. Care info čia — `careInfo.*` nested
 * field'as, ne flat (kitaip nei catalog). Visa kita — top-level.
 */
function SeriesEditDrawer({ entry, cultivarCount, onSave, onDelete, onClose }) {
  const [draft, setDraft] = useState(() => normalizeTaxonGroup(entry))
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const update = (path, v) => {
    setDirty(true)
    setDraft(d => {
      if (!path.includes('.')) return { ...d, [path]: v }
      const [head, tail] = path.split('.')
      return { ...d, [head]: { ...(d[head] ?? {}), [tail]: v } }
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Patch'as flat keys + careInfo nested. Atskirai diff'inam careInfo
      // visą object'ą, kad merge'as gerai praeitų.
      const patch = {}
      for (const k of ['genus', 'name', 'type', 'tipas', 'aprasymas', 'idomybes']) {
        if (draft[k] !== (entry[k] ?? '')) patch[k] = draft[k] || null
      }
      const ciDirty = JSON.stringify(draft.careInfo) !== JSON.stringify(entry.careInfo ?? {})
      if (ciDirty) patch.careInfo = draft.careInfo
      if (Object.keys(patch).length === 0) { onClose(); return }
      await onSave(patch)
      setDirty(false)
    } catch {} finally { setSaving(false) }
  }

  return (
    <DrawerShell
      title={`${entry.genus ?? ''} ${entry.name ?? ''}`.trim() || entry.id}
      subtitle={`Serija · ${cultivarCount} cultivar(s)`}
      onClose={onClose}
      footer={
        <DangerFooter
          dirty={dirty}
          saving={saving}
          onSave={handleSave}
          onDelete={onDelete}
          deleteLabel="Ištrinti seriją"
          warning={cultivarCount > 0 ? `${cultivarCount} cultivar(s) taps standalone.` : 'Niekas neprilinkuota.'}
        />
      }
    >
      <Section label="Identifikacija">
        <FormRow label="Genus"><TextInput value={draft.genus} onChange={v => update('genus', v)} /></FormRow>
        <FormRow label="Pavadinimas"><TextInput value={draft.name} onChange={v => update('name', v)} /></FormRow>
        <FormRow label="Tipas">
          <Select value={draft.type} onChange={v => update('type', v)} options={['', ...TAXON_GROUP_TYPES]} />
        </FormRow>
      </Section>

      <Section label="Aprašymas">
        <FormRow label="Tipas (laisvas)"><TextInput value={draft.tipas} onChange={v => update('tipas', v)} placeholder="kambarinis, sodinis…" /></FormRow>
        <FormRow label="Aprašymas"><TextArea value={draft.aprasymas} onChange={v => update('aprasymas', v)} rows={4} /></FormRow>
        <FormRow label="Įdomybės"><TextArea value={draft.idomybes} onChange={v => update('idomybes', v)} rows={3} /></FormRow>
      </Section>

      <Section label="Care šablonas (paveldimas cultivars'ams)">
        {/* Object-shaped fields — JsonField'ai (sviesa, vanduo, tresimas,
            prieziura, laistymasIntervalas). String fields — TextArea
            (substratas, persodinimas, ziemojimas). Žiūr. TOOL_BULK_SERIES
            schema'ą — struktūra atitinka. */}
        <FormRow label="Šviesa (object)">
          <JsonField value={draft.careInfo.sviesa} onChange={v => update('careInfo.sviesa', v)} />
        </FormRow>
        <FormRow label="Vanduo (object)">
          <JsonField value={draft.careInfo.vanduo} onChange={v => update('careInfo.vanduo', v)} />
        </FormRow>
        <FormRow label="Laistymo intervalas (object)">
          <JsonField value={draft.careInfo.laistymasIntervalas} onChange={v => update('careInfo.laistymasIntervalas', v)} />
        </FormRow>
        <FormRow label="Tręšimas (object)">
          <JsonField value={draft.careInfo.tresimas} onChange={v => update('careInfo.tresimas', v)} />
        </FormRow>
        <FormRow label="Priežiūra (object)">
          <JsonField value={draft.careInfo.prieziura} onChange={v => update('careInfo.prieziura', v)} />
        </FormRow>
        <FormRow label="Substratas (text)">
          <TextArea value={draft.careInfo.substratas} onChange={v => update('careInfo.substratas', v)} rows={2} />
        </FormRow>
        <FormRow label="Persodinimas (text)">
          <TextArea value={draft.careInfo.persodinimas} onChange={v => update('careInfo.persodinimas', v)} rows={2} />
        </FormRow>
        <FormRow label="Žiemojimas (text)">
          <TextArea value={draft.careInfo.ziemojimas} onChange={v => update('careInfo.ziemojimas', v)} rows={2} />
        </FormRow>
      </Section>

      <Section label="Meta">
        <Row k="ID" v={<span className="font-mono text-[11px]">{entry.id}</span>} />
        <Row k="Atnaujinta" v={shortDate(entry.updatedAt)} />
        <Row k="Cultivars" v={<Badge tone="forest">{cultivarCount}</Badge>} />
      </Section>
    </DrawerShell>
  )
}

// ── Drawer shell + danger footer ─────────────────────────────────────

function DrawerShell({ title, subtitle, children, footer, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <button className="flex-1 bg-forest-900/30" onClick={onClose} aria-label="Uždaryti" />
      <div className="w-[480px] max-w-[92vw] h-full bg-bone-50 border-l border-bone-400/40 flex flex-col">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-bone-400/40 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-forest-500">{subtitle}</p>
            <h2 className="font-display text-base font-semibold tracking-tight text-forest-800 truncate italic">{title}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 inline-flex items-center justify-center rounded-btn-sm hover:bg-bone-300/40 text-forest-600">
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">{children}</div>
        {footer}
      </div>
    </div>
  )
}

function DangerFooter({ dirty, saving, onSave, onDelete, deleteLabel, warning }) {
  return (
    <div className="border-t border-bone-400/40 flex-shrink-0">
      <div className="px-5 py-3 flex gap-2 bg-bone-100/50">
        <button
          onClick={onSave}
          disabled={!dirty || saving}
          className="flex-1 inline-flex items-center justify-center gap-2 bg-forest-600 hover:bg-forest-700 disabled:bg-bone-300 disabled:text-forest-400 text-bone px-4 py-2.5 rounded-btn text-sm font-semibold transition-colors"
        >
          <Save size={14} /> {saving ? 'Saugoma…' : dirty ? 'Išsaugoti' : 'Be pakeitimų'}
        </button>
      </div>
      <div className="bg-terracotta-50/40 border-t border-terracotta-200/40 px-5 py-3">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-terracotta-600 mb-2 flex items-center gap-1.5">
          <AlertTriangle size={11} /> Danger zone
        </p>
        <button
          onClick={onDelete}
          className="w-full inline-flex items-center justify-center gap-2 bg-terracotta hover:bg-terracotta-500 text-bone px-4 py-2 rounded-btn text-sm font-semibold transition-colors"
        >
          <Trash2 size={14} /> {deleteLabel}
        </button>
        <p className="text-[10px] text-terracotta-600 mt-2 text-center">{warning}</p>
      </div>
    </div>
  )
}

// ── Form atoms + utils ───────────────────────────────────────────────

function FormRow({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-forest-500 block">{label}</label>
      {children}
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
  return (
    <textarea
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full bg-bone-50 border border-bone-400/40 rounded-md px-2 py-1.5 text-xs text-forest-800 leading-relaxed focus:outline-none focus:border-forest-500 resize-none"
    />
  )
}

/**
 * JsonField — strukturizuotų objektų (taxonGroup care info — sviesa, vanduo,
 * tresimas, prieziura, laistymasIntervalas) editor'ius. Rodom kaip pretty
 * printed JSON monospace font'u, ant save'o parse'inam atgal į object'ą.
 *
 * Jei admin'as įveda invalid JSON'ą — vizualus indikatorius parodo, ir save
 * pasiunčia raw string'ą (kad neprarastume admin'o darbo). Geriau bloga
 * data nei prarastas edit'as.
 */
function JsonField({ value, onChange, rows = 6 }) {
  const [text, setText] = useState(() => jsonStringify(value))
  const [valid, setValid] = useState(true)

  // Re-sync kai parent value pasikeičia (pvz. po save'o)
  useEffect(() => { setText(jsonStringify(value)); setValid(true) }, [value])

  const handleChange = (next) => {
    setText(next)
    if (!next.trim()) { setValid(true); onChange(null); return }
    try {
      onChange(JSON.parse(next))
      setValid(true)
    } catch {
      setValid(false)
      onChange(next)  // raw string'as — saugiau nei prarasti admin'o darbą
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
  if (typeof val === 'string') return val   // backward compat — jei seniau buvo plain text
  try { return JSON.stringify(val, null, 2) } catch { return String(val ?? '') }
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-bone-50 border border-bone-400/40 rounded-md px-2 py-1.5 text-xs text-forest-700 focus:outline-none focus:border-forest-500"
    >
      {options.map(opt => <option key={opt || '_'} value={opt}>{opt || '— nenurodyta —'}</option>)}
    </select>
  )
}

function Section({ label, children }) {
  return (
    <div>
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-forest-500 mb-2 px-1">{label}</p>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Row({ k, v }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm border-b border-bone-400/20 py-1.5 px-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-forest-400">{k}</span>
      <span className="text-forest-700 text-right text-xs max-w-[60%] truncate">{v}</span>
    </div>
  )
}

function Th({ children, center }) {
  return <th className={`font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-forest-500 px-3 py-2.5 ${center ? 'text-center' : ''}`}>{children}</th>
}
function Td({ children, center }) {
  return <td className={`px-3 py-2.5 align-middle ${center ? 'text-center' : ''}`}>{children}</td>
}
function Badge({ children, tone = 'forest' }) {
  const cls = tone === 'forest' ? 'bg-forest-100 text-forest-700' : 'bg-bone-300 text-forest-600'
  return <span className={`inline-flex font-mono text-[11px] font-medium tabular-nums px-1.5 py-0.5 rounded-full ${cls}`}>{children}</span>
}

// ── Defaults (kad ne'undefined → tuščias string'as) ──────────────────

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
      // Object-shaped fields — laikom kaip objektus (arba null), ne string'us.
      // JsonField stringify'ina UI'e, parse'ina ant save'o.
      sviesa:              g.careInfo?.sviesa              ?? null,
      vanduo:              g.careInfo?.vanduo              ?? null,
      laistymasIntervalas: g.careInfo?.laistymasIntervalas ?? null,
      tresimas:            g.careInfo?.tresimas            ?? null,
      prieziura:           g.careInfo?.prieziura           ?? null,
      // String-shaped fields (per schema'ą)
      substratas:          g.careInfo?.substratas          ?? '',
      persodinimas:        g.careInfo?.persodinimas        ?? '',
      ziemojimas:          g.careInfo?.ziemojimas          ?? '',
    },
  }
}

function defaultValueFor(_k) { return '' }

// ── TEMPORARY: parser audit button ─────────────────────────────────
//
// Paspaudus, paleidžia `parseLatinName` ant visų catalog + taxonGroups
// įrašų. Console.log'ina rank distribution + samples + suspicious
// atvejus. Naudojama vienkartiniam parser'io verification'ui prieš
// statant `ensureSpeciesTaxonGroup` flow'us. Galima ištrinti po to.
function AuditParserButton({ catalog, taxonGroups }) {
  const handleAudit = () => {
    const rankCounts = {}
    const samples = { species: [], cultivar: [], hybrid: [], variety: [], subspecies: [], forma: [], genus: [], unknown: [] }
    const suspicious = []

    const entries = [
      ...catalog.map(c => ({ kind: 'catalog', id: c.id, latin: c.lotyniskas, data: c })),
      ...taxonGroups.map(g => ({ kind: 'taxonGroup', id: g.id, latin: g.scientificName || `${g.genus ?? ''} ${g.name ?? ''}`.trim(), data: g })),
    ]

    for (const entry of entries) {
      if (!entry.latin) {
        suspicious.push({ ...entry, why: 'tuščias latinName' })
        continue
      }
      const parsed = parseLatinName(entry.latin)
      rankCounts[parsed.rank] = (rankCounts[parsed.rank] ?? 0) + 1
      if (samples[parsed.rank] && samples[parsed.rank].length < 5) {
        samples[parsed.rank].push({ id: entry.id, latin: entry.latin, parsed })
      }
      if (parsed.rank === 'unknown') {
        suspicious.push({ ...entry, parsed, why: 'parser rank=unknown' })
      } else if (/['"]/.test(entry.latin) && (parsed.rank === 'species' || parsed.rank === 'genus')) {
        suspicious.push({ ...entry, parsed, why: 'turi kabutes bet parser sako ne-cultivar' })
      } else if (parsed.rank === 'cultivar' && !parsed.genus) {
        suspicious.push({ ...entry, parsed, why: 'cultivar be genus' })
      }
    }

    console.log('═══ PARSER AUDIT ═══')
    console.log(`Total entries: ${entries.length} (catalog: ${catalog.length}, taxonGroups: ${taxonGroups.length})\n`)
    console.log('Rank distribution:')
    console.table(rankCounts)
    console.log('\nSamples per rank:')
    for (const [rank, list] of Object.entries(samples)) {
      if (list.length === 0) continue
      console.group(`${rank} (${list.length})`)
      for (const s of list) {
        console.log(`  "${s.latin}" →`, s.parsed)
      }
      console.groupEnd()
    }
    if (suspicious.length > 0) {
      console.group(`⚠ Suspicious (${suspicious.length})`)
      for (const s of suspicious) {
        console.log(`[${s.why}] kind=${s.kind} id=${s.id}`)
        console.log(`  latin: "${s.latin}"`)
        if (s.parsed) console.log(`  parsed:`, s.parsed)
      }
      console.groupEnd()
    } else {
      console.log('✓ Visi įrašai parser\'iui pažįstami.')
    }

    const susCount = suspicious.length
    alert(
      susCount === 0
        ? `✓ Audit OK — ${entries.length} įrašai, 0 problemų. Detalės console'je.`
        : `⚠ ${susCount} suspicious įrašai iš ${entries.length}. Žiūr. console.`
    )
  }

  return (
    <button
      onClick={handleAudit}
      className="text-[11px] font-mono uppercase tracking-[0.14em] px-3 py-2 rounded-btn border border-forest-200 text-forest-600 hover:bg-forest-50 transition-colors"
      title="Paleidžia parseLatinName ant visų catalog + taxonGroups. Console.log'ina rezultatus."
    >
      🔍 Audit parser
    </button>
  )
}


