import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowUp, BookOpen } from 'lucide-react'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
})

const MAX_API = 12

function buildSystemPrompt(entry, allEntries, plants) {
  const plantList = (plants ?? [])
    .map(p => `${p.lietuviškas || p.lotyniskas}${p.lietuviškas && p.lotyniskas ? ` (${p.lotyniskas})` : ''}`)
    .join(', ')

  const zinynasContext = (allEntries ?? [])
    .filter(e => e.id !== entry.id)
    .map(e => `• ${e.text}`)
    .join('\n')

  return `Esi sodininkystės ekspertas. Vartotojas nori aptarti šią išsaugotą mintį iš savo žinyno:

---
${entry.text}
---
${plantList ? `\nVARTOTOJO AUGINAMI AUGALAI:\n${plantList}\n` : ''}${zinynasContext ? `\nKITI ŽINYNO ĮRAŠAI (kontekstui):\n${zinynasContext}\n` : ''}
Atsakinėk lietuviškai, glaustai ir praktiškai. Jei reikia, remkis vartotojo kolekcija ir kitais žinyno įrašais.`
}

export default function ZinynasChat({ entry, allEntries, plants, onClose }) {
  const [messages, setMessages]     = useState([])
  const [input, setInput]           = useState('')
  const [streaming, setStreaming]   = useState(false)
  const [streamText, setStreamText] = useState('')
  const abortRef  = useRef(null)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamText])

  useEffect(() => { inputRef.current?.focus() }, [])

  const send = async () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')

    const userMsg     = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setStreaming(true)
    setStreamText('')

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const apiMessages = newMessages.slice(-MAX_API).map(m => ({ role: m.role, content: m.content }))
      let fullText = ''
      const stream = await client.messages.stream({
        model:      'claude-sonnet-4-6',
        max_tokens: 400,
        system:     buildSystemPrompt(entry, allEntries, plants),
        messages:   apiMessages,
      })

      for await (const chunk of stream) {
        if (controller.signal.aborted) return
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          fullText += chunk.delta.text
          setStreamText(fullText)
        }
      }

      if (controller.signal.aborted) return
      setMessages([...newMessages, { role: 'assistant', content: fullText }])
      setStreamText('')
    } catch (e) {
      if (e.name !== 'AbortError' && !controller.signal.aborted) {
        setMessages(m => [...m, { role: 'assistant', content: '...' }])
      }
    } finally {
      if (!controller.signal.aborted) setStreaming(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center pointer-events-none">
      <div className="absolute inset-0 pointer-events-auto" onClick={onClose} />

      <motion.div
        className="relative w-full max-w-[430px] bg-app rounded-t-3xl flex flex-col shadow-2xl pointer-events-auto"
        style={{ height: '65dvh' }}
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

        {/* Input */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-warm-border flex-shrink-0">
          <input
            ref={inputRef}
            type="text"
            placeholder="Rašykite klausimą..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            className="flex-1 bg-white border border-gray-200 rounded-2xl px-4 py-2.5 text-sm outline-none text-gray-800 placeholder-gray-500"
          />
          <button
            onClick={send}
            disabled={!input.trim() || streaming}
            className="w-9 h-9 bg-sage-500 disabled:opacity-40 rounded-full flex items-center justify-center text-white flex-shrink-0 transition-opacity"
          >
            <ArrowUp size={16} strokeWidth={2.5} />
          </button>
        </div>
      </motion.div>
    </div>
  )
}
