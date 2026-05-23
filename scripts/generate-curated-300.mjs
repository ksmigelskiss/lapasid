#!/usr/bin/env node
/**
 * Generate curated-300.json — 300 populiariausių LT kambarinių augalų
 * 3 tier'ai: 50 / 100 / 150 (TRIPLE GOLD / STRONG / NICHE)
 *
 * PRIMARY FILTER (NEW): lt-indoor-whitelist.json — 357 explicit manual indoor genera.
 *   Vietoj senesnio "beckett OR cheng" prielaidos (kuri turi ~30% outdoor noise),
 *   whitelist'as yra rankomis kuruotas EXPLICIT LT-kontekste kambarinis sąrašas.
 *
 * Šaltiniai (visi data/ direktorijoj):
 *   - lt-indoor-whitelist.json — PRIMARY FILTER, 357 explicit indoor genera (T1=195, T2=154, T3=8)
 *   - pre-db.json         — 1655 genera (AHS + Beckett + Cheng), naudojamas evidence enrichment'ui
 *   - lt-names.json       — 908 LT vardai su confidence (high/mid/low)
 *   - gaspadorius-detail.json — 217 LT rinkos pavadinimai (filter: tik geles-A-K, geles-L-Z catalogs)
 *   - aspca-genus-map.json — 60 truly toxic genera (po šiandienos ASPCA fix'o)
 *   - pfaf.json           — 9895 edibility/medicinal entries
 *   - inat-names.json     — iNat preferredLtName fallback (387 entries with LT)
 *
 * Tier kriterijai (whitelist tier'as = strong hint; score'inimas + force'as gali pakelti/nuleisti):
 *   TIER 1 (50): whitelist tier1_high AND gaspadorius AND lt-high (po score'inimo)
 *   TIER 2 (100): whitelist tier1_high OR tier2_medium, exclude tier 1
 *   TIER 3 (150): whitelist any tier, exclude tier 1/2
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DATA_DIR = join(homedir(), 'lapasid/data');
const OUT_PATH = join(DATA_DIR, 'curated-300.json');

// ---------- OUTDOOR BLACKLIST (genus-level, UPPERCASE) — SAFETY NET ----------
// Po whitelist primary filter'io, šis sąrašas vaidina safety-net rolę:
// jeigu whitelist'as klaidingai įtraukė genus'ą, kuris LT klimate yra outdoor — vis tiek išmesim.
// Whitelist'e tų genus'ų neturėtų būti, bet paliekame defense in depth.
const OUTDOOR_BLACKLIST = new Set([
  'ASCLEPIAS',      // butterfly weed, outdoor
  'DIMORPHOTHECA',  // cape marigold, sezoninis outdoor
  'HEBE',           // outdoor shrub LT klimate
  'HELICONIA',      // tropical outdoor (Lithuanian indoor garantuotai ne)
  'MICHELIA',       // outdoor tree
  'PISTIA',         // aquatic plant (lakes/ponds)
  'DROSERA',        // carnivorous, niche bog plant
  'ALLIUM',         // svogūninis daržovis
  'CUCURBITA',      // moliūgai
  'LACTUCA',        // salotos
  'LAVANDULA',      // outdoor lavender LT
  'ROSMARINUS',     // outdoor herb LT
  'OLEA',           // olive tree
]);

// ---------- FORCE TIER 1 (genus-level, UPPERCASE) ----------
// Šie genus'ai turi būti TIER 1 neatsižvelgiant į automatinį scoring — populiariausi LT kambariniai.
const FORCE_TIER1 = new Set([
  'ECHEVERIA',     // populiariausias sukulentas LT
  'PHALAENOPSIS',  // TOP3 gėlių pristatymo shop'uose
  'ZAMIOCULCAS',   // ZZ Plant, mainstream LT TOP10
]);

// ---------- GRAY-ZONE FLAGS (notes annotation) ----------
// Genus'ai, kurie kambariniame kontekste — galimi, bet LT mainstream'e ne pirmaeiliai.
const GRAY_ZONE_NOTES = {
  'SOLANUM': 'gray-zone: gaspadorius geles-A-K kataloge (S. pseudocapsicum = kambarinis pomidoras), bet genus apima ir darzoves',
  'CITRUS':  'gray-zone: kambarinis hobby (citrinmedis vazone), LT klimate atviro grunto ne',
};

// ---------- LOAD SOURCES ----------
console.log('Loading 7 source datasets...');
const whitelist = JSON.parse(readFileSync(join(DATA_DIR,'lt-indoor-whitelist.json'), 'utf8'));
const preDb = JSON.parse(readFileSync(join(DATA_DIR,'pre-db.json'), 'utf8'));
const ltNamesData = JSON.parse(readFileSync(join(DATA_DIR,'lt-names.json'), 'utf8'));
const gaspData = JSON.parse(readFileSync(join(DATA_DIR,'gaspadorius-detail.json'), 'utf8'));
const aspcaData = JSON.parse(readFileSync(join(DATA_DIR,'aspca-genus-map.json'), 'utf8'));
const pfafData = JSON.parse(readFileSync(join(DATA_DIR,'pfaf.json'), 'utf8'));
const inatData = JSON.parse(readFileSync(join(DATA_DIR,'inat-names.json'), 'utf8'));

const whitelistByGenus = whitelist.byGenus || {};   // key = "Sansevieria" (CamelCase)
const genera = preDb.genera;
const ltNames = ltNamesData.ltNames;   // key = "Sansevieria" (CamelCase)
const gaspPairs = gaspData.pairs || []; // array of {latinGenus, latinSpecies, ltName, ...}
const aspcaTox = aspcaData.toxicityByGenus; // key = GENUS (uppercase)
const pfafResults = pfafData.results;       // key = "Sansevieria" or "Sansevieria trifasciata"
const inatResults = inatData.results;       // key = "Sansevieria" (CamelCase)

console.log(`  whitelist genera: ${Object.keys(whitelistByGenus).length} (PRIMARY FILTER)`);
console.log(`  pre-db genera: ${Object.keys(genera).length}`);
console.log(`  lt-names entries: ${Object.keys(ltNames).length}`);
console.log(`  gaspadorius pairs: ${gaspPairs.length}`);
console.log(`  aspca toxic genera: ${Object.keys(aspcaTox).length}`);
console.log(`  pfaf entries: ${Object.keys(pfafResults).length}`);
console.log(`  inat entries: ${Object.keys(inatResults).length}`);

// ---------- HELPERS ----------
const toCamel = (genus) => genus.charAt(0).toUpperCase() + genus.slice(1).toLowerCase();
const toUpper = (genus) => genus.toUpperCase();

// Build gaspadorius index: latinGenus (upper) → list of {species, ltName, ltSynonyms}
// Filter: only include "kambarinės gėlės" catalogs — drop garden vegetables (darzoves) and medicinal (vaistiniai).
const KAMBARINES_CATALOGS = new Set(['geles-A-K', 'geles-L-Z']);
const gaspByGenus = {};
for (const pair of gaspPairs) {
  if (!pair.latinGenus) continue;
  if (!KAMBARINES_CATALOGS.has(pair.catalog)) continue;
  const g = pair.latinGenus.toUpperCase();
  if (!gaspByGenus[g]) gaspByGenus[g] = [];
  gaspByGenus[g].push({
    species: pair.latinSpecies || null,
    ltName: pair.ltName,
    ltSynonyms: pair.ltSynonyms || [],
    latin: pair.latin,
  });
}

// Normalize lt-names confidence ('mid' vs 'medium') — both treated the same; output as 'medium'
const normalizeConfidence = (c) => {
  if (!c) return null;
  if (c === 'mid' || c === 'medium') return 'medium';
  return c;
};

// ---------- COMPUTE EVIDENCE PER GENUS ----------
// PRIMARY FILTER: whitelist.byGenus — explicit LT indoor list (357 genera).
// OUTDOOR_BLACKLIST veikia kaip safety net (po whitelist'o).
// Pre-db naudojamas tik evidence enrichment'ui (family, species, beckett/cheng signals).
const whitelistGenusKeys = Object.keys(whitelistByGenus); // CamelCase keys
const whitelistGeneraUpper = whitelistGenusKeys.map(g => g.toUpperCase());

const blacklistedHits = whitelistGeneraUpper.filter(g => OUTDOOR_BLACKLIST.has(g));
const indoorGenera = whitelistGeneraUpper.filter(g => !OUTDOOR_BLACKLIST.has(g));
const missingFromPreDb = indoorGenera.filter(g => !genera[g]);

console.log(`\nWhitelist primary filter: ${whitelistGeneraUpper.length} genera`);
console.log(`  Safety-net outdoor blacklist removed: ${blacklistedHits.length}${blacklistedHits.length ? ' (' + blacklistedHits.join(', ') + ')' : ''}`);
console.log(`  Missing pre-db evidence: ${missingFromPreDb.length}${missingFromPreDb.length ? ' (' + missingFromPreDb.slice(0,5).join(', ') + (missingFromPreDb.length > 5 ? ', ...' : '') + ')' : ''}`);
console.log(`Processing ${indoorGenera.length} genera...`);

// NOTE: variable name `beckettGenera` kept for legacy callers below (relax pass, control check).
// Semantically dabar — visi whitelist'e leidžiami genus'ai (post safety-net).
const beckettGenera = indoorGenera;

const genusEvidence = {};
for (const G of indoorGenera) {
  const data = genera[G]; // gali būti undefined (15 whitelist genera nėra pre-db)
  const camel = toCamel(G);
  const upper = G; // already uppercase

  const ltEntry = ltNames[camel];
  const gaspEntries = gaspByGenus[upper] || [];
  const aspcaEntry = aspcaTox[upper];
  const inatEntry = inatResults[camel];
  const whitelistEntry = whitelistByGenus[camel] || whitelistByGenus[Object.keys(whitelistByGenus).find(k => k.toUpperCase() === upper)];

  // pfaf check: try genus-level first (Sansevieria)
  const pfafGenusFound = !!pfafResults[camel];

  const ltConfidence = normalizeConfidence(ltEntry?.confidence);
  const ltSources = ltEntry?.sources || [];

  genusEvidence[G] = {
    beckett: data ? (data.inSources || []).includes('beckett') : !!whitelistEntry?.beckett,
    cheng: data ? (data.inSources || []).includes('cheng') : !!whitelistEntry?.cheng,
    gaspadorius: gaspEntries.length > 0,
    gaspEntries,
    ltEntry: ltEntry || null,
    ltConfidence,
    ltSources,
    aspcaToxic: aspcaEntry?.toxicTo || [],
    pfafFound: pfafGenusFound,
    inatPreferredLt: inatEntry?.preferredLtName || null,
    family: data?.family || null,
    species: data?.species || {},
    inSources: data?.inSources || [],
    // Whitelist-specific evidence
    whitelistTier: whitelistEntry?.tier || null,
    whitelistLtName: whitelistEntry?.ltName || null,
    whitelistLtConfidence: normalizeConfidence(whitelistEntry?.ltConfidence),
    indoorConfidence: whitelistEntry?.indoor_confidence || null,
    whitelistNotes: whitelistEntry?.notes || '',
  };
}

// ---------- CLASSIFY INTO TIERS ----------
// Whitelist tier'as = primary hint, bet leidžiama promote'inti pagal LT market evidence (gasp + lt-high).
//
// TIER 1 candidate: (whitelistTier === 1) AND (gaspadorius OR ltConfidence === 'high' OR cheng signal)
// TIER 2 candidate: whitelist tier 1 OR 2 (those not in T1)
// TIER 3 candidate: any whitelist tier (rest)

const tier1Genera = [];
const tier2Genera = [];
const tier3Genera = [];

for (const G of beckettGenera) {
  const ev = genusEvidence[G];
  const isHigh = ev.ltConfidence === 'high' || ev.whitelistLtConfidence === 'high';
  const hasGasp = ev.gaspadorius;
  const wtier = ev.whitelistTier;

  // T1 candidate: whitelist T1 AND (LT market evidence OR high LT confidence)
  if (wtier === 1 && (hasGasp || isHigh)) {
    tier1Genera.push(G);
  } else if (wtier === 1 || wtier === 2) {
    tier2Genera.push(G);
  } else {
    // wtier 3 arba null (cheng-only / no whitelist entry — shouldn't happen)
    tier3Genera.push(G);
  }
}

// ---------- FORCE TIER 1 PROMOTION ----------
// FORCE_TIER1 genera turi būti tier1 net jei automatika juos klasifikavo kitur.
// 1) Jeigu jie nėra tier1 — patraukiame iš dabartinio tier'o ir įdedame į tier1 priekį.
// 2) Jeigu jų visai nėra beckettGenera (pvz. cheng-only), jie vis tiek bus tier1 — pridedame iš pre-db.
const forcePromoted = [];
for (const G of FORCE_TIER1) {
  // Jau tier1? — palikti.
  if (tier1Genera.includes(G)) continue;

  // Pašaliname iš kitų tier'ų jei yra
  const i2 = tier2Genera.indexOf(G);
  if (i2 !== -1) tier2Genera.splice(i2, 1);
  const i3 = tier3Genera.indexOf(G);
  if (i3 !== -1) tier3Genera.splice(i3, 1);

  // Jeigu G nėra apskritai beckettGenera (cheng-only / nepateko evidence) — vis tiek pridedame, jei pre-db turi.
  if (!genusEvidence[G] && genera[G]) {
    const data = genera[G];
    const camel = toCamel(G);
    const ltEntry = ltNames[camel];
    const gaspEntries = gaspByGenus[G] || [];
    const aspcaEntry = aspcaTox[G];
    const inatEntry = inatResults[camel];
    genusEvidence[G] = {
      beckett: (data.inSources || []).includes('beckett'),
      cheng: (data.inSources || []).includes('cheng'),
      gaspadorius: gaspEntries.length > 0,
      gaspEntries,
      ltEntry: ltEntry || null,
      ltConfidence: normalizeConfidence(ltEntry?.confidence),
      ltSources: ltEntry?.sources || [],
      aspcaToxic: aspcaEntry?.toxicTo || [],
      pfafFound: !!pfafResults[camel],
      inatPreferredLt: inatEntry?.preferredLtName || null,
      family: data.family || null,
      species: data.species || {},
      inSources: data.inSources || [],
    };
  }

  if (genusEvidence[G]) {
    tier1Genera.unshift(G); // įdedame į priekį
    forcePromoted.push(G);
  } else {
    console.warn(`  [force-tier1] ${G} skipped — no pre-db evidence`);
  }
}
if (forcePromoted.length) {
  console.log(`\nForce-promoted to Tier 1: ${forcePromoted.join(', ')}`);
}

// ---------- SCORING / RANKING ----------
// Score = signal count (more sources = higher priority)
const scoreGenus = (G) => {
  const ev = genusEvidence[G];
  let score = 0;
  // Whitelist tier bonus — STRONGEST signal (manual curation)
  if (ev.whitelistTier === 1) score += 5;
  else if (ev.whitelistTier === 2) score += 2;
  else if (ev.whitelistTier === 3) score += 1;
  // Indoor source signals (legacy books)
  if (ev.cheng) score += 2;
  if (ev.beckett) score += 1;
  if (ev.gaspadorius) score += 3;        // STRONG LT market signal
  if (ev.ltConfidence === 'high') score += 4;   // bumped (lt-high = 3+ LT source consensus)
  else if (ev.ltConfidence === 'medium') score += 2;
  else if (ev.ltConfidence === 'low') score += 0.5;
  // Whitelist LT confidence (jei lt-names.json neturi entry — naudojam whitelist'o oną)
  if (!ev.ltConfidence && ev.whitelistLtConfidence === 'high') score += 2;
  else if (!ev.ltConfidence && ev.whitelistLtConfidence === 'medium') score += 1;
  score += (ev.ltSources?.length || 0) * 0.3;
  if (ev.inatPreferredLt) score += 0.5;
  if (ev.pfafFound) score += 0.2;
  // indoor_confidence boost
  if (ev.indoorConfidence === 'verified') score += 1;
  return score;
};

const sortByScore = (arr) => arr.sort((a, b) => scoreGenus(b) - scoreGenus(a));
sortByScore(tier1Genera);
sortByScore(tier2Genera);
sortByScore(tier3Genera);

console.log(`\nAfter classification:`);
console.log(`  Tier 1 candidates: ${tier1Genera.length} (target 50)`);
console.log(`  Tier 2 candidates: ${tier2Genera.length} (target 100)`);
console.log(`  Tier 3 candidates: ${tier3Genera.length} (target 150)`);

// ---------- CAP COUNTS WITH OVERFLOW HANDLING ----------
const TARGET_T1 = 50;
const TARGET_T2 = 100;
const TARGET_T3 = 150;

let t1 = tier1Genera.slice(0, TARGET_T1);
let t2 = tier2Genera.slice(0, TARGET_T2);
let t3 = tier3Genera.slice(0, TARGET_T3);

// FORCE_TIER1 guarantee: jeigu force-promoted G yra tier1Genera, bet nepateko į t1 slice'ą,
// demote'iname žemiausio score'o t1 entry'į ir įdedame force G.
for (const G of FORCE_TIER1) {
  if (!tier1Genera.includes(G)) continue; // šis G nebuvo galų gale promoted (no pre-db evidence)
  if (t1.includes(G)) continue; // jau įtrauktas
  // Demote'inti žemiausio score'o NE-force entry'į iš t1
  let demoteIdx = -1;
  for (let i = t1.length - 1; i >= 0; i--) {
    if (!FORCE_TIER1.has(t1[i])) {
      demoteIdx = i;
      break;
    }
  }
  if (demoteIdx === -1) continue;
  const demoted = t1.splice(demoteIdx, 1)[0];
  t1.push(G);
  // Demote'intą įmetam į tier2 priekį, kad neprapultų
  if (!tier2Genera.includes(demoted)) tier2Genera.unshift(demoted);
  console.log(`  [force-tier1] ${G} įdėtas į T1, ${demoted} demote'intas į T2 priekį`);
}
// Re-sync t2 po galimo demote'inimo
t2 = tier2Genera.filter(g => !t1.includes(g)).slice(0, TARGET_T2);
t3 = tier3Genera.filter(g => !t1.includes(g) && !t2.includes(g)).slice(0, TARGET_T3);

// If tier1 short, promote tier2 candidates to tier1 (best-scored)
if (t1.length < TARGET_T1) {
  const need = TARGET_T1 - t1.length;
  const promoted = tier2Genera.slice(0, need);
  t1 = [...t1, ...promoted];
  // remove promoted from tier2 source
  const promotedSet = new Set(promoted);
  const remainingT2 = tier2Genera.filter(g => !promotedSet.has(g));
  t2 = remainingT2.slice(0, TARGET_T2);
}

// If tier2 short, promote tier3 candidates
if (t2.length < TARGET_T2) {
  const need = TARGET_T2 - t2.length;
  const promoted = tier3Genera.slice(0, need);
  t2 = [...t2, ...promoted];
  const promotedSet = new Set(promoted);
  const remainingT3 = tier3Genera.filter(g => !promotedSet.has(g));
  t3 = remainingT3.slice(0, TARGET_T3);
}

// If tier3 short, relax: use ANY beckett genus not yet picked
if (t3.length < TARGET_T3) {
  const need = TARGET_T3 - t3.length;
  const used = new Set([...t1, ...t2, ...t3]);
  const fallback = beckettGenera
    .filter(g => !used.has(g))
    .sort((a, b) => scoreGenus(b) - scoreGenus(a))
    .slice(0, need);
  t3 = [...t3, ...fallback];
}

console.log(`\nAfter capping:`);
console.log(`  Tier 1 final: ${t1.length}`);
console.log(`  Tier 2 final: ${t2.length}`);
console.log(`  Tier 3 final: ${t3.length}`);

// ---------- SPECIES SELECTION PER GENUS ----------
/**
 * Pick best species entry/entries for a genus.
 * Hierarchy:
 *   1. Gaspadorius species (LT market) — preferred
 *   2. lt-names species (rare; lt-names is mostly genus-level)
 *   3. Genus-only (latinName = "Sansevieria", speciesEpithet = null)
 *
 * Max 2-3 species per genus (typically 1).
 */
// Manual species overrides: kai gaspadorius species ne kambarinis (rare bug), force'iname kitą.
// OXALIS adenophylla = outdoor rock garden; tikras kambarinis = triangularis (Purple Shamrock).
const SPECIES_OVERRIDES = {
  'OXALIS': {
    species: 'triangularis',
    ltName: 'Burokėliažolė trikampė',
    ltSynonyms: ['Kiškiakopūstis trikampis'],
    reason: 'gaspadorius siūlė adenophylla (rock garden, outdoor) — pakeičiau į triangularis (Purple Shamrock, žinomas kambarinis)',
  },
};

const pickSpecies = (G, ev) => {
  const camel = toCamel(G);
  const genusSpecies = ev.species; // pre-db species object
  const gaspEntries = ev.gaspEntries; // [{species, ltName, ltSynonyms, latin}]

  const picks = [];

  // 0. Manual species override (e.g. Oxalis → triangularis)
  const override = SPECIES_OVERRIDES[G];
  if (override) {
    const speciesExistsInPreDb = !!genusSpecies[override.species];
    if (speciesExistsInPreDb) {
      const sp = genusSpecies[override.species];
      picks.push({
        latinName: `${camel} ${override.species}`,
        speciesEpithet: override.species,
        ltName: override.ltName,
        ltSynonyms: override.ltSynonyms || [],
        commonName: sp?.commonName || null,
        gaspSourced: false,
        overrideReason: override.reason,
      });
      return picks.slice(0, 2);
    }
    // Fallback genus-only jei species nerasta pre-db
    picks.push({
      latinName: camel,
      speciesEpithet: null,
      ltName: override.ltName || ev.ltEntry?.ltName || null,
      ltSynonyms: override.ltSynonyms || [],
      commonName: null,
      gaspSourced: false,
      overrideReason: override.reason + ' (species nerasta pre-db, paliktas genus-only)',
    });
    return picks.slice(0, 2);
  }

  // 1. Filter gaspadorius entries to drop cross-genus contamination.
  // Gaspadorius scraper (geles-L-Z) sometimes mis-attributes ltNames to wrong latin keys —
  // e.g. Syngonium → "Orchidėja bulbophyllum longiflorum" (Orchidaceae name leaked into Araceae genus).
  // Heuristic: trusted canonical LT name comes from whitelist.ltName or lt-names.json.
  // We accept a gasp entry only if its ltName matches (case-insensitive prefix) the canonical.
  const canonicalLt = (ev.whitelistLtName || ev.ltEntry?.ltName || '').toLowerCase();
  const filteredGaspEntries = gaspEntries.filter(gp => {
    if (!canonicalLt) return true; // no canonical → accept all (best-effort)
    const ltLower = (gp.ltName || '').toLowerCase();
    // Accept if ltName starts with canonical (e.g. "Singonis" matches canonical "singonis")
    // or canonical starts with ltName (handles whitespace/abbrev cases).
    if (ltLower.startsWith(canonicalLt)) return true;
    if (canonicalLt.startsWith(ltLower) && ltLower.length >= 4) return true;
    // Reject if multi-word with foreign latin words (cross-genus contamination signal)
    return false;
  });
  // If filter removed everything, fall back to original (better than dropping the genus entirely)
  const useGaspEntries = filteredGaspEntries.length > 0 ? filteredGaspEntries : gaspEntries;
  const droppedContaminated = gaspEntries.length - filteredGaspEntries.length;
  if (droppedContaminated > 0 && filteredGaspEntries.length > 0) {
    console.log(`  [contamination filter] ${G}: dropped ${droppedContaminated} gasp entries (canonical: "${canonicalLt}")`);
  }

  for (const gp of useGaspEntries) {
    if (gp.species) {
      // Confirm species exists in pre-db
      const sp = genusSpecies[gp.species];
      picks.push({
        latinName: `${camel} ${gp.species}`,
        speciesEpithet: gp.species,
        ltName: gp.ltName,
        ltSynonyms: gp.ltSynonyms,
        commonName: sp?.commonName || null,
        gaspSourced: true,
      });
    } else {
      // Gaspadorius has only genus-level → genus-only pick
      picks.push({
        latinName: camel,
        speciesEpithet: null,
        ltName: gp.ltName,
        ltSynonyms: gp.ltSynonyms,
        commonName: null,
        gaspSourced: true,
      });
    }
  }

  // 2. If no gasp species, fallback to lt-names preferred (genus-level)
  if (picks.length === 0) {
    const lt = ev.ltEntry;
    const ltName = lt?.ltName || lt?.preferred || null;
    const ltSyns = lt?.ltSynonyms || [];
    picks.push({
      latinName: camel,
      speciesEpithet: null,
      ltName,
      ltSynonyms: ltSyns,
      commonName: null,
      gaspSourced: false,
    });
  }

  // Dedupe by latinName (in case gasp has duplicate entries)
  const seen = new Set();
  const unique = [];
  for (const p of picks) {
    if (!seen.has(p.latinName)) {
      seen.add(p.latinName);
      unique.push(p);
    }
  }

  // MAX 2 picks per genus (configured low — could be 3)
  return unique.slice(0, 2);
};

// ---------- BUILD FINAL ENTRIES ----------
const entries = {};
const tier1 = []; // latinName strings, ranked
const tier2 = [];
const tier3 = [];

const buildEntry = (G, pick, tier) => {
  const ev = genusEvidence[G];
  const camel = toCamel(G);

  // LT name fallback chain: pick.ltName → whitelist.ltName → lt-names.json → inat
  let finalLtName = pick.ltName;
  if (!finalLtName && ev.whitelistLtName) finalLtName = ev.whitelistLtName;
  if (!finalLtName && ev.ltEntry?.ltName) finalLtName = ev.ltEntry.ltName;
  if (!finalLtName && ev.inatPreferredLt) finalLtName = ev.inatPreferredLt;

  // pfaf species-level check
  const pfafSpeciesFound = pick.speciesEpithet
    ? !!pfafResults[`${camel} ${pick.speciesEpithet}`]
    : false;
  const pfafFound = pfafSpeciesFound || ev.pfafFound;

  // Notes — gray-zone flag + override reason + whitelist notes kaupiasi į vieną stringą
  const notesParts = [];
  const grayZone = GRAY_ZONE_NOTES[G];
  if (grayZone) notesParts.push(grayZone);
  if (pick.overrideReason) notesParts.push(pick.overrideReason);
  if (ev.whitelistNotes) notesParts.push(`whitelist: ${ev.whitelistNotes}`);

  return {
    latinName: pick.latinName,
    genus: camel,
    speciesEpithet: pick.speciesEpithet,
    family: ev.family,
    ltName: finalLtName,
    ltSynonyms: pick.ltSynonyms || [],
    tier,
    sourceEvidence: {
      whitelist: ev.whitelistTier != null,
      whitelistTier: ev.whitelistTier,
      indoorConfidence: ev.indoorConfidence,
      beckett: ev.beckett,
      cheng: ev.cheng,
      gaspadorius: ev.gaspadorius,
      ltConfidence: ev.ltConfidence,
      ltSources: ev.ltSources,
      aspcaToxic: ev.aspcaToxic,
      pfafFound,
      inatPreferredLt: ev.inatPreferredLt,
    },
    notes: notesParts.join(' | '),
  };
};

// Helper: add genus picks to a tier, respecting count target.
// Picks first species pick per genus; if room and genus has 2nd species, add it too.
const fillTier = (genusList, tierNum, targetTier, target) => {
  let count = 0;
  // PASS 1: one species per genus
  for (const G of genusList) {
    if (count >= target) break;
    const ev = genusEvidence[G];
    const picks = pickSpecies(G, ev);
    if (picks.length === 0) continue;
    const entry = buildEntry(G, picks[0], tierNum);
    if (entries[entry.latinName]) continue; // already in another tier
    entries[entry.latinName] = entry;
    targetTier.push(entry.latinName);
    count++;
  }
  // PASS 2: second species per genus (only if first pass didn't fill target)
  if (count < target) {
    for (const G of genusList) {
      if (count >= target) break;
      const ev = genusEvidence[G];
      const picks = pickSpecies(G, ev);
      if (picks.length < 2) continue;
      const entry = buildEntry(G, picks[1], tierNum);
      if (entries[entry.latinName]) continue;
      entries[entry.latinName] = entry;
      targetTier.push(entry.latinName);
      count++;
    }
  }
  return count;
};

const t1Count = fillTier(t1, 1, tier1, TARGET_T1);
const t2Count = fillTier(t2, 2, tier2, TARGET_T2);
const t3Count = fillTier(t3, 3, tier3, TARGET_T3);

// If tiers underfilled, do best-effort relax pass (pull from any remaining beckett genus)
const relaxFill = (tierNum, targetTier, target) => {
  if (targetTier.length >= target) return;
  const usedGenera = new Set();
  for (const ln of [...tier1, ...tier2, ...tier3]) {
    const g = entries[ln]?.genus?.toUpperCase();
    if (g) usedGenera.add(g);
  }
  const candidates = beckettGenera
    .filter(g => !usedGenera.has(g))
    .sort((a, b) => scoreGenus(b) - scoreGenus(a));
  for (const G of candidates) {
    if (targetTier.length >= target) break;
    const ev = genusEvidence[G];
    const picks = pickSpecies(G, ev);
    if (picks.length === 0) continue;
    const entry = buildEntry(G, picks[0], tierNum);
    if (entries[entry.latinName]) continue;
    entries[entry.latinName] = entry;
    targetTier.push(entry.latinName);
  }
};

relaxFill(1, tier1, TARGET_T1);
relaxFill(2, tier2, TARGET_T2);
relaxFill(3, tier3, TARGET_T3);

console.log(`\nFinal tier sizes:`);
console.log(`  Tier 1: ${tier1.length}`);
console.log(`  Tier 2: ${tier2.length}`);
console.log(`  Tier 3: ${tier3.length}`);
console.log(`  Total entries: ${Object.keys(entries).length}`);

// ---------- OUTPUT ----------
const output = {
  generatedAt: new Date().toISOString(),
  totalCandidates: Object.keys(entries).length,
  schemaVersion: 1,
  tiers: { tier1, tier2, tier3 },
  entries,
};

writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), 'utf8');
console.log(`\nWritten: ${OUT_PATH}`);

// ---------- REPORT ----------
console.log('\n========== REPORT ==========');
console.log(`Total Beckett genera processed: ${beckettGenera.length}`);
console.log(`TIER 1 count: ${tier1.length} (target 50)`);
console.log(`TIER 2 count: ${tier2.length} (target 100)`);
console.log(`TIER 3 count: ${tier3.length} (target 150)`);

console.log('\n--- TOP 10 TIER 1 ---');
tier1.slice(0, 10).forEach((ln, i) => {
  const e = entries[ln];
  console.log(`  ${i + 1}. ${ln}  →  ${e.ltName || '(no LT)'}`);
});

console.log('\n--- TOP 10 TIER 3 (niche samples) ---');
tier3.slice(0, 10).forEach((ln, i) => {
  const e = entries[ln];
  console.log(`  ${i + 1}. ${ln}  →  ${e.ltName || '(no LT)'}`);
});

console.log('\n--- CONTROL CHECK (well-known houseplants) ---');
const controls = [
  'PHILODENDRON', 'MONSTERA', 'FICUS', 'SANSEVIERIA', 'EPIPREMNUM',
  'SPATHIPHYLLUM', 'CALATHEA', 'ALOE', 'ECHEVERIA',
  'ANTHURIUM', 'BEGONIA', 'PHALAENOPSIS', 'CRASSULA',
  'ZAMIOCULCAS', 'PILEA', 'KALANCHOE', 'OXALIS',
];
for (const G of controls) {
  const camel = toCamel(G);
  const inTier1 = tier1.some(ln => entries[ln].genus === camel);
  const inTier2 = tier2.some(ln => entries[ln].genus === camel);
  const inTier3 = tier3.some(ln => entries[ln].genus === camel);
  const tier = inTier1 ? 'T1' : inTier2 ? 'T2' : inTier3 ? 'T3' : 'ABSENT';
  const matchingLatin = [...tier1, ...tier2, ...tier3].find(ln => entries[ln].genus === camel);

  if (tier === 'ABSENT') {
    // Diagnose why
    const inBeckett = beckettGenera.includes(G);
    const ev = genusEvidence[G];
    let reason;
    if (!inBeckett) {
      reason = 'NOT in indoor set (beckett OR cheng)';
      const inPreDb = !!genera[G];
      if (!inPreDb) reason += ' (also not in pre-db)';
      else reason += ` (inSources: ${(genera[G].inSources || []).join(',')})`;
    } else {
      const flags = [];
      if (!ev.gaspadorius) flags.push('no gasp');
      if (ev.ltConfidence !== 'high') flags.push(`ltConf=${ev.ltConfidence || 'null'}`);
      if (!ev.inatPreferredLt) flags.push('no iNat LT');
      reason = `Beckett yes, but: ${flags.join('; ')}`;
    }
    console.log(`  ${G.padEnd(15)} → ABSENT   [${reason}]`);
  } else {
    const e = entries[matchingLatin];
    console.log(`  ${G.padEnd(15)} → ${tier}  ${matchingLatin}  (LT: ${e.ltName || '?'})`);
  }
}

console.log('\nDone.');
