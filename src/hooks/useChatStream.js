import { useState, useRef, useCallback } from 'react'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
})

const MAX_API = 12

/**
 * Shared Claude streaming hook for all chat components.
 *
 * @param {object} opts
 * @param {Array}    opts.initialMessages - Seed messages (read once on mount)
 * @param {number}   opts.maxTokens       - Claude max_tokens (default 400)
 * @param {number}   opts.maxStored       - Trim history to N messages after each reply (optional)
 * @param {string}   opts.errorMessage    - Fallback assistant text on error
 * @param {Function} opts.onSuccess       - Called with (finalMessages, fullText) after a reply
 */
export function useChatStream({
  initialMessages = [],
  maxTokens       = 400,
  maxStored       = null,
  errorMessage    = '...',
  onSuccess,
} = {}) {
  const [messages,   setMessages]   = useState(initialMessages)
  const [streaming,  setStreaming]  = useState(false)
  const [streamText, setStreamText] = useState('')
  const abortRef = useRef(null)

  // send(text, systemPrompt) — each call site builds its own system prompt
  const send = useCallback(async (text, systemPrompt) => {
    if (!text || streaming) return

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
        max_tokens: maxTokens,
        system:     systemPrompt,
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

      const assistantMsg  = { role: 'assistant', content: fullText }
      const finalMessages = maxStored
        ? [...newMessages, assistantMsg].slice(-maxStored)
        : [...newMessages, assistantMsg]

      setMessages(finalMessages)
      setStreamText('')
      onSuccess?.(finalMessages, fullText)
    } catch (e) {
      if (e.name !== 'AbortError' && !controller.signal.aborted) {
        setMessages(m => [...m, { role: 'assistant', content: errorMessage }])
      }
    } finally {
      if (!controller.signal.aborted) setStreaming(false)
    }
  }, [messages, streaming, maxTokens, maxStored, errorMessage, onSuccess])

  return { messages, setMessages, streaming, streamText, send }
}
