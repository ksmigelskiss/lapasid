import { useState, useMemo } from 'react'
import { Search, X, ChevronRight, Trash2, AlertTriangle, Save, ImageOff, BookOpen, Layers } from 'lucide-react'
import { TAXON_GROUP_TYPES, CULTIVATION_CONTEXTS, LIFECYCLES } from '../../utils/taxonGroups'

/**
 * LibraryTab — admin'as redaguoja shared knowledge base'ą:
 *   • catalog/{id}      — individualūs cultivars/species (rūšiniai field'ai,
 *                         care info, image, taxonGroupId ref)
 *   • taxonGroups/{id}  — parent serijos / species / hybrid'ai (shared care
 *                         šablonai, kurie paveldimi catalog cultivar'iams)
 *
 * Du sub-tabs vienoje vietoje, klik per row → edit drawer iš dešinės.
 * Save'inimas merge'inimu (setDoc + merge:true) per parent callback'us iš
 * AdminPanel'io, kad state'as toje pačioje vietoje liktų ir mažos refresh'os
 * nekartotų loadAll.
 */

const WIDGET = 'bg-bone-50 rounded-2xl border border-bone-400/40 shadow-[0_1px_3px_rgba(28,58,42,0.06),0_4px_14px_rgba(28,58,42,0.05)]'

function shortDate(iso) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('lt-LT', { year: '2-digit', month: 'short', day: 'numeric' }) }
  catch { return '—' }
}

export default function LibraryTab({
  catalog, taxonGroups,
  onSaveCatalog, onDeleteCatalog,
  onSaveTaxonGroup, onDeleteTaxonGroup,
}) {
  const [subTab, setSubTab]   = useState('cultivars')      // 'cultivars' | 'series'
  const [search, setSearch]   = useState('')
  const [editing, setEditing] = useState(null)             // { type, entry } | null

  // Map taxonGroup ID → name lookup'as cultivar lentelei
  const groupById = useMemo(() => new Map(taxonGroups.map(g => [g.id, g])), [taxonGroups])

  // Cultivar count'ai per seriją serijų lentelei
  const cultivarCountByGroup = useMemo(() => {
    const m = new Map()
    for (const c of catalog) {
      if (c.taxonGroupId) m.set(c.taxonGroupId, (m.get(c.taxonGroupId) ?? 0) + 1)
    }
    return m
  }, [catalog])

  // Filter'is — fuzzy lookup pagal kelis field'us
  const filteredCatalog = useMemo(() => {
    if (!search.trim()) return catalog
    const q = search.toLowerCase()
    return catalog.filter(c =>
      (c.lotyniskas ?? '').toLowerCase().includes(q) ||
      (c.lietuviskas ?? '').toLowerCase().includes(q) ||
      (c.taxonGroupId ?? '').toLowerCase().includes(q)
    )
  }, [catalog, search])

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return taxonGroups
    const q = search.toLowerCase()
    return taxonGroups.filter(g =>
      (g.genus ?? '').toLowerCase().includes(q) ||
      (g.name ?? '').toLowerCase().includes(q) ||
      (g.type ?? '').toLowerCase().includes(q)
    )
  }, [taxonGroups, search])

  return (
    <>
      {/* Sub-tab switcher + search */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <nav className="inline-flex bg-bone-100 rounded-btn p-1 gap-0.5">
          <SubTabBtn active={subTab === 'cultivars'} onClick={() => setSubTab('cultivars')} Icon={BookOpen} label="Cultivars" count={catalog.length} />
          <SubTabBtn active={subTab === 'series'} onClick={() => setSubTab('series')} Icon={Layers} label="Serijos" count={taxonGroups.length} />
        </nav>
        <div className="flex-1 min-w-[200px] max-w-md relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={subTab === 'cultivars' ? 'Lotyniškas, lietuviškas, serija…' : 'Genus, pavadinimas, tipas…'}
            className="w-full pl-9 pr-3 py-2 text-sm bg-bone-50 border border-bone-400/40 rounded-btn focus:outline-none focus:border-forest-500"
          />
        </div>
      </div>

      {subTab === 'cultivars' ? (
        <CultivarsTable
          rows={filteredCatalog}
          groupById={groupById}
          onSelect={c => setEditing({ type: 'cultivar', entry: c })}
        />
      ) : (
        <SeriesTable
          rows={filteredGroups}
          cultivarCountByGroup={cultivarCountByGroup}
          onSelect={g => setEditing({ type: 'series', entry: g })}
        />
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
          cultivarCount={cultivarCountByGroup.get(editing.entry.id) ?? 0}
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

// ── Tables ───────────────────────────────────────────────────────────

function CultivarsTable({ rows, groupById, onSelect }) {
  if (!rows.length) return <p className="text-center text-forest-500 py-12">Nėra įrašų</p>
  return (
    <div className={`overflow-hidden ${WIDGET}`}>
      <table className="w-full text-sm">
        <thead className="bg-bone-100 border-b border-bone-400/40">
          <tr className="text-left">
            <Th>Image</Th>
            <Th>Lotyniškas</Th>
            <Th>Lietuviškas</Th>
            <Th>Serija</Th>
            <Th>Atnaujinta</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(c => {
            const group = c.taxonGroupId ? groupById.get(c.taxonGroupId) : null
            return (
              <tr key={c.id} onClick={() => onSelect(c)} className="border-b border-bone-400/20 hover:bg-bone-100/50 cursor-pointer transition-colors">
                <Td>
                  {c.image ? (
                    <img src={c.image} alt="" className="w-10 h-10 rounded-md object-cover bg-bone-200" loading="lazy" />
                  ) : (
                    <div className="w-10 h-10 rounded-md bg-bone-200 inline-flex items-center justify-center text-forest-300">
                      <ImageOff size={14} />
                    </div>
                  )}
                </Td>
                <Td>
                  <div className="font-medium text-forest-800 italic">{c.lotyniskas || '—'}</div>
                  <div className="text-[10px] text-forest-400 font-mono">{c.id}</div>
                </Td>
                <Td><span className="text-forest-700">{c.lietuviskas || '—'}</span></Td>
                <Td>
                  {group ? (
                    <Badge tone="forest">{group.genus} {group.name}</Badge>
                  ) : (
                    <span className="text-xs text-forest-300">standalone</span>
                  )}
                </Td>
                <Td><span className="text-xs text-forest-500">{shortDate(c.updatedAt)}</span></Td>
                <Td><ChevronRight size={16} className="text-forest-400" /></Td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SeriesTable({ rows, cultivarCountByGroup, onSelect }) {
  if (!rows.length) return <p className="text-center text-forest-500 py-12">Nėra serijų</p>
  return (
    <div className={`overflow-hidden ${WIDGET}`}>
      <table className="w-full text-sm">
        <thead className="bg-bone-100 border-b border-bone-400/40">
          <tr className="text-left">
            <Th>Genus</Th>
            <Th>Pavadinimas</Th>
            <Th>Tipas</Th>
            <Th center>Cultivars</Th>
            <Th>Atnaujinta</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(g => (
            <tr key={g.id} onClick={() => onSelect(g)} className="border-b border-bone-400/20 hover:bg-bone-100/50 cursor-pointer transition-colors">
              <Td><span className="font-medium text-forest-800 italic">{g.genus || '—'}</span></Td>
              <Td>
                <div className="text-forest-700">{g.name || '—'}</div>
                <div className="text-[10px] text-forest-400 font-mono">{g.id}</div>
              </Td>
              <Td><Badge tone="bone">{g.type || '—'}</Badge></Td>
              <Td center><Badge tone="forest">{cultivarCountByGroup.get(g.id) ?? 0}</Badge></Td>
              <Td><span className="text-xs text-forest-500">{shortDate(g.updatedAt)}</span></Td>
              <Td><ChevronRight size={16} className="text-forest-400" /></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
          <TextInput value={draft.lietuviskas} onChange={v => update('lietuviskas', v)} placeholder="Raganė" />
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
        <FormRow label="Šviesa"><TextArea value={draft.careInfo.sviesa} onChange={v => update('careInfo.sviesa', v)} rows={2} /></FormRow>
        <FormRow label="Vanduo"><TextArea value={draft.careInfo.vanduo} onChange={v => update('careInfo.vanduo', v)} rows={2} /></FormRow>
        <FormRow label="Substratas"><TextArea value={draft.careInfo.substratas} onChange={v => update('careInfo.substratas', v)} rows={2} /></FormRow>
        <FormRow label="Persodinimas"><TextArea value={draft.careInfo.persodinimas} onChange={v => update('careInfo.persodinimas', v)} rows={2} /></FormRow>
        <FormRow label="Žiemojimas"><TextArea value={draft.careInfo.ziemojimas} onChange={v => update('careInfo.ziemojimas', v)} rows={2} /></FormRow>
        <FormRow label="Tręšimas"><TextArea value={draft.careInfo.tresimas} onChange={v => update('careInfo.tresimas', v)} rows={2} /></FormRow>
        <FormRow label="Priežiūra"><TextArea value={draft.careInfo.prieziura} onChange={v => update('careInfo.prieziura', v)} rows={2} /></FormRow>
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

function SubTabBtn({ active, onClick, Icon, label, count }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn-sm text-xs font-medium transition-colors ${
        active ? 'bg-forest-100 text-forest-700' : 'text-forest-500 hover:text-forest-700'
      }`}
    >
      <Icon size={13} />
      {label}
      {count != null && (
        <span className="font-mono text-[10px] tabular-nums text-forest-400">({count})</span>
      )}
    </button>
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
    lietuviskas:        c.lietuviskas        ?? '',
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
      sviesa:       g.careInfo?.sviesa       ?? '',
      vanduo:       g.careInfo?.vanduo       ?? '',
      substratas:   g.careInfo?.substratas   ?? '',
      persodinimas: g.careInfo?.persodinimas ?? '',
      ziemojimas:   g.careInfo?.ziemojimas   ?? '',
      tresimas:     g.careInfo?.tresimas     ?? '',
      prieziura:    g.careInfo?.prieziura    ?? '',
    },
  }
}

function defaultValueFor(_k) { return '' }
