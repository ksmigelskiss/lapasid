// Vercel serverless function — SSE streaming Anthropic proxy
// Naudojamas: useChatStream (PlantChat, CollectionChat, ZinynasChat)
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { messages, system, maxTokens } = req.body

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' })
  }

  // SSE headers
  res.setHeader('Content-Type',  'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection',    'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // disable nginx buffering on Vercel

  try {
    const stream = await client.messages.stream({
      model:      'claude-sonnet-4-6',
      max_tokens: maxTokens ?? 400,
      ...(system ? { system } : {}),
      messages,
    })

    for await (const chunk of stream) {
      if (res.destroyed) break
      if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`)
      }
    }

    res.write('data: [DONE]\n\n')
  } catch (e) {
    console.error('[api/claude/stream] error:', e?.message)
    if (!res.headersSent) {
      res.status(500).json({ error: e?.message })
      return
    }
    res.write(`data: ${JSON.stringify({ error: e?.message })}\n\n`)
  } finally {
    res.end()
  }
}
