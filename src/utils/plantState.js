/**
 * plantState — derive plant's current enrichment state from existing
 * Firestore doc fields. No new state, no subscriptions, no writes — viskas
 * iš plant doc fields kuriuos jau turim.
 *
 * VAIDMUO: Variant B dual-write pattern reikalauja matomos „loading" būsenos
 * tarp slim plant write'o (klientas) ir Phase 2 enrichment baigties (server'is).
 * Šis helper'is yra SINGLE SOURCE OF TRUTH client-side UI render'iams
 * (PlantCard overlay, PlantDetail banner).
 *
 * VARIANT E SIGNALS (priority order):
 *   1. phase2CompletedAt — server'io explicit success marker (sets'ina
 *      processPlant success path'e). Šis yra GOLD signal'as.
 *   2. laistymasIntervalas — derived signal (Phase 2 AI required field).
 *      Backup'as Variant E hybrid'e — jei phase2CompletedAt skip'inta dėl
 *      kažkokios merge race condition, šitas vis tiek matomas.
 *   3. enrichmentError — server'io explicit failure marker (rašoma
 *      processPlant catch block'e). Negative signal'as.
 *   4. data_prideta + 90s timing fallback — apima HARD CRASH atvejus,
 *      kai server'is mirė PRIEŠ enrichmentError write'ą.
 *
 * STATES:
 *   • 'enriched'  — Phase 2 baigtas. Normal render.
 *   • 'enriching' — Phase 2 in progress (recent save, no completion signal).
 *                   PlantCard show'ina dimm + BrandLoader overlay, non-clickable.
 *   • 'failed'    — Phase 2 fail'ino (explicit error arba timeout >90s).
 *                   PlantCard show'ina terracotta overlay + „Bandyti dar kartą".
 *   • 'unknown'   — Legacy plant (no data_prideta). Renderiam kaip normalų.
 */

const ENRICHMENT_TIMEOUT_MS = 90 * 1000  // 90s — typical Phase 2 = 10-30s, 3x margin

/**
 * @param {object} plant — Firestore plant doc (collections/{colId}/plants/{plantId})
 * @returns {'enriched'|'enriching'|'failed'|'unknown'}
 */
export function getPlantEnrichmentState(plant) {
  if (!plant) return 'unknown'

  // 1. Explicit success signal — Variant E primary
  if (plant.phase2CompletedAt) return 'enriched'

  // 2. Derived success signal — Phase 2 AI required field
  //    (backup'as: jei phase2CompletedAt skip'inta dėl race, vis tiek matom)
  if (plant.laistymasIntervalas) return 'enriched'

  // 3. Explicit failure signal — server'io processPlant catch block
  if (plant.enrichmentError) return 'failed'

  // 4. Legacy plant (no save timestamp) — neturime ką spręsti, palieka normaliai
  if (!plant.data_prideta) return 'unknown'

  // 5. Timing fallback — apima hard crash atvejus
  const ageMs = Date.now() - new Date(plant.data_prideta).getTime()
  if (Number.isNaN(ageMs)) return 'unknown'    // invalid timestamp → assume legacy
  if (ageMs < ENRICHMENT_TIMEOUT_MS) return 'enriching'
  return 'failed'
}

/**
 * Format human-readable failure reason from enrichmentError.
 * Naudojama failed-state callout'e.
 */
export function getEnrichmentFailureReason(plant) {
  if (plant?.enrichmentError?.reason) return plant.enrichmentError.reason
  return 'Užklausa nepasiekta arba užtruko per ilgai'
}

/**
 * Helper — ar plant'as šiuo metu „aktyvus" pending'as (joks UI interactions
 * gali pakeisti būseną)?
 */
export function isPlantPending(plant) {
  return getPlantEnrichmentState(plant) === 'enriching'
}

export function isPlantFailed(plant) {
  return getPlantEnrichmentState(plant) === 'failed'
}
