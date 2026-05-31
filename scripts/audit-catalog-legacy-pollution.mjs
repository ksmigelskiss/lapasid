// READ-ONLY audit — randa "legacy pollution" catalog'e nuo PRIEŠ 2026-05-30 fix'ų:
//
//   1. VENDOR ECHO — latinName kuris atrodo kaip vendor garbage (žodžiai be
//      atitikmens pre-DB / species DB) — buvo įmanoma iki commit 024a756, kuris
//      uždraudė vendor echo'ą PLANT_SYSTEM prompt'e.
//
//   2. GENUS-ONLY FALLBACK — latinName turi 2+ žodžius (species/cultivar lygis),
//      bet `lietuviškas` turi tik 1 žodį (genties LT vardas). Tai pre-`f7a7b4e`
//      species-qualified genus fallback bug'as: „Sansevjera" vietoj „Sansevjera
//      zeylanica".
//
//      NB: dalį šio kategorija pataisė scripts/fix-genus-fallback-names.mjs
//      (commit 1933fe4) — bet tas script'as taikė tik vardus iš plants.json.
//      Tuos, kuriems vardo nebuvo, paliko (todėl rezultatai dabar bus mažesni
//      nei pirminis 2026-05-23 audit'as).
//
//   3. KANAPĖ-STYLE HALLUCINATION — `lietuviškas` arba `sinonimai` turi LT
//      žodį kuris yra STRONG signal'as visiškai KITAI genčiai (kanapė →
//      Cannabis, palmė → Arecaceae). Buvo įmanoma iki commit ed0707a, kuris
//      pridėjo strict naming convention į PLANT_SYSTEM.
//
//   4. CROSS-SPECIES SINONIMAI — `sinonimai` arba `ltAllForms` turi species-
//      level LT vardą kuris akivaizdžiai NEATITINKA įrašo own species
//      (pvz. „Sansevjera trijuostė" Sansevieria zeylanica įraše). Buvo
//      įmanoma iki commit 6b330fb, kuris drop'ina genusEntry.ltAllForms
//      species-qualified path'e.
//
// SCOPE / LIMITS:
//   • READ-ONLY — jokie Firestore write'ai. `--apply` flag'as yra placeholder
//     (no-op) ateičiai, kai admin'as norės žymėti įrašus cleanup'ui.
//   • Heuristics, NE definitive. Sample'us reikia žmogaus review prieš bet kokį
//     auto-cleanup'ą.
//   • Genus-DNS žodynas (kategorijai #3) yra HARDCODED ir KONSERVATYVUS — tik
//     žinomai-problematiniai žodžiai (kanapė, palmė, ąžuolas, ąžuoliukas, beržas,
//     pušis…). Ne false-positive paranoja.
//
// CREDENTIALS (BŪTINA — user'is rm'ino .env.local):
//   Script'as reikalauja FIREBASE_SERVICE_ACCOUNT env var kaip JSON string'o.
//   Variantai:
//     (a) Atstatyti .env.local iš Vercel:
//           vercel env pull .env.local
//         Po to:
//           node --env-file=.env.local scripts/audit-catalog-legacy-pollution.mjs
//
//     (b) Inline:
//           FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' \
//             node scripts/audit-catalog-legacy-pollution.mjs
//
//     (c) Tik service account JSON failas:
//           GOOGLE_APPLICATION_CREDENTIALS=path/to/sa.json \
//             node scripts/audit-catalog-legacy-pollution.mjs
//         (script'as bandys application-default credentials jei nera FIREBASE_SERVICE_ACCOUNT)
//
// USAGE:
//   node --env-file=.env.local scripts/audit-catalog-legacy-pollution.mjs
//   node --env-file=.env.local scripts/audit-catalog-legacy-pollution.mjs --json   # full JSON output
//   node --env-file=.env.local scripts/audit-catalog-legacy-pollution.mjs --apply  # no-op placeholder
//
// EXPECTED RUNTIME: ~5-30s catalog'ui su ~500-2000 entries (vienas read all).
// Pre-DB / species-lt-names žodynai įkraunami iš data/*.json (vietiniai failai).

import admin from 'firebase-admin'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseLatinName } from '../src/utils/latinName.js'

// ── CLI flags ─────────────────────────────────────────────────
const argv = new Set(process.argv.slice(2))
const FLAG_JSON  = argv.has('--json')
const FLAG_APPLY = argv.has('--apply')   // NO-OP — ateičiai

// ── Firebase Admin init (multiple credential sources) ────────
function initAdmin() {
  // Variantas A — FIREBASE_SERVICE_ACCOUNT env var (JSON string)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    let sa
    try {
      sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    } catch (e) {
      console.error('FIREBASE_SERVICE_ACCOUNT parse failed:', e.message)
      process.exit(1)
    }
    if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n')
    admin.initializeApp({ credential: admin.credential.cert(sa) })
    return 'FIREBASE_SERVICE_ACCOUNT env'
  }
  // Variantas B — Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS file)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() })
    return `GOOGLE_APPLICATION_CREDENTIALS=${process.env.GOOGLE_APPLICATION_CREDENTIALS}`
  }
  console.error('No Firebase credentials found.')
  console.error('Set FIREBASE_SERVICE_ACCOUNT (JSON string) or GOOGLE_APPLICATION_CREDENTIALS (file path).')
  console.error('See script header for credential setup details.')
  process.exit(1)
}

const credSource = initAdmin()
const db = admin.firestore()

// ── Reference data loading ────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dirname, '..', 'data')

async function loadJson(name) {
  try {
    return JSON.parse(await readFile(join(DATA, name), 'utf-8'))
  } catch (e) {
    console.warn(`[audit] failed to load ${name}: ${e.message}`)
    return null
  }
}

console.log(`[audit] credentials: ${credSource}`)
console.log('[audit] loading reference data...')
const preDb        = await loadJson('pre-db.json')
const ltNames      = await loadJson('lt-names.json')
const speciesLt    = await loadJson('species-lt-names.json') ?? {}
const plants       = await loadJson('plants.json') ?? []

// pre-DB genus set (uppercase keys) — žinomos botaninės gentys
const preDbGenera = new Set(
  preDb?.genera ? Object.keys(preDb.genera).map(k => k.toUpperCase()) : []
)
// pre-DB species set (uppercase "GENUS SPECIES") — žinomi binomial'ai.
// pre-db.json shape: genera[GENUS].species yra OBJECT keyed by speciesKey,
// kiekvienas value turi { species: 'epithet', latinName, ... }.
const preDbSpecies = new Set()
if (preDb?.genera) {
  for (const [genusKey, gData] of Object.entries(preDb.genera)) {
    const speciesObj = gData?.species
    if (!speciesObj || typeof speciesObj !== 'object') continue
    for (const sp of Object.values(speciesObj)) {
      const epithet = (sp?.species ?? sp?.speciesKey ?? '').toString().toLowerCase()
      if (epithet) preDbSpecies.add(`${genusKey.toUpperCase()} ${epithet}`)
    }
  }
}

console.log(`[audit] pre-DB: ${preDbGenera.size} genera, ${preDbSpecies.size} species`)
console.log(`[audit] lt-names: ${ltNames?.ltNames ? Object.keys(ltNames.ltNames).length : 0} genus entries`)
console.log(`[audit] species-lt-names: ${Object.keys(speciesLt).length} entries`)
console.log(`[audit] plants.json: ${plants.length} entries`)

// ── Hallucination dictionary ──────────────────────────────────
// LT žodžiai, kurie yra STRONG genties signal'as. Jei jie atsiranda LT varde
// įraše, kurio Latin genus NE-atitinka šio mappinge'o, tai LIKELY hallucination.
//
// Konservatyvus list'as — tik akivaizdžiai genus-specific žodžiai. Pridėti
// žodį čia tik tada, kai 100% užtikrintas, kad jis NIEKADA legitimately
// neatsiranda kitose gentyse (pvz. „palmė" yra plačiai naudojamas Arecaceae,
// ne tik Arecaceae rodyklių rodyklių).
const HALLUCINATION_GENUS_WORDS = {
  'kanapė':     ['CANNABIS'],
  'kanapės':    ['CANNABIS'],
  'palmė':      [],  // visa Arecaceae šeima — per plati, nepatikrinama be family tree'o
  'ąžuoliukas': ['QUERCUS'],
  'ąžuolas':    ['QUERCUS'],
  'beržas':     ['BETULA'],
  'pušis':      ['PINUS'],
  'eglė':       ['PICEA', 'ABIES'],
  'liepa':      ['TILIA'],
  'klevas':     ['ACER'],
  'kaštonas':   ['AESCULUS', 'CASTANEA'],
  'rožė':       ['ROSA'],
  'tulpė':      ['TULIPA'],
  'lelija':     ['LILIUM'],
  'pelargonija': ['PELARGONIUM'],
  'orchidėja':  [],  // visa Orchidaceae šeima — per plati
}

/**
 * Tikrina ar LT pavadinime yra hallucination word'as, kuris neatitinka
 * įrašo genties. Grąžina array hit'ų: [{ word, expectedGenera }].
 */
function findHallucinations(ltName, ownGenus) {
  if (!ltName || !ownGenus) return []
  const upperGenus = ownGenus.toUpperCase()
  const hits = []
  const ltLower = ltName.toLowerCase()
  for (const [word, expectedGenera] of Object.entries(HALLUCINATION_GENUS_WORDS)) {
    if (!expectedGenera.length) continue   // word'as išjungtas (per plati šeima)
    // Word boundary check'as — kad „kanapė" nematch'intų į „nukanapėjusi"
    const re = new RegExp(`(^|[\\s\\-])${word}([\\s\\-]|$)`, 'iu')
    if (!re.test(ltLower)) continue
    if (!expectedGenera.includes(upperGenus)) {
      hits.push({ word, expectedGenera, ownGenus: upperGenus })
    }
  }
  return hits
}

/**
 * Tikrina vendor echo įtarimą — latinName žodžiai, kurie NĖRA žinomi
 * botanikos vocabulary'je (pre-DB genus + species). Konservatyvus — daug
 * false-positive'ų (legitimate species ne mūsų DB'e). Naudoti tik kaip
 * sample, ne kaip definitive cleanup target'ą.
 */
function suspectVendorEcho(latin, parsed) {
  if (!latin || !parsed?.genus) return null
  const genusUpper = parsed.genus.toUpperCase()
  const genusKnown = preDbGenera.has(genusUpper)

  // Signal 1 — genus visiškai nežinomas pre-DB
  if (!genusKnown) {
    return { reason: 'unknown-genus', genus: parsed.genus }
  }

  // Signal 2 — cultivar yra ALL-CAPS arba turi „nite/lite/silver/gold" vendor marketing
  const VENDOR_MARKETING = /\b(nite|lite|silver|gold|pearl|royal|mystic|fantasy|magic|wonder)\b/i
  if (parsed.cultivar && VENDOR_MARKETING.test(parsed.cultivar)) {
    return { reason: 'vendor-marketing-cultivar', cultivar: parsed.cultivar }
  }

  // Signal 3 — species epithet vendor'iškas (case'as netinka standartiniam binomial'ui)
  // Kvietėjas gali dar tikrinti ar preDbSpecies neturi šio binomial'o.
  if (parsed.species && genusKnown) {
    const key = `${genusUpper} ${parsed.species.toLowerCase()}`
    if (!preDbSpecies.has(key)) {
      // Per plati signalas vienas (daug naujų species nėra pre-DB) —
      // grąžinam tik silpną žymę informacijai.
      return { reason: 'species-not-in-predb', species: parsed.species, weak: true }
    }
  }

  return null
}

/**
 * Tikrina genus-only LT-fallback bug'ą:
 *   • latinName: 2+ žodžiai (species ar cultivar lygis)
 *   • lietuviškas: 1 žodis (vien genties vardas)
 *   • lietuviškas atitinka lt-names.json genus entry ltName'ą
 *
 * Pataisymo metu (commit f7a7b4e) tokie atvejai jau gauna species-qualified
 * formą — bet legacy entries gali turėti bare genus name'ą.
 */
function suspectGenusOnly(latin, lt, parsed) {
  if (!latin || !lt || !parsed?.genus) return null
  if (parsed.rank === 'genus' || parsed.rank === 'unknown') return null
  const ltWords = lt.trim().split(/\s+/).length
  if (ltWords !== 1) return null

  // Patikrinam ar ši lt yra žinoma genus LT
  const genusKey = parsed.genus.charAt(0).toUpperCase() + parsed.genus.slice(1).toLowerCase()
  const genusEntry = ltNames?.ltNames?.[genusKey]
  if (!genusEntry?.ltName) {
    // genties LT nežinoma — tai gali būti legitimate vienžodis vardas
    // (pvz. user'is rankiniu būdu davė). Žymėm kaip weak.
    return { reason: 'one-word-lt-unknown-genus', ltName: lt, latinRank: parsed.rank, weak: true }
  }
  if (genusEntry.ltName.toLowerCase() === lt.toLowerCase()) {
    return {
      reason: 'genus-only-fallback',
      ltName: lt,
      genus: parsed.genus,
      latinRank: parsed.rank,
      expectedQualified: `${genusEntry.ltName} ${parsed.species ?? parsed.cultivar ?? '?'}`,
    }
  }
  return null
}

/**
 * Tikrina cross-species sinonimai pollution'ą:
 * sinonimai array turi įrašą, kuris atrodo kaip RŪŠIES lygio LT vardas
 * (du+ žodžiai) ir to vardo botaninė atitiktis (per species-lt-names.json
 * reverse lookup) NEATITINKA mūsų įrašo own species'o.
 *
 * Pvz. įrašas „Sansevieria zeylanica" turi sinonimai ["Sansevjera trijuostė"],
 * bet „trijuostė" = trifasciata (DIFFERENT species).
 */
function buildSpeciesLtReverse() {
  // species-lt-names map'as: "genus species" lowercase → LT name
  // Mes statomam reverse: LT name lowercase → "GENUS SPECIES"
  const reverse = new Map()
  for (const [latinLower, ltName] of Object.entries(speciesLt)) {
    if (typeof ltName !== 'string') continue
    reverse.set(ltName.toLowerCase(), latinLower.toUpperCase())
  }
  // Pridėk plants.json'o species mapping'us (jei `lithuanian` rūšies-lygio)
  for (const p of plants) {
    if (!p?.latin || !p?.lithuanian) continue
    const latin = p.latin.trim()
    if (latin.split(/\s+/).length < 2) continue
    reverse.set(p.lithuanian.trim().toLowerCase(), latin.toUpperCase())
  }
  return reverse
}

const speciesLtReverse = buildSpeciesLtReverse()
console.log(`[audit] species LT reverse map: ${speciesLtReverse.size} entries`)

function suspectCrossSpeciesSinonimai(latin, sinonimai, parsed) {
  if (!Array.isArray(sinonimai) || !sinonimai.length || !parsed?.genus) return []
  const ownGenusUpper = parsed.genus.toUpperCase()
  const ownSpecies = parsed.species ? parsed.species.toLowerCase() : null
  const ownBinomial = ownSpecies ? `${ownGenusUpper} ${ownSpecies}` : null
  const hits = []
  for (const syn of sinonimai) {
    if (typeof syn !== 'string') continue
    const s = syn.trim()
    if (!s) continue
    // Tik DAUG-žodžiai sinonimai vertingi rūšies kryžkelės testui
    if (s.split(/\s+/).length < 2) continue
    const mappedLatin = speciesLtReverse.get(s.toLowerCase())
    if (!mappedLatin) continue   // nežinom kuriai rūšiai jis priklauso — skip
    // Genus skiriasi → labai stiprus polution signal
    if (!mappedLatin.startsWith(ownGenusUpper)) {
      hits.push({ syn: s, mappedLatin, ownGenus: ownGenusUpper, severity: 'cross-genus' })
      continue
    }
    // Genus tas pats, BET species skiriasi → cross-species
    if (ownBinomial && mappedLatin !== ownBinomial) {
      hits.push({ syn: s, mappedLatin, ownBinomial, severity: 'cross-species' })
    }
  }
  return hits
}

// ── Main scan ─────────────────────────────────────────────────
console.log('[audit] reading catalog...')
const t0 = Date.now()
const snap = await db.collection('catalog').get()
console.log(`[audit] ${snap.size} catalog entries fetched in ${Date.now() - t0}ms`)

const report = {
  meta: {
    scannedAt: new Date().toISOString(),
    totalEntries: snap.size,
    credentialSource: credSource,
    flagApply: FLAG_APPLY,
  },
  categories: {
    vendorEchoSuspected:  { count: 0, weak: 0, samples: [] },
    genusOnlyBug:          { count: 0, weak: 0, samples: [] },
    hallucinationLikely:   { count: 0, samples: [] },
    crossSpeciesSinonimai: { count: 0, samples: [] },
    missingLatinName:      { count: 0, samples: [] },
    missingLtName:         { count: 0, samples: [] },
  },
}

const MAX_SAMPLES = 10

function pushSample(bucket, sample) {
  if (bucket.samples.length < MAX_SAMPLES) bucket.samples.push(sample)
}

for (const doc of snap.docs) {
  const d = doc.data()
  const docId = doc.id
  const latin = (d.lotyniskas ?? d.latinName ?? '').trim()
  const lt    = (d.lietuviškas ?? d.name ?? '').trim()
  const sinonimai = Array.isArray(d.sinonimai) ? d.sinonimai : []

  if (!latin) {
    report.categories.missingLatinName.count++
    pushSample(report.categories.missingLatinName, { docId, lt })
    continue
  }
  if (!lt) {
    report.categories.missingLtName.count++
    pushSample(report.categories.missingLtName, { docId, latin })
  }

  const parsed = parseLatinName(latin)

  // 1. Vendor echo
  const vendor = suspectVendorEcho(latin, parsed)
  if (vendor) {
    if (vendor.weak) {
      report.categories.vendorEchoSuspected.weak++
    } else {
      report.categories.vendorEchoSuspected.count++
      pushSample(report.categories.vendorEchoSuspected,
        { docId, latin, lt, ...vendor })
    }
  }

  // 2. Genus-only bug
  const genusOnly = suspectGenusOnly(latin, lt, parsed)
  if (genusOnly) {
    if (genusOnly.weak) {
      report.categories.genusOnlyBug.weak++
    } else {
      report.categories.genusOnlyBug.count++
      pushSample(report.categories.genusOnlyBug,
        { docId, latin, lt, ...genusOnly })
    }
  }

  // 3. Hallucination (LT name + sinonimai)
  const namesToCheck = [lt, ...sinonimai.filter(s => typeof s === 'string')]
  for (const nm of namesToCheck) {
    const halluc = findHallucinations(nm, parsed.genus)
    if (halluc.length) {
      report.categories.hallucinationLikely.count++
      pushSample(report.categories.hallucinationLikely,
        { docId, latin, lt, sourceField: nm === lt ? 'lietuviškas' : 'sinonimai',
          name: nm, hits: halluc })
      break   // viena hit'as per įrašą — nelaikom kaip 10 atskirų
    }
  }

  // 4. Cross-species sinonimai
  const cross = suspectCrossSpeciesSinonimai(latin, sinonimai, parsed)
  if (cross.length) {
    report.categories.crossSpeciesSinonimai.count++
    pushSample(report.categories.crossSpeciesSinonimai,
      { docId, latin, lt, hits: cross })
  }
}

// ── Apply mode placeholder (NO-OP) ────────────────────────────
if (FLAG_APPLY) {
  console.log('')
  console.log('[audit] --apply flag set, BUT no apply logic implemented yet.')
  console.log('[audit] This is intentional — see tasks/audit-catalog-legacy-pollution-2026-05-30.md')
  console.log('[audit] for cleanup strategy discussion (Auto-fix vs Flag-for-review vs Targeted nuke).')
  console.log('[audit] No writes performed.')
}

// ── Output ────────────────────────────────────────────────────
if (FLAG_JSON) {
  console.log(JSON.stringify(report, null, 2))
  process.exit(0)
}

console.log('')
console.log('=================================================')
console.log('CATALOG LEGACY POLLUTION AUDIT')
console.log('=================================================')
console.log(`Scanned at:     ${report.meta.scannedAt}`)
console.log(`Total entries:  ${report.meta.totalEntries}`)
console.log('')
console.log('Category counts (strong signals only):')
console.log(`  vendor-echo suspected:       ${report.categories.vendorEchoSuspected.count}  (weak: ${report.categories.vendorEchoSuspected.weak})`)
console.log(`  genus-only fallback bug:     ${report.categories.genusOnlyBug.count}  (weak: ${report.categories.genusOnlyBug.weak})`)
console.log(`  hallucination-style names:   ${report.categories.hallucinationLikely.count}`)
console.log(`  cross-species sinonimai:     ${report.categories.crossSpeciesSinonimai.count}`)
console.log(`  missing latinName:           ${report.categories.missingLatinName.count}`)
console.log(`  missing lietuviškas:         ${report.categories.missingLtName.count}`)
console.log('')

for (const [key, bucket] of Object.entries(report.categories)) {
  if (!bucket.samples.length) continue
  console.log(`--- Samples: ${key} (max ${MAX_SAMPLES}) ---`)
  for (const s of bucket.samples) {
    console.log(`  • ${s.docId}`)
    console.log(`    latin: ${s.latin ?? '-'}`)
    if (s.lt) console.log(`    lt:    ${s.lt}`)
    if (s.reason) console.log(`    reason: ${s.reason}`)
    if (s.expectedQualified) console.log(`    expected: ${s.expectedQualified}`)
    if (s.hits) {
      for (const h of s.hits) {
        console.log(`    hit:   ${JSON.stringify(h)}`)
      }
    }
  }
  console.log('')
}

console.log('Run with --json for machine-readable output.')
console.log('Run with --apply for cleanup (currently no-op — see tasks/audit-catalog-legacy-pollution-2026-05-30.md).')

process.exit(0)
