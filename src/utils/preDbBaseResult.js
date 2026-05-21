/**
 * preDbBaseResult — konvertuoja searchStage1 + previewParallelFetch rezultatus
 * į baseResult shape, kuris atitinka AI Phase 1 SLIM TOOL_PREVIEW output'ą.
 *
 * Kodėl: SearchModal Phase 0 catalog miss'as triggerina AI Phase 1, kuris
 * grąžina baseResult shape (latinName, name, aprasymas, kilme, savybes, image,
 * candidates). Įterpdami pre-DB Phase 0.3 prieš AI Phase 1, mes turim grąžinti
 * TĄ PAT shape'ą — kitaip UI komponentas (kuris dirba su baseResult) nesupras.
 *
 * Source mapping:
 *   stage1.latin             → latinName
 *   stage1.lietuviškas       → name
 *   stage1.ltSynonyms        → sinonimai
 *   stage1.family            → savybes context
 *   stage1.toxicity          → savybes.pavojai (struct'urizuota)
 *   stage1.toxicityStatus    → savybes.pavojingumas
 *   stage1.origin            → kilme
 *   preview.bestExtract      → aprasymas (LT pref, EN fallback su flag'u)
 *   preview.bestPhoto        → image (Wikipedia ar iNat URL)
 *   preview.bestExtract.url  → wikipediaUrl
 *
 * @param {object} stage1   — searchStage1 result (found: true)
 * @param {object} preview  — previewParallelFetch result (gali būti null jei skip'inom)
 * @param {object} opts
 * @param {string} opts.userQuery — originalas vartotojo įvestas terminas (telemetry)
 * @returns {object} baseResult-shaped objektas, ready setResult()'ui
 */
export function buildPreDbBaseResult(stage1, preview, opts = {}) {
  if (!stage1?.found) return null

  const { userQuery = '' } = opts

  // ── Identity ────────────────────────────────────────────────
  const latinName = stage1.latin
  const name = stage1.lietuviškas ?? null
  const sinonimai = (stage1.ltSynonyms ?? []).filter(s => s !== name)

  // ── Aprasymas — iš Wikipedia extract'o (jei yra) ────────────
  // bestExtract.lang = 'lt' | 'en'. EN atveju flag'inam, kad Phase 2 RAG'as
  // žinotų, jog reikia translate'inti į LT.
  let aprasymas = null
  let aprasymasLang = null
  let aprasymasNeedsTranslation = false
  let wikipediaUrl = null
  if (preview?.bestExtract?.extract) {
    aprasymas = preview.bestExtract.extract
    aprasymasLang = preview.bestExtract.lang
    aprasymasNeedsTranslation = !!preview.bestExtract.needsTranslation
    wikipediaUrl = preview.bestExtract.url
  }

  // ── Kilmė — pre-DB origin laukas ────────────────────────────
  const kilme = stage1.origin ?? null

  // ── Image — Wikipedia photo > iNat photo ─────────────────────
  const image = preview?.bestPhoto?.url ?? null
  const imageSource = preview?.bestPhoto?.source ?? null

  // ── Savybės — toxicity pirmiausia (mūsų primary value) ──────
  // Maps stage1.toxicity (ASPCA-derived) į schema, kurią laukia plantTransform.
  // 3 states: toxic / safe / unknown — current'a tik 'toxic' implementuota, kiti
  // ateičiai (PFAF safe-confirmed flag'as).
  const savybes = buildSavybes(stage1)

  // ── Sources tracking ────────────────────────────────────────
  // Per-field provenance, kad Phase 2 RAG'as paveldėtų ir UI badge'as
  // galėtų rodyti šaltinius (PFAF v2 sources{} schema).
  const sources = { ...stage1.sources }
  if (aprasymas)  sources.aprasymas = `wiki-${aprasymasLang}` + (aprasymasNeedsTranslation ? ' (needs translation)' : '')
  if (image)      sources.image     = imageSource ?? 'unknown'
  if (kilme)      sources.kilme     = stage1.sources?.family ?? 'pre-db'

  return {
    // Identity
    latinName,
    lotyniskas: latinName,
    name,
    lietuviškas: name,
    sinonimai,
    ltSynonyms: stage1.ltSynonyms ?? [],
    lotyniskiSinonimai: [],
    englishNames: [],

    // Narrative
    aprasymas,
    aprasymasLang,
    aprasymasNeedsTranslation,
    kilme,

    // Visual
    image,
    imageSource,
    wikipediaUrl,

    // Family / taxonomy
    family: stage1.family,

    // Properties
    savybes,

    // Toxicity (kept as top-level for UI badge)
    toxicityStatus: stage1.toxicityStatus,
    toxicity:       stage1.toxicity,

    // Cheng premium flag
    hasChengProfile: stage1.hasChengProfile,

    // Reclassification notice
    reclassification: stage1.reclassification,
    ltMatchedFrom:    stage1.ltMatchedFrom,

    // Source provenance
    sources,
    dbSources: stage1.dbSources ?? [],

    // Origin marker — UI gali rodyti badge'ą "Iš mūsų bibliotekos +Wikipedia"
    fromPreDb:      true,
    fromCatalog:    false,   // distinct from Phase 0 catalog hit
    fromAI:         false,
    preDbLayer:     stage1.layer,
    preDbConfidence: stage1.confidence,
    preDbElapsedMs: stage1.elapsedMs,
    previewElapsedMs: preview?.totalMs ?? null,

    // Telemetry
    userQuery,
    aiCalled: false,
    webSearchCalled: false,

    // Phase 2 pointer
    needsStage2: true,
    schemaVersion: 2,

    // No multi-candidates yet — pre-DB returns single hit
    candidates: undefined,
  }
}

/**
 * buildSavybes(stage1) — konvertuoja stage1 toxicity info'ą į savybes schema,
 * kurią laukia plantTransform / UI. Atsako tik už toxicity dalį — kitos
 * savybes (valgomumas, vaistinis) lieka empty (Phase 2 RAG'as užpildys iš PFAF).
 */
function buildSavybes(stage1) {
  const savybes = {
    pavojai: [],
    pavojingumas: { yra: false, lygis: null, detales: '' },
    valgomumas:   { statusas: 'none', dalys: '', detales: '' },
    vaistinis:    { statusas: 'none', naudojama: '', detales: '' },
  }

  if (stage1.toxicityStatus === 'toxic' && stage1.toxicity) {
    // ASPCA data: { isToxic, toxicTo: ['cats','dogs'], severity, sourceCount, detailUrl }
    const targets = stage1.toxicity.toxicTo ?? []
    savybes.pavojingumas = {
      yra: true,
      lygis: stage1.toxicity.severity === 'verified' ? 'vidutinis' : 'silpnas',
      detales: `ASPCA: toksiškas ${targets.join(', ')}. Šaltinis: ${stage1.toxicity.detailUrl ?? 'aspca.org'}`,
    }
    // Struct'urizuotas pavojai[] entry per target type
    for (const target of targets) {
      const targetLT = target === 'cats' ? 'gyvunams'
                     : target === 'dogs' ? 'gyvunams'
                     : target === 'horses' ? 'gyvunams'
                     : 'gyvunams'  // ASPCA targets visi yra gyvūnai
      savybes.pavojai.push({
        tipas: 'toksiskas',
        target: targetLT,
        severity: stage1.toxicity.severity === 'verified' ? 'vidutinis' : 'silpnas',
        detales: `${target} (ASPCA)`,
      })
    }
    // Dedupe (jei cats+dogs+horses → 3 entries gyvunams, paliekam unique by tipas+target+severity)
    const seen = new Set()
    savybes.pavojai = savybes.pavojai.filter(p => {
      const k = `${p.tipas}|${p.target}|${p.severity}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }

  return savybes
}
