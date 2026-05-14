/**
 * fuzzySearch — typo-tolerant string matching with Lithuanian diacritic normalization.
 *
 * Naudojama SearchModal (local + catalog matches), Biblioteka filter'iui ir
 * bet kur kitur, kur user'is įveda paieškos užklausą. Best-effort algoritmas:
 *
 *   1. Diacritic normalize  (ą→a, š→s, ž→z…) abi puses
 *   2. Substring match'as   (greitas path, score 0..N)
 *   3. Levenshtein fallback (žodis po žodžio, threshold'as pagal ilgį)
 *
 * Dataset'ai nedideli (<1000 įrašai), todėl client-side custom impl'as
 * be Fuse.js dependency'o. Jei dataset'as augs >10k — switch'inti į Fuse.js
 * arba server-side full-text (Algolia/Typesense/Meilisearch).
 */

// Lithuanian → ASCII char map'as. Naudojama matching'e (NE display'e!) —
// kad „raktazole" surastų „Raktažolė", o „monstra" — „Monsterą".
const LT_DIACRITICS_MAP = {
  ą: 'a', č: 'c', ę: 'e', ė: 'e', į: 'i', š: 's', ų: 'u', ū: 'u', ž: 'z',
  Ą: 'a', Č: 'c', Ę: 'e', Ė: 'e', Į: 'i', Š: 's', Ų: 'u', Ū: 'u', Ž: 'z',
}

/**
 * Normalize'ina string'ą paieškai: lowercase + LT diacritic'us → ASCII.
 * Naudojama TIK match logikos viduje; saugomi/rodomi originalūs string'ai.
 */
export function normalize(s) {
  if (!s) return ''
  return s.toLowerCase().replace(/[ąčęėįšųūžĄČĘĖĮŠŲŪŽ]/g, c => LT_DIACRITICS_MAP[c] || c)
}

/**
 * Klasikinis Levenshtein edit distance (insertions + deletions + substitutions).
 * Optimizuota su two-row memory'iu (O(min(a,b)) erdvėje).
 */
export function levenshtein(a, b) {
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array(a.length + 1).fill(0).map((_, i) => i)
  for (let j = 1; j <= b.length; j++) {
    const curr = [j]
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr.push(Math.min(prev[i] + 1, curr[i - 1] + 1, prev[i - 1] + cost))
    }
    prev = curr
  }
  return prev[a.length]
}

/**
 * Žodžio ilgis → maksimalus leistinas typo skaičius. Skaling'as:
 *   ≤4 char    → 1 typo  (per griežtai būtų impossible, per laisva — false positives)
 *   5–7 char   → 2 typos
 *   8+ char    → 3 typos
 */
function maxTyposFor(wordLen) {
  if (wordLen <= 4) return 1
  if (wordLen <= 7) return 2
  return 3
}

/**
 * Įvertina query/target match'o kokybę:
 *   { matched: true, score: 0 }  — exact prefix match (best)
 *   { matched: true, score: N }  — substring match (positional penalty)
 *   { matched: true, score: 10+} — fuzzy (typo'd) match
 *   { matched: false }           — neatrastas
 *
 * Sortinant rezultatus, MAŽESNIS score = geresnis match'as.
 */
export function fuzzyScore(query, target) {
  const q = normalize(String(query).trim())
  const t = normalize(String(target))
  if (!q || !t) return { matched: false, score: Infinity }

  // 1) Exact substring (greitas path — apima daugumą real scenario'ų)
  const idx = t.indexOf(q)
  if (idx === 0) return { matched: true, score: 0 }        // prefix match
  if (idx > 0)  return { matched: true, score: 1 + idx * 0.1 } // substring, slight penalty by position

  // 2) Fuzzy fallback — split per žodžius, kiekvienam query žodžiui rasti
  //    artimiausią target žodį per Levenshtein'ą.
  const qWords = q.split(/\s+/).filter(w => w.length >= 2)
  if (qWords.length === 0) return { matched: false, score: Infinity }

  const tWords = t.split(/\s+/).filter(w => w.length >= 1)
  if (tWords.length === 0) return { matched: false, score: Infinity }

  let totalDist = 0
  for (const qw of qWords) {
    const maxDist = maxTyposFor(qw.length)
    let bestDist = Infinity

    for (const tw of tWords) {
      // Skip jei target word'as per trumpas net su typo'is, kad būtų sutapęs
      if (tw.length < qw.length - maxDist) continue
      // Prefix-aware: lygiu qw su pirmais tw chars'ais (kad „monstra" find'tų „monstera deliciosa")
      const sliceLen = Math.min(tw.length, qw.length + maxDist)
      const dist = levenshtein(qw, tw.slice(0, sliceLen))
      if (dist < bestDist) bestDist = dist
      if (bestDist === 0) break
    }

    if (bestDist > maxDist) return { matched: false, score: Infinity }
    totalDist += bestDist
  }

  return { matched: true, score: 10 + totalDist }
}

/**
 * Boolean'inis variant'as fuzzyScore. Patogu .filter() call'ams kur scoring
 * nereikalingas (Biblioteka query filter, Zinynas search etc.).
 */
export function fuzzyMatch(query, target) {
  return fuzzyScore(query, target).matched
}

/**
 * Plant-specific: best match score per visus plant'o name fields
 * (lietuviškas, lotyniskas, inatLtName, sinonimai, englishNames).
 * Grąžina Infinity jei joks field'as nematch'ina.
 */
export function plantFuzzyScore(plant, query) {
  const fields = [
    plant?.lietuviškas,
    plant?.lotyniskas,
    plant?.inatLtName,
    ...(plant?.sinonimai ?? []),
    ...(plant?.englishNames ?? []),
  ]
  let best = Infinity
  for (const f of fields) {
    if (!f) continue
    const { matched, score } = fuzzyScore(query, f)
    if (matched && score < best) best = score
    if (best === 0) break
  }
  return best
}

/**
 * Boolean'inis plant variant'as — gražus filter use case'ui.
 */
export function plantMatchesQuery(plant, query) {
  return plantFuzzyScore(plant, query) !== Infinity
}
