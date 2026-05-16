import { doc, getDoc, setDoc, getDocs, collection, query, where, deleteDoc } from 'firebase/firestore'
import { db } from './firebase'

// ── Schema constants ─────────────────────────────────────────────────
//
// TaxonGroup'as yra **parent grouping** žemiau botanikos hierarchijos —
// cultivar serijos, species, hybridai, group klasifikacijos, genus-care
// (kai user'is turi tik bendrai „Echeveria", be species).
//
// Visi cultivars (Catalog) gali turėti `taxonGroupId` ref'ą į vieną
// TaxonGroup'ą, ir paveldi care info iš jo. Per-cultivar `overrides`
// turi prioritetą per merge'inant.
//
// Standalone cultivars (be serijos / genus parent) → `taxonGroupId: null`,
// visi field'ai tiesiogiai catalog doc'e (flat behavior, kaip seniai).

export const TAXON_GROUP_TYPES = [
  'cultivar-series',   // Boulevard, Wave, Knock Out
  'species',           // Coleus scutellarioides, Hosta sieboldiana
  'hybrid',            // Clematis × jackmanii, Heuchera × heucherella
  'genus-care',        // „Echeveria genus" — kai bendros care info pakanka
  'cultivar-group',    // Tea Roses, Tall Bearded Iris, Zonal Pelargoniums
  'variety',           // Acer palmatum var. dissectum (botanical var.)
  'subspecies',        // Picea pungens ssp. engelmannii
]

export const CULTIVATION_CONTEXTS = ['indoor', 'outdoor', 'both']
export const LIFECYCLES = ['annual', 'biennial', 'perennial', 'woody', 'bulbous']
export const PHOTO_TYPES = ['flower', 'plant', 'foliage', 'winter', 'fruit', 'seedling']

// MAX bulk save batch — apriboja AI cost per call'ą.
// Vienam call'e gali tilpti ~25 cultivars su smart prompt'u (~$0.15 max).
// Didesnėms serijoms — split į 2+ batches.
export const MAX_BULK_BATCH = 25

// Schema version — keičiam, kai data model evoliucionuoja.
// Migration script'ai naudoja šitą, kad atpažintų ką update'inti.
export const CATALOG_SCHEMA_VERSION = 2  // v1 = flat, v2 = series-aware

// ── ID generation ────────────────────────────────────────────────────

/**
 * TaxonGroup docId — slug formatas pagal genus + name.
 *   ({ genus: "Clematis", name: "Boulevard" })           → "clematis-boulevard"
 *   ({ genus: "Hosta",    name: "Hosta", type: "genus-care" }) → "hosta-genus"
 *   ({ genus: "Clematis", name: "×jackmanii", type: "hybrid" }) → "clematis-jackmanii-hybrid"
 *
 * `type` suffix'as automatiškai pridedamas tik genus-care, hybrid, variety,
 * subspecies atvejais (kad nesusimaišytų su species ar cultivar-series).
 */
export function taxonGroupDocId({ genus, name, type }) {
  if (!genus && !name) return null
  const norm = (s) => (s ?? '').toLowerCase()
    .replace(/[®™©]/g, '')
    .replace(/\s*['"]\s*/g, '')
    .replace(/[×x]\s+/g, '')             // strip hybrid sign
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')

  const parts = []
  if (genus) parts.push(norm(genus))
  // Don't duplicate genus in name (kai name == genus, pvz. „Hosta" + „Hosta")
  if (name && norm(name) !== norm(genus)) parts.push(norm(name))

  // Type suffix'as atskiria semantines situacijas su tuo pačiu genus+name
  if (type === 'genus-care')   parts.push('genus')
  if (type === 'hybrid')       parts.push('hybrid')
  if (type === 'variety')      parts.push('var')
  if (type === 'subspecies')   parts.push('ssp')

  return parts.join('-').slice(0, 100) || null
}

// Cultivar docId — perpanaudojam catalog.js catalogDocId logiką.
// Eksportuojam aliasą semantiniam aiškumui.
export { catalogDocId as cultivarDocId } from './catalog'

// ── Storage paths ────────────────────────────────────────────────────
//
// Hierarchinė struktūra:
//   catalog/{taxonGroupId}/hero.jpg               — serijos heroImage
//   catalog/{taxonGroupId}/{cultivarId}/main.jpg  — cultivar pagrindinė
//   catalog/{taxonGroupId}/{cultivarId}/thumb.jpg — thumbnail
//   catalog/{taxonGroupId}/{cultivarId}/{type}-{idx}.jpg — galerija
//
// Standalone (be taxonGroup'o):
//   catalog/standalone/{cultivarId}/main.jpg

export function seriesHeroPath(taxonGroupId) {
  if (!taxonGroupId) return null
  return `catalog/${taxonGroupId}/hero.jpg`
}

export function cultivarImagePath(taxonGroupId, cultivarId, opts = {}) {
  if (!cultivarId) return null
  const { type = 'main', index } = opts
  const fname = index != null ? `${type}-${index}.jpg` : `${type}.jpg`
  if (taxonGroupId) return `catalog/${taxonGroupId}/${cultivarId}/${fname}`
  return `catalog/standalone/${cultivarId}/${fname}`
}

// ── Firestore CRUD helpers ───────────────────────────────────────────

/** Get taxon group by ID. Returns null jei nerasta. */
export async function getTaxonGroup(groupId) {
  if (!groupId) return null
  try {
    const snap = await getDoc(doc(db, 'taxonGroups', groupId))
    return snap.exists() ? { id: snap.id, ...snap.data() } : null
  } catch (e) {
    console.warn('[taxonGroups] get failed:', e)
    return null
  }
}

/** Save taxon group. Merge'ina su esamais field'ais. */
export async function saveTaxonGroup(group) {
  if (!group?.id) throw new Error('taxonGroup.id required')
  const { id, ...rest } = group
  await setDoc(doc(db, 'taxonGroups', id), {
    ...rest,
    schemaVersion: CATALOG_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  }, { merge: true })
  return id
}

/** List visus cultivars priklausančius šitai taxon grupei. */
export async function getCultivarsInGroup(groupId) {
  if (!groupId) return []
  try {
    const q = query(collection(db, 'catalog'), where('taxonGroupId', '==', groupId))
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ _id: d.id, ...d.data() }))
  } catch (e) {
    console.warn('[taxonGroups] cultivars query failed:', e)
    return []
  }
}

// ── Merge logic — series + cultivar → flat plant ─────────────────────
//
// User'is mato „augalą", o ne „cultivar + jo series". DB normalized,
// bet UI'us gauna merged objektą. Cultivar `overrides` turi PRIORITETĄ
// per series defaults.

/**
 * mergeWithSeries(cultivarDoc, taxonGroupDoc) → merged plant object
 *
 * Cultivar fields'ai (latinName, ltName, distinguishingFeature, image, bloom)
 * always win. Care info pildoma iš series, NEBENT cultivar.overrides turi
 * tą field'ą.
 */
export function mergeWithSeries(cultivar, group) {
  if (!cultivar) return null
  if (!group) return cultivar  // standalone — flat behavior

  const { overrides = {}, ...cultivarOwn } = cultivar
  const groupCare    = group.careInfo ?? {}
  const groupSavybes = group.savybes ?? {}

  return {
    // Series-level fields (paveldėti)
    tipas:              group.tipas,
    augimo_greitis:     group.augimo_greitis,
    sunkumas:           group.sunkumas,
    kilme:              group.kilme,
    aprasymas:          group.aprasymas,
    idomybes:           group.idomybes,
    dauginimas:         group.dauginimas,
    problemos:          group.problemos,
    cultivationContext: group.cultivationContext,
    lifecycle:          group.lifecycle,
    hardiness:          group.hardiness,

    // Care info (merge: series defaults + cultivar overrides)
    sviesa:       overrides.sviesa       ?? groupCare.sviesa,
    vanduo:       overrides.vanduo       ?? groupCare.vanduo,
    substratas:   overrides.substratas   ?? groupCare.substratas,
    persodinimas: overrides.persodinimas ?? groupCare.persodinimas,
    ziemojimas:   overrides.ziemojimas   ?? groupCare.ziemojimas,
    tresimas:     overrides.tresimas     ?? groupCare.tresimas,
    laistymasIntervalas: overrides.laistymasIntervalas ?? groupCare.laistymasIntervalas,
    prieziura:    overrides.prieziura    ?? groupCare.prieziura,

    // Savybes (genus chemistry → paveldima)
    savybes:      overrides.savybes      ?? groupSavybes,
    toksiskas:    overrides.toksiskas    ?? groupSavybes.pavojingumas?.yra ?? false,

    // Cultivar own fields (always)
    ...cultivarOwn,

    // Synonyms composition — sujungiam visus alternative names į vieną
    // sąrašą, kad PlantDetail „Taip pat:" sekcija parodytų pilną info:
    //   - cultivar.sinonimai (jei iš ankstesnio AI save'o)
    //   - group.aliases (pvz. „Boulevard®", „Evison Boulevard")
    //   - cultivar.registeredAs (pvz. „EVIPO006" patent kodas)
    // Dedupe'inam + filtruojam null/tuščius.
    sinonimai: [
      ...(cultivarOwn.sinonimai ?? []),
      ...(group.aliases ?? []),
      cultivarOwn.registeredAs,
    ]
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i),

    // Provenance — kad UI'as galėtų rodyti „Iš serijos Boulevard"
    _seriesId:   group.id,
    _seriesName: group.name,
    _seriesType: group.type,
  }
}
