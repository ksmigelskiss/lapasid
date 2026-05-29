// READ-ONLY audit — randa "genus-fallback name residue" catalog'e:
// įrašai, kur `lietuviškas` == genties LT vardas, BET `lotyniskas` yra
// RŪŠIES/CULTIVAR lygio. Tai pre-`6d99682` genus-fallback bug'o liekanos
// (pvz. 2x „Alokazija" skirtingiems Alocasia cultivar'ams) — cultivar gavo
// genties vardą vietoj savito.
//
// Nieko NERAŠO — tik report'as. Pagal rezultatą nuspręsim apply būdą
// (re-add per fixed search / AI re-identify / manual admin edit).
//
// USAGE: node --env-file=.env.local scripts/audit-genus-fallback-names.mjs

import admin from 'firebase-admin'
import { parseLatinName } from '../src/utils/latinName.js'
import { resolveLtServer } from '../api/_lib/ltDictionary-server.js'

function initAdmin() {
  let serviceAccount
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  } catch (e) {
    console.error('FIREBASE_SERVICE_ACCOUNT parse failed:', e.message)
    process.exit(1)
  }
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n')
  }
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
}

initAdmin()
const db = admin.firestore()

const genusLtCache = new Map()
async function genusLt(genus) {
  if (genusLtCache.has(genus)) return genusLtCache.get(genus)
  let name = null
  try { name = (await resolveLtServer(genus))?.ltName ?? null } catch {}
  genusLtCache.set(genus, name)
  return name
}

console.log('[audit] Reading catalog...')
const snap = await db.collection('catalog').get()
console.log(`[audit] ${snap.size} entries.`)

const residue = []
let scanned = 0
for (const doc of snap.docs) {
  const d = doc.data()
  const latin = d.lotyniskas ?? d.latinName
  const lt = (d.lietuviškas ?? '').trim()
  if (!latin || !lt) continue
  const parsed = parseLatinName(latin)
  if (!parsed.genus) continue
  if (parsed.rank === 'genus' || parsed.rank === 'unknown') continue  // tik rūšis/cultivar
  scanned++
  const gLt = await genusLt(parsed.genus)
  if (!gLt) continue
  if (lt.toLowerCase() === gLt.toLowerCase()) {
    residue.push({ docId: doc.id, latin, lt, genus: parsed.genus, rank: parsed.rank, gLt })
  }
}

// Grupuojam pagal LT vardą — kad pamatytume dublikatus (kelios „Alokazija").
const byLt = new Map()
for (const r of residue) {
  if (!byLt.has(r.lt)) byLt.set(r.lt, [])
  byLt.get(r.lt).push(r)
}

console.log('')
console.log('=== GENUS-FALLBACK NAME RESIDUE ===')
console.log(`Species/cultivar entries scanned: ${scanned}`)
console.log(`Residue found (LT == genties vardas): ${residue.length}`)
console.log('')
for (const [lt, items] of [...byLt.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const dup = items.length > 1 ? `  ⚠️ ${items.length} DUBLIKATAI` : ''
  console.log(`„${lt}" (gentis: ${items[0].genus})${dup}`)
  for (const it of items) {
    console.log(`    • ${it.latin}  [${it.rank}]  docId=${it.docId}`)
  }
}
console.log('')
console.log('Veiksmas: šiuos įrašus reikia re-identifikuoti (proper rūšies/cultivar LT vardas).')
console.log('Variantai: (a) ištrinti + re-add per app paiešką (dabar fixed AI kelias);')
console.log('           (b) AI re-identify script; (c) rankinis admin edit.')
process.exit(0)
