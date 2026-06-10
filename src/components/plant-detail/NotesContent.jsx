import { useState } from 'react'
import { motion } from 'framer-motion'
import { Star, Bookmark, Globe, MessageCircle, Pencil, Trash2 } from 'lucide-react'

// ── Notes tab content ──────────────────────────────────────────

// Pirma non-empty eilutė kaip title (su markdown žymeklių stripping'u).
// Tas pats pattern'as kaip Zinynas.jsx — vientisas note display'us per visą app'ą.
function extractNoteTitle(text) {
  if (!text) return ''
  const firstLine = text.split('\n').find(l => l.trim().length > 0) || ''
  return firstLine
    .replace(/^#+\s*/, '')           // ## heading marks
    .replace(/\*\*(.+?)\*\*/g, '$1') // bold
    .replace(/\*(.+?)\*/g, '$1')     // italic
    .replace(/`(.+?)`/g, '$1')       // code
    .replace(/^[-*]\s+/, '')         // list bullet
    .trim()
    .slice(0, 120)
}

// Body = visas tekstas po pirmos non-empty eilutės (su išlaikytais line breaks).
function extractNoteBody(text) {
  if (!text) return ''
  const lines = text.split('\n')
  const firstNonEmptyIdx = lines.findIndex(l => l.trim().length > 0)
  if (firstNonEmptyIdx < 0) return ''
  return lines.slice(firstNonEmptyIdx + 1).join('\n').trim()
}

function NoteCard({ note, expanded, onToggle, onEdit, onDelete, onShare, onToggleStar, onChat }) {
  const title = extractNoteTitle(note.text) || '(tuščia)'
  const body  = extractNoteBody(note.text)

  return (
    <motion.div
      className="border border-bone-400/40 rounded-2xl px-4 py-3.5 cursor-pointer active:bg-bone-300/40 transition-colors"
      onClick={onToggle}
      layout
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className={`font-display text-sm font-semibold tracking-tight text-forest-800 leading-snug ${expanded ? '' : 'truncate'}`}>
            {title}
          </p>
          {body && (
            <p className={`text-[13px] text-forest-600 leading-relaxed whitespace-pre-wrap mt-1 ${expanded ? '' : 'line-clamp-2'}`}>
              {body}
            </p>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onToggleStar() }}
          className="flex-shrink-0 text-base leading-none mt-0.5 transition-transform active:scale-90"
        >
          {note.starred
            ? <Star size={14} className="text-terracotta-400 fill-terracotta-400" />
            : <Star size={14} className="text-forest-300" />
          }
        </button>
      </div>
      {expanded && (
        <div className="flex gap-4 mt-2.5 pt-2 border-t border-bone-400/40">
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            className="flex items-center gap-1 text-xs text-forest-600 hover:text-forest-800 font-medium transition-colors"
          >
            <Pencil size={11} /> Redaguoti
          </button>
          <button
            onClick={e => { e.stopPropagation(); onChat() }}
            className="flex items-center gap-1 text-xs text-forest-500 hover:text-forest-700 font-medium transition-colors"
          >
            <MessageCircle size={11} /> Aptarti
          </button>
          <button
            onClick={e => { e.stopPropagation(); onShare() }}
            className="flex items-center gap-1 text-xs text-forest-500 hover:text-forest-700 font-medium transition-colors"
          >
            <Globe size={11} /> Į žinyną
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            className="flex items-center gap-1 text-xs text-terracotta-500 hover:text-terracotta-600 font-medium transition-colors ml-auto"
          >
            <Trash2 size={11} /> Ištrinti
          </button>
        </div>
      )}
    </motion.div>
  )
}

function mkNoteId() { return Math.random().toString(36).slice(2, 10) }
function noteToday() { return new Date().toISOString().slice(0, 10) }

// Migrate old komentaras string → array if uzrasai doesn't exist yet
function loadNotes(plant) {
  if (plant.uzrasai) return plant.uzrasai
  if (!plant.komentaras?.trim()) return []
  return plant.komentaras.split('\n\n')
    .map(t => t.trim()).filter(Boolean)
    .map(text => ({ id: mkNoteId(), text, starred: false, date: noteToday() }))
}

export default function NotesContent({ plant, onUzrasaiSave, onSaveToZinynas, onChatAbout }) {
  const [adding, setAdding]         = useState(false)
  const [newText, setNewText]       = useState('')
  const [expandedId, setExpanded]   = useState(null)
  const [editingId, setEditingId]   = useState(null)
  const [editText, setEditText]     = useState('')

  const notes = loadNotes(plant)
  const sorted = [...notes].sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0))

  const persist = (arr) => onUzrasaiSave?.(plant.id, arr)

  const addNote = () => {
    const trimmed = newText.trim()
    if (!trimmed) return
    const note = { id: mkNoteId(), text: trimmed, starred: false, date: noteToday() }
    persist([note, ...notes])
    setNewText(''); setAdding(false)
  }

  const saveEdit = () => {
    const trimmed = editText.trim()
    if (!trimmed) return
    persist(notes.map(n => n.id === editingId ? { ...n, text: trimmed } : n))
    setEditingId(null)
  }

  const deleteNote = (id) => {
    persist(notes.filter(n => n.id !== id))
    setExpanded(null)
  }

  const toggleStar = (id) => {
    persist(notes.map(n => n.id === id ? { ...n, starred: !n.starred } : n))
  }

  return (
    <div className="px-5 py-5 space-y-2">
      {sorted.map(note =>
        editingId === note.id ? (
          <div key={note.id} className="space-y-2">
            <textarea
              className="w-full bg-surface rounded-2xl px-4 py-3 text-sm text-gray-800 outline-none resize-none border border-sage-200 transition-colors"
              rows={5} value={editText} onChange={e => setEditText(e.target.value)} autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => setEditingId(null)}
                className="flex-1 py-2.5 rounded-2xl text-sm text-gray-500 bg-surface-2">Atšaukti</button>
              <button onClick={saveEdit} disabled={!editText.trim()}
                className="flex-1 py-2.5 rounded-2xl text-sm text-bone bg-forest-600 disabled:opacity-40">Išsaugoti</button>
            </div>
          </div>
        ) : (
          <NoteCard
            key={note.id}
            note={note}
            expanded={expandedId === note.id}
            onToggle={() => setExpanded(expandedId === note.id ? null : note.id)}
            onEdit={() => { setEditText(note.text); setEditingId(note.id); setExpanded(null) }}
            onDelete={() => deleteNote(note.id)}
            onToggleStar={() => toggleStar(note.id)}
            onChat={() => { onChatAbout?.(note.text); setExpanded(null) }}
            onShare={() => {
              onSaveToZinynas?.({ text: note.text, source: 'plant_note', plantId: plant.id, plantName: plant.lietuviškas || plant.lotyniskas })
              setExpanded(null)
            }}
          />
        )
      )}

      {adding ? (
        <div className="space-y-2">
          <textarea
            className="w-full bg-bone-50 rounded-2xl px-4 py-3 text-sm text-forest-700 placeholder-forest-400 outline-none resize-none border border-bone-400/40 focus:border-forest-400 transition-colors"
            rows={5} value={newText} onChange={e => setNewText(e.target.value)}
            placeholder="Nauja mintis..." autoFocus
          />
          <div className="flex gap-2">
            <button onClick={() => { setAdding(false); setNewText('') }}
              className="flex-1 py-2.5 rounded-2xl text-sm text-forest-600 bg-bone-300/60">Atšaukti</button>
            <button onClick={addNote} disabled={!newText.trim()}
              className="flex-1 py-2.5 rounded-2xl text-sm font-bold text-bone bg-forest-600 disabled:opacity-40">Išsaugoti</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="w-full py-3 rounded-2xl text-sm font-semibold text-forest-600 border border-bone-400/40 hover:bg-bone-300/40 transition-colors">
          + Pridėti mintį
        </button>
      )}

      {notes.length === 0 && !adding && (
        <p className="text-xs text-forest-500 text-center leading-relaxed px-4 pt-1">
          Išsaugokite stebėjimus arba mintį iš pokalbio su AI spausdami <Bookmark size={12} className="inline align-text-bottom mx-0.5" />
        </p>
      )}
    </div>
  )
}

export { mkNoteId, noteToday, loadNotes }
