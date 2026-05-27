// One-shot migration — fix EN animal names baked into catalog toxicity strings.
//
// PROBLEM: api/_lib/dataLoader-server.js DATA_URLS map TRŪKO
// `aspca-animals-lt.json` registracijos. loadAnimalTerms() catch'as paslėpė
// ENOENT silent'iškai → translateAnimalTargets veikė kaip no-op → batch'as
// saugojo „Toksiška cats, dogs, horses" string'us, vietoj „katėms, šunims,
// žirgams".
//
// Affected fields:
//   • catalog/{id}.savybes.pavojingumas.detales
//   • catalog/{id}.savybes.pavojai[].detales (if had ASPCA targets)
//
// FIX: deterministic word replacement (EN animal noun → LT). Saugu, nes
// admin'as dar nieko nerasė šitose pavojingumas eilutėse — visi yra batch'o
// outputas. Replacement'ai naudoja word boundary, kad neužkliudytume kažko
// tipo „catshire" (žodžio dalies).
//
// USAGE:
//   node --env-file=.env.local scripts/migrate-toxicity-animals-lt.mjs
//   node --env-file=.env.local scripts/migrate-toxicity-animals-lt.mjs --dry-run

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import admin from 'firebase-admin'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ANIMALS_PATH = join(__dirname, '..', 'data', 'aspca-animals-lt.json')
const DRY_RUN = process.argv.includes('--dry-run')

// Load terms
const terms = JSON.parse(readFileSync(ANIMALS_PATH, 'utf-8')).terms ?? {}
console.log('[migrate] Terms loaded:', Object.keys(terms).join(', '))

// Build regex replacement pattern per EN word.
// Word boundary protects against partial matches (e.g. „catalog" wouldn't
// match „cats"). Case-insensitive — kai kurie batch outputai gali turėti
// „Cats" capital.
const replacements = Object.entries(terms).map(([en, lt]) => ({
  pattern: new RegExp(`\\b${en}\\b`, 'gi'),
  replacement: lt,
}))

function translateAnimalsInString(s) {
  if (!s || typeof s !== 'string') return { changed: false, value: s }
  let next = s
  let changed = false
  for (const { pattern, replacement } of replacements) {
    if (pattern.test(next)) {
      next = next.replace(pattern, replacement)
      changed = true
    }
  }
  return { changed, value: next }
}

// Init Firebase Admin SDK
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

// Process all catalog entries
console.log(`[migrate] Reading catalog... (dry-run=${DRY_RUN})`)
const snap = await db.collection('catalog').get()
console.log(`[migrate] ${snap.size} entries found.`)

let touched = 0
let totalReplacements = 0
const samples = []

for (const doc of snap.docs) {
  const data = doc.data()
  const savybes = data.savybes ?? {}
  const updates = {}
  let docChanged = false

  // 1. pavojingumas.detales
  if (savybes.pavojingumas?.detales) {
    const { changed, value } = translateAnimalsInString(savybes.pavojingumas.detales)
    if (changed) {
      updates['savybes.pavojingumas.detales'] = value
      docChanged = true
      totalReplacements++
      if (samples.length < 5) {
        samples.push({
          id: doc.id,
          field: 'pavojingumas.detales',
          before: savybes.pavojingumas.detales.slice(0, 100),
          after: value.slice(0, 100),
        })
      }
    }
  }

  // 2. pavojai[].detales
  if (Array.isArray(savybes.pavojai)) {
    const newPavojai = savybes.pavojai.map(p => {
      if (!p?.detales) return p
      const { changed, value } = translateAnimalsInString(p.detales)
      if (changed) {
        totalReplacements++
        return { ...p, detales: value }
      }
      return p
    })
    // Only update if some entry changed
    const anyChanged = newPavojai.some((p, i) => p !== savybes.pavojai[i])
    if (anyChanged) {
      updates['savybes.pavojai'] = newPavojai
      docChanged = true
    }
  }

  if (docChanged) {
    touched++
    if (!DRY_RUN) {
      await db.collection('catalog').doc(doc.id).update(updates)
    }
  }
}

console.log('')
console.log('=== MIGRATION DONE ===')
console.log(`Documents touched:       ${touched} / ${snap.size}`)
console.log(`Total string replaces:   ${totalReplacements}`)
console.log(`Mode:                    ${DRY_RUN ? 'DRY-RUN (no writes)' : 'LIVE'}`)
if (samples.length > 0) {
  console.log('')
  console.log('Sample replacements:')
  for (const s of samples) {
    console.log(`  [${s.id}] ${s.field}:`)
    console.log(`    BEFORE: ${s.before}...`)
    console.log(`    AFTER:  ${s.after}...`)
  }
}
process.exit(0)
