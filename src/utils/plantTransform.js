/**
 * Maps a Claude API search result → internal plant structure.
 * Single source of truth for the plant data model.
 */

export function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

export function today() {
  return new Date().toISOString().slice(0, 10)
}

// Normalizuoja AI grąžintą savybes objektą į saugią formą. Bet kuris laukas
// gali būti undefined — saugiai užpildom default'ais. UI naudoja granuliarius
// `pavojai[]` pirmiausia; jei tuščia, krenta į saugiklį `pavojingumas.yra`.
export function normalizeSavybes(s, legacyToksiskas, legacyInfo) {
  const empty = {
    pavojai: [],
    pavojingumas: { yra: false, lygis: null, detales: '' },
    valgomumas:   { statusas: 'none', dalys: '', detales: '' },
    vaistinis:    { statusas: 'none', naudojama: '', detales: '' },
  }
  if (!s || typeof s !== 'object') {
    // Backward compat — senas plant'as su toksiskas boolean'u, savybes nėra.
    // Krename legacy info'ą į saugiklį, kad UI parodytų bent „Atsargiai".
    if (legacyToksiskas) {
      return {
        ...empty,
        pavojingumas: { yra: true, lygis: null, detales: legacyInfo || '' },
      }
    }
    return empty
  }
  return {
    pavojai: Array.isArray(s.pavojai) ? s.pavojai.filter(p =>
      p && ['toksiskas','alergiskas','dirginantis'].includes(p.tipas)
        && ['zmonems','gyvunams'].includes(p.target)
        && ['silpnas','vidutinis','stiprus'].includes(p.severity)
    ) : [],
    pavojingumas: {
      yra:    !!s.pavojingumas?.yra,
      lygis:  ['silpnas','vidutinis','stiprus'].includes(s.pavojingumas?.lygis) ? s.pavojingumas.lygis : null,
      detales: s.pavojingumas?.detales ?? '',
    },
    valgomumas: {
      statusas: ['none','dalinai','pilnai'].includes(s.valgomumas?.statusas) ? s.valgomumas.statusas : 'none',
      dalys:    s.valgomumas?.dalys ?? '',
      detales:  s.valgomumas?.detales ?? '',
    },
    vaistinis: {
      statusas:  ['none','tradicine','moksline'].includes(s.vaistinis?.statusas) ? s.vaistinis.statusas : 'none',
      naudojama: s.vaistinis?.naudojama ?? '',
      detales:   s.vaistinis?.detales ?? '',
    },
  }
}

export function fromAIResult(aiResult) {
  // Verification status — visi AI rezultatai pradžioje yra `unverified`.
  // Vėliau admin / botanikas gali pažymėti `expert-verified` (per admin panel).
  // aiConfidence + aiMatchLevel + aiUncertaintyReason — užfiksuojam, kodėl
  // ši būsena susidarė, kad galėtume rodyti UI badge'ą ir filtruoti admin'e.
  const aiConfidence = aiResult.confidence ?? null
  const verificationStatus = aiConfidence === 'high' ? 'auto-verified' : 'unverified'

  return {
    id: makeId(),
    verificationStatus,
    aiConfidence,
    aiMatchLevel: aiResult.matchLevel ?? null,
    aiUncertaintyReason: aiResult.uncertaintyReason ?? null,
    aiVerifiedAt: new Date().toISOString(),
    lotyniskas:  aiResult.latinName ?? '',
    lietuviškas: aiResult.name ?? '',
    emoji:       aiResult.emoji ?? '🌿',
    tipas:       aiResult.tipas ?? '',
    augimo_greitis: aiResult.augimo_greitis ?? '',
    sunkumas:    aiResult.sunkumas ?? 2,
    // Backward compat — senas toksiskas boolean'as paliktas; UI fallback'ina į
    // jį, kol per „Atnaujinti per AI" mygtuką nepradedam pildyti savybes.
    toksiskas:      aiResult.toksiskas ?? aiResult.savybes?.pavojingumas?.yra ?? false,
    toksiskumo_info: aiResult.toksiskumo_info ?? aiResult.savybes?.pavojingumas?.detales ?? '',
    savybes: normalizeSavybes(aiResult.savybes, aiResult.toksiskas, aiResult.toksiskumo_info),
    aprasymas:   aiResult.aprasymas ?? aiResult.aiDescription ?? '',
    kilme:       aiResult.kilme ?? aiResult.origin ?? '',
    sviesa: aiResult.sviesa ?? {
      lygis:  aiResult.lightLevel ?? 'vidutinė',
      taskai: aiResult.lightScore ?? 2,
      ...(aiResult.ppfd?.min != null ? { ppfd: { min: aiResult.ppfd.min, max: aiResult.ppfd.max } } : {}),
    },
    vanduo: aiResult.vanduo ?? { lygis: 'vidutiniškai', taskai: 2 },
    laistymasIntervalas: aiResult.laistymasIntervalas ?? (aiResult.watering?.intervalVasara != null ? {
      vasara:  aiResult.watering.intervalVasara,
      ziema:   aiResult.watering.intervalZiema ?? null,
      metodas: aiResult.watering.metodas ?? '',
    } : undefined),
    tresimas: aiResult.tresimas ?? (aiResult.fertilizing?.intervalVasara != null ? {
      intervalVasara: aiResult.fertilizing.intervalVasara,
      intervalZiema:  aiResult.fertilizing.intervalZiema ?? null,
      tipas:          aiResult.fertilizing.tipas ?? '',
    } : undefined),
    dormancyInfo: aiResult.dormancyInfo ?? (aiResult.dormancy?.reikia != null ? {
      reikia: aiResult.dormancy.reikia,
      tipas:  aiResult.dormancy.tipas ?? null,
    } : undefined),
    prieziura: aiResult.prieziura ?? {
      sviesa:      aiResult.care?.light ?? '',
      laistymas:   aiResult.care?.water ?? '',
      temperatura: aiResult.care?.temperature ?? '',
      dregme:      aiResult.care?.humidity ?? '',
    },
    substratas:   aiResult.substratas ?? aiResult.care?.soil ?? '',
    persodinimas: aiResult.persodinimas ?? '',
    ziemojimas:   aiResult.ziemojimas ?? '',
    dauginimas:   Array.isArray(aiResult.dauginimas) ? aiResult.dauginimas : [],
    problemos:    Array.isArray(aiResult.problemos)  ? aiResult.problemos  : [],
    idomybes:     Array.isArray(aiResult.idomybes)   ? aiResult.idomybes   : [],
    kategorija:   'auginama',
    komentaras:   '',
    data_prideta: today(),
    image:        aiResult.image ?? null,
    status:       'healthy',
    inatLtName:   aiResult.inatLtName   ?? null,
    inatTaxonId:  aiResult.inatTaxonId  ?? null,
    sinonimai:    aiResult.sinonimai    ?? [],
    englishNames: aiResult.englishNames ?? [],
  }
}
