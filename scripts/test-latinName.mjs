// Standalone parser test — paleidžiamas Node'u, nepriklausomas nuo Firebase.
//
// Naudojimas:
//   node scripts/test-latinName.mjs
//
// Padengia visus pattern'us, kuriuos parser'is turi atpažinti, plius
// edge case'us iš realių AI atsakymų / vartotojų užklausų. Naudojama
// prieš pradedant pasitikėti parser'iu save flow'e ir specificity gate'e.

import { parseLatinName, speciesPortion, sameSpecies, queryIsBroader } from '../src/utils/latinName.js'

const tests = [
  // ── BASIC: gentis / rūšis / kultivaras ──────────────────────────
  {
    input: 'Dionaea muscipula',
    expect: { genus: 'Dionaea', species: 'muscipula', cultivar: null, rank: 'species' },
  },
  {
    input: "Dionaea muscipula 'Akai Ryu'",
    expect: { genus: 'Dionaea', species: 'muscipula', cultivar: 'Akai Ryu', rank: 'cultivar' },
  },
  {
    // CRITICAL: AI dažnai grąžina cultivar'ą be quote'ų — turi atpažinti
    input: 'Dionaea muscipula Akai Ryu',
    expect: { genus: 'Dionaea', species: 'muscipula', cultivar: 'Akai Ryu', rank: 'cultivar' },
  },
  {
    input: 'Dionaea',
    expect: { genus: 'Dionaea', species: null, cultivar: null, rank: 'genus' },
  },

  // ── SERIES BE SPECIES (Knock Out, Boulevard, Wave) ──────────────
  {
    input: 'Rosa Knock Out',
    expect: { genus: 'Rosa', species: null, cultivar: 'Knock Out', rank: 'cultivar' },
  },
  {
    input: "Rosa 'KORnacapi'",
    expect: { genus: 'Rosa', species: null, cultivar: 'KORnacapi', rank: 'cultivar' },
  },
  {
    input: 'Clematis Boulevard',
    expect: { genus: 'Clematis', species: null, cultivar: 'Boulevard', rank: 'cultivar' },
  },
  {
    input: "Clematis 'Boulevard Olympia'",
    expect: { genus: 'Clematis', species: null, cultivar: 'Boulevard Olympia', rank: 'cultivar' },
  },
  {
    input: 'Petunia Wave',
    expect: { genus: 'Petunia', species: null, cultivar: 'Wave', rank: 'cultivar' },
  },
  {
    input: 'Hydrangea Endless Summer',
    expect: { genus: 'Hydrangea', species: null, cultivar: 'Endless Summer', rank: 'cultivar' },
  },

  // ── HYBRIDAI (× notation) ───────────────────────────────────────
  {
    input: 'Clematis × jackmanii',
    expect: { genus: 'Clematis', species: '× jackmanii', cultivar: null, rank: 'hybrid' },
  },
  {
    input: 'Heuchera ×heucherella',
    expect: { genus: 'Heuchera', species: '×heucherella', cultivar: null, rank: 'hybrid' },
  },

  // ── INFRASPECIFIC (var., subsp., ssp., f.) ──────────────────────
  {
    input: 'Acer palmatum var. dissectum',
    expect: { genus: 'Acer', species: 'palmatum', infraspecific: 'dissectum', cultivar: null, rank: 'variety' },
  },
  {
    input: 'Picea pungens ssp. engelmannii',
    expect: { genus: 'Picea', species: 'pungens', infraspecific: 'engelmannii', cultivar: null, rank: 'subspecies' },
  },
  {
    input: 'Picea pungens subsp. engelmannii',
    expect: { genus: 'Picea', species: 'pungens', infraspecific: 'engelmannii', cultivar: null, rank: 'subspecies' },
  },
  {
    input: "Hosta sieboldiana var. elegans 'Alba'",
    expect: { genus: 'Hosta', species: 'sieboldiana', infraspecific: 'elegans', cultivar: 'Alba', rank: 'cultivar' },
  },

  // ── CV. MARKER ─────────────────────────────────────────────────
  {
    input: 'Rosa cv. Knock Out',
    expect: { genus: 'Rosa', species: null, cultivar: 'Knock Out', rank: 'cultivar' },
  },

  // ── TRADEMARK / KOMERCINIAI SIMBOLIAI ──────────────────────────
  {
    input: "Rosa 'Knock Out'®",
    expect: { genus: 'Rosa', cultivar: 'Knock Out', rank: 'cultivar' },
  },
  {
    input: 'Clematis Boulevard™',
    expect: { genus: 'Clematis', cultivar: 'Boulevard', rank: 'cultivar' },
  },

  // ── UNICODE QUOTES (curly) ─────────────────────────────────────
  {
    input: "Dionaea muscipula ‘Akai Ryu’", // ‘Akai Ryu’
    expect: { genus: 'Dionaea', species: 'muscipula', cultivar: 'Akai Ryu', rank: 'cultivar' },
  },
  {
    input: 'Dionaea muscipula “Akai Ryu”', // "Akai Ryu"
    expect: { genus: 'Dionaea', species: 'muscipula', cultivar: 'Akai Ryu', rank: 'cultivar' },
  },

  // ── WHITESPACE NORMALIZATION ───────────────────────────────────
  {
    input: '  Dionaea   muscipula  ',
    expect: { genus: 'Dionaea', species: 'muscipula', rank: 'species' },
  },

  // ── EDGE: tuščia / nesąmonės ───────────────────────────────────
  {
    input: '',
    expect: { genus: null, species: null, rank: 'unknown' },
  },
  {
    input: null,
    expect: { genus: null, species: null, rank: 'unknown' },
  },
  {
    input: 'random nonsense lowercase',
    expect: { genus: null, species: null, rank: 'unknown' },
  },

  // ── KOMPLEKSAS: realybės pavyzdžiai ────────────────────────────
  {
    input: "Hosta 'Patriot'",
    expect: { genus: 'Hosta', species: null, cultivar: 'Patriot', rank: 'cultivar' },
  },
  {
    input: "Heuchera 'Palace Purple'",
    expect: { genus: 'Heuchera', species: null, cultivar: 'Palace Purple', rank: 'cultivar' },
  },
  {
    input: 'Monstera deliciosa',
    expect: { genus: 'Monstera', species: 'deliciosa', rank: 'species' },
  },
  {
    input: "Monstera deliciosa 'Variegata'",
    expect: { genus: 'Monstera', species: 'deliciosa', cultivar: 'Variegata', rank: 'cultivar' },
  },
]

// ── Test runner ─────────────────────────────────────────────────
let passed = 0, failed = 0
const failures = []

for (const t of tests) {
  const got = parseLatinName(t.input)
  let ok = true
  for (const key of Object.keys(t.expect)) {
    if (got[key] !== t.expect[key]) { ok = false; break }
  }
  if (ok) {
    passed++
  } else {
    failed++
    failures.push({ input: t.input, expected: t.expect, got })
  }
}

console.log(`\n[parseLatinName] ${passed}/${tests.length} passed, ${failed} failed\n`)

if (failures.length > 0) {
  console.log('FAILURES:')
  for (const f of failures) {
    console.log(`  input: ${JSON.stringify(f.input)}`)
    console.log(`  expected:`, f.expected)
    console.log(`  got:     `, f.got)
    console.log('')
  }
}

// ── Helper functions tests ────────────────────────────────────
const helperTests = [
  {
    name: 'speciesPortion("Dionaea muscipula \'Akai Ryu\'")',
    actual: speciesPortion(parseLatinName("Dionaea muscipula 'Akai Ryu'")),
    expect: 'Dionaea muscipula',
  },
  {
    name: 'speciesPortion("Rosa Knock Out")',
    actual: speciesPortion(parseLatinName('Rosa Knock Out')),
    expect: null,  // nėra species portion'o, tik gentis + cultivar
  },
  {
    name: 'speciesPortion("Dionaea")',
    actual: speciesPortion(parseLatinName('Dionaea')),
    expect: null,
  },
  {
    name: 'sameSpecies(Dionaea muscipula, Dionaea muscipula \'Akai Ryu\')',
    actual: sameSpecies(parseLatinName('Dionaea muscipula'), parseLatinName("Dionaea muscipula 'Akai Ryu'")),
    expect: true,
  },
  {
    name: 'sameSpecies(Dionaea muscipula, Drosera capensis)',
    actual: sameSpecies(parseLatinName('Dionaea muscipula'), parseLatinName('Drosera capensis')),
    expect: false,
  },
  {
    name: 'sameSpecies(Dionaea, Dionaea muscipula) — genus only vs species',
    actual: sameSpecies(parseLatinName('Dionaea'), parseLatinName('Dionaea muscipula')),
    expect: false,  // genus-only ne sutampa su species lygiu
  },
  {
    name: 'queryIsBroader(species, cultivar)',
    actual: queryIsBroader(parseLatinName('Dionaea muscipula'), parseLatinName("Dionaea muscipula 'Akai Ryu'")),
    expect: true,
  },
  {
    name: 'queryIsBroader(cultivar, species)',
    actual: queryIsBroader(parseLatinName("Dionaea muscipula 'Akai Ryu'"), parseLatinName('Dionaea muscipula')),
    expect: false,
  },
  {
    name: 'queryIsBroader(genus, cultivar)',
    actual: queryIsBroader(parseLatinName('Dionaea'), parseLatinName("Dionaea muscipula 'Akai Ryu'")),
    expect: true,
  },
  {
    name: 'queryIsBroader(species, species) — equal',
    actual: queryIsBroader(parseLatinName('Dionaea muscipula'), parseLatinName('Drosera capensis')),
    expect: false,  // ne broader, lygūs
  },
]

let hPassed = 0, hFailed = 0
for (const h of helperTests) {
  if (h.actual === h.expect) {
    hPassed++
  } else {
    hFailed++
    console.log(`FAIL ${h.name}`)
    console.log(`  expected: ${JSON.stringify(h.expect)}`)
    console.log(`  got:      ${JSON.stringify(h.actual)}`)
  }
}

console.log(`[helpers] ${hPassed}/${helperTests.length} passed, ${hFailed} failed`)

// ── Parent taxonGroup ID derivation tests ─────────────────────
//
// Tikrinam, kad parentTaxonGroupIdFor grąžintų teisingą deterministic ID
// kiekvienam scenarijui — species parent, genus-care fallback, ne-cultivar
// entry'iams null.
import { parentTaxonGroupIdFor } from '../src/utils/taxonGroupId.js'

const parentTests = [
  // SPECIES PARENT — cultivar su žinoma rūšimi
  {
    input: "Dionaea muscipula 'Akai Ryu'",
    expect: 'dionaea-muscipula',
  },
  {
    input: "Hosta sieboldiana 'Alba'",
    expect: 'hosta-sieboldiana',
  },
  {
    input: "Monstera deliciosa 'Variegata'",
    expect: 'monstera-deliciosa',
  },
  // GENUS-CARE PARENT — cultivar be priskirtos rūšies
  {
    input: "Hosta 'Patriot'",
    expect: 'hosta-genus',
  },
  {
    input: "Rosa Knock Out",
    expect: 'rosa-genus',
  },
  {
    input: "Clematis Boulevard",
    expect: 'clematis-genus',
  },
  {
    input: "Heuchera 'Palace Purple'",
    expect: 'heuchera-genus',
  },
  // NĖRA PARENT — entry'is yra species ar genus pats
  {
    input: 'Dionaea muscipula',
    expect: null,  // species pati — nėra parent'o
  },
  {
    input: 'Dionaea',
    expect: null,  // genus pati — nėra parent'o
  },
  // INFRASPECIFIC — variety/subspecies turi parent'ą species lygyje
  {
    input: 'Acer palmatum var. dissectum',
    expect: 'acer-palmatum',
  },
  // EDGE — neatpažintas string'as
  {
    input: 'random nonsense',
    expect: null,
  },
]

let pPassed = 0, pFailed = 0
for (const t of parentTests) {
  const got = parentTaxonGroupIdFor(t.input)
  if (got === t.expect) {
    pPassed++
  } else {
    pFailed++
    console.log(`FAIL parentTaxonGroupIdFor("${t.input}")`)
    console.log(`  expected: ${JSON.stringify(t.expect)}`)
    console.log(`  got:      ${JSON.stringify(got)}`)
  }
}
console.log(`[parentTaxonGroupIdFor] ${pPassed}/${parentTests.length} passed, ${pFailed} failed`)

// Exit kodas — naudojama CI'e jei kada įdiegsim
process.exit((failed + hFailed + pFailed) > 0 ? 1 : 0)
