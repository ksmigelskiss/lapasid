// Vercel serverless function — non-streaming Anthropic proxy
// Naudojamas: SearchModal (Phase 1 + Phase 2 plant search)
import Anthropic from '@anthropic-ai/sdk'
import { fsGet, fsIncrement, uidFromToken, checkLimit } from './_firestore.js'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { messages, system, maxTokens, tools, toolChoice, limitType, temperature, topP } = req.body

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' })
  }

  // Auth tikrinimas + limito patikrinimas (tik kai limitType nurodytas)
  const idToken = req.headers.authorization?.replace('Bearer ', '')
  if (limitType) {
    if (!idToken) return res.status(401).json({ error: 'Unauthorized' })
    const uid  = uidFromToken(idToken)
    if (!uid)   return res.status(401).json({ error: 'Invalid token' })

    const user = await fsGet('users', uid, idToken)
    const hit  = checkLimit(user, limitType)
    if (hit) {
      const used  = (user?.aiUsage || {})[limitType] ?? 0
      return res.status(403).json({ error: 'limit_reached', limitType: hit, used })
    }
  }

  try {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: maxTokens ?? 1024,
      ...(system          ? { system }                    : {}),
      ...(tools           ? { tools }                     : {}),
      ...(toolChoice      ? { tool_choice: toolChoice }   : {}),
      ...(temperature != null ? { temperature }          : {}),
      ...(topP        != null ? { top_p: topP }          : {}),
      messages,
    })

    // Sekmingai — incrementiname skaitiklį
    if (limitType && idToken) {
      const uid = uidFromToken(idToken)
      if (uid) fsIncrement('users', uid, `aiUsage.${limitType}`, idToken)
    }

    res.json(response)
  } catch (e) {
    console.error('[api/claude] error:', e?.message)
    res.status(500).json({ error: e?.message ?? 'Internal server error' })
  }
}
