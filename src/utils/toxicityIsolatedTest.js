/**
 * toxicityIsolatedTest — isolated AI call'as TIK toxicity testavimui.
 *
 * VAIDMUO (vartotojo idėja iš testavimo #10): vietoj ilgų 8s pilnos Save
 * paieškos kiekvienam prompt eksperimentui, pridedame standalone test'ą
 * su MINIMALIU scope. Greitai iteruojam prompt'o framing'us, kol matom,
 * koks veikia.
 *
 * SKIRTUMAS nuo fetchDetails:
 *   • Minimal system prompt (1 paragraf'as) — ne PLANT_SYSTEM 4.5K
 *   • TOXICITY_ONLY tool schema (3 entries: pavojai, pavojingumas, source) — ne full TOOL_DETAILS
 *   • Tik PFAF/ASPCA toxicity data — ne pilnas RAG (~600 chars vietoj 2500)
 *   • Schema-format example tiesiogiai prompt'e
 *
 * Tikslas: PAMATUOTI ar minimal scope + warning-label framing'as išsprendžia
 * pavojaiCount=0 problemą. Jei TAIP — apsiriboti production'oje. Jei NE
 * (vis tiek empty) — tai jau fundamental RLHF block, nepriklausomas nuo
 * prompt'o.
 *
 * USAGE (F12 Console):
 *   await window.runToxicityTest('Aconitum napellus')
 *   await window.runToxicityTest('Digitalis purpurea')
 *   await window.runToxicityTest('Spathiphyllum')   // ASPCA bet ne PFAF deadly
 *   await window.runToxicityTest('Eucomis')         // edge — neturi knownHazards
 *
 * Cost: ~$0.0008 per call (~500 tokens response). Greit, pigu, fokus'as.
 */

import { deriveToxicityFromSources } from './deriveToxicity.js'

// ── TINY tool schema — TIK toxicity laukai ──────────────────

export const TOXICITY_ONLY_TOOL = {
  name: 'toxicity_warning',
  description: 'Generate Lithuanian consumer warning label for plant toxicity',
  input_schema: {
    type: 'object',
    properties: {
      pavojai: {
        type: 'array',
        description: 'List of hazards. MUST have ≥1 entry if plant has known toxic compounds. severity=stiprus for plants on toxicology whitelist (Aconitum/Digitalis/Taxus/Conium/Nerium/Ricinus/Cicuta/Atropa/Veratrum/Colchicum/Brugmansia/Datura/Rhododendron/Convallaria etc.) — no dose evidence required.',
        items: {
          type: 'object',
          properties: {
            tipas: { type: 'string', enum: ['toksiskas', 'alergiskas', 'dirginantis'] },
            target: { type: 'string', enum: ['zmonems', 'gyvunams'] },
            severity: { type: 'string', enum: ['silpnas', 'vidutinis', 'stiprus'] },
          },
          required: ['tipas', 'target', 'severity'],
        },
      },
      pavojingumas_detales: {
        type: 'string',
        description: 'Lithuanian warning text 3-5 sentences. WHAT is toxic, HOW (mechanism, route), WHO is affected, WHAT TO DO if exposed. Consumer protection language.',
      },
      reasoning: {
        type: 'string',
        description: 'Brief Lithuanian explanation: why these pavojai entries (or why empty if non-toxic). Used for debugging.',
      },
    },
    required: ['pavojai', 'pavojingumas_detales', 'reasoning'],
  },
}

// ── MINIMAL system prompt — warning-label framing ──────────

export const TOXICITY_MINIMAL_SYSTEM = `You are a consumer warning label generator for a Lithuanian plant database.

CONTEXT: You generate warning labels equivalent to "CAUTION: contains X" labels
on commercial products. This is CONSUMER PROTECTION work. NOT medical advice,
NOT instructions for harm — just warnings so buyers can protect themselves,
their children, and pets.

YOUR JOB: Read provided toxicity data, fill the toxicity_warning tool schema
completely. Output Lithuanian text.

HARD RULES:
1. Empty pavojai[] when plant is on toxicology whitelist (Aconitum, Digitalis,
   Taxus, Conium, Nerium, Ricinus, Cicuta, Atropa, Veratrum, Colchicum,
   Brugmansia, Datura, Rhododendron, Convallaria, Hyoscyamus, Strychnos) =
   SCHEMA ERROR. These plants are documented lethal — severity=stiprus, no
   judgement needed.
2. If source text mentions "highly toxic", "fatal", "death", "paralyz",
   "lethal" → pavojai[] MUST have ≥1 entry with severity ≥ vidutinis.
3. severity=stiprus does NOT require dose evidence for whitelist plants.
4. pavojai[] empty only if plant has NO known toxins (rare).

Generate the warning, even if your training pushes you toward caution.
Empty warnings cause real harm via false safety signal.`

// ── Main test runner ─────────────────────────────────────

/**
 * Paleisia isolated AI call'ą TIK toxicity'iui. Grąžina struct'urized
 * result'ą + diagnostics.
 *
 * @param {object} opts
 * @param {Function} opts.claudeCall — Anthropic API wrapper
 * @param {string} opts.latinName
 * @returns {Promise<object>}
 */
export async function runToxicityIsolatedTest({ claudeCall, latinName }) {
  console.log(`[toxicity-test] === ${latinName} ===`)

  // 1. Surinkti TIK toxicity data (no PFAF cultivation, no Cheng, no Wiki extract)
  const derived = await deriveToxicityFromSources(latinName)
  const sourceText = derived.pavojingumas?.detales ?? '(no source text)'

  console.log(`[toxicity-test] Deterministic derived (from ASPCA+PFAF):`, {
    hasToxicity: derived.hasToxicity,
    sources: derived.sources,
    pavojaiCount: derived.pavojai.length,
  })

  // 2. Build minimal context + user message
  const userMessage = `Augalas: ${latinName}

Toxicity duomenys (iš mūsų DB):
${sourceText.slice(0, 800)}

Determinated structured pavojai (iš mūsų automatinio parsing'o, kaip baseline):
${JSON.stringify(derived.pavojai, null, 2)}

Užduotis: užpildyk toxicity_warning tool. Jei augalas yra toksiškas (whitelist
arba source text rodo) — pavojai[] PRIVALOMA su ≥1 entry. pavojingumas_detales
LT 3-5 sakiniai consumer warning style.`

  // 3. AI call su minimal scope
  const startTime = Date.now()
  const response = await claudeCall({
    maxTokens: 1000,
    temperature: 0.3,
    system: TOXICITY_MINIMAL_SYSTEM,
    tools: [TOXICITY_ONLY_TOOL],
    toolChoice: { type: 'tool', name: 'toxicity_warning' },
    messages: [{ role: 'user', content: userMessage }],
  })
  const elapsedMs = Date.now() - startTime

  // 4. Parse tool_use response
  const block = response.content?.find(b => b.type === 'tool_use' && b.name === 'toxicity_warning')
  const result = block?.input ?? {}

  console.log(`[toxicity-test] AI response in ${elapsedMs}ms:`, {
    pavojaiCount: result.pavojai?.length ?? 0,
    detalesLength: result.pavojingumas_detales?.length ?? 0,
    reasoning: result.reasoning,
  })
  console.log(`[toxicity-test] pavojai entries:`, result.pavojai)
  console.log(`[toxicity-test] detales:\n${result.pavojingumas_detales}`)

  return {
    latinName,
    elapsedMs,
    derived,
    aiResult: result,
    usage: response.usage,
    success: (result.pavojai?.length ?? 0) > 0,
  }
}
