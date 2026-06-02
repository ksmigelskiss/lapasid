import { doc, getDoc, setDoc, getDocs, collection, query, limit, onSnapshot } from 'firebase/firestore'
import { get as idbGet, set as idbSet, del as idbDel, createStore } from 'idb-keyval'
import { db } from './firebase'
import { plantFuzzyScore } from './fuzzySearch'
import { stripUndefinedDeep } from './plantTransform'

// IndexedDB store — viena baze visam catalog cache'ui. Migracija iš
// localStorage'o: pirmą kartą po deploy'o IndexedDB tuščias, fetch'iname
// fresh iš Firestore, rašom į IndexedDB. localStorage'as natūraliai
// pamiršamas (24h TTL nebeperskaitomas). Migration step'as nereikalingas.
//
// Kodėl ne localStorage:
//   • localStorage limit'as ~5-10MB browser'iui. PFAF v4 duos 1500+ entries
//     × ~5KB avg = 7-8MB → quota exceeded, silent fail.
//   • IndexedDB praktiškai be limit'o (~50% disk per origin).
//   • Async API — non-blocking main thread.
// idb-keyval'as = ~600B wrapper'is, paprastas key-value API.
const CATALOG_DB_NAME = 'lapasid-catalog'
const CATALOG_STORE_NAME = 'cache-v1'
const _idbStore = typeof indexedDB !== 'undefined'
  ? createStore(CATALOG_DB_NAME, CATALOG_STORE_NAME)
  : null
const CACHE_KEY = 'all-entries'

// Asmeniniai laukai — nekaupiami kataloge
const PERSONAL_FIELDS = new Set([
  'id', 'kategorija', 'komentaras', 'uzrasai', 'data_prideta', 'status',
  'timeline', 'chat', 'zonaId', 'pirkinys', 'diedDate', 'deathReason',
  'lesson', 'useHistoryPhoto', 'photos',
  // Step 6g — enrichment lifecycle markers (per-user save click tracking,
  // server completion ts, error info) — visi PER-USER, ne global catalog'as
  'enrichmentStartedAt', 'phase2CompletedAt', 'enrichmentError',
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

/** Ar nuotrauka yra viešas rūšinis šaltinis — paliekamas catalog'e.
 *
 * Whitelist'as:
 *  - iNaturalist (originalūs šaltiniai, stabilūs)
 *  - Wikimedia / Wikipedia (originalūs šaltiniai, stabilūs)
 *  - Mūsų Firebase Storage (REHOST'INTOS hero nuotraukos per /api/rehost-image)
 *    Tik mūsų bucket'as (geliu-db), kad neperkėltume kitų projektų URL'us.
 *
 * Anksciau Firebase Storage URL'ai buvo EXCLUDED kaip „asmeninės" — bet po
 * 2026-05 rehost feature'o tai pasikeitė: Storage'as dabar gyvena ir
 * commercial rūšinės hero nuotraukos (Brave → rehost). Update'inta filter
 * logika atspindi naują pažiūrą.
 */
function isPublicPhoto(url) {
  if (!url || typeof url !== 'string') return false
  return url.startsWith('https://static.inaturalist') ||
         url.startsWith('https://inaturalist-open-data') ||
         url.startsWith('https://upload.wikimedia') ||
         url.startsWith('https://photos.inaturalist') ||
         // Mūsų Firebase Storage (rehost'intos hero photos) — abu URL formatai
         url.startsWith('https://storage.googleapis.com/geliu-db') ||
         url.startsWith('https://firebasestorage.googleapis.com/v0/b/geliu-db')
}

/** Iš augalo objekto paliekame tik rūšiniai (ne asmeniniai) laukai */
export function toCatalogEntry(plant) {
  const entry = Object.fromEntries(
    Object.entries(plant).filter(([k, v]) => !PERSONAL_FIELDS.has(k) && v != null)
  )
  // image: saugome tik jei viešas rūšinis URL (iNat, Wikimedia, mūsų Storage).
  // Random commercial URL'ai (paghat.com, etc.) filter'inami — jie nepatikimi
  // catalog'ui (gali sulūžti). User'is gaus rehost'intą URL per SaveButton flow.
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
// Visi catalog/ docs fetch'inami vienąkart per sesiją + 24h IndexedDB
// cache'as. Client-side filter'is per visus name field'us (lotyniskas,
// lietuviškas, sinonimai, englishNames).
//
// Cache architektūra:
//   • _catalogMem      — in-memory (per session, instant)
//   • IndexedDB        — cross-session, ~50% disk per origin (praktiškai
//                        be limit'o), 24h TTL
//   • Firestore        — source of truth, full collection fetch
//
// CATALOG_LIMIT 2000 — buvo 500 dėl localStorage 5-10MB quota'os, IndexedDB
// tos problemos neturi. 2000 entries × ~5KB = ~10MB, fits comfortably.
// Server-side searchTerms index'as reikalingas tik kai > 10K entries.
let _catalogMem = null
let _catalogMemAt = 0
// CATALOG_TTL — 2026-05-27 sutrumpinta nuo 24h iki 1h.
// Anksciau 24h cache'as kelis kartus parodė stale data po server-side batch
// run'ų (admin Biblioteka edit'as iš karto invalidina cache'ą per
// bustCatalogCache(), bet batch'as rašo server-side per Admin SDK — client'as
// apie tai nesužino). User'is matydavo entries be image'ų, nors Firestore'e
// jau buvo. 1h kompromisas: enough to amortize Firestore read'us, bet
// nepakankamai ilgai sukurti aliasing'ą po batch run'o.
const CATALOG_TTL    = 60 * 60 * 1000     // 1h
const CATALOG_LIMIT  = 2000                 // hard limit per fetch

async function loadAllCatalog() {
  // 1) in-memory cache (per session)
  if (_catalogMem && Date.now() - _catalogMemAt < CATALOG_TTL) return _catalogMem

  // 2) IndexedDB cache (cross-session, 24h)
  if (_idbStore) {
    try {
      const cached = await idbGet(CACHE_KEY, _idbStore)
      if (cached && Array.isArray(cached.data) && Date.now() - cached.at < CATALOG_TTL) {
        _catalogMem = cached.data
        _catalogMemAt = cached.at
        return cached.data
      }
    } catch (e) {
      console.warn('[catalog] IndexedDB read failed:', e)
    }
  }

  // 3) fresh fetch — full collection (limited)
  try {
    const snap = await getDocs(query(collection(db, 'catalog'), limit(CATALOG_LIMIT)))
    const data = snap.docs.map(d => ({ ...d.data(), _id: d.id }))
    _catalogMem = data
    _catalogMemAt = Date.now()
    if (_idbStore) {
      // Fire-and-forget — neblokuojam, jei IDB write fail'ina (storage quota?)
      idbSet(CACHE_KEY, { data, at: _catalogMemAt }, _idbStore)
        .catch(e => console.warn('[catalog] IndexedDB write failed:', e))
    }
    return data
  } catch (e) {
    console.warn('[catalog] load failed:', e)
    return []
  }
}

/**
 * searchCatalog(query, excludeDocIds, limit)
 *   query         — search string (≥2 chars)
 *   excludeDocIds — Set of catalogDocId'ų jau esančių vartotojo bibliotekoje
 *   limit         — max returned entries (default 6 — autocomplete UI;
 *                   admin/library-first kviečia su 20+, kad matytum visus
 *                   serijos narius vienu kartu — Boulevard turi 15 cultivars).
 *
 * Grąžina iki `limit` catalog entry'ų su `_id` field'u (catalogDocId).
 */
export async function searchCatalog(q, excludeDocIds = new Set(), limit = 6) {
  const trimmed = q?.trim()
  if (!trimmed || trimmed.length < 2) return []
  const all = await loadAllCatalog()
  // Fuzzy match'as su LT diacritic'ais ir typo'ų toleravimu — best score'ai
  // grąžinami pirmiausia.
  return all
    .filter(p => !excludeDocIds.has(p._id))
    .map(p => ({ entry: p, score: plantFuzzyScore(p, trimmed) }))
    .filter(x => x.score !== Infinity)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map(x => x.entry)
}

// ── Live catalog map (reference modelis — F1) ──────────────────────
//
// `_catalogById` — pilni catalog entry'ai (slug → entry), palaikomi GYVAI per
// onSnapshot(catalog). Serveris/admin parašo → snapshot fire'ina → map update →
// App bump'ina re-render counter'į → display sluoksnis pasiima naują reference
// data akimirksniu. Pakeitė buvusius preload+45s/90s/focus refresh timer'ius.
// Pigu: persistentLocalCache (firebase.js) serve'ina iš IndexedDB + sync'ina
// tik delta'as, ne full collection read per session.
//
// Šis map'as maitina: heroIllustrationFor (watercolor hero) IR resolvePlantView
// (user-plant reference resolve — gyvi augalai rodo live catalog duomenis,
// fallback į inline legacy laukus). Žr. tasks/library-reference-refactor.md.
let _catalogById = {}

/**
 * subscribeCatalog(onChange) — live catalog listener, palaiko _catalogById gyvai.
 * Grąžina unsubscribe. onChange kviečiamas po kiekvieno snapshot'o (App bump'ina
 * re-render counter'į). Mount once App'e.
 */
export function subscribeCatalog(onChange) {
  // 2026-06-02 — bounded retry. Jei subscription error'ina su permission-denied
  // (auth-timing race: catalog rule reikalauja request.auth != null, o auth dar
  // gali nebūti ready net ir po App gate'o — transient propagation), bandom dar
  // kelis kartus su backoff'u vietoj tylaus mirimo. Be šito _catalogById liko
  // tuščias iki page refresh'o (watercolor overlay dingdavo, biblioteka tuščia).
  let unsub = () => {}
  let retryTimer = null
  let attempts = 0
  const MAX_RETRIES = 4

  const start = () => {
    try {
      unsub = onSnapshot(
        collection(db, 'catalog'),
        snap => {
          attempts = 0 // sėkmė → reset retry counter
          const map = {}
          snap.forEach(d => { map[d.id] = { ...d.data(), _id: d.id } })
          _catalogById = map
          onChange?.()
        },
        e => {
          const code = e?.code || e?.message || 'unknown'
          console.warn('[catalog] subscription error:', code)
          if (code === 'permission-denied' && attempts < MAX_RETRIES) {
            attempts++
            const delay = Math.min(1000 * attempts, 4000) // 1s,2s,3s,4s
            console.warn(`[catalog] retry ${attempts}/${MAX_RETRIES} po ${delay}ms`)
            retryTimer = setTimeout(start, delay)
          }
        },
      )
    } catch (e) {
      console.warn('[catalog] subscribe failed:', e?.message)
    }
  }

  start()
  return () => { clearTimeout(retryTimer); unsub() }
}

/** Sync lookup — grąžina watercolor hero URL augalui (arba null). */
export function heroIllustrationFor(lotyniskas) {
  if (!lotyniskas) return null
  const slug = catalogDocId(lotyniskas)
  return slug ? (_catalogById[slug]?.heroIllustration ?? null) : null
}

/**
 * Sync lookup — grąžina watercolor hero THUMB URL (small WebP, widget-optimized).
 * Backward compat: jei thumb neegzistuoja (old entries pre-2026-06-01), fallback
 * į full heroIllustration. UI consumer'iai (PlantCard) gali šitą iškviesti tiesiai
 * be papildomos defensyvinės logikos.
 */
export function heroThumbFor(lotyniskas) {
  if (!lotyniskas) return null
  const slug = catalogDocId(lotyniskas)
  if (!slug) return null
  const entry = _catalogById[slug]
  return entry?.heroThumb ?? entry?.heroIllustration ?? null
}

/**
 * resolvePlantView(plant) — F1 reference resolve. GYVIEMS augalams perdengia
 * rūšinius laukus (vardai, care, toksiškumas, aprašymas…) LIVE catalog reikšmėmis,
 * kad admin/global pataisymai pasiektų esamus augalus iškart. Asmeniniai laukai
 * (PERSONAL_FIELDS) ir display `image` NEPERDENGIAMI — foto logika lieka
 * heroIsDefaultFor/heroIllustrationForPlant rankose.
 *
 * Backward-compat: jei nėra catalog entry (offline cold cache / dar neįrašyta) —
 * grąžinam plant kaip yra (legacy „fat" doc tarnauja kaip savo paties fallback).
 * Field-level overlay: tik NON-null catalog laukai perdengia → slim preview
 * entry NEištrina pilnesnių inline laukų (no regression).
 *
 * refFrozen (F2) — mirę augalai naudoja inline snapshot, ignoruoja live.
 */
export function resolvePlantView(plant) {
  if (!plant) return plant
  // Reference šaltinio prioritetas:
  //   frozen (miręs)  → plant.ref (istorinis snapshot, IGNORUOJA live catalog)
  //   gyvas           → live catalog entry → plant.ref (slim doc snapshot) → inline
  let ref
  if (plant.refFrozen) {
    ref = plant.ref ?? null
  } else {
    const slug = plant.catalogId ?? catalogDocId(plant.lotyniskas ?? plant.latinName)
    ref = (slug && _catalogById[slug]) ? _catalogById[slug] : (plant.ref ?? null)
  }
  if (!ref) return plant              // legacy „fat" doc be ref/catalog → inline as-is
  const r = { ...ref }
  // Niekada neperdengiam: docId meta, display image/imageThumb/photos (photo
  // logika atskira — heroIsDefaultFor), nei asmeninių laukų (catalog jų neturi,
  // bet defensyviai). 2026-06-01: imageThumb pridėtas — dual upload artifact'as,
  // tas pats išskyrimas kaip ir image (user-specific Storage URL).
  delete r._id; delete r.updatedAt; delete r.image; delete r.imageThumb
  for (const k of PERSONAL_FIELDS) delete r[k]
  // Drop null/undefined — kad slim catalog entry neištrintų pilnesnių inline reikšmių.
  for (const k of Object.keys(r)) if (r[k] == null) delete r[k]
  return { ...plant, ...r }
}

/**
 * snapshotPlantRef(plant) — F2 freeze-on-death. Grąžina rūšinių laukų snapshot'ą
 * (live-resolved) įšaldymui į user-plant doc'ą, kai augalas miršta/archyvuojamas.
 * Praleidžia asmeninius laukus + image/photos (jie lieka user-plant doc'e).
 */
export function snapshotPlantRef(plant) {
  const view = resolvePlantView({ ...plant, refFrozen: false })
  const ref = {}
  for (const k of Object.keys(view)) {
    if (PERSONAL_FIELDS.has(k) || k === 'image' || k === 'imageThumb' || k === '_id' || k === 'ref' || k === 'refFrozen') continue
    if (view[k] != null) ref[k] = view[k]
  }
  return ref
}

/**
 * heroIsDefaultFor(plant) — ar watercolor iliustracija turi būti DEFAULT hero
 * šitam augalui? Watercolor yra gražus uniform placeholder'is, bet NIEKADA
 * neturi uždengti user'io NUOSAVOS foto. Taisyklė:
 *   • nėra plant.image            → true  (watercolor užpildo tuštumą)
 *   • useHistoryPhoto === false   → false (user rankiniu būdu užrakino foto:
 *                                          Galerija pick / upload / camera)
 *   • turi personal timeline foto → false (augimo nuotraukos = user'io, laimi)
 *   • stock auto foto (Wiki/iNat, be timeline) → true (watercolor default)
 * Tokiu būdu user pasirinktos/asmeninės foto visada laimi, o watercolor lieka
 * tik niekad neliestiems catalog stock augalams.
 */
export function heroIsDefaultFor(plant) {
  if (!plant?.image) return true
  if (plant.useHistoryPhoto === false) return false
  const hasTimelinePhoto = (plant.timeline ?? []).some(e => e.type === 'photo' && e.imageUrl)
  return !hasTimelinePhoto
}

/**
 * heroIllustrationForPlant(plant) — combined helper card render'iui: grąžina
 * watercolor URL TIK jei jis turi būti default šitam augalui (kitaip null →
 * PlantCard rodo real foto). Vienas call'as visiems Dashboard call site'ams.
 */
export function heroIllustrationForPlant(plant) {
  if (!plant || !heroIsDefaultFor(plant)) return null
  // 2026-06-02 DIAGNOSTIC (laikinas) — widget rodo watercolor nors yra image.
  // Logina TIK bug sąlygą → repro metu parodo kurio lauko trūksta renderyje.
  if (plant.image) {
    console.log('[hero-debug] watercolor DESPITE image', {
      id: plant.id,
      name: plant.lietuviškas,
      useHistoryPhoto: plant.useHistoryPhoto,
      timelinePhotos: (plant.timeline ?? []).filter(e => e.type === 'photo' && e.imageUrl).length,
      imageHead: String(plant.image).slice(0, 48),
    })
  }
  return heroIllustrationFor(plant.lotyniskas)
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
 * Bust'ina catalog cache'ą (in-memory + IndexedDB). Naudojama, kai admin
 * tiesiogiai save'ina ar trina catalog entry'ius per AdminPanel — `searchCatalog`
 * ir autocomplete'as iškart atspindi naują būklę be 24h laukimo.
 *
 * NB: bust'inimas yra fire-and-forget. Jei localStorage'e dar liko OLD
 * cache'as (pre-IDB migration), tyliai pašalinam — apsauga prieš stale data.
 */
export function bustCatalogCache() {
  _catalogMem = null
  _catalogMemAt = 0
  if (_idbStore) {
    idbDel(CACHE_KEY, _idbStore).catch(() => {/* ignore */})
  }
  // Cleanup'as senų localStorage cache'ų (migration period)
  try { localStorage.removeItem('catalog-cache-v1') } catch {}
}

/** Išsaugo augalo rūšinius duomenis į katalogą (merge — neperrašo).
 *
 * NB: stripUndefinedDeep tarp toCatalogEntry ir setDoc — apsaugo nuo
 * Firebase setDoc'o crash'inimo, kai nested objektas turi undefined
 * (pvz., `tresimas.tipas` jei AI praleido subfield). top-level laukai
 * jau buvo filter'inami per `v != null` toCatalogEntry'je, bet nested
 * neapsaugoti. (Audit 2026-05-21.)
 */
export async function saveToCatalog(plant) {
  const id = catalogDocId(plant.lotyniskas ?? plant.latinName)
  if (!id) return
  const entry = toCatalogEntry(plant)
  if (!Object.keys(entry).length) return
  const clean = stripUndefinedDeep({ ...entry, updatedAt: new Date().toISOString() })
  try {
    await setDoc(doc(db, 'catalog', id), clean, { merge: true })
    // Cache bust — naujai pridėtas augalas iškart pasimato `searchCatalog'e
    bustCatalogCache()
  } catch (e) {
    console.warn('[catalog] write failed:', e)
  }
}
