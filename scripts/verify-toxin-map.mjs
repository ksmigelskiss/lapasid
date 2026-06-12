#!/usr/bin/env node
/**
 * verify-toxin-map.mjs — kryžminė toksiškumo duomenų validacija.
 *
 * 1. Referencinis vientisumas: genus-toxin-map klasės → toxin-classes raktai.
 * 2. ASPCA kryžminė: kur mūsų `saugus:true`, o ASPCA sako toksiška → KONFLIKTAS.
 * 3. Review eilė: tier-2/3 + konfliktai → tasks/toxin-review-queue.md.
 *
 * USAGE: node scripts/verify-toxin-map.mjs   (exit 1 jei yra konfliktų)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf-8'))

const classes = read('data/toxin-classes.json')
const map = read('data/genus-toxin-map.json')
const aspca = read('data/aspca-genus-map.json').toxicityByGenus ?? {}

const classIds = new Set(Object.keys(classes).filter(k => k !== '_meta'))
const genera = Object.keys(map).filter(k => k !== '_meta')

const errors = []      // blokuoja (exit 1)
const conflicts = []   // ASPCA nesutapimai
const review = []      // tier-2/3 + neaiškūs

let agree = 0, aspcaCovered = 0

for (const g of genera) {
  const e = map[g]

  // 1. Referencinis vientisumas
  for (const k of (e.klases ?? [])) {
    if (!classIds.has(k.id)) errors.push(`${g}: nežinoma klasė "${k.id}"`)
  }

  // 2. ASPCA kryžminė
  const a = aspca[g]
  if (a) {
    aspcaCovered++
    const aspcaToxic = (a.toxicTo ?? []).length > 0
    if (aspcaToxic && e.saugus === true) {
      conflicts.push(`🔴 ${g}: ASPCA toksiška (${a.toxicTo.join(',')}), o mūsų saugus:true`)
    } else if (aspcaToxic && e.saugus === false) {
      agree++
      if ((e.klases ?? []).length === 0) {
        review.push(`${g}: ASPCA toksiška, bet klasė nenustatyta — ${e.pastaba ?? 'review'}`)
      }
    } else if (!aspcaToxic && e.saugus === false) {
      conflicts.push(`🟡 ${g}: ASPCA netoksiška, o mūsų saugus:false`)
    } else {
      agree++
    }
  }

  // 3. Review eilė
  if (e.tier >= 2 && e.saugus === false && !conflicts.some(c => c.includes(g))) {
    review.push(`tier-${e.tier} ${g}: ${e.pastaba ?? e.papildoma ?? (e.klases?.map(k => k.id).join(',') || 'review')}`)
  }
}

// Review queue failas
const queue = [
  '# Toksiškumo duomenų review eilė (auto, verify-toxin-map.mjs)',
  `_Atnaujinta paleidus skriptą. Gentys: ${genera.length} · ASPCA padengta: ${aspcaCovered} · sutaria: ${agree}_`,
  '',
  '## 🔴 KONFLIKTAI (spręsti pirma)',
  conflicts.length ? conflicts.map(c => `- ${c}`).join('\n') : '- (nėra)',
  '',
  '## Toksikologo review (tier-2/3 + neaiškios klasės)',
  review.length ? review.map(r => `- ${r}`).join('\n') : '- (nėra)',
  '',
].join('\n')
writeFileSync(join(root, 'tasks/toxin-review-queue.md'), queue + '\n')

// Konsolė
console.log(`Gentys: ${genera.length} | ASPCA padengta: ${aspcaCovered} | sutaria: ${agree}`)
console.log(`Konfliktai: ${conflicts.length} | review eilė: ${review.length}`)
if (conflicts.length) { console.log('\nKONFLIKTAI:'); conflicts.forEach(c => console.log('  ' + c)) }
if (errors.length) { console.log('\nKLAIDOS (referenciniai):'); errors.forEach(e => console.log('  ' + e)) }
console.log('\n→ tasks/toxin-review-queue.md atnaujinta')

if (errors.length) { console.error('\n✗ Referencinės klaidos — exit 1'); process.exit(1) }
if (conflicts.length) { console.error('\n⚠ Konfliktai rasti — peržiūrėk review eilę'); process.exit(1) }
console.log('\n✓ Be konfliktų')
