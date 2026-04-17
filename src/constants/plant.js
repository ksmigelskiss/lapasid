// Plant category keys
export const KATEGORIJA = {
  AUGINAMA: 'auginama',
  NORI:     'nori',
  ISTORIJA: 'istorija',
}

// Plant status keys
export const STATUS = {
  HEALTHY:    'healthy',
  SICK:       'sick',
  QUARANTINE: 'quarantine',
  NUMIRE:     'numire',
}

// Status display metadata (used in PlantDetail, PlantCard, Dashboard, WateringSession)
export const STATUS_OPTIONS = [
  { key: STATUS.HEALTHY,    dot: 'bg-green-400',  label: 'Sveikas',    bg: 'bg-green-100',  text: 'text-green-700' },
  { key: STATUS.SICK,       dot: 'bg-orange-400', label: 'Dėmesio',    bg: 'bg-orange-100', text: 'text-orange-700' },
  { key: STATUS.QUARANTINE, dot: 'bg-red-400',    label: 'Karantinas', bg: 'bg-red-100',    text: 'text-red-700' },
  { key: STATUS.NUMIRE,     dot: '',              label: 'Numirė',     bg: 'bg-gray-800',   text: 'text-white',   hideDot: true },
]

export function getStatusMeta(status) {
  return STATUS_OPTIONS.find(o => o.key === status) ?? STATUS_OPTIONS[0]
}
