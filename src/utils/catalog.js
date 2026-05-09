import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase'

// Asmeniniai laukai — nekaupiami kataloge
const PERSONAL_FIELDS = new Set([
  'id', 'kategorija', 'komentaras', 'uzrasai', 'data_prideta', 'status',
  'timeline', 'chat', 'zonaId', 'pirkinys', 'diedDate', 'deathReason',
  'lesson', 'useHistoryPhoto', 'photos',
  // 'image' čia NĖRA — iNaturalist URL yra rūšinis, ne asmeninis; saugomas kataloge kaip referenceImage
])

/** Normalizuotas lotyniškas pavadinimas → Firestore docId */
export function catalogDocId(lotyniskas) {
  if (!lotyniskas) return null
  return lotyniskas
    .toLowerCase()
    .replace(/\s*'[^']*'/g, '')   // pašaliname kultivaro pavadinimus
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
  } catch (e) {
    console.warn('[catalog] write failed:', e)
  }
}
