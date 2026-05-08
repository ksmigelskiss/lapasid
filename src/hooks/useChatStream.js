import { useState, useRef, useCallback } from 'react'
import { auth } from '../utils/firebase'

const MAX_API = 12

/**
 * Shared Claude streaming hook for all chat components.
 * Calls /api/claude/stream (server-side proxy — API key never in browser).
 *
 * @param {object} opts
 * @param {Array}    opts.initialMessages - Seed messages (read once on mount)
 * @param {number}   opts.maxTokens       - Claude max_tokens (default 400)
 * @param {number}   opts.maxStored       - Trim history to N messages after each reply (optional)
 * @param {string}   opts.errorMessage    - Fallback assistant text on error
 * @param {Function} opts.onSuccess       - Called with (finalMessages, fullText) after a reply
 * @param {string}   opts.limitType       - 'chats' | 'searches' — enables limit checking
 */
export function useChatStream({
  initialMessages = [],
  maxTokens       = 400,
  maxStored       = null,
  errorMessage    = '...',
  onSuccess,
  limitType       = 'chats',
} = {}) {
  const [messages,         setMessages]         = useState(initialMessages)
  const [streaming,        setStreaming]         = useState(false)
  const [streamText,       setStreamText]        = useState('')
  const [paywallOpen,      setPaywallOpen]       = useState(false)
  const [paywallLimitType, setPaywallLimitType]  = useState(null)
  const abortRef = useRef(null)

  // send(text, systemPrompt, imageUrl?) — imageUrl is a data URL or null
  const send = useCallback(async (text, systemPrompt, imageUrl = null) => {
    if ((!text && !imageUrl) || streaming) return

    const userMsg     = { role: 'user', content: text, ...(imageUrl ? { imageUrl } : {}) }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setStreaming(true)
    setStreamText('')

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      // Transform messages for API (convert data URLs to base64 blocks)
      const apiMessages = newMessages.slice(-MAX_API).map(m => {
        if (m.imageUrl) {
          const [header, data] = m.imageUrl.split(',')
          const mediaType = header.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg'
          const parts = [{ type: 'image', source: { type: 'base64', media_type: mediaType, data } }]
          if (m.content) parts.push({ type: 'text', text: m.content })
          return { role: m.role, content: parts }
        }
        return { role: m.role, content: m.content }
      })

      let fullText = ''

      const idToken = await auth.currentUser?.getIdToken().catch(() => null)
      const headers = { 'Content-Type': 'application/json' }
      if (idToken) headers['Authorization'] = `Bearer ${idToken}`

      const response = await fetch('/api/claude/stream', {
        method:  'POST',
        headers,
        body:    JSON.stringify({ messages: apiMessages, system: systemPrompt, maxTokens, limitType }),
        signal:  controller.signal,
      })

      if (response.status === 403) {
        const err = await response.json().catch(() => ({}))
        if (err.error === 'limit_reached') {
          setMessages(m => m.slice(0, -1)) // remove the user message we just added
          setPaywallLimitType(err.limitType ?? limitType)
          setPaywallOpen(true)
          return
        }
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error ?? `HTTP ${response.status}`)
      }

      const reader  = response.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done || controller.signal.aborted) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? '' // keep incomplete last line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') break
          try {
            const { text: delta, error } = JSON.parse(payload)
            if (error) throw new Error(error)
            if (delta) {
              fullText += delta
              setStreamText(fullText)
            }
          } catch {}
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

  const closePaywall = useCallback(() => setPaywallOpen(false), [])

  return { messages, setMessages, streaming, streamText, send, paywallOpen, paywallLimitType, closePaywall }
}
