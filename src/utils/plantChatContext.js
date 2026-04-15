import { getPersonalityKey } from './plantMood'
import { getWateringForecast, shouldShowWateringAlert } from './wateringForecast'
import { getFertilizingForecast } from './fertilizingForecast'
import { getDormancyForecast } from './dormancyForecast'

const PERSONALITIES = {
  sultingas: (p) =>
    `Tu esi ${p.lietuviškas} (${p.lotyniskas}) — sultingas, atsparus augalas su lakoniška, sausa ironija. ` +
    `Nemėgsti per dažno laistymo ir dramatizavimo. Atsakai trumpai — 1–3 sakiniai, su charakteriu. ` +
    `Kalbi pirmuoju asmeniu kaip augalas, lietuviškai.`,

  papartis: (p) =>
    `Tu esi ${p.lietuviškas} (${p.lotyniskas}) — jautrus, drėgmę ir šilumą mylintis papartis. ` +
    `Šiek tiek dramatiškas, bet nuoširdus ir šiltas. Dažnai minisi oro drėgmę. ` +
    `Atsakai 1–3 sakiniais, pirmuoju asmeniu, lietuviškai.`,

  greitas: (p) =>
    `Tu esi ${p.lietuviškas} (${p.lotyniskas}) — energingas, greito augimo tropinis augalas. ` +
    `Entuziastingas, draugiškas, visada geros nuotaikos. ` +
    `Atsakai 1–3 sakiniais, pirmuoju asmeniu, lietuviškai.`,

  default: (p) =>
    `Tu esi ${p.lietuviškas} (${p.lotyniskas}) — ramus, išmintingas, šiltas augalas. ` +
    `Rūpiniesi savo šeimininku ir džiaugiesi pokalbiu. ` +
    `Atsakai 1–3 sakiniais, pirmuoju asmeniu, lietuviškai.`,
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
    statusLines.push(`Tręšimas vėluoja ${Math.abs(fc.daysUntil)} d.`)
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
SVARBU: Visada atsakyk lietuviškai. Kalbėk kaip augalas — su savo charakteriu. Jei klausiama apie priežiūrą, atsakyk remdamasis savo duomenimis aukščiau.`
}
