/**
 * Fetches plant vernacular names from two sources:
 *  1. iNaturalist — preferred LT common name + LT synonyms
 *  2. GBIF        — Lithuanian ('lit') and English ('eng') vernacular names
 *
 * Returns: { inatLtName, sinonimai, englishNames }
 */

function stripCultivar(name) {
  return name
    .replace(/\s*'[^']*'/g, '')
    .replace(/\s*"[^"]*"/g, '')
    .replace(/\s*\([^)]*\)/g, '')
    .trim()
}

async function fetchINaturalist(latinName) {
  try {
    const searchRes = await fetch(
      `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(latinName)}&locale=lt&rank=species,subspecies,variety&limit=5`,
      { headers: { Accept: 'application/json' } }
    )
    if (!searchRes.ok) return null
    const searchData = await searchRes.json()

    const searchLower = latinName.toLowerCase()
    const exactMatch = searchData.results?.find(
      t => t.name.toLowerCase() === searchLower
    )
    const taxon = exactMatch ?? searchData.results?.[0]
    if (!taxon) return null

    const preferredName = taxon.preferred_common_name ?? null
    let ltSynonyms = []
    let enNames = []

    const detailRes = await fetch(
      `https://api.inaturalist.org/v1/taxa/${taxon.id}?locale=lt`,
      { headers: { Accept: 'application/json' } }
    )
    if (detailRes.ok) {
      const detail = await detailRes.json()
      const names = detail.results?.[0]?.names ?? []
      ltSynonyms = names
        .filter(n => n.locale === 'lt' && n.name !== preferredName)
        .map(n => n.name)
      enNames = names
        .filter(n => n.locale?.startsWith('en'))
        .map(n => n.name)
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 4)
    }

    // taxonId is only set when the name matched exactly — used to decide
    // whether to show the iNaturalist link in the UI.
    return { preferredName, ltSynonyms, enNames, taxonId: exactMatch ? taxon.id : null }
  } catch {
    return null
  }
}

async function checkWikipedia(latinName, lang) {
  try {
    const title = latinName.replace(/ /g, '_')
    const res = await fetch(
      `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&format=json&origin=*`,
      { headers: { Accept: 'application/json' } }
    )
    if (!res.ok) return false
    const data = await res.json()
    const pages = data?.query?.pages ?? {}
    const page = Object.values(pages)[0]
    return !('missing' in page)
  } catch {
    return false
  }
}

async function fetchGBIF(latinName) {
  try {
    // Step 1: match species
    const matchRes = await fetch(
      `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(latinName)}&rank=SPECIES`,
      { headers: { Accept: 'application/json' } }
    )
    if (!matchRes.ok) return null
    const match = await matchRes.json()
    const key = match.usageKey ?? match.speciesKey
    if (!key) return null

    // Step 2: fetch vernacular names
    const vernRes = await fetch(
      `https://api.gbif.org/v1/species/${key}/vernacularNames?limit=50`,
      { headers: { Accept: 'application/json' } }
    )
    if (!vernRes.ok) return null
    const vern = await vernRes.json()
    const results = vern.results ?? []

    const ltNames = results
      .filter(n => n.language === 'lit')
      .map(n => n.vernacularName)
      .filter((v, i, a) => a.indexOf(v) === i)

    const enNames = results
      .filter(n => n.language === 'eng')
      .map(n => n.vernacularName)
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 4)

    return { ltNames, enNames }
  } catch {
    return null
  }
}

export async function fetchPlantNames(latinName) {
  if (!latinName) return null
  const searchName = stripCultivar(latinName)

  // Run all checks in parallel
  const [inat, gbif, wikiLtFound, wikiEnFound] = await Promise.all([
    fetchINaturalist(searchName),
    fetchGBIF(searchName),
    checkWikipedia(searchName, 'lt'),
    checkWikipedia(searchName, 'en'),
  ])

  // Merge LT names: iNaturalist preferred → GBIF LT → iNaturalist synonyms
  const inatLtName = inat?.preferredName ?? null
  const gbifLtNames = gbif?.ltNames ?? []
  const inatSynonyms = inat?.ltSynonyms ?? []

  // Merge and deduplicate LT synonyms (excluding the preferred name)
  const allLtSynonyms = [...gbifLtNames, ...inatSynonyms]
    .filter(n => n !== inatLtName)
    .filter((v, i, a) => a.indexOf(v) === i)

  // Merge EN names: iNaturalist + GBIF, deduplicated
  const allEnNames = [...(inat?.enNames ?? []), ...(gbif?.enNames ?? [])]
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 4)

  const inatTaxonId = inat?.taxonId ?? null

  console.log('[plantNames]', searchName, { inatLtName, inatTaxonId, wikiLtFound, wikiEnFound, allLtSynonyms, allEnNames })

  return {
    inatLtName,
    inatTaxonId,
    wikiLtFound,
    wikiEnFound,
    sinonimai:    allLtSynonyms,
    englishNames: allEnNames,
  }
}
