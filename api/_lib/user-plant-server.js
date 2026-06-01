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

// MIRROR src/utils/catalog.js PERSONAL_FIELDS — laukai, kurie priklauso
// vartotojo personal state'ui ir NIEKADA neperrašomi per server-side AI
// merge'ą. fromAIResult grąžina defaults šitiem laukam (status='healthy',
// komentaras='', data_prideta=today, photos=AI photos), bet tai INITIAL
// save default'ai — RE-ENRICH atveju jie perrašytų user'io state'ą.
//
// 2026-06-01 bug fix: re-enrich Karantinas plant'ą → status'as resetinosi
// į 'healthy' → plant'as dingdavo iš Karantinas Dashboard sekcijos. Žr.
// tasks/lessons.md.
//
// `id` ir `kategorija` strip'inami iš fromAIResult, paskui caller'is explicit
// pri-set'ina abu (id=plantId, kategorija=arg). Visi kiti personal field'ai
// strip'inami visam laikui (catalog merge nelies user state'o).
const PERSONAL_STATE_FIELDS = new Set([
  'status', 'komentaras', 'uzrasai', 'data_prideta',
  'timeline', 'chat', 'zonaId', 'pirkinys', 'diedDate', 'deathReason',
  'lesson', 'useHistoryPhoto', 'photos',
])

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
  //
  // 2026-06-01 — STRIP personal state laukai PRIEŠ merge'ą. fromAIResult
  // hardcodina INITIAL save defaults (status='healthy', komentaras='',
  // data_prideta=today, photos=AI photos). Initial save'ui — OK, nes client
  // pirmasis rašo tuos pačius defaults. RE-ENRICH atveju — bug: defaults'ai
  // perrašytų user'io 'quarantine' status'ą, komentarus, original date'ą,
  // accumulated photos. Strip'inam viską, kas yra PERSONAL_STATE_FIELDS
  // sąraše — initial save'as kompensuojamas client'o pre-write'u, re-enrich
  // saugiai išsaugo user'io state'ą.
  const aiPlant = fromAIResult(aiResult)
  for (const k of PERSONAL_STATE_FIELDS) {
    delete aiPlant[k]
  }
  const plant = {
    ...aiPlant,
    id: plantId,           // override — client'as davė plantId, naudojam jį
    kategorija,
  }
  const clean = stripUndefinedDeep(plant)

  try {
    // merge:true — DUAL-WRITE pattern (Variant B). Klientas pirmasis rašo
    // slim baseResult doc'ą per Firebase JS SDK (kategorija, data_prideta,
    // status, timeline ir kt. personal field'ai). Server'is enrich'ina
    // AI Phase 2 care info — kad NEPAlaužtų client'o personal field'ų,
    // merge'inam, ne overwrite'inam.
    //
    // Jei kuris field'as konfliktuoja (e.g. lotyniskas), server'is laimi
    // (jis vėliau atrašytas). Bet šituose lauke server'is grąžina TĄ PATĮ
    // value (canonical iš `latinName` param'o), todėl konflikto faktiškai nėra.
    await adminFirestore()
      .collection('collections').doc(colId)
      .collection('plants').doc(plantId)
      .set(clean, { merge: true })
    return { ok: true, plantId }
  } catch (e) {
    console.warn('[user-plant-server] write failed:', plantId, e?.message)
    return { ok: false, reason: 'firestore_error', error: e?.message }
  }
}
