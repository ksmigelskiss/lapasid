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
 *
 * LOGIC (Step 6s — timestamp comparison for re-enrich support):
 *   Plant cycle gali atsikartoti (initial save → re-enrich → re-enrich).
 *   enrichmentStartedAt bumps prieš kiekvieną POST /api/save-plant.
 *   phase2CompletedAt bumps po server'io sėkmingo pipeline.
 *
 *   Jei startedAt > completedAt → vyksta naujas cikl'as („enriching" arba „failed"
 *                                  jei timing'as išsekęs).
 *   Jei completedAt >= startedAt → ankstesnis ciklas baigtas, dabar idle („enriched").
 *
 *   Šitas pattern'as palaiko:
 *     • Initial save (startedAt set, completedAt nedoresnis) → enriching
 *     • Successful completion (completedAt > startedAt) → enriched
 *     • Manual re-enrich (klient'as bumps startedAt > completedAt) → enriching vėl
 *     • Server failure (startedAt set, completedAt prieš tai, enrichmentError set) → failed
 */
export function getPlantEnrichmentState(plant) {
  if (!plant) return 'unknown'

  const startedAt = plant.enrichmentStartedAt
    ? new Date(plant.enrichmentStartedAt).getTime()
    : 0
  const completedAt = plant.phase2CompletedAt
    ? new Date(plant.phase2CompletedAt).getTime()
    : 0

  // Active enrichment cycle: startedAt is more recent than completedAt
  if (startedAt > completedAt) {
    const ageMs = Date.now() - startedAt
    if (Number.isNaN(ageMs)) return 'unknown'
    if (ageMs < ENRICHMENT_TIMEOUT_MS) return 'enriching'  // recent activity
    // Timed out (>90s) — BET LEGACY DATA check:
    // Plant'as gali turėti seną startedAt (saved pre-phase2CompletedAt era
    // Step 6a/6b) IR jau turėti Phase 2 data. Tokiu atveju enrichment'as
    // pasibaigė sėkmingai, tiesiog completion marker'is nebuvo rašytas tame
    // build'e. Jei laistymasIntervalas (= Phase 2 required field) yra → treat
    // kaip 'enriched' (legacy).
    if (plant.laistymasIntervalas) return 'enriched'
    return 'failed'  // truly stuck — timeout + no Phase 2 data
  }

  // Completed: completedAt exists and is most recent activity
  if (completedAt > 0) return 'enriched'

  // No timestamps yet, but has Phase 2 data (legacy plants saved pre-Variant B)
  if (plant.laistymasIntervalas) return 'enriched'

  // Explicit failure marker (rare — kai timestamps missing dėl race)
  if (plant.enrichmentError) {
    console.log('[plantState] FAILED (explicit error, no timestamps)', {
      id: plant.id, latin: plant.lotyniskas,
      error: plant.enrichmentError,
    })
    return 'failed'
  }

  return 'unknown'
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
