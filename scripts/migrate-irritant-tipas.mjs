// One-shot migration — patch existing catalog entries po 2026-06-01 oksalato/
// saponino tipas reklasifikavimo. Iki šio fix'o Araceae/Asparagaceae/Schefflera
// gentys gavo tipas='toksiskas' iš ASPCA + PFAF. Botaniškai jos sukelia LOKALŲ
// dirginimą (oksalato rafidės, saponinai), tad teisingas tipas='dirginantis'.
//
// SCRIPT'AS DARO:
//   • Filtruoja catalog entries kur genus ∈ IRRITANT_ONLY_GENERA
//   • Atnaujina pavojai[].tipas: 'toksiskas' → 'dirginantis'
//     (TIK kai severity !== 'stiprus' — life-threatening protected)
//   • TĘSIA pavojai[].detales nepakeisti (jei admin/AI narrative ten yra)
//   • NEPALIEČIA pavojingumas.detales (Phase 2 voice narrative — mechanism
//     description jau teisinga, "kalcio oksalato kristalai..." pasakoja
//     dirginimą, ne sisteminį nuodingumą)
//
// SAUGU:
//   - Aconitum/Nerium/Taxus/Conium ir kt. sisteminiai toksinai nepaveikti
//     (jie ne IRRITANT_ONLY_GENERA sąraše)
//   - Severity nepakeistas — tik tipas (kategorinis label, ne lygis)
//   - Narrative content lieka — tik badge'as pakeičia spalvą/label'ą
//   - Dry-run mode preview'ui prieš commit'inant
//
// USAGE:
//   node --env-file=.env.local scripts/migrate-irritant-tipas.mjs --dry-run
//   node --env-file=.env.local scripts/migrate-irritant-tipas.mjs

import admin from 'firebase-admin'

const DRY_RUN = process.argv.includes('--dry-run')

// MIRROR api/_lib/deriveToxicity-server.js IRRITANT_ONLY_GENERA.
// Jei pridėsi naują genus tenais — atnaujinti ir čia (rare event'as,
// nes script'as one-shot).
const IRRITANT_ONLY_GENERA = new Set([
  // Araceae — calcium oxalate raphides
  'AGLAONEMA', 'ALOCASIA', 'ANTHURIUM', 'ARISAEMA', 'ARUM',
  'CALADIUM', 'CALLA', 'COLOCASIA', 'DIEFFENBACHIA', 'EPIPREMNUM',
  'MONSTERA', 'PHILODENDRON', 'PISTIA', 'POTHOS', 'SCINDAPSUS',
  'SPATHIPHYLLUM', 'SYNGONIUM', 'XANTHOSOMA', 'ZANTEDESCHIA',
  // Asparagaceae — saponinai
  'SANSEVIERIA', 'DRACAENA', 'YUCCA',
  // Araliaceae — oxalate raphides
  'SCHEFFLERA',
])

function isIrritantOnlyGenus(genus) {
  if (!genus) return false
  return IRRITANT_ONLY_GENERA.has(genus.toUpperCase())
}

function extractGenus(latin) {
  if (!latin) return null
  return latin.trim().split(/\s+/)[0]
}

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

console.log(`[irritant-migrate] Reading catalog... (dry-run=${DRY_RUN})`)
const snap = await db.collection('catalog').get()
console.log(`[irritant-migrate] ${snap.size} entries.`)

let scanned = 0
let irritantMatched = 0
let touched = 0
const samples = []

for (const doc of snap.docs) {
  scanned++
  const data = doc.data()
  const latin = data.lotyniskas ?? data.latinName
  if (!latin) continue

  const genus = extractGenus(latin)
  if (!isIrritantOnlyGenus(genus)) continue
  irritantMatched++

  const savybes = data.savybes ?? {}
  const storedPavojai = Array.isArray(savybes.pavojai) ? savybes.pavojai : []
  if (storedPavojai.length === 0) continue

  let changed = false
  const newPavojai = storedPavojai.map(p => {
    if (p?.tipas === 'toksiskas' && p?.severity !== 'stiprus') {
      changed = true
      return { ...p, tipas: 'dirginantis' }
    }
    return p
  })

  if (!changed) continue

  touched++
  if (samples.length < 20) {
    samples.push({
      id: doc.id,
      latin,
      genus,
      before: storedPavojai.map(p => `${p.target}:${p.tipas}/${p.severity}`).join(', '),
      after:  newPavojai.map(p => `${p.target}:${p.tipas}/${p.severity}`).join(', '),
    })
  }

  if (!DRY_RUN) {
    await db.collection('catalog').doc(doc.id).update({
      'savybes.pavojai': newPavojai,
    })
  }
}

console.log('')
console.log('=== IRRITANT TIPAS MIGRATION DONE ===')
console.log(`Scanned:               ${scanned}`)
console.log(`Irritant-genus match:  ${irritantMatched}`)
console.log(`Patched (tipas flip):  ${touched}`)
console.log(`Mode:                  ${DRY_RUN ? 'DRY-RUN (no writes)' : 'LIVE'}`)
if (samples.length > 0) {
  console.log('\nSample changes:')
  for (const s of samples) {
    console.log(`  [${s.id}] ${s.latin}  (${s.genus})`)
    console.log(`    before:  ${s.before}`)
    console.log(`    after:   ${s.after}`)
  }
}
process.exit(0)
