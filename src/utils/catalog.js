import { doc, getDoc, setDoc, getDocs, collection, query, limit } from 'firebase/firestore'
import { db } from './firebase'
import { plantFuzzyScore } from './fuzzySearch'

// Asmeniniai laukai — nekaupiami kataloge
const PERSONAL_FIELDS = new Set([
  'id', 'kategorija', 'komentaras', 'uzrasai', 'data_prideta', 'status',
  'timeline', 'chat', 'zonaId', 'pirkinys', 'diedDate', 'deathReason',
  'lesson', 'useHistoryPhoto', 'photos',
  // 'image' čia NĖRA — iNaturalist URL yra rūšinis, ne asmeninis; saugomas kataloge kaip referenceImage
])

/** Normalizuotas lotyniškas pavadinimas → Firestore docId.
 *
 * SVARBU: cultivar'ai IŠLAIKOMI (anksčiau buvo strip'inami, bet tai reiškė,
 * kad „Clematis 'Boulevard Vicki'" ir „Clematis 'Boulevard Crystal Fountain'"
 * mapuodavosi į tą patį `clematis` docId — visiškai skirtingi augalai
 * susijungdavo į vieną catalog entry). Dabar quotes pašalinamos, bet
 * cultivar tekstas išlaikomas ID'e.
 *
 * Pavyzdžiai:
 *   Clematis 'Boulevard Vicki'   → clematis_boulevard_vicki
 *   Clematis Boulevard Vicki     → clematis_boulevard_vicki  (be quotes — tas pats)
 *   Codiaeum variegatum          → codiaeum_variegatum
 */
export function catalogDocId(lotyniskas) {
  if (!lotyniskas) return null
  return lotyniskas
    .toLowerCase()
    .replace(/['"]/g, '')          // tik quotes pašalinam, cultivar tekstas lieka
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 100)
}

/** Ar nuotrauka yra viešas rūšinis šaltinis (iNaturalist / Wikimedia), ne asmeninė */
function isPublicPhoto(url) {
  if (!url || typeof url !== 'string') return false
  return url.startsWith('https://static.inaturalist') ||
         url.startsWith('https://inaturalist-open-data') ||
         url.startsWith('https://upload.wikimedia') ||
         url.startsWith('https://photos.inaturalist')
}

/** Iš augalo objekto paliekame tik rūšiniai (ne asmeniniai) laukai */
export function toCatalogEntry(plant) {
  const entry = Object.fromEntries(
    Object.entries(plant).filter(([k, v]) => !PERSONAL_FIELDS.has(k) && v != null)
  )
  // image: saugome tik jei viešas rūšinis URL — ne Firebase Storage (asmeninė nuotrauka)
  if (plant.image && isPublicPhoto(plant.image)) entry.image = plant.image
  return entry
}

/** Nuskaito katalogo įrašą. Grąžina null jei nerasta arba klaida. */
export async function getCatalogEntry(lotyniskas) {
  const id = catalogDocId(lotyniskas)
  if (!id) return null
  try {
    const snap = await getDoc(doc(db, 'catalog', id))
    return snap.exists() ? snap.data() : null
  } catch {
    return null
  }
}

// ── Bendrosios bibliotekos search'as ─────────────────────────────────
// Visi catalog/ docs fetch'inami vienąkart per sesiją + 24h localStorage
// cache'as. Client-side filter'is per visus name field'us (lotyniskas,
// lietuviškas, sinonimai, englishNames). v1 implementacija — kai catalog
// peraugs ~1000 įrašų, reikės server-side searchTerms index'o.
let _catalogMem = null
let _catalogMemAt = 0
const CATALOG_TTL    = 24 * 60 * 60 * 1000 // 24h
const CATALOG_LIMIT  = 500                  // hard limit per fetch
const CATALOG_CACHE_KEY = 'catalog-cache-v1'

async function loadAllCatalog() {
  // 1) in-memory cache (per session)
  if (_catalogMem && Date.now() - _catalogMemAt < CATALOG_TTL) return _catalogMem

  // 2) localStorage cache (cross-session, 24h)
  try {
    const raw = localStorage.getItem(CATALOG_CACHE_KEY)
    if (raw) {
      const { data, at } = JSON.parse(raw)
      if (Array.isArray(data) && Date.now() - at < CATALOG_TTL) {
        _catalogMem = data
        _catalogMemAt = at
        return data
      }
    }
  } catch {}

  // 3) fresh fetch — full collection (limited)
  try {
    const snap = await getDocs(query(collection(db, 'catalog'), limit(CATALOG_LIMIT)))
    const data = snap.docs.map(d => ({ ...d.data(), _id: d.id }))
    _catalogMem = data
    _catalogMemAt = Date.now()
    try { localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ data, at: _catalogMemAt })) } catch {}
    return data
  } catch (e) {
    console.warn('[catalog] load failed:', e)
    return []
  }
}

/**
 * searchCatalog(query, excludeDocIds)
 *   query         — search string (≥2 chars)
 *   excludeDocIds — Set of catalogDocId'ų jau esančių vartotojo bibliotekoje
 *
 * Grąžina iki 6 catalog entry'ų su `_id` field'u (catalogDocId).
 */
export async function searchCatalog(q, excludeDocIds = new Set()) {
  const trimmed = q?.trim()
  if (!trimmed || trimmed.length < 2) return []
  const all = await loadAllCatalog()
  // Fuzzy match'as su LT diacritic'ais ir typo'ų toleravimu — best score'ai
  // grąžinami pirmiausia. Iki 6 entry'ų (UI limit'as).
  return all
    .filter(p => !excludeDocIds.has(p._id))
    .map(p => ({ entry: p, score: plantFuzzyScore(p, trimmed) }))
    .filter(x => x.score !== Infinity)
    .sort((a, b) => a.score - b.score)
    .slice(0, 6)
    .map(x => x.entry)
}

/**
 * catalogEntryToAIResult — pritaiko catalog entry shape'ą prie AI result
 * shape'o, kad jį būtų galima paduoti į `onAddToWishlist`/`onAddToDashboard`
 * (jie naudoja `fromAIResult`, kuris laukia `name`/`latinName` keys).
 */
export function catalogEntryToAIResult(entry) {
  if (!entry) return null
  return {
    ...entry,
    name:      entry.lietuviškas ?? entry.name ?? '',
    latinName: entry.lotyniskas ?? entry.latinName ?? '',
  }
}

/**
 * Bust'ina catalog cache'ą (in-memory + localStorage). Naudojama, kai admin
 * tiesiogiai save'ina ar trina catalog entry'ius per AdminPanel — `searchCatalog`
 * ir autocomplete'as iškart atspindi naują būklę be 24h laukimo.
 */
export function bustCatalogCache() {
  _catalogMem = null
  _catalogMemAt = 0
  try { localStorage.removeItem(CATALOG_CACHE_KEY) } catch {}
}

/** Išsaugo augalo rūšinius duomenis į katalogą (merge — neperrašo). */
export async function saveToCatalog(plant) {
  const id = catalogDocId(plant.lotyniskas ?? plant.latinName)
  if (!id) return
  const entry = toCatalogEntry(plant)
  if (!Object.keys(entry).length) return
  try {
    await setDoc(
      doc(db, 'catalog', id),
      { ...entry, updatedAt: new Date().toISOString() },
      { merge: true }
    )
    // Cache bust — naujai pridėtas augalas iškart pasimato `searchCatalog'e
    bustCatalogCache()
  } catch (e) {
    console.warn('[catalog] write failed:', e)
  }
}
