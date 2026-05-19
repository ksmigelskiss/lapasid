import { doc, getDoc, setDoc, getDocs, collection, query, where, deleteDoc } from 'firebase/firestore'
import { db } from './firebase'
import { parseLatinName, speciesPortion } from './latinName'
import { saveToCatalog } from './catalog'
import { TAXON_GROUP_TYPES, taxonGroupDocId, parentTaxonGroupIdFor } from './taxonGroupId'

// Re-eksport'inam iš pure modulio — esamas call site'ams nesulūžo.
// Pure ID derivation gyvena taxonGroupId.js'e, kad Node-side test'ai
// galėtų importuoti be Firebase init'inimo.
export { TAXON_GROUP_TYPES, taxonGroupDocId, parentTaxonGroupIdFor }

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

// ── ID generation — pure logika gyvena taxonGroupId.js'e (re-exported above) ──

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

// ── Parent species taxonGroup orchestration ──────────────────────────
//
// Klausimas: kai vartotojas išsaugo cultivar'ą, kur eina species-lygio
// care/savybes/aprašymo info? Atsakymas — į **parent species taxonGroup'ą**.
// Kultivaras saugo TIK savo unikalius laukus (image, ltName cultivar
// dalies, distinguishingFeature, bloom info, overrides). Visa kita
// paveldima per `mergeWithSeries()`.
//
// Šitas helper'is užtikrina: jei rūšies taxonGroup'as egzistuoja, gražinam
// jo ID; jei ne, sukuriame jį iš AI duomenų ir grąžinam. Idempotent —
// kviest galima saugiai kelis kartus.

/**
 * speciesTaxonGroupId(latinName) — sugeneruoja stabilų ID parent species
 * taxonGroup'ui iš pilno latin name'o.
 *
 *   „Dionaea muscipula 'Akai Ryu'" → „dionaea-muscipula"
 *   „Dionaea muscipula"            → „dionaea-muscipula"
 *   „Rosa 'Knock Out'"             → null  (nėra species — Rosa gentis only)
 *
 * Grąžina null jei genus+species komponentų nepakanka.
 */
export function speciesTaxonGroupId(latinName) {
  const parsed = parseLatinName(latinName)
  const sp = speciesPortion(parsed)
  if (!sp) return null
  return taxonGroupDocId({ genus: parsed.genus, name: parsed.species, type: 'species' })
}

/**
 * ensureParentTaxonGroup(aiResult) — get-or-create parent taxonGroup'as
 * cultivar'ui. Idempotent. Atskiria du atvejus:
 *
 *   1. SPECIES PARENT — kai latinName turi tiek genus, tiek species
 *      („Dionaea muscipula 'Akai Ryu'"). Sukuriam type='species'
 *      taxonGroup'ą su species-level care info.
 *
 *   2. GENUS-CARE PARENT — kai latinName turi tik genus + cultivar
 *      („Hosta 'Patriot'", „Rosa Knock Out", „Clematis Boulevard").
 *      Tai ICNCP standartinis atvejis cultivar'ams be priskirtos rūšies.
 *      Sukuriam type='genus-care' taxonGroup'ą su genties lygio care
 *      info — vis tiek paveldima per mergeWithSeries, tiesiog platesnis
 *      lygmuo.
 *
 *   3. NĖRA PARENT — kai entry'is yra species ar genus pats (nebe
 *      cultivar) — grąžinam null, nieko nedarom.
 *
 * @param {object} aiResult — pilnas AI rezultatas (po enrich + fetchDetails).
 * @returns {Promise<string|null>} — sukurto/esamo taxonGroup'o ID, arba null.
 */
export async function ensureParentTaxonGroup(aiResult) {
  // Latin pavadinimo lookup'as palaiko abu naming convention'us:
  //   - latinName  (AI rezultatas iš plant_preview tool'o)
  //   - lotyniskas (catalog field'as po fromAIResult / save flow)
  // Tai svarbu — fetchDetails save'as paduoda `lotyniskas`, o SLIM auto-save
  // paduoda abu per `...aiResult` spread'ą. Anksčiau buvo silent fail.
  const latin = aiResult?.latinName ?? aiResult?.lotyniskas
  if (!latin) return null
  const parsed = parseLatinName(latin)
  if (!parsed.genus) return null

  // Decide parent rank. Entry rangas turi būti cultivar/variety/subspecies/forma
  // kad būtų prasmė kurti parent'ą.
  const isSubSpecific = ['cultivar', 'variety', 'subspecies', 'forma'].includes(parsed.rank)
  if (!isSubSpecific) return null  // entry yra pačios rūšies ar genties lygyje — neturi parent'o

  let parentType, parentName
  if (parsed.species) {
    // Species parent — geriausias atvejis. Care info specifiškas rūšiai.
    parentType = 'species'
    parentName = parsed.species
  } else {
    // Genus-care parent — fallback'as kai species nežinia. Care info
    // genties lygyje, kuris vis tiek tinka cultivar'ams be priskirtos rūšies.
    parentType = 'genus-care'
    parentName = parsed.genus
  }

  const groupId = taxonGroupDocId({ genus: parsed.genus, name: parentName, type: parentType })
  if (!groupId) return null

  // Patikrinam ar jau egzistuoja — idempotent.
  const existing = await getTaxonGroup(groupId)
  if (existing) return groupId

  // Surenkam care info'ą į vieną sub-object'ą (taxonGroup schema sako
  // `careInfo: {}` — UI'as gauna iš jo per mergeWithSeries).
  const careInfo = {}
  if (aiResult.sviesa)              careInfo.sviesa              = aiResult.sviesa
  if (aiResult.vanduo)              careInfo.vanduo              = aiResult.vanduo
  if (aiResult.substratas)          careInfo.substratas          = aiResult.substratas
  if (aiResult.persodinimas)        careInfo.persodinimas        = aiResult.persodinimas
  if (aiResult.ziemojimas)          careInfo.ziemojimas          = aiResult.ziemojimas
  if (aiResult.tresimas)            careInfo.tresimas            = aiResult.tresimas
  if (aiResult.laistymasIntervalas) careInfo.laistymasIntervalas = aiResult.laistymasIntervalas
  if (aiResult.prieziura)           careInfo.prieziura           = aiResult.prieziura

  // scientificName — pilnas binomial jei species, tik genus jei genus-care.
  const scientificName = parentType === 'species'
    ? `${parsed.genus} ${parsed.species}`
    : parsed.genus

  await saveTaxonGroup({
    id:                 groupId,
    type:               parentType,
    genus:              parsed.genus,
    name:               parentName,
    scientificName,
    aprasymas:          aiResult.aprasymas ?? null,
    kilme:              aiResult.kilme ?? null,
    tipas:              aiResult.tipas ?? null,
    augimo_greitis:     aiResult.augimo_greitis ?? null,
    sunkumas:           aiResult.sunkumas ?? null,
    careInfo,
    savybes:            aiResult.savybes ?? {},
    idomybes:           Array.isArray(aiResult.idomybes)  ? aiResult.idomybes  : [],
    dauginimas:         Array.isArray(aiResult.dauginimas) ? aiResult.dauginimas : [],
    problemos:          Array.isArray(aiResult.problemos)  ? aiResult.problemos  : [],
    sources:            Array.isArray(aiResult.sources)    ? aiResult.sources    : [],
    // Provenance — žinom, ar parent'as sukurtas kaip species ar genus-care,
    // ir kad jis ateina iš cultivar save'o (ne tiesioginio admin'o input'o).
    createdFrom:        parentType === 'species' ? 'cultivar-save' : 'cultivar-save-genus-fallback',
    verificationStatus: aiResult.aiConfidence === 'high' ? 'auto-verified' : 'unverified',
    aiVerifiedAt:       new Date().toISOString(),
  })
  return groupId
}

// Backward-compat alias — kol kas dar paliekam, kad esami caller'iai
// nesulūžtu. Galima ištrinti po migration'o.
export const ensureSpeciesTaxonGroup = ensureParentTaxonGroup

/**
 * saveCatalogWithParent(plant) — pagrindinis save'as catalog'ui + parent
 * taxonGroup orchestration. Naudojamas vietoj tiesioginio saveToCatalog
 * visur, kur saugomi AI rezultatai.
 *
 * Algoritmas:
 *   1. Parse'inam latinName.
 *   2. Jei plant'as yra cultivar/variety/subspecies/forma:
 *      - Jei jis dar neturi taxonGroupId — set'inam į parent ID
 *        (species jei žinom rūšį, kitaip genus-care). Deterministic.
 *        Jei plant'as jau turi taxonGroupId (per bulk_series → serija),
 *        nepakeičiam — serija turi pirmenybę.
 *   3. Jei plant'as turi pilną care info (laistymasIntervalas != null) —
 *      iškviečiam ensureParentTaxonGroup, kuris idempotent'iškai užtikrina,
 *      kad parent doc'as egzistuoja su default'ais iš to paties AI rezultato.
 *   4. Save'ina cultivar'ą į catalog'ą.
 *
 * NESTRIPINAM care info iš cultivar entry — paliekam defensyviai. Jei parent
 * doc'as išnyks, mergeWithSeries fallback'ins į cultivar'o pačius field'us.
 *
 * @param {object} plant — augalo objektas (po fromAIResult arba tiesiai iš AI).
 * @returns {Promise<void>}
 */
export async function saveCatalogWithParent(plant) {
  if (!plant?.lotyniskas) return saveToCatalog(plant)

  // Array normalize'inimas atliekamas UPSTREAM'e — fetchDetails po AI atsako
  // kviečia normalizeAIResponse. Čia tikimės jau švarių array laukų.
  // Defensive — bet nenormalize'inam (DRY su plantTransform.normalizeAIResponse).

  // Set parent pointer jei cultivar'as dar nesusietas su jokia grupe.
  // Bulk_series flow'as set'ina taxonGroupId į series ID — nepakeičiam jo.
  let updated = plant
  if (!plant.taxonGroupId) {
    const parentId = parentTaxonGroupIdFor(plant.lotyniskas)
    if (parentId) updated = { ...plant, taxonGroupId: parentId }
  }

  // Jei turim pilną care info — užtikriname, kad parent doc'as egzistuoja
  // (idempotent). Cultivar gali ateit ir be care info (SLIM auto-save) —
  // tada parent kūrimą atidedam vėlesnėms save iteracijoms.
  if (plant.laistymasIntervalas) {
    try {
      await ensureParentTaxonGroup(plant)
    } catch (e) {
      console.warn('[saveCatalogWithParent] ensureParentTaxonGroup failed (non-fatal):', e?.message ?? e)
    }
  }

  return saveToCatalog(updated)
}

// Backward-compat alias — kol kas dar paliekam, kad esami caller'iai
// nesulūžtu. Galima ištrinti po migration'o.
export const saveCatalogWithSpeciesParent = saveCatalogWithParent

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
