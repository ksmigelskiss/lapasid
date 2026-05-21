/**
 * diagnosticPromptCheck — paklausia Claude'ą "kodėl tu praleidi šitą lauką?"
 *
 * VAIDMUO (vartotojo idėja iš testavimo #7): kai mes negalim suprasti,
 * kodėl AI selektyviai praleidžia konkretų schema field'ą (pvz., pavojai
 * vis dar 0 nors RAG turi PFAF knownHazards 600 chars), užbuvome bandant
 * tobulinti prompt'ą per atspėjimą. EFEKTYVIAU — paklausti modelį pat'ies
 * paaiškinti elgesį.
 *
 * USAGE (admin/dev only — NE production hot path):
 *   import { diagnosticPromptCheck } from './diagnosticPromptCheck'
 *
 *   const diagnostic = await diagnosticPromptCheck({
 *     claudeCall,
 *     systemPrompt: groundedSystem,
 *     latinName: 'Aconitum napellus',
 *     observedSkip: 'savybes.pavojai liko tuščias array',
 *   })
 *   console.log(diagnostic.explanation)
 *
 * Tas grąžina Claude'o aiškinimą (LT) — kas jam neaišku, koks instrukcijos
 * sluoksnis prieštarauja kitam, ar yra signal'ą "nepildyk".
 *
 * COST: ~$0.005 per call (~1500 tokens response, plain text, no tools).
 * Tik manual debug'ui. Ne automated production flow.
 */

const DIAGNOSTIC_QUESTION_TEMPLATE = (latinName, observedSkip) => `Aš noriu suprasti, kaip tu interpret'uoji mano system instrukcijas.

KONTEKSTAS: aš tau ką tik daviau system prompt'ą su daug sluoksnių:
  • PLANT_SYSTEM (bendros instrukcijos)
  • RAG context (verified facts iš mūsų DB)
  • RAG_PRIORITY_INSTRUCTION (kaip naudoti RAG'ą)
  • LT_CLIMATE_CONTEXT (LT klimato detail)
  • VET_LINKS (toxicity external sources)
  • TOOL_DETAILS schema (kuo pildyti)

OBSERVED BEHAVIOR (augalas "${latinName}"):
  ${observedSkip}

KLAUSIMAI:
1. Ar TU MATYDAVAI šito augalo info? (Ne RAG facts, o iš tavo training'o.)
2. Ar mano RAG context'as turi reikiamų faktų?
3. Ar kažkas konkrečiai mano system prompt'e ar RAG context'e
   sako tau NEPILDYTI šio lauko, ar yra fraza, kuri suvaržo?
4. Ar kažkur yra signal'as „atsargiai, neperkelti į schema laukus"?
5. Jei aš norėčiau, kad TU pildytum šitą lauką PILNAI — kokios
   instrukcijos pakeitimai labiausiai padėtų?

Atsakyk LT, atvirai, technical detalumu. Be diplomatijos — tikrai
sakyk, kas tau aiškiai signalizuoja „pildyk/nepildyk".`

/**
 * @param {object} opts
 * @param {Function} opts.claudeCall — Anthropic API wrapper
 * @param {string} opts.systemPrompt — pilnas system prompt'as (groundedSystem)
 * @param {string} opts.latinName — testuojamo augalo Latin
 * @param {string} opts.observedSkip — kas blogai (1 sakinys)
 * @returns {Promise<{ explanation: string, rawResponse: object }>}
 */
export async function diagnosticPromptCheck({
  claudeCall,
  systemPrompt,
  latinName,
  observedSkip,
}) {
  const question = DIAGNOSTIC_QUESTION_TEMPLATE(latinName, observedSkip)

  const r = await claudeCall({
    maxTokens: 2000,
    temperature: 0.3,
    system: systemPrompt,
    messages: [{ role: 'user', content: question }],
  })

  // No tool_use — paprastas text response
  const textBlock = r.content?.find(b => b.type === 'text')
  const explanation = textBlock?.text ?? '(no text response)'

  return {
    explanation,
    rawResponse: r,
    usage: r.usage,
  }
}
