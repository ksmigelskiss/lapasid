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

// ── Schema — TIK narrative output, viskas kita iš deterministic source ──

const NARRATIVE_TOOL = {
  name: 'toxicity_narrative',
  description: 'Translate plant toxicity data from English sources into Lithuanian consumer warning label.',
  input_schema: {
    type: 'object',
    properties: {
      detales: {
        type: 'string',
        description: 'Lithuanian consumer warning label, 3-5 sentences. Structure: (1) what is toxic (parts, compounds named in source); (2) what happens if exposed (symptoms from source); (3) who is most at risk (children, pets — based on ASPCA/PFAF audience); (4) what to do (Pet Poison Helpline / vet / nedelsiant kreiptis). Warning-label tone, not medical lecture.',
      },
    },
    required: ['detales'],
  },
}

// ── Minimal system prompt — translator role ──

const TRANSLATOR_SYSTEM = `You are a translator from English botanical/veterinary sources into Lithuanian consumer warning labels.

YOUR ROLE: STRUCTURING + TRANSLATING the source data we provide. NOT GENERATING from your training.

KEY RULES:
1. Use ONLY information present in the source text below.
2. Translate compound names, mechanism descriptions, symptoms verbatim into Lithuanian.
3. Warning-label tone — consumer protection, NOT medical instruction. Same as "CAUTION: contains lead" labels on commercial products.
4. If source mentions specific harm (death, paralysis, vomiting) — include in narrative.
5. Always end with a first-aid pointer: "Pet Poison Helpline" for pets, "Apsinuodijimų kontrolės centras (8 5 236 20 52)" for humans, "kreipkitės į veterinarą / gydytoją".
6. 3-5 sentences total. Do NOT invent compounds, doses, or effects not in source.

If source data is minimal — output minimal narrative. Don't pad with general botanical knowledge.`

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
  sourceLines.push('TASK: Generate Lithuanian consumer warning label (3-5 sentences) from above source. Translator role only.')

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
