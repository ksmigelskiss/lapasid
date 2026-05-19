// Realaus catalog'o audit'as — paleidžia parseLatinName ant visų
// catalog įrašų, parodo kokio rank'o kiekvienas yra, ir iškelia
// suspicious atvejus (kur parser'is nesutiko su faktine struktūra).
//
// Naudojimas:
//   node scripts/audit-catalog-parsing.mjs
//
// Naudoja Firebase web SDK su public config'u (apiKey iš firebase.js
// nėra paslaptis — security per Firestore Rules). Jei Rules neleidžia
// neauth'o read'o `catalog` collection'ui — script'as fail'ina ir reikia
// alternatyvaus kelio (browser console snippet'as).

import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs } from 'firebase/firestore'
import { parseLatinName } from '../src/utils/latinName.js'

const firebaseConfig = {
  apiKey:            'AIzaSyCrmPG0svbkL8irAwsRutwZURnpqgqieds',
  authDomain:        'geliu-db.firebaseapp.com',
  projectId:         'geliu-db',
  storageBucket:     'geliu-db.firebasestorage.app',
  messagingSenderId: '429930306781',
  appId:             '1:429930306781:web:a652d688e921bc5267cf34',
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

console.log('[audit] fetching catalog...')
let snap
try {
  snap = await getDocs(collection(db, 'catalog'))
} catch (e) {
  console.error('[audit] Firestore read failed:', e.message)
  console.error('[audit] Tikriausiai Firestore Rules neleidžia public read\'o.')
  console.error('[audit] Alternative: paleisk browser console snippet\'ą iš scripts/audit-catalog-console.md.')
  process.exit(1)
}

console.log(`[audit] gauta ${snap.size} įrašų\n`)

const rankCounts = {}
const suspicious = []
const samples = { species: [], cultivar: [], hybrid: [], variety: [], subspecies: [], genus: [], unknown: [] }

for (const docSnap of snap.docs) {
  const data = docSnap.data()
  const latin = data.lotyniskas ?? data.latinName ?? ''
  if (!latin) {
    suspicious.push({ id: docSnap.id, latin, why: 'tuščias lotyniškas pavadinimas' })
    continue
  }

  const parsed = parseLatinName(latin)
  rankCounts[parsed.rank] = (rankCounts[parsed.rank] ?? 0) + 1

  // Surenkam po keletą pavyzdžių iš kiekvieno rank'o
  if (samples[parsed.rank] && samples[parsed.rank].length < 5) {
    samples[parsed.rank].push({ id: docSnap.id, latin, parsed })
  }

  // Įtartini atvejai:
  // - rank='unknown' — parser'is neatpažino visiškai
  // - rank='genus' BET įrašas turi taxonGroupId su cultivar lygiu
  // - latinName turi kabutes BET parser'is sako 'species'/'genus' (bug)
  // - parser'is sako 'cultivar' BET nėra genus arba species
  if (parsed.rank === 'unknown') {
    suspicious.push({ id: docSnap.id, latin, parsed, why: 'parser rank=unknown' })
  } else if (/['"]/.test(latin) && (parsed.rank === 'species' || parsed.rank === 'genus')) {
    suspicious.push({ id: docSnap.id, latin, parsed, why: 'turi kabutes bet parser sako ne-cultivar' })
  } else if (parsed.rank === 'cultivar' && !parsed.genus) {
    suspicious.push({ id: docSnap.id, latin, parsed, why: 'cultivar be genus' })
  }
}

// ── Ataskaita ───────────────────────────────────────────────────
console.log('═══ RANK DISTRIBUTION ═══')
for (const [rank, count] of Object.entries(rankCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${rank.padEnd(12)} ${count}`)
}

console.log('\n═══ SAMPLES PER RANK ═══')
for (const [rank, list] of Object.entries(samples)) {
  if (list.length === 0) continue
  console.log(`\n  ${rank}:`)
  for (const s of list) {
    const parts = []
    if (s.parsed.genus) parts.push(`genus=${s.parsed.genus}`)
    if (s.parsed.species) parts.push(`species=${s.parsed.species}`)
    if (s.parsed.infraspecific) parts.push(`infra=${s.parsed.infraspecific}`)
    if (s.parsed.cultivar) parts.push(`cv=${s.parsed.cultivar}`)
    console.log(`    "${s.latin}" → ${parts.join(', ')}`)
  }
}

if (suspicious.length > 0) {
  console.log(`\n═══ SUSPICIOUS (${suspicious.length}) ═══`)
  for (const s of suspicious) {
    console.log(`  [${s.why}] id=${s.id} latin="${s.latin}"`)
    if (s.parsed) console.log(`    parsed:`, s.parsed)
  }
} else {
  console.log('\n✓ Nėra suspicious įrašų — visi catalog įrašai parser\'iui pažįstami.')
}

process.exit(0)
