import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, ArrowUp, Globe, Camera } from 'lucide-react'
import { useChatStream } from '../hooks/useChatStream'
import { resizeImage } from '../utils/imageService'
import PaywallSheet from './PaywallSheet'
import Mascot from './brand/Mascot'

// Parses assistant message text and wraps matched plant names in clickable buttons
function renderMessage(text, plants, onViewPlant) {
  if (!plants?.length || !onViewPlant) return text

  const nameMap = new Map()
  for (const p of plants) {
    if ((p.lietuviškas?.length ?? 0) >= 4) nameMap.set(p.lietuviškas.toLowerCase(), p)
    if ((p.lotyniskas?.length  ?? 0) >= 4) nameMap.set(p.lotyniskas.toLowerCase(),  p)
    if ((p.inatLtName?.length  ?? 0) >= 4) nameMap.set(p.inatLtName.toLowerCase(),  p)
  }
  if (!nameMap.size) return text

  const escaped = [...nameMap.keys()]
    .sort((a, b) => b.length - a.length) // longer names first — avoid partial matches
    .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi')

  const parts = text.split(pattern)
  if (parts.length === 1) return text

  return parts.map((part, i) => {
    const plant = nameMap.get(part.toLowerCase())
    return plant ? (
      <button
        key={i}
        onClick={() => onViewPlant(plant)}
        className="text-sage-600 font-semibold underline decoration-dotted underline-offset-2 hover:text-sage-700 transition-colors"
      >
        {part}
      </button>
    ) : part
  })
}

const DEFAULT_HEIGHT = '68dvh'

export default function CollectionChat({ systemPrompt, title, icon, iconLg, mascot, onClose, onSaveToZinynas, plants, onViewPlant, desktopPopover = false }) {
  const { messages, streaming, streamText, send, paywallOpen, paywallLimitType, closePaywall } = useChatStream({ maxTokens: 600, limitType: 'chats' })

  // Mascot helper'is — kai `mascot` prop set'inta ('gardener' | 'plant'),
  // CollectionChat pati renderiina Mascot komponentą su state'u pagal
  // pozicija (header → idle/think pagal streaming, empty state → wave,
  // past message → idle, streaming indicator → think). Backward compat:
  // jei mascot nepateiktas, fallback'as į icon/iconLg props (legacy).
  const renderMascot = (size, state = 'idle') => {
    if (!mascot) return null
    return <Mascot type={mascot} state={state} size={size} blink={size > 36} />
  }
  const [input, setInput]         = useState('')
  const [savingText, setSavingText] = useState(null)
  const [noteText, setNoteText]   = useState('')
  const [panelHeight, setPanelHeight] = useState(DEFAULT_HEIGHT)
  const [pendingImage, setPendingImage] = useState(null)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)
  const fileRef   = useRef(null)

  // Expand to fill visible area when keyboard opens
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const kbOpen = window.innerHeight - vv.height > 100
      setPanelHeight(kbOpen ? `${vv.height}px` : DEFAULT_HEIGHT)
    }
    vv.addEventListener('resize', update)
    return () => vv.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: streamText ? 'instant' : 'smooth' })
  }, [messages, streamText])

  useEffect(() => { inputRef.current?.focus() }, [])

  // Popover mode (desktop): ESC + outside click uždaro (mobile turi backdrop tap + drag)
  const popoverRef = useRef(null)
  useEffect(() => {
    if (!desktopPopover) return
    const handler = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    const clickHandler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) onClose?.()
    }
    window.addEventListener('keydown', handler)
    document.addEventListener('mousedown', clickHandler)
    return () => {
      window.removeEventListener('keydown', handler)
      document.removeEventListener('mousedown', clickHandler)
    }
  }, [desktopPopover, onClose])

  const handleSend = () => {
    const text = input.trim()
    if (!text && !pendingImage) return
    setInput('')
    setPendingImage(null)
    send(text, systemPrompt, pendingImage)
  }

  // Wrapper struktūra:
  //   mobile: fixed inset-0 + backdrop + slide-up sheet
  //   desktop popover: absolute bottom-28 right-4 w-[380px] h-[500px] (parent jau positioned)
  const wrapperCls = desktopPopover
    ? 'absolute bottom-28 right-4 z-[60] w-[380px]'
    : 'fixed inset-0 z-[60] flex items-end justify-center pointer-events-none'

  return (
    <>
    <div className={wrapperCls}>
      {!desktopPopover && (
        <div className="absolute inset-0 pointer-events-auto" onClick={onClose} />
      )}

      <motion.div
        ref={popoverRef}
        className={desktopPopover
          ? "relative w-full bg-app rounded-2xl flex flex-col shadow-[0_20px_50px_rgba(20,40,30,0.25)] border border-gray-200 overflow-hidden"
          : "relative w-full max-w-[430px] bg-app rounded-t-4xl flex flex-col shadow-2xl pointer-events-auto"}
        style={desktopPopover
          ? { height: '500px', maxHeight: 'calc(100vh - 200px)' }
          : { height: panelHeight, transition: 'height 0.2s ease' }}
        {...(desktopPopover ? {
          initial: { opacity: 0, scale: 0.85, y: 20 },
          animate: { opacity: 1, scale: 1, y: 0 },
          exit:    { opacity: 0, scale: 0.85, y: 20 },
          transition: { type: 'spring', damping: 24, stiffness: 320 },
          style: { height: '500px', maxHeight: 'calc(100vh - 200px)', transformOrigin: 'bottom right' },
        } : {
          initial: { y: '100%' },
          animate: { y: 0 },
          exit:    { y: '100%' },
          transition: { type: 'spring', damping: 32, stiffness: 320 },
        })}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle — tik mobile (popover'as turi X header'yje) */}
        {!desktopPopover && (
          <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-3 px-4 pb-3 pt-1 border-b border-warm-border flex-shrink-0">
          <div className="flex-shrink-0">
            {mascot ? renderMascot(56, streaming ? 'think' : 'idle') : (icon ?? '🤖')}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-800">{title}</p>
            <p className="text-xs text-gray-500">AI asistentas</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-surface-2 rounded-btn flex items-center justify-center text-gray-500 text-sm flex-shrink-0"
          >
            <X size={14} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-none px-4 py-3 space-y-2.5">
          {messages.length === 0 && !streaming && (
            <div className="text-center py-10 space-y-2">
              <div className="flex justify-center">
                {mascot ? renderMascot(70, 'wave') : (iconLg ?? icon ?? '🤖')}
              </div>
              <p className="text-sm text-gray-500">Užduok klausimą apie savo augalus</p>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <span className="mr-1.5 self-end mb-0.5 flex-shrink-0 text-forest-700">
                  {mascot ? renderMascot(24, 'idle') : <span className="text-lg">{icon ?? '🤖'}</span>}
                </span>
              )}
              <div className="flex flex-col items-start max-w-[78%]">
                <div className={`rounded-2xl px-3.5 py-2 text-sm leading-snug w-full ${
                  m.role === 'user'
                    ? 'bg-sage-500 text-white rounded-br-sm'
                    : 'bg-surface-2 text-gray-800 rounded-bl-sm'
                }`}>
                  {m.imageUrl && <img src={m.imageUrl} className="rounded-xl mb-1.5 max-h-48 w-full object-cover" alt="" />}
                  {m.role === 'assistant'
                    ? renderMessage(m.content, plants, onViewPlant)
                    : m.content}
                </div>
                {m.role === 'assistant' && onSaveToZinynas && (
                  <button
                    onClick={() => { setSavingText(m.content); setNoteText(m.content) }}
                    className="flex items-center gap-1 mt-1 ml-1 text-[11px] text-gray-500 hover:text-gray-700 font-medium transition-colors"
                  >
                    <Globe size={11} /> žinynas
                  </button>
                )}
              </div>
            </div>
          ))}

          {streaming && !streamText && (
            <div className="flex justify-start">
              <span className="mr-1.5 self-end mb-0.5 text-forest-700">
                {mascot ? renderMascot(24, 'think') : <span className="text-lg">{icon ?? '🤖'}</span>}
              </span>
              <div className="bg-surface-2 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          {streaming && streamText && (
            <div className="flex justify-start">
              <span className="mr-1.5 self-end mb-0.5 text-forest-700">
                {mascot ? renderMascot(24, 'think') : <span className="text-lg">{icon ?? '🤖'}</span>}
              </span>
              <div className="max-w-[78%] bg-surface-2 rounded-2xl rounded-bl-sm px-3.5 py-2 text-sm leading-snug text-gray-800">
                {streamText}
                <span className="inline-block w-0.5 h-3.5 bg-gray-400 ml-0.5 animate-pulse align-text-bottom" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Image preview */}
        {pendingImage && (
          <div className="px-4 pb-2 flex-shrink-0">
            <div className="relative inline-block">
              <img src={pendingImage} className="h-16 w-16 object-cover rounded-xl" alt="" />
              <button
                onClick={() => setPendingImage(null)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-700 text-white rounded-btn-sm flex items-center justify-center"
              >
                <X size={10} />
              </button>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-warm-border flex-shrink-0">
          <button
            onClick={() => fileRef.current?.click()}
            className="w-9 h-9 flex-shrink-0 bg-white border border-gray-200 rounded-btn flex items-center justify-center text-gray-500 active:bg-surface transition-colors"
          >
            <Camera size={16} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={async e => { const f = e.target.files[0]; if (f) { setPendingImage(await resizeImage(f, 800, 0.82)); e.target.value = '' } }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Rašykite klausimą..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            className="flex-1 bg-white border border-gray-200 rounded-2xl px-4 py-2.5 text-sm outline-none text-gray-800 placeholder-gray-500"
          />
          <button
            onClick={handleSend}
            disabled={(!input.trim() && !pendingImage) || streaming}
            className="w-9 h-9 bg-sage-500 disabled:opacity-40 rounded-btn flex items-center justify-center text-white flex-shrink-0 transition-opacity"
          >
            <ArrowUp size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Save-to-zinynas sheet */}
        {savingText !== null && (
          <motion.div
            className="absolute inset-x-0 bottom-0 bg-app rounded-t-4xl px-5 pt-4 pb-6 shadow-2xl border-t border-warm-border z-10"
            initial={{ y: '100%' }} animate={{ y: 0 }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
          >
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Išsaugoti į žinyną</p>
            <p className="text-[11px] text-gray-500 mb-2">Pirma eilutė taps pavadinimu — sutrumpink iki svarbiausios minties</p>
            <textarea
              className="w-full bg-white border border-gray-200 rounded-2xl px-3 py-2.5 text-sm text-gray-800 outline-none resize-none focus:border-sage-500 transition-colors"
              rows={4}
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { setSavingText(null); setNoteText('') }}
                className="flex-1 py-2.5 rounded-2xl text-sm text-gray-600 bg-white border border-gray-200"
              >
                Atšaukti
              </button>
              <button
                onClick={() => {
                  const trimmed = noteText.trim()
                  if (trimmed) onSaveToZinynas({ text: trimmed, source: 'collection_chat', plantId: null, plantName: null })
                  setSavingText(null)
                  setNoteText('')
                }}
                disabled={!noteText.trim()}
                className="flex-1 py-2.5 rounded-2xl text-sm text-white bg-sage-500 disabled:opacity-40"
              >
                Išsaugoti
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
    <PaywallSheet open={paywallOpen} limitType={paywallLimitType} onClose={closePaywall} />
    </>
  )
}
