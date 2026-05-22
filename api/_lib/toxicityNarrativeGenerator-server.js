/**
 * Server-side toxicity narrative generator — MIRROR of
 * src/utils/toxicityNarrativeGenerator.js.
 *
 * VAIDMUO: Po Variant B Step 6a — server-side processPlant kviečia šitą
 * po deriveToxicityFromSourcesServer, kad catalog gautų REAL LT narrative
 * (ne placeholder'į).
 *
 * BEHAVIORAL CONTRACT — IDENTIŠKAS client'o variantui:
 *   • Tas pats NARRATIVE_TOOL + TRANSLATOR_SYSTEM (import iš shared file)
 *   • Tas pats sourceLines builder'is
 *   • Trigger'as: derivedToxicity.hasToxicity === true (6a). 6b atidarys
 *     versija-plus su gap-fill'u.
 *
 * KAS SKIRIASI nuo client'o:
 *   • Anthropic SDK tiesiogiai (ne /api/claude proxy)
 *   • Module-level Anthropic client (Fluid Compute reuse)
 */
import Anthropic from '@anthropic-ai/sdk'
import { NARRATIVE_TOOL, TRANSLATOR_SYSTEM } from '../../src/utils/toxicityNarrativePrompts.js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Generate LT toxicity narrative from our DB sources (ASPCA/PFAF).
 *
 * @param {object} args
 * @param {string} args.latinName
 * @param {object} args.derivedToxicity — output of deriveToxicityFromSourcesServer
 * @returns {Promise<{
 *   detales: string|null,
 *   aiSupplementaryHazard: object|null,   // 6a: always null
 *   elapsedMs: number,
 * }>}
 */
export async function generateToxicityNarrativeServer({ latinName, derivedToxicity }) {
  const t0 = Date.now()
  const empty = { detales: null, aiSupplementaryHazard: null, elapsedMs: 0 }
  if (!derivedToxicity?.hasToxicity) return empty

  // Build SOURCE TEXT — tik mūsų DB grindiniu (no AI training knowledge)
  const sourceLines = [`PLANT: ${latinName}`]
  sourceLines.push('')
  sourceLines.push('STRUCTURED TOXICITY DATA (from our DB — authoritative):')

  for (const p of derivedToxicity.pavojai) {
    sourceLines.push(`  • tipas=${p.tipas}, target=${p.target}, severity=${p.severity} — ${p.detales}`)
  }

  if (derivedToxicity.pavojingumas?.detales) {
    sourceLines.push('')
    sourceLines.push('SOURCE TEXT (translate into Lithuanian narrative):')
    sourceLines.push(derivedToxicity.pavojingumas.detales)
  }

  sourceLines.push('')
  sourceLines.push(`Sources used: ${derivedToxicity.sources.join(' + ')}`)
  sourceLines.push('')
  sourceLines.push('TASK: Generate Lithuanian consumer warning label (2-3 sentences) from above source. Translator role only. Step 6a: aiSupplementaryHazard MUST be null.')

  const userMessage = sourceLines.join('\n')

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      temperature: 0.3,
      system: TRANSLATOR_SYSTEM,
      tools: [NARRATIVE_TOOL],
      tool_choice: { type: 'tool', name: 'toxicity_narrative' },
      messages: [{ role: 'user', content: userMessage }],
    })

    const block = response.content?.find(b => b.type === 'tool_use' && b.name === 'toxicity_narrative')
    const out = block?.input ?? {}
    return {
      detales: out.detales ?? null,
      // 6a: schema reikalauja, kad būtų present (object arba null). Defensyvūs
      // tikrai null'inam — net jei AI ignoruoja instrukciją ir grąžina objektą,
      // 6a metu nieks ten neturi būti.
      aiSupplementaryHazard: null,
      elapsedMs: Date.now() - t0,
    }
  } catch (e) {
    console.warn('[toxicityNarrativeGenerator-server] failed:', e?.message)
    return { ...empty, elapsedMs: Date.now() - t0, error: e?.message }
  }
}
