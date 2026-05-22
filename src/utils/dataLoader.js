/**
 * Isomorphic JSON data loader — veikia ir browser, ir Node.js serverside.
 *
 * KODĖL: mūsų utility'iai (preDb, deriveToxicity, buildPlantRagContext)
 * naudoja `fetch(new URL('../../data/X.json', import.meta.url))` static
 * data load'avimui. Tas veikia BROWSER (Vite bundle resolve'ina URL'us),
 * BET NE Node.js Vercel Function context'e (fetch su file:// URL nepalaiko).
 *
 * Server-side save (api/save-plant.js) reikalauja TIESIOG nuskaityti failą
 * iš filesystem'o per `fs.readFile`.
 *
 * Šis util'as abstract'ina tą skirtumą:
 *   • Browser: fetch URL via Vite/Webpack bundle resolution
 *   • Node:    fs.readFile su path resolution
 *
 * USAGE:
 *   import { loadJson } from './dataLoader.js'
 *   const data = await loadJson('pre-db.json', import.meta.url)
 *
 * NB: `callerImportMetaUrl` būtinas — antrasis arg perduoda calling
 * module'io import.meta.url, kad path resolution'as veiktų teisingai
 * tiek bundle'inant (Vite resolve'ina relative paths nuo caller'io),
 * tiek server-side (path.dirname iš caller'io URL).
 */

let _fsModule = null  // lazy import for Node only

async function getNodeFs() {
  if (_fsModule) return _fsModule
  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  const url = await import('node:url')
  _fsModule = { fs, path, url }
  return _fsModule
}

/**
 * Load JSON data file from data/ directory.
 *
 * @param {string} relativePath - path relative to data/ (e.g. 'pre-db.json' or 'aspca-toxicity.json')
 * @param {string} callerImportMetaUrl - caller's import.meta.url, for path resolution
 * @returns {Promise<object>} parsed JSON
 */
export async function loadJson(relativePath, callerImportMetaUrl) {
  // Browser path — use fetch with URL relative to caller's bundle
  if (typeof window !== 'undefined' || typeof process === 'undefined' || !process.versions?.node) {
    const url = new URL(`../../data/${relativePath}`, callerImportMetaUrl)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`loadJson(${relativePath}) HTTP ${res.status}`)
    return res.json()
  }

  // Node path (Vercel Function, scripts/) — use fs.readFile
  const { fs, path, url } = await getNodeFs()
  const callerDir = path.dirname(url.fileURLToPath(callerImportMetaUrl))
  // Caller is in src/utils/ — go up two levels to project root, then data/
  const filePath = path.resolve(callerDir, '..', '..', 'data', relativePath)
  const content = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(content)
}
