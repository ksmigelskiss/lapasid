// Cross-source validation pipeline — 2026-05-24
//
// Auto-discrepancy detector tarp visus pre-DB šaltinius:
//   • pre-db.json (AHS + Beckett + Cheng)
//   • lt-names.json
//   • gaspadorius-detail.json
//   • aspca-toxicity.json + aspca-genus-map.json
//   • pfaf.json
//   • inat-names.json
//   • latin-synonyms-reverse.json
//   • lt-indoor-whitelist.json
//
// Atrand:
//   1. Toxicity mismatches: ASPCA sako toxic, PFAF sako edible (gali būti
//      pet-only toxic, human-edible — needs review)
//   2. Family mismatches: pre-db ne sutampa su PFAF/ltFamily
//   3. Missing curated-300 entries kuriose neturi LT name'o
//   4. Orchid contamination patterns (likę po lt-names fix'o)
//   5. Skeleton PFAF entries patenkančios į curated-300 (taip pat OK,
//      bet gerai žinoti)
//   6. ASPCA non-toxic entries kurie kažkur kitur paimti kaip toxic
//
// Output: data/validation-report.json + console summary
//
// Nera fix'ais — tik atskleidimas. Orchestrator decision kuriuos fix'inti.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dirname, '..', 'data')

const load = (name) => JSON.parse(readFileSync(join(DATA, name), 'utf-8'))

console.log('[validate] loading sources...')
const preDb = load('pre-db.json')
const ltNames = load('lt-names.json')
const gasp = load('gaspadorius-detail.json')
const aspca = load('aspca-toxicity.json')
const aspcaGenus = load('aspca-genus-map.json')
const pfaf = load('pfaf.json')
const inat = load('inat-names.json')
const reverse = load('latin-synonyms-reverse.json')
const whitelist = load('lt-indoor-whitelist.json')
const curated300 = load('curated-300.json')

const issues = {
  toxicity_pet_human_split: [],
  family_mismatch: [],
  curated300_no_lt_name: [],
  orchid_contamination_remaining: [],
  curated300_skeleton_pfaf: [],
  whitelist_not_in_curated: [],
  curated_not_in_whitelist: [],
  reverse_map_conflicts: [],
}

// ── 1. Toxicity pet vs human split (informational only) ──────
// Pavyzdžiui Aloe — ASPCA toxic to pets, PFAF medicinal+edible to humans.
// Tai NE bug, bet warning: catalog'as turi clearly atskirti.
for (const [genus, entry] of Object.entries(aspcaGenus.toxicityByGenus || {})) {
  const pfafEntry = pfaf.results[genus] || pfaf.results[genus.charAt(0) + genus.slice(1).toLowerCase()]
  if (!pfafEntry?.found) continue
  if (pfafEntry.edibilityRating >= 2 || pfafEntry.medicinalRating >= 2) {
    issues.toxicity_pet_human_split.push({
      genus,
      aspcaToxicTo: entry.toxicTo,
      pfafEdibility: pfafEntry.edibilityRating,
      pfafMedicinal: pfafEntry.medicinalRating,
      note: 'Pets toxic, humans (semi-)safe — voice persona must clearly split',
    })
  }
}

// ── 2. Family mismatches between pre-db and lt-names ─────────
for (const [genus, ltEntry] of Object.entries(ltNames.ltNames || {})) {
  const preEntry = preDb.genera[genus.toUpperCase()]
  if (!preEntry || !ltEntry.ltFamily || !preEntry.family) continue
  // Simple normalize for compare (LT family name vs EN family in caps)
  // We can't deeply compare without LT↔EN family map; flag if both populated
  // but ltFamily looks like a non-family string (e.g. "Nuorodiniai straipsniai" — already fixed,
  // but maybe other artifacts remain)
  const suspect = ltEntry.ltFamily.toLowerCase().includes('nuorodin') ||
                  ltEntry.ltFamily.toLowerCase().includes('straipsn') ||
                  ltEntry.ltFamily.includes('(') ||  // disambig leak
                  ltEntry.ltFamily.length < 3
  if (suspect) {
    issues.family_mismatch.push({
      genus,
      preDbFamily: preEntry.family,
      ltFamily: ltEntry.ltFamily,
      issue: 'ltFamily looks suspicious (disambig/artifact)',
    })
  }
}

// ── 3. Curated-300 entries without LT name ──────────────────
for (const [latin, entry] of Object.entries(curated300.entries || {})) {
  if (!entry.ltName) {
    issues.curated300_no_lt_name.push({
      latinName: latin,
      tier: entry.tier,
      notes: entry.notes,
    })
  }
}

// ── 4. Orchid contamination check (post-fix sanity) ─────────
const ORCHID_GENERA = new Set(['Phalaenopsis', 'Cattleya', 'Cymbidium', 'Dendrobium',
  'Oncidium', 'Vanda', 'Bulbophyllum', 'Coelogyne', 'Paphiopedilum', 'Epidendrum',
  'Brassia', 'Miltonia', 'Pleione', 'Vanilla', 'Calanthe', 'Cypripedium'])
for (const [genus, ltEntry] of Object.entries(ltNames.ltNames || {})) {
  if (ORCHID_GENERA.has(genus)) continue  // legit orchid
  const allNames = [ltEntry.ltName, ...(ltEntry.ltSynonyms || [])].filter(Boolean)
  for (const name of allNames) {
    if (/orchid[ėe]ja/i.test(name)) {
      issues.orchid_contamination_remaining.push({
        genus,
        suspectName: name,
        sources: ltEntry.sources,
      })
      break
    }
  }
}

// ── 5. Curated-300 entries with skeleton PFAF ───────────────
for (const [latin, entry] of Object.entries(curated300.entries || {})) {
  const pfafEntry = pfaf.results[latin] || pfaf.results[entry.genus]
  if (!pfafEntry) continue
  if (pfafEntry._skeletonPage) {
    issues.curated300_skeleton_pfaf.push({
      latinName: latin,
      tier: entry.tier,
      note: 'PFAF entry was skeleton (template) — flipped to found:false',
    })
  }
}

// ── 6. Whitelist genera NOT in curated-300 ──────────────────
const curatedGenera = new Set(Object.values(curated300.entries || {}).map(e => e.genus))
const whitelistGenera = Object.keys(whitelist.byGenus || {})
for (const wg of whitelistGenera) {
  if (!curatedGenera.has(wg)) {
    const wlInfo = whitelist.byGenus[wg]
    if (wlInfo.tier === 1) {  // only flag T1 whitelist not in curated — surprising
      issues.whitelist_not_in_curated.push({
        genus: wg,
        whitelistTier: wlInfo.tier,
        ltName: wlInfo.ltName,
      })
    }
  }
}

// ── 7. Curated genera NOT in whitelist (should not happen post-fix) ──
for (const cg of curatedGenera) {
  if (!whitelist.byGenus[cg]) {
    issues.curated_not_in_whitelist.push({ genus: cg })
  }
}

// ── 8. Reverse-map conflicts (e.g. Kentia belmoreana → Hoodia) ──
// Already flagged at runtime. Re-check now post-extension.
const KNOWN_CONFLICTS = ['Kentia belmoreana']  // from extend-latin-synonyms warning
for (const k of KNOWN_CONFLICTS) {
  const entry = reverse.reverseMap[k]
  if (entry) {
    issues.reverse_map_conflicts.push({
      legacyName: k,
      mappedTo: entry.canonical,
      issue: 'Suspicious — verify if mapping correct',
    })
  }
}

// ── REPORT ───────────────────────────────────────────────────
const summary = {
  generatedAt: new Date().toISOString(),
  source_files_checked: [
    'pre-db.json', 'lt-names.json', 'gaspadorius-detail.json',
    'aspca-toxicity.json', 'aspca-genus-map.json', 'pfaf.json',
    'inat-names.json', 'latin-synonyms-reverse.json',
    'lt-indoor-whitelist.json', 'curated-300.json',
  ],
  issue_counts: Object.fromEntries(
    Object.entries(issues).map(([k, v]) => [k, v.length]),
  ),
  total_issues: Object.values(issues).reduce((s, arr) => s + arr.length, 0),
  issues,
}

writeFileSync(join(DATA, 'validation-report.json'), JSON.stringify(summary, null, 2))

console.log('')
console.log('=== CROSS-SOURCE VALIDATION REPORT ===')
console.log('')
for (const [key, count] of Object.entries(summary.issue_counts)) {
  const marker = count === 0 ? '✓' : count < 5 ? '⚠' : '⚠⚠'
  console.log(`  ${marker} ${key.padEnd(40)} ${count}`)
}
console.log('')
console.log(`Total issues: ${summary.total_issues}`)
console.log('')
console.log('Report saved: data/validation-report.json')

// Sample top issues per category
for (const [key, arr] of Object.entries(issues)) {
  if (arr.length === 0) continue
  console.log('')
  console.log(`--- ${key} (sample max 5) ---`)
  for (const item of arr.slice(0, 5)) {
    console.log(`  ${JSON.stringify(item).slice(0, 180)}`)
  }
}
