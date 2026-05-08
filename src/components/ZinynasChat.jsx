import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowUp, BookOpen, Camera } from 'lucide-react'
import { useChatStream } from '../hooks/useChatStream'
import { resizeImage } from '../utils/imageService'
import PaywallSheet from './PaywallSheet'

function buildSystemPrompt(entry, allEntries, plants) {
  const plantList = (plants ?? [])
    .map(p => `${p.lietuviškas || p.lotyniskas}${p.lietuviškas && p.lotyniskas ? ` (${p.lotyniskas})` : ''}`)
    .join(', ')

  const zinynasContext = (allEntries ?? [])
    .filter(e => e.id !== entry.id)
    .map(e => `• ${e.text}`)
    .join('\n')

  return `Esi sodininkystės ekspertas. Vartotojas aptaria šią išsaugotą mintį:

---
${entry.text}
---
${plantList ? `\nVARTOTOJO AUGINAMI AUGALAI:\n${plantList}\n` : ''}${zinynasContext ? `\nKITI ŽINYNO ĮRAŠAI (kontekstui):\n${zinynasContext}\n` : ''}
Aiškink esmingai: kodėl taip veikia, kas biologiškai lemia, ką reikia žinoti. Jei reikia, remkis vartotojo kolekcija ir kitais žinyno įrašais. Atsakyk lietuviškai — glaustai, bet pakankamai, kad vartotojas tikrai suprastų.`
}

const DEFAULT_HEIGHT = '65dvh'

export default function ZinynasChat({ entry, allEntries, plants, onClose }) {
  const { messages, streaming, streamText, send, paywallOpen, paywallLimitType, closePaywall } = useChatStream({ maxTokens: 400, limitType: 'chats' })
  const [input, setInput]           = useState('')
  const [panelHeight, setPanelHeight] = useState(DEFAULT_HEIGHT)
  const [pendingImage, setPendingImage] = useState(null)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)
  const fileRef   = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamText])

  useEffect(() => { inputRef.current?.focus() }, [])

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

  const handleSend = () => {
    const text = input.trim()
    if (!text && !pendingImage) return
    setInput('')
    setPendingImage(null)
    send(text, buildSystemPrompt(entry, allEntries, plants), pendingImage)
  }

  return (
    <>
    <div className="fixed inset-0 z-[70] flex items-end justify-center pointer-events-none">
      <div className="absolute inset-0 pointer-events-auto" onClick={onClose} />

      <motion.div
        className="relative w-full max-w-[430px] bg-app rounded-t-4xl flex flex-col shadow-2xl pointer-events-auto"
        style={{ height: panelHeight, transition: 'height 0.2s ease' }}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-start gap-3 px-4 pb-3 pt-1 border-b border-warm-border flex-shrink-0">
          <div className="w-10 h-10 bg-surface rounded-full flex items-center justify-center flex-shrink-0 text-gray-500">
            <BookOpen size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-800 leading-tight">Žinynas</p>
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 leading-snug">{entry.text}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-surface-2 rounded-full flex items-center justify-center text-gray-500 flex-shrink-0 mt-0.5"
          >
            <X size={14} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-none px-4 py-3 space-y-2.5">
          {messages.length === 0 && !streaming && (
            <div className="text-center py-8 space-y-2">
              <div className="flex justify-center text-gray-400"><BookOpen size={36} /></div>
              <p className="text-sm text-gray-500">Paklausk apie šį įrašą</p>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="mr-1.5 self-end mb-0.5 flex-shrink-0 text-gray-400"><BookOpen size={18} /></div>
              )}
              <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-snug ${
                m.role === 'user'
                  ? 'bg-sage-500 text-white rounded-br-sm'
                  : 'bg-surface-2 text-gray-800 rounded-bl-sm'
              }`}>
                {m.imageUrl && <img src={m.imageUrl} className="rounded-xl mb-1.5 max-h-48 w-full object-cover" alt="" />}
                {m.content}
              </div>
            </div>
          ))}

          {streaming && !streamText && (
            <div className="flex justify-start">
              <span className="text-lg mr-1.5 self-end mb-0.5">📖</span>
              <div className="bg-surface-2 rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex gap-1">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          {streaming && streamText && (
            <div className="flex justify-start">
              <span className="text-lg mr-1.5 self-end mb-0.5">📖</span>
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
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-700 text-white rounded-full flex items-center justify-center"
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
            className="w-9 h-9 flex-shrink-0 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-500 active:bg-surface transition-colors"
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
            className="w-9 h-9 bg-sage-500 disabled:opacity-40 rounded-full flex items-center justify-center text-white flex-shrink-0 transition-opacity"
          >
            <ArrowUp size={16} strokeWidth={2.5} />
          </button>
        </div>
      </motion.div>
    </div>
    <PaywallSheet open={paywallOpen} limitType={paywallLimitType} onClose={closePaywall} />
    </>
  )
}
