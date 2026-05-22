/**
 * Server-side user plant write — mirror'as client-side usePlants.addToDashboard /
 * addToWishlist behavior'o, BET serveriu per Firebase Admin SDK.
 *
 * KODĖL: kai save-plant.js processPlant() rašo catalog'ą serverside, mums
 * taip pat reikia rašyti user'io kolekciją — kitaip useris save'ina augalą
 * BE Phase 2 detalumo savo bibliotekoje (regression).
 *
 * SECURITY: prieš write'ą verifikuojam, kad uid yra `collections/{colId}.members`.
 * Admin SDK bypass'ina Firestore rules — turim patys patikrinti.
 *
 * SCHEMA: tas pat user plant struct'as kaip client side (per fromAIResult):
 *   • id (klient'as siunčia, UUID)
 *   • kategorija ('auginama' | 'nori')
 *   • data_prideta (ISO date)
 *   • status (default 'sveikas')
 *   • timeline: []
 *   • visi catalog rūšiniai laukai (lotyniskas, lietuviškas, image, savybes, etc.)
 */
import { adminFirestore } from './firestore-admin.js'
import { stripUndefinedDeep } from '../../src/utils/plantTransform.js'

/**
 * Verifikuoja, kad user uid yra collection'os members. Apsauga prieš
 * malicious POST requests, kur uid bandys rašyti į kitokias collections.
 */
async function isUidMember(uid, colId) {
  if (!uid || !colId) return false
  try {
    const snap = await adminFirestore().collection('collections').doc(colId).get()
    if (!snap.exists) return false
    const data = snap.data()
    return Array.isArray(data?.members) && data.members.includes(uid)
  } catch (e) {
    console.warn('[user-plant-server] members check failed:', e?.message)
    return false
  }
}

/**
 * Build user plant doc'as iš fullPlant data + asmeninių laukų.
 * Mirror'as src/hooks/usePlants.js addToWishlist/addToDashboard logikos:
 *   { ...fromAIResult(aiResult), kategorija }
 *
 * fromAIResult yra didelis client-side function'as (~80 eil.) su normalize
 * logika. Server-side: duomenys jau normalize'inti per Phase 2 processPlant
 * (normalizeAIResponse + stripUndefinedDeep). Tiesiog merge'inam asmeninius
 * laukus prie fullPlant'o.
 */
function buildUserPlantDoc({ fullPlant, plantId, kategorija }) {
  const todayISO = new Date().toISOString().slice(0, 10)
  return stripUndefinedDeep({
    ...fullPlant,
    id: plantId,
    kategorija: kategorija ?? 'auginama',
    data_prideta: todayISO,
    status: 'sveikas',
    timeline: [],
    komentaras: '',
    uzrasai: '',
    chat: [],
  })
}

/**
 * Pagrindinis API: rašom user plant'ą per Admin SDK.
 *
 * @param {object} opts
 * @param {string} opts.uid         - User ID (auth verification)
 * @param {string} opts.colId       - Target collection ID
 * @param {string} opts.plantId     - Plant doc ID (UUID iš kliento)
 * @param {object} opts.fullPlant   - Full plant data (po Phase 2 enrichment)
 * @param {string} opts.kategorija  - 'auginama' arba 'nori'
 * @returns {Promise<{ok, reason?}>}
 */
export async function saveUserPlantServer({ uid, colId, plantId, fullPlant, kategorija }) {
  if (!uid || !colId || !plantId) {
    return { ok: false, reason: 'missing_required_params' }
  }
  const isMember = await isUidMember(uid, colId)
  if (!isMember) {
    return { ok: false, reason: 'not_collection_member' }
  }

  const userPlant = buildUserPlantDoc({ fullPlant, plantId, kategorija })

  try {
    await adminFirestore()
      .collection('collections').doc(colId)
      .collection('plants').doc(plantId)
      .set(userPlant, { merge: false })   // merge:false — full overwrite preliminary doc
    return { ok: true, plantId }
  } catch (e) {
    console.warn('[user-plant-server] write failed:', plantId, e?.message)
    return { ok: false, reason: 'firestore_error', error: e?.message }
  }
}
