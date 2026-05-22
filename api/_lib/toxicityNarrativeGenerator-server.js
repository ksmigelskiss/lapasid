/**
 * Server-side toxicity narrative generator — MIRROR of
 * src/utils/toxicityNarrativeGenerator.js.
 *
 * VAIDMUO (Step 6b versija plus): AI turi DVI roles:
 *   (A) TRANSLATOR — kai mūsų ASPCA/PFAF turi entry, AI verčia EN → LT
 *       (narrative.detales).
 *   (B) AUDITOR — kai mūsų DB tyli BET augalas yra žinomas
 *       hospitalizacijos rizikos source'as, AI flag'ina su griežtu
 *       evidence reikalavimu (narrative.aiSupplementaryHazard).
 *
 * BEHAVIORAL CONTRACT — IDENTIŠKAS client'o variantui:
 *   • Tas pats NARRATIVE_TOOL + TRANSLATOR_SYSTEM (import iš shared file)
 *   • Tas pats sourceLines builder'is (DB-has vs DB-empty branch'as)
 *   • Trigger'as: VISADA (be hasToxicity early return). 6a metu narrative
 *     gen buvo TIK kai hasToxicity=true; 6b atidaro aiSupplementaryHazard
 *     gap-fill'ui kai DB tyli.
 *
 * KAS SKIRIASI nuo client'o:
 *   • Anthropic SDK tiesiogiai (ne /api/claude proxy)
 *   • Module-level Anthropic client (Fluid Compute reuse)
 */
import Anthropic from '@anthropic-ai/sdk'
import { NARRATIVE_TOOL, TRANSLATOR_SYSTEM } from '../../src/utils/toxicityNarrativePrompts.js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Generate LT toxicity narrative + evaluate aiSupplementaryHazard.
 *
 * @param {object} args
 * @param {string} args.latinName
 * @param {object} args.derivedToxicity — output of deriveToxicityFromSourcesServer
 * @returns {Promise<{
 *   detales: string|null,
 *   aiSupplementaryHazard: object|null,
 *   elapsedMs: number,
 *   error?: string,
 * }>}
 */
export async function generateToxicityNarrativeServer({ latinName, derivedToxicity }) {
  const t0 = Date.now()
  const empty = { detales: null, aiSupplementaryHazard: null, elapsedMs: 0 }

  // Build SOURCE TEXT — branch'as: DB has data vs DB empty
  const sourceLines = [`PLANT: ${latinName}`]
  sourceLines.push('')

  if (derivedToxicity?.hasToxicity) {
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
    sourceLines.push('TASK: Fill `detales` field with Lithuanian narrative (2-3 sentences) from above source. `aiSupplementaryHazard` should be null — our DB already covers this plant.')
  } else {
    sourceLines.push('STRUCTURED TOXICITY DATA: (empty — our DB has no entry for this plant)')
    sourceLines.push('')
    sourceLines.push('TASK: `detales` = null (nothing to translate). Evaluate `aiSupplementaryHazard` per AUDITOR rules in system prompt: ONLY fill if plant genus is on the whitelist AND meets ALL criteria. Default = null.')
  }

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
      aiSupplementaryHazard: out.aiSupplementaryHazard ?? null,
      elapsedMs: Date.now() - t0,
    }
  } catch (e) {
    console.warn('[toxicityNarrativeGenerator-server] failed:', e?.message)
    return { ...empty, elapsedMs: Date.now() - t0, error: e?.message }
  }
}
