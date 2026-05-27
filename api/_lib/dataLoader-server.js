/**
 * Server-side JSON data loader — Node-only, fs.readFile based.
 *
 * KODĖL ATSKIRAS NUO CLIENT'O:
 * Senasis `src/utils/dataLoader.js` buvo ISOMORPHIC wrapper'is — bandėm
 * vienu kodu palaikyti ir browser fetch'ą, ir Node fs.readFile'ą. Browser
 * branch'as gavo `callerImportMetaUrl` kaip parametrą, todėl Vite static
 * asset analyzer'is NEGALĖJO matyti URL'o build time'e → production deploy
 * paliko URL neišspręstą → Vercel grąžino `index.html` HTML fallback →
 * `JSON.parse('<!doctype...')` → search SearchModal'is luzdavo
 * Phase 0.3 pre-DB step'e.
 *
 * SPRENDIMAS — pilnai atskirti server'į nuo client'o:
 *   • Client utility'ai (`src/utils/preDb.js` ir t.t.) — UNCHANGED, lieka
 *     su inline `new URL('../../data/X.json', import.meta.url) + fetch()`
 *     (statiškai analizuojamas string'as, Vite teisingai bundle'ina)
 *   • Server'is naudoja ŠITĄ failą — `api/_lib/dataLoader-server.js`,
 *     gyvenantį `api/` (Vite nepasiekia, tik Vercel Functions runtime'as)
 *
 * VERCEL BUNDLE'INIMAS:
 * Visi `new URL('literal-string', import.meta.url)` čia yra STATINIAI
 * literal'ai. `@vercel/nft` (Node File Trace) juos randa build time'e ir
 * automatiškai įtraukia į function'o deployment bundle'ą. Jei pridedi
 * naują JSON failą, registruok jį žemiau `DATA_URLS` map'e su STATIC
 * literal path'u — kitaip Vercel'is jo neinclude'ins ir runtime
 * gausi `ENOENT`.
 *
 * USAGE:
 *   import { loadJson } from './dataLoader-server.js'
 *   const preDb = await loadJson('pre-db.json')
 *   // Antras call'as — instant (module-level cache).
 *
 * TODO Step 4: pridėti darbinius failus (pfaf, aspca-toxicity) kai
 * processPlant pradės naudoti.
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// ── Static URL registry ─────────────────────────────────────────
// KIEKVIENAS URL turi būti `new URL('LITERAL', import.meta.url)` —
// no template strings, no variables. Tai garantuoja, kad @vercel/nft
// statiškai aptiks failą ir įtrauks į deploy bundle'ą.
const DATA_URLS = {
  'pre-db.json':            new URL('../../data/pre-db.json',            import.meta.url),
  'aspca-genus-map.json':   new URL('../../data/aspca-genus-map.json',   import.meta.url),
  'aspca-toxicity.json':    new URL('../../data/aspca-toxicity.json',    import.meta.url),
  // 2026-05-27 — aspca-animals-lt.json BUVO neregistruotas, silent ENOENT
  // → loadJson grąžino {} → translateAnimalTargets veikė kaip no-op →
  // batch'as saugojo „Toksiška cats, dogs, horses" EN strings catalog'e.
  // Migration script (`scripts/migrate-toxicity-animals-lt.mjs`) fix'ina
  // egzistuojančias entries; šis registracijos eilutė užkerta kelią ateičiai.
  'aspca-animals-lt.json':  new URL('../../data/aspca-animals-lt.json',  import.meta.url),
  'pfaf.json':              new URL('../../data/pfaf.json',              import.meta.url),
  'lt-names.json':          new URL('../../data/lt-names.json',          import.meta.url),
  'latin-synonyms-reverse.json': new URL('../../data/latin-synonyms-reverse.json', import.meta.url),
}

// Module-level cache — Fluid Compute instance'ai persi-naudojami tarp
// request'ų, todėl antras call'as tai pačiai funkcijai grąžins iš RAM'o.
const cache = new Map()

/**
 * Load a JSON data file from the project's `data/` folder.
 *
 * @param {keyof typeof DATA_URLS} name  Registered file name (e.g. 'pre-db.json')
 * @returns {Promise<any>}  Parsed JSON
 * @throws  If `name` not registered or file missing/invalid
 */
export async function loadJson(name) {
  if (cache.has(name)) return cache.get(name)

  const url = DATA_URLS[name]
  if (!url) {
    throw new Error(
      `[dataLoader-server] Unregistered data file: "${name}". ` +
      `Add it to DATA_URLS in api/_lib/dataLoader-server.js with a STATIC ` +
      `new URL('../../data/${name}', import.meta.url) literal so @vercel/nft ` +
      `can bundle it.`
    )
  }

  try {
    const buf = await readFile(fileURLToPath(url), 'utf8')
    const data = JSON.parse(buf)
    cache.set(name, data)
    return data
  } catch (err) {
    throw new Error(
      `[dataLoader-server] Failed to load "${name}" (${url.pathname}): ${err?.message ?? err}`
    )
  }
}

/**
 * Debug/admin helper — list registered data files.
 * Useful for sanity checks; NOT for runtime lookups.
 */
export function listRegisteredFiles() {
  return Object.keys(DATA_URLS)
}

/**
 * Clear the cache — primarily for tests. Production code should not call.
 */
export function clearCache() {
  cache.clear()
}
