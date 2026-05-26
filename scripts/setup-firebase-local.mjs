// Helper: Firebase service account JSON → .env.local FIREBASE_SERVICE_ACCOUNT
//
// USAGE:
//   node scripts/setup-firebase-local.mjs
//
// Tas:
//   1. Suranda Firebase service account JSON ~/Downloads/ folder'yje
//   2. Minify'ina JSON į single-line string
//   3. Update'ina .env.local FIREBASE_SERVICE_ACCOUNT eilutę
//   4. Patikrina, ar parse'iasi
//
// SAUGUMAS: NE commit'inami .env.local. Po batch'o gali ištrinti su:
//   rm ~/lapasid/.env.local

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const downloadsDir = join(homedir(), 'Downloads')
const envPath = join(homedir(), 'lapasid', '.env.local')

// Step 1: Find downloaded JSON
console.log('[setup-firebase] Ieškau Firebase service account JSON ~/Downloads/...')
let files
try {
  files = readdirSync(downloadsDir)
    .filter(f => f.endsWith('.json') && /firebase-adminsdk|geliu-db/i.test(f))
    .sort((a, b) => b.localeCompare(a)) // newest first lexically
} catch (e) {
  console.error('❌ Negaliu skaityti ~/Downloads:', e.message)
  process.exit(1)
}

if (files.length === 0) {
  console.error('❌ Nerasta Firebase service account JSON ~/Downloads/ folder\'yje')
  console.error('   Tikėjausi failo su pavadinimu: geliu-db-firebase-adminsdk-XXXXX-XXXXXXXXXX.json')
  console.error('')
  console.error('   Patikrink:')
  console.error('     ls ~/Downloads/*.json')
  console.error('')
  console.error('   Jei failas yra kitur, perkelk į ~/Downloads/ ir paleisk script\'ą iš naujo.')
  process.exit(1)
}

const jsonFile = files[0]
console.log(`✓ Rastas: ${jsonFile}`)
if (files.length > 1) {
  console.log(`  (Yra ${files.length} JSON failai — naudoju naujausią pagal pavadinimą)`)
}

// Step 2: Read + parse + minify
console.log('[setup-firebase] Skaitau JSON + minify...')
const jsonPath = join(downloadsDir, jsonFile)
let serviceAccount
try {
  serviceAccount = JSON.parse(readFileSync(jsonPath, 'utf-8'))
} catch (e) {
  console.error('❌ Negaliu parse\'inti JSON:', e.message)
  process.exit(1)
}

// Sanity check — required fields
const required = ['type', 'project_id', 'private_key', 'client_email']
const missing = required.filter(k => !serviceAccount[k])
if (missing.length > 0) {
  console.error('❌ JSON neturi būtinų laukų:', missing)
  process.exit(1)
}
console.log(`✓ JSON OK — project_id: ${serviceAccount.project_id}`)
console.log(`           client_email: ${serviceAccount.client_email}`)

// Minify to single line
const jsonOneLine = JSON.stringify(serviceAccount)

// Step 3: Update .env.local
console.log('[setup-firebase] Update\'inu .env.local...')
let env
try {
  env = readFileSync(envPath, 'utf-8')
} catch (e) {
  console.error('❌ Negaliu skaityti .env.local. Ar tu paleisai `vercel env pull --environment=production .env.local`?')
  process.exit(1)
}

const newLine = `FIREBASE_SERVICE_ACCOUNT=${jsonOneLine}`
if (/^FIREBASE_SERVICE_ACCOUNT=/m.test(env)) {
  // Replace existing line
  env = env.replace(/^FIREBASE_SERVICE_ACCOUNT=.*/m, newLine)
  console.log('✓ Pakeičiau existing FIREBASE_SERVICE_ACCOUNT eilutę')
} else {
  // Append new line
  env = env.trimEnd() + '\n' + newLine + '\n'
  console.log('✓ Pridėjau FIREBASE_SERVICE_ACCOUNT eilutę (anksčiau jos nebuvo)')
}
writeFileSync(envPath, env)

// Step 4: Verify by re-parsing
console.log('[setup-firebase] Verifikuoju...')
const envFresh = readFileSync(envPath, 'utf-8')
const match = envFresh.match(/^FIREBASE_SERVICE_ACCOUNT=(.+)$/m)
if (!match) {
  console.error('❌ Verification failed — eilutės nerasta po write\'o')
  process.exit(1)
}
try {
  const parsed = JSON.parse(match[1])
  if (parsed.project_id !== serviceAccount.project_id) throw new Error('project_id mismatch')
  console.log('✓ Verifikacija sėkminga — JSON parsuojasi OK iš .env.local')
} catch (e) {
  console.error('❌ Parse error po write\'o:', e.message)
  process.exit(1)
}

console.log('')
console.log('═══════════════════════════════════════════════════════════')
console.log('✅ Firebase service account įkrautas į .env.local')
console.log('═══════════════════════════════════════════════════════════')
console.log('')
console.log('SEKANTIS ŽINGSNIS:')
console.log('  node --env-file=.env.local scripts/batch-enrich-catalog.mjs --tier=1 --limit=2')
console.log('')
console.log('PO BATCH\'O — saugumas:')
console.log('  rm .env.local                  # ištrina local credentials')
console.log('  arba Firebase Console → revoke šitą service account key')
