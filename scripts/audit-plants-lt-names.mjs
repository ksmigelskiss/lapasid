// READ-ONLY audit — plants.json (5786 LT vardų, scrape'inta iš LT portalų) kokybė.
// Tikslas: rasti įtartinus įrašus manual peržiūrai (descriptor-tipo „vardai",
// dublikatai, anomalijos) — nes iš ten dabar traukiam species LT vardus (resolveLt).
//
// Nieko NERAŠO. USAGE: node scripts/audit-plants-lt-names.mjs

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const plants = JSON.parse(readFileSync(join(__dirname, '..', 'data', 'plants.json'), 'utf-8'))

let genus = 0, species = 0, noLt = 0
const byLatin = new Map()        // latin → [lt, ...] (dublikatai)
const byLt = new Map()           // lt → count (perpanaudoti vardai)
const suspect = []               // descriptor-tipo / anomalijos

// Descriptor / ne-tikro-vardo signalai
const DESCRIPTOR = /(pavidal|tipo\b|rūšis|forma\b|veislė|hibrid|grupė|serij|sp\.|\bspp\b|augalas\b|nežinom|kit[ųi])/i

for (const e of plants) {
  if (!e?.latin) continue
  const lt = (e.lithuanian ?? '').trim()
  if (!lt) { noLt++; continue }
  const latin = e.latin.trim()
  const words = latin.split(/\s+/).length
  if (words === 1) genus++; else species++

  byLatin.set(latin.toLowerCase(), [...(byLatin.get(latin.toLowerCase()) ?? []), lt])
  byLt.set(lt.toLowerCase(), (byLt.get(lt.toLowerCase()) ?? 0) + 1)

  const ltWords = lt.split(/\s+/).length
  const flags = []
  if (DESCRIPTOR.test(lt)) flags.push('descriptor')
  if (ltWords > 3)         flags.push(`${ltWords}-žodžiai`)
  if (/[0-9]/.test(lt))    flags.push('skaičiai')
  if (/[(){}\[\]"„"]/.test(lt)) flags.push('skliaustai/kabutės')
  if (!/^[A-ZĄČĘĖĮŠŲŪŽa-ząčęėįšųūž]/.test(lt)) flags.push('keista-pradžia')
  if (flags.length) suspect.push({ latin, lt, flags })
}

const dupLatin = [...byLatin.entries()].filter(([, v]) => new Set(v.map(x => x.toLowerCase())).size > 1)
const reusedLt = [...byLt.entries()].filter(([, c]) => c >= 8).sort((a, b) => b[1] - a[1])

console.log('=== plants.json LT vardų AUDIT ===')
console.log(`Iš viso įrašų:          ${plants.length}`)
console.log(`  genus (1 žodis):      ${genus}`)
console.log(`  species (2+ žodžiai):  ${species}`)
console.log(`  be LT vardo:          ${noLt}`)
console.log(`Latin su KONFLIKTUOJANČIAIS LT vardais: ${dupLatin.length}`)
console.log(`Įtartini (descriptor/anomalijos):       ${suspect.length}`)
console.log('')
console.log('--- Sample įtartinų (pirmi 25) ---')
for (const s of suspect.slice(0, 25)) console.log(`  „${s.lt}"  ←  ${s.latin}   [${s.flags.join(', ')}]`)
console.log('')
console.log('--- Latin su >1 skirtingu LT vardu (pirmi 15) ---')
for (const [lat, lts] of dupLatin.slice(0, 15)) console.log(`  ${lat}: ${[...new Set(lts)].join(' | ')}`)
console.log('')
console.log('--- Daug perpanaudoti LT vardai (≥8× — genčių vardai daugeliui rūšių) ---')
for (const [lt, c] of reusedLt.slice(0, 15)) console.log(`  „${lt}" ×${c}`)
