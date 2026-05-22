/**
 * Server-side user-plant write + membership check.
 *
 * Used by api/save-plant.js processPlant() — after AI Phase 2 + catalog write,
 * the user's PERSONAL plant doc gets written to:
 *
 *   collections/{colId}/plants/{plantId}
 *
 * SECURITY: Firestore Admin SDK bypasses rules — so we MUST verify uid
 * is a member of colId BEFORE writing. Otherwise a malicious client'as
 * could send `colId: <someone-else's-collection>` and corrupt their data.
 */
import { adminFirestore } from './firestore-admin.js'
import { fromAIResult, stripUndefinedDeep } from '../../src/utils/plantTransform.js'

/**
 * Check if a uid is a member of a collection.
 *
 * MIRROR client'o `(colSnap.data().members ?? []).includes(uid)` pattern'o
 * (žiūr. src/hooks/useAuth.js:90).
 *
 * @returns {Promise<boolean>}
 */
export async function isUidMember(uid, colId) {
  if (!uid || !colId) return false
  try {
    const snap = await adminFirestore().collection('collections').doc(colId).get()
    if (!snap.exists) return false
    const members = snap.data().members ?? []
    return members.includes(uid)
  } catch (e) {
    console.warn('[user-plant-server] isUidMember failed:', e?.message ?? e)
    return false
  }
}

/**
 * Save a user's plant document. Verifies membership first.
 *
 * @param {object} args
 * @param {string} args.uid       — Authenticated user UID
 * @param {string} args.colId     — Target collection
 * @param {string} args.plantId   — Client-generated UUID (idempotent)
 * @param {object} args.aiResult  — Full plant from Phase 2 (catalog+baseResult merged)
 * @param {string} [args.kategorija='auginama'] — auginama | nori | istorija
 *
 * @returns {Promise<{ok: boolean, reason?: string, plantId?: string}>}
 */
export async function saveUserPlantServer({ uid, colId, plantId, aiResult, kategorija = 'auginama' }) {
  if (!uid || !colId || !plantId)  return { ok: false, reason: 'missing_args' }

  // Security gate — Admin SDK bypasses rules, todėl PRIVALOMA tikrinti
  // membership rankiniu būdu prieš write'ą.
  const allowed = await isUidMember(uid, colId)
  if (!allowed) {
    console.warn('[user-plant-server] uid not in collection.members', { uid, colId })
    return { ok: false, reason: 'not_member' }
  }

  // fromAIResult — pure function (src/utils/plantTransform.js). Mirror'as
  // client'o usePlants.addToDashboard logikai: plant = { ...fromAIResult(aiResult), kategorija }
  const plant = {
    ...fromAIResult(aiResult),
    id: plantId,           // override — client'as davė plantId, naudojam jį
    kategorija,
  }
  const clean = stripUndefinedDeep(plant)

  try {
    await adminFirestore()
      .collection('collections').doc(colId)
      .collection('plants').doc(plantId)
      .set(clean, { merge: false })
    return { ok: true, plantId }
  } catch (e) {
    console.warn('[user-plant-server] write failed:', plantId, e?.message)
    return { ok: false, reason: 'firestore_error', error: e?.message }
  }
}
