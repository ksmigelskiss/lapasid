// Augalų rūšiavimo logika ir UI options.
// Naudojama Dashboard.jsx ("Rūšiuoti" filtrai).

import { shouldShowWateringAlert } from './wateringForecast'
import { getFertilizingForecast } from './fertilizingForecast'
import { getDormancyForecast } from './dormancyForecast'

export const SORT_OPTIONS = [
  { key: 'added',     label: 'Pridėta' },
  { key: 'name',      label: 'A–Z' },
  { key: 'light',     label: 'Šviesa' },
  { key: 'water',     label: 'Vanduo' },
  { key: 'attention', label: 'Dėmesys' },
  { key: 'difficulty',label: 'Sunkumas' },
]

export function sortPlants(plants, key) {
  const sorted = [...plants]
  switch (key) {
    case 'name':
      return sorted.sort((a, b) => (a.lietuviškas ?? '').localeCompare(b.lietuviškas ?? '', 'lt'))
    case 'light':
      return sorted.sort((a, b) => (b.sviesa?.taskai ?? 0) - (a.sviesa?.taskai ?? 0))
    case 'water':
      return sorted.sort((a, b) => (b.vanduo?.taskai ?? 0) - (a.vanduo?.taskai ?? 0))
    case 'attention':
      return sorted.sort((a, b) => {
        const score = p => {
          let s = 0
          if (shouldShowWateringAlert(p))      s += 4
          if (getFertilizingForecast(p).isOverdue) s += 3
          if (getDormancyForecast(p))          s += 2
          if ((p.status ?? 'healthy') !== 'healthy') s += 1
          return s
        }
        return score(b) - score(a)
      })
    case 'difficulty':
      return sorted.sort((a, b) => (b.sunkumas ?? 0) - (a.sunkumas ?? 0))
    case 'added':
    default:
      return sorted.sort((a, b) => new Date(b.data_prideta) - new Date(a.data_prideta))
  }
}
