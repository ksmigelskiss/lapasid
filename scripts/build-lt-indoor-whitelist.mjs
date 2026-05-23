#!/usr/bin/env node
/**
 * Build lt-indoor-whitelist.json
 *
 * Multi-criteria filter for LT-realistic indoor kambariniai genera.
 * NOT Beckett-only (Beckett 1993 has ~30% outdoor/seasonal noise).
 *
 * Inputs:
 *   data/pre-db.json (Beckett + AHS + Cheng index)
 *   data/lt-names.json (908 LT names w/ confidence)
 *   data/gaspadorius-detail.json (217 LT market signal)
 *
 * Output:
 *   data/lt-indoor-whitelist.json
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');

const preDb = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'pre-db.json'), 'utf-8'));
const ltNamesData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'lt-names.json'), 'utf-8'));
const gaspData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'gaspadorius-detail.json'), 'utf-8'));

// ── BUILD INDICES ──────────────────────────────────────────────────────────
const genera = preDb.genera;

// lt-names is keyed Title-Case → normalize to UPPER for matching pre-db keys
const ltByUpper = {};
for (const [k, v] of Object.entries(ltNamesData.ltNames)) {
  ltByUpper[k.toUpperCase()] = v;
}

// gaspadorius signal — any genus mentioned in extracted entries
const gaspGenera = new Set();
for (const entry of Object.values(gaspData.results)) {
  if (entry.latinGenus) gaspGenera.add(entry.latinGenus.toUpperCase());
  for (const syn of (entry.latinSynonyms || [])) {
    const g = (syn.split(' ')[0] || '').toUpperCase();
    if (g) gaspGenera.add(g);
  }
}

// ── OUTDOOR BLACKLIST ──────────────────────────────────────────────────────
// Sezoniniai, sodo, lauko, daržoves, conservatory-only — automatic exclusion
const OUTDOOR_BLACKLIST = new Set([
  // Sezoniniai svogūniniai / forsuoti
  'TULIPA', 'HYACINTHUS', 'CROCUS', 'MUSCARI', 'SCILLA', 'FRITILLARIA',
  'ORNITHOGALUM', 'GLADIOLUS', 'NARCISSUS', 'GALANTHUS', 'IRIS', 'LILIUM',
  'CONVALLARIA', 'COLCHICUM', 'CHIONODOXA', 'PUSCHKINIA', 'ERANTHIS',
  'LEUCOJUM', 'DAHLIA', 'CANNA', 'TIGRIDIA', 'CALADIUM',

  // Sodo daugiamečiai
  'ROSA', 'PAEONIA', 'PEONIA', 'CLEMATIS', 'ANEMONE', 'CAMPANULA', 'PRIMULA',
  'HEUCHERA', 'DIANTHUS', 'MYOSOTIS', 'VIOLA', 'PETUNIA', 'ANTIRRHINUM',
  'LOBELIA', 'CALENDULA', 'HYDRANGEA', 'RHODODENDRON', 'AZALEA',
  'DELPHINIUM', 'AQUILEGIA', 'ASTILBE', 'BERGENIA', 'HOSTA', 'PHLOX',
  'HELLEBORUS', 'PULMONARIA', 'TIARELLA', 'LIATRIS', 'ECHINOPS', 'LIGULARIA',
  'KNIPHOFIA', 'EREMURUS', 'AGAPANTHUS', 'ALSTROEMERIA', 'PAPAVER',
  'GAILLARDIA', 'GAURA', 'GERANIUM', // hardy Geranium (NOT Pelargonium!)
  'AJUGA', 'ALCHEMILLA', 'ANCHUSA', 'AUBRIETA', 'ARABIS', 'AURINIA',
  'CENTAUREA', 'COREOPSIS', 'CORYDALIS', 'DICENTRA', 'DIGITALIS',
  'DODECATHEON', 'EPIMEDIUM', 'ERYNGIUM', 'EUPATORIUM', 'FILIPENDULA',
  'GAILLARDIA', 'GENTIANA', 'GEUM', 'GYPSOPHILA', 'HELENIUM', 'HELIOPSIS',
  'HEMEROCALLIS', 'HESPERIS', 'INULA', 'KIRENGESHOMA', 'LAMIUM',
  'LATHYRUS', 'LAVATERA', 'LEUCANTHEMUM', 'LIGUSTRUM', 'LINUM', 'LUNARIA',
  'LUPINUS', 'LYCHNIS', 'LYSIMACHIA', 'LYTHRUM', 'MACLEAYA', 'MALVA',
  'MECONOPSIS', 'MONARDA', 'NEPETA', 'OENOTHERA', 'PENSTEMON', 'PEROVSKIA',
  'PHYSALIS', 'PHYSOSTEGIA', 'PLATYCODON', 'POLEMONIUM', 'POLYGONATUM',
  'POTENTILLA', 'PULSATILLA', 'RANUNCULUS', 'RUDBECKIA', 'SALVIA',
  'SAPONARIA', 'SAXIFRAGA', 'SCABIOSA', 'SEDUM', // Sedum: many garden-hardy; specialty indoor handled in tier3
  'SIDALCEA', 'SISYRINCHIUM', 'SOLIDAGO', 'STACHYS', 'STOKESIA', 'SYMPHYTUM',
  'TANACETUM', 'THALICTRUM', 'TIARELLA', 'TRADESCANTIA', // garden Tradescantia
  // Wait — Tradescantia zebrina / pallida ARE indoor → INSTEAD remove from blacklist
  'TROLLIUS', 'VERATRUM', 'VERBASCUM', 'VERBENA', 'VERONICA', 'VINCA',
  'WALDSTEINIA', 'YUCCA', // outdoor Yucca filamentosa; Yucca elephantipes IS indoor → keep in greylist
  // Note: Yucca/Tradescantia/Sedum overlap garden/indoor — special handling below

  // Outdoor medžiai / krūmai
  'ACER', 'CYTISUS', 'EUONYMUS', 'MICHELIA', 'HEBE', 'OLEA', 'BERBERIS',
  'BUDDLEJA', 'BUXUS', 'CARAGANA', 'CARPINUS', 'CATALPA', 'CEDRUS',
  'CELASTRUS', 'CELTIS', 'CERCIDIPHYLLUM', 'CERCIS', 'CHAENOMELES',
  'CHAMAECYPARIS', 'CORNUS', 'CORYLOPSIS', 'CORYLUS', 'COTINUS',
  'COTONEASTER', 'CRATAEGUS', 'CRYPTOMERIA', 'CUPRESSUS', 'DAPHNE',
  'DEUTZIA', 'ELAEAGNUS', 'ENKIANTHUS', 'ERICA', 'ESCALLONIA',
  'EUCALYPTUS', 'FAGUS', 'FORSYTHIA', 'FRAXINUS', 'GINKGO', 'GLEDITSIA',
  'HAMAMELIS', 'HIBISCUS', // outdoor Hibiscus syriacus; tropical H. rosa-sinensis IS indoor → handle below
  'HIPPOPHAE', 'HYDRANGEA', 'ILEX', 'JUGLANS', 'JUNIPERUS', 'KALMIA',
  'KOELREUTERIA', 'KOLKWITZIA', 'LABURNUM', 'LAGERSTROEMIA', 'LARIX',
  'LIGUSTRUM', 'LIRIODENDRON', 'LONICERA', 'MAGNOLIA', 'MAHONIA',
  'MALUS', 'METASEQUOIA', 'MORUS', 'MYRICA', 'NYSSA', 'OSTRYA', 'PARROTIA',
  'PARTHENOCISSUS', 'PAULOWNIA', 'PHILADELPHUS', 'PHOTINIA', 'PICEA',
  'PIERIS', 'PINUS', 'PITTOSPORUM', 'PLATANUS', 'POPULUS', 'PRUNUS',
  'PSEUDOTSUGA', 'PUNICA', 'PYRACANTHA', 'PYRUS', 'QUERCUS', 'RHUS',
  'RIBES', 'ROBINIA', 'SALIX', 'SAMBUCUS', 'SASA', 'SKIMMIA', 'SORBARIA',
  'SORBUS', 'SPIRAEA', 'STAPHYLEA', 'STEPHANOTIS', // wait, Stephanotis IS indoor vine → remove
  'STEWARTIA', 'STYRAX', 'SYMPHORICARPOS', 'SYRINGA', 'TAMARIX', 'TAXUS',
  'THUJA', 'TILIA', 'TSUGA', 'ULMUS', 'VIBURNUM', 'WEIGELA', 'WISTERIA',
  'ZELKOVA',

  // Vandens augalai
  'PISTIA', 'NYMPHAEA', 'NUPHAR', 'ELODEA', 'CABOMBA', 'MYRIOPHYLLUM',
  'POTAMOGETON', 'TYPHA',

  // Daržoves
  'CUCURBITA', 'ALLIUM', 'LACTUCA', 'CAPSICUM', 'LYCOPERSICON',
  'SOLANUM', 'BRASSICA', 'BETA', 'DAUCUS', 'PISUM', 'PHASEOLUS',
  'CUCUMIS', 'CITRULLUS', 'SPINACIA', 'RAPHANUS', 'PASTINACA',
  'APIUM', 'ASPARAGUS', // Asparagus densiflorus IS indoor — handle below
  'ARMORACIA', 'ZEA', 'TRITICUM', 'HORDEUM', 'AVENA', 'SECALE',
  'SETARIA', 'PANICUM',

  // Lauko vaistažoles / culinary herbs
  'LAVANDULA', 'ROSMARINUS', 'THYMUS', 'MENTHA', 'ORIGANUM',
  'OCIMUM', 'PETROSELINUM', 'ANETHUM', 'CORIANDRUM', 'CARUM',
  'FOENICULUM', 'HYSSOPUS', 'ARTEMISIA', 'TANACETUM', 'TRIGONELLA',
  'SATUREJA', 'MELISSA',

  // Outdoor wildflowers / pievos
  'ASCLEPIAS', 'DIMORPHOTHECA', 'ACHILLEA', 'ECHINACEA', 'BORAGO',
  'CICHORIUM', 'TARAXACUM', 'PLANTAGO', 'URTICA', 'GALIUM', 'ARNICA',
  'CHRYSANTHEMUM', // pot Chrysanthemum is sezoninis gift, retas LT permanent indoor

  // Aquatic / specialty water plants
  'CYPERUS', // C. alternifolius IS indoor — handle below

  // Specifically commonly-misclassified outdoor genera
  'FUCHSIA', // forsuotos pavasarį, lauke vasarą — ne kambarinis LT
  'PELARGONIUM', // Lauke vasarą, pakambry žiemai (overwinter); ne nuolatinis kambarinis tier 1
  'CITRUS', // conservatory specialty — handled separately as tier3 if popular
  'MUSA', // banana — specialty
  'HELICONIA', // greenhouse-only
  'OXALIS', // O. triangularis IS indoor — handle below
  'BOUGAINVILLEA', // sun-conservatory specialty
  'JASMINUM', // Jasminum polyanthum indoor common; J. officinale outdoor — keep gray
  'CAMELLIA', // conservatory ne home
  'GARDENIA', // capricious — keep gray (tier3 specialty)

  // Carnivorous edge — tier3 specialty inclusion override below
  // (Drosera, Dionaea, Sarracenia, Nepenthes — left out of blacklist; whitelist tier3 only Nepenthes)
]);

// Greylist: NOT in primary blacklist OR override blacklist for these indoor cultivars
// (handled by explicit specialty list inclusion)
const SPECIALTY_INDOOR_ADD = new Set([
  // Tropical aroids / common indoor
  'ALOCASIA', 'COLOCASIA', 'XANTHOSOMA',
  // Orchids common indoor
  'PHALAENOPSIS', 'CATTLEYA', 'CYMBIDIUM', 'DENDROBIUM', 'ONCIDIUM',
  'MILTONIOPSIS', 'PAPHIOPEDILUM', 'VANDA', 'BRASSIA', 'ZYGOPETALUM',
  // Specialty succulents
  'LITHOPS', 'FAUCARIA', 'CONOPHYTUM', 'PLEIOSPILOS', 'TITANOPSIS',
  'GASTERIA', 'HAWORTHIA', 'HAWORTHIOPSIS', 'ECHEVERIA', 'GRAPTOPETALUM',
  'PACHYPHYTUM', 'SEMPERVIVUM',
  'ADENIUM', 'PACHYPODIUM',
  // String-of-pearls and unusual hangers
  'CEROPEGIA', 'CURIO',
  // Carnivorous — niche LT specialty
  'NEPENTHES', 'DIONAEA', 'DROSERA', 'SARRACENIA', 'CEPHALOTUS',
  // Air plants / bromeliads
  'TILLANDSIA', 'VRIESEA', 'GUZMANIA', 'NEOREGELIA', 'CRYPTANTHUS',
  'BILLBERGIA', 'AECHMEA',
  // Specialty ferns
  'NEPHROLEPIS', 'PTERIS', 'POLYSTICHUM',
  // Indoor exotics popular in LT
  'STRELITZIA',
  'CLERODENDRUM', 'PASSIFLORA',
  'HOYA',
  // Common indoor varieties
  'TRADESCANTIA', 'YUCCA', 'CYPERUS', 'OXALIS', 'ASPARAGUS',
  'HIBISCUS', 'STEPHANOTIS',
  // Common climbers / others
  'CISSUS', 'RHOIPSAPHIS', 'RHOICISSUS', 'SYNGONIUM', 'SCINDAPSUS',
  'AEONIUM', 'SEDUM',
  // Missing-from-pre-db indoor genera (gasp signal or well-known LT kambariniai)
  'FATSHEDERA', // x Fatshedera lizei — indoor hybrid
  'HOWEIA',     // kentia palm
  'JATROPHA',   // J. podagrica indoor curiosity
  'PELLAEA',    // P. rotundifolia button fern
  'MICROCOELUM',
  'RADERMACHERA', // R. sinica indoor tree
  'POGONATHERUM', // baby panda bamboo indoor
  // Common indoor present in AHS but not Beckett — gasp/expert verified
  'CHAMAEDOREA', // parlor palm
  'CODIAEUM',    // croton
  'CTENANTHE',   // never never plant
  'CYCAS',       // sago palm
  'EUPHORBIA',   // E. milii, E. tirucalli — succulent indoor
  'GYNURA',      // velvet plant
  'PHLEBODIUM',  // P. aureum indoor fern
  'PLECTRANTHUS', // P. verticillatus, P. amboinicus indoor
  'RHAPIS',      // lady palm
  'APHELANDRA',  // zebra plant
  // Blacklist override specialty entries (also added so they appear)
  'GARDENIA', 'JASMINUM', 'BOUGAINVILLEA', 'CALADIUM',
  'CYCLAMEN', 'PELARGONIUM', 'SOLANUM',
]);

// Explicitly remove from blacklist (override) — these genera DO have famous indoor species
const BLACKLIST_OVERRIDES = new Set([
  'TRADESCANTIA', 'YUCCA', 'CYPERUS', 'OXALIS', 'ASPARAGUS',
  'HIBISCUS', 'STEPHANOTIS', 'SEDUM',
  'CHLOROPHYTUM', // ne blacklist'e, bet for safety
  // Overrides based on gaspadorius signal — LT realiai parduoda kaip kambarinį
  'BOUGAINVILLEA', // gasp signal — LT indoor sun specialty
  'GARDENIA', // gasp signal — kaprizingas, bet popular LT indoor
  'JASMINUM', // gasp signal — J. polyanthum indoor LT
  'SOLANUM', // S. capsicastrum (winter cherry) — sezoninis bet popular LT
  'CYCLAMEN', // sezoninis indoor — kept as gray (T2)
  'PELARGONIUM', // gasp signal — LT auginama kambary žiemai
  'CALADIUM', // tropical indoor LT
]);

for (const g of BLACKLIST_OVERRIDES) OUTDOOR_BLACKLIST.delete(g);

// ── KNOWN MAINSTREAM INDOOR (cross-check tier1 control set) ─────────────────
const MAINSTREAM_CONTROL = [
  'PHILODENDRON', 'MONSTERA', 'FICUS', 'SANSEVIERIA', 'EPIPREMNUM',
  'SPATHIPHYLLUM', 'ALOE', 'ZAMIOCULCAS', 'CALATHEA', 'ANTHURIUM',
  'BEGONIA', 'CRASSULA', 'PILEA', 'KALANCHOE',
];

// ── TIER CLASSIFICATION ────────────────────────────────────────────────────
function classify(genusUpper, rec, ltRec) {
  const inB = rec.inSources?.includes('beckett') || false;
  const inC = rec.inSources?.includes('cheng') || false;
  const hasIndoorSrc = inB || inC;

  if (OUTDOOR_BLACKLIST.has(genusUpper)) {
    return { tier: 0, reason: 'outdoor_blacklist' };
  }

  const ltName = ltRec?.ltName || null;
  const confidence = ltRec?.confidence || null;
  const inGasp = gaspGenera.has(genusUpper);

  // Tier 1: indoor source + LT high + (gasp OR wiki)
  if (hasIndoorSrc && confidence === 'high' && (inGasp || ltRec?.wikiUrl)) {
    return { tier: 1, reason: 'beckett/cheng + high LT + (gasp|wiki)' };
  }

  // Tier 1 bonus: mainstream control always T1 if indoor src + any LT
  if (hasIndoorSrc && MAINSTREAM_CONTROL.includes(genusUpper)) {
    return { tier: 1, reason: 'mainstream control + indoor src' };
  }

  // Tier 1: indoor src + high conf (even without gasp/wiki)
  if (hasIndoorSrc && confidence === 'high') {
    return { tier: 1, reason: 'beckett/cheng + high LT confidence' };
  }

  // Tier 1: indoor src + gasp signal (LT market verified)
  if (hasIndoorSrc && inGasp) {
    return { tier: 1, reason: 'beckett/cheng + gaspadorius market' };
  }

  // Tier 2: indoor src + mid LT
  if (hasIndoorSrc && confidence === 'mid') {
    return { tier: 2, reason: 'beckett/cheng + mid LT confidence' };
  }

  // Tier 2: indoor src, no LT but gasp signal
  if (hasIndoorSrc && inGasp) {
    return { tier: 2, reason: 'beckett/cheng + gasp (no LT)' };
  }

  // Beckett-only with no LT name AND no gasp signal → drop.
  // These are mostly obscure outdoor/conservatory noise (Beckett 1993 is liberal).
  if (hasIndoorSrc) {
    return { tier: -1, reason: 'beckett-only, no LT, no gasp signal — dropped' };
  }

  // No Beckett/Cheng, but gaspadorius (LT market) + LT name signals indoor
  // (Beckett 1993 missed many newer indoor genera; gasp is LT market truth)
  if (inGasp && confidence === 'high') {
    return { tier: 1, reason: 'gaspadorius + high LT confidence (no Beckett/Cheng)' };
  }
  if (inGasp && confidence === 'mid') {
    return { tier: 2, reason: 'gaspadorius + mid LT confidence (no Beckett/Cheng)' };
  }
  if (inGasp) {
    return { tier: 2, reason: 'gaspadorius only (LT market signal)' };
  }

  // Tier 3 specialty: explicit override (not in beckett/cheng OR not previously caught)
  if (SPECIALTY_INDOOR_ADD.has(genusUpper)) {
    return { tier: 3, reason: 'specialty indoor (expert)' };
  }

  return { tier: -1, reason: 'no_indoor_source' };
}

// ── BUILD WHITELIST ────────────────────────────────────────────────────────
const byGenus = {};
const tier1 = [], tier2 = [], tier3 = [], excluded = [];

const allKeys = new Set(Object.keys(genera));
// Also include specialty entries not in pre-db
for (const sp of SPECIALTY_INDOOR_ADD) allKeys.add(sp);

for (const genusUpper of [...allKeys].sort()) {
  const rec = genera[genusUpper] || { inSources: [] };
  const ltRec = ltByUpper[genusUpper];

  const { tier, reason } = classify(genusUpper, rec, ltRec);
  if (tier === 0) {
    excluded.push({ genus: genusUpper, reason });
    continue;
  }
  if (tier === -1) {
    continue; // not added to whitelist
  }

  // Title-case the canonical name (first letter upper, rest lower) for prettier display
  const title = genusUpper.charAt(0) + genusUpper.slice(1).toLowerCase();

  const entry = {
    tier,
    ltName: ltRec?.ltName || null,
    ltConfidence: ltRec?.confidence || null,
    beckett: rec.inSources?.includes('beckett') || false,
    cheng: rec.inSources?.includes('cheng') || false,
    gaspadorius: gaspGenera.has(genusUpper),
    indoor_confidence:
      tier === 1 ? 'verified'
      : tier === 2 ? 'likely'
      : 'specialty',
    notes: '',
  };

  // Add notes for known edge cases
  if (genusUpper === 'YUCCA') entry.notes = 'Indoor: Y. elephantipes; outdoor: Y. filamentosa';
  if (genusUpper === 'HIBISCUS') entry.notes = 'Indoor: H. rosa-sinensis; outdoor: H. syriacus';
  if (genusUpper === 'TRADESCANTIA') entry.notes = 'Indoor: T. zebrina/pallida; outdoor: T. virginiana';
  if (genusUpper === 'CYPERUS') entry.notes = 'Indoor: C. alternifolius/papyrus dwarf';
  if (genusUpper === 'OXALIS') entry.notes = 'Indoor: O. triangularis (purple shamrock)';
  if (genusUpper === 'STRELITZIA') entry.notes = 'Indoor: S. reginae; greenhouse: S. nicolai';
  if (genusUpper === 'SEDUM') entry.notes = 'Indoor: S. morganianum (burros tail); most others outdoor';
  if (genusUpper === 'ASPARAGUS') entry.notes = 'Indoor: A. densiflorus, A. setaceus (fern types)';
  if (genusUpper === 'STEPHANOTIS') entry.notes = 'Indoor climbing vine (Madagascar jasmine)';
  if (genusUpper === 'SEMPERVIVUM') entry.notes = 'Mostly outdoor; some terrarium use';
  if (genusUpper === 'NEPENTHES') entry.notes = 'Specialty carnivorous — niche LT';
  if (genusUpper === 'DIONAEA') entry.notes = 'Specialty carnivorous — Venus flytrap';
  if (genusUpper === 'CURIO') entry.notes = 'String of pearls (formerly Senecio rowleyanus)';
  if (genusUpper === 'CYCLAMEN') entry.notes = 'Sezoninis dovaninai indoor — LT common gift';
  if (genusUpper === 'PELARGONIUM') entry.notes = 'LT auginama indoor žiemai (overwinter); lauke vasarą';
  if (genusUpper === 'SOLANUM') entry.notes = 'Indoor: S. capsicastrum/pseudocapsicum (winter cherry)';
  if (genusUpper === 'GARDENIA') entry.notes = 'Capricious LT indoor — needs humidity';
  if (genusUpper === 'JASMINUM') entry.notes = 'Indoor: J. polyanthum, J. sambac';
  if (genusUpper === 'BOUGAINVILLEA') entry.notes = 'Sun-loving indoor specialty';
  if (genusUpper === 'CALADIUM') entry.notes = 'Tropical indoor — fancy-leaved';
  if (genusUpper === 'EUPHORBIA') entry.notes = 'Indoor: E. milii (crown of thorns), E. tirucalli, E. trigona';
  if (genusUpper === 'CHAMAEDOREA') entry.notes = 'Parlor palm — common LT indoor';
  if (genusUpper === 'CODIAEUM') entry.notes = 'Croton — colorful indoor';
  if (genusUpper === 'CYCAS') entry.notes = 'Sago palm — toxic, indoor specialty';
  if (genusUpper === 'RHAPIS') entry.notes = 'Lady palm — indoor';
  if (genusUpper === 'HOWEIA') entry.notes = 'Kentia palm — premium indoor';
  if (genusUpper === 'RADERMACHERA') entry.notes = 'China doll plant — indoor';

  byGenus[title] = entry;
  if (tier === 1) tier1.push(title);
  else if (tier === 2) tier2.push(title);
  else if (tier === 3) tier3.push(title);
}

// ── OUTPUT ─────────────────────────────────────────────────────────────────
const output = {
  generatedAt: new Date().toISOString(),
  totalGenera: tier1.length + tier2.length + tier3.length,
  methodology:
    'Multi-criteria filtering: Beckett OR Cheng indoor source + LT name confidence + gaspadorius market signal + outdoor blacklist exclusion + specialty expert additions. Designed to replace Beckett 1993 raw indoor list which has ~30% outdoor/seasonal noise for LT context.',
  tiers: {
    tier1_high: tier1.sort(),
    tier2_medium: tier2.sort(),
    tier3_specialty: tier3.sort(),
  },
  excluded: {
    count: excluded.length,
    sample: excluded.slice(0, 50).map(e => e.genus),
  },
  byGenus,
};

const outPath = path.join(DATA_DIR, 'lt-indoor-whitelist.json');
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

// ── REPORT ─────────────────────────────────────────────────────────────────
console.log('=== LT INDOOR WHITELIST REPORT ===');
console.log(`Generated: ${output.generatedAt}`);
console.log(`Output: ${outPath}`);
console.log();
console.log('TIER COUNTS:');
console.log(`  Tier 1 (high confidence):    ${tier1.length}`);
console.log(`  Tier 2 (medium confidence):  ${tier2.length}`);
console.log(`  Tier 3 (specialty):          ${tier3.length}`);
console.log(`  TOTAL:                       ${output.totalGenera}`);
console.log(`  Excluded by blacklist:       ${excluded.length}`);
console.log();
console.log('MAINSTREAM CONTROL CHECK (all should be T1):');
for (const g of MAINSTREAM_CONTROL) {
  const title = g.charAt(0) + g.slice(1).toLowerCase();
  const e = byGenus[title];
  if (!e) console.log(`  ${g.padEnd(15)} → MISSING from whitelist`);
  else console.log(`  ${g.padEnd(15)} → T${e.tier}  (lt=${e.ltName || '-'}, conf=${e.ltConfidence || '-'}, gasp=${e.gaspadorius}, beckett=${e.beckett}, cheng=${e.cheng})`);
}
console.log();
console.log('SAMPLE TIER 1 (first 20):');
for (const g of tier1.slice(0, 20)) {
  const e = byGenus[g];
  console.log(`  ${g.padEnd(18)} lt=${(e.ltName || '-').padEnd(20)} conf=${e.ltConfidence || '-'}, gasp=${e.gaspadorius ? 'Y' : 'N'}`);
}
console.log();
console.log('SAMPLE TIER 3 SPECIALTY (all):');
for (const g of tier3.slice(0, 30)) {
  const e = byGenus[g];
  console.log(`  ${g.padEnd(18)} lt=${(e.ltName || '-').padEnd(20)} notes="${e.notes}"`);
}
console.log();
console.log('SAMPLE EXCLUDED (blacklist, first 30):');
for (const g of excluded.slice(0, 30)) console.log(`  ${g.genus}`);
console.log();
console.log('EDGE CASES (entries with notes):');
for (const [g, e] of Object.entries(byGenus)) {
  if (e.notes) console.log(`  ${g.padEnd(18)} T${e.tier}: ${e.notes}`);
}
