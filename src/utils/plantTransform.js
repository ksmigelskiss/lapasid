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

export function fromAIResult(aiResult) {
  return {
    id: makeId(),
    lotyniskas:  aiResult.latinName ?? '',
    lietuviškas: aiResult.name ?? '',
    emoji:       aiResult.emoji ?? '🌿',
    tipas:       aiResult.tipas ?? '',
    augimo_greitis: aiResult.augimo_greitis ?? '',
    sunkumas:    aiResult.sunkumas ?? 2,
    toksiskas:      aiResult.toksiskas ?? false,
    toksiskumo_info: aiResult.toksiskumo_info ?? '',
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
