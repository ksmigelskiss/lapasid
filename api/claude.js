// Vercel serverless function — non-streaming Anthropic proxy
// Naudojamas: SearchModal (Phase 1 + Phase 2 plant search)
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { messages, system, maxTokens, tools, toolChoice } = req.body

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' })
  }

  try {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: maxTokens ?? 1024,
      ...(system      ? { system }                    : {}),
      ...(tools       ? { tools }                     : {}),
      ...(toolChoice  ? { tool_choice: toolChoice }   : {}),
      messages,
    })

    res.json(response)
  } catch (e) {
    console.error('[api/claude] error:', e?.message)
    res.status(500).json({ error: e?.message ?? 'Internal server error' })
  }
}
