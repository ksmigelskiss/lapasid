import { getPersonalityKey } from './plantMood'
import { getWateringForecast, shouldShowWateringAlert } from './wateringForecast'
import { getFertilizingForecast } from './fertilizingForecast'
import { getDormancyForecast } from './dormancyForecast'

const PERSONALITIES = {
  sultingas: (p) =>
    `Kalbi pirmuoju asmeniu kaip ${p.lietuviškas} (${p.lotyniskas}) — lakoniškas sultingas, sausa ironija, nemėgsti dramatizavimo. Kalbi lietuviškai.`,

  papartis: (p) =>
    `Kalbi pirmuoju asmeniu kaip ${p.lietuviškas} (${p.lotyniskas}) — jautrus papartis, šiek tiek dramatiškas, drėgmę pirmyn. Kalbi lietuviškai.`,

  greitas: (p) =>
    `Kalbi pirmuoju asmeniu kaip ${p.lietuviškas} (${p.lotyniskas}) — energingas, entuziastingas tropinis augalas. Kalbi lietuviškai.`,

  default: (p) =>
    `Kalbi pirmuoju asmeniu kaip ${p.lietuviškas} (${p.lotyniskas}) — ramus, išmintingas augalas. Kalbi lietuviškai.`,
}

function fmtDate(str) {
  if (!str) return '?'
  return new Date(str).toLocaleDateString('lt-LT', { month: 'short', day: 'numeric' })
}

export function buildChatSystemPrompt(plant) {
  const personality = PERSONALITIES[getPersonalityKey(plant)](plant)

  const statusLines = []

  const wc = getWateringForecast(plant)
  if (shouldShowWateringAlert(plant)) {
    statusLines.push(`Laistymas vėluoja ${Math.abs(wc.daysUntil)} d. (paskutinis: ${fmtDate(wc.lastDate)})`)
  } else if (wc.nextDate) {
    const label = wc.daysUntil <= 0 ? 'šiandien!' : `po ${wc.daysUntil} d.`
    statusLines.push(`Kitas laistymas: ${fmtDate(wc.nextDate)} (${label})`)
  }

  const fc = getFertilizingForecast(plant)
  if (fc.skipSeason) {
    statusLines.push('Žiemą netręšiama.')
  } else if (fc.isOverdue) {
    statusLines.push(`Pamaitink augalėlį — vėluoja ${Math.abs(fc.daysUntil)} d.`)
  } else if (fc.nextDate) {
    statusLines.push(`Kitas tręšimas: ${fmtDate(fc.nextDate)} (po ${fc.daysUntil} d.)`)
  }

  const df = getDormancyForecast(plant)
  if (df) {
    const w = { approaching: 'artėja žiemos miegas', active: 'dabar žiemos miege', waking: 'žadinuosi iš miego' }
    statusLines.push(w[df.window])
  }

  // Last 5 timeline events
  const TYPE = { watering: 'laistymas', fertilizing: 'tręšimas', repotting: 'persodinimas', note: 'pastaba' }
  const events = [...(plant.timeline ?? [])]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5)
    .map(e => `${fmtDate(e.date)}: ${TYPE[e.type] ?? e.type}${e.note ? ` — "${e.note}"` : ''}`)
    .join('\n')

  const notes = (plant.uzrasai ?? []).map(n => `— ${n.text}`).join('\n')
    || (plant.komentaras?.trim() ? `— ${plant.komentaras.trim()}` : '')

  return `${personality}

AUGALO APRAŠYMAS:
${plant.aprasymas?.trim() || 'Nėra aprašymo.'}

DABARTINĖ SITUACIJA:
${statusLines.length ? statusLines.join('\n') : 'Viskas gerai.'}

PASKUTINIAI ĮVYKIAI:
${events || 'Jokių įvykių dar nėra.'}
${notes ? `\nŠEIMININKO UŽRAŠAI:\n${notes}` : ''}
SVARBU: Atsakyk lietuviškai, augalo balsu. Paprasti klausimai — 1–3 sakiniai. Jei klausiama kodėl, kaip veikia, ar apie priežiūros logiką — aiškink esmingai (iki ~8 sakinių): biologiją, priežastis, ką svarbu žinoti. Be vandens žodžių.`
}
