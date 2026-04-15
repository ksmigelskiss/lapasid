import { shouldShowWateringAlert } from './wateringForecast'
import { getFertilizingForecast } from './fertilizingForecast'

// Primary display name: lietuviškas preferred, fallback to lotyniskas
function primaryName(p) {
  return p.lietuviškas || p.lotyniskas || '?'
}

function plantLine(p) {
  const flags = []
  if (shouldShowWateringAlert(p))              flags.push('laistymas vėluoja')
  if (getFertilizingForecast(p)?.isOverdue)    flags.push('tręšimas vėluoja')
  if (p.status === 'sick')                     flags.push('serga')
  if (p.status === 'quarantine')               flags.push('karantinas')
  const light  = p.sviesa?.lygis  ? `, šviesa: ${p.sviesa.lygis}`  : ''
  const water  = p.vanduo?.lygis  ? `, vanduo: ${p.vanduo.lygis}`  : ''
  const status = flags.length     ? ` [${flags.join(', ')}]`        : ''
  return `- ${primaryName(p)}${status}${light}${water}`
}

const NAME_RULE = `SVARBU: Minėdamas augalus visada naudok tik jų lietuviškus pavadinimus (kaip nurodyta sąraše). Lotynišką pavadinimą rašyk tik tada, kai vartotojas jo klausia.`

export function buildDashboardSystemPrompt(plants) {
  const n = plants.length
  return `Tu esi augalų kolekcijos asistentas. Atsakai lietuviškai, trumpai ir praktiškai.
${NAME_RULE}

Kolekcija (${n} augal${n === 1 ? 'as' : 'ai'}):
${plants.map(plantLine).join('\n') || '(kolekcija tuščia)'}

Gali padėti: patari ko trūksta kolekcijoje, kaip augalai papildo vienas kitą, kurie derinasi pagal šviesą ar drėgmę, primeni artėjančius priežiūros darbus, rekomenduoji naujus augalus pagal esamą stilių. Neatsakinėk į klausimus, nesusijusius su augalais.`
}

export function buildLibrarySystemPrompt(plants) {
  const active   = plants.filter(p => p.kategorija === 'auginama')
  const wishlist = plants.filter(p => p.kategorija === 'nori')
  const history  = plants.filter(p => p.kategorija === 'istorija')
  const names    = arr => arr.map(p => `- ${primaryName(p)}`).join('\n') || '(nėra)'

  return `Tu esi augalų bibliotekos asistentas. Atsakai lietuviškai, trumpai ir praktiškai.
${NAME_RULE}

Auginama (${active.length}):
${names(active)}

Norų sąrašas (${wishlist.length}):
${names(wishlist)}
${history.length ? `\nMirę augalai (${history.length}):\n${names(history)}` : ''}
Gali padėti: palygini augalus, patari ar norų sąrašo augalai tinka prie esamų, rekomenduoji ką pirkti pirmiausia, paaiškini skirtumus tarp panašių rūšių. Neatsakinėk į klausimus, nesusijusius su augalais.`
}
