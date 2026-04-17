// Data migration utility
// When the plant data schema changes, increment CURRENT_VERSION and add a migration step.
// Migration runs automatically on app load (loadLocal in usePlants.js).

export const CURRENT_VERSION = 5

// Keys from previous versioning scheme — checked as fallback when 'geliu-db' is empty
export const LEGACY_KEYS = ['geliu-db-v5', 'geliu-db-v4', 'geliu-db-v3']

/**
 * Migrates data from any older version up to CURRENT_VERSION.
 * Each step transforms data incrementally.
 *
 * To add a new migration:
 *   1. Increment CURRENT_VERSION
 *   2. Add a case: if (v < X) { ...transform d...; v = X }
 */
export function migrate(data) {
  let d = { ...data }
  let v = d.__version ?? 0

  // v1–v4: pre-versioning era — data structure is already correct from Firestore sync,
  // no structural changes needed. Just stamp version.

  // v5 → future: add migration steps here, e.g.:
  // if (v < 6) {
  //   d.plants = d.plants.map(p => ({ ...p, newField: defaultValue }))
  //   v = 6
  // }

  if (v !== CURRENT_VERSION) {
    d = { ...d, __version: CURRENT_VERSION }
  }

  return d
}
