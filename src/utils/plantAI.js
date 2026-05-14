// Shared Claude API + plant schema utilities. Naudoja: SearchModal (naujų
// augalų paieška), PlantDetail (Atnaujinti per AI mygtukas).
//
// Tas pats `claudeCall` + `TOOL_PREVIEW` + `TOOL_DETAILS` + `PLANT_SYSTEM`
// dabar gyvena vienoje vietoje.

import { auth } from './firebase'
import { fetchWikipediaContext } from './imageService'

// ── Claude API call ─────────────────────────────────────────

export async function claudeCall(body) {
  const idToken = await auth.currentUser?.getIdToken().catch(() => null)
  const headers = { 'Content-Type': 'application/json' }
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    if (err.error === 'limit_reached') {
      const e = new Error('limit_reached')
      e.code = 'limit_reached'
      e.limitType = err.limitType
      throw e
    }
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Refresh full plant info via Claude + Wikipedia RAG ─────

/**
 * Užklausia Claude'o atnaujintos info apie konkretų augalą (pagal lotyniškas +
 * lietuviškas). Pridėjus Wikipedia kontekstą RAG'ui, gauna patikimesnius
 * savybes laukus (pavojai, valgomumas, vaistinis).
 *
 * Grąžina merge'inamus statinius laukus — caller pats merge'ina su esamu
 * plant'u, išsaugodamas vartotojo daiktus (timeline, image, uzrasai, zonaId,
 * status, kategorija, data_prideta).
 *
 * @param {object} plant — esamas plant'as su lotyniskas + lietuviškas
 * @returns {Promise<object>} naujai išspausdinti laukai (savybes, aprasymas,
 *                            sviesa, vanduo, prieziura, etc.)
 */
export async function refreshPlantFromAI(plant, { tools, system }) {
  const lotyniskas = plant.lotyniskas
  const lietuviškas = plant.lietuviškas
  if (!lotyniskas) throw new Error('Augalui trūksta lotyniškas pavadinimo — negaliu užklausti AI.')

  // 1 · Wikipedia RAG — paraleliai su Claude pasiruošimu
  console.log('[refresh/ai] fetching Wikipedia for:', lotyniskas)
  const wikiCtx = await fetchWikipediaContext(lotyniskas)
  console.log('[refresh/ai] wiki found:', !!wikiCtx?.extract, wikiCtx?.title ?? '(no entry)', 'extract len:', wikiCtx?.extract?.length ?? 0)
  const wikiBlock = wikiCtx?.extract
    ? `--- Wikipedia (en) šaltinis: ${wikiCtx.title} ---\n${wikiCtx.extract}\n--- pabaiga ---\n\nNaudok šį šaltinį kaip pirminį autoritetą savybėms. Papildyk savo žiniomis kur trūksta. Detalėse paminėk „Wikipedia mini, kad ..." kai informacija iš ten.`
    : null

  const userContent = [
    wikiBlock,
    `Atnaujink informaciją apie augalą „${lietuviškas}" (${lotyniskas}). Pildyk VISUS schema laukus, ypač atidžiai savybes (pavojai + pavojingumas + valgomumas + vaistinis) pagal confidence taisykles iš system prompt'o.`,
  ].filter(Boolean).join('\n\n')

  // 2 · Helper'is — vienas Claude call'as su konkrečiu tool'u
  const callWithTool = async (tool, label) => {
    console.log(`[refresh/ai] calling Claude API (${label})...`)
    const r = await claudeCall({
      maxTokens:   2048,
      temperature: 0.3,
      // top_p NEnaudojamas — Sonnet 4.6 neleidžia abiejų temperature+top_p kartu
      system,
      tools:       [tool],
      toolChoice:  { type: 'tool', name: tool.name },
      messages:    [{ role: 'user', content: userContent }],
    })
    console.log(`[refresh/ai] ${label} stop_reason:`, r.stop_reason, 'content blocks:', r.content?.length ?? 0)
    const block = r.content.find(b => b.type === 'tool_use' && b.name === tool.name)
    if (!block) {
      const textBlocks = r.content?.filter(b => b.type === 'text').map(b => b.text).join('\n')
      console.error(`[refresh/ai] ${label} NO tool_use block. Text:`, textBlocks || '(none)')
      throw new Error(`${label}: Claude nepateikė rezultato. stop_reason=${r.stop_reason}.`)
    }
    console.log(`[refresh/ai] ${label} keys:`, Object.keys(block.input ?? {}))
    return block.input
  }

  // 3 · Kviečiam preview + details PARALELIAI (greitis + visi laukai)
  const previewTool = tools.find(t => t.name === 'plant_preview')
  const detailsTool = tools.find(t => t.name === 'plant_details')
  const calls = []
  if (previewTool) calls.push(callWithTool(previewTool, 'preview'))
  if (detailsTool) calls.push(callWithTool(detailsTool, 'details'))
  if (calls.length === 0) throw new Error('Nepateikta nei vieno AI tool\'o.')

  const results = await Promise.all(calls)
  const merged = Object.assign({}, ...results)
  console.log('[refresh/ai] merged keys:', Object.keys(merged))
  return merged
}
