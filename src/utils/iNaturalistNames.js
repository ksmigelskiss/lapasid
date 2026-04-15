/**
 * Fetches Lithuanian and English plant names and synonyms from iNaturalist.
 * Uses two calls: search (preferred name) + taxon detail (all names by locale).
 */
// Strip cultivar/variety suffixes like 'Rosso', "Silver", (hybrid) etc.
function stripCultivar(name) {
  return name
    .replace(/\s*'[^']*'/g, '')   // remove 'Cultivar'
    .replace(/\s*"[^"]*"/g, '')   // remove "Cultivar"
    .replace(/\s*\([^)]*\)/g, '') // remove (notes)
    .trim()
}

export async function fetchINaturalistNames(latinName) {
  if (!latinName) return null
  const searchName = stripCultivar(latinName)
  try {
    // 1. Search by Latin name with Lithuanian locale
    const searchRes = await fetch(
      `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(searchName)}&locale=lt&rank=species,subspecies,variety&limit=5`,
      { headers: { Accept: 'application/json' } }
    )
    if (!searchRes.ok) return null
    const searchData = await searchRes.json()

    // Prefer exact name match (stripped), fall back to first result
    const searchLower = searchName.toLowerCase()
    const taxon = searchData.results?.find(
      t => t.name.toLowerCase() === searchLower
    ) ?? searchData.results?.[0]

    if (!taxon) return null

    const preferredName = taxon.preferred_common_name ?? null

    // 2. Fetch full taxon for all Lithuanian + English names
    let synonyms = []
    let englishNames = []
    try {
      const detailRes = await fetch(
        `https://api.inaturalist.org/v1/taxa/${taxon.id}?locale=lt`,
        { headers: { Accept: 'application/json' } }
      )
      if (detailRes.ok) {
        const detail = await detailRes.json()
        const names = detail.results?.[0]?.names ?? []
        synonyms = names
          .filter(n => n.locale === 'lt' && n.name !== preferredName)
          .map(n => n.name)
        englishNames = names
          .filter(n => n.locale?.startsWith('en'))  // en, en-US, en-GB etc.
          .map(n => n.name)
          .filter((v, i, a) => a.indexOf(v) === i) // deduplicate
          .slice(0, 4)
      }
    } catch {}

    return {
      preferredName,   // iNaturalist preferred Lithuanian name (may be null)
      synonyms,        // other Lithuanian names from iNaturalist
      englishNames,    // English common names from iNaturalist
      taxonId: taxon.id,
    }
  } catch {
    return null
  }
}
