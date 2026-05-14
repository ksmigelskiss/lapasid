import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, Search, Notebook, Copy, MessageCircle, Trash2, Plus, Bookmark } from 'lucide-react'
import ZinynasChat from '../components/ZinynasChat'
import { useIsDesktop } from '../hooks/useIsDesktop'

function Highlight({ text, query }) {
  if (!query.trim()) return <>{text}</>
  const regex = new RegExp(`(${query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part)
          ? <mark key={i} className="bg-forest-100 text-forest-800 rounded px-0.5 not-italic">{part}</mark>
          : part
      )}
    </>
  )
}

function formatDateShort(iso) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('lt-LT', { month: 'short', day: 'numeric' })
}

// Pirma non-empty eilutė kaip title (su markdown žymeklių stripping'u). Esamoms
// žinutėms be explicit title field — auto-extract'as veikia kaip natural fallback.
function extractTitle(text) {
  if (!text) return '(tuščia)'
  const firstLine = text.split('\n').find(l => l.trim().length > 0) || ''
  const stripped = firstLine
    .replace(/^#+\s*/, '')           // ## heading marks
    .replace(/\*\*(.+?)\*\*/g, '$1') // bold
    .replace(/\*(.+?)\*/g, '$1')     // italic
    .replace(/`(.+?)`/g, '$1')       // code
    .replace(/^[-*]\s+/, '')         // list bullet
    .trim()
  return stripped.slice(0, 80) || '(tuščia)'
}

// ── Mobile card (esamas list/expand pattern) ─────────────────────
function ZinynasCard({ entry, expanded, onToggle, onDelete, onToggleStar, onChat, query }) {
  const [copied, setCopied] = useState(false)

  const copy = e => {
    e.stopPropagation()
    navigator.clipboard.writeText(entry.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <motion.div
      className="bg-bone-50 rounded-2xl px-4 py-3.5 cursor-pointer shadow-ios active:bg-bone-300/40 transition-colors"
      onClick={onToggle}
      layout
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-start gap-2">
        <p className={`flex-1 text-sm text-forest-700 leading-relaxed whitespace-pre-wrap ${expanded ? '' : 'line-clamp-3'}`}>
          <Highlight text={entry.text} query={query} />
        </p>
        <button
          onClick={e => { e.stopPropagation(); onToggleStar() }}
          className="flex-shrink-0 text-base leading-none mt-0.5 transition-transform active:scale-90"
        >
          {entry.starred
            ? <Star size={14} className="text-terracotta-400 fill-terracotta-400" />
            : <Star size={14} className="text-forest-400" />
          }
        </button>
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <div className="flex items-center gap-1.5">
          {entry.plantName && (
            <span className="text-[11px] text-forest-500">{entry.plantName} ·</span>
          )}
          <span className="text-[11px] text-forest-400">{formatDateShort(entry.date)}</span>
        </div>
        {expanded && (
          <div className="flex items-center gap-3">
            <button onClick={copy} className="inline-flex items-center gap-1 text-xs text-forest-500 hover:text-forest-700 font-medium transition-colors">
              <Copy size={11} />{copied ? 'Nukopijuota' : 'Kopijuoti'}
            </button>
            <button onClick={e => { e.stopPropagation(); onChat() }} className="inline-flex items-center gap-1 text-xs text-forest-500 hover:text-forest-700 font-medium transition-colors">
              <MessageCircle size={11} /> Aptarti
            </button>
            <button onClick={e => { e.stopPropagation(); onDelete() }} className="inline-flex items-center gap-1 text-xs text-terracotta-500 hover:text-terracotta-600 font-medium transition-colors">
              <Trash2 size={11} /> Ištrinti
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// Title priority — explicit `entry.title` jei vartotojas jį override'ino,
// kitu atveju auto-extract iš pirmos eilutės.
function displayTitle(entry) {
  return entry.title?.trim() || extractTitle(entry.text)
}

// ── Desktop sidebar list item (kompaktiškai — tik title + meta) ───
function ZinynasListItem({ entry, selected, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-4 py-3 border-l-2 transition-colors ${
        selected
          ? 'bg-forest-50 border-l-forest-500'
          : 'border-l-transparent hover:bg-bone-300/40'
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate ${selected ? 'text-forest-800' : 'text-forest-800'}`}>
            {displayTitle(entry)}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {entry.plantName && (
              <span className="text-[11px] text-forest-500 truncate">{entry.plantName} ·</span>
            )}
            <span className="text-[11px] text-forest-400">{formatDateShort(entry.date)}</span>
          </div>
        </div>
        {entry.starred && (
          <Star size={12} className="text-terracotta-400 fill-terracotta-400 mt-1 flex-shrink-0" />
        )}
      </div>
    </button>
  )
}

// ── Desktop detail pane (full content + actions) ─────────────────
function ZinynasDetail({ entry, onDelete, onToggleStar, onChat, onUpdateTitle, query }) {
  const [copied, setCopied] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft]     = useState('')

  // Kai pasirenkama kita žinutė — uždarom title edit režimą (kad nepasiliktų
  // stale draft'as iš ankstesnės)
  useEffect(() => {
    setEditingTitle(false)
    setTitleDraft('')
  }, [entry?.id])

  if (!entry) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-3">
        <Notebook size={40} className="text-forest-300" strokeWidth={1.5} />
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest-500">Pasirink iš sąrašo</p>
      </div>
    )
  }

  const copy = () => {
    navigator.clipboard.writeText(entry.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const startEdit = () => {
    setTitleDraft(displayTitle(entry))
    setEditingTitle(true)
  }

  const saveTitle = () => {
    const trimmed = titleDraft.trim()
    const current = displayTitle(entry)
    // Jeigu vartotojas grąžino į auto-extract'o tekstą, paliekam title null
    // (kad ateity, pasikeitus pirmai eilutei, title atsinaujintų natūraliai).
    const newTitle = !trimmed || trimmed === extractTitle(entry.text) ? null : trimmed
    if (newTitle !== (entry.title ?? null)) onUpdateTitle?.(entry.id, newTitle)
    setEditingTitle(false)
    setTitleDraft('')
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Detail header — title + meta + actions */}
      <div className="flex items-start gap-3 px-8 py-5 border-b border-bone-400/40 flex-shrink-0">
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); e.target.blur() }
                if (e.key === 'Escape') { setEditingTitle(false); setTitleDraft('') }
              }}
              className="w-full font-display text-xl font-semibold tracking-tight text-forest-800 leading-tight bg-transparent outline-none border-b-2 border-forest-400 pb-0.5"
            />
          ) : (
            <h2
              onClick={startEdit}
              className="font-display text-xl font-semibold tracking-tight text-forest-800 leading-tight cursor-text hover:text-forest-700 transition-colors"
              title="Spustelėk redaguoti pavadinimą"
            >
              {displayTitle(entry)}
            </h2>
          )}
          <div className="flex items-center gap-1.5 mt-1.5">
            {entry.plantName && (
              <span className="text-xs text-forest-500">{entry.plantName} ·</span>
            )}
            <span className="text-xs text-forest-400">{formatDateShort(entry.date)}</span>
          </div>
        </div>
        <button
          onClick={onToggleStar}
          className="flex-shrink-0 transition-transform active:scale-90 mt-1"
          title={entry.starred ? 'Pašalinti iš mėgstamų' : 'Pridėti į mėgstamus'}
        >
          {entry.starred
            ? <Star size={18} className="text-terracotta-400 fill-terracotta-400" />
            : <Star size={18} className="text-forest-300 hover:text-forest-500" />
          }
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-none px-8 py-5">
        <p className="text-[15px] text-forest-700 leading-relaxed whitespace-pre-wrap">
          <Highlight text={entry.text} query={query} />
        </p>
      </div>

      {/* Actions bar */}
      <div className="flex items-center gap-2 px-8 py-3 border-t border-bone-400/40 flex-shrink-0">
        <button onClick={copy} className="inline-flex items-center gap-1.5 text-xs text-forest-700 hover:text-forest-800 font-medium px-3 py-2 rounded-btn-sm hover:bg-bone-300/40 transition-colors">
          <Copy size={12} />{copied ? 'Nukopijuota' : 'Kopijuoti'}
        </button>
        <button onClick={onChat} className="inline-flex items-center gap-1.5 text-xs text-forest-700 hover:text-forest-800 font-medium px-3 py-2 rounded-btn-sm hover:bg-bone-300/40 transition-colors">
          <MessageCircle size={12} /> Aptarti
        </button>
        <div className="flex-1" />
        <button onClick={onDelete} className="inline-flex items-center gap-1.5 text-xs text-terracotta-500 hover:text-terracotta-600 font-medium px-3 py-2 rounded-btn-sm hover:bg-terracotta-50 transition-colors">
          <Trash2 size={12} /> Ištrinti
        </button>
      </div>
    </div>
  )
}

export default function Zinynas({ entries, onAdd, onDelete, onToggleStar, onUpdateTitle, plants }) {
  const isDesktop = useIsDesktop()
  const [selectedId, setSelected]  = useState(null)
  const [adding, setAdding]        = useState(false)
  const [newText, setNewText]      = useState('')
  const [query, setQuery]          = useState('')
  const [chatEntry, setChatEntry]  = useState(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? entries.filter(e => e.text.toLowerCase().includes(q)) : entries
    return [...list].sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0))
  }, [entries, query])

  // Desktop: jei nėra pasirinktos žinutės, automatiškai pasirenkam pirmą iš sąrašo.
  useEffect(() => {
    if (!isDesktop) return
    if (selectedId && filtered.some(e => e.id === selectedId)) return
    setSelected(filtered[0]?.id ?? null)
  }, [isDesktop, filtered, selectedId])

  const selectedEntry = filtered.find(e => e.id === selectedId) ?? null

  const add = () => {
    const trimmed = newText.trim()
    if (!trimmed) return
    onAdd({ text: trimmed, source: 'manual', plantId: null, plantName: null })
    setNewText('')
    setAdding(false)
  }

  const handleDelete = (id) => {
    onDelete(id)
    if (selectedId === id) setSelected(null)
  }

  // ── Mobile add textarea overlay (lieka kaip esamas) ────────────
  const addOverlay = (
    <AnimatePresence>
      {adding && (
        <motion.div
          className="space-y-2"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          <textarea
            className="w-full bg-bone-50 border border-bone-400/40 rounded-2xl px-4 py-3 text-sm text-forest-700 placeholder-forest-400 outline-none resize-none focus:border-forest-400 transition-colors"
            rows={5}
            value={newText}
            onChange={e => setNewText(e.target.value)}
            placeholder="Nauja žinyno mintis..."
            autoFocus
          />
          <div className="flex gap-2">
            <button onClick={() => { setAdding(false); setNewText('') }} className="flex-1 py-2.5 rounded-btn text-sm font-display font-semibold text-forest-600 bg-bone-300/60 hover:bg-bone-400/60 transition-colors">
              Atšaukti
            </button>
            <button onClick={add} disabled={!newText.trim()} className="flex-1 py-2.5 rounded-btn text-sm font-display font-semibold text-bone bg-forest-700 hover:bg-forest-800 disabled:opacity-40 transition-colors">
              Išsaugoti
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  // ── Search input (bendras tiek mobile, tiek desktop'ui) ─────────
  const searchInput = (
    <div className="relative">
      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-forest-400" />
      <input
        type="text"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="nope"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck="false"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Ieškoti žinyne..."
        className="w-full bg-bone-50 border border-bone-400/40 rounded-2xl pl-9 pr-4 py-2.5 text-sm text-forest-700 placeholder-forest-400 outline-none focus:border-forest-400 transition-colors"
      />
      {query && (
        <button onClick={() => setQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-forest-400 text-xs">✕</button>
      )}
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-bone">
      {/* Header — visiems vienodas */}
      <div className="px-5 pb-3 flex-shrink-0" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-forest-500 mb-1">Sodininkystė</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-forest-800 leading-tight">Žinynas</h1>
      </div>

      {isDesktop ? (
        // ─────── DESKTOP: 2-pane Notes pattern ───────
        <div className="flex-1 flex min-h-0 border-t border-bone-400/40">
          {/* Sidebar — titles + dates list */}
          <div className="w-[320px] flex-shrink-0 flex flex-col border-r border-bone-400/40 bg-bone-50">
            <div className="px-4 py-3 flex-shrink-0 space-y-2">
              {searchInput}
              <button
                onClick={() => setAdding(true)}
                className="w-full py-2 rounded-btn inline-flex items-center justify-center gap-1.5 text-sm font-display font-semibold text-forest-700 bg-bone-50 border border-bone-400/50 hover:bg-bone-300/40 transition-colors"
              >
                <Plus size={14} /> Nauja žinutė
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-none">
              {adding && (
                <div className="p-3 border-b border-bone-400/40">{addOverlay}</div>
              )}
              {filtered.map(entry => (
                <ZinynasListItem
                  key={entry.id}
                  entry={entry}
                  selected={selectedId === entry.id}
                  onSelect={() => setSelected(entry.id)}
                />
              ))}
              {query && filtered.length === 0 && (
                <div className="text-center py-12 px-4">
                  <p className="text-sm text-forest-400">Nerasta įrašų pagal „{query}"</p>
                </div>
              )}
              {!query && entries.length === 0 && !adding && (
                <div className="text-center py-12 px-4 flex flex-col items-center gap-2.5">
                  <Notebook size={32} className="text-forest-300" strokeWidth={1.5} />
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest-500">Žinynas tuščias</p>
                  <p className="text-xs text-forest-500 leading-relaxed">
                    Išsaugokite mintis spausdami <span className="font-semibold text-forest-700">„Nauja žinutė"</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Detail pane */}
          <ZinynasDetail
            entry={selectedEntry}
            onDelete={() => handleDelete(selectedEntry.id)}
            onToggleStar={() => onToggleStar(selectedEntry.id)}
            onChat={() => setChatEntry(selectedEntry)}
            onUpdateTitle={onUpdateTitle}
            query={query}
          />
        </div>
      ) : (
        // ─────── MOBILE: esamas list/expand ─────────
        <>
          <div className="px-5 pb-3 flex-shrink-0">{searchInput}</div>
          <div className="flex-1 overflow-y-auto scrollbar-none px-5 pb-32">
            <div className="space-y-2">
              {addOverlay}
              {filtered.map(entry => (
                <ZinynasCard
                  key={entry.id}
                  entry={entry}
                  expanded={selectedId === entry.id}
                  onToggle={() => setSelected(selectedId === entry.id ? null : entry.id)}
                  onDelete={() => handleDelete(entry.id)}
                  onToggleStar={() => onToggleStar(entry.id)}
                  onChat={() => { setChatEntry(entry); setSelected(null) }}
                  query={query}
                />
              ))}
              {query && filtered.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-sm text-forest-400">Nerasta įrašų pagal „{query}"</p>
                </div>
              )}
              {!query && entries.length === 0 && !adding && (
                <div className="text-center py-16 flex flex-col items-center gap-2.5">
                  <Notebook size={40} className="text-forest-300" strokeWidth={1.5} />
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-forest-500">Žinynas tuščias</p>
                  <p className="text-xs text-forest-500 leading-relaxed px-6">
                    Išsaugokite bendrą informaciją iš pokalbių su AI per <Bookmark size={12} className="inline align-text-bottom mx-0.5" />
                  </p>
                </div>
              )}
            </div>
          </div>
          {!adding && (
            <button
              onClick={() => setAdding(true)}
              className="absolute bottom-24 right-5 bg-forest-700 hover:bg-forest-800 rounded-btn flex items-center justify-center shadow-[0_8px_24px_rgba(28,58,42,0.24)] text-bone active:scale-90 transition-transform z-10"
              style={{ width: 52, height: 52 }}
            >
              <Plus size={22} strokeWidth={2.25} />
            </button>
          )}
        </>
      )}

      {/* Zinynas chat — visiems */}
      <AnimatePresence>
        {chatEntry && (
          <ZinynasChat
            key={chatEntry.id}
            entry={chatEntry}
            allEntries={entries}
            plants={plants}
            onClose={() => setChatEntry(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
