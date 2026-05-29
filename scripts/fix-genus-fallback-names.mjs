// Cleanup — pataiso genus-fallback name residue catalog'e (audit-genus-fallback-names
// rado 12). Proper LT vardas: (1) species-lt-names.json (plants.json species vardas),
// (2) jei nėra — genties LT vardas (lt-names.json per resolveLt) + likę latin epitetai.
// Taiso TIK `lietuviškas` (latin/docId nekeičiam). Senas genties vardas pridedamas
// į `sinonimai` (tikras platesnis sinonimas).
//
// USAGE:
//   node --env-file=.env.local scripts/fix-genus-fallback-names.mjs            (dry-run)
//   node --env-file=.env.local scripts/fix-genus-fallback-names.mjs --apply

import admin from 'firebase-admin'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseLatinName } from '../src/utils/latinName.js'
import { resolveLtServer } from '../api/_lib/ltDictionary-server.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const APPLY = process.argv.includes('--apply')
const speciesMap = JSON.parse(readFileSync(join(__dirname, '..', 'data', 'species-lt-names.json'), 'utf-8'))
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

function initAdmin() {
  let sa
  try { sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) }
  catch (e) { console.error('FIREBASE_SERVICE_ACCOUNT parse failed:', e.message); process.exit(1) }
  if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n')
  admin.initializeApp({ credential: admin.credential.cert(sa) })
}
initAdmin()
const db = admin.firestore()

const genusLtCache = new Map()
async function genusLt(g) {
  if (genusLtCache.has(g)) return genusLtCache.get(g)
  let n = null
  try { n = (await resolveLtServer(g))?.ltName ?? null } catch {}
  genusLtCache.set(g, n)
  return n
}

console.log(`[fix-names] Reading catalog... (apply=${APPLY})`)
const snap = await db.collection('catalog').get()

const changes = []
for (const doc of snap.docs) {
  const d = doc.data()
  const latin = d.lotyniskas ?? d.latinName
  const lt = (d.lietuviškas ?? '').trim()
  if (!latin || !lt) continue
  const p = parseLatinName(latin)
  if (!p.genus || p.rank === 'genus' || p.rank === 'unknown') continue
  const gLt = await genusLt(p.genus)
  if (!gLt || lt.toLowerCase() !== gLt.toLowerCase()) continue // ne residue

  // Compose proper vardą: species map → genus + epitetai.
  const words = latin.trim().split(/\s+/)
  const full = latin.trim().toLowerCase()
  const binom = words.slice(0, 2).join(' ').toLowerCase()
  let base, extra
  if (speciesMap[full])       { base = speciesMap[full];  extra = [] }
  else if (speciesMap[binom]) { base = speciesMap[binom]; extra = words.slice(2) }
  else                        { base = gLt;               extra = words.slice(1) }
  if (!base) continue
  const proposed = cap((extra.length ? `${base} ${extra.join(' ')}` : base).trim())
  if (proposed === lt) continue

  const syn = Array.isArray(d.sinonimai) ? d.sinonimai : []
  const newSyn = syn.some(s => (s ?? '').toLowerCase() === lt.toLowerCase()) ? syn : [...syn, lt]
  changes.push({ docId: doc.id, latin, from: lt, to: proposed, newSyn, srcSpecies: !!(speciesMap[full] || speciesMap[binom]) })
}

console.log('')
console.log('=== GENUS-FALLBACK NAME FIX ===')
for (const c of changes) {
  console.log(`[${c.docId}]  „${c.from}" → „${c.to}"   ${c.srcSpecies ? '(plants.json species)' : '(genus+epitetas)'}`)
  console.log(`      ${c.latin}   sinonimai += „${c.from}"`)
}
console.log('')
console.log(`${changes.length} changes. Mode: ${APPLY ? 'APPLY (rašoma)' : 'DRY-RUN (nieko nerašoma)'}`)
if (APPLY) {
  for (const c of changes) {
    await db.collection('catalog').doc(c.docId).update({ lietuviškas: c.to, sinonimai: c.newSyn })
  }
  console.log('✓ Pritaikyta.')
}
process.exit(0)
