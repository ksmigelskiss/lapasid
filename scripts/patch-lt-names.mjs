// One-shot bulk patch — normalize lietuviškas catalog field per resolveLt
// canonical lookup'ą. Po visų šiandienos fix'ų (Sansevieria/Dracaena override,
// Pilea peperomioides curated, Hoya macron sanitize, cultivar quotes parser),
// daug catalog entries dar turi senas/inkonsistentiškas LT title reikšmes:
//
//   • „Aglaonema 'Orange Star'"   → „Aglonema 'Orange Star'"
//   • „Aglonema White Joy"        → „Aglonema 'White Joy'"  (quotes added)
//   • „Sansevieria"               → „Trijuostė sansevjera" (po Dracaena merge)
//   • „Pilea peperomioides"       → „Kininis piniginis augalas"
//   • „Storalāpė vaškūnė"         → „Storalapė vaškūnė" (Latvian macron strip)
//
// F1 catalog overlay → user plants auto-pick'ina patch'ą per resolvePlantView,
// tad scaning'ame TIK catalog'as (ne collectionGroup plants — automatiškai
// gauna update'ą per overlay).
//
// HEURISTIKA „turėtų patch'inti" — CONSERVATIVE po dry-run audit'o:
//   1. Current LT === Latin verbatim (Latin display as LT — clear bug)
//   2. Current LT === Latin epithet only (orphan epithet)
//   3. Cultivar construct (parsed.rank === cultivar) IR resolveLt grąžina
//      su quotes — current title likely missing quotes
//   4. EXPLICIT_OVERRIDES list — Sansevieria/Dracaena/Pilea fix'ai kuriuos
//      pridėjom šiandien į lt-names-overrides.json — known good
//
// SAUGUMAS — KODĖL NE „bet curated species hit":
//   plants.json scrape'as turi noise — kai kurie entries corrupted („Didiaied
//   pelargonija" iš originalo „Didžiažiedė", „Raukltoji peperomija" iš
//   „Raukšlėtoji peperomija"). Catalog'as turi ESTABLISHED LT names (Bostono
//   papartis, Žilė cinenarija) kurie geresni nei plants.json raw entries.
//   Per agresyvus override regresuotų catalog quality.
//
//   User-curated LT names (e.g. „Mano pelargonija") nepateks į patch.
//   Dry-run mode pirmiausia.

// Explicit override whitelist — entries kuriuos curated'inau today
// (lt-names-overrides.json species section). Šie SAUGŪS overwrite'inti.
const EXPLICIT_OVERRIDES = new Set([
  'Dracaena trifasciata',
  'Dracaena angolensis',
  'Dracaena masoniana',
  'Dracaena pearsonii',
  'Dracaena hyacinthoides',
  'Dracaena ballyi',
  'Pilea peperomioides',
  'Platycerium bifurcatum',
  // Plus 2017 reclassification — Sansevieria → Dracaena synonyms ALL grąžinti
  // į „Trijuostė sansevjera" etc. — apima ir senus Sansevieria entries
  'Sansevieria trifasciata',
  'Sansevieria cylindrica',
  'Sansevieria zeylanica',
  'Sansevieria masoniana',
  'Sansevieria pearsonii',
  'Sansevieria hyacinthoides',
  'Sansevieria mahanakorn',
])
//
// USAGE:
//   node --env-file=.env.local scripts/patch-lt-names.mjs --dry-run
//   node --env-file=.env.local scripts/patch-lt-names.mjs

import admin from 'firebase-admin'
import { resolveLtServer } from '../api/_lib/ltDictionary-server.js'
import { parseLatinName } from '../src/utils/latinName.js'

const DRY_RUN = process.argv.includes('--dry-run')

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

console.log(`[lt-names patch] Reading catalog... (dry-run=${DRY_RUN})`)
const snap = await db.collection('catalog').get()
console.log(`[lt-names patch] ${snap.size} catalog entries.`)

let scanned = 0
let needsFix = 0
let patched = 0
let failed = 0
const reasons = { latinVerbatim: 0, latinEpithet: 0, explicitOverride: 0, cultivarConstruct: 0 }
const samples = []
const skipped = []

for (const doc of snap.docs) {
  scanned++
  const data = doc.data()
  const latin = data.lotyniskas ?? data.latinName
  const currentLt = data.lietuviškas ?? data.lietuviskas
  if (!latin || !currentLt) continue

  let ltEntry
  try {
    ltEntry = await resolveLtServer(latin)
  } catch (e) {
    console.warn(`[lt-names patch] resolveLt failed for ${doc.id}:`, e?.message)
    continue
  }
  if (!ltEntry?.ltName) continue
  if (ltEntry.ltName === currentLt) continue

  // Heuristika — should patch? CONSERVATIVE.
  const parsed = parseLatinName(latin)
  const isLatinVerbatim = currentLt === latin
  const isLatinEpithet = parsed.species && currentLt.toLowerCase() === parsed.species.toLowerCase()
  const isExplicitOverride = EXPLICIT_OVERRIDES.has(latin)
  // Cultivar construct: latin yra cultivar IR resolveLt grąžina quoted version
  // IR current LT NEturi quotes (i.e. structural fix needed)
  const isCultivarConstruct = parsed.rank === 'cultivar' &&
    ltEntry.ltName.includes("'") &&
    !currentLt.includes("'")

  let reason = null
  if (isLatinVerbatim) reason = 'latinVerbatim'
  else if (isLatinEpithet) reason = 'latinEpithet'
  else if (isExplicitOverride) reason = 'explicitOverride'
  // 2026-06-01 — cultivarConstruct DISABLED. Drop'inta po dry-run audit'o:
  // resolveLt cultivar construction grąžina [GENUS LT] '[cultivar]' — bet
  // jei catalog'as turi BETTER SPECIES-level LT name (e.g. „Ugnikalnio
  // dobilėlis" Oxalis vulcanicola), patch'as regresuotų į „Kiškiakopūstis
  // 'Crazy Plum'" — prarastume species qualifier. Šiuo metu resolveLt
  // nesujungia [SPECIES LT NAME] + cultivar. Future enhancement task.
  // else if (isCultivarConstruct) reason = 'cultivarConstruct'

  if (!reason) {
    if (skipped.length < 10) {
      skipped.push({ id: doc.id, latin, current: currentLt, candidate: ltEntry.ltName, sources: ltEntry.sources?.join('+') })
    }
    continue
  }

  needsFix++
  reasons[reason]++

  if (samples.length < 25) {
    samples.push({ id: doc.id, latin, before: currentLt, after: ltEntry.ltName, reason })
  }

  if (DRY_RUN) continue

  try {
    await doc.ref.update({ lietuviškas: ltEntry.ltName })
    patched++
  } catch (e) {
    failed++
    console.error(`[lt-names patch] update failed for ${doc.id}:`, e?.message)
  }
}

console.log('')
console.log('=== LT NAMES PATCH DONE ===')
console.log(`Mode:                  ${DRY_RUN ? 'DRY-RUN (no writes)' : 'LIVE'}`)
console.log(`Scanned:               ${scanned}`)
console.log(`Needs fix:             ${needsFix}`)
console.log(`  by reason:`)
console.log(`    latin verbatim:    ${reasons.latinVerbatim}`)
console.log(`    latin epithet:     ${reasons.latinEpithet}`)
console.log(`    explicit override: ${reasons.explicitOverride}`)
console.log(`    cultivar construct:${reasons.cultivarConstruct}`)
if (!DRY_RUN) {
  console.log(`Patched:               ${patched}`)
  console.log(`Failed:                ${failed}`)
}
if (samples.length > 0) {
  console.log('\nSample patches:')
  for (const s of samples) {
    console.log(`  [${s.id}] ${s.latin}  (${s.reason})`)
    console.log(`    before: ${s.before}`)
    console.log(`    after:  ${s.after}`)
  }
}
if (skipped.length > 0 && DRY_RUN) {
  console.log('\nSkipped (no heuristic match — likely user-curated):')
  for (const s of skipped) {
    console.log(`  [${s.id}] ${s.latin}`)
    console.log(`    current:   ${s.current}`)
    console.log(`    candidate: ${s.candidate} (${s.sources})`)
  }
}
process.exit(0)
