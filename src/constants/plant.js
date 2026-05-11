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

// Status display metadata — Brandbook v1.0 paletė.
// Semantika perduodama per ikoną (žr. StatusPicker.jsx STATUS_ICON), ne per dot'ą.
// Healthy = forest (good), Sick = terracotta light (warning), Quarantine =
// terracotta solid (severe), Numirė = forest INK (final, like brandbook cover).
export const STATUS_OPTIONS = [
  { key: STATUS.HEALTHY,    label: 'Sveikas',    bg: 'bg-forest-100',     text: 'text-forest-700' },
  { key: STATUS.SICK,       label: 'Dėmesio',    bg: 'bg-terracotta-50',  text: 'text-terracotta-600' },
  { key: STATUS.QUARANTINE, label: 'Karantinas', bg: 'bg-terracotta-100', text: 'text-terracotta-600' },
  { key: STATUS.NUMIRE,     label: 'Numirė',     bg: 'bg-forest-800',     text: 'text-bone' },
]

export function getStatusMeta(status) {
  return STATUS_OPTIONS.find(o => o.key === status) ?? STATUS_OPTIONS[0]
}
