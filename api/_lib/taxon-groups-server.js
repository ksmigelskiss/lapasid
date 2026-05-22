/**
 * Server-side taxonGroups operations — mirror'as src/utils/taxonGroups.js'o,
 * BET naudoja Firebase Admin SDK.
 *
 * ARCHITECTURE NOTE: Pure ID derivation gyvena src/utils/taxonGroupId.js'e
 * (no Firebase deps). Import'iname jį tiesiogiai — ID generation logic'a
 * IDENTIŠKA tiek client, tiek server.
 *
 * BEHAVIORAL CONTRACT (mirror su src/utils/taxonGroups.js):
 *   • saveTaxonGroup → admin set'as su CATALOG_SCHEMA_VERSION + updatedAt
 *   • getTaxonGroup → admin get'as
 *   • ensureParentTaxonGroup → idempotent get-or-create, same field mapping
 *   • saveCatalogWithParent → same orchestration logic
 */
import { adminFirestore } from './firestore-admin.js'
import { saveToCatalogServer } from './catalog-server.js'
import { parseLatinName } from '../../src/utils/latinName.js'
import { taxonGroupDocId, parentTaxonGroupIdFor } from '../../src/utils/taxonGroupId.js'

// MIRROR src/utils/taxonGroups.js CATALOG_SCHEMA_VERSION
const CATALOG_SCHEMA_VERSION = 2

/** MIRROR src/utils/taxonGroups.js getTaxonGroup(). */
export async function getTaxonGroupServer(groupId) {
  if (!groupId) return null
  try {
    const snap = await adminFirestore().collection('taxonGroups').doc(groupId).get()
    return snap.exists ? { id: snap.id, ...snap.data() } : null
  } catch (e) {
    console.warn('[taxonGroups-server] get failed:', groupId, e?.message)
    return null
  }
}

/** MIRROR src/utils/taxonGroups.js saveTaxonGroup() — Admin SDK variant. */
export async function saveTaxonGroupServer(group) {
  if (!group?.id) throw new Error('taxonGroup.id required')
  const { id, ...rest } = group
  await adminFirestore().collection('taxonGroups').doc(id).set({
    ...rest,
    schemaVersion: CATALOG_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  }, { merge: true })
  return id
}

/**
 * MIRROR src/utils/taxonGroups.js ensureParentTaxonGroup() — get-or-create
 * parent taxonGroup'as cultivar'ui. Idempotent.
 *
 * @returns {Promise<string|null>} taxonGroup'o ID arba null
 */
export async function ensureParentTaxonGroupServer(aiResult) {
  const latin = aiResult?.latinName ?? aiResult?.lotyniskas
  if (!latin) return null
  const parsed = parseLatinName(latin)
  if (!parsed.genus) return null

  const isSubSpecific = ['cultivar', 'variety', 'subspecies', 'forma'].includes(parsed.rank)
  if (!isSubSpecific) return null

  let parentType, parentName
  if (parsed.species) {
    parentType = 'species'
    parentName = parsed.species
  } else {
    parentType = 'genus-care'
    parentName = parsed.genus
  }

  const groupId = taxonGroupDocId({ genus: parsed.genus, name: parentName, type: parentType })
  if (!groupId) return null

  // Idempotent check
  const existing = await getTaxonGroupServer(groupId)
  if (existing) return groupId

  // Care info — same field mapping kaip client side
  const careInfo = {}
  if (aiResult.sviesa)              careInfo.sviesa              = aiResult.sviesa
  if (aiResult.vanduo)              careInfo.vanduo              = aiResult.vanduo
  if (aiResult.substratas)          careInfo.substratas          = aiResult.substratas
  if (aiResult.persodinimas)        careInfo.persodinimas        = aiResult.persodinimas
  if (aiResult.ziemojimas)          careInfo.ziemojimas          = aiResult.ziemojimas
  if (aiResult.tresimas)            careInfo.tresimas            = aiResult.tresimas
  if (aiResult.laistymasIntervalas) careInfo.laistymasIntervalas = aiResult.laistymasIntervalas
  if (aiResult.prieziura)           careInfo.prieziura           = aiResult.prieziura

  const scientificName = parentType === 'species'
    ? `${parsed.genus} ${parsed.species}`
    : parsed.genus

  await saveTaxonGroupServer({
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
    createdFrom:        parentType === 'species' ? 'cultivar-save' : 'cultivar-save-genus-fallback',
    verificationStatus: aiResult.aiConfidence === 'high' ? 'auto-verified' : 'unverified',
    aiVerifiedAt:       new Date().toISOString(),
  })
  return groupId
}

/**
 * MIRROR src/utils/taxonGroups.js saveCatalogWithParent() — main orchestrator.
 *
 * Algoritmas (identical su client side):
 *   1. Jei plant'as yra cultivar/variety/subspecies/forma:
 *      - Set'inam taxonGroupId į parent ID (jei dar nesietas)
 *   2. Jei plant'as turi pilną care info (laistymasIntervalas != null):
 *      - ensureParentTaxonGroup idempotent'iškai
 *   3. saveToCatalogServer cultivar'ą
 */
export async function saveCatalogWithParentServer(plant) {
  if (!plant?.lotyniskas) return saveToCatalogServer(plant)

  // Set parent pointer jei cultivar'as dar nesietas
  let updated = plant
  if (!plant.taxonGroupId) {
    const parentId = parentTaxonGroupIdFor(plant.lotyniskas)
    if (parentId) updated = { ...plant, taxonGroupId: parentId }
  }

  // ensureParentTaxonGroup jei pilna care info
  if (plant.laistymasIntervalas) {
    try {
      await ensureParentTaxonGroupServer(plant)
    } catch (e) {
      console.warn('[taxonGroups-server] ensureParentTaxonGroup failed (non-fatal):', e?.message ?? e)
    }
  }

  return saveToCatalogServer(updated)
}
