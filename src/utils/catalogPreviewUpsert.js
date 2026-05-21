/**
 * catalogPreviewUpsert — background save'as pre-DB hit'o + Wiki preview duomenų
 * į catalog. Antras useris paieško to paties augalo gauna catalog hit'ą
 * instant, be Wiki/iNat fetch'o.
 *
 * KAS RAŠOMA:
 *   • lotyniskas, lietuviškas, family, kilme — iš pre-DB
 *   • image — rehost'inta į Firebase Storage (background, fail-soft)
 *   • aprasymas — iš Wikipedia LT extract'o (jei yra; EN extract'ą paliekam
 *     Stage 2 RAG'ui per `extractEN` lauką ateičiai)
 *   • savybes — toxicity iš ASPCA per buildPreDbBaseResult'o struktūrą
 *   • sources{} — per-field provenance
 *   • verificationStatus: 'preview' — distinct nuo 'full' (po Save click'o)
 *   • aiConfidence: 'preview'    — UI gali rodyti "Trumpas aprašas" badge'ą
 *
 * KAS NERAŠOMA (Stage 2 RAG'o atsakomybė):
 *   • laistymasIntervalas, tresimas, prieziura, problemos, idomybes — care info
 *   • Pilnas LT translate'as EN extract'ams
 *
 * IDEMPOTENCY: saveToCatalog naudoja `merge: true`, todėl jei catalog'e jau
 * yra to augalo įrašas (kažkas Save click'ą padarė), preview duomenys tiesiog
 * neperrašo egzistuojančių (Firestore merge field-level).
 *
 * @param {object} baseResult — buildPreDbBaseResult output'as
 * @param {object} stage1     — searchStage1 result (pridėti dbSources / sources)
 * @returns {Promise<void>}  fire-and-forget, niekas neturi laukti
 */
import { saveToCatalog, getCatalogEntry, catalogDocId } from './catalog.js'
import { rehostExternalImage } from './imageService.js'

export async function catalogPreviewUpsert(baseResult, stage1) {
  if (!baseResult?.latinName) return
  if (!baseResult.fromPreDb) return  // tik pre-DB hit'ams, ne AI nei full

  const docId = catalogDocId(baseResult.latinName)
  if (!docId) return

  // Pirma patikrinam — gal jau yra catalog entry'is (su 'full' status'u arba
  // anksčiau įrašytas preview). Nedubliuojam.
  try {
    const existing = await getCatalogEntry(baseResult.latinName)
    if (existing && existing.verificationStatus && existing.verificationStatus !== 'preview') {
      // Full ar auto-verified įrašas jau yra — preview neperrašo (merge'as
      // top-level laukus paliktų, bet vis tiek nieko prasmingo nepridėtų)
      return
    }
  } catch {
    // getCatalogEntry fail'as — tęsiam, saveToCatalog savaime fail-soft'inas
  }

  // Background photo rehost — paraleliai pradedam, nelaikom čia
  // (saveToCatalog gali eit be image, vėliau update'inti per atskirą call'ą).
  let imagePromise = Promise.resolve(baseResult.image)
  if (baseResult.image && baseResult.imageSource && baseResult.imageSource !== 'storage') {
    imagePromise = rehostExternalImage(baseResult.image, baseResult.latinName, 1200)
      .catch(() => baseResult.image) // fail-soft → external URL
  }

  // Pirma write'as su external image (instant catalog hit'as kitam useriui)
  const previewEntry = {
    lotyniskas: baseResult.latinName,
    lietuviškas: baseResult.name,
    family: baseResult.family,
    kilme: baseResult.kilme,
    image: baseResult.image,  // external URL kol kas, update'insim po rehost
    aprasymas: baseResult.aprasymasLang === 'lt' ? baseResult.aprasymas : null,
    // EN extract'as paliekam atskirai — Stage 2 RAG'as gali jį naudoti per
    // wikiCachedData lauką (translation TBD). UI rodys tik LT.
    wikiExtractEn: baseResult.aprasymasLang === 'en' ? baseResult.aprasymas : null,
    wikipediaUrl: baseResult.wikipediaUrl,
    savybes: baseResult.savybes,
    toxicityStatus: baseResult.toxicityStatus,
    sinonimai: baseResult.sinonimai,
    lotyniskiSinonimai: baseResult.lotyniskiSinonimai ?? [],

    sources: baseResult.sources,
    dbSources: baseResult.dbSources,

    verificationStatus: 'preview',
    aiConfidence:       'preview',
    schemaVersion:      2,
  }

  try {
    await saveToCatalog(previewEntry)
  } catch (e) {
    // saveToCatalog jau swallow'ina warnings — bet vis dėlto pridėjom catch
    console.warn('[catalog-preview-upsert] save failed:', e?.message)
  }

  // Atskira upsert'a su rehost'inta image (jei pavyko)
  // Async, neblokuoja vartotojo flow'o
  try {
    const rehostedUrl = await imagePromise
    if (rehostedUrl && rehostedUrl !== baseResult.image) {
      await saveToCatalog({
        lotyniskas: baseResult.latinName,
        image: rehostedUrl,
      })
    }
  } catch {
    // rehost fail'as — image lieka external URL'is, vis tiek catalog'e
  }
}
