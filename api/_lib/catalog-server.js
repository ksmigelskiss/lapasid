/**
 * Server-side catalog operations — mirror'as src/utils/catalog.js'o, BET
 * naudoja Firebase Admin SDK vietoj Firebase JS SDK.
 *
 * KODĖL: client'as naudoja Firebase JS SDK (auth context'as iš
 * currentUser), server'is naudoja Admin SDK (full access per service
 * account). Negalim share'inti to paties code path'o, BET ABU TURI
 * GRĄŽINTI/RAŠYTI tą patį Firestore doc shape'ą.
 *
 * BEHAVIORAL CONTRACT (svarbu išlaikyti su src/utils/catalog.js):
 *   • catalogDocId() — TIKSLIAI tas pats slug formatas
 *   • toCatalogEntry() — TIKSLIAI tas pats PERSONAL_FIELDS filter
 *   • saveToCatalog() — merge: true, su stripUndefinedDeep + updatedAt
 *   • isPublicPhoto() — TIKSLIAI tas pats whitelist
 *
 * Jei client'as ir server'is skirsis šituose detaliuose — catalog data
 * inconsistency'ai → bug'ai užimanti dienas.
 */
import { adminFirestore } from './firestore-admin.js'
import { stripUndefinedDeep } from '../../src/utils/plantTransform.js'

// MIRROR src/utils/catalog.js PERSONAL_FIELDS — Asmeniniai laukai
// nekaupiami kataloge (rūšinis vs asmeninis split'as).
const PERSONAL_FIELDS = new Set([
  'id', 'kategorija', 'komentaras', 'uzrasai', 'data_prideta', 'status',
  'timeline', 'chat', 'zonaId', 'pirkinys', 'diedDate', 'deathReason',
  'lesson', 'useHistoryPhoto', 'photos',
  // Step 6g — enrichment lifecycle markers (per-user)
  'enrichmentStartedAt', 'phase2CompletedAt', 'enrichmentError',
  // 'image' čia NĖRA — iNaturalist URL yra rūšinis
])

/** MIRROR src/utils/catalog.js catalogDocId() — same slug format. */
export function catalogDocId(lotyniskas) {
  if (!lotyniskas) return null
  return lotyniskas
    .toLowerCase()
    .replace(/['"]/g, '')           // tik quotes pašalinam, cultivar tekstas lieka
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 100)
}

/** MIRROR src/utils/catalog.js isPublicPhoto() — same whitelist. */
function isPublicPhoto(url) {
  if (!url || typeof url !== 'string') return false
  return url.startsWith('https://static.inaturalist') ||
         url.startsWith('https://inaturalist-open-data') ||
         url.startsWith('https://upload.wikimedia') ||
         url.startsWith('https://photos.inaturalist') ||
         url.startsWith('https://storage.googleapis.com/geliu-db') ||
         url.startsWith('https://firebasestorage.googleapis.com/v0/b/geliu-db')
}

/** MIRROR src/utils/catalog.js toCatalogEntry() — filter personal fields. */
export function toCatalogEntry(plant) {
  const entry = Object.fromEntries(
    Object.entries(plant).filter(([k, v]) => !PERSONAL_FIELDS.has(k) && v != null)
  )
  if (plant.image && isPublicPhoto(plant.image)) entry.image = plant.image
  return entry
}

/** Server-side catalog GET — naudojama processPlant() pre-flight check'ams. */
export async function getCatalogEntryServer(latinName) {
  const id = catalogDocId(latinName)
  if (!id) return null
  try {
    const snap = await adminFirestore().collection('catalog').doc(id).get()
    return snap.exists ? snap.data() : null
  } catch (e) {
    console.warn('[catalog-server] get failed:', latinName, e?.message)
    return null
  }
}

/**
 * MIRROR src/utils/catalog.js saveToCatalog() — Firebase Admin variant.
 *
 * KEY DIFFERENCES vs client:
 *   • adminFirestore() instead of `db` (client-side Firestore SDK)
 *   • Admin SDK `.set()` vs client SDK `setDoc()` — same `{ merge: true }` semantics
 *   • NO bustCatalogCache() — server side has no local cache
 *
 * SAUGOJIMAS:
 *   • stripUndefinedDeep PRIES write (apsaugo nuo nested undefined crash'o)
 *   • updatedAt timestamp pridedamas
 *   • catalogDocId() iš lotyniskas (consistent su client side)
 */
export async function saveToCatalogServer(plant) {
  const id = catalogDocId(plant.lotyniskas ?? plant.latinName)
  if (!id) return { ok: false, reason: 'no_id' }
  const entry = toCatalogEntry(plant)
  if (!Object.keys(entry).length) return { ok: false, reason: 'empty_entry' }

  // Step 6t — CATALOG IMAGE FREEZE po pirmojo save'o.
  // PRIES: kiekvienas re-enrich + user'io plant.image pakeitimas (custom upload)
  //        perrašydavo catalog.image. Tas darė silent drift: per kelis re-enrich
  //        cycles catalog'as galiausiai turėdavo USER'io custom foto kaip
  //        global representative — nors architektūriškai catalog turi būti
  //        Stage 1 metu pasirinktas representative shot'as.
  //
  // PO: skaitytojam esamą catalog doc'ą. Jei jau turi image — strip'iname
  //     entry.image prieš merge:true → existing image PRESERVED.
  //     Pirmasis save'as set'ina image (no existing → eina pro). Sekantys
  //     save'ai/re-enrich UPDATE'ina kitus laukus (aprasymas, care, narrative),
  //     BET image lieka frozen.
  //
  // Admin override ateityje (AdminPanel'is) galės eksplicitiškai pakeisti
  // catalog.image be šitos restriction'os (admin SDK direct write).
  try {
    const existingDoc = await adminFirestore().collection('catalog').doc(id).get()
    if (existingDoc.exists && existingDoc.data().image) {
      delete entry.image
      console.log('[catalog-server] image freeze — existing preserved', id)
    }
  } catch (e) {
    console.warn('[catalog-server] freeze check failed (continuing):', e?.message)
  }

  const clean = stripUndefinedDeep({ ...entry, updatedAt: new Date().toISOString() })
  try {
    await adminFirestore().collection('catalog').doc(id).set(clean, { merge: true })
    return { ok: true, id }
  } catch (e) {
    console.warn('[catalog-server] save failed:', id, e?.message)
    return { ok: false, reason: 'firestore_error', error: e?.message }
  }
}
