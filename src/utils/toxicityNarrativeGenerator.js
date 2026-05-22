/**
 * toxicityNarrativeGenerator — toxicity narrative + aiSupplementaryHazard
 * AI call'as. Dabar 6b versija plus (gap-fill aktyvuotas).
 *
 * VAIDMUO: D strict architecture priemonė — AI turi DVI roles:
 *   (A) TRANSLATOR — kai mūsų ASPCA/PFAF turi entry, AI verčia EN → LT
 *       (narrative.detales).
 *   (B) AUDITOR — kai mūsų DB tyli BET augalas yra žinomas
 *       hospitalizacijos rizikos source'as, AI flag'ina su griežtu
 *       evidence reikalavimu (narrative.aiSupplementaryHazard).
 *
 * Detali D-strict logika + whitelist'as gyvena `toxicityNarrativePrompts.js`
 * (shared'inamas su server-side mirror'u).
 *
 * USAGE (fetchDetails post-step):
 *   const narrative = await generateToxicityNarrative({
 *     claudeCall,
 *     latinName: 'Aconitum napellus',
 *     derivedToxicity,  // {pavojai, pavojingumas, sources, hasToxicity}
 *   })
 *   // narrative = { detales: string|null, aiSupplementaryHazard: object|null }
 *
 * RETURN SHAPE:
 *   { detales: string|null, aiSupplementaryHazard: object|null }
 *
 * Note: anksčiau (Step 6a) grąžindavo string. Step 6b — keičiama į objektą,
 * kad caller'is gautų abu lauks. Caller'iai (fetchDetails, runDStrictTest)
 * atnaujinti.
 *
 * Cost: ~$0.0008 per call. Triggerinama VISADA (6b versija plus).
 * Latency: ~5-15s.
 */

import { NARRATIVE_TOOL, TRANSLATOR_SYSTEM } from './toxicityNarrativePrompts.js'
import { VOICE_PERSONA } from './plantVoicePersona.js'

/**
 * @param {object} opts
 * @param {Function} opts.claudeCall — Anthropic API wrapper
 * @param {string} opts.latinName
 * @param {object} opts.derivedToxicity — output of deriveToxicityFromSources
 * @returns {Promise<{detales: string|null, aiSupplementaryHazard: object|null}>}
 */
export async function generateToxicityNarrative({ claudeCall, latinName, derivedToxicity }) {
  const empty = { detales: null, aiSupplementaryHazard: null }

  // Build SOURCE TEXT
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
    const response = await claudeCall({
      maxTokens: 600,
      temperature: 0.3,
      system: [VOICE_PERSONA, '', TRANSLATOR_SYSTEM].join('\n'),
      tools: [NARRATIVE_TOOL],
      toolChoice: { type: 'tool', name: 'toxicity_narrative' },
      messages: [{ role: 'user', content: userMessage }],
    })

    const block = response.content?.find(b => b.type === 'tool_use' && b.name === 'toxicity_narrative')
    const out = block?.input ?? {}
    return {
      detales: out.detales ?? null,
      aiSupplementaryHazard: out.aiSupplementaryHazard ?? null,
    }
  } catch (e) {
    console.warn('[toxicityNarrativeGenerator] failed:', e?.message)
    return empty
  }
}
