#!/usr/bin/env node
/**
 * audit-toxicity-sources.mjs — TIK SKAITO (nieko nerašo, jokio tinklo/Firestore).
 *
 * Atkartojami skaičiai docs/TOXICITY_DATA.md §10.2 skyriui:
 *   1. Runtime heuristika (ASPCA floor + PFAF genties fallback per derivePfafSeverity)
 *      vs struktūrinis modelis (toxin-classes sunkumo_lubos per genus-toxin-map).
 *   2. PFAF „genties" įrašų kokybė (ar tai tikrai gentis, ar atsitiktinės rūšies /
 *      kitos genties puslapis).
 *   3. PFAF rūšių lygio pavojų padengimas pagrindinėms kambarinių gentims.
 *   4. ASPCA crosswalk padengimas (kiek toksiškų ASPCA įrašų pasiekiama per gentį).
 *
 * Naudojimas:  node scripts/audit-toxicity-sources.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { derivePfafSeverity } from '../src/utils/deriveToxicity.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const load = p => JSON.parse(readFileSync(join(ROOT, p), 'utf8'))

const pfaf = load('data/pfaf.json').results
const { _meta: _m1, ...classes } = load('data/toxin-classes.json')
const { _meta: _m2, ...gmap } = load('data/genus-toxin-map.json')
const aspcaGenus = load('data/aspca-genus-map.json').toxicityByGenus
const aspcaAll = load('data/aspca-toxicity.json').toxicity

const CEIL = ['silpnas', 'vidutinis', 'sunkus', 'mirtinas']
const RANK = { null: 0, silpnas: 1, vidutinis: 2, stiprus: 3 }
const toRuntime = c => ({ silpnas: 'silpnas', vidutinis: 'vidutinis', sunkus: 'stiprus', mirtinas: 'stiprus' })[c] ?? null
const cap = g => g[0] + g.slice(1).toLowerCase()
const hasHazard = e => !!(e?.knownHazards && !/^none known/i.test(e.knownHazards.trim()))
const sev = e => (e?.knownHazards ? derivePfafSeverity([e.knownHazards, e.knownHazardsLt].filter(Boolean).join(' ')) : null)
const maxBy = (arr, order) => arr.reduce((a, b) => (a == null || order.indexOf(b) > order.indexOf(a) ? b : a), null)

// ── 1. Runtime vs struktūrinis modelis ─────────────────────────────
const rows = Object.keys(gmap).map(G => {
  const e = gmap[G]
  const modelMax = maxBy((e.klases || []).map(k => classes[k.id]?.sunkumo_lubos).filter(Boolean), CEIL)
  const pfafGenusSev = sev(pfaf[cap(G)])
  const runtime = [aspcaGenus[G] ? 'vidutinis' : null, pfafGenusSev]
    .reduce((a, b) => (RANK[b] > RANK[a] ? b : a), null)
  return { G, saugus: e.saugus, modelMax, modelRt: toRuntime(modelMax), runtime }
})
const toxic = rows.filter(r => !r.saugus && r.modelMax)
const agree = toxic.filter(r => r.runtime === r.modelRt)
const under = toxic.filter(r => RANK[r.runtime] < RANK[r.modelRt])
const over = toxic.filter(r => RANK[r.runtime] > RANK[r.modelRt])
const safeFlagged = rows.filter(r => r.saugus && r.runtime)
const fmt = r => `${r.G}(${r.modelMax}→${r.runtime ?? 'null'})`

console.log('\n## 1. Runtime heuristika vs struktūrinis modelis')
console.log(`Toksiškų genčių su priskirta klase: ${toxic.length}`)
console.log(`  sutampa: ${agree.length} | runtime žemiau modelio: ${under.length} | runtime aukščiau: ${over.length}`)
console.log(`  žemiau: ${under.map(fmt).join(', ')}`)
console.log(`  aukščiau: ${over.map(fmt).join(', ')}`)
console.log(`  iš jų sunkios/mirtinos klasės nuvertintos: ${under.filter(r => ['sunkus', 'mirtinas'].includes(r.modelMax)).map(r => r.G).join(', ')}`)
console.log(`Saugios pagal modelį, bet runtime rodo pavojų: ${safeFlagged.length} → ${safeFlagged.map(r => `${r.G}(${r.runtime})`).join(', ')}`)

// ── 2. PFAF „genties" įrašų kokybė ─────────────────────────────────
const keys = Object.keys(pfaf)
const genusKeys = keys.filter(k => !k.includes(' ') && pfaf[k].found !== false)
const sig = e => [e.commonNameEn || '', (e.habitats || '').slice(0, 80), (e.range || '').slice(0, 60)].join('|')
const bySig = {}
for (const k of genusKeys) {
  const s = sig(pfaf[k])
  if (s.replace(/\|/g, '').trim()) (bySig[s] ||= []).push(k)
}
const dupGroups = Object.values(bySig).filter(a => a.length > 1)
const speciesPage = genusKeys.filter(k => keys.some(x => x.startsWith(k + ' ') && sig(pfaf[x]) === sig(pfaf[k])))
console.log('\n## 2. PFAF genties lygio įrašai')
console.log(`Genties lygio įrašų (found): ${genusKeys.length}`)
console.log(`  = konkrečios tos genties rūšies puslapis: ${speciesPage.length}`)
console.log(`  turinys identiškas KITOS genties raktui: ${dupGroups.flat().length} raktų ${dupGroups.length} grupėse (pvz. ${dupGroups.slice(0, 5).map(a => a.join('+')).join('; ')})`)
console.log(`  su realiu pavojų tekstu (naudojama kaip fallback visai genčiai): ${genusKeys.filter(k => hasHazard(pfaf[k])).length}`)
for (const g of ['Dracaena', 'Solanum', 'Lotus', 'Ananas', 'Aechmea', 'Calathea', 'Maranta']) {
  const e = pfaf[g]
  if (e) console.log(`  ${g.padEnd(9)} → "${(e.commonNameEn || '').slice(0, 40)}" (šeima: ${e.family}) pavojai: ${(e.knownHazards || '').slice(0, 60).replace(/\s+/g, ' ')}`)
}

// ── 3. PFAF rūšių lygio pavojų padengimas ─────────────────────────
console.log('\n## 3. PFAF rūšių lygis (kambarinių gentys)')
for (const g of ['Aglaonema', 'Begonia', 'Codiaeum', 'Dieffenbachia', 'Dracaena', 'Epipremnum', 'Jatropha', 'Kalanchoe', 'Spathiphyllum', 'Syngonium', 'Zamioculcas']) {
  const spp = keys.filter(k => k.startsWith(g + ' '))
  console.log(`  ${g.padEnd(13)} rūšių: ${String(spp.length).padStart(3)} | su pavojų tekstu: ${spp.filter(k => hasHazard(pfaf[k])).length}`)
}

// ── 4. ASPCA crosswalk padengimas ─────────────────────────────────
const linked = new Set()
Object.values(aspcaGenus).forEach(e => (e.matchedEntries || []).forEach(m => linked.add(m.slug)))
const aspcaToxic = Object.keys(aspcaAll).filter(k => (aspcaAll[k].toxicTo || []).length > 0)
console.log('\n## 4. ASPCA crosswalk')
console.log(`ASPCA toksiškų įrašų: ${aspcaToxic.length} | pasiekiama per gentį: ${aspcaToxic.filter(k => linked.has(k)).length}`)
for (const s of ['chinese-evergreen', 'poinsettia', 'arrow-head-vine', 'orange-day-lily', 'asian-lily', 'easter-lily', 'calla-lily']) {
  const e = aspcaAll[s]
  if (e) console.log(`  ${s.padEnd(18)} toxicTo=${(e.toxicTo || []).join('/').padEnd(17)} pasiekiama: ${linked.has(s) ? 'TAIP' : 'NE'}`)
}
console.log(`  LILIUM runtime: target='gyvunams', severity='vidutinis' (floor) — nors toxicTo=${(aspcaGenus.LILIUM?.toxicTo || []).join('/')}`)
console.log('')
