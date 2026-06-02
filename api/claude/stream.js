// Vercel serverless function — SSE streaming Anthropic proxy
// Naudojamas: useChatStream (PlantChat, CollectionChat, ZinynasChat)
import Anthropic from '@anthropic-ai/sdk'
import { fsGet, fsIncrement, checkLimit } from '../_firestore.js'
import { verifyAuthToken } from '../_lib/firestore-admin.js'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { messages, system, maxTokens, limitType } = req.body

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' })
  }

  // Auth tikrinimas + limito patikrinimas
  const idToken = req.headers.authorization?.replace('Bearer ', '')
  let uid = null
  if (limitType) {
    if (!idToken) return res.status(401).json({ error: 'Unauthorized' })
    uid = await verifyAuthToken(idToken)
    if (!uid) return res.status(401).json({ error: 'Invalid token' })

    const user = await fsGet('users', uid, idToken)
    const hit  = checkLimit(user, limitType)
    if (hit) {
      const used = (user?.aiUsage || {})[limitType] ?? 0
      return res.status(403).json({ error: 'limit_reached', limitType: hit, used })
    }
  }

  // SSE headers
  res.setHeader('Content-Type',      'text/event-stream')
  res.setHeader('Cache-Control',     'no-cache')
  res.setHeader('Connection',        'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

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

    // Sėkmingai — incrementiname skaitiklį
    if (limitType && idToken && uid) {
      fsIncrement('users', uid, `aiUsage.${limitType}`, idToken)
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
