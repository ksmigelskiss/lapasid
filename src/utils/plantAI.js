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
  const wikiCtx = await fetchWikipediaContext(lotyniskas)
  const wikiBlock = wikiCtx?.extract
    ? `--- Wikipedia (en) šaltinis: ${wikiCtx.title} ---\n${wikiCtx.extract}\n--- pabaiga ---\n\nNaudok šį šaltinį kaip pirminį autoritetą savybėms. Papildyk savo žiniomis kur trūksta. Detalėse paminėk „Wikipedia mini, kad ..." kai informacija iš ten.`
    : null

  const userContent = [
    wikiBlock,
    `Atnaujink informaciją apie augalą „${lietuviškas}" (${lotyniskas}). Pildyk VISUS schema laukus, ypač atidžiai savybes (pavojai + pavojingumas + valgomumas + vaistinis) pagal confidence taisykles iš system prompt'o.`,
  ].filter(Boolean).join('\n\n')

  // 2 · Claude call — abu tool'ai (preview + details) per vieną užklausą
  const previewTool = tools.find(t => t.name === 'plant_preview')
  const r = await claudeCall({
    maxTokens:   2048,
    temperature: 0.3,
    topP:        0.8,
    system,
    tools:       [previewTool],
    toolChoice:  { type: 'tool', name: 'plant_preview' },
    messages:    [{ role: 'user', content: userContent }],
  })

  const block = r.content.find(b => b.type === 'tool_use' && b.name === 'plant_preview')
  if (!block) throw new Error('Claude nepateikė rezultato.')

  return block.input
}
