import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, ArrowUp, Bookmark, Globe, Camera } from 'lucide-react'
import { buildChatSystemPrompt } from '../utils/plantChatContext'
import { getPlantMood } from '../utils/plantMood'
import { PlantAvatar } from './icons/ChatIcons'
import Mascot from './brand/Mascot'
import { useChatStream } from '../hooks/useChatStream'
import { resizeImage } from '../utils/imageService'
import PaywallSheet from './PaywallSheet'

const MAX_STORED = 40

const DEFAULT_HEIGHT = '62dvh'

export default function PlantChat({ plant, onClose, onSaveChat, onSaveNote, onSaveToZinynas, initialQuery, desktopPopover = false }) {
  const { messages, streaming, streamText, send, paywallOpen, paywallLimitType, closePaywall } = useChatStream({
    initialMessages: plant.chat ?? [],
    maxTokens:       600,
    maxStored:       MAX_STORED,
    limitType:       'chats',
    onSuccess:       (finalMessages) => onSaveChat?.(plant.id, finalMessages),
  })
  const [input, setInput]         = useState(initialQuery ?? '')
  const [savingNote, setSavingNote] = useState(null)
  const [noteText, setNoteText]   = useState('')
  const [panelHeight, setPanelHeight] = useState(DEFAULT_HEIGHT)
  const [pendingImage, setPendingImage] = useState(null)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)
  const fileRef   = useRef(null)
  const mood      = getPlantMood(plant)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: streamText ? 'instant' : 'smooth' })
  }, [messages, streamText])

  // Focus input on open
  useEffect(() => { inputRef.current?.focus() }, [])

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

  // Popover mode (desktop): ESC + outside click uždaro
  const popoverRef = useRef(null)
  useEffect(() => {
    if (!desktopPopover) return
    const escHandler = (e) => { if (e.key === 'Escape') onClose?.() }
    const clickHandler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) onClose?.()
    }
    window.addEventListener('keydown', escHandler)
    document.addEventListener('mousedown', clickHandler)
    return () => {
      window.removeEventListener('keydown', escHandler)
      document.removeEventListener('mousedown', clickHandler)
    }
  }, [desktopPopover, onClose])

  const handleSend = () => {
    const text = input.trim()
    if (!text && !pendingImage) return
    setInput('')
    setPendingImage(null)
    send(text, buildChatSystemPrompt(plant), pendingImage)
  }

  // Wrapper struktūra: mobile fixed + slide-up; desktop popover bottom-right
  const wrapperCls = desktopPopover
    ? 'absolute bottom-24 right-4 z-[70] w-[380px]'
    : 'fixed inset-0 z-[70] flex items-end justify-center pointer-events-none'

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
          style: { height: panelHeight, transition: 'height 0.2s ease' },
        })}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle — tik mobile */}
        {!desktopPopover && (
          <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-3 px-4 pb-3 pt-1 border-b border-warm-border flex-shrink-0">
          <div className="flex-shrink-0">
            <PlantAvatar mood={mood.mood} size={58} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-800 leading-tight">{plant.lietuviškas}</p>
            <p className="text-xs text-gray-400">{mood.label}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-surface-2 rounded-btn flex items-center justify-center text-gray-500 flex-shrink-0"
          >
            <X size={14} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-none px-4 py-3 space-y-2.5">
          {messages.length === 0 && !streaming && (
            <div className="text-center py-8 space-y-2">
              <div className="flex justify-center"><PlantAvatar mood={mood.mood} size={70} /></div>
              <p className="text-sm text-gray-500">Pakalbink savo augalą!</p>
              <p className="text-xs text-gray-400 italic">Jis žino apie savo priežiūrą ir istoriją</p>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="mr-1.5 self-end mb-0.5 flex-shrink-0">
                  <PlantAvatar mood={mood.mood} size={31} />
                </div>
              )}
              <div className="flex flex-col items-start max-w-[78%]">
                <div className={`rounded-2xl px-3.5 py-2 text-sm leading-snug w-full ${
                  m.role === 'user'
                    ? 'bg-sage-500 text-white rounded-br-sm'
                    : 'bg-surface-2 text-gray-800 rounded-bl-sm'
                }`}>
                  {m.imageUrl && <img src={m.imageUrl} className="rounded-xl mb-1.5 max-h-48 w-full object-cover" alt="" />}
                  {m.content}
                </div>
                {m.role === 'assistant' && (
                  <div className="flex gap-3 mt-1 ml-1">
                    <button
                      onClick={() => { setSavingNote('plant'); setNoteText(m.content) }}
                      className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-sage-600 font-medium transition-colors"
                    >
                      <Bookmark size={11} /> užrašai
                    </button>
                    <button
                      onClick={() => { setSavingNote('zinynas'); setNoteText(m.content) }}
                      className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700 font-medium transition-colors"
                    >
                      <Globe size={11} /> žinynas
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Streaming — plant mascot „think" state (mood įjungtas tik
              po atsakymo; generuojant rodom plain think bubble). */}
          {streaming && !streamText && (
            <div className="flex justify-start">
              <div className="mr-1.5 self-end mb-0.5 flex-shrink-0">
                <Mascot type="plant" state="think" size={32} blink={false} />
              </div>
              <div className="bg-surface-2 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          {streaming && streamText && (
            <div className="flex justify-start">
              <div className="mr-1.5 self-end mb-0.5 flex-shrink-0">
                <Mascot type="plant" state="think" size={32} blink={false} />
              </div>
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
            placeholder="Rašykite žinutę..."
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

        {/* Save-note sheet */}
        {savingNote !== null && (
          <motion.div
            className="absolute inset-x-0 bottom-0 bg-app rounded-t-4xl px-5 pt-4 pb-6 shadow-2xl border-t border-warm-border z-10"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
          >
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
              {savingNote === 'zinynas' ? 'Išsaugoti į žinyną' : 'Išsaugoti į užrašus'}
            </p>
            <p className="text-[11px] text-gray-500 mb-2">
              {savingNote === 'zinynas'
                ? 'Pirma eilutė taps pavadinimu — sutrumpink iki svarbiausios minties'
                : 'Sutrumpink iki svarbiausios minties'}
            </p>
            <textarea
              className="w-full bg-white border border-gray-200 rounded-2xl px-3 py-2.5 text-sm text-gray-800 outline-none resize-none focus:border-sage-500 transition-colors"
              rows={4}
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { setSavingNote(null); setNoteText('') }}
                className="flex-1 py-2.5 rounded-2xl text-sm text-gray-600 bg-white border border-gray-200"
              >
                Atšaukti
              </button>
              <button
                onClick={() => {
                  const trimmed = noteText.trim()
                  if (trimmed) {
                    if (savingNote === 'zinynas') {
                      onSaveToZinynas?.({
                        text: trimmed,
                        source: 'plant_chat',
                        plantId: plant.id,
                        plantName: plant.lietuviškas || plant.lotyniskas,
                      })
                    } else {
                      onSaveNote?.(trimmed)
                    }
                  }
                  setSavingNote(null)
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
