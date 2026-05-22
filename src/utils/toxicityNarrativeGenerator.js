/**
 * toxicityNarrativeGenerator — mini AI call'as TIK toxicity narrative'ui
 * iš MŪSŲ DB SOURCES (ASPCA + PFAF).
 *
 * VAIDMUO (post user-test #11): vartotojo „D strict" sprendimas — AI yra
 * vertėjas/strukturizatorius, ne kūrėjas. Jis gauna MŪSŲ source duomenis
 * (ASPCA toxic-to + PFAF knownHazards EN text) ir grąžina:
 *   • LT narrative warning-label style (3-5 sakiniai)
 *
 * AI'us NEPRIDEDA savo training'o info. Jei mūsų source tyli — nieks
 * nesikuria. Tas yra MŪSŲ DB AUTHORITY principas.
 *
 * USAGE (fetchDetails post-step):
 *   const narrative = await generateToxicityNarrative({
 *     claudeCall,
 *     latinName: 'Aconitum napellus',
 *     derivedToxicity,  // {pavojai, pavojingumas, sources, hasToxicity}
 *   })
 *   if (narrative) details.savybes.pavojingumas.detales = narrative
 *
 * Cost: ~$0.0008 per call. Triggerinama TIK kai derivedToxicity.hasToxicity=true.
 * Latency: ~5-15s (Claude Sonnet). Galima ateityje switch'inti į Haiku
 * dar greitesniam call'ui.
 */

// Schema + system prompt extract'inti į shared modulį (Variant B Step 6a).
// Client'as + server'is naudoja tą patį source-of-truth, kad narrative'ai
// būtų vienodi neatsižvelgiant į flow'ą.
import { NARRATIVE_TOOL, TRANSLATOR_SYSTEM } from './toxicityNarrativePrompts.js'

/**
 * @param {object} opts
 * @param {Function} opts.claudeCall — Anthropic API wrapper
 * @param {string} opts.latinName
 * @param {object} opts.derivedToxicity — output of deriveToxicityFromSources
 * @returns {Promise<string|null>} LT narrative arba null jei nepavyko
 */
export async function generateToxicityNarrative({ claudeCall, latinName, derivedToxicity }) {
  if (!derivedToxicity?.hasToxicity) return null

  // Build SOURCE TEXT — tiktai mūsų DB grindiniu (no AI knowledge)
  const sourceLines = [`PLANT: ${latinName}`]
  sourceLines.push('')
  sourceLines.push('STRUCTURED TOXICITY DATA (from our DB — authoritative):')

  for (const p of derivedToxicity.pavojai) {
    sourceLines.push(`  • tipas=${p.tipas}, target=${p.target}, severity=${p.severity} — ${p.detales}`)
  }

  // pavojingumas.detales already contains LT placeholder + PFAF EN citation (per deriveToxicity)
  // Extract just the PFAF/ASPCA raw text for translation
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
    const response = await claudeCall({
      maxTokens: 600,
      temperature: 0.3,
      system: TRANSLATOR_SYSTEM,
      tools: [NARRATIVE_TOOL],
      toolChoice: { type: 'tool', name: 'toxicity_narrative' },
      messages: [{ role: 'user', content: userMessage }],
    })

    const block = response.content?.find(b => b.type === 'tool_use' && b.name === 'toxicity_narrative')
    const narrative = block?.input?.detales ?? null
    return narrative
  } catch (e) {
    console.warn('[toxicityNarrativeGenerator] failed:', e?.message)
    return null
  }
}
