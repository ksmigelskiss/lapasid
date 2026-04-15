import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, Search } from 'lucide-react'
import ZinynasChat from '../components/ZinynasChat'

function Highlight({ text, query }) {
  if (!query.trim()) return <>{text}</>
  const regex = new RegExp(`(${query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part)
          ? <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5 not-italic">{part}</mark>
          : part
      )}
    </>
  )
}

function formatDateShort(iso) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('lt-LT', { month: 'short', day: 'numeric' })
}

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
      className="bg-surface rounded-2xl px-4 py-3.5 cursor-pointer active:bg-surface-2 transition-colors"
      onClick={onToggle}
      layout
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-start gap-2">
        <p className={`flex-1 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap ${expanded ? '' : 'line-clamp-3'}`}>
          <Highlight text={entry.text} query={query} />
        </p>
        <button
          onClick={e => { e.stopPropagation(); onToggleStar() }}
          className="flex-shrink-0 text-base leading-none mt-0.5 transition-transform active:scale-90"
        >
          {entry.starred
            ? <Star size={14} className="text-amber-400 fill-amber-400" />
            : <Star size={14} className="text-gray-400" />
          }
        </button>
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <div className="flex items-center gap-1.5">
          {entry.plantName && (
            <span className="text-[11px] text-gray-500">{entry.plantName} ·</span>
          )}
          <span className="text-[11px] text-gray-400">{formatDateShort(entry.date)}</span>
        </div>
        {expanded && (
          <div className="flex items-center gap-3">
            <button
              onClick={copy}
              className="text-xs text-gray-500 hover:text-gray-800 font-medium transition-colors"
            >
              {copied ? '✓ Nukopijuota' : '⎘ Kopijuoti'}
            </button>
            <button
              onClick={e => { e.stopPropagation(); onChat() }}
              className="text-xs text-gray-500 hover:text-gray-800 font-medium transition-colors"
            >
              💬 Aptarti
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete() }}
              className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
            >
              Ištrinti
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default function Zinynas({ entries, onAdd, onDelete, onToggleStar, plants }) {
  const [expandedId, setExpanded] = useState(null)
  const [adding, setAdding]       = useState(false)
  const [newText, setNewText]     = useState('')
  const [query, setQuery]         = useState('')
  const [chatEntry, setChatEntry] = useState(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? entries.filter(e => e.text.toLowerCase().includes(q)) : entries
    return [...list].sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0))
  }, [entries, query])

  const add = () => {
    const trimmed = newText.trim()
    if (!trimmed) return
    onAdd({ text: trimmed, source: 'manual', plantId: null, plantName: null })
    setNewText('')
    setAdding(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-14 pb-3 flex-shrink-0">
        <p className="text-[11px] font-semibold text-sage-400 uppercase tracking-[0.12em] mb-1">Sodininkystė</p>
        <h1 className="text-[28px] font-extrabold text-gray-900 leading-tight tracking-tight">Žinynas</h1>
      </div>

      {/* Search */}
      <div className="px-5 pb-3 flex-shrink-0">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Ieškoti žinyne..."
            className="w-full bg-surface-2 rounded-2xl pl-9 pr-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-none px-5 pb-32">
        <div className="space-y-2">
          {/* Add textarea */}
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
                  className="w-full bg-surface rounded-2xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 outline-none resize-none border border-transparent focus:border-sage-300 transition-colors"
                  rows={5}
                  value={newText}
                  onChange={e => setNewText(e.target.value)}
                  placeholder="Nauja žinyno mintis..."
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setAdding(false); setNewText('') }}
                    className="flex-1 py-2.5 rounded-2xl text-sm text-gray-500 bg-surface-2"
                  >
                    Atšaukti
                  </button>
                  <button
                    onClick={add}
                    disabled={!newText.trim()}
                    className="flex-1 py-2.5 rounded-2xl text-sm text-white bg-sage-500 disabled:opacity-40"
                  >
                    Išsaugoti
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results */}
          {filtered.map(entry => (
            <ZinynasCard
              key={entry.id}
              entry={entry}
              expanded={expandedId === entry.id}
              onToggle={() => setExpanded(expandedId === entry.id ? null : entry.id)}
              onDelete={() => { onDelete(entry.id); setExpanded(null) }}
              onToggleStar={() => onToggleStar(entry.id)}
              onChat={() => { setChatEntry(entry); setExpanded(null) }}
              query={query}
            />
          ))}

          {/* No results */}
          {query && filtered.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-gray-400">Nerasta įrašų pagal „{query}"</p>
            </div>
          )}

          {/* Empty state */}
          {!query && entries.length === 0 && !adding && (
            <div className="text-center py-16 space-y-2">
              <p className="text-4xl">📖</p>
              <p className="text-sm font-semibold text-gray-600">Žinynas tuščias</p>
              <p className="text-xs text-gray-400 leading-relaxed px-4">
                Išsaugokite bendrą informaciją iš pokalbių su AI spausdami 🌐
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Zinynas chat */}
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

      {/* FAB */}
      {!adding && (
        <button
          onClick={() => setAdding(true)}
          className="absolute bottom-24 right-5 w-13 h-13 bg-sage-500 rounded-full flex items-center justify-center shadow-lg text-white text-2xl active:scale-90 transition-transform z-10"
          style={{ width: 52, height: 52 }}
        >
          +
        </button>
      )}
    </div>
  )
}
